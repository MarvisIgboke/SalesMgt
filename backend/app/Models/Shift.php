<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'reference', 'user_id', 'closed_by', 'status',
        'assigned_user_ids', 'opened_at', 'closed_at',
        'opening_cash', 'expected_cash', 'actual_cash', 'variance',
        'opening_stock_qty', 'opening_stock_value', 'closing_stock_qty', 'closing_stock_value', 'stock_variance',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'assigned_user_ids' => 'array',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'opening_cash' => 'float',
            'expected_cash' => 'float',
            'actual_cash' => 'float',
            'variance' => 'float',
            'opening_stock_qty' => 'float',
            'opening_stock_value' => 'float',
            'closing_stock_qty' => 'float',
            'closing_stock_value' => 'float',
            'stock_variance' => 'float',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /** The Store Manager who opened the shift. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function saleSessions(): HasMany
    {
        return $this->hasMany(SaleSession::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * @return list<int>
     */
    public function assignedUserIds(): array
    {
        return array_values(array_map('intval', $this->assigned_user_ids ?? []));
    }
}
