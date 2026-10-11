<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerAccount;
use App\Models\CustomerTransaction;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SaleApproval;
use App\Models\SaleItem;
use App\Models\SupplierAccount;
use App\Models\SupplierInvoice;
use App\Exceptions\ApiException;
use App\Services\CustomerLedgerService;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinanceController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly CustomerLedgerService $ledger,
    ) {
    }

    public function approvals(Request $request)
    {
        $this->authorize($request, ['finance.view', 'finance.payment_approve', 'finance.payment_reject']);

        $status = $request->query('status');

        $paginator = $this->approvalsQuery()
            ->when(in_array($status, ['pending', 'awaiting_approval'], true), fn ($q) => $q->where('status', 'pending'))
            ->when(in_array($status, ['approved', 'rejected'], true), fn ($q) => $q->where('status', $status))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator(
            $paginator,
            map: fn (SaleApproval $approval) => $this->presentApproval($approval),
            extra: ['summary' => $this->approvalsSummary()],
        );
    }

    private function approvalsQuery(): Builder
    {
        $businessId = TenantContext::businessId();

        return SaleApproval::query()
            ->with(['sale.branch', 'sale.user', 'sale.customer'])
            ->when(
                $businessId !== null,
                fn ($q) => $q->whereHas('sale', fn ($sale) => $sale->where('business_id', $businessId)),
            );
    }

    private function approvalsSummary(): array
    {
        $businessId = TenantContext::businessId();

        $base = fn () => DB::table('sale_approvals')
            ->join('sales', 'sales.id', '=', 'sale_approvals.sale_id')
            ->when($businessId !== null, fn ($q) => $q->where('sales.business_id', $businessId));

        $byStatus = $base()
            ->groupBy('sale_approvals.status')
            ->selectRaw('sale_approvals.status as status, COUNT(*) as total, COALESCE(SUM(sales.total), 0) as amount')
            ->get()
            ->keyBy('status');

        $stat = function (string $status, ?string $column = null, ?string $operator = null, ?string $bound = null) use ($base): array {
            $query = $base()->where('sale_approvals.status', $status);
            if ($column !== null && $operator !== null && $bound !== null) {
                $query->where('sale_approvals.'.$column, $operator, $bound);
            }
            $row = $query->selectRaw('COUNT(*) as total, COALESCE(SUM(sales.total), 0) as amount')->first();

            return ['count' => (int) ($row->total ?? 0), 'amount' => round((float) ($row->amount ?? 0), 2)];
        };

        $startOfToday = now()->startOfDay()->toDateTimeString();
        $overdueBefore = now()->subDay()->toDateTimeString();

        $overdue = $stat('pending', 'created_at', '<', $overdueBefore);
        $cleared = $stat('approved', 'decided_at', '>=', $startOfToday);
        $rejected = $stat('rejected', 'decided_at', '>=', $startOfToday);

        $oldestPending = $base()
            ->where('sale_approvals.status', 'pending')
            ->min('sale_approvals.created_at');

        return [
            'pending_count' => (int) ($byStatus['pending']->total ?? 0),
            'pending_amount' => round((float) ($byStatus['pending']->amount ?? 0), 2),
            'approved_count' => (int) ($byStatus['approved']->total ?? 0),
            'rejected_count' => (int) ($byStatus['rejected']->total ?? 0),
            'overdue_count' => $overdue['count'],
            'oldest_pending_at' => $oldestPending !== null ? Carbon::parse($oldestPending)->toIso8601String() : null,
            'cleared_today_count' => $cleared['count'],
            'cleared_today_amount' => $cleared['amount'],
            'rejected_today_count' => $rejected['count'],
            'rejected_today_amount' => $rejected['amount'],
        ];
    }

    public function decide(Request $request, int $approval)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->authorize($request, [
            $data['decision'] === 'approved' ? 'finance.payment_approve' : 'finance.payment_reject',
        ]);

        $record = SaleApproval::query()->with(['sale.items', 'sale.customer.account'])->findOrFail($approval);

        if ($record->status !== 'pending') {
            throw new ApiException('invalid_state', 'This approval has already been decided.', 422);
        }

        $sale = $record->sale;

        if ($sale === null) {
            abort(404);
        }

        DB::transaction(function () use ($record, $sale, $data, $request) {
            if ($data['decision'] === 'approved') {
                $this->completeSale($sale, $request->user()->id);
            } else {
                $sale->forceFill([
                    'status' => 'cancelled',
                    'payment_status' => 'unpaid',
                    'approval_state' => array_merge((array) $sale->approval_state, ['status' => 'rejected']),
                ])->save();
            }

            $record->forceFill([
                'status' => $data['decision'],
                'approver_id' => $request->user()->id,
                'notes' => $data['notes'] ?? $record->notes,
                'decided_at' => now(),
            ])->save();
        });

        AuditLog::record('finance.sale_approval_decided', 'sale_approval', $record->id, [
            'sale_id' => $sale->id,
            'decision' => $data['decision'],
        ]);

        $record->load(['sale.branch', 'sale.user', 'sale.customer']);

        return ApiResponse::success($this->presentApproval($record), 'Decision recorded.');
    }

    public function reconciliation(Request $request)
    {
        $this->authorize($request, ['finance.view', 'finance.reconcile']);

        $paginator = Payment::query()
            ->with(['sale'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Payment $payment) => [
            'id' => $payment->id,
            'date' => $payment->created_at?->toIso8601String(),
            'reference' => $payment->reference,
            'description' => trim(($payment->sale?->reference ? 'Sale '.$payment->sale->reference : 'Payment').' · '.$payment->method),
            'amount' => (float) $payment->amount,
            'status' => $payment->status,
            'bank_reference' => $payment->bank_reference,
        ]);
    }

    public function receivables(Request $request)
    {
        $this->authorize($request, ['finance.view']);

        $outstanding = (float) CustomerAccount::query()->where('balance', '>', 0)->sum('balance');

        $overdue = (float) CustomerTransaction::query()
            ->where('debit', '>', 0)
            ->where('created_at', '<', now()->subDays(30))
            ->whereIn('customer_id', CustomerAccount::query()->where('balance', '>', 0)->pluck('customer_id'))
            ->sum('debit');

        return ApiResponse::success([
            'total' => round($outstanding, 2),
            'outstanding' => round($outstanding, 2),
            'overdue' => round(min($overdue, $outstanding), 2),
        ]);
    }

    public function payables(Request $request)
    {
        $this->authorize($request, ['finance.view']);

        $outstanding = (float) SupplierAccount::query()->where('balance', '>', 0)->sum('balance');

        $overdue = (float) SupplierInvoice::query()
            ->where('status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->sum('amount');

        return ApiResponse::success([
            'total' => round($outstanding, 2),
            'outstanding' => round($outstanding, 2),
            'overdue' => round($overdue, 2),
        ]);
    }

    private function completeSale(Sale $sale, int $userId): void
    {
        $state = (array) $sale->approval_state;
        $method = $state['method'] ?? 'cash';

        $sale->loadMissing(['items', 'customer.account']);

        foreach ($sale->items as $item) {
            $quantity = (float) $item->quantity;
            $cost = $this->inventory->consumeFefo(
                (int) $sale->branch_id,
                (int) $item->product_id,
                $item->variant_id,
                $quantity,
                'out',
                (string) $sale->reference,
                $userId,
            );

            if ($quantity > 0) {
                $item->forceFill(['cost_price' => round($cost / $quantity, 2)])->save();
            }
        }

        $total = (float) $sale->total;

        if ($method === 'credit' && $sale->customer !== null) {
            $this->ledger->charge($sale->customer, $total, 'Credit sale '.$sale->reference, $sale->reference, 'charge');
            $paymentStatus = 'credit';
        } else {
            Payment::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $sale->branch_id,
                'sale_id' => $sale->id,
                'customer_id' => $sale->customer_id,
                'reference' => ReferenceGenerator::make('PAY'),
                'method' => $method,
                'amount' => $total,
                'status' => 'confirmed',
                'client_request_id' => $sale->client_request_id,
                'created_by' => $userId,
                'confirmed_by' => $userId,
                'confirmed_at' => now(),
            ]);
            $paymentStatus = 'paid';
        }

        $sale->forceFill([
            'status' => 'completed',
            'payment_status' => $paymentStatus,
            'paid_amount' => $method === 'credit' ? 0 : $total,
            'approval_state' => array_merge($state, ['status' => 'approved']),
        ])->save();
    }

    private function presentApproval(SaleApproval $approval): array
    {
        $sale = $approval->sale;
        $state = (array) ($sale->approval_state ?? []);

        return [
            'id' => $approval->id,
            'sale_reference' => $sale?->reference,
            'customer_name' => $sale?->customer?->name,
            'amount' => (float) ($sale->total ?? 0),
            'payment_method' => $state['method'] ?? 'credit',
            'bank_reference' => null,
            'match_result' => null,
            'branch_name' => $sale?->branch?->name,
            'sales_rep' => $sale?->user?->name ?? 'Staff',
            'status' => $approval->status,
            'kind' => $approval->kind,
            'reason' => $approval->reason,
            'notes' => $approval->notes,
            'created_at' => $approval->created_at?->toIso8601String(),
            'decided_at' => $approval->decided_at?->toIso8601String(),
        ];
    }

    private function authorize(Request $request, array $permissions): void
    {
        $user = $request->user();
        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return;
            }
        }
        abort(403);
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
