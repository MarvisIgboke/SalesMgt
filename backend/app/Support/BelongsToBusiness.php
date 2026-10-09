<?php

namespace App\Support;

trait BelongsToBusiness
{
    protected static function bootBelongsToBusiness(): void
    {
        static::addGlobalScope('tenant-business', function ($builder) {
            if (! TenantContext::hasBusiness()) {
                return;
            }

            $builder->where((new static)->qualifyColumn('business_id'), TenantContext::businessId());
        });
    }

    public function business(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(\App\Models\Business::class);
    }
}