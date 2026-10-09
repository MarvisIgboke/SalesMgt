<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardService $dashboard)
    {
    }

    public function show(Request $request)
    {
        abort_unless($request->user()->can('dashboard.view'), 403);

        $validated = $request->validate([
            'period' => ['nullable', 'in:today,week,month'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $branchId = $validated['branch_id'] ?? TenantContext::branchId();

        return ApiResponse::success(
            $this->dashboard->build($validated['period'] ?? 'today', $branchId),
        );
    }
}