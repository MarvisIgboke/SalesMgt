<?php

namespace App\Services;

use App\Models\Business;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function build(string $period = 'today', ?int $branchId = null): array
    {
        $business = Business::query()->with('wallet')->findOrFail(TenantContext::businessId());
        $currency = $business->currency;
        $branchId ??= TenantContext::branchId();

        [$from, $to] = $this->range($period);

        $salesQuery = fn () => DB::table('sales')
            ->where('business_id', $business->id)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        $salesAgg = $salesQuery()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(total), 0) AS amount, COUNT(*) AS count')
            ->first();

        $profit = $salesQuery()
            ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.created_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(sale_items.line_total - (sale_items.cost_price * sale_items.quantity)), 0) AS profit')
            ->value('profit');

        $expenses = DB::table('expenses')
            ->where('business_id', $business->id)
            ->whereIn('status', ['approved', 'paid'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        $customerCredit = DB::table('customer_accounts')
            ->where('business_id', $business->id)
            ->sum('balance');

        $paymentBreakdown = DB::table('payments')
            ->where('business_id', $business->id)
            ->whereIn('status', ['confirmed', 'completed'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('method')
            ->selectRaw('method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->method,
                'amount' => (float) $row->amount,
                'count' => (int) $row->count,
            ])->values()->all();

        $pendingPayments = DB::table('payments')
            ->where('business_id', $business->id)
            ->whereIn('status', ['unpaid', 'partially_paid', 'pending_confirmation'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->count();

        $pendingInventory = DB::table('stock_adjustments')
            ->where('business_id', $business->id)
            ->where('status', 'pending')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->count();

        $lowStockCount = $this->lowStockQuery($business->id, $branchId)->count();

        $expiringQuery = fn () => DB::table('stock_batches')
            ->where('business_id', $business->id)
            ->where('status', 'available')
            ->where('quantity_available', '>', 0)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        $expiringCount = $expiringQuery()
            ->whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [now()->toDateString(), now()->addDays(30)->toDateString()])
            ->count();

        $expiredCount = $expiringQuery()
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<', now()->toDateString())
            ->count();

        return [
            'kpis' => [
                'period' => $period,
                'sales' => ['amount' => (float) $salesAgg->amount, 'currency' => $currency],
                'transaction_count' => (int) $salesAgg->count,
                'gross_profit' => ['amount' => (float) $profit, 'currency' => $currency],
                'expenses' => ['amount' => (float) $expenses, 'currency' => $currency],
                'customer_credit' => ['amount' => (float) $customerCredit, 'currency' => $currency],
                'wallet_balance' => ['amount' => (float) ($business->wallet->balance ?? 0), 'currency' => $currency],
                'payment_breakdown' => $paymentBreakdown,
                'pending_payments' => $pendingPayments,
                'pending_inventory_approvals' => $pendingInventory,
                'low_stock_count' => $lowStockCount,
                'expiring_stock_count' => $expiringCount,
                'expired_stock_count' => $expiredCount,
            ],
            'sales_trend' => $this->salesTrend($business->id, $branchId),
            'payment_breakdown' => $paymentBreakdown,
            'branch_performance' => $this->branchPerformance($business->id, $from, $to),
            'staff_performance' => $this->staffPerformance($business->id, $branchId, $from, $to, $currency),
            'latest_sales' => $this->latestSales($business->id, $branchId),
            'low_stock' => $this->lowStockQuery($business->id, $branchId)->limit(5)->get()->all(),
            'expiring_stock' => $this->expiringList($business->id, $branchId),
            'recent_activity' => DB::table('audit_logs')
                ->where('business_id', $business->id)
                ->orderByDesc('created_at')
                ->limit(5)
                ->select('id', 'action', 'entity_type', 'entity_id', 'created_at')
                ->get()
                ->all(),
        ];
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function range(string $period): array
    {
        return match ($period) {
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [now()->startOfDay(), now()->endOfDay()],
        };
    }

    private function salesTrend(int $businessId, ?int $branchId): array
    {
        $rows = DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->where('created_at', '>=', now()->subDays(6)->startOfDay())
            ->groupBy('day')
            ->selectRaw('DATE(created_at) AS day, COALESCE(SUM(total), 0) AS value')
            ->get()
            ->keyBy('day');

        $trend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $trend[] = [
                'label' => now()->subDays($i)->format('D'),
                'value' => (float) ($rows[$date]->value ?? 0),
            ];
        }

        return $trend;
    }

    private function branchPerformance(int $businessId, Carbon $from, Carbon $to): array
    {
        return DB::table('branches')
            ->leftJoin('sales', function ($join) use ($from, $to) {
                $join->on('sales.branch_id', '=', 'branches.id')
                    ->whereIn('sales.status', ['completed', 'partially_refunded'])
                    ->whereBetween('sales.created_at', [$from, $to]);
            })
            ->where('branches.business_id', $businessId)
            ->groupBy('branches.id', 'branches.name')
            ->selectRaw('branches.id AS branch_id, branches.name AS branch_name, COALESCE(SUM(sales.total), 0) AS sales, COUNT(sales.id) AS transactions')
            ->get()
            ->map(fn ($row) => [
                'branch_id' => (int) $row->branch_id,
                'branch_name' => $row->branch_name,
                'sales' => (float) $row->sales,
                'transactions' => (int) $row->transactions,
                'trend_percent' => null,
            ])->values()->all();
    }

    private function staffPerformance(int $businessId, ?int $branchId, Carbon $from, Carbon $to, string $currency): array
    {
        return DB::table('sales')
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->where('sales.business_id', $businessId)
            ->whereIn('sales.status', ['completed', 'partially_refunded'])
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('users.id', 'users.name')
            ->selectRaw('users.id AS staff_id, users.name AS staff_name, COALESCE(SUM(sales.total), 0) AS sales, COUNT(*) AS transactions')
            ->orderByDesc('sales')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) $row->staff_id,
                'staff_name' => $row->staff_name,
                'sales' => (float) $row->sales,
                'transactions' => (int) $row->transactions,
                'currency' => $currency,
            ])->values()->all();
    }

    private function latestSales(int $businessId, ?int $branchId): array
    {
        return DB::table('sales')
            ->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')
            ->leftJoin('branches', 'branches.id', '=', 'sales.branch_id')
            ->where('sales.business_id', $businessId)
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->orderByDesc('sales.created_at')
            ->limit(5)
            ->select(
                'sales.id',
                'sales.reference',
                'sales.total',
                'sales.status',
                'sales.payment_status',
                'sales.created_at',
                'customers.name AS customer_name',
                'branches.name AS branch_name',
            )
            ->get()
            ->all();
    }

    private function lowStockQuery(int $businessId, ?int $branchId)
    {
        return DB::table('inventory_balances')
            ->join('products', 'products.id', '=', 'inventory_balances.product_id')
            ->where('inventory_balances.business_id', $businessId)
            ->when($branchId, fn ($q) => $q->where('inventory_balances.branch_id', $branchId))
            ->whereColumn('inventory_balances.quantity', '<=', 'products.low_stock_threshold')
            ->whereNotNull('products.low_stock_threshold')
            ->select(
                'inventory_balances.product_id',
                'products.name AS product_name',
                'inventory_balances.quantity',
                'products.low_stock_threshold',
            );
    }

    private function expiringList(int $businessId, ?int $branchId): array
    {
        return DB::table('stock_batches')
            ->join('products', 'products.id', '=', 'stock_batches.product_id')
            ->where('stock_batches.business_id', $businessId)
            ->when($branchId, fn ($q) => $q->where('stock_batches.branch_id', $branchId))
            ->where('stock_batches.status', 'available')
            ->where('stock_batches.quantity_available', '>', 0)
            ->whereNotNull('stock_batches.expiry_date')
            ->where('stock_batches.expiry_date', '<=', now()->addDays(30)->toDateString())
            ->orderBy('stock_batches.expiry_date')
            ->limit(5)
            ->select(
                'stock_batches.id',
                'stock_batches.product_id',
                'products.name AS product_name',
                'stock_batches.batch_number',
                'stock_batches.expiry_date',
                'stock_batches.quantity_available',
            )
            ->get()
            ->map(function ($row) {
                $row->days_remaining = (int) now()->startOfDay()->diffInDays(Carbon::parse($row->expiry_date)->startOfDay(), false);

                return $row;
            })
            ->all();
    }
}