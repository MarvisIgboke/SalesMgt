<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function overview(Request $request)
    {
        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : null;

        $products = Product::query()
            ->orderBy('name')
            ->get(['id', 'name', 'category_id', 'brand_id', 'cost_price', 'selling_price', 'tax_rate', 'requires_expiry', 'is_active']);

        $balances = InventoryBalance::query()
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(quantity) as qty')
            ->pluck('qty', 'product_id');

        $rows = $products->map(fn (Product $product) => [
            'id' => $product->id,
            'name' => $product->name,
            'category_id' => $product->category_id,
            'brand_id' => $product->brand_id,
            'qty' => $balances->has($product->id) ? (float) $balances[$product->id] : null,
            'cost' => (float) $product->cost_price,
            'selling' => (float) $product->selling_price,
            'tax_rate' => $product->tax_rate === null ? null : (float) $product->tax_rate,
            'requires_expiry' => (bool) $product->requires_expiry,
            'is_active' => (bool) $product->is_active,
        ])->all();

        $byCategory = [];
        $byBrand = [];
        foreach ($rows as $row) {
            if ($row['category_id'] !== null) {
                $byCategory[(int) $row['category_id']][] = $row;
            }
            if ($row['brand_id'] !== null) {
                $byBrand[(int) $row['brand_id']][] = $row;
            }
        }

        $categories = Category::query()->orderBy('name')->get(['id', 'name'])->map(function (Category $category) use ($byCategory) {
            $rows = $byCategory[$category->id] ?? [];

            return array_merge([
                'id' => $category->id,
                'name' => $category->name,
            ], $this->aggregate($rows), [
                'products' => array_slice(array_map(fn ($row) => $row['name'], $rows), 0, 6),
            ]);
        })->all();

        $brands = Brand::query()->orderBy('name')->get(['id', 'name'])->map(function (Brand $brand) use ($byBrand) {
            $rows = $byBrand[$brand->id] ?? [];

            return array_merge([
                'id' => $brand->id,
                'name' => $brand->name,
            ], $this->aggregate($rows), [
                'products' => array_slice(array_map(fn ($row) => $row['name'], $rows), 0, 4),
            ]);
        })->all();

        return ApiResponse::success([
            'categories' => $categories,
            'brands' => $brands,
            'metrics' => array_merge($this->aggregate($rows), [
                'category_count' => count($categories),
                'brand_count' => count($brands),
            ]),
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private function aggregate(array $rows): array
    {
        $valuation = 0.0;
        $sumCost = 0.0;
        $sumSelling = 0.0;
        $expiryCount = 0;
        $taxTally = [];

        foreach ($rows as $row) {
            if ($row['qty'] !== null) {
                $valuation += (float) $row['qty'] * (float) $row['cost'];
            }
            $sumCost += (float) $row['cost'];
            $sumSelling += (float) $row['selling'];
            if ($row['requires_expiry']) {
                $expiryCount++;
            }
            if ($row['tax_rate'] !== null) {
                $key = (string) $row['tax_rate'];
                $taxTally[$key] = ($taxTally[$key] ?? 0) + 1;
            }
        }

        arsort($taxTally);

        return [
            'sku_count' => count($rows),
            'valuation' => round($valuation, 2),
            'margin' => $sumSelling > 0 ? round((($sumSelling - $sumCost) / $sumSelling) * 100, 1) : 0.0,
            'expiry_count' => $expiryCount,
            'tax_rate' => $taxTally === [] ? null : (float) array_key_first($taxTally),
        ];
    }

    public function categories(Request $request)
    {
        return ApiResponse::success(
            Category::query()->orderBy('name')->get(['id', 'name'])->all(),
        );
    }

    public function storeCategory(Request $request)
    {
        abort_unless($request->user()->can('products.create') || $request->user()->can('products.edit'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $category = Category::firstOrCreate(
            [
                'business_id' => TenantContext::businessId(),
                'name' => $data['name'],
            ],
            ['business_id' => TenantContext::businessId()]
        );

        return ApiResponse::success(
            ['id' => $category->id, 'name' => $category->name],
            'Category created.'
        );
    }

    public function updateCategory(Request $request, int $category)
    {
        abort_unless($request->user()->can('products.edit'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $category = Category::query()->findOrFail($category);
        $category->update(['name' => $data['name']]);

        return ApiResponse::success(
            ['id' => $category->id, 'name' => $category->name],
            'Category updated.'
        );
    }

    public function destroyCategory(Request $request, int $category)
    {
        abort_unless($request->user()->can('products.delete'), 403);

        $category = Category::query()->findOrFail($category);
        $category->delete();

        return ApiResponse::success(null, 'Category deleted.');
    }

    public function brands(Request $request)
    {
        return ApiResponse::success(
            Brand::query()->orderBy('name')->get(['id', 'name'])->all(),
        );
    }

    public function storeBrand(Request $request)
    {
        abort_unless($request->user()->can('products.create') || $request->user()->can('products.edit'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $brand = Brand::firstOrCreate(
            [
                'business_id' => TenantContext::businessId(),
                'name' => $data['name'],
            ],
            ['business_id' => TenantContext::businessId()]
        );

        return ApiResponse::success(
            ['id' => $brand->id, 'name' => $brand->name],
            'Brand created.'
        );
    }

    public function updateBrand(Request $request, int $brand)
    {
        abort_unless($request->user()->can('products.edit'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $brand = Brand::query()->findOrFail($brand);
        $brand->update(['name' => $data['name']]);

        return ApiResponse::success(
            ['id' => $brand->id, 'name' => $brand->name],
            'Brand updated.'
        );
    }

    public function destroyBrand(Request $request, int $brand)
    {
        abort_unless($request->user()->can('products.delete'), 403);

        $brand = Brand::query()->findOrFail($brand);
        $brand->delete();

        return ApiResponse::success(null, 'Brand deleted.');
    }
}