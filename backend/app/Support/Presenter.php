<?php

namespace App\Support;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Wallet;

final class Presenter
{
    public static function user(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatar_url,
            'roles' => $user->getRoleNames()->values()->all(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'business_id' => $user->business_id,
            'branch_ids' => $user->branch_ids ?? [],
        ];
    }

    public static function business(Business $business, ?Subscription $subscription, ?Wallet $wallet): array
    {
        return [
            'id' => $business->id,
            'name' => $business->name,
            'slug' => $business->slug,
            'logo_url' => $business->logo_url,
            'currency' => $business->currency,
            'timezone' => $business->timezone,
            'address' => $business->address,
            'email' => $business->email,
            'phone' => $business->phone,
            'subscription' => self::subscription($business, $subscription, $wallet),
        ];
    }

    public static function branch(?\App\Models\Branch $branch): ?array
    {
        if ($branch === null) {
            return null;
        }

        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'code' => $branch->code,
            'address' => $branch->address,
            'phone' => $branch->phone,
            'type' => $branch->type,
            'is_active' => $branch->is_active,
            'defaults' => $branch->defaults,
        ];
    }

    public static function subscription(Business $business, ?Subscription $subscription, ?Wallet $wallet): array
    {
        if ($subscription === null) {
            return [
                'status' => 'none',
                'plan' => 'No Plan',
                'expiry_date' => null,
                'trial_ends_at' => null,
                'limits' => Subscription::defaultLimits(),
            ];
        }

        $info = $subscription->toInfo();
        $info['limits'] = $subscription->limits ?? ($subscription->plan?->limits() ?? Subscription::defaultLimits());

        return $info;
    }

    public static function wallet(?Wallet $wallet, string $currency): array
    {
        return [
            'balance' => $wallet?->balance ?? 0,
            'currency' => $wallet?->currency ?? $currency,
            'pending' => $wallet?->pending ?? 0,
        ];
    }
}