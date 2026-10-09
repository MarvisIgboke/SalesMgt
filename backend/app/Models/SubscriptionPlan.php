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
        'product_limit',
        'transaction_limit',
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
            'product_limit' => 'integer',
            'transaction_limit' => 'integer',
            'monthly_price' => 'float',
            'quarterly_price' => 'float',
            'annual_price' => 'float',
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
            'product_limit' => $this->product_limit,
            'transaction_limit' => $this->transaction_limit,
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
            'product_limit' => $this->product_limit,
            'transaction_limit' => $this->transaction_limit,
            'monthly_price' => $this->monthly_price,
            'quarterly_price' => $this->quarterly_price,
            'annual_price' => $this->annual_price,
            'currency' => $this->currency,
            'features' => $this->features ?? [],
        ];
    }
}