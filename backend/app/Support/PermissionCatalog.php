<?php

namespace App\Support;

final class PermissionCatalog
{
    public const GROUPS = [
        'Dashboard' => ['dashboard.view'],
        'Sales' => [
            'sales.view',
            'sales.create',
            'sales.edit',
            'sales.cancel',
            'sales.delete',
            'sales.refund',
            'sales.discount',
            'sales.price_override',
            'sales.credit',
            'sales.session',
        ],
        'Products' => [
            'products.view',
            'products.create',
            'products.edit',
            'products.delete',
        ],
        'Customers' => [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.credit',
        ],
        'Inventory' => [
            'inventory.view',
            'inventory.adjust',
            'inventory.receive',
            'inventory.transfer',
            'inventory.approve',
        ],
        'Finance' => [
            'finance.view',
            'finance.payment_approve',
            'finance.payment_reject',
            'finance.reconcile',
        ],
        'Expenses' => [
            'expenses.create',
            'expenses.approve',
        ],
        'Purchasing' => [
            'purchases.create',
            'purchases.approve',
            'purchases.receive',
        ],
        'Staff' => [
            'staff.view',
            'staff.create',
            'staff.edit',
            'staff.permissions',
        ],
        'Departments' => [
            'departments.view',
            'departments.manage',
        ],
        'Shifts' => [
            'shifts.view',
            'shifts.operate',
            'shifts.reconcile',
        ],
        'Wallet' => [
            'wallet.view',
            'wallet.transactions',
            'wallet.manage',
        ],
        'Subscription' => [
            'subscription.view',
        ],
        'Reports' => ['reports.view'],
        'Audit' => ['audit.view'],
        'Search' => ['search.view'],
        'Notifications' => ['notifications.view'],
    ];

    /**
     * Flat list of all permission keys.
     *
     * @return list<string>
     */
    public static function all(): array
    {
        return array_values(array_merge(...array_values(self::GROUPS)));
    }

    /**
     * [{ key, label, group }]
     */
    public static function catalog(): array
    {
        $out = [];

        foreach (self::GROUPS as $group => $keys) {
            foreach ($keys as $key) {
                $out[] = [
                    'key' => $key,
                    'label' => ucwords(str_replace('_', ' ', $key)),
                    'group' => $group,
                ];
            }
        }

        return $out;
    }

    public static function superAdmin(): array
    {
        return self::all();
    }

    public static function storeManager(): array
    {
        return [
            'dashboard.view',
            'sales.view', 'sales.create', 'sales.edit', 'sales.cancel', 'sales.discount', 'sales.credit',
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'customers.view', 'customers.create', 'customers.edit', 'customers.credit',
            'inventory.view', 'inventory.adjust',
            'finance.view',
            'expenses.create',
            'purchases.create', 'purchases.approve', 'purchases.receive',
            'staff.view', 'staff.create', 'staff.edit', 'staff.permissions',
            'shifts.view', 'shifts.operate', 'shifts.reconcile',
            'departments.view', 'departments.manage',
            'wallet.view', 'wallet.transactions',
            'subscription.view',
            'reports.view',
            'search.view',
            'notifications.view',
        ];
    }

    public static function financeOfficer(): array
    {
        return [
            'dashboard.view',
            'sales.view', 'sales.refund',
            'customers.view', 'customers.credit',
            'finance.view', 'finance.payment_approve', 'finance.payment_reject', 'finance.reconcile',
            'expenses.create', 'expenses.approve',
            'purchases.approve',
            'reports.view',
            'departments.view',
            'wallet.view', 'wallet.transactions',
            'subscription.view',
            'search.view',
            'notifications.view',
        ];
    }

    public static function inventoryOfficer(): array
    {
        return [
            'dashboard.view',
            'products.view', 'products.edit',
            'inventory.view', 'inventory.adjust', 'inventory.receive', 'inventory.transfer', 'inventory.approve',
            'purchases.create', 'purchases.receive',
            'expenses.create',
            'departments.view',
            'reports.view',
            'search.view',
            'notifications.view',
        ];
    }

    public static function salesRepresentative(): array
    {
        return [
            'dashboard.view',
            'sales.view', 'sales.create', 'sales.edit', 'sales.cancel', 'sales.discount', 'sales.session',
            'products.view',
            'customers.view', 'customers.create', 'customers.edit',
            'departments.view',
            'search.view',
            'shifts.view',
            'notifications.view',
        ];
    }

    public static function auditor(): array
    {
        return [
            'dashboard.view',
            'sales.view',
            'customers.view',
            'inventory.view',
            'finance.view',
            'staff.view',
            'departments.view',
            'reports.view',
            'audit.view',
            'search.view',
            'notifications.view',
        ];
    }
}