<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'currency',
        'timezone',
        'logo_url',
        'address',
        'email',
        'phone',
    ];

    protected function casts(): array
    {
        return [
            'defaults' => 'array',
        ];
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function subscription()
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function wallet()
    {
        return $this->hasOne(Wallet::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public static function defaultCurrency(): string
    {
        return 'NGN';
    }
}