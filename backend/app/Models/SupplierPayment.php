<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierPayment extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'supplier_id', 'business_id', 'purchase_order_id', 'invoice_id',
        'amount', 'method', 'reference', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}