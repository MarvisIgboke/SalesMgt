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
                ->where('is_active', true)
                ->orderBy('monthly_price')
                ->get()
                ->map(fn (SubscriptionPlan $plan) => $plan->toInfo())
                ->values()
                ->all(),
        );
    }
}