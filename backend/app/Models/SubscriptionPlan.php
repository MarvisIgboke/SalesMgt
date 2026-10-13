<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'description',
        'staff_limit',
        'branch_limit',
        'duration_months',
        'monthly_price',
        'quarterly_price',
        'annual_price',
        'currency',
        'grace_days',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'staff_limit' => 'integer',
            'branch_limit' => 'integer',
            'duration_months' => 'integer',
            'monthly_price' => 'decimal:2',
            'quarterly_price' => 'decimal:2',
            'annual_price' => 'decimal:2',
            'grace_days' => 'integer',
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function limits(): array
    {
        return [
            'staff_limit' => $this->staff_limit,
            'branch_limit' => $this->branch_limit,
            'duration_months' => $this->duration_months,
        ];
    }

    public function toInfo(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'staff_limit' => $this->staff_limit,
            'branch_limit' => $this->branch_limit,
            'duration_months' => $this->duration_months,
            'monthly_price' => $this->monthly_price,
            'quarterly_price' => $this->quarterly_price,
            'annual_price' => $this->annual_price,
            'currency' => $this->currency,
            'grace_days' => $this->grace_days,
            'features' => $this->features ?? [],
            'is_active' => $this->is_active,
            'limits' => $this->limits(),
        ];
    }
}
