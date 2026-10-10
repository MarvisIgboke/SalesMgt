<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\GoodsReceipt;
use App\Models\InventoryBalance;
use App\Models\InventoryTransaction;
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
            ->with(['product', 'variant', 'branch'])
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
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', (int) $request->query('product_id')))
            ->when($request->filled('variant_id'), fn ($q) => $q->where('variant_id', (int) $request->query('variant_id')))
            ->orderByDesc('happened_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (InventoryTransaction $tx) => $this->presentMovement($tx));
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

        return [
            'id' => $balance->id,
            'product_id' => $balance->product_id,
            'variant_id' => $balance->variant_id,
            'product_name' => $balance->product?->name,
            'variant_name' => $balance->variant?->name,
            'sku' => $balance->variant?->sku ?? $balance->product?->sku,
            'branch_id' => $balance->branch_id,
            'branch_name' => $balance->branch?->name,
            'quantity' => $quantity,
            'low_stock_threshold' => $threshold,
            'status' => $status,
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
