<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Business;
use App\Models\BusinessSetting;
use App\Models\Subscription;
use App\Models\Wallet;
use App\Support\Presenter;
use App\Support\TenantContext;

class BusinessContextService
{
    public function context(?int $branchId = null, bool $fallback = true): array
    {
        $businessId = TenantContext::businessId();
        $business = $businessId !== null
            ? Business::query()->with(['subscription.plan', 'wallet'])->find($businessId)
            : null;

        // Platform operators (a Super Admin without a business) get a neutral
        // context so the app shell renders instead of failing with a 404.
        if ($business === null) {
            return $this->platformContext();
        }

        $subscription = $business->subscription;
        $wallet = $business->wallet;

        $branch = null;

        if ($branchId !== null) {
            $branch = Branch::query()->find($branchId);
        }

        if ($branch === null && $fallback) {
            $branch = $business->branches()->where('is_active', true)->orderBy('id')->first();
        }

        return [
            'business' => Presenter::business($business, $subscription, $wallet),
            'branch' => Presenter::branch($branch),
            'subscription' => Presenter::subscription($business, $subscription, $wallet),
            'wallet' => Presenter::wallet($wallet, $business->currency),
        ];
    }

    /**
     * A neutral context for a platform operator with no business of their own.
     */
    private function platformContext(): array
    {
        $subscription = [
            'status' => 'none',
            'plan' => 'No Plan',
            'expiry_date' => null,
            'trial_ends_at' => null,
            'limits' => Subscription::defaultLimits(),
        ];

        return [
            'business' => [
                'id' => 0,
                'name' => 'Platform',
                'slug' => null,
                'logo_url' => null,
                'currency' => 'NGN',
                'timezone' => config('app.timezone', 'UTC'),
                'address' => null,
                'email' => null,
                'phone' => null,
                'subscription' => $subscription,
            ],
            'branch' => null,
            'subscription' => $subscription,
            'wallet' => ['balance' => 0, 'currency' => 'NGN', 'pending' => 0],
        ];
    }

    public function subscriptionInfo(Business $business): array
    {
        $business->loadMissing(['subscription.plan', 'wallet']);

        return Presenter::subscription($business, $business->subscription, $business->wallet);
    }

    public function walletInfo(Business $business): array
    {
        $business->loadMissing('wallet');

        return Presenter::wallet($business->wallet, $business->currency);
    }

    /**
     * Resolve a boolean business setting for the active branch.
     */
    public function settingBool(string $key, bool $default = false): bool
    {
        return BusinessSetting::bool($key, $default, TenantContext::branchId());
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        $value = BusinessSetting::value($key, TenantContext::branchId());

        if ($value === null) {
            $value = BusinessSetting::value($key, null);
        }

        return $value ?? $default;
    }

    public function activeSubscription(): ?Subscription
    {
        return Subscription::query()->with('plan')->latest('id')->first();
    }

    public function wallet(): ?Wallet
    {
        return Wallet::query()->first();
    }
}