<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Department;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\AuditLog;
use App\Models\Unit;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('products.view') || $request->user()->can('sales.create'), 403);

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : null;

        $products = Product::query()
            ->with(['category', 'brand', 'department', 'unit', 'barcodes', 'variants.barcodes'])
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', $term)
                        ->orWhere('sku', 'like', $term)
                        ->orWhereHas('barcodes', fn ($b) => $b->where('barcode', 'like', $term));
                });
            })
            ->when($request->filled('category'), fn ($q) => $q->whereHas('category', fn ($c) => $c->where('name', $request->string('category'))))
            ->when($request->filled('brand'), fn ($q) => $q->whereHas('brand', fn ($b) => $b->where('name', $request->string('brand'))))
            ->orderByDesc('id')
            ->paginate($perPage);

        $stockTotals = $this->stockTotals($products->pluck('id')->all(), $branchId);

        return ApiResponse::paginator($products, map: fn (Product $product) => array_merge(
            $product->toApi(true),
            $this->stockPayload($product, $stockTotals),
        ));
    }

    public function show(Request $request, int $product)
    {
        abort_unless($request->user()->can('products.view') || $request->user()->can('sales.create'), 403);

        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : null;
        $model = $this->find($product)->load(['category', 'brand', 'department', 'unit', 'barcodes', 'variants.barcodes']);

        return ApiResponse::success(array_merge(
            $model->toApi(true),
            $this->stockPayload($model, $this->stockTotals([$model->id], $branchId)),
        ));
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('products.create'), 403);

        $data = $this->validated($request);

        $product = Product::create([
            'business_id' => TenantContext::businessId(),
            'name' => $data['name'],
            'sku' => $data['sku'] ?? null,
            'category_id' => $this->resolveCategory($data['category'] ?? null),
            'brand_id' => $this->resolveBrand($data['brand'] ?? null),
            'unit_id' => $this->resolveUnit($data['unit'] ?? null),
            'department_id' => $this->resolveDepartment($data['department_id'] ?? null),
            'image_url' => $this->storeImage($request) ?? ($data['image_url'] ?? null),
            'cost_price' => $data['cost_price'] ?? 0,
            'selling_price' => $data['selling_price'] ?? 0,
            'tax_rate' => $data['tax_rate'] ?? 0,
            'requires_expiry' => (bool) ($data['requires_expiry'] ?? false),
            'expiry_date' => $data['expiry_date'] ?? null,
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        $this->syncBarcodes($product, $data['barcodes'] ?? []);

        AuditLog::record('product.created', 'product', $product->id, $product->only(['name', 'sku']));

        return ApiResponse::success($product->load(['category', 'brand', 'department', 'unit', 'barcodes', 'variants'])->toApi(true), 'Product created.');
    }

    public function update(Request $request, int $product)
    {
        abort_unless($request->user()->can('products.edit'), 403);

        $product = $this->find($product);
        $data = $this->validated($request, partial: true);

        $product->fill([
            'name' => $data['name'] ?? $product->name,
            'sku' => $data['sku'] ?? $product->sku,
            'cost_price' => $data['cost_price'] ?? $product->cost_price,
            'selling_price' => $data['selling_price'] ?? $product->selling_price,
            'tax_rate' => $data['tax_rate'] ?? $product->tax_rate,
            'requires_expiry' => $data['requires_expiry'] ?? $product->requires_expiry,
            'expiry_date' => array_key_exists('expiry_date', $data) ? $data['expiry_date'] : $product->expiry_date,
            'is_active' => $data['is_active'] ?? $product->is_active,
        ]);

        if (array_key_exists('category', $data)) {
            $product->category_id = $this->resolveCategory($data['category']);
        }
        if (array_key_exists('brand', $data)) {
            $product->brand_id = $this->resolveBrand($data['brand']);
        }
        if (array_key_exists('unit', $data)) {
            $product->unit_id = $this->resolveUnit($data['unit']);
        }
        if (array_key_exists('department_id', $data)) {
            $product->department_id = $this->resolveDepartment($data['department_id']);
        }

        $image = $this->storeImage($request);
        if ($image !== null) {
            $product->image_url = $image;
        } elseif (array_key_exists('image_url', $data)) {
            $product->image_url = $data['image_url'];
        }

        $product->save();

        if (array_key_exists('barcodes', $data)) {
            $this->syncBarcodes($product, $data['barcodes'] ?? []);
        }

        AuditLog::record('product.updated', 'product', $product->id, $product->only(['name', 'sku']));

        return ApiResponse::success($product->load(['category', 'brand', 'department', 'unit', 'barcodes', 'variants'])->toApi(true), 'Product updated.');
    }

    public function destroy(Request $request, int $product)
    {
        abort_unless($request->user()->can('products.delete'), 403);

        $product = $this->find($product);

        try {
            $product->delete();
            AuditLog::record('product.deleted', 'product', $product->id);
        } catch (QueryException) {
            $product->forceFill(['is_active' => false])->save();
            AuditLog::record('product.deactivated', 'product', $product->id);
        }

        return ApiResponse::success(null, 'Product removed.');
    }

    public function addBarcode(Request $request, int $product)
    {
        abort_unless($request->user()->can('products.edit'), 403);

        $data = $request->validate(['barcode' => ['required', 'string', 'max:64']]);
        $product = $this->find($product);

        $existing = ProductBarcode::query()
            ->where('product_id', '!=', $product->id)
            ->where('barcode', $data['barcode'])
            ->exists();

        if ($existing) {
            throw new ApiException('BARCODE_TAKEN', 'This barcode is already assigned to another product.', 422, [
                'barcode' => ['This barcode is already assigned to another product.'],
            ]);
        }

        $barcode = ProductBarcode::firstOrCreate(
            ['business_id' => TenantContext::businessId(), 'product_id' => $product->id, 'barcode' => $data['barcode']],
        );

        return ApiResponse::success(['id' => $barcode->id, 'barcode' => $barcode->barcode], 'Barcode added.');
    }

    public function removeBarcode(Request $request, int $product, string $barcode)
    {
        abort_unless($request->user()->can('products.edit'), 403);

        $this->find($product);

        ProductBarcode::query()
            ->where('product_id', $product)
            ->where(fn ($q) => $q->where('barcode', $barcode)->orWhere('id', ctype_digit($barcode) ? (int) $barcode : 0))
            ->delete();

        return ApiResponse::success(null, 'Barcode removed.');
    }

    private function find(int $id): Product
    {
        return Product::query()->findOrFail($id);
    }

    /**
     * @param  array<int, int>  $ids
     * @return array<int, object>
     */
    private function stockTotals(array $ids, ?int $branchId): array
    {
        if ($ids === []) {
            return [];
        }

        return InventoryBalance::query()
            ->whereIn('product_id', $ids)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(quantity) as qty')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->product_id => $row])
            ->all();
    }

    /**
     * @param  array<int, object>  $totals
     */
    private function stockPayload(Product $product, array $totals): array
    {
        $threshold = $product->low_stock_threshold === null ? null : (float) $product->low_stock_threshold;

        if (! array_key_exists($product->id, $totals)) {
            return [
                'stock_tracked' => false,
                'stock_qty' => 0,
                'low_stock_threshold' => $threshold,
                'stock_status' => 'untracked',
                'stock_value' => 0,
            ];
        }

        $qty = (float) $totals[$product->id]->qty;
        $status = $qty <= 0
            ? 'out_of_stock'
            : ($threshold !== null && $qty <= $threshold ? 'low' : 'in_stock');

        return [
            'stock_tracked' => true,
            'stock_qty' => round($qty, 3),
            'low_stock_threshold' => $threshold,
            'stock_status' => $status,
            'stock_value' => round($qty * (float) $product->cost_price, 2),
        ];
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:200'],
            'sku' => ['nullable', 'string', 'max:100'],
            'brand' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:120'],
            'unit' => ['nullable', 'string', 'max:60'],
            'department_id' => ['nullable', 'integer'],
            'barcodes' => ['nullable', 'array'],
            'barcodes.*' => ['string', 'max:64'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'requires_expiry' => ['nullable', 'boolean'],
            'expiry_date' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:4096'],
            'image_url' => ['nullable', 'string', 'max:2048'],
        ]);
    }

    private function resolveCategory(?string $name): ?int
    {
        $name = trim((string) $name);

        return $name === '' ? null : Category::firstOrCreate([
            'business_id' => TenantContext::businessId(),
            'name' => $name,
        ])->id;
    }

    private function resolveBrand(?string $name): ?int
    {
        $name = trim((string) $name);

        return $name === '' ? null : Brand::firstOrCreate([
            'business_id' => TenantContext::businessId(),
            'name' => $name,
        ])->id;
    }

    private function resolveUnit(?string $name): ?int
    {
        $name = trim((string) $name);

        if ($name === '') {
            return null;
        }

        return Unit::firstOrCreate(
            ['business_id' => TenantContext::businessId(), 'name' => $name],
            ['code' => Str::lower(Str::substr($name, 0, 3))],
        )->id;
    }

    private function resolveDepartment(mixed $id): ?int
    {
        if ($id === null || $id === '' ) {
            return null;
        }

        $department = Department::query()->find((int) $id);

        if ($department === null) {
            throw new ApiException('DEPARTMENT_INVALID', 'The selected department does not exist.', 422, [
                'department_id' => ['The selected department does not exist.'],
            ]);
        }

        return (int) $department->id;
    }

    private function syncBarcodes(Product $product, array $barcodes): void
    {
        $barcodes = array_values(array_unique(array_filter($barcodes)));

        ProductBarcode::query()
            ->where('product_id', $product->id)
            ->whereNotIn('barcode', $barcodes ?: [''])
            ->delete();

        foreach ($barcodes as $barcode) {
            ProductBarcode::query()->firstOrCreate(
                ['business_id' => TenantContext::businessId(), 'barcode' => $barcode],
                ['product_id' => $product->id],
            );
        }

        $product->load('barcodes');
    }

    private function storeImage(Request $request): ?string
    {
        if (! $request->hasFile('image')) {
            return null;
        }

        $path = $request->file('image')->store('products', 'public');

        return Storage::disk('public')->url($path);
    }
}