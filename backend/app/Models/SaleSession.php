<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleSession extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'shift_id', 'user_id', 'closed_by', 'reference', 'status',
        'opened_at', 'closed_at',
        'opening_balance', 'closing_amount', 'expected_cash', 'variance',
        'opening_stock_qty', 'opening_stock_value', 'closing_stock_qty', 'closing_stock_value', 'stock_variance',
        'sales_total', 'sales_count', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'opening_balance' => 'float',
            'closing_amount' => 'float',
            'expected_cash' => 'float',
            'variance' => 'float',
            'opening_stock_qty' => 'float',
            'opening_stock_value' => 'float',
            'closing_stock_qty' => 'float',
            'closing_stock_value' => 'float',
            'stock_variance' => 'float',
            'sales_total' => 'float',
            'sales_count' => 'integer',
        ];
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /** The Sales Representative who owns this sale session. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(ShiftCashMovement::class);
    }
}
