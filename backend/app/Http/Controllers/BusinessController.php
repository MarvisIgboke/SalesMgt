<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\Wallet;
use App\Services\BusinessContextService;
use App\Support\ApiResponse;
use App\Support\Presenter;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BusinessController extends Controller
{
    public function __construct(private readonly BusinessContextService $context)
    {
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

        $paginator = Branch::query()
            ->when($request->user()->branch_ids, fn ($q, $ids) => $q->whereIn('id', $ids))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (Branch $branch) => Presenter::branch($branch));
    }

    public function storeBranch(Request $request)
    {
        abort_unless($request->user()->can('staff.edit') || $request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'type' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $branch = Branch::create([
            'business_id' => TenantContext::businessId(),
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'type' => $data['type'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'defaults' => ['currency' => 'NGN'],
        ]);

        return ApiResponse::success(Presenter::branch($branch), 'Branch created.');
    }

    public function updateBranch(Request $request, int $branch)
    {
        abort_unless($request->user()->can('staff.edit') || $request->user()->isSuperAdmin(), 403);

        $branch = Branch::query()->findOrFail($branch);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'type' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $branch->update($data);

        return ApiResponse::success(Presenter::branch($branch), 'Branch updated.');
    }

    public function destroyBranch(Request $request, int $branch)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $branch = Branch::query()->findOrFail($branch);
        $branch->delete();

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
            $plan = SubscriptionPlan::find($data['plan_id']) ?? SubscriptionPlan::where('slug', 'starter')->first();
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