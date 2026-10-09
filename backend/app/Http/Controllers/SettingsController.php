<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Business;
use App\Models\BusinessSetting;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    private const BUSINESS_FIELDS = ['name', 'currency', 'timezone', 'address', 'email', 'phone', 'logo_url'];

    private const DEFAULT_PREFERENCES = [
        'push_notifications' => true,
        'sound_on_sale' => true,
        'offline_mode' => true,
        'reduce_motion' => false,
        'low_stock_alerts' => true,
        'expiry_alerts' => true,
    ];

    public function show(Request $request)
    {
        $this->authorize($request);

        return ApiResponse::success($this->payload());
    }

    public function update(Request $request)
    {
        $this->authorize($request);

        $input = $request->all();

        $businessPayload = array_intersect_key($input, array_flip(self::BUSINESS_FIELDS));
        if ($businessPayload !== []) {
            Business::query()->whereKey(TenantContext::businessId())->update($businessPayload);
        }

        $preferenceInput = array_merge(
            is_array($input['preferences'] ?? null) ? $input['preferences'] : [],
            array_diff_key($input, array_flip(self::BUSINESS_FIELDS), ['preferences' => true]),
        );

        if ($preferenceInput !== []) {
            $existing = BusinessSetting::locate('preferences') ?? new BusinessSetting([
                'business_id' => TenantContext::businessId(),
                'branch_id' => null,
                'setting_key' => 'preferences',
            ]);

            $merged = array_merge((array) ($existing->value ?? []), $preferenceInput);
            $existing->value = $merged;
            $existing->save();
        }

        AuditLog::record('settings.updated', 'business', TenantContext::businessId(), ['keys' => array_keys($input)]);

        return ApiResponse::success($this->payload(), 'Settings updated.');
    }

    public function preferences(Request $request)
    {
        $this->authorize($request);

        return ApiResponse::success($this->presentPreferences());
    }

    private function payload(): array
    {
        $business = Business::query()->find(TenantContext::businessId());

        $settings = BusinessSetting::query()
            ->whereNull('branch_id')
            ->get()
            ->mapWithKeys(fn (BusinessSetting $setting) => [$setting->setting_key => $setting->value])
            ->all();

        return [
            'business' => [
                'id' => $business?->id,
                'name' => $business?->name,
                'currency' => $business?->currency,
                'timezone' => $business?->timezone,
                'address' => $business?->address,
                'email' => $business?->email,
                'phone' => $business?->phone,
                'logo_url' => $business?->logo_url,
            ],
            'preferences' => $this->presentPreferences(),
            'settings' => $settings,
        ];
    }

    private function presentPreferences(): array
    {
        $stored = BusinessSetting::value('preferences');

        return array_merge(self::DEFAULT_PREFERENCES, is_array($stored) ? $stored : []);
    }

    private function authorize(Request $request): void
    {
        $user = $request->user();

        if ($user->can('wallet.manage') || $user->can('staff.permissions') || $user->can('audit.view')) {
            return;
        }

        abort(403);
    }
}
