<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Customer extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'name', 'email', 'phone', 'address', 'credit_limit', 'segment', 'tier', 'photo_url', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'float',
        ];
    }

    public function account(): HasOne
    {
        return $this->hasOne(CustomerAccount::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CustomerTransaction::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(CustomerPayment::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}