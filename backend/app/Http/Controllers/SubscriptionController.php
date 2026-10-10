<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Services\BusinessContextService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(private readonly BusinessContextService $context)
    {
    }

    public function show(Request $request)
    {
        abort_unless($request->user()->can('subscription.view'), 403);

        $business = Business::query()->findOrFail(TenantContext::businessId());

        return ApiResponse::success($this->context->subscriptionInfo($business));
    }

    public function plans(Request $request)
    {
        abort_unless($request->user()->can('subscription.view'), 403);

        return ApiResponse::success(
            SubscriptionPlan::query()
                ->orderBy('id')
                ->get()
                ->map(fn (SubscriptionPlan $plan) => $plan->toInfo())
                ->values()
                ->all(),
        );
    }

    public function storePlan(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'slug' => ['required', 'string', 'max:100', 'unique:subscription_plans,slug'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'staff_limit' => ['nullable', 'integer'],
            'branch_limit' => ['nullable', 'integer'],
            'product_limit' => ['nullable', 'integer'],
            'transaction_limit' => ['nullable', 'integer'],
            'monthly_price' => ['nullable', 'numeric'],
            'quarterly_price' => ['nullable', 'numeric'],
            'annual_price' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'max:8'],
            'grace_days' => ['nullable', 'integer'],
            'features' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $plan = SubscriptionPlan::create([
            'slug' => $data['slug'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'staff_limit' => $data['staff_limit'] ?? null,
            'branch_limit' => $data['branch_limit'] ?? null,
            'product_limit' => $data['product_limit'] ?? null,
            'transaction_limit' => $data['transaction_limit'] ?? null,
            'monthly_price' => $data['monthly_price'] ?? null,
            'quarterly_price' => $data['quarterly_price'] ?? null,
            'annual_price' => $data['annual_price'] ?? null,
            'currency' => $data['currency'] ?? 'NGN',
            'grace_days' => $data['grace_days'] ?? 0,
            'features' => $data['features'] ?? [],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return ApiResponse::success($plan->toInfo(), 'Plan created.');
    }

    public function updatePlan(Request $request, int $plan)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $plan = SubscriptionPlan::query()->findOrFail($plan);
        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:100', 'unique:subscription_plans,slug,' . $plan->id],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'staff_limit' => ['nullable', 'integer'],
            'branch_limit' => ['nullable', 'integer'],
            'product_limit' => ['nullable', 'integer'],
            'transaction_limit' => ['nullable', 'integer'],
            'monthly_price' => ['nullable', 'numeric'],
            'quarterly_price' => ['nullable', 'numeric'],
            'annual_price' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'max:8'],
            'grace_days' => ['nullable', 'integer'],
            'features' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $plan->update($data);

        return ApiResponse::success($plan->fresh()->toInfo(), 'Plan updated.');
    }

    public function destroyPlan(Request $request, int $plan)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $plan = SubscriptionPlan::query()->findOrFail($plan);
        $plan->delete();

        return ApiResponse::success(null, 'Plan deleted.');
    }
}