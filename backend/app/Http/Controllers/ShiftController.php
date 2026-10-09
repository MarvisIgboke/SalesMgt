<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Shift;
use App\Services\ShiftService;
use App\Support\ApiResponse;
use App\Support\AuditLog;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function __construct(private readonly ShiftService $shifts)
    {
    }

    public function config(Request $request)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        return ApiResponse::success($this->shifts->config());
    }

    public function setConfig(Request $request)
    {
        abort_unless($request->user()->can('shifts.reconcile'), 403);

        $data = $request->validate([
            'shifts_enabled' => ['nullable', 'boolean'],
            'require_cash_reconciliation' => ['nullable', 'boolean'],
        ]);

        $config = $this->shifts->setConfig($data['shifts_enabled'] ?? null, $data['require_cash_reconciliation'] ?? null);

        AuditLog::record('shifts.config_updated', 'business_setting', null, $config);

        return ApiResponse::success($config, 'Shift settings updated.');
    }

    public function current(Request $request)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $branchId = $request->integer('branch_id') ?: TenantContext::branchId();

        $shift = $this->shifts->current($request->user()->id, $branchId);

        return ApiResponse::success($shift ? $this->present($shift->load(['branch', 'user'])) : null);
    }

    public function open(Request $request)
    {
        abort_unless($request->user()->can('shifts.operate'), 403);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'opening_cash' => ['nullable', 'numeric', 'min:0'],
        ]);

        $branchId = $data['branch_id'] ?? TenantContext::branchId();

        if ($branchId === null) {
            throw new ApiException('BRANCH_REQUIRED', 'A branch is required to open a shift.', 422);
        }

        if (! $request->user()->hasBranchAccess($branchId)) {
            throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
        }

        $shift = $this->shifts->open($request->user()->id, $branchId, (float) ($data['opening_cash'] ?? 0));

        AuditLog::record('shift.opened', 'shift', $shift->id, ['opening_cash' => $shift->opening_cash]);

        return ApiResponse::success($this->present($shift->load(['branch', 'user'])), 'Shift opened.');
    }

    public function close(Request $request)
    {
        abort_unless($request->user()->can('shifts.operate'), 403);

        $data = $request->validate([
            'actual_cash' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $shift = $this->shifts->current($request->user()->id, TenantContext::branchId());

        if ($shift === null) {
            throw new ApiException('NO_OPEN_SHIFT', 'You do not have an open shift.', 422);
        }

        [$closed, $reconciliation] = $this->shifts->close($shift, isset($data['actual_cash']) ? (float) $data['actual_cash'] : null, $data['notes'] ?? null);

        AuditLog::record('shift.closed', 'shift', $closed->id, [
            'expected_cash' => $closed->expected_cash,
            'actual_cash' => $closed->actual_cash,
            'variance' => $closed->variance,
        ]);

        return ApiResponse::success(
            [...$this->present($closed->load(['branch', 'user'])), 'reconciliation' => $reconciliation],
            'Shift closed.',
        );
    }

    public function history(Request $request)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $paginator = Shift::query()
            ->with(['branch', 'user'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Shift $shift) => $this->present($shift));
    }

    public function reconcile(Request $request)
    {
        abort_unless($request->user()->can('shifts.reconcile') || $request->user()->can('shifts.operate'), 403);

        $data = $request->validate([
            'actual_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $shift = $this->shifts->current($request->user()->id, TenantContext::branchId());

        if ($shift === null) {
            throw new ApiException('NO_OPEN_SHIFT', 'You do not have an open shift.', 422);
        }

        $reconciliation = $this->shifts->reconciliation($shift);
        $reconciliation['actual_cash'] = (float) $data['actual_cash'];
        $reconciliation['variance'] = round((float) $data['actual_cash'] - $reconciliation['expected_cash'], 2);

        return ApiResponse::success($reconciliation);
    }

    private function present(Shift $shift): array
    {
        return [
            'id' => $shift->id,
            'branch_id' => $shift->branch_id,
            'branch_name' => $shift->branch?->name ?? '',
            'user_id' => $shift->user_id,
            'user_name' => $shift->user?->name ?? '',
            'status' => $shift->status,
            'opened_at' => $shift->opened_at?->toIso8601String() ?? $shift->created_at?->toIso8601String(),
            'closed_at' => $shift->closed_at?->toIso8601String(),
            'expected_cash' => (float) $shift->expected_cash,
            'opening_cash' => (float) $shift->opening_cash,
        ];
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}