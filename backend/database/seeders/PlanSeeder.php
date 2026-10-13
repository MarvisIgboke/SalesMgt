<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'slug' => 'starter',
                'name' => 'Starter',
                'description' => 'For a single-store business getting started.',
                'staff_limit' => 3,
                'branch_limit' => 1,
                'duration_months' => 1,
                'monthly_price' => 0,
                'quarterly_price' => 0,
                'annual_price' => 0,
                'currency' => 'NGN',
                'grace_days' => 7,
                'features' => ['pos', 'inventory', 'customers', 'reports'],
            ],
            [
                'slug' => 'growth',
                'name' => 'Growth',
                'description' => 'Multi-user with approvals and finance.',
                'staff_limit' => 15,
                'branch_limit' => 3,
                'duration_months' => 1,
                'monthly_price' => 15000,
                'quarterly_price' => 40500,
                'annual_price' => 144000,
                'currency' => 'NGN',
                'grace_days' => 3,
                'features' => ['pos', 'inventory', 'customers', 'suppliers', 'expenses', 'shifts', 'finance', 'reports', 'expiry'],
            ],
            [
                'slug' => 'scale',
                'name' => 'Scale',
                'description' => 'Multi-branch with approval workflows and audit.',
                'staff_limit' => 100,
                'branch_limit' => 20,
                'duration_months' => 12,
                'monthly_price' => 50000,
                'quarterly_price' => 135000,
                'annual_price' => 480000,
                'currency' => 'NGN',
                'grace_days' => 3,
                'features' => ['pos', 'inventory', 'customers', 'suppliers', 'expenses', 'shifts', 'finance', 'reports', 'expiry', 'subscription_roles', 'audit', 'wallet', 'multi_branch'],
            ],
            [
                'slug' => 'enterprise',
                'name' => 'Enterprise',
                'description' => 'Custom limits, dedicated support and integrations.',
                'staff_limit' => null,
                'branch_limit' => null,
                'duration_months' => 12,
                'monthly_price' => null,
                'quarterly_price' => null,
                'annual_price' => null,
                'currency' => 'NGN',
                'grace_days' => 0,
                'features' => ['pos', 'inventory', 'customers', 'suppliers', 'expenses', 'shifts', 'finance', 'reports', 'expiry', 'subscription_roles', 'audit', 'wallet', 'multi_branch', 'integrations'],
                'is_active' => false,
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}