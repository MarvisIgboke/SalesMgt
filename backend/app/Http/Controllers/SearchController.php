<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function global(Request $request)
    {
        abort_unless($request->user()->can('search.view'), 403);

        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return ApiResponse::success(['groups' => []]);
        }

        $like = '%'.$term.'%';
        $limit = 6;
        $user = $request->user();
        $branchId = TenantContext::branchId();
        $groups = [];

        if ($user->can('products.view')) {
            $products = Product::query()
                ->where('is_active', true)
                ->where(fn ($q) => $q->where('name', 'like', $like)
                    ->orWhere('sku', 'like', $like)
                    ->orWhereHas('barcodes', fn ($b) => $b->where('barcode', 'like', $like)))
                ->orderBy('name')
                ->limit($limit)
                ->get();

            $groups[] = [
                'type' => 'product',
                'title' => 'Products',
                'results' => $products->map(fn (Product $product) => [
                    'id' => $product->id,
                    'type' => 'product',
                    'label' => $product->name,
                    'subtitle' => trim(($product->sku ?? '').' · '.number_format((float) $product->selling_price, 2)),
                    'meta' => [
                        'sku' => $product->sku,
                        'price' => (float) $product->selling_price,
                    ],
                ])->values()->all(),
            ];
        }

        if ($user->can('customers.view')) {
            $customers = Customer::query()
                ->where(fn ($q) => $q->where('name', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhere('email', 'like', $like))
                ->orderBy('name')
                ->limit($limit)
                ->get();

            $groups[] = [
                'type' => 'customer',
                'title' => 'Customers',
                'results' => $customers->map(fn (Customer $customer) => [
                    'id' => $customer->id,
                    'type' => 'customer',
                    'label' => $customer->name,
                    'subtitle' => $customer->phone ?? $customer->email,
                    'meta' => ['phone' => $customer->phone],
                ])->values()->all(),
            ];
        }

        if ($user->can('sales.view')) {
            $sales = Sale::query()
                ->whereNotNull('reference')
                ->where('reference', 'like', $like)
                ->orderByDesc('id')
                ->limit($limit)
                ->get();

            $groups[] = [
                'type' => 'sale',
                'title' => 'Sales',
                'results' => $sales->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'type' => 'sale',
                    'label' => $sale->reference,
                    'subtitle' => number_format((float) $sale->total, 2).' · '.$sale->payment_status,
                    'meta' => ['total' => (float) $sale->total],
                ])->values()->all(),
            ];
        }

        if ($user->can('purchases.create') || $user->can('purchases.approve') || $user->can('purchases.receive')) {
            $suppliers = Supplier::query()
                ->where(fn ($q) => $q->where('name', 'like', $like)
                    ->orWhere('contact_name', 'like', $like)
                    ->orWhere('phone', 'like', $like))
                ->orderBy('name')
                ->limit($limit)
                ->get();

            $groups[] = [
                'type' => 'supplier',
                'title' => 'Suppliers',
                'results' => $suppliers->map(fn (Supplier $supplier) => [
                    'id' => $supplier->id,
                    'type' => 'supplier',
                    'label' => $supplier->name,
                    'subtitle' => $supplier->contact_name ?? $supplier->phone,
                    'meta' => ['phone' => $supplier->phone],
                ])->values()->all(),
            ];
        }

        if ($user->can('staff.view')) {
            $staff = User::query()
                ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like))
                ->orderBy('name')
                ->limit($limit)
                ->get();

            $groups[] = [
                'type' => 'staff',
                'title' => 'Staff',
                'results' => $staff->map(fn (User $member) => [
                    'id' => $member->id,
                    'type' => 'staff',
                    'label' => $member->name,
                    'subtitle' => $member->email,
                    'meta' => [],
                ])->values()->all(),
            ];
        }

        $branches = Branch::query()
            ->where('name', 'like', $like)
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $groups[] = [
            'type' => 'branch',
            'title' => 'Branches',
            'results' => $branches->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'type' => 'branch',
                'label' => $branch->name,
                'subtitle' => $branch->code,
                'meta' => ['is_active' => (bool) $branch->is_active],
            ])->values()->all(),
        ];

        $groups = array_values(array_filter($groups, fn (array $group) => $group['results'] !== []));

        return ApiResponse::success(['groups' => $groups]);
    }
}
