<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Shift;
use App\Models\User;
use App\Services\ShiftService;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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

        $user = $request->user();

        if (! $user->hasRole('Store Manager')) {
            throw new ApiException('SHIFT_MANAGER_ONLY', 'Only a Store Manager can open a shift.', 403);
        }

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'opening_cash' => ['nullable', 'numeric', 'min:0'],
            'assigned_user_ids' => ['nullable', 'array'],
            'assigned_user_ids.*' => ['integer'],
        ]);

        $branchId = $data['branch_id'] ?? TenantContext::branchId();

        if ($branchId === null) {
            throw new ApiException('BRANCH_REQUIRED', 'A branch is required to open a shift.', 422);
        }

        if (! $user->hasBranchAccess($branchId)) {
            throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
        }

        $assignedUserIds = collect($data['assigned_user_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $this->assertAssignableReps($branchId, $assignedUserIds->all());

        $shift = $this->shifts->open($user->id, $branchId, (float) ($data['opening_cash'] ?? 0), $assignedUserIds->all());

        AuditLog::record('shift.opened', 'shift', $shift->id, [
            'opening_cash' => $shift->opening_cash,
            'assigned_user_ids' => $shift->assignedUserIds(),
        ]);

        return ApiResponse::success($this->present($shift->load(['branch', 'user'])), 'Shift opened.');
    }

    /**
     * Only active Sales Representatives registered to the shift's branch may be
     * assigned to operate on it.
     *
     * @param  array<int, int>  $userIds
     */
    private function assertAssignableReps(int $branchId, array $userIds): void
    {
        if ($userIds === []) {
            return;
        }

        $reps = User::query()
            ->where('business_id', TenantContext::businessId())
            ->whereIn('id', $userIds)
            ->get()
            ->keyBy('id');

        foreach ($userIds as $userId) {
            $rep = $reps->get($userId);

            if ($rep === null || ! $rep->hasRole('Sales Representative')) {
                throw new ApiException('SHIFT_REP_INVALID', 'Only sales representatives can be assigned to a shift.', 422);
            }

            $branchIds = array_map('intval', is_array($rep->branch_ids) ? $rep->branch_ids : []);

            if (! in_array($branchId, $branchIds, true)) {
                throw new ApiException('SHIFT_REP_BRANCH', 'Sales reps must be registered to this branch to be assigned.', 422);
            }
        }
    }

    public function close(Request $request)
    {
        abort_unless($request->user()->can('shifts.operate'), 403);

        $data = $request->validate([
            'actual_cash' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
            'shift_id' => ['nullable', 'integer'],
        ]);

        $shift = null;

        if (isset($data['shift_id'])) {
            $shift = Shift::query()->findOrFail((int) $data['shift_id']);
        }

        if ($shift === null) {
            $shift = $this->shifts->current($request->user()->id, TenantContext::branchId());
        }

        if ($shift === null) {
            throw new ApiException('NO_OPEN_SHIFT', 'You do not have an open shift.', 422);
        }

        if (! $request->user()->hasBranchAccess($shift->branch_id)) {
            throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
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

    public function show(Request $request, Shift $shift)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $shift->load(['branch', 'user']);

        return ApiResponse::success($this->shifts->detail($shift));
    }

    public function storeMovement(Request $request, Shift $shift)
    {
        abort_unless($request->user()->can('shifts.operate'), 403);

        if (! $request->user()->hasBranchAccess($shift->branch_id)) {
            throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
        }

        $data = $request->validate([
            'type' => ['required', 'in:drop,payout'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $movement = $this->shifts->recordMovement(
            $shift,
            (string) $data['type'],
            (float) $data['amount'],
            $data['reason'] ?? null,
            $request->user()->id,
        );

        AuditLog::record('shift.cash_movement', 'shift_cash_movement', $movement->id, [
            'shift_id' => $shift->id,
            'type' => $movement->type,
            'amount' => (float) $movement->amount,
            'reference' => $movement->reference,
        ]);

        return ApiResponse::success(['id' => $movement->id, 'reference' => $movement->reference], $data['type'] === 'drop'
            ? 'Safe drop recorded.'
            : 'Paid out recorded.');
    }

    public function history(Request $request)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $paginator = Shift::query()
            ->with(['branch', 'user'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        $summaries = $this->shifts->summariesFor(collect($paginator->items()));

        return ApiResponse::paginator(
            $paginator,
            map: fn (Shift $shift) => [...$this->present($shift), 'summary' => $summaries[(int) $shift->id] ?? null],
        );
    }

    public function historySummary(Request $request)
    {
        abort_unless($request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        // No branch_id means the caller wants the full fleet ("All Terminals"),
        // matching the unfiltered shift feed. Only narrow when one is supplied.
        $branchId = $data['branch_id'] ?? null;
        $from = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : null;
        $to = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : null;

        $shifts = Shift::query()
            ->with(['branch', 'user'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->when($from, fn ($q) => $q->where('opened_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('opened_at', '<=', $to))
            ->orderByDesc('id')
            ->get();

        $summaries = $this->shifts->summariesFor($shifts);

        $closed = 0;
        $open = 0;
        $balanced = 0;
        $overage = 0;
        $short = 0;
        $cashSales = 0.0;
        $digitalSales = 0.0;
        $refundsTotal = 0.0;
        $dropsTotal = 0.0;
        $payoutsTotal = 0.0;
        $netVariance = 0.0;
        $cashReconciled = 0.0;
        $salesCount = 0;

        foreach ($shifts as $shift) {
            $summary = $summaries[(int) $shift->id];

            $cashSales += (float) $summary['cash_sales'];
            $digitalSales += (float) $summary['digital_sales'];
            $refundsTotal += (float) $summary['refunds_total'];
            $dropsTotal += (float) $summary['drops_total'];
            $payoutsTotal += (float) $summary['payouts_total'];
            $salesCount += (int) $summary['sales_count'];

            if ($shift->status === 'closed') {
                $closed++;
                $cashReconciled += (float) ($summary['actual_cash'] ?? 0);
                $variance = (float) ($summary['variance'] ?? 0);
                $netVariance += $variance;

                if (round($variance, 2) === 0.0) {
                    $balanced++;
                } elseif ($variance > 0) {
                    $overage++;
                } else {
                    $short++;
                }
            } else {
                $open++;
            }
        }

        $accuracy = $closed > 0 ? round($balanced / $closed * 100, 1) : 100.0;

        return ApiResponse::success([
            'branch_id' => $branchId,
            'range' => [
                'from' => $from?->toIso8601String(),
                'to' => $to?->toIso8601String(),
            ],
            'totals' => [
                'total_count' => $shifts->count(),
                'closed_count' => $closed,
                'open_count' => $open,
                'cash_sales' => round($cashSales, 2),
                'digital_sales' => round($digitalSales, 2),
                'refunds_total' => round($refundsTotal, 2),
                'drops_total' => round($dropsTotal, 2),
                'payouts_total' => round($payoutsTotal, 2),
                'sales_count' => $salesCount,
                'cash_reconciled' => round($cashReconciled, 2),
                'net_variance' => round($netVariance, 2),
                'accuracy_pct' => $accuracy,
            ],
            'filters' => [
                'all' => $shifts->count(),
                'balanced' => $balanced,
                'overage' => $overage,
                'variance' => $short,
            ],
        ]);
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
            'reference' => $shift->reference,
            'branch_id' => $shift->branch_id,
            'branch_name' => $shift->branch?->name ?? '',
            'branch_code' => $shift->branch?->code ?? '',
            'user_id' => $shift->user_id,
            'user_name' => $shift->user?->name ?? '',
            'user_role' => $shift->user?->getRoleNames()->first() ?? 'Staff',
            'assigned_user_ids' => $shift->assignedUserIds(),
            'status' => $shift->status,
            'opened_at' => $shift->opened_at?->toIso8601String() ?? $shift->created_at?->toIso8601String(),
            'closed_at' => $shift->closed_at?->toIso8601String(),
            'expected_cash' => (float) $shift->expected_cash,
            'opening_cash' => (float) $shift->opening_cash,
            'actual_cash' => $shift->actual_cash === null ? null : (float) $shift->actual_cash,
            'variance' => $shift->variance === null ? null : (float) $shift->variance,
            'notes' => $shift->notes,
        ];
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
