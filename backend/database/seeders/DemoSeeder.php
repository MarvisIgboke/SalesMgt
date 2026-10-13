<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Branch;
use App\Models\Business;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\Unit;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $business = Business::updateOrCreate(
            ['slug' => 'demo-retail'],
            [
                'name' => 'Demo Retail',
                'currency' => 'NGN',
                'timezone' => 'Africa/Lagos',
                'address' => '12 Example Avenue, Lagos',
                'email' => 'hello@demo.local',
                'phone' => '+2348000000000',
            ],
        );

        $branches = [
            ['name' => 'Headquarters', 'code' => 'HQ', 'type' => 'retail', 'address' => '12 Example Avenue, Lagos'],
            ['name' => 'Festac Town', 'code' => 'FST', 'type' => 'pharmacy', 'address' => '3 Festival Road, Lagos'],
        ];

        foreach ($branches as $i => $branch) {
            Branch::updateOrCreate(
                ['business_id' => $business->id, 'code' => $branch['code']],
                [...$branch, 'is_active' => true, 'defaults' => ['currency' => 'NGN']],
            );
        }

        $superAdmin = User::updateOrCreate(
            ['email' => 'admin@demo.local'],
            [
                'name' => 'Demo Administrator',
                'business_id' => $business->id,
                'password' => 'password',
                'phone' => '+2348000000001',
                'is_active' => true,
            ],
        );
        $superAdmin->assignRole('Super Admin');

        $cashier = User::updateOrCreate(
            ['email' => 'cashier@demo.local'],
            [
                'name' => 'Demo Cashier',
                'business_id' => $business->id,
                'password' => 'password',
                'phone' => '+2348000000002',
            ],
        );
        $cashier->assignRole('Sales Representative');

        $businessAdmin = User::updateOrCreate(
            ['email' => 'owner@demo.local'],
            [
                'name' => 'Demo Business Owner',
                'business_id' => $business->id,
                'password' => 'password',
                'phone' => '+2348000000003',
                'is_active' => true,
            ],
        );
        $businessAdmin->assignRole('Business Admin');

        Wallet::updateOrCreate(
            ['business_id' => $business->id],
            ['currency' => 'NGN', 'balance' => 250000, 'pending' => 0],
        );

        $plan = SubscriptionPlan::where('slug', 'growth')->first() ?? SubscriptionPlan::first();
        Subscription::updateOrCreate(
            ['business_id' => $business->id, 'plan_id' => $plan->id],
            [
                'status' => 'active',
                'starts_at' => now()->subMonths(2)->toDateString(),
                'expires_at' => now()->addMonths(10)->toDateString(),
                'trial_ends_at' => null,
                'limits' => $plan->limits(),
            ],
        );

        // Catalog
        $categories = ['Beverages', 'Pharmacy', 'Household', 'Electronics', 'Food'];
        $categoryMap = [];
        foreach ($categories as $name) {
            $categoryMap[$name] = Category::updateOrCreate(['business_id' => $business->id, 'name' => $name])->id;
        }

        $brands = ['Nestle', 'Coca-Cola', 'Emzor', 'Samsung'];
        $brandMap = [];
        foreach ($brands as $name) {
            $brandMap[$name] = Brand::updateOrCreate(['business_id' => $business->id, 'name' => $name])->id;
        }

        $units = [
            ['name' => 'Piece', 'code' => 'pc'],
            ['name' => 'Carton', 'code' => 'ctn'],
            ['name' => 'Bottle', 'code' => 'btl'],
        ];
        $unitMap = [];
        foreach ($units as $unit) {
            $unitMap[$unit['name']] = Unit::updateOrCreate(
                ['business_id' => $business->id, 'name' => $unit['name']],
                ['code' => $unit['code']],
            )->id;
        }

        $products = [
            [
                'name' => 'Coca-Cola 50cl', 'sku' => 'CC-50',
                'category_id' => $categoryMap['Beverages'], 'brand_id' => $brandMap['Coca-Cola'],
                'unit_id' => $unitMap['Bottle'], 'cost_price' => 180, 'selling_price' => 300,
                'barcodes' => ['6009102670060'],
            ],
            [
                'name' => 'Nestle Milo Tin 500g', 'sku' => 'MILO-500',
                'category_id' => $categoryMap['Food'], 'brand_id' => $brandMap['Nestle'],
                'unit_id' => $unitMap['Piece'], 'cost_price' => 4200, 'selling_price' => 5200,
                'barcodes' => ['5449000177506'],
            ],
            [
                'name' => 'Emzor Paracetamol 500mg x100', 'sku' => 'PARA-100',
                'category_id' => $categoryMap['Pharmacy'], 'brand_id' => $brandMap['Emzor'],
                'unit_id' => $unitMap['Piece'], 'cost_price' => 950, 'selling_price' => 1300,
                'requires_expiry' => true,
                'barcodes' => ['7003814900943'],
            ],
            [
                'name' => 'Samsung USB-C Cable', 'sku' => 'SS-USB-C',
                'category_id' => $categoryMap['Electronics'], 'brand_id' => $brandMap['Samsung'],
                'unit_id' => $unitMap['Piece'], 'cost_price' => 1800, 'selling_price' => 3200,
                'barcodes' => ['8806090001604'],
            ],
            [
                'name' => 'Detergent 1kg', 'sku' => 'DET-1',
                'category_id' => $categoryMap['Household'], 'unit_id' => $unitMap['Piece'],
                'cost_price' => 700, 'selling_price' => 1100,
                'barcodes' => ['6151260123456'],
            ],
            [
                'name' => 'Mineral Water 75cl', 'sku' => 'WTR-75',
                'category_id' => $categoryMap['Beverages'], 'unit_id' => $unitMap['Bottle'],
                'cost_price' => 120, 'selling_price' => 200,
                'barcodes' => ['6150000000000'],
            ],
        ];

        foreach ($products as $i => $item) {
            $barcodes = $item['barcodes'] ?? [];
            unset($item['barcodes']);

            $product = Product::updateOrCreate(
                ['business_id' => $business->id, 'sku' => $item['sku']],
                [
                    ...$item,
                    'business_id' => $business->id,
                    'requires_expiry' => $item['requires_expiry'] ?? false,
                    'is_active' => true,
                ],
            );

            foreach ($barcodes as $barcode) {
                ProductBarcode::updateOrCreate(
                    ['business_id' => $business->id, 'barcode' => $barcode],
                    ['product_id' => $product->id],
                );
            }
        }
    }
}