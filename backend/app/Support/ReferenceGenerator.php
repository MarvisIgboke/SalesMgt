<?php

namespace App\Support;

final class ReferenceGenerator
{
    public static function make(string $prefix): string
    {
        $date = now()->format('ymd');
        $random = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        return sprintf('%s-%s-%s', $prefix, $date, $random);
    }

    public static function receipt(string $saleReference): string
    {
        return 'RCP-'.str_replace(['-', '_'], '', $saleReference).'-'.now()->format('His');
    }

    public static function notificationType(string $group): string
    {
        return strtolower($group);
    }
}