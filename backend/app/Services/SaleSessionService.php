<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleSession;
use App\Models\Shift;
use App\Models\ShiftCashMovement;
use App\Models\User;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;

class SaleSessionService
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function currentForUser(int $userId, ?int $branchId): ?SaleSession
    {
        return SaleSession::query()
            ->with(['shift', 'branch', 'user'])
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->latest('opened_at')
            ->first();
    }

    public function findOpenForUser(int $userId, ?int $branchId): ?SaleSession
    {
        return $this->currentForUser($userId, $branchId);
    }

    public function open(User $rep, ?int $shiftId, float $openingBalance): SaleSession
    {
        $branchId = TenantContext::branchId()
            ?? (is_array($rep->branch_ids) ? ($rep->branch_ids[0] ?? null) : null);

        $shift = null;

        if ($shiftId !== null) {
            $shift = Shift::query()->find($shiftId);
        } else {
            $shift = Shift::query()
                ->where('status', 'open')
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->latest('opened_at')
                ->first();
        }

        if ($shift === null || $shift->status !== 'open') {
            throw new ApiException('NO_OPEN_SHIFT', 'A shift must be opened before a sale can be opened.', 422);
        }

        if (! in_array($rep->id, $shift->assignedUserIds(), true)) {
            throw new ApiException('NOT_ASSIGNED', 'You have not been assigned to this shift.', 403);
        }

        $existing = SaleSession::query()
            ->where('shift_id', $shift->id)
            ->where('user_id', $rep->id)
            ->where('status', 'open')
            ->first();

        if ($existing !== null) {
            throw new ApiException('SALE_ALREADY_OPEN', 'You already have an open sale on this shift.', 422);
        }

        $snapshot = $this->inventory->branchSnapshot((int) $shift->branch_id);

        $session = SaleSession::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => $shift->branch_id,
            'shift_id' => $shift->id,
            'user_id' => $rep->id,
            'reference' => ReferenceGenerator::make('SES'),
            'status' => 'open',
            'opened_at' => now(),
            'opening_balance' => round($openingBalance, 2),
            'expected_cash' => round($openingBalance, 2),
            'opening_stock_qty' => $snapshot['quantity'],
            'opening_stock_value' => $snapshot['value'],
        ]);

        return $session->fresh(['shift', 'branch', 'user']);
    }

    /**
     * @return array{0: SaleSession, 1: array}
     */
    public function close(SaleSession $session, float $closingAmount, ?string $notes, User $user): array
    {
        if ($session->status !== 'open') {
            throw new ApiException('SALE_CLOSED', 'This sale is already closed.', 422);
        }

        $reconciliation = $this->reconciliation($session);

        $snapshot = $this->inventory->branchSnapshot((int) $session->branch_id);

        $stockVariance = round((float) $session->opening_stock_value - $reconciliation['cogs'] - $snapshot['value'], 2);

        $session->forceFill([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by' => $user->id,
            'closing_amount' => round($closingAmount, 2),
            'expected_cash' => $reconciliation['expected_cash'],
            'variance' => round($closingAmount - $reconciliation['expected_cash'], 2),
            'closing_stock_qty' => $snapshot['quantity'],
            'closing_stock_value' => $snapshot['value'],
            'stock_variance' => $stockVariance,
            'sales_total' => $reconciliation['sales_total'],
            'sales_count' => $reconciliation['sales_count'],
            'notes' => $notes ?? $session->notes,
        ])->save();

        $reconciliation['closing_amount'] = (float) $session->closing_amount;
        $reconciliation['variance'] = (float) $session->variance;
        $reconciliation['stock_variance'] = $stockVariance;

        return [$session->fresh(['shift', 'branch', 'user', 'closedBy']), $reconciliation];
    }

    public function reconciliation(SaleSession $session): array
    {
        [$from, $to] = $this->window($session);

        $saleIds = Sale::query()
            ->where('sale_session_id', $session->id)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->pluck('id');

        $payments = Payment::query()
            ->whereIn('sale_id', $saleIds)
            ->whereIn('status', ['confirmed', 'completed'])
            ->get();

        $cash = (float) $payments->where('method', 'cash')->sum('amount');
        $digital = (float) $payments->where('method', '!=', 'cash')->sum('amount');

        $refundsTotal = (float) Refund::query()
            ->whereIn('sale_id', $saleIds)
            ->where('status', 'approved')
            ->sum('total');

        $movements = ShiftCashMovement::query()->where('sale_session_id', $session->id);
        $dropsTotal = (float) (clone $movements)->where('type', 'drop')->sum('amount');
        $payoutsTotal = (float) (clone $movements)->where('type', 'payout')->sum('amount');

        $expected = round((float) $session->opening_balance + $cash - $refundsTotal - $dropsTotal - $payoutsTotal, 2);

        $salesTotal = (float) Sale::query()
            ->where('sale_session_id', $session->id)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->sum('total');

        $salesCount = (int) $saleIds->count();

        $cogs = (float) SaleItem::query()
            ->whereIn('sale_id', $saleIds)
            ->selectRaw('COALESCE(SUM(cost_price * quantity), 0) AS cogs')
            ->value('cogs');

        $soldQty = (float) SaleItem::query()
            ->whereIn('sale_id', $saleIds)
            ->sum('quantity');

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'opening_balance' => (float) $session->opening_balance,
            'expected_cash' => $expected,
            'closing_amount' => $session->closing_amount === null ? null : (float) $session->closing_amount,
            'variance' => $session->closing_amount === null ? null : round((float) $session->closing_amount - $expected, 2),
            'cash_sales' => round($cash, 2),
            'digital_sales' => round($digital, 2),
            'refunds_total' => round($refundsTotal, 2),
            'drops_total' => round($dropsTotal, 2),
            'payouts_total' => round($payoutsTotal, 2),
            'sales_total' => round($salesTotal, 2),
            'sales_count' => $salesCount,
            'cogs' => round($cogs, 2),
            'sold_qty' => round($soldQty, 3),
            'payment_breakdown' => $payments
                ->groupBy('method')
                ->map(fn ($rows, $method) => [
                    'method' => $method,
                    'amount' => round((float) $rows->sum('amount'), 2),
                    'count' => $rows->count(),
                ])
                ->values()
                ->all(),
        ];
    }

    public function detail(SaleSession $session): array
    {
        $session->load(['shift', 'branch.business', 'user', 'closedBy']);

        $reconciliation = $this->reconciliation($session);

        $sales = $session->sales()
            ->with(['customer', 'payments'])
            ->orderBy('id')
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => (int) $sale->id,
                'reference' => $sale->reference,
                'customer_name' => $sale->customer?->name,
                'status' => $sale->status,
                'payment_status' => $sale->payment_status,
                'total' => (float) $sale->total,
                'payment_methods' => $sale->payments->pluck('method')->unique()->values()->all(),
                'created_at' => $sale->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            ...$this->present($session),
            'reconciliation' => $reconciliation,
            'sales' => $sales,
        ];
    }

    public function present(SaleSession $session): array
    {
        $shift = $session->shift;

        return [
            'id' => (int) $session->id,
            'reference' => $session->reference,
            'status' => $session->status,
            'business_id' => (int) $session->business_id,
            'business_name' => $session->branch?->business?->name ?? '',
            'branch_id' => (int) $session->branch_id,
            'branch_name' => $session->branch?->name ?? '',
            'branch_code' => $session->branch?->code ?? '',
            'shift_id' => (int) $session->shift_id,
            'shift_reference' => $shift?->reference,
            'user_id' => (int) $session->user_id,
            'user_name' => $session->user?->name ?? '',
            'user_role' => $session->user?->getRoleNames()->first() ?? 'Sales Representative',
            'closed_by_name' => $session->closedBy?->name,
            'opened_at' => $session->opened_at?->toIso8601String() ?? $session->created_at?->toIso8601String(),
            'closed_at' => $session->closed_at?->toIso8601String(),
            'opening_balance' => (float) $session->opening_balance,
            'closing_amount' => $session->closing_amount === null ? null : (float) $session->closing_amount,
            'expected_cash' => (float) $session->expected_cash,
            'variance' => $session->variance === null ? null : (float) $session->variance,
            'opening_stock_qty' => (float) $session->opening_stock_qty,
            'opening_stock_value' => (float) $session->opening_stock_value,
            'closing_stock_qty' => $session->closing_stock_qty === null ? null : (float) $session->closing_stock_qty,
            'closing_stock_value' => $session->closing_stock_value === null ? null : (float) $session->closing_stock_value,
            'stock_variance' => $session->stock_variance === null ? null : (float) $session->stock_variance,
            'sales_total' => (float) $session->sales_total,
            'sales_count' => (int) $session->sales_count,
            'notes' => $session->notes,
        ];
    }

    private function window(SaleSession $session): array
    {
        $from = $session->opened_at ?? $session->created_at ?? now()->startOfDay();
        $to = $session->closed_at ?? now();

        return [$from, $to];
    }
}
