<?php

namespace App\Support;

use App\Models\Branch;
use App\Models\Business;
use App\Models\BusinessSetting;

final class ReceiptSettings
{
    public const KEY = 'receipt';

    public const PAPER_WIDTHS = ['58mm', '80mm', 'a4'];

    public const DEFAULTS = [
        'name' => null,
        'address' => null,
        'phone' => null,
        'email' => null,
        'logo_url' => null,
        'header' => null,
        'footer' => null,
        'tax_id' => null,
        'show_logo' => true,
        'show_address' => true,
        'show_phone' => true,
        'show_email' => false,
        'show_tax_breakdown' => true,
        'show_cashier' => true,
        'show_customer' => true,
        'show_qr' => true,
        'show_datetime' => true,
        'round_off' => false,
        'paper_width' => '80mm',
    ];

    /**
     * Keys that are free-text (null when blank).
     */
    private const TEXT_KEYS = ['name', 'address', 'phone', 'email', 'logo_url', 'header', 'footer', 'tax_id'];

    /**
     * Keys that are boolean toggles.
     *
     * @var list<string>
     */
    private const BOOL_KEYS = [
        'show_logo',
        'show_address',
        'show_phone',
        'show_email',
        'show_tax_breakdown',
        'show_cashier',
        'show_customer',
        'show_qr',
        'show_datetime',
        'round_off',
    ];

    /**
     * Resolve the stored configuration, layering a branch override over the
     * business-wide value and finally the defaults.
     */
    public static function resolve(?int $branchId): array
    {
        $business = BusinessSetting::value(self::KEY, null);
        $branch = $branchId !== null ? BusinessSetting::value(self::KEY, $branchId) : null;

        return array_merge(
            self::DEFAULTS,
            is_array($business) ? $business : [],
            is_array($branch) ? $branch : [],
        );
    }

    /**
     * Fill blank fields with the business / branch record so the receipt always
     * has sensible contact details even before an admin customises them.
     */
    public static function effective(array $config, Business $business, ?Branch $branch): array
    {
        return array_merge($config, [
            'name' => ($config['name'] ?? null) ?: $business->name,
            'address' => ($config['address'] ?? null) ?: ($branch?->address ?: $business->address),
            'phone' => ($config['phone'] ?? null) ?: ($branch?->phone ?: $business->phone),
            'email' => ($config['email'] ?? null) ?: $business->email,
            'logo_url' => ($config['logo_url'] ?? null) ?: $business->logo_url,
        ]);
    }

    /**
     * Keep only recognised keys and coerce them to their canonical types.
     */
    public static function sanitize(array $input): array
    {
        $out = [];

        foreach (self::TEXT_KEYS as $key) {
            if (array_key_exists($key, $input)) {
                $value = is_string($input[$key]) ? trim($input[$key]) : $input[$key];
                $out[$key] = ($value === '' ? null : $value);
            }
        }

        foreach (self::BOOL_KEYS as $key) {
            if (array_key_exists($key, $input)) {
                $out[$key] = filter_var($input[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

        if (array_key_exists('paper_width', $input)) {
            $width = (string) $input['paper_width'];
            $out['paper_width'] = in_array($width, self::PAPER_WIDTHS, true) ? $width : self::DEFAULTS['paper_width'];
        }

        return $out;
    }
}
