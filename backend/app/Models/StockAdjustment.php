<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'product_id', 'variant_id', 'quantity',
        'balance_before', 'balance_after', 'reason', 'status', 'created_by',
        'decided_by', 'decided_at', 'decision_notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'balance_before' => 'float',
            'balance_after' => 'float',
            'decided_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
