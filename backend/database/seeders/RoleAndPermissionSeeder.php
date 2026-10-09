<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleAndPermissionSeeder extends Seeder
{
    public const GUARD = 'web';

    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (PermissionCatalog::all() as $key) {
            Permission::findOrCreate($key, self::GUARD);
        }

        $roles = [
            'Super Admin' => PermissionCatalog::superAdmin(),
            'Store Manager' => PermissionCatalog::storeManager(),
            'Finance Officer' => PermissionCatalog::financeOfficer(),
            'Inventory Officer' => PermissionCatalog::inventoryOfficer(),
            'Sales Representative' => PermissionCatalog::salesRepresentative(),
            'Auditor' => PermissionCatalog::auditor(),
        ];

        foreach ($roles as $name => $permissions) {
            $role = Role::findOrCreate($name, self::GUARD);

            if (method_exists($role, 'syncPermissions')) {
                $role->syncPermissions($permissions);
            }
        }
    }
}