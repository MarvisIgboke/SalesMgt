<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoodsReceiptItem extends Model
{
    protected $fillable = [
        'goods_receipt_id', 'product_id', 'variant_id', 'quantity',
        'cost_price', 'batch_number', 'expiry_date',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'cost_price' => 'float',
            'expiry_date' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
