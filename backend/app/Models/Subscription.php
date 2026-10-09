<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'plan_id',
        'status',
        'starts_at',
        'expires_at',
        'trial_ends_at',
        'grace_ends_at',
        'limits',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'expires_at' => 'date',
            'trial_ends_at' => 'date',
            'grace_ends_at' => 'date',
            'limits' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class);
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function isEffectivelyActive(): bool
    {
        return in_array($this->status, ['active', 'trial'], true);
    }

    /**
     * Shape a SubscriptionInfo payload for the API.
     */
    public function toInfo(): array
    {
        $plan = $this->plan;

        return [
            'status' => $this->status ?: 'none',
            'plan' => $plan->name ?? 'No Plan',
            'expiry_date' => $this->expires_at?->toDateString(),
            'trial_ends_at' => $this->trial_ends_at?->toDateString(),
            'limits' => $this->limits ?? $plan?->limits(),
        ];
    }

    public static function defaultLimits(): array
    {
        return [
            'staff_limit' => null,
            'branch_limit' => null,
            'product_limit' => null,
            'transaction_limit' => null,
        ];
    }
}