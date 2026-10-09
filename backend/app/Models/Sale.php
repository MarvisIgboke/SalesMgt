<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'reference', 'client_request_id', 'customer_id',
        'user_id', 'status', 'subtotal', 'discount_total', 'tax_total', 'total',
        'currency', 'payment_status', 'paid_amount', 'change_due', 'requires_approval',
        'approval_state', 'held_until', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'float',
            'discount_total' => 'float',
            'tax_total' => 'float',
            'total' => 'float',
            'paid_amount' => 'float',
            'change_due' => 'float',
            'requires_approval' => 'boolean',
            'approval_state' => 'array',
            'held_until' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}