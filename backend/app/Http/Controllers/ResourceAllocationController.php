<?php

namespace App\Http\Controllers;

use App\Services\AllocationService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class ResourceAllocationController extends Controller
{
    public function __construct(private readonly AllocationService $allocations)
    {
    }

    public function show(Request $request)
    {
        $this->authorizeManage($request);

        return ApiResponse::success($this->allocations->summary($this->businessId($request)));
    }

    public function update(Request $request)
    {
        $this->authorizeManage($request);

        $businessId = $this->businessId($request);

        $data = $request->validate([
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['integer'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer'],
        ]);

        $this->allocations->sync($businessId, $data['branch_ids'] ?? [], $data['user_ids'] ?? []);

        return ApiResponse::success(
            $this->allocations->summary($businessId),
            'Resource allocation updated.',
        );
    }

    private function authorizeManage(Request $request): void
    {
        $user = $request->user();

        abort_unless($user->isSuperAdmin() || $user->can('subscription.manage'), 403);
    }

    private function businessId(Request $request): int
    {
        if ($request->user()->isSuperAdmin()) {
            $requested = $request->query('business_id', $request->input('business_id'));

            if ($requested !== null && $request->filled('business_id')) {
                return (int) $requested;
            }
        }

        return (int) TenantContext::businessId();
    }
}
