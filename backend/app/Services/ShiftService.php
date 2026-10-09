<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\BusinessSetting;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\Shift;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;

class ShiftService
{
    public const SETTING_ENABLED = 'shifts_enabled';

    public const SETTING_REQUIRE_RECONCILIATION = 'require_cash_reconciliation';

    public function config(): array
    {
        return [
            'shifts_enabled' => BusinessSetting::bool(self::SETTING_ENABLED, true, TenantContext::branchId()),
            'require_cash_reconciliation' => BusinessSetting::bool(self::SETTING_REQUIRE_RECONCILIATION, true, TenantContext::branchId()),
        ];
    }

    public function setConfig(bool $shiftsEnabled = null, bool $requireReconciliation = null): array
    {
        $businessId = TenantContext::businessId();
        $branchId = TenantContext::branchId();

        if ($shiftsEnabled !== null) {
            $this->store($businessId, $branchId, self::SETTING_ENABLED, $shiftsEnabled);
        }

        if ($requireReconciliation !== null) {
            $this->store($businessId, $branchId, self::SETTING_REQUIRE_RECONCILIATION, $requireReconciliation);
        }

        return $this->config();
    }

    public function current(int $userId, ?int $branchId): ?Shift
    {
        return Shift::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->latest('opened_at')
            ->first();
    }

    public function open(int $userId, int $branchId, float $openingCash = 0): Shift
    {
        $existing = Shift::query()
            ->where('user_id', $userId)
            ->where('branch_id', $branchId)
            ->where('status', 'open')
            ->first();

        if ($existing !== null) {
            throw new ApiException('SHIFT_ALREADY_OPEN', 'You already have an open shift at this branch.', 422);
        }

        return Shift::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => $branchId,
            'user_id' => $userId,
            'status' => 'open',
            'opened_at' => now(),
            'opening_cash' => round($openingCash, 2),
            'expected_cash' => round($openingCash, 2),
        ]);
    }

    public function close(Shift $shift, ?float $actualCash, ?string $notes): array
    {
        $reconciliation = $this->reconciliation($shift);

        $shift->forceFill([
            'status' => 'closed',
            'closed_at' => now(),
            'expected_cash' => $reconciliation['expected_cash'],
            'actual_cash' => $actualCash,
            'variance' => $actualCash === null ? null : round($actualCash - $reconciliation['expected_cash'], 2),
            'notes' => $notes ?? $shift->notes,
        ])->save();

        $reconciliation['actual_cash'] = (float) ($shift->actual_cash ?? 0);
        $reconciliation['variance'] = (float) ($shift->variance ?? 0);

        return [$shift->fresh(), $reconciliation];
    }

    public function reconciliation(Shift $shift): array
    {
        $from = $shift->opened_at ?? $shift->created_at ?? now()->startOfDay();
        $to = $shift->closed_at ?? now();

        $salesQuery = fn () => Sale::query()
            ->where('branch_id', $shift->branch_id)
            ->where('user_id', $shift->user_id)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->whereBetween('created_at', [$from, $to]);

        $salesTotal = (float) $salesQuery()->sum('total');
        $transactionCount = (int) $salesQuery()->count();

        $payments = Payment::query()
            ->where('branch_id', $shift->branch_id)
            ->whereIn('status', ['confirmed', 'completed'])
            ->whereBetween('created_at', [$from, $to])
            ->when($shift->user_id, fn ($q) => $q->where('created_by', $shift->user_id))
            ->groupBy('method')
            ->selectRaw('method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count')
            ->get();

        $cash = (float) ($payments->firstWhere('method', 'cash')->amount ?? 0.0);

        return [
            'expected_cash' => round((float) $shift->opening_cash + $cash, 2),
            'actual_cash' => (float) ($shift->actual_cash ?? 0),
            'variance' => round((float) ($shift->actual_cash ?? 0) - ((float) $shift->opening_cash + $cash), 2),
            'sales_total' => round($salesTotal, 2),
            'transaction_count' => $transactionCount,
            'payment_breakdown' => $payments->map(fn ($row) => [
                'method' => $row->method,
                'amount' => (float) $row->amount,
                'count' => (int) $row->count,
            ])->values()->all(),
        ];
    }

    private function store(int $businessId, ?int $branchId, string $key, bool $value): void
    {
        BusinessSetting::query()->updateOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'setting_key' => $key],
            ['value' => $value],
        );
    }
}