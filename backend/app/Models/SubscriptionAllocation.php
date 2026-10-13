<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionAllocation extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'subscription_id',
        'branch_ids',
        'user_ids',
        'allocated_at',
    ];

    protected function casts(): array
    {
        return [
            'branch_ids' => 'array',
            'user_ids' => 'array',
            'allocated_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function branchIds(): array
    {
        return array_values(array_map('intval', $this->branch_ids ?? []));
    }

    public function userIds(): array
    {
        return array_values(array_map('intval', $this->user_ids ?? []));
    }

    public function allowsBranch(int $branchId): bool
    {
        return in_array($branchId, $this->branchIds(), true);
    }

    public function allowsUser(int $userId): bool
    {
        return in_array($userId, $this->userIds(), true);
    }
}
