<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\SubscriptionAllocation;
use App\Models\User;

class AllocationService
{
    /**
     * Fetch (or lazily create) the allocation for a business. The first time a
     * business is seen the current active branches/staff are pre-selected, capped
     * to the plan limits, and the branch/user active flags are synchronised.
     */
    public function forBusiness(int $businessId): SubscriptionAllocation
    {
        $allocation = SubscriptionAllocation::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->first();

        if ($allocation !== null) {
            return $allocation;
        }

        [$branchIds, $userIds] = $this->defaults($businessId);

        $allocation = SubscriptionAllocation::withoutGlobalScope('tenant-business')->create([
            'business_id' => $businessId,
            'subscription_id' => $this->subscription($businessId)?->id,
            'branch_ids' => $branchIds,
            'user_ids' => $userIds,
            'allocated_at' => now(),
        ]);

        $this->apply($businessId, $branchIds, $userIds);

        return $allocation;
    }

    /**
     * Persist a new selection and toggle the underlying branch/user active flags
     * so anything outside the allocation is disabled.
     */
    public function sync(int $businessId, array $branchIds, array $userIds): SubscriptionAllocation
    {
        $branchIds = $this->normaliseIds($branchIds);
        $userIds = $this->normaliseIds($userIds);

        $validBranches = Branch::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->pluck('id')
            ->map('intval')
            ->all();

        $validUsers = User::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->pluck('id')
            ->map('intval')
            ->all();

        $branchIds = array_values(array_intersect($branchIds, $validBranches));
        $userIds = array_values(array_intersect($userIds, $validUsers));

        // Business administrators always retain access, even unselected.
        $admins = $this->adminUserIds($businessId);
        $userIds = array_values(array_unique(array_merge($userIds, $admins)));

        $subscription = $this->subscription($businessId);
        $this->assertWithinLimit('branch_limit', count($branchIds), $subscription);
        $this->assertWithinLimit('staff_limit', count($userIds), $subscription);

        $allocation = SubscriptionAllocation::withoutGlobalScope('tenant-business')->updateOrCreate(
            ['business_id' => $businessId],
            [
                'subscription_id' => $subscription?->id,
                'branch_ids' => $branchIds,
                'user_ids' => $userIds,
                'allocated_at' => now(),
            ],
        );

        $this->apply($businessId, $branchIds, $userIds);

        return $allocation->fresh();
    }

    public function allowsBranch(int $businessId, int $branchId): bool
    {
        $allocation = $this->find($businessId);

        return $allocation === null || $allocation->allowsBranch($branchId);
    }

    public function allowsUser(int $businessId, int $userId): bool
    {
        $allocation = $this->find($businessId);

        return $allocation === null || $allocation->allowsUser($userId);
    }

    public function find(int $businessId): ?SubscriptionAllocation
    {
        return SubscriptionAllocation::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->first();
    }

    /**
     * Include a newly created branch in an existing allocation so it is not
     * immediately disabled by the sync logic.
     */
    public function attachBranch(int $businessId, int $branchId): void
    {
        $allocation = $this->find($businessId);

        if ($allocation === null) {
            return;
        }

        $ids = $allocation->branchIds();

        if (! in_array($branchId, $ids, true)) {
            $ids[] = $branchId;
            $allocation->forceFill(['branch_ids' => array_values($ids)])->save();
        }
    }

    /**
     * Include a newly created staff member in an existing allocation.
     */
    public function attachUser(int $businessId, int $userId): void
    {
        $allocation = $this->find($businessId);

        if ($allocation === null) {
            return;
        }

        $ids = $allocation->userIds();

        if (! in_array($userId, $ids, true)) {
            $ids[] = $userId;
            $allocation->forceFill(['user_ids' => array_values($ids)])->save();
        }
    }

    /**
     * Rich payload for the resource allocation page.
     */
    public function summary(int $businessId): array
    {
        $allocation = $this->forBusiness($businessId);
        $subscription = $this->subscription($businessId);

        $branches = Branch::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'type' => $branch->type,
                'is_active' => (bool) $branch->is_active,
                'allocated' => $allocation->allowsBranch((int) $branch->id),
            ])
            ->values()
            ->all();

        $admins = $this->adminUserIds($businessId);

        $users = User::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
                'allocated' => $allocation->allowsUser((int) $user->id),
                'locked' => in_array((int) $user->id, $admins, true),
                'roles' => $user->relationLoaded('roles')
                    ? $user->roles->pluck('name')->values()->all()
                    : $user->getRoleNames()->values()->all(),
            ])
            ->values()
            ->all();

        return [
            'plan' => [
                'name' => $subscription?->plan?->name ?? 'No Plan',
                'status' => $subscription?->status ?? 'none',
                'expires_at' => $subscription?->expires_at?->toDateString(),
                'duration_months' => $subscription?->durationMonths(),
                'grace_days' => $subscription?->graceDays(),
            ],
            'limits' => [
                'branch_limit' => $subscription?->limit('branch_limit'),
                'staff_limit' => $subscription?->limit('staff_limit'),
            ],
            'usage' => [
                'branches' => count($branches),
                'branches_allocated' => count($allocation->branchIds()),
                'staff' => count($users),
                'staff_allocated' => count($allocation->userIds()),
            ],
            'branches' => $branches,
            'users' => $users,
            'allocated_at' => $allocation->allocated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array{0: array<int>, 1: array<int>}
     */
    private function defaults(int $businessId): array
    {
        $subscription = $this->subscription($businessId);

        $branchIds = Branch::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id')
            ->map('intval')
            ->all();

        $userIds = User::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id')
            ->map('intval')
            ->all();

        $admins = $this->adminUserIds($businessId);

        $branchLimit = $subscription?->limit('branch_limit');
        $staffLimit = $subscription?->limit('staff_limit');

        if ($branchLimit !== null) {
            $branchIds = array_slice($branchIds, 0, max(0, $branchLimit));
        }

        if ($staffLimit !== null) {
            $userIds = array_slice($userIds, 0, max(0, $staffLimit));
        }

        $userIds = array_values(array_unique(array_merge($userIds, $admins)));

        return [$branchIds, $userIds];
    }

    private function apply(int $businessId, array $branchIds, array $userIds): void
    {
        Branch::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->get()
            ->each(function (Branch $branch) use ($branchIds) {
                $should = in_array((int) $branch->id, $branchIds, true);
                if ((bool) $branch->is_active !== $should) {
                    $branch->forceFill(['is_active' => $should])->save();
                }
            });

        $admins = $this->adminUserIds($businessId);

        User::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->get()
            ->each(function (User $user) use ($userIds, $admins) {
                if (in_array((int) $user->id, $admins, true)) {
                    return;
                }

                $should = in_array((int) $user->id, $userIds, true);
                if ((bool) $user->is_active !== $should) {
                    $user->forceFill(['is_active' => $should])->save();
                }
            });
    }

    /**
     * @return array<int>
     */
    private function adminUserIds(int $businessId): array
    {
        return User::withoutGlobalScope('tenant-business')
            ->where('business_id', $businessId)
            ->get()
            ->filter(fn (User $user) => $user->isSuperAdmin() || $user->hasRole('Business Admin'))
            ->pluck('id')
            ->map('intval')
            ->values()
            ->all();
    }

    private function subscription(int $businessId): ?Subscription
    {
        return Subscription::withoutGlobalScope('tenant-business')
            ->with('plan')
            ->where('business_id', $businessId)
            ->latest('id')
            ->first();
    }

    private function assertWithinLimit(string $key, int $count, ?Subscription $subscription): void
    {
        $limit = $subscription?->limit($key);

        if ($limit !== null && $count > $limit) {
            $label = $key === 'branch_limit' ? 'branches' : 'staff accounts';

            throw new ApiException(
                'ALLOCATION_LIMIT',
                sprintf('Your plan allows at most %d %s. Deselect %d to continue.', $limit, $label, $count - $limit),
                422,
            );
        }
    }

    /**
     * @param array<int, mixed> $ids
     * @return array<int>
     */
    private function normaliseIds(array $ids): array
    {
        return array_values(array_unique(array_map('intval', array_filter($ids, fn ($id) => $id !== null && $id !== ''))));
    }
}
