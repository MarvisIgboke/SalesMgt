<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Wallet extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'currency',
        'balance',
        'pending',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'float',
            'pending' => 'float',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    public function toInfo(): array
    {
        return [
            'balance' => $this->balance,
            'currency' => $this->currency,
            'pending' => $this->pending,
        ];
    }
}