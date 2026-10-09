<?php

namespace App\Support;

final class TenantContext
{
    private static ?int $businessId = null;

    private static ?int $branchId = null;

    public static function setBusinessId(?int $businessId): void
    {
        self::$businessId = $businessId;
    }

    public static function setBranchId(?int $branchId): void
    {
        self::$branchId = $branchId;
    }

    public static function businessId(): ?int
    {
        return self::$businessId;
    }

    public static function branchId(): ?int
    {
        return self::$branchId;
    }

    public static function hasBusiness(): bool
    {
        return self::$businessId !== null;
    }

    public static function hasBranch(): bool
    {
        return self::$branchId !== null;
    }

    public static function reset(): void
    {
        self::$businessId = null;
        self::$branchId = null;
    }
}