<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
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