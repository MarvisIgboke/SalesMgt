<?php

namespace App\Services;

use App\Models\CustomerAccount;
use App\Models\Expense;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shift;
use App\Models\StockBatch;
use App\Models\StockTransfer;
use App\Models\SupplierAccount;
use App\Models\SupplierInvoice;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;

class ReportService
{
    public function build(array $params): array
    {
        $type = (string) ($params['report_type'] ?? 'sales');
        $from = ! empty($params['from']) ? Carbon::parse($params['from'])->startOfDay() : now()->subDays(30)->startOfDay();
        $to = ! empty($params['to']) ? Carbon::parse($params['to'])->endOfDay() : now()->endOfDay();
        $branchId = ! empty($params['branch_id']) ? (int) $params['branch_id'] : null;
        $groupBy = (string) ($params['group_by'] ?? '');

        $dataset = match ($type) {
            'sales' => $this->sales($from, $to, $branchId),
            'revenue' => $this->revenue($from, $to, $branchId, $groupBy),
            'profit' => $this->profit($from, $to, $branchId),
            'cash-variance' => $this->cashVariance($from, $to, $branchId),
            'reconciliation' => $this->reconciliation($from, $to, $branchId),
            'inventory-valuation' => $this->inventoryValuation($branchId),
            'inventory-movement' => $this->inventoryMovement($from, $to, $branchId),
            'low-stock' => $this->lowStock($branchId),
            'expired' => $this->expiry($branchId, 'expired'),
            'expiring' => $this->expiry($branchId, 'expiring'),
            'damaged' => $this->damaged($branchId),
            'transfers' => $this->transfers($from, $to),
            'expenses' => $this->expenses($from, $to, $branchId),
            'receivables' => $this->receivables(),
            'payables' => $this->payables(),
            default => $this->empty($type),
        };

        return [
            'report_type' => $type,
            'title' => $this->title($type),
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => $dataset['summary'],
            'rows' => $dataset['rows'],
            'columns' => $dataset['columns'],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function sales(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $rows = $this->salesQuery($from, $to, $branchId)
            ->orderByDesc('id')
            ->limit(1000)
            ->get()
            ->map(fn (Sale $sale) => [
                'reference' => $sale->reference,
                'date' => $sale->created_at?->toIso8601String(),
                'customer' => $sale->customer?->name ?? 'Walk-in',
                'branch' => $sale->branch?->name,
                'total' => round((float) $sale->total, 2),
                'payment_status' => $sale->payment_status,
            ])->all();

        $total = array_sum(array_column($rows, 'total'));
        $count = count($rows);

        return [
            'summary' => [
                'total_sales' => round($total, 2),
                'transactions' => $count,
                'average_sale' => $count > 0 ? round($total / $count, 2) : 0,
            ],
            'rows' => $rows,
            'columns' => ['reference', 'date', 'customer', 'branch', 'total', 'payment_status'],
        ];
    }

    private function revenue(Carbon $from, Carbon $to, ?int $branchId, string $groupBy): array
    {
        $group = $groupBy !== '' ? $groupBy : 'day';

        $sales = $this->salesQuery($from, $to, $branchId)->get();

        $grouped = $sales->groupBy(fn (Sale $sale) => $this->periodKey($sale->created_at, $group));

        $rows = $grouped->map(fn ($items, $key) => [
            'period' => $key,
            'transactions' => $items->count(),
            'total' => round((float) $items->sum('total'), 2),
        ])->sortKeys()->values()->all();

        return [
            'summary' => [
                'total_revenue' => round((float) $sales->sum('total'), 2),
                'transactions' => $sales->count(),
                'group_by' => $group,
            ],
            'rows' => $rows,
            'columns' => ['period', 'transactions', 'total'],
        ];
    }

    private function profit(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $items = SaleItem::query()
            ->whereHas('sale', fn ($q) => $q->where('status', 'completed')
                ->whereBetween('created_at', [$from, $to])
                ->when($branchId !== null, fn ($x) => $x->where('branch_id', $branchId)))
            ->get();

        $grouped = $items->groupBy(fn (SaleItem $item) => $item->name);

        $rows = [];
        $totalRevenue = 0.0;
        $totalCost = 0.0;

        foreach ($grouped as $name => $group) {
            $revenue = (float) $group->sum(fn (SaleItem $item) => (float) $item->unit_price * (float) $item->quantity);
            $cost = (float) $group->sum(fn (SaleItem $item) => (float) $item->cost_price * (float) $item->quantity);
            $discount = (float) $group->sum('discount');
            $profit = $revenue - $discount - $cost;

            $totalRevenue += $revenue;
            $totalCost += $cost;

            $rows[] = [
                'product' => $name,
                'sku' => $group->first()->sku,
                'quantity' => round((float) $group->sum('quantity'), 3),
                'revenue' => round($revenue, 2),
                'cost' => round($cost, 2),
                'profit' => round($profit, 2),
            ];
        }

        $totalProfit = $totalRevenue - $totalCost;

        return [
            'summary' => [
                'total_revenue' => round($totalRevenue, 2),
                'total_cost' => round($totalCost, 2),
                'total_profit' => round($totalProfit, 2),
                'margin' => $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 1) : 0,
            ],
            'rows' => $rows,
            'columns' => ['product', 'sku', 'quantity', 'revenue', 'cost', 'profit'],
        ];
    }

    private function cashVariance(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $shifts = Shift::query()
            ->with(['branch', 'user'])
            ->whereBetween('opened_at', [$from, $to])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('id')
            ->get();

        $rows = $shifts->map(fn (Shift $shift) => [
            'shift' => '#'.$shift->id,
            'staff' => $shift->user?->name,
            'branch' => $shift->branch?->name,
            'opening_cash' => round((float) $shift->opening_cash, 2),
            'expected_cash' => round((float) $shift->expected_cash, 2),
            'actual_cash' => $shift->actual_cash === null ? null : round((float) $shift->actual_cash, 2),
            'variance' => $shift->variance === null ? null : round((float) $shift->variance, 2),
        ])->all();

        $variance = (float) $shifts->sum(fn (Shift $shift) => (float) ($shift->variance ?? 0));

        return [
            'summary' => [
                'shifts' => $shifts->count(),
                'total_variance' => round($variance, 2),
            ],
            'rows' => $rows,
            'columns' => ['shift', 'staff', 'branch', 'opening_cash', 'expected_cash', 'actual_cash', 'variance'],
        ];
    }

    private function reconciliation(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $payments = Payment::query()
            ->with('sale')
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('id')
            ->limit(1000)
            ->get();

        $rows = $payments->map(fn (Payment $payment) => [
            'reference' => $payment->reference,
            'date' => $payment->created_at?->toIso8601String(),
            'method' => $payment->method,
            'sale' => $payment->sale?->reference,
            'amount' => round((float) $payment->amount, 2),
            'status' => $payment->status,
        ])->all();

        return [
            'summary' => [
                'total' => round((float) $payments->sum('amount'), 2),
                'count' => $payments->count(),
            ],
            'rows' => $rows,
            'columns' => ['reference', 'date', 'method', 'sale', 'amount', 'status'],
        ];
    }

    private function inventoryValuation(?int $branchId): array
    {
        $balances = InventoryBalance::query()
            ->with(['product', 'variant'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->get();

        $rows = [];
        $totalValue = 0.0;

        foreach ($balances as $balance) {
            $cost = (float) ($balance->variant?->cost_price ?? $balance->product?->cost_price ?? 0);
            $quantity = (float) $balance->quantity;
            $value = $quantity * $cost;
            $totalValue += $value;

            $rows[] = [
                'product' => $balance->product?->name,
                'sku' => $balance->variant?->sku ?? $balance->product?->sku,
                'quantity' => round($quantity, 3),
                'unit_cost' => round($cost, 2),
                'value' => round($value, 2),
            ];
        }

        return [
            'summary' => [
                'total_value' => round($totalValue, 2),
                'lines' => count($rows),
            ],
            'rows' => $rows,
            'columns' => ['product', 'sku', 'quantity', 'unit_cost', 'value'],
        ];
    }

    private function inventoryMovement(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $transactions = InventoryTransaction::query()
            ->with(['product', 'variant'])
            ->whereBetween('happened_at', [$from, $to])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('happened_at')
            ->limit(1000)
            ->get();

        $rows = $transactions->map(fn (InventoryTransaction $tx) => [
            'date' => $tx->happened_at?->toIso8601String(),
            'product' => $tx->product?->name,
            'type' => $tx->type,
            'quantity' => round((float) $tx->quantity, 3),
            'reference' => $tx->reference,
            'reason' => $tx->reason,
        ])->all();

        return [
            'summary' => [
                'movements' => $transactions->count(),
                'units_moved' => round((float) $transactions->sum('quantity'), 3),
            ],
            'rows' => $rows,
            'columns' => ['date', 'product', 'type', 'quantity', 'reference', 'reason'],
        ];
    }

    private function lowStock(?int $branchId): array
    {
        $balances = InventoryBalance::query()
            ->with(['product'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->get()
            ->filter(function (InventoryBalance $balance) {
                $threshold = $balance->low_stock_threshold ?? $balance->product?->low_stock_threshold;

                return $threshold !== null && (float) $balance->quantity <= (float) $threshold;
            });

        $rows = $balances->map(fn (InventoryBalance $balance) => [
            'product' => $balance->product?->name,
            'sku' => $balance->product?->sku,
            'quantity' => round((float) $balance->quantity, 3),
            'threshold' => round((float) ($balance->low_stock_threshold ?? $balance->product?->low_stock_threshold ?? 0), 3),
        ])->values()->all();

        return [
            'summary' => ['low_stock_items' => count($rows)],
            'rows' => $rows,
            'columns' => ['product', 'sku', 'quantity', 'threshold'],
        ];
    }

    private function expiry(?int $branchId, string $mode): array
    {
        $query = StockBatch::query()
            ->with(['product', 'variant', 'branch'])
            ->whereNotNull('expiry_date')
            ->where('quantity_available', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));

        if ($mode === 'expired') {
            $query->whereDate('expiry_date', '<', now()->toDateString());
        } else {
            $query->whereDate('expiry_date', '>=', now()->toDateString())
                ->whereDate('expiry_date', '<=', now()->addDays(30)->toDateString());
        }

        $batches = $query->orderBy('expiry_date')->get();

        $rows = $batches->map(fn (StockBatch $batch) => [
            'product' => $batch->product?->name,
            'sku' => $batch->variant?->sku ?? $batch->product?->sku,
            'batch_number' => $batch->batch_number,
            'branch' => $batch->branch?->name,
            'quantity' => round((float) $batch->quantity_available, 3),
            'expiry_date' => $batch->expiry_date?->toDateString(),
            'days_remaining' => $batch->daysRemaining(),
        ])->all();

        return [
            'summary' => [
                'batches' => $batches->count(),
                'units' => round((float) $batches->sum('quantity_available'), 3),
            ],
            'rows' => $rows,
            'columns' => ['product', 'sku', 'batch_number', 'branch', 'quantity', 'expiry_date', 'days_remaining'],
        ];
    }

    private function damaged(?int $branchId): array
    {
        $transactions = InventoryTransaction::query()
            ->with(['product', 'variant'])
            ->where('type', 'damage')
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('happened_at')
            ->get();

        $rows = $transactions->map(fn (InventoryTransaction $tx) => [
            'date' => $tx->happened_at?->toIso8601String(),
            'product' => $tx->product?->name,
            'quantity' => round((float) $tx->quantity, 3),
            'reason' => $tx->reason,
            'reference' => $tx->reference,
        ])->all();

        return [
            'summary' => ['damaged_entries' => count($rows)],
            'rows' => $rows,
            'columns' => ['date', 'product', 'quantity', 'reason', 'reference'],
        ];
    }

    private function transfers(Carbon $from, Carbon $to): array
    {
        $transfers = StockTransfer::query()
            ->with(['sourceBranch', 'destinationBranch'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('id')
            ->get();

        $rows = $transfers->map(fn (StockTransfer $transfer) => [
            'reference' => $transfer->reference,
            'source' => $transfer->sourceBranch?->name,
            'destination' => $transfer->destinationBranch?->name,
            'status' => $transfer->status,
            'created_at' => $transfer->created_at?->toIso8601String(),
        ])->all();

        return [
            'summary' => ['transfers' => $transfers->count()],
            'rows' => $rows,
            'columns' => ['reference', 'source', 'destination', 'status', 'created_at'],
        ];
    }

    private function expenses(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $expenses = Expense::query()
            ->with(['category', 'branch'])
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('id')
            ->get();

        $rows = $expenses->map(fn (Expense $expense) => [
            'reference' => $expense->reference,
            'date' => $expense->expense_date?->toDateString() ?? $expense->created_at?->toIso8601String(),
            'category' => $expense->category?->name,
            'description' => $expense->description,
            'amount' => round((float) $expense->amount, 2),
            'status' => $expense->status,
        ])->all();

        return [
            'summary' => [
                'total_expenses' => round((float) $expenses->sum('amount'), 2),
                'entries' => $expenses->count(),
            ],
            'rows' => $rows,
            'columns' => ['reference', 'date', 'category', 'description', 'amount', 'status'],
        ];
    }

    private function receivables(): array
    {
        $accounts = CustomerAccount::query()->with('customer')->get();

        $rows = $accounts->map(fn (CustomerAccount $account) => [
            'customer' => $account->customer?->name,
            'balance' => round((float) $account->balance, 2),
        ])->all();

        $outstanding = (float) $accounts->where('balance', '>', 0)->sum('balance');

        return [
            'summary' => [
                'customers' => $accounts->count(),
                'outstanding' => round($outstanding, 2),
            ],
            'rows' => $rows,
            'columns' => ['customer', 'balance'],
        ];
    }

    private function payables(): array
    {
        $accounts = SupplierAccount::query()->with('supplier')->get();

        $rows = $accounts->map(fn (SupplierAccount $account) => [
            'supplier' => $account->supplier?->name,
            'balance' => round((float) $account->balance, 2),
        ])->all();

        $outstanding = (float) $accounts->where('balance', '>', 0)->sum('balance');

        return [
            'summary' => [
                'suppliers' => $accounts->count(),
                'outstanding' => round($outstanding, 2),
            ],
            'rows' => $rows,
            'columns' => ['supplier', 'balance'],
        ];
    }

    private function empty(string $type): array
    {
        return [
            'summary' => [],
            'rows' => [],
            'columns' => [],
        ];
    }

    private function salesQuery(Carbon $from, Carbon $to, ?int $branchId)
    {
        return Sale::query()
            ->with(['customer', 'branch', 'user'])
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));
    }

    private function periodKey(?Carbon $date, string $group): string
    {
        $date = $date ?? now();

        return match ($group) {
            'week' => $date->copy()->startOfWeek()->toDateString().' – '.$date->copy()->endOfWeek()->toDateString(),
            'month' => $date->format('Y-m'),
            'quarter' => $date->format('Y').'-Q'.$date->quarter,
            default => $date->toDateString(),
        };
    }

    private function title(string $type): string
    {
        return collect(explode('-', $type))
            ->map(fn ($word) => ucfirst($word))
            ->implode(' ');
    }
}
