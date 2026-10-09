<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierAccount extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['supplier_id', 'business_id', 'balance'];

    protected function casts(): array
    {
        return ['balance' => 'float'];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}