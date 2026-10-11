<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\GoodsReceipt;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockBatch;
use App\Models\StockTransfer;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function dashboard(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);

        $query = fn () => InventoryBalance::query()
            ->leftJoin('products', 'products.id', '=', 'inventory_balances.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'inventory_balances.variant_id')
            ->when($branchId !== null, fn ($q) => $q->where('inventory_balances.branch_id', $branchId));

        $effectiveThreshold = 'COALESCE(inventory_balances.low_stock_threshold, products.low_stock_threshold, 0)';

        $totalSku = (clone $query())->count();
        $totalUnits = (float) (clone $query())->sum('inventory_balances.quantity');

        $inventoryValue = (float) (clone $query())
            ->selectRaw('COALESCE(SUM(inventory_balances.quantity * COALESCE(product_variants.cost_price, products.cost_price, 0)), 0) AS value')
            ->value('value');

        $lowStock = (clone $query())
            ->where('inventory_balances.quantity', '>', 0)
            ->whereRaw("inventory_balances.quantity <= {$effectiveThreshold}")
            ->count();

        $outOfStock = (clone $query())
            ->where('inventory_balances.quantity', '<=', 0)
            ->count();

        $damagedBatches = StockBatch::query()
            ->where('status', 'damaged')
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->count();

        $expired = $this->expiredQuery($branchId);

        return ApiResponse::success([
            'total_sku' => $totalSku,
            'total_units' => round($totalUnits, 3),
            'inventory_value' => round($inventoryValue, 2),
            'low_stock_count' => $lowStock,
            'out_of_stock_count' => $outOfStock,
            'damaged_count' => $damagedBatches,
            'expired_count' => $expired->count(),
        ]);
    }

    public function levels(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);
        $effectiveThreshold = 'COALESCE(inventory_balances.low_stock_threshold, products.low_stock_threshold, 0)';

        $query = InventoryBalance::query()
            ->select('inventory_balances.*')
            ->leftJoin('products', 'products.id', '=', 'inventory_balances.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'inventory_balances.variant_id')
            ->with(['product.category', 'product.brand', 'product.unit', 'product.barcodes', 'variant', 'branch'])
            ->when($branchId !== null, fn ($q) => $q->where('inventory_balances.branch_id', $branchId))
            ->when($request->filled('product_id'), fn ($q) => $q->where('inventory_balances.product_id', (int) $request->query('product_id')));

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(fn ($q) => $q->where('products.name', 'like', $term)
                ->orWhere('products.sku', 'like', $term)
                ->orWhere('product_variants.name', 'like', $term)
                ->orWhere('product_variants.sku', 'like', $term));
        }

        match ($request->query('status')) {
            'in_stock' => $query->whereRaw("inventory_balances.quantity > {$effectiveThreshold}"),
            'low' => $query->where('inventory_balances.quantity', '>', 0)->whereRaw("inventory_balances.quantity <= {$effectiveThreshold}"),
            'out_of_stock' => $query->where('inventory_balances.quantity', '<=', 0),
            default => null,
        };

        $paginator = $query->orderBy('products.name')->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (InventoryBalance $balance) => $this->presentLevel($balance));
    }

    public function movements(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);

        $paginator = InventoryTransaction::query()
            ->with(['product', 'variant', 'user'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->query('type')))
            ->when($request->filled('types'), function ($q) use ($request) {
                $types = array_values(array_filter(explode(',', (string) $request->query('types'))));
                if ($types !== []) {
                    $q->whereIn('type', $types);
                }
            })
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', (int) $request->query('product_id')))
            ->when($request->filled('variant_id'), fn ($q) => $q->where('variant_id', (int) $request->query('variant_id')))
            ->orderByDesc('happened_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (InventoryTransaction $tx) => $this->presentMovement($tx));
    }

    public function trace(Request $request, int $product)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);

        $record = Product::query()
            ->with(['category', 'brand', 'unit', 'barcodes'])
            ->findOrFail($product);

        $onHand = (float) InventoryBalance::query()
            ->where('product_id', $record->id)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->sum('quantity');

        $aggregate = InventoryTransaction::query()
            ->where('product_id', $record->id)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->selectRaw("
                COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS intake,
                COALESCE(SUM(CASE WHEN quantity < 0 AND type IN ('out', 'transfer_out') THEN -quantity ELSE 0 END), 0) AS dispensed,
                COALESCE(SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END), 0) AS adjustments,
                COALESCE(SUM(CASE WHEN type = 'damage' THEN -quantity ELSE 0 END), 0) AS damaged,
                COALESCE(SUM(CASE WHEN type = 'expired' THEN -quantity ELSE 0 END), 0) AS expired,
                COUNT(*) AS events,
                MIN(happened_at) AS first_event,
                MAX(happened_at) AS last_event
            ")
            ->first();

        $intake = (float) ($aggregate->intake ?? 0);
        $dispensed = (float) ($aggregate->dispensed ?? 0);

        $activeBatch = StockBatch::query()
            ->where('product_id', $record->id)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->where('quantity_available', '>', 0)
            ->orderByRaw('expiry_date IS NULL, expiry_date asc')
            ->orderBy('id')
            ->first();

        $zones = InventoryBalance::query()
            ->selectRaw('branch_id, SUM(quantity) AS quantity')
            ->where('product_id', $record->id)
            ->groupBy('branch_id')
            ->with('branch:id,name')
            ->get()
            ->map(fn (InventoryBalance $balance) => [
                'branch_id' => $balance->branch_id,
                'branch_name' => $balance->branch?->name,
                'quantity' => (float) $balance->quantity,
            ])
            ->filter(fn (array $zone) => abs($zone['quantity']) > 0.0001)
            ->sortByDesc('quantity')
            ->values()
            ->all();

        $quarantine = (float) StockBatch::query()
            ->where('product_id', $record->id)
            ->whereIn('status', ['damaged', 'expired'])
            ->sum('quantity_available');

        $lastReceipt = GoodsReceipt::query()
            ->with(['supplier:id,name'])
            ->whereHas('items', fn ($q) => $q->where('product_id', $record->id))
            ->orderByDesc('id')
            ->first();

        $unitCost = (float) ($record->cost_price ?? 0);

        return ApiResponse::success([
            'product' => [
                'id' => $record->id,
                'name' => $record->name,
                'sku' => $record->sku ?? '',
                'barcode' => $record->barcodes->first()?->barcode,
                'category' => $record->category?->name,
                'brand' => $record->brand?->name,
                'unit' => $record->unit?->name,
                'image_url' => $record->image_url,
                'requires_expiry' => (bool) $record->requires_expiry,
                'cost_price' => $unitCost,
                'selling_price' => (float) ($record->selling_price ?? 0),
            ],
            'branch' => null,
            'on_hand' => round($onHand, 3),
            'on_hand_value' => round($onHand * $unitCost, 2),
            'threshold' => $record->low_stock_threshold === null ? null : (float) $record->low_stock_threshold,
            'intake' => round($intake, 3),
            'dispensed' => round($dispensed, 3),
            'adjustments' => round((float) ($aggregate->adjustments ?? 0), 3),
            'damaged' => round((float) ($aggregate->damaged ?? 0), 3),
            'expired' => round((float) ($aggregate->expired ?? 0), 3),
            'events' => (int) ($aggregate->events ?? 0),
            'sold_ratio' => $intake > 0 ? round(($dispensed / $intake) * 100, 1) : 0.0,
            'first_event_at' => $aggregate?->first_event !== null ? Carbon::parse($aggregate->first_event)->toIso8601String() : null,
            'last_event_at' => $aggregate?->last_event !== null ? Carbon::parse($aggregate->last_event)->toIso8601String() : null,
            'active_batch' => $activeBatch === null ? null : [
                'batch_number' => $activeBatch->batch_number,
                'expiry_date' => $activeBatch->expiry_date?->toDateString(),
                'quantity_available' => (float) $activeBatch->quantity_available,
                'days_remaining' => $activeBatch->daysRemaining(),
                'expiry_status' => $activeBatch->expiryStatus(),
            ],
            'zones' => $zones,
            'quarantine' => round($quarantine, 3),
            'last_receipt' => $lastReceipt === null ? null : [
                'reference' => $lastReceipt->reference,
                'supplier_name' => $lastReceipt->supplier?->name,
                'created_at' => $lastReceipt->created_at?->toIso8601String(),
            ],
        ]);
    }

    public function adjust(Request $request)
    {
        $this->authorize($request, ['inventory.adjust']);

        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'variant_id' => ['nullable', 'integer'],
            'branch_id' => ['required', 'integer'],
            'quantity' => ['required', 'numeric'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $adjustment = $this->inventory->adjust(
            (int) $data['branch_id'],
            (int) $data['product_id'],
            isset($data['variant_id']) ? (int) $data['variant_id'] : null,
            (float) $data['quantity'],
            $data['reason'] ?? null,
            $request->user()->id,
            $request->user()->can('inventory.approve'),
        );

        AuditLog::record('inventory.adjusted', 'stock_adjustment', $adjustment->id, [
            'product_id' => $adjustment->product_id,
            'quantity' => (float) $adjustment->quantity,
            'status' => $adjustment->status,
        ]);

        $adjustment->load(['product', 'variant']);

        return ApiResponse::success($this->presentAdjustmentMovement($adjustment), $adjustment->status === 'pending'
            ? 'Adjustment submitted for approval.'
            : 'Stock adjusted.');
    }

    public function transfer(Request $request)
    {
        $this->authorize($request, ['inventory.transfer']);

        $data = $request->validate([
            'source_branch_id' => ['required', 'integer'],
            'destination_branch_id' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $transfer = $this->inventory->transfer(
            (int) $data['source_branch_id'],
            (int) $data['destination_branch_id'],
            $data['items'],
            $data['notes'] ?? null,
            $request->user()->id,
            $request->user()->can('inventory.approve'),
        );

        AuditLog::record('inventory.transferred', 'stock_transfer', $transfer->id, [
            'reference' => $transfer->reference,
            'status' => $transfer->status,
        ]);

        return ApiResponse::success([
            'id' => $transfer->id,
            'reference' => $transfer->reference,
            'status' => $transfer->status,
        ], 'Transfer recorded.');
    }

    public function transfers(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $paginator = StockTransfer::query()
            ->with(['sourceBranch', 'destinationBranch'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (StockTransfer $transfer) => [
            'id' => $transfer->id,
            'reference' => $transfer->reference,
            'source_branch' => $transfer->sourceBranch?->name,
            'destination_branch' => $transfer->destinationBranch?->name,
            'status' => $transfer->status,
            'notes' => $transfer->notes,
            'processed_at' => $transfer->processed_at?->toIso8601String(),
            'created_at' => $transfer->created_at?->toIso8601String(),
        ]);
    }

    public function goodsReceived(Request $request)
    {
        $this->authorize($request, ['inventory.receive']);

        $data = $request->validate([
            'purchase_order_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'branch_id' => ['required', 'integer'],
            'reference' => ['nullable', 'string', 'max:60'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.batch_number' => ['nullable', 'string', 'max:100'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $receipt = DB::transaction(function () use ($data, $request) {
            $receipt = GoodsReceipt::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => (int) $data['branch_id'],
                'reference' => $data['reference'] ?? 'GRN-'.now()->format('ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'supplier_id' => $data['supplier_id'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                $variantId = isset($item['variant_id']) ? (int) $item['variant_id'] : null;
                $expiry = isset($item['expiry_date']) && $item['expiry_date'] !== null ? Carbon::parse($item['expiry_date']) : null;

                $receipt->items()->create([
                    'product_id' => (int) $item['product_id'],
                    'variant_id' => $variantId,
                    'quantity' => (float) $item['quantity'],
                    'cost_price' => (float) ($item['cost_price'] ?? 0),
                    'batch_number' => $item['batch_number'] ?? null,
                    'expiry_date' => $expiry,
                ]);

                $this->inventory->receive(
                    (int) $data['branch_id'],
                    (int) $item['product_id'],
                    $variantId,
                    (float) $item['quantity'],
                    (float) ($item['cost_price'] ?? 0),
                    $item['batch_number'] ?? null,
                    $expiry,
                    isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
                    $receipt->reference,
                    $request->user()->id,
                );
            }

            return $receipt;
        });

        AuditLog::record('inventory.goods_received', 'goods_receipt', $receipt->id, ['reference' => $receipt->reference]);

        return ApiResponse::success(['id' => $receipt->id, 'reference' => $receipt->reference], 'Goods received.');
    }

    public function goodsReceivedList(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $paginator = GoodsReceipt::query()
            ->with(['branch', 'supplier'])
            ->withCount('items')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (GoodsReceipt $receipt) => [
            'id' => $receipt->id,
            'reference' => $receipt->reference,
            'branch_name' => $receipt->branch?->name,
            'supplier_name' => $receipt->supplier?->name,
            'items_count' => $receipt->items_count,
            'notes' => $receipt->notes,
            'created_at' => $receipt->created_at?->toIso8601String(),
        ]);
    }

    public function damaged(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);

        $paginator = InventoryTransaction::query()
            ->with(['product', 'variant', 'user'])
            ->where('type', 'damage')
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->orderByDesc('happened_at')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (InventoryTransaction $tx) => $this->presentMovement($tx));
    }

    public function expired(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);

        $paginator = $this->expiredQuery($branchId)
            ->with(['product', 'variant', 'branch'])
            ->orderBy('expiry_date')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (StockBatch $batch) => [
            'id' => $batch->id,
            'product_name' => $batch->product?->name,
            'variant_name' => $batch->variant?->name,
            'sku' => $batch->variant?->sku ?? $batch->product?->sku,
            'branch_name' => $batch->branch?->name,
            'quantity' => (float) $batch->quantity_available,
            'expires_at' => $batch->expiry_date?->toDateString(),
            'status' => 'expired',
        ]);
    }

    public function batches(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $this->branchId($request);
        $today = now()->startOfDay();

        $scoped = fn () => StockBatch::query()
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));

        $summary = [
            'expired' => ['count' => 0, 'quantity' => 0.0, 'value' => 0.0],
            'critical' => ['count' => 0, 'quantity' => 0.0, 'value' => 0.0],
            'near' => ['count' => 0, 'quantity' => 0.0, 'value' => 0.0],
            'at_risk' => ['count' => 0, 'quantity' => 0.0, 'value' => 0.0],
            'stable' => ['count' => 0, 'quantity' => 0.0, 'value' => 0.0],
        ];
        $totalQuantity = 0.0;
        $totalValue = 0.0;

        $scoped()
            ->whereNotNull('expiry_date')
            ->where('quantity_available', '>', 0)
            ->select('id', 'quantity_available', 'cost_price', 'expiry_date')
            ->chunkById(500, function ($chunk) use (&$summary, &$totalQuantity, &$totalValue, $today) {
                foreach ($chunk as $batch) {
                    $days = $today->diffInDays($batch->expiry_date->startOfDay(), false);
                    $bucket = match (true) {
                        $days < 0 => 'expired',
                        $days <= 7 => 'critical',
                        $days <= 30 => 'near',
                        $days <= 90 => 'at_risk',
                        default => 'stable',
                    };
                    $quantity = (float) $batch->quantity_available;
                    $value = $quantity * (float) $batch->cost_price;
                    $summary[$bucket]['count']++;
                    $summary[$bucket]['quantity'] += $quantity;
                    $summary[$bucket]['value'] += $value;
                    $totalQuantity += $quantity;
                    $totalValue += $value;
                }
            });

        foreach ($summary as $key => $bucket) {
            $summary[$key]['quantity'] = round($bucket['quantity'], 3);
            $summary[$key]['value'] = round($bucket['value'], 2);
        }

        $summary['all'] = [
            'count' => array_sum(array_column($summary, 'count')),
            'quantity' => round($totalQuantity, 3),
            'value' => round($totalValue, 2),
        ];

        $query = StockBatch::query()
            ->with(['product:id,name,sku', 'product.barcodes', 'variant:id,name,sku', 'branch:id,name', 'supplier:id,name'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('expiry_date')
            ->where('quantity_available', '>', 0)
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('batch_number', 'like', $term)
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', $term)->orWhere('sku', 'like', $term)));
            });

        match ($request->query('bucket')) {
            'expired' => $query->whereDate('expiry_date', '<', $today),
            'critical' => $query->whereDate('expiry_date', '>=', $today)->whereDate('expiry_date', '<=', $today->copy()->addDays(7)),
            'near' => $query->whereDate('expiry_date', '>', $today->copy()->addDays(7))->whereDate('expiry_date', '<=', $today->copy()->addDays(30)),
            'at_risk' => $query->whereDate('expiry_date', '>', $today->copy()->addDays(30))->whereDate('expiry_date', '<=', $today->copy()->addDays(90)),
            'stable' => $query->whereDate('expiry_date', '>', $today->copy()->addDays(90)),
            default => null,
        };

        $paginator = $query->orderBy('expiry_date')->orderBy('id')->paginate($this->perPage($request));

        return ApiResponse::paginator(
            $paginator,
            map: fn (StockBatch $batch) => $this->presentBatch($batch),
            extra: ['summary' => $summary],
        );
    }

    public function approvals(Request $request)
    {
        $this->authorize($request, ['inventory.approve', 'inventory.view']);

        $paginator = StockAdjustment::query()
            ->with(['product', 'variant', 'branch'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')), fn ($q) => $q->where('status', 'pending'))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (StockAdjustment $adjustment) => $this->presentAdjustment($adjustment));
    }

    public function approve(Request $request, int $adjustment)
    {
        $this->authorize($request, ['inventory.approve']);

        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $record = StockAdjustment::query()->findOrFail($adjustment);

        $record = $this->inventory->decideAdjustment($record, $data['decision'], $request->user()->id, $data['notes'] ?? null);

        AuditLog::record('inventory.adjustment_decision', 'stock_adjustment', $record->id, ['status' => $record->status]);

        return ApiResponse::success($this->presentAdjustment($record->fresh(['product', 'variant', 'branch'])), 'Decision recorded.');
    }

    private function expiredQuery(?int $branchId)
    {
        return StockBatch::query()
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString())
            ->where('quantity_available', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));
    }

    private function presentLevel(InventoryBalance $balance): array
    {
        $quantity = (float) $balance->quantity;
        $threshold = $balance->low_stock_threshold === null ? null : (float) $balance->low_stock_threshold;

        $status = match (true) {
            $quantity <= 0 => 'out_of_stock',
            $threshold !== null && $quantity <= $threshold => 'low',
            default => 'in_stock',
        };

        $product = $balance->product;
        $variant = $balance->variant;
        $unitCost = (float) ($variant?->cost_price ?? $product?->cost_price ?? 0);
        $unitPrice = (float) ($variant?->selling_price ?? $product?->selling_price ?? 0);

        return [
            'id' => $balance->id,
            'product_id' => $balance->product_id,
            'variant_id' => $balance->variant_id,
            'product_name' => $product?->name,
            'variant_name' => $variant?->name,
            'sku' => $variant?->sku ?? $product?->sku,
            'branch_id' => $balance->branch_id,
            'branch_name' => $balance->branch?->name,
            'quantity' => $quantity,
            'low_stock_threshold' => $threshold,
            'status' => $status,
            'barcode' => $product?->barcodes?->first()?->barcode,
            'category' => $product?->category?->name,
            'brand' => $product?->brand?->name,
            'unit' => $product?->unit?->name,
            'image_url' => $product?->image_url,
            'requires_expiry' => (bool) ($product?->requires_expiry ?? false),
            'cost_price' => $unitCost,
            'selling_price' => $unitPrice,
            'valuation' => round($quantity * $unitCost, 2),
        ];
    }

    private function presentMovement(InventoryTransaction $tx): array
    {
        return [
            'id' => $tx->id,
            'product_id' => $tx->product_id,
            'variant_id' => $tx->variant_id,
            'product_name' => $tx->product?->name,
            'variant_name' => $tx->variant?->name,
            'type' => $tx->type,
            'quantity' => (float) $tx->quantity,
            'direction' => (float) $tx->quantity < 0 ? 'out' : 'in',
            'reason' => $tx->reason,
            'reference' => $tx->reference,
            'staff_name' => $tx->user?->name,
            'happened_at' => $tx->happened_at?->toIso8601String(),
        ];
    }

    private function presentBatch(StockBatch $batch): array
    {
        $days = $batch->daysRemaining();
        $bucket = match (true) {
            $days === null => 'stable',
            $days < 0 => 'expired',
            $days <= 7 => 'critical',
            $days <= 30 => 'near',
            $days <= 90 => 'at_risk',
            default => 'stable',
        };

        return [
            'id' => $batch->id,
            'product_id' => $batch->product_id,
            'product_name' => $batch->product?->name,
            'variant_name' => $batch->variant?->name,
            'sku' => $batch->variant?->sku ?? $batch->product?->sku,
            'barcode' => $batch->product?->barcodes?->first()?->barcode,
            'batch_number' => $batch->batch_number,
            'branch_id' => $batch->branch_id,
            'branch_name' => $batch->branch?->name,
            'supplier_name' => $batch->supplier?->name,
            'quantity_available' => (float) $batch->quantity_available,
            'quantity_received' => (float) $batch->quantity_received,
            'cost_price' => (float) $batch->cost_price,
            'value' => round((float) $batch->quantity_available * (float) $batch->cost_price, 2),
            'expiry_date' => $batch->expiry_date?->toDateString(),
            'manufacturing_date' => $batch->manufacturing_date?->toDateString(),
            'days_remaining' => $days,
            'expiry_status' => $batch->expiryStatus(),
            'bucket' => $bucket,
        ];
    }

    private function presentAdjustmentMovement(StockAdjustment $adjustment): array
    {
        return [
            'id' => $adjustment->id,
            'product_name' => $adjustment->product?->name,
            'variant_name' => $adjustment->variant?->name,
            'type' => 'adjustment',
            'quantity' => (float) $adjustment->quantity,
            'reason' => $adjustment->reason,
            'reference' => 'ADJ-'.$adjustment->id,
            'happened_at' => $adjustment->created_at?->toIso8601String(),
        ];
    }

    private function presentAdjustment(StockAdjustment $adjustment): array
    {
        return [
            'id' => $adjustment->id,
            'product_id' => $adjustment->product_id,
            'product_name' => $adjustment->product?->name,
            'variant_name' => $adjustment->variant?->name,
            'branch_id' => $adjustment->branch_id,
            'branch_name' => $adjustment->branch?->name,
            'quantity' => (float) $adjustment->quantity,
            'reason' => $adjustment->reason,
            'status' => $adjustment->status,
            'created_at' => $adjustment->created_at?->toIso8601String(),
        ];
    }

    private function branchId(Request $request): ?int
    {
        if ($request->filled('branch_id')) {
            return (int) $request->query('branch_id');
        }

        return TenantContext::branchId();
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
