<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'sale_id', 'customer_id', 'reference', 'method',
        'amount', 'split', 'status', 'bank_reference', 'match_result', 'cash_received',
        'change_due', 'client_request_id', 'created_by', 'confirmed_by', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'split' => 'array',
            'match_result' => 'array',
            'cash_received' => 'float',
            'change_due' => 'float',
            'confirmed_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}