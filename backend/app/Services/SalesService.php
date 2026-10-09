<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Sale;
use App\Models\SaleApproval;
use App\Models\SaleItem;
use App\Models\SaleStatusHistory;
use App\Support\ReferenceGenerator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class SalesService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly CustomerLedgerService $ledger,
    ) {
    }

    public function index(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Sale::query()->with(['customer', 'branch', 'user']);

        $query
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['payment_status'] ?? null, fn ($q, $v) => $q->where('payment_status', $v))
            ->when($filters['customer_id'] ?? null, fn ($q, $v) => $q->where('customer_id', (int) $v))
            ->when($filters['branch_id'] ?? null, fn ($q, $v) => $q->where('branch_id', (int) $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->when($filters['search'] ?? null, function ($q, $v) {
                $like = '%'.$v.'%';
                $q->where('reference', 'like', $like);
            });

        $paginator = $query->orderByDesc('id')->paginate($perPage);

        $paginator->setCollection(
            collect($paginator->items())->map(fn (Sale $sale) => $this->present($sale)),
        );

        return $paginator;
    }

    public function present(Sale $sale, bool $detailed = false): array
    {
        $sale->loadMissing(['customer', 'branch', 'user']);

        $data = [
            'id' => $sale->id,
            'reference' => $sale->reference,
            'customer_id' => $sale->customer_id,
            'customer_name' => $sale->customer?->name,
            'branch_id' => $sale->branch_id,
            'branch_name' => $sale->branch?->name,
            'sales_rep' => $sale->user?->name ?? 'Staff',
            'status' => $sale->status,
            'payment_status' => $sale->payment_status,
            'subtotal' => (float) $sale->subtotal,
            'discount_total' => (float) $sale->discount_total,
            'tax_total' => (float) $sale->tax_total,
            'total' => (float) $sale->total,
            'paid_amount' => (float) $sale->paid_amount,
            'change_due' => (float) $sale->change_due,
            'currency' => $sale->currency,
            'item_count' => $sale->relationLoaded('items') ? $sale->items->count() : $sale->items()->count(),
            'refunded_total' => $this->refundedTotal($sale),
            'created_at' => $sale->created_at?->toIso8601String(),
        ];

        if ($detailed) {
            $sale->loadMissing(['items', 'payments', 'refunds.items', 'history.user', 'approvals']);

            $data['items'] = $sale->items->map(fn (SaleItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'name' => $item->name,
                'variant_name' => $item->variant_name,
                'sku' => $item->sku,
                'quantity' => (float) $item->quantity,
                'refunded_quantity' => $this->refundedByItem($sale)[$item->id] ?? 0.0,
                'unit_price' => (float) $item->unit_price,
                'cost_price' => (float) $item->cost_price,
                'discount' => (float) $item->discount,
                'tax' => (float) $item->tax,
                'line_total' => (float) $item->line_total,
            ])->values()->all();

            $data['payments'] = $sale->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'reference' => $payment->reference,
                'method' => $payment->method,
                'amount' => (float) $payment->amount,
                'status' => $payment->status,
                'created_at' => $payment->created_at?->toIso8601String(),
            ])->values()->all();

            $data['refunds'] = $sale->refunds->map(fn (Refund $refund) => [
                'id' => $refund->id,
                'reference' => $refund->reference,
                'total' => (float) $refund->total,
                'reason' => $refund->reason,
                'status' => $refund->status,
                'created_at' => $refund->created_at?->toIso8601String(),
                'items' => $refund->items->map(fn (RefundItem $item) => [
                    'sale_item_id' => $item->sale_item_id,
                    'product_id' => $item->product_id,
                    'quantity' => (float) $item->quantity,
                    'amount' => (float) $item->amount,
                ])->values()->all(),
            ])->values()->all();

            $data['history'] = $sale->history->map(fn (SaleStatusHistory $entry) => [
                'from_status' => $entry->from_status,
                'to_status' => $entry->to_status,
                'user' => $entry->user?->name,
                'reason' => $entry->reason,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])->values()->all();
        }

        return $data;
    }

    public function cancel(Sale $sale, ?string $reason, int $userId): Sale
    {
        if (in_array($sale->status, ['cancelled', 'refunded'], true)) {
            throw new ApiException('invalid_state', 'This sale can no longer be cancelled.', 422);
        }

        return DB::transaction(function () use ($sale, $reason, $userId) {
            $from = $sale->status;
            $sale->loadMissing(['items', 'customer.account']);

            if ($from === 'completed') {
                foreach ($sale->items as $item) {
                    if ($item->product_id === null) {
                        continue;
                    }

                    $this->inventory->move(
                        (int) $sale->branch_id,
                        (int) $item->product_id,
                        $item->variant_id,
                        (float) $item->quantity,
                        'return',
                        'Sale cancelled',
                        $sale->reference.'-CANCEL',
                        null,
                        $userId,
                    );
                }

                if ($sale->payment_status === 'credit' && $sale->customer !== null) {
                    $this->ledger->refund(
                        $sale->customer,
                        (float) $sale->total,
                        'Credit sale cancelled '.$sale->reference,
                        (string) $sale->reference,
                        'reversal',
                    );
                }

                if (in_array($sale->payment_status, ['paid', 'credit'], true)) {
                    Refund::create([
                        'business_id' => $sale->business_id,
                        'branch_id' => $sale->branch_id,
                        'sale_id' => $sale->id,
                        'reference' => ReferenceGenerator::make('REF'),
                        'reason' => $reason ?? 'Sale cancelled',
                        'total' => (float) $sale->total,
                        'status' => 'completed',
                        'created_by' => $userId,
                        'approved_by' => $userId,
                    ]);
                }

                $paymentStatus = match ($sale->payment_status) {
                    'paid' => 'refunded',
                    'credit' => 'cancelled',
                    default => $sale->payment_status,
                };

                $sale->forceFill(['status' => 'cancelled', 'payment_status' => $paymentStatus])->save();
            } elseif ($from === 'awaiting_approval') {
                SaleApproval::query()
                    ->where('sale_id', $sale->id)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'rejected',
                        'approver_id' => $userId,
                        'reason' => $reason ?? 'Sale cancelled',
                        'decided_at' => now(),
                    ]);

                $sale->forceFill([
                    'status' => 'cancelled',
                    'payment_status' => 'unpaid',
                    'approval_state' => array_merge((array) $sale->approval_state, ['status' => 'cancelled']),
                ])->save();
            } else {
                $sale->forceFill(['status' => 'cancelled'])->save();
            }

            $this->recordStatus($sale, $from, 'cancelled', $userId, $reason);

            return $sale->fresh(['items', 'customer', 'branch', 'user', 'payments', 'refunds', 'history']);
        });
    }

    /**
     * @param  array<int, array{sale_item_id: int, quantity: float|int}>  $lines
     * @return array{refund: Refund, sale: Sale}
     */
    public function refund(Sale $sale, array $lines, ?string $reason, int $userId): array
    {
        if (! in_array($sale->status, ['completed', 'partially_refunded'], true)) {
            throw new ApiException('invalid_state', 'Only completed sales can be refunded.', 422);
        }

        $sale->loadMissing(['items', 'customer.account']);
        $items = $sale->items->keyBy('id');
        $already = $this->refundedByItem($sale);

        $prepared = [];
        $total = 0.0;

        foreach ($lines as $line) {
            $itemId = (int) ($line['sale_item_id'] ?? 0);
            $quantity = (float) ($line['quantity'] ?? 0);

            if ($quantity <= 0) {
                continue;
            }

            $item = $items->get($itemId);

            if ($item === null) {
                throw new ApiException('validation_error', 'One of the refund lines does not belong to this sale.', 422);
            }

            $refundable = (float) $item->quantity - (float) ($already[$itemId] ?? 0);

            if ($quantity > $refundable + 0.0001) {
                throw new ApiException('validation_error', 'Refund quantity exceeds the refundable amount.', 422);
            }

            $amount = round((float) $item->unit_price * $quantity, 2);
            $prepared[] = ['item' => $item, 'quantity' => $quantity, 'amount' => $amount];
            $total += $amount;
        }

        if ($prepared === []) {
            throw new ApiException('validation_error', 'Provide at least one refund line.', 422);
        }

        $total = round($total, 2);

        return DB::transaction(function () use ($sale, $prepared, $total, $reason, $userId) {
            $refund = Refund::create([
                'business_id' => $sale->business_id,
                'branch_id' => $sale->branch_id,
                'sale_id' => $sale->id,
                'reference' => ReferenceGenerator::make('REF'),
                'reason' => $reason ?? 'Customer refund',
                'total' => $total,
                'status' => 'completed',
                'created_by' => $userId,
                'approved_by' => $userId,
            ]);

            foreach ($prepared as $entry) {
                /** @var SaleItem $item */
                $item = $entry['item'];

                RefundItem::create([
                    'refund_id' => $refund->id,
                    'sale_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'quantity' => $entry['quantity'],
                    'amount' => $entry['amount'],
                ]);

                if ($item->product_id !== null) {
                    $this->inventory->move(
                        (int) $sale->branch_id,
                        (int) $item->product_id,
                        $item->variant_id,
                        (float) $entry['quantity'],
                        'return',
                        'Customer refund',
                        (string) $refund->reference,
                        null,
                        $userId,
                    );
                }
            }

            if ($sale->payment_status === 'credit' && $sale->customer !== null) {
                $this->ledger->refund(
                    $sale->customer,
                    $total,
                    'Refund '.$refund->reference,
                    (string) $refund->reference,
                    'refund',
                );
            }

            $from = $sale->status;
            $fullyRefunded = $this->isFullyRefunded($sale->fresh('items'));

            $sale->forceFill([
                'status' => $fullyRefunded ? 'refunded' : 'partially_refunded',
                'payment_status' => $fullyRefunded ? 'refunded' : $sale->payment_status,
            ])->save();

            $this->recordStatus($sale, $from, $sale->status, $userId, $reason);

            return [
                'refund' => $refund->fresh('items'),
                'sale' => $sale->fresh(['items', 'customer', 'branch', 'user', 'payments', 'refunds', 'history']),
            ];
        });
    }

    private function isFullyRefunded(Sale $sale): bool
    {
        $refunded = $this->refundedByItem($sale);

        foreach ($sale->items as $item) {
            if (($refunded[$item->id] ?? 0.0) + 0.0001 < (float) $item->quantity) {
                return false;
            }
        }

        return $sale->items->isNotEmpty();
    }

    /**
     * @return array<int, float>
     */
    private function refundedByItem(Sale $sale): array
    {
        return RefundItem::query()
            ->whereIn('sale_item_id', $sale->items->pluck('id'))
            ->selectRaw('sale_item_id, SUM(quantity) AS qty')
            ->groupBy('sale_item_id')
            ->pluck('qty', 'sale_item_id')
            ->map(fn ($value) => (float) $value)
            ->all();
    }

    private function refundedTotal(Sale $sale): float
    {
        return round((float) Refund::query()
            ->where('sale_id', $sale->id)
            ->where('status', 'completed')
            ->sum('total'), 2);
    }

    private function recordStatus(Sale $sale, string $from, string $to, int $userId, ?string $reason): void
    {
        SaleStatusHistory::create([
            'sale_id' => $sale->id,
            'from_status' => $from,
            'to_status' => $to,
            'user_id' => $userId,
            'reason' => $reason,
        ]);

        AuditLog::record('sale.'.$to, 'sale', $sale->id, [
            'from' => $from,
            'to' => $to,
            'reference' => $sale->reference,
        ], [], $reason);
    }
}
