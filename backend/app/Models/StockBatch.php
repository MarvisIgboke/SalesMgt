<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBatch extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'product_id', 'variant_id', 'supplier_id',
        'batch_number', 'manufacturing_date', 'expiry_date', 'quantity_received',
        'quantity_available', 'cost_price', 'status',
    ];

    protected function casts(): array
    {
        return [
            'manufacturing_date' => 'date',
            'expiry_date' => 'date',
            'quantity_received' => 'float',
            'quantity_available' => 'float',
            'cost_price' => 'float',
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

    public function daysRemaining(): ?int
    {
        if ($this->expiry_date === null) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($this->expiry_date->startOfDay(), false);
    }

    public function expiryStatus(): string
    {
        $days = $this->daysRemaining();

        if ($days === null) {
            return 'healthy';
        }

        return match (true) {
            $days < 0 => 'expired',
            $days <= 3 => 'critical',
            $days <= 14 => 'warning',
            $days <= 30 => 'watch',
            default => 'healthy',
        };
    }
}