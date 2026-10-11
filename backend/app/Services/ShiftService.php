<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\BusinessSetting;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Sale;
use App\Models\Shift;
use App\Models\ShiftCashMovement;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

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
        [$from, $to] = $this->window($shift);

        $payments = $this->payments($shift, $from, $to);

        $cash = (float) $payments->get('cash');
        $digital = $payments->get('digital');

        $refundsTotal = $this->refunds($shift, $from, $to)['total'];
        $dropsTotal = ShiftCashMovement::query()->where('shift_id', $shift->id)->where('type', 'drop')->sum('amount');
        $payoutsTotal = ShiftCashMovement::query()->where('shift_id', $shift->id)->where('type', 'payout')->sum('amount');

        $expected = round((float) $shift->opening_cash + $cash - $refundsTotal - (float) $dropsTotal - (float) $payoutsTotal, 2);

        $salesQuery = fn () => Sale::query()
            ->where('branch_id', $shift->branch_id)
            ->where('user_id', $shift->user_id)
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->whereBetween('created_at', [$from, $to]);

        $salesTotal = (float) $salesQuery()->sum('total');
        $transactionCount = (int) $salesQuery()->count();

        return [
            'expected_cash' => $expected,
            'actual_cash' => (float) ($shift->actual_cash ?? 0),
            'variance' => round((float) ($shift->actual_cash ?? 0) - $expected, 2),
            'sales_total' => round($salesTotal, 2),
            'transaction_count' => $transactionCount,
            'refunds_total' => round($refundsTotal, 2),
            'drops_total' => round((float) $dropsTotal, 2),
            'payouts_total' => round((float) $payoutsTotal, 2),
            'expected_drawer' => $expected,
            'payment_breakdown' => $this->paymentBreakdown($shift, $from, $to),
        ];
    }

    /**
     * Full drawer detail for a till session: KPIs, live drawer journal and movement ledger.
     */
    public function detail(Shift $shift): array
    {
        [$from, $to] = $this->window($shift);

        $cashPayments = $this->cashPayments($shift, $from, $to);
        $cashSum = (float) $cashPayments->sum('amount');
        $cashCount = $cashPayments->count();

        $digitalPayments = $this->digitalPayments($shift, $from, $to);
        $digitalSum = (float) $digitalPayments->sum('amount');
        $digitalCount = $digitalPayments->count();

        $refunds = $this->refunds($shift, $from, $to);
        $refundsTotal = (float) $refunds['total'];

        $movements = ShiftCashMovement::query()
            ->with('creator')
            ->where('shift_id', $shift->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $drops = $movements->where('type', 'drop')->values();
        $payouts = $movements->where('type', 'payout')->values();
        $dropsTotal = (float) $drops->sum('amount');
        $payoutsTotal = (float) $payouts->sum('amount');

        $expected = round((float) $shift->opening_cash + $cashSum - $refundsTotal - $dropsTotal - $payoutsTotal, 2);

        $reconciliation = $this->reconciliation($shift);

        return [
            'business_id' => (int) $shift->business_id,
            'id' => (int) $shift->id,
            'branch_id' => (int) $shift->branch_id,
            'branch_name' => $shift->branch?->name ?? '',
            'branch_code' => $shift->branch?->code ?? '',
            'terminal' => $this->terminalFor($shift),
            'user_id' => (int) $shift->user_id,
            'user_name' => $shift->user?->name ?? '',
            'user_role' => $this->roleFor($shift->user),
            'status' => $shift->status,
            'opened_at' => $shift->opened_at?->toIso8601String() ?? $shift->created_at?->toIso8601String(),
            'closed_at' => $shift->closed_at?->toIso8601String(),
            'opening_cash' => (float) $shift->opening_cash,
            'expected_cash' => (float) $shift->expected_cash,
            'actual_cash' => $shift->actual_cash === null ? null : (float) $shift->actual_cash,
            'variance' => $shift->variance === null ? null : (float) $shift->variance,
            'notes' => $shift->notes,
            'supervisor' => $this->supervisorFor($shift->branch_id),
            'kpis' => [
                'opening_float' => (float) $shift->opening_cash,
                'gross_cash_sales' => round($cashSum, 2),
                'cash_transactions' => $cashCount,
                'net_cash_sales' => round($cashSum - $refundsTotal, 2),
                'digital_pos' => round($digitalSum, 2),
                'digital_transactions' => $digitalCount,
                'refunds_total' => round($refundsTotal, 2),
                'drops_total' => round($dropsTotal, 2),
                'payouts_total' => round($payoutsTotal, 2),
                'gross_sales' => round($reconciliation['sales_total'], 2),
                'sales_transactions' => $reconciliation['transaction_count'],
                'expected_drawer' => $expected,
            ],
            'reconciliation' => $reconciliation,
            'journal' => $this->journal(
                $from,
                (float) $shift->opening_cash,
                $cashSum,
                $cashCount,
                $cashPayments->pluck('created_at')->sort()->values(),
                $refunds,
                $drops,
                $payouts,
                $expected,
            ),
            'movements' => $movements->map(fn (ShiftCashMovement $movement) => $this->presentMovement($movement))->values()->all(),
        ];
    }

    public function recordMovement(Shift $shift, string $type, float $amount, ?string $reason, int $userId): ShiftCashMovement
    {
        if ($shift->status !== 'open') {
            throw new ApiException('SHIFT_CLOSED', 'Cash movements can only be recorded on an open shift.', 422);
        }

        $movement = ShiftCashMovement::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => $shift->branch_id,
            'shift_id' => $shift->id,
            'type' => $type,
            'amount' => round($amount, 2),
            'reason' => $reason,
            'created_by' => $userId,
        ]);

        $code = $type === 'drop' ? 'DRP' : 'PAY';
        $movement->forceFill(['reference' => $code.'-'.str_pad((string) $movement->id, 6, '0', STR_PAD_LEFT)])->save();

        return $movement;
    }

    private function window(Shift $shift): array
    {
        $from = $shift->opened_at ?? $shift->created_at ?? now()->startOfDay();
        $to = $shift->closed_at ?? now();

        return [$from, $to];
    }

    private function payments(Shift $shift, Carbon $from, Carbon $to): Collection
    {
        $rows = $this->confirmedPayments($shift, $from, $to)->get();

        return collect([
            'cash' => (float) $rows->where('method', 'cash')->sum('amount'),
            'digital' => (float) $rows->where('method', '!=', 'cash')->sum('amount'),
        ]);
    }

    private function cashPayments(Shift $shift, Carbon $from, Carbon $to): Collection
    {
        return $this->confirmedPayments($shift, $from, $to)
            ->where('method', 'cash')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
    }

    private function digitalPayments(Shift $shift, Carbon $from, Carbon $to): Collection
    {
        return $this->confirmedPayments($shift, $from, $to)
            ->where('method', '!=', 'cash')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
    }

    private function confirmedPayments(Shift $shift, Carbon $from, Carbon $to)
    {
        return Payment::query()
            ->where('branch_id', $shift->branch_id)
            ->whereIn('status', ['confirmed', 'completed'])
            ->whereBetween('created_at', [$from, $to])
            ->when($shift->user_id, fn ($q) => $q->where('created_by', $shift->user_id))
            ->select('id', 'method', 'amount', 'reference', 'created_at');
    }

    private function paymentBreakdown(Shift $shift, Carbon $from, Carbon $to): array
    {
        $rows = Payment::query()
            ->where('branch_id', $shift->branch_id)
            ->whereIn('status', ['confirmed', 'completed'])
            ->whereBetween('created_at', [$from, $to])
            ->when($shift->user_id, fn ($q) => $q->where('created_by', $shift->user_id))
            ->groupBy('method')
            ->selectRaw('method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count')
            ->get();

        return $rows->map(fn ($row) => [
            'method' => $row->method,
            'amount' => (float) $row->amount,
            'count' => (int) $row->count,
        ])->values()->all();
    }

    private function refunds(Shift $shift, Carbon $from, Carbon $to): array
    {
        $rows = Refund::query()
            ->where('branch_id', $shift->branch_id)
            ->where('status', 'approved')
            ->whereBetween('created_at', [$from, $to])
            ->when($shift->user_id, fn ($q) => $q->where('created_by', $shift->user_id))
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return [
            'total' => (float) $rows->sum('total'),
            'count' => $rows->count(),
            'rows' => $rows,
        ];
    }

    private function journal(
        Carbon $from,
        float $opening,
        float $cashSum,
        int $cashCount,
        Collection $cashTimes,
        array $refunds,
        Collection $drops,
        Collection $payouts,
        float $expected,
    ): array {
        $events = [];

        $events[] = [
            'id' => 'open',
            'kind' => 'opening',
            'label' => 'Shift Opening Float',
            'signed_amount' => round($opening, 2),
            'happened_at' => $from->toIso8601String(),
            'reference' => null,
            'note' => null,
        ];

        if ($cashSum > 0) {
            $first = $cashTimes->first() ?? $from;
            $events[] = [
                'id' => 'cash-sales',
                'kind' => 'cash_sales',
                'label' => 'Cash Sales',
                'signed_amount' => round($cashSum, 2),
                'happened_at' => Carbon::parse($first)->toIso8601String(),
                'reference' => null,
                'note' => $cashCount.' txn',
            ];
        }

        if ($refunds['total'] > 0) {
            $lastRefund = $refunds['rows']->last();
            $events[] = [
                'id' => 'refunds',
                'kind' => 'refund',
                'label' => 'Counter Cash Refund',
                'signed_amount' => -round((float) $refunds['total'], 2),
                'happened_at' => $lastRefund ? $lastRefund->created_at?->toIso8601String() : $from->toIso8601String(),
                'reference' => $lastRefund?->reference,
                'note' => $refunds['count'].' refund'.($refunds['count'] === 1 ? '' : 's'),
            ];
        }

        foreach ($drops as $drop) {
            $events[] = $this->movementEvent($drop, 'drop');
        }

        foreach ($payouts as $payout) {
            $events[] = $this->movementEvent($payout, 'payout');
        }

        $balance = 0.0;

        foreach ($events as $index => $event) {
            $balance = round($balance + (float) $event['signed_amount'], 2);
            $events[$index]['balance'] = $balance;
        }

        return $events;
    }

    private function movementEvent(ShiftCashMovement $movement, string $kind): array
    {
        return [
            'id' => 'mov-'.$movement->id,
            'kind' => $kind,
            'label' => $movement->type === 'drop' ? 'Vault Safe Drop' : 'Paid Out / Petty',
            'signed_amount' => -round((float) $movement->amount, 2),
            'happened_at' => $movement->created_at?->toIso8601String(),
            'reference' => $movement->reference,
            'note' => $movement->reason ?? ($movement->creator?->name ?? null),
        ];
    }

    private function presentMovement(ShiftCashMovement $movement): array
    {
        return [
            'id' => (int) $movement->id,
            'type' => $movement->type,
            'amount' => (float) $movement->amount,
            'reference' => $movement->reference,
            'reason' => $movement->reason,
            'user_name' => $movement->creator?->name,
            'created_at' => $movement->created_at?->toIso8601String(),
        ];
    }

    private function supervisorFor(int $branchId): ?array
    {
        $supervisor = User::query()
            ->role('Store Manager')
            ->where('is_active', true)
            ->get()
            ->first(fn (User $user) => in_array($branchId, $user->branch_ids ?? [], true));

        if ($supervisor === null) {
            return null;
        }

        return [
            'id' => (int) $supervisor->id,
            'name' => $supervisor->name,
            'role' => $this->roleFor($supervisor),
            'email' => $supervisor->email,
        ];
    }

    private function roleFor(?User $user): string
    {
        return $user?->getRoleNames()->first() ?? 'Staff';
    }

    private function terminalFor(Shift $shift): string
    {
        $code = strtoupper((string) ($shift->branch?->code ?: (string) $shift->branch_id));
        $pad = str_pad((string) $shift->branch_id, 2, '0', STR_PAD_LEFT);

        return 'TERM-'.$code.'-'.$pad;
    }

    private function store(int $businessId, ?int $branchId, string $key, bool $value): void
    {
        BusinessSetting::query()->updateOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'setting_key' => $key],
            ['value' => $value],
        );
    }
}