<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class BusinessSetting extends Model
{
    use BelongsToBusiness;

    protected $table = 'business_settings';

    protected $fillable = [
        'business_id',
        'branch_id',
        'setting_key',
        'value',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'json',
        ];
    }

    public static function locate(string $key, ?int $branchId = null): ?self
    {
        return static::query()
            ->where('setting_key', $key)
            ->where('branch_id', $branchId)
            ->first();
    }

    public static function value(string $key, int $branchId = null): mixed
    {
        $query = static::query()
            ->where('branch_id', $branchId)
            ->where('setting_key', $key);
        if ($branchId === null) {
            $query->whereNull('branch_id');
        }

        $setting = $query->first();

        return $setting->value ?? null;
    }

    public static function bool(string $key, bool $default = false, ?int $branchId = null): bool
    {
        $value = static::value($key, $branchId);

        return $value === null ? $default : (bool) $value;
    }
}