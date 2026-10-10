<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockBatch;
use App\Models\StockTransfer;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function thresholdFor(int $productId, ?int $variantId): ?float
    {
        $product = Product::query()->select('id', 'low_stock_threshold')->find($productId);

        return $product?->low_stock_threshold === null ? null : (float) $product->low_stock_threshold;
    }

    public function balance(int $branchId, int $productId, ?int $variantId, bool $lock = false): InventoryBalance
    {
        $query = InventoryBalance::query()
            ->where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->where('variant_id', $variantId);

        if ($lock) {
            $query->lockForUpdate();
        }

        $balance = $query->first();

        if ($balance !== null) {
            return $balance;
        }

        InventoryBalance::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => $branchId,
            'product_id' => $productId,
            'variant_id' => $variantId,
            'quantity' => 0,
            'low_stock_threshold' => $this->thresholdFor($productId, $variantId),
        ]);

        return $this->balance($branchId, $productId, $variantId, $lock);
    }

    /**
     * Apply a signed stock movement and record the ledger entry.
     */
    public function move(
        int $branchId,
        int $productId,
        ?int $variantId,
        float $quantity,
        string $type,
        ?string $reason,
        ?string $reference,
        ?int $batchId,
        ?int $userId,
    ): InventoryTransaction {
        return DB::transaction(function () use ($branchId, $productId, $variantId, $quantity, $type, $reason, $reference, $batchId, $userId) {
            $balance = $this->balance($branchId, $productId, $variantId, true);

            if ($quantity < 0 && round((float) $balance->quantity + $quantity, 3) < -0.0001) {
                throw new ApiException('insufficient_stock', 'Insufficient stock for this operation.', 422);
            }

            $balance->quantity = round((float) $balance->quantity + $quantity, 3);
            $balance->save();

            return InventoryTransaction::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $branchId,
                'product_id' => $productId,
                'variant_id' => $variantId,
                'batch_id' => $batchId,
                'type' => $type,
                'quantity' => $quantity,
                'reason' => $reason,
                'reference' => $reference,
                'happened_at' => now(),
                'created_by' => $userId,
            ]);
        });
    }

    /**
     * Receive stock into a (possibly new) batch.
     */
    public function receive(
        int $branchId,
        int $productId,
        ?int $variantId,
        float $quantity,
        float $cost,
        ?string $batchNumber,
        ?Carbon $expiry,
        ?int $supplierId,
        ?string $reference,
        ?int $userId,
    ): StockBatch {
        if ($quantity <= 0) {
            throw new ApiException('validation_error', 'Received quantity must be greater than zero.', 422);
        }

        return DB::transaction(function () use ($branchId, $productId, $variantId, $quantity, $cost, $batchNumber, $expiry, $supplierId, $reference, $userId) {
            $batch = StockBatch::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $branchId,
                'product_id' => $productId,
                'variant_id' => $variantId,
                'supplier_id' => $supplierId,
                'batch_number' => $batchNumber,
                'expiry_date' => $expiry,
                'quantity_received' => $quantity,
                'quantity_available' => $quantity,
                'cost_price' => $cost,
                'status' => 'available',
            ]);

            $this->move($branchId, $productId, $variantId, $quantity, 'in', 'Goods received', $reference, $batch->id, $userId);

            return $batch;
        });
    }

    public function adjust(
        int $branchId,
        int $productId,
        ?int $variantId,
        float $quantity,
        ?string $reason,
        int $userId,
        bool $canApprove,
    ): StockAdjustment {
        if ($quantity === 0.0) {
            throw new ApiException('validation_error', 'Adjustment quantity cannot be zero.', 422);
        }

        return DB::transaction(function () use ($branchId, $productId, $variantId, $quantity, $reason, $userId, $canApprove) {
            $adjustment = StockAdjustment::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $branchId,
                'product_id' => $productId,
                'variant_id' => $variantId,
                'quantity' => $quantity,
                'reason' => $reason,
                'status' => $canApprove ? 'approved' : 'pending',
                'created_by' => $userId,
                'decided_by' => $canApprove ? $userId : null,
                'decided_at' => $canApprove ? now() : null,
            ]);

            if ($canApprove) {
                $this->move($branchId, $productId, $variantId, $quantity, 'adjustment', $reason ?? 'Stock adjustment', null, null, $userId);
            }

            return $adjustment;
        });
    }

    public function decideAdjustment(StockAdjustment $adjustment, string $decision, int $userId, ?string $notes): StockAdjustment
    {
        if ($adjustment->status !== 'pending') {
            throw new ApiException('invalid_state', 'This adjustment has already been decided.', 422);
        }

        if (! in_array($decision, ['approved', 'rejected'], true)) {
            throw new ApiException('validation_error', 'Invalid decision.', 422);
        }

        return DB::transaction(function () use ($adjustment, $decision, $userId, $notes) {
            $adjustment->forceFill([
                'status' => $decision,
                'decided_by' => $userId,
                'decided_at' => now(),
                'reason' => $notes ?? $adjustment->reason,
            ])->save();

            if ($decision === 'approved') {
                $this->move(
                    (int) $adjustment->branch_id,
                    (int) $adjustment->product_id,
                    $adjustment->variant_id === null ? null : (int) $adjustment->variant_id,
                    (float) $adjustment->quantity,
                    'adjustment',
                    $adjustment->reason ?? 'Stock adjustment',
                    'ADJ-'.$adjustment->id,
                    null,
                    $userId,
                );
            }

            return $adjustment;
        });
    }

    /**
     * Create a branch transfer. Completes immediately when the actor may approve.
     *
     * @param  array<int, array{product_id: int, variant_id?: ?int, quantity: float|int}>  $items
     */
    public function transfer(
        int $sourceBranchId,
        int $destinationBranchId,
        array $items,
        ?string $notes,
        int $userId,
        bool $canApprove,
    ): StockTransfer {
        if ($sourceBranchId === $destinationBranchId) {
            throw new ApiException('validation_error', 'Source and destination branches must differ.', 422);
        }

        if ($items === []) {
            throw new ApiException('validation_error', 'A transfer needs at least one item.', 422);
        }

        return DB::transaction(function () use ($sourceBranchId, $destinationBranchId, $items, $notes, $userId, $canApprove) {
            $status = $canApprove ? 'completed' : 'requested';

            $transfer = StockTransfer::create([
                'business_id' => TenantContext::businessId(),
                'source_branch_id' => $sourceBranchId,
                'destination_branch_id' => $destinationBranchId,
                'reference' => 'TRF-'.now()->format('ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'status' => $status,
                'notes' => $notes,
                'created_by' => $userId,
                'processed_at' => $canApprove ? now() : null,
            ]);

            foreach ($items as $item) {
                $variantId = isset($item['variant_id']) && $item['variant_id'] !== null ? (int) $item['variant_id'] : null;
                $quantity = (float) $item['quantity'];

                if ($quantity <= 0) {
                    throw new ApiException('validation_error', 'Transfer quantities must be greater than zero.', 422);
                }

                $transfer->items()->create([
                    'product_id' => (int) $item['product_id'],
                    'variant_id' => $variantId,
                    'quantity' => $quantity,
                ]);

                if ($canApprove) {
                    $available = (float) $this->balance($sourceBranchId, (int) $item['product_id'], $variantId)->quantity;
                    if ($available < $quantity) {
                        throw new ApiException('insufficient_stock', 'Not enough stock at the source branch for one of the items.', 422);
                    }

                    $this->move($sourceBranchId, (int) $item['product_id'], $variantId, -$quantity, 'transfer_out', 'Branch transfer', $transfer->reference, null, $userId);
                    $this->move($destinationBranchId, (int) $item['product_id'], $variantId, $quantity, 'transfer_in', 'Branch transfer', $transfer->reference, null, $userId);
                }
            }

            return $transfer;
        });
    }

    /**
     * Consume stock FEFO (earliest expiry first, expired batches excluded) and
     * return the weighted cost of the units consumed.
     */
    public function consumeFefo(
        int $branchId,
        int $productId,
        ?int $variantId,
        float $quantity,
        string $type,
        ?string $reference,
        ?int $userId,
    ): float {
        if ($quantity <= 0) {
            return 0.0;
        }

        return DB::transaction(function () use ($branchId, $productId, $variantId, $quantity, $type, $reference, $userId) {
            $remaining = $quantity;
            $cost = 0.0;

            $batches = StockBatch::query()
                ->where('branch_id', $branchId)
                ->where('product_id', $productId)
                ->where('variant_id', $variantId)
                ->where('quantity_available', '>', 0)
                ->where(fn ($q) => $q->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', now()->toDateString()))
                ->orderByRaw('expiry_date IS NULL, expiry_date asc')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            foreach ($batches as $batch) {
                if ($remaining <= 0) {
                    break;
                }

                $take = min((float) $batch->quantity_available, $remaining);
                if ($take <= 0) {
                    continue;
                }

                $batch->quantity_available = round((float) $batch->quantity_available - $take, 3);
                if ($batch->quantity_available <= 0) {
                    $batch->status = 'depleted';
                }
                $batch->save();

                $cost += $take * (float) $batch->cost_price;
                $remaining -= $take;
            }

            $this->move($branchId, $productId, $variantId, -$quantity, $type, 'Stock out', $reference, null, $userId);

            return round($cost, 2);
        });
    }
}
