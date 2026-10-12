<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\SaleSession;
use App\Services\SaleSessionService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class SaleSessionController extends Controller
{
    public function __construct(private readonly SaleSessionService $sessions)
    {
    }

    public function current(Request $request)
    {
        abort_unless($request->user()->can('sales.session') || $request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $userId = $request->integer('user_id') ?: $request->user()->id;
        $branchId = $request->integer('branch_id') ?: TenantContext::branchId();

        $session = $this->sessions->currentForUser($userId, $branchId);

        return ApiResponse::success($session ? $this->sessions->present($session->load(['shift', 'branch', 'user'])) : null);
    }

    public function open(Request $request)
    {
        abort_unless($request->user()->can('sales.session'), 403);

        $data = $request->validate([
            'shift_id' => ['nullable', 'integer'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
        ]);

        $session = $this->sessions->open(
            $request->user(),
            isset($data['shift_id']) ? (int) $data['shift_id'] : null,
            (float) ($data['opening_balance'] ?? 0),
        );

        AuditLog::record('sale.opened', 'sale_session', $session->id, [
            'reference' => $session->reference,
            'shift_id' => $session->shift_id,
            'opening_balance' => $session->opening_balance,
            'opening_stock_value' => $session->opening_stock_value,
        ]);

        return ApiResponse::success($this->sessions->present($session->load(['shift', 'branch', 'user'])), 'Sale opened.');
    }

    public function close(Request $request, SaleSession $saleSession)
    {
        abort_unless($request->user()->can('sales.session') || $request->user()->can('shifts.operate'), 403);

        if ($saleSession->user_id !== $request->user()->id && ! $request->user()->can('shifts.operate')) {
            throw new ApiException('FORBIDDEN', 'Only the owning sales representative can close this sale.', 403);
        }

        $data = $request->validate([
            'closing_amount' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        [$closed, $reconciliation] = $this->sessions->close(
            $saleSession,
            (float) $data['closing_amount'],
            $data['notes'] ?? null,
            $request->user(),
        );

        AuditLog::record('sale.closed', 'sale_session', $closed->id, [
            'reference' => $closed->reference,
            'closing_amount' => $closed->closing_amount,
            'variance' => $closed->variance,
            'stock_variance' => $closed->stock_variance,
        ]);

        return ApiResponse::success(
            [...$this->sessions->present($closed->load(['shift', 'branch', 'user', 'closedBy'])), 'reconciliation' => $reconciliation],
            'Sale closed.',
        );
    }

    public function show(Request $request, SaleSession $saleSession)
    {
        abort_unless($request->user()->can('sales.session') || $request->user()->can('sales.view') || $request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        return ApiResponse::success($this->sessions->detail($saleSession));
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->can('sales.session') || $request->user()->can('sales.view') || $request->user()->can('shifts.view') || $request->user()->can('shifts.operate'), 403);

        $paginator = SaleSession::query()
            ->with(['shift', 'branch', 'user'])
            ->when($request->filled('shift_id'), fn ($q) => $q->where('shift_id', $request->integer('shift_id')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (SaleSession $session) => $this->sessions->present($session));
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
