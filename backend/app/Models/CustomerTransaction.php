<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerTransaction extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'customer_id', 'business_id', 'type', 'description', 'debit', 'credit',
        'balance_after', 'reference', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'debit' => 'float',
            'credit' => 'float',
            'balance_after' => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}