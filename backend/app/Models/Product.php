<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'department_id',
        'name',
        'sku',
        'category_id',
        'brand_id',
        'unit_id',
        'image_url',
        'cost_price',
        'selling_price',
        'tax_rate',
        'requires_expiry',
        'expiry_date',
        'is_active',
        'has_variants',
        'low_stock_threshold',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'float',
            'selling_price' => 'float',
            'tax_rate' => 'float',
            'requires_expiry' => 'boolean',
            'expiry_date' => 'date',
            'is_active' => 'boolean',
            'has_variants' => 'boolean',
            'low_stock_threshold' => 'float',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function barcodes(): HasMany
    {
        return $this->hasMany(ProductBarcode::class);
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function toApi(bool $withVariants = true): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku ?? '',
            'brand' => $this->brand?->name,
            'category' => $this->category?->name,
            'department_id' => $this->department_id,
            'department' => $this->relationLoaded('department') ? $this->department?->name : null,
            'unit' => $this->unit?->name,
            'image_url' => $this->image_url,
            'barcodes' => $this->relationLoaded('barcodes')
                ? $this->barcodes->pluck('barcode')->values()->all()
                : [],
            'cost_price' => $this->cost_price,
            'selling_price' => $this->selling_price,
            'tax_rate' => $this->tax_rate,
            'low_stock_threshold' => $this->low_stock_threshold === null ? null : (float) $this->low_stock_threshold,
            'requires_expiry' => $this->requires_expiry,
            'expiry_date' => $this->expiry_date?->toDateString(),
            'is_active' => $this->is_active,
            'has_variants' => $this->has_variants,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($withVariants) {
            $data['variants'] = $this->relationLoaded('variants')
                ? $this->variants->map(fn (ProductVariant $variant) => [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'sku' => $variant->sku ?? '',
                    'barcodes' => $variant->relationLoaded('barcodes')
                        ? $variant->barcodes->pluck('barcode')->values()->all()
                        : [],
                    'cost_price' => $variant->cost_price,
                    'selling_price' => $variant->selling_price,
                    'is_active' => $variant->is_active,
                ])->values()->all()
                : [];
        }

        return $data;
    }
}