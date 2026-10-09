<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosCart extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'user_id', 'reference', 'customer_id', 'items',
        'currency', 'state', 'held_until', 'subtotal', 'discount_total', 'tax_total', 'total',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'held_until' => 'datetime',
            'subtotal' => 'float',
            'discount_total' => 'float',
            'tax_total' => 'float',
            'total' => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
