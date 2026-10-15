<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use App\Services\BusinessContextService;
use App\Support\ApiResponse;
use App\Support\Presenter;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BusinessController extends Controller
{
    public function __construct(
        private readonly BusinessContextService $context,
        private readonly \App\Services\AllocationService $allocations,
    ) {
    }

    public function context(Request $request)
    {
        abort_unless($request->user()->can('dashboard.view') || $request->user()->can('sales.view'), 403);

        return ApiResponse::success(
            $this->context->context(TenantContext::branchId()),
        );
    }

    public function branches(Request $request)
    {
        $perPage = $this->perPage($request);
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            $businessId = $request->query('business_id');
            $query = Branch::withoutGlobalScope('tenant-business')
                ->where('business_id', $businessId !== null ? (int) $businessId : TenantContext::businessId());
        } else {
            $query = Branch::query()
                ->when($user->branch_ids, fn ($q, $ids) => $q->whereIn('id', $ids));
        }

        $paginator = $query->orderBy('name')->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (Branch $branch) => Presenter::branch($branch));
    }

    /**
     * Network-wide telemetry for the multi-store branches dashboard: headline
     * KPIs plus a per-branch metric matrix (today's sales, stock value, tills).
     */
    public function branchesSummary(Request $request)
    {
        $user = $request->user();
        abort_unless($user->can('staff.view') || $user->can('staff.edit') || $user->isSuperAdmin(), 403);

        if ($user->isSuperAdmin()) {
            $businessId = (int) ($request->query('business_id') ?? TenantContext::businessId());
            $branches = Branch::withoutGlobalScope('tenant-business')
                ->where('business_id', $businessId)
                ->orderBy('name')
                ->get();
        } else {
            $branches = Branch::query()
                ->when($user->branch_ids, fn ($q, $ids) => $q->whereIn('id', $ids))
                ->orderBy('name')
                ->get();
            $businessId = (int) ($branches->first()->business_id ?? TenantContext::businessId());
        }

        $branchIds = $branches->pluck('id')->all();
        $currency = Business::query()->whereKey($businessId)->value('currency') ?? 'NGN';

        $since = now()->subDay();
        $todayStart = now()->startOfDay();

        $gmv = $branchIds === [] ? null : DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->where('created_at', '>=', $since)
            ->selectRaw('COALESCE(SUM(total), 0) AS value, COUNT(*) AS orders')
            ->first();

        $openTills = $branchIds === [] ? 0 : (int) DB::table('shifts')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'open')
            ->count();

        $tillVariance = $branchIds === [] ? 0.0 : (float) DB::table('shifts')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'closed')
            ->where('closed_at', '>=', $since)
            ->sum('variance');

        $inventory = $branchIds === [] ? null : DB::table('inventory_balances')
            ->leftJoin('products', 'products.id', '=', 'inventory_balances.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'inventory_balances.variant_id')
            ->where('inventory_balances.business_id', $businessId)
            ->whereIn('inventory_balances.branch_id', $branchIds)
            ->selectRaw('COUNT(*) AS skus, COALESCE(SUM(CASE WHEN inventory_balances.quantity > 0 THEN 1 ELSE 0 END), 0) AS in_stock, COALESCE(SUM(inventory_balances.quantity * COALESCE(product_variants.cost_price, products.cost_price, 0)), 0) AS value')
            ->first();

        $todaySales = $branchIds === [] ? collect() : DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->where('created_at', '>=', $todayStart)
            ->groupBy('branch_id')
            ->selectRaw('branch_id, COALESCE(SUM(total), 0) AS value, COUNT(*) AS orders')
            ->get()
            ->keyBy('branch_id');

        $stockByBranch = $branchIds === [] ? collect() : DB::table('inventory_balances')
            ->leftJoin('products', 'products.id', '=', 'inventory_balances.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'inventory_balances.variant_id')
            ->where('inventory_balances.business_id', $businessId)
            ->whereIn('inventory_balances.branch_id', $branchIds)
            ->groupBy('inventory_balances.branch_id')
            ->selectRaw('inventory_balances.branch_id AS branch_id, COUNT(*) AS skus, COALESCE(SUM(inventory_balances.quantity * COALESCE(product_variants.cost_price, products.cost_price, 0)), 0) AS value')
            ->get()
            ->keyBy('branch_id');

        $tillsByBranch = $branchIds === [] ? collect() : DB::table('shifts')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'open')
            ->groupBy('branch_id')
            ->selectRaw('branch_id, COUNT(*) AS open_count')
            ->get()
            ->keyBy('branch_id');

        $varianceByBranch = $branchIds === [] ? collect() : DB::table('shifts')
            ->where('business_id', $businessId)
            ->whereIn('branch_id', $branchIds)
            ->where('status', 'closed')
            ->where('closed_at', '>=', $since)
            ->groupBy('branch_id')
            ->selectRaw('branch_id, COALESCE(SUM(variance), 0) AS variance')
            ->get()
            ->keyBy('branch_id');

        $managerByBranch = $this->managersByBranch($businessId);

        $cards = $branches->map(function (Branch $branch) use ($managerByBranch, $todaySales, $stockByBranch, $tillsByBranch, $varianceByBranch) {
            $node = Presenter::branch($branch);
            $node['manager'] = $managerByBranch[$branch->id] ?? null;
            $node['today_sales'] = (float) ($todaySales[$branch->id]->value ?? 0);
            $node['today_orders'] = (int) ($todaySales[$branch->id]->orders ?? 0);
            $node['stock_value'] = (float) ($stockByBranch[$branch->id]->value ?? 0);
            $node['stock_skus'] = (int) ($stockByBranch[$branch->id]->skus ?? 0);
            $node['open_tills'] = (int) ($tillsByBranch[$branch->id]->open_count ?? 0);
            $node['variance'] = (float) ($varianceByBranch[$branch->id]->variance ?? 0);

            return $node;
        })->values()->all();

        $byType = $branches
            ->groupBy(fn (Branch $branch) => $branch->type ?: 'Unclassified')
            ->map(fn ($group, $type) => ['type' => $type, 'count' => $group->count()])
            ->sortByDesc('count')
            ->values()
            ->all();

        $gmvValue = (float) ($gmv->value ?? 0);
        $gmvOrders = (int) ($gmv->orders ?? 0);
        $inventorySkus = (int) ($inventory->skus ?? 0);
        $inventoryInStock = (int) ($inventory->in_stock ?? 0);

        return ApiResponse::success([
            'business_id' => $businessId,
            'currency' => $currency,
            'nodes' => [
                'total' => $branches->count(),
                'active' => $branches->where('is_active', true)->count(),
                'inactive' => $branches->where('is_active', false)->count(),
                'by_type' => $byType,
            ],
            'gmv_24h' => [
                'value' => $gmvValue,
                'orders' => $gmvOrders,
                'average' => $gmvOrders > 0 ? round($gmvValue / $gmvOrders, 2) : 0.0,
            ],
            'registers' => [
                'open' => $openTills,
                'variance' => round($tillVariance, 2),
                'branches' => $tillsByBranch->count(),
            ],
            'inventory' => [
                'value' => round((float) ($inventory->value ?? 0), 2),
                'skus' => $inventorySkus,
                'in_stock_pct' => $inventorySkus > 0 ? round(($inventoryInStock / $inventorySkus) * 100, 1) : 0.0,
            ],
            'branches' => $cards,
        ]);
    }

    /**
     * Resolve a display manager per branch from the users assigned to each branch.
     *
     * @return array<int, string>
     */
    private function managersByBranch(int $businessId): array
    {
        $assignments = [];

        foreach (User::query()->where('business_id', $businessId)->get(['id', 'name', 'branch_ids']) as $user) {
            foreach ($user->branch_ids ?? [] as $branchId) {
                $branchId = (int) $branchId;
                if ($branchId !== 0 && ! isset($assignments[$branchId])) {
                    $assignments[$branchId] = $user->name;
                }
            }
        }

        return $assignments;
    }

    public function storeBranch(Request $request)
    {
        $user = $request->user();
        abort_unless($user->can('staff.edit'), 403);

        $data = $request->validate([
            'business_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'type' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $targetBusinessId = TenantContext::businessId();

        if (! empty($data['business_id'])) {
            $requested = (int) $data['business_id'];

            if ($requested !== $targetBusinessId) {
                abort_unless($user->isSuperAdmin(), 403);
                abort_unless(
                    Business::query()->whereKey($requested)->exists(),
                    422,
                    'The selected business does not exist.',
                );
                $targetBusinessId = $requested;
            }
        }

        // Enforce the branch allowance from the active plan (null = unlimited).
        $branchLimit = Subscription::withoutGlobalScope('tenant-business')
            ->where('business_id', $targetBusinessId)
            ->latest('id')
            ->first()?->limit('branch_limit');

        if ($branchLimit !== null) {
            $existingBranches = Branch::withoutGlobalScope('tenant-business')
                ->where('business_id', $targetBusinessId)
                ->count();

            if ($existingBranches >= $branchLimit) {
                throw new ApiException(
                    'BRANCH_LIMIT',
                    sprintf('Your plan allows at most %d branch(es). Upgrade to add more.', $branchLimit),
                    422,
                );
            }
        }

        $branch = Branch::create([
            'business_id' => $targetBusinessId,
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'type' => $data['type'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'defaults' => ['currency' => 'NGN'],
        ]);

        $this->allocations->attachBranch($targetBusinessId, $branch->id);

        // Auto-create Store Manager for new branch
        if ($targetBusinessId) {
            $mgrEmail = 'manager.' . Str::slug($branch->code ?? $branch->name) . '.' . $targetBusinessId . '@example.com';
            if (! User::withoutGlobalScope('tenant-business')->where('email', $mgrEmail)->exists()) {
                $mgr = User::create([
                    'business_id' => $targetBusinessId,
                    'name' => 'Store Manager - ' . $branch->name,
                    'email' => $mgrEmail,
                    'password' => 'password',
                    'is_active' => true,
                    'branch_ids' => [$branch->id],
                ]);
                if (method_exists($mgr, 'assignRole')) {
                    $mgr->assignRole('Store Manager');
                }

                $this->allocations->attachUser($targetBusinessId, $mgr->id);
            }
        }

        return ApiResponse::success(Presenter::branch($branch), 'Branch created.');
    }

    public function updateBranch(Request $request, int $branch)
    {
        abort_unless($request->user()->can('staff.edit'), 403);

        $record = $this->findBranchForUser($request, $branch);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'type' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $record->update($data);

        return ApiResponse::success(Presenter::branch($record), 'Branch updated.');
    }

    public function destroyBranch(Request $request, int $branch)
    {
        abort_unless($request->user()->can('staff.edit'), 403);

        $record = $this->findBranchForUser($request, $branch);
        $record->delete();

        return ApiResponse::success(null, 'Branch deleted.');
    }

    public function listBusinesses(Request $request)
    {
        $user = $request->user();

        $businesses = $user->isSuperAdmin()
            ? Business::query()->orderBy('name')->get()
            : Business::query()->whereKey($user->business_id)->get();

        $this->hydrateSubscriptions($businesses);

        return ApiResponse::success(
            $businesses->map(fn (Business $business) => Presenter::business(
                $business,
                $business->subscription,
                $business->wallet,
            ))->values()->all(),
        );
    }

    public function storeBusiness(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'max:8'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'plan_id' => ['nullable', 'integer'],
        ]);

        $slug = $data['slug'] ?? Str::slug($data['name']);
        $business = Business::firstOrCreate(
            ['slug' => $slug],
            [
                'name' => $data['name'],
                'slug' => $slug,
                'currency' => $data['currency'] ?? 'NGN',
                'timezone' => $data['timezone'] ?? 'Africa/Lagos',
                'address' => $data['address'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]
        );

        if (! Wallet::withoutGlobalScope('tenant-business')->where('business_id', $business->id)->exists()) {
            Wallet::create(['business_id' => $business->id, 'currency' => $business->currency, 'balance' => 0, 'pending' => 0]);
        }

        if (! Subscription::withoutGlobalScope('tenant-business')->where('business_id', $business->id)->exists()) {
            $plan = SubscriptionPlan::find($data['plan_id'] ?? null) ?? SubscriptionPlan::where('slug', 'starter')->first();
            if ($plan) {
                Subscription::create([
                    'business_id' => $business->id,
                    'plan_id' => $plan->id,
                    'status' => 'trial',
                    'starts_at' => now()->toDateString(),
                    'trial_ends_at' => now()->addDays(30)->toDateString(),
                    'limits' => $plan->limits(),
                ]);
            }
        }

        // Auto-create Business Admin login credential for the new business
        if (! User::withoutGlobalScope('tenant-business')->where('business_id', $business->id)->where('email', $data['email'] ?? null)->exists() || true) {
            $adminEmail = $data['email'] ?? $business->slug . '@' . parse_url(config('app.url'))['host'] ?? 'business.local';
            $adminEmail = is_string($adminEmail) ? $adminEmail : ($business->slug . '@example.com');
            if (! User::withoutGlobalScope('tenant-business')->where('email', $adminEmail)->exists()) {
                $admin = User::create([
                    'business_id' => $business->id,
                    'name' => 'Business Admin',
                    'email' => $adminEmail,
                    'password' => 'password',
                    'is_active' => true,
                    'branch_ids' => [],
                ]);
                if (method_exists($admin, 'assignRole')) {
                    $admin->assignRole('Business Admin');
                }
            }
        }

        $business = Business::query()->findOrFail($business->id);
        $this->hydrateSubscriptions(new Collection([$business]));

        return ApiResponse::success(Presenter::business($business, $business->subscription, $business->wallet), 'Business created.');
    }

    public function assignPlan(Request $request, int $business)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:subscription_plans,id'],
            'status' => ['nullable', 'in:active,trial,expired,suspended'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'trial_ends_at' => ['nullable', 'date'],
            'grace_ends_at' => ['nullable', 'date'],
        ]);

        $businessModel = Business::query()->findOrFail($business);
        $plan = SubscriptionPlan::query()->findOrFail($data['plan_id']);

        $subscription = Subscription::withoutGlobalScope('tenant-business')->updateOrCreate(
            ['business_id' => $businessModel->id],
            [
                'plan_id' => $plan->id,
                'status' => $data['status'] ?? 'active',
                'starts_at' => $data['starts_at'] ?? now()->toDateString(),
                'expires_at' => $data['expires_at'] ?? null,
                'trial_ends_at' => $data['trial_ends_at'] ?? null,
                'grace_ends_at' => $data['grace_ends_at'] ?? null,
                'limits' => $plan->limits(),
            ],
        );

        return ApiResponse::success(
            Presenter::business($businessModel->fresh(), $subscription->fresh(['plan']), $businessModel->wallet),
            'Subscription plan assigned.',
        );
    }

    public function switchBranch(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $branchId = $data['branch_id'] ?? null;

        if ($branchId !== null) {
            $branch = Branch::query()->find($branchId);

            if ($branch === null) {
                throw new ApiException('BRANCH_NOT_FOUND', 'The selected branch could not be found.', 404);
            }

            if (! $this->allocations->allowsBranch((int) $branch->business_id, (int) $branch->id)) {
                throw new ApiException(
                    'BRANCH_NOT_ALLOCATED',
                    'This branch is not included in your plan allocation. Contact your administrator.',
                    403,
                );
            }

            if (! $user->hasBranchAccess($branch->id)) {
                throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
            }
        }

        TenantContext::setBranchId($branchId);

        return ApiResponse::success(
            $this->context->context($branchId, false),
            $branchId === null ? 'Viewing all branches.' : 'Branch switched.',
        );
    }

    private function findBranchForUser(Request $request, int $branchId): Branch
    {
        $query = $request->user()->isSuperAdmin()
            ? Branch::withoutGlobalScope('tenant-business')
            : Branch::query();

        return $query->findOrFail($branchId);
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }

    /**
     * Attach subscription + wallet relations ignoring the tenant global scope so a
     * Super Admin can see data for businesses other than their own. The default
     * hasOne(...)->latestOfMany() relation embeds the tenant scope in its aggregate
     * subquery, which cannot be removed via an eager-load closure.
     */
    private function hydrateSubscriptions(Collection $businesses): void
    {
        $ids = $businesses->pluck('id')->all();

        if ($ids === []) {
            return;
        }

        $subscriptions = Subscription::withoutGlobalScope('tenant-business')
            ->with('plan')
            ->whereIn('business_id', $ids)
            ->orderByDesc('id')
            ->get()
            ->unique('business_id')
            ->keyBy('business_id');

        $wallets = Wallet::withoutGlobalScope('tenant-business')
            ->whereIn('business_id', $ids)
            ->get()
            ->keyBy('business_id');

        $businesses->each(function (Business $business) use ($subscriptions, $wallets) {
            $business->setRelation('subscription', $subscriptions->get($business->id));
            $business->setRelation('wallet', $wallets->get($business->id));
        });
    }
}