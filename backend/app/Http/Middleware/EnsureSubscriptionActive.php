<?php

namespace App\Http\Middleware;

use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSubscriptionActive
{
    /**
     * Block mutating requests when the business subscription is inactive
     * or has lapsed beyond its grace period. Reads always pass.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $businessId = TenantContext::businessId();

        if ($businessId === null) {
            return $next($request);
        }

        // Platform administrators are never gated by a business subscription.
        if ($request->user()?->isSuperAdmin()) {
            return $next($request);
        }

        $subscription = Subscription::query()
            ->where('business_id', $businessId)
            ->latest('id')
            ->first();

        if ($subscription === null || ! $subscription->isEffectivelyActive()) {
            return $this->blocked($request, 'Your subscription is not active. Please renew to continue.');
        }

        $lapsed = $subscription->expires_at !== null
            && $subscription->expires_at->isPast()
            && ($subscription->grace_ends_at === null || $subscription->grace_ends_at->isPast());

        $trialEnded = $subscription->status === 'trial'
            && $subscription->trial_ends_at !== null
            && $subscription->trial_ends_at->isPast()
            && ($subscription->grace_ends_at === null || $subscription->grace_ends_at->isPast());

        if ($lapsed || $trialEnded) {
            return $this->blocked($request, 'Your subscription has expired. Please renew to continue.');
        }

        // The business stays locked until the current period invoice is settled.
        $unpaidInvoice = SubscriptionInvoice::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->where('status', 'unpaid')
            ->whereNotNull('due_at')
            ->whereDate('due_at', '<=', now())
            ->exists();

        if ($unpaidInvoice) {
            return $this->blocked($request, 'Your subscription invoice is unpaid. Settle it to continue.');
        }

        return $next($request);
    }

    private function blocked(Request $request, string $message): Response
    {
        return response()->json(
            ApiResponse::error('SUBSCRIPTION_INACTIVE', $message, request: $request),
            402,
            ApiResponse::errorHeaders($request),
        );
    }
}
