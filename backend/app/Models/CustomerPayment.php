<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerPayment extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'customer_id', 'business_id', 'amount', 'method', 'reference', 'notes', 'status', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}