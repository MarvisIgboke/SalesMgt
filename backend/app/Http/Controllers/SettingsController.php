<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Business;
use App\Models\BusinessSetting;
use App\Support\ApiResponse;
use App\Support\ReceiptSettings;
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

    public function receipt(Request $request)
    {
        $this->authorizeReceipt($request);

        return ApiResponse::success($this->presentReceipt());
    }

    public function updateReceipt(Request $request)
    {
        $this->authorizeReceipt($request);

        $input = $request->validate([
            'config' => ['required', 'array'],
            'branch_id' => ['nullable', 'integer'],
            'scope' => ['nullable', 'in:business,branch'],
        ]);

        $scope = $input['scope'] ?? 'branch';

        $businessId = TenantContext::businessId();
        $branchId = null;

        if ($scope === 'branch') {
            $branchId = $input['branch_id'] ?? TenantContext::branchId();

            if ($branchId !== null) {
                $exists = Branch::query()
                    ->where('id', $branchId)
                    ->where('business_id', $businessId)
                    ->exists();

                if (! $exists) {
                    abort(422, 'The selected branch does not belong to this business.');
                }
            }
        }

        $config = ReceiptSettings::sanitize($input['config']);

        $setting = BusinessSetting::locate(ReceiptSettings::KEY, $branchId) ?? new BusinessSetting([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'setting_key' => ReceiptSettings::KEY,
        ]);

        $setting->value = $config;
        $setting->save();

        AuditLog::record('settings.receipt_updated', 'business', $businessId, [
            'branch_id' => $branchId,
            'keys' => array_keys($config),
        ]);

        return ApiResponse::success($this->presentReceipt(), 'Receipt settings updated.');
    }

    private function presentReceipt(): array
    {
        $business = Business::query()->find(TenantContext::businessId());
        $branchId = TenantContext::branchId();
        $branch = $branchId !== null ? Branch::query()->find($branchId) : null;

        $config = ReceiptSettings::resolve($branchId);

        return [
            'scope' => $branch !== null ? 'branch' : 'business',
            'branch_id' => $branch?->id,
            'branch_name' => $branch?->name,
            'business' => [
                'id' => $business?->id,
                'name' => $business?->name,
                'currency' => $business?->currency,
            ],
            'defaults' => [
                'name' => $business?->name,
                'address' => $branch?->address ?: $business?->address,
                'phone' => $branch?->phone ?: $business?->phone,
                'email' => $business?->email,
                'logo_url' => $business?->logo_url,
            ],
            'config' => $config,
            'paper_widths' => ReceiptSettings::PAPER_WIDTHS,
        ];
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

    private function authorizeReceipt(Request $request): void
    {
        $user = $request->user();

        if ($user->can('settings.receipt') || $user->can('staff.permissions') || $user->can('wallet.manage')) {
            return;
        }

        abort(403);
    }
}
