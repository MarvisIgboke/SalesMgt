<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function categories(Request $request)
    {
        return ApiResponse::success(
            Category::query()->orderBy('name')->get(['id', 'name'])->all(),
        );
    }

    public function brands(Request $request)
    {
        return ApiResponse::success(
            Brand::query()->orderBy('name')->get(['id', 'name'])->all(),
        );
    }
}