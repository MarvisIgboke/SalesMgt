<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\InventoryBalance;
use App\Models\Subscription;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialReportController extends Controller
{
    private const VAT_RATE = 7.5;

    private const SALES_STATUSES = ['completed', 'partially_refunded'];

    public function summary(Request $request)
    {
        abort_unless($request->user()->can('reports.view'), 403);

        $validated = $request->validate([
            'period' => ['nullable', 'in:today,week,month,mtd,custom'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $business = Business::query()->findOrFail(TenantContext::businessId());
        $branchId = isset($validated['branch_id']) ? (int) $validated['branch_id'] : null;

        [$from, $to, $label] = $this->range($validated);

        return ApiResponse::success([
            'business_id' => $business->id,
            'currency' => $business->currency,
            'vat_rate' => self::VAT_RATE,
            'period' => [
                'key' => $validated['period'] ?? 'mtd',
                'label' => $label,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'synced_at' => now()->toIso8601String(),
            'kpis' => $this->kpis($business->id, $branchId, $from, $to),
            'channels' => $this->channels($business->id, $branchId, $from, $to),
            'till' => $this->till($business->id, $branchId, $from, $to),
            'shrinkage' => $this->shrinkage($business->id, $branchId, $from, $to),
            'tax' => $this->tax($business->id, $branchId, $from, $to),
            'plan' => $this->plan(),
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon, 2: string}
     */
    private function range(array $validated): array
    {
        $period = $validated['period'] ?? 'mtd';

        if ($period === 'custom' && ! empty($validated['from']) && ! empty($validated['to'])) {
            $from = Carbon::parse($validated['from'])->startOfDay();
            $to = Carbon::parse($validated['to'])->endOfDay();

            return [$from, $to, $from->format('M j').' – '.$to->format('M j')];
        }

        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay(), 'Today · '.now()->format('M j')],
            'week' => [
                now()->startOfWeek(),
                now()->endOfWeek(),
                'WTD ('.now()->startOfWeek()->format('M j').' – '.now()->endOfWeek()->format('M j').')',
            ],
            'month' => [now()->startOfMonth(), now()->endOfMonth(), now()->format('F Y')],
            default => [
                now()->startOfMonth(),
                now()->endOfDay(),
                'MTD ('.now()->startOfMonth()->format('M j').' – '.now()->format('M j').')',
            ],
        };
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function previous(Carbon $from, Carbon $to): array
    {
        $prevTo = $from->copy()->subDay()->endOfDay();
        $prevFrom = $prevTo->copy()->subDays($from->diffInDays($to))->startOfDay();

        return [$prevFrom, $prevTo];
    }

    private function kpis(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $current = $this->salesTotals($businessId, $branchId, $from, $to);
        [$prevFrom, $prevTo] = $this->previous($from, $to);
        $previous = $this->salesTotals($businessId, $branchId, $prevFrom, $prevTo);

        $cogs = (float) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.business_id', $businessId)
            ->whereIn('sales.status', self::SALES_STATUSES)
            ->when($branchId !== null, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->whereBetween('sales.created_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(sale_items.cost_price * sale_items.quantity), 0) AS cogs')
            ->value('cogs');

        $expenses = (float) DB::table('expenses')
            ->where('business_id', $businessId)
            ->whereIn('status', ['approved', 'paid'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        $revenue = $current['revenue'];
        $grossProfit = $revenue - $cogs;
        $netProfit = $grossProfit - $expenses;

        $momPct = $previous['revenue'] > 0
            ? round((($revenue - $previous['revenue']) / $previous['revenue']) * 100, 1)
            : null;

        return [
            'gross_revenue' => [
                'value' => round($revenue, 2),
                'prev_value' => round($previous['revenue'], 2),
                'mom_pct' => $momPct,
                'orders' => $current['orders'],
                'trend' => $this->revenueTrend($businessId, $branchId, $from, $to),
            ],
            'net_profit' => [
                'value' => round($netProfit, 2),
                'margin_pct' => $revenue > 0 ? round(($netProfit / $revenue) * 100, 1) : 0,
                'gross_profit' => round($grossProfit, 2),
                'expenses' => round($expenses, 2),
            ],
            'cogs' => [
                'value' => round($cogs, 2),
                'pct_of_gmv' => $revenue > 0 ? round(($cogs / $revenue) * 100, 1) : 0,
            ],
            'tax_vat' => [
                'value' => round($current['tax'], 2),
                'rate' => self::VAT_RATE,
                'taxed_orders' => $current['taxed_orders'],
            ],
        ];
    }

    private function salesTotals(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $row = DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('status', self::SALES_STATUSES)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw(
                'COALESCE(SUM(total), 0) AS revenue, '.
                'COALESCE(SUM(tax_total), 0) AS tax, '.
                'COUNT(*) AS orders, '.
                'COALESCE(SUM(CASE WHEN tax_total > 0 THEN 1 ELSE 0 END), 0) AS taxed_orders',
            )
            ->first();

        return [
            'revenue' => (float) ($row->revenue ?? 0),
            'tax' => (float) ($row->tax ?? 0),
            'orders' => (int) ($row->orders ?? 0),
            'taxed_orders' => (int) ($row->taxed_orders ?? 0),
        ];
    }

    private function revenueTrend(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $rows = DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('status', self::SALES_STATUSES)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('day')
            ->selectRaw('DATE(created_at) AS day, COALESCE(SUM(total), 0) AS value')
            ->get()
            ->keyBy('day');

        $trend = [];
        $cursor = $from->copy();
        $guard = 0;

        while ($cursor->lte($to) && $guard < 31) {
            $key = $cursor->toDateString();
            $trend[] = [
                'label' => $cursor->format('j M'),
                'value' => (float) ($rows[$key]->value ?? 0),
            ];
            $cursor->addDay();
            $guard++;
        }

        return $trend;
    }

    private function channels(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $sales = DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('status', self::SALES_STATUSES)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->select('id', 'customer_id', 'total')
            ->get();

        $buckets = [
            'counter' => ['key' => 'counter', 'label' => 'Counter · POS', 'amount' => 0.0, 'orders' => 0],
            'b2b' => ['key' => 'b2b', 'label' => 'B2B · Accounts', 'amount' => 0.0, 'orders' => 0],
            'digital' => ['key' => 'digital', 'label' => 'Card · Transfer', 'amount' => 0.0, 'orders' => 0],
        ];

        if ($sales->isNotEmpty()) {
            $methods = DB::table('payments')
                ->whereIn('sale_id', $sales->pluck('id')->all())
                ->select('sale_id', 'method')
                ->get()
                ->groupBy('sale_id');

            foreach ($sales as $sale) {
                $total = (float) $sale->total;

                if ($sale->customer_id !== null) {
                    $bucket = 'b2b';
                } else {
                    $method = $methods->get($sale->id)?->first()->method ?? 'cash';
                    $bucket = in_array($method, ['cash', 'pos'], true) ? 'counter' : 'digital';
                }

                $buckets[$bucket]['amount'] += $total;
                $buckets[$bucket]['orders']++;
            }
        }

        $grand = array_sum(array_column($buckets, 'amount'));

        return array_values(array_map(function (array $bucket) use ($grand): array {
            $bucket['amount'] = round($bucket['amount'], 2);
            $bucket['pct'] = $grand > 0 ? round(($bucket['amount'] / $grand) * 100, 1) : 0;
            $bucket['aov'] = $bucket['orders'] > 0 ? round($bucket['amount'] / $bucket['orders'], 2) : 0;

            return $bucket;
        }, $buckets));
    }

    private function till(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $shifts = DB::table('shifts')
            ->where('business_id', $businessId)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('opened_at', [$from, $to])
            ->get();

        $expected = (float) $shifts->sum('expected_cash');
        $closed = $shifts->whereNotNull('actual_cash');
        $audited = (float) $closed->sum('actual_cash');
        $variance = $audited - $expected;
        $balanced = $closed
            ->filter(fn ($shift) => abs((float) $shift->variance) < 0.01)
            ->count();

        $cashSales = (float) DB::table('payments')
            ->where('business_id', $businessId)
            ->whereIn('status', ['confirmed', 'completed'])
            ->where('method', 'cash')
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        return [
            'expected' => round($expected, 2),
            'audited' => round($audited, 2),
            'variance' => round($variance, 2),
            'variance_pct' => $expected > 0 ? round(($variance / $expected) * 100, 2) : 0,
            'tills' => $shifts->count(),
            'closed' => $closed->count(),
            'balanced' => $balanced,
            'rate_pct' => $closed->count() > 0 ? round(($balanced / $closed->count()) * 100, 1) : 0,
            'cash_sales' => round($cashSales, 2),
        ];
    }

    private function shrinkage(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $balances = InventoryBalance::query()
            ->with(['product', 'variant'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->get();

        $inventoryValue = $balances->sum(fn (InventoryBalance $balance) => (float) $balance->quantity
            * (float) ($balance->variant?->cost_price ?? $balance->product?->cost_price ?? 0));

        $damage = DB::table('inventory_transactions')
            ->join('products', 'products.id', '=', 'inventory_transactions.product_id')
            ->where('inventory_transactions.business_id', $businessId)
            ->where('inventory_transactions.type', 'damage')
            ->when($branchId !== null, fn ($q) => $q->where('inventory_transactions.branch_id', $branchId))
            ->whereBetween('inventory_transactions.happened_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(inventory_transactions.quantity), 0) AS units, COALESCE(SUM(inventory_transactions.quantity * products.cost_price), 0) AS value')
            ->first();

        $adjustments = DB::table('stock_adjustments')
            ->join('products', 'products.id', '=', 'stock_adjustments.product_id')
            ->where('stock_adjustments.business_id', $businessId)
            ->where('stock_adjustments.status', 'approved')
            ->where('stock_adjustments.quantity', '<', 0)
            ->when($branchId !== null, fn ($q) => $q->where('stock_adjustments.branch_id', $branchId))
            ->whereBetween('stock_adjustments.created_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(stock_adjustments.quantity), 0) AS units, COALESCE(SUM(stock_adjustments.quantity * products.cost_price), 0) AS value')
            ->first();

        $wasteUnits = abs((float) ($damage->units ?? 0) + (float) ($adjustments->units ?? 0));
        $wasteValue = abs((float) ($damage->value ?? 0) + (float) ($adjustments->value ?? 0));

        $expiredValue = (float) DB::table('stock_batches')
            ->where('business_id', $businessId)
            ->where('quantity_available', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<', now()->toDateString())
            ->selectRaw('COALESCE(SUM(quantity_available * cost_price), 0) AS value')
            ->value('value');

        $nearExpiryValue = (float) DB::table('stock_batches')
            ->where('business_id', $businessId)
            ->where('quantity_available', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [now()->toDateString(), now()->addDays(30)->toDateString()])
            ->selectRaw('COALESCE(SUM(quantity_available * cost_price), 0) AS value')
            ->value('value');

        $categories = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('sales.business_id', $businessId)
            ->whereIn('sales.status', self::SALES_STATUSES)
            ->when($branchId !== null, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('categories.id', 'categories.name')
            ->selectRaw("COALESCE(categories.name, 'Uncategorized') AS name, COALESCE(SUM(sale_items.quantity), 0) AS units, COALESCE(SUM(sale_items.line_total), 0) AS value")
            ->orderByDesc('value')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'units' => round((float) $row->units, 2),
                'value' => round((float) $row->value, 2),
            ])
            ->values()
            ->all();

        return [
            'inventory_value' => round($inventoryValue, 2),
            'waste_units' => round($wasteUnits, 2),
            'waste_value' => round($wasteValue, 2),
            'waste_pct' => $inventoryValue > 0 ? round(($wasteValue / $inventoryValue) * 100, 2) : 0,
            'expired_value' => round($expiredValue, 2),
            'near_expiry_value' => round($nearExpiryValue, 2),
            'categories' => $categories,
        ];
    }

    private function tax(int $businessId, ?int $branchId, Carbon $from, Carbon $to): array
    {
        $totals = $this->salesTotals($businessId, $branchId, $from, $to);
        $outputVat = $totals['tax'];

        return [
            'output_vat' => round($outputVat, 2),
            'taxable_base' => round(max(0, $totals['revenue'] - $outputVat), 2),
            'total_remittance' => round($outputVat, 2),
            'rate' => self::VAT_RATE,
            'taxed_orders' => $totals['taxed_orders'],
        ];
    }

    private function plan(): ?array
    {
        $subscription = Subscription::query()->with('plan')->latest('id')->first();

        if ($subscription === null) {
            return null;
        }

        return [
            'plan' => $subscription->plan?->name ?? 'No Plan',
            'status' => $subscription->status ?: 'none',
            'expires_at' => $subscription->expires_at?->toDateString(),
            'features' => array_values($subscription->plan?->features ?? []),
            'limits' => $subscription->limits ?? $subscription->plan?->limits() ?? [],
        ];
    }
}
