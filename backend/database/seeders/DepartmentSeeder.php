<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $businessId = 1;

        $general = Department::query()->firstOrCreate(
            ['business_id' => $businessId, 'name' => 'General'],
            ['code' => 'GEN', 'description' => 'Default department for unclassified staff and products.', 'is_active' => true],
        );

        // Anything still unassigned falls back to General.
        User::query()->where('business_id', $businessId)->whereNull('department_id')->update(['department_id' => $general->id]);
        Product::query()->where('business_id', $businessId)->whereNull('department_id')->update(['department_id' => $general->id]);

        $departments = [];
        foreach ([
            'Beverages' => ['BEV', 'Soft drinks, water and malt.'],
            'Groceries' => ['GRO', 'Shelf-stable groceries and staples.'],
            'Pharmacy' => ['PHA', 'Over-the-counter medicine and health.'],
            'Electronics' => ['ELE', 'Accessories and consumer electronics.'],
            'Household' => ['HOU', 'Cleaning and home care.'],
        ] as $name => [$code, $description]) {
            $departments[$name] = Department::query()->firstOrCreate(
                ['business_id' => $businessId, 'name' => $name],
                ['code' => $code, 'description' => $description, 'is_active' => true],
            );
        }

        $productMap = [
            'Coca-Cola 50cl' => 'Beverages',
            'Nestle Milo Tin 500g' => 'Beverages',
            'Mineral Water 75cl' => 'Beverages',
            'Emzor Paracetamol 500mg x100' => 'Pharmacy',
            'Samsung USB-C Cable' => 'Electronics',
            'Detergent 1kg' => 'Household',
        ];

        foreach ($productMap as $productName => $departmentName) {
            Product::query()
                ->where('business_id', $businessId)
                ->where('name', $productName)
                ->update(['department_id' => $departments[$departmentName]->id]);
        }

        $staffMap = [
            'Demo Cashier' => 'Beverages',
            'Chika Obi' => 'Groceries',
            'Tunde Adeyemi' => 'Pharmacy',
        ];

        foreach ($staffMap as $staffName => $departmentName) {
            User::query()
                ->where('business_id', $businessId)
                ->where('name', $staffName)
                ->update(['department_id' => $departments[$departmentName]->id]);
        }
    }
}