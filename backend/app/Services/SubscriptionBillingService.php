<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use Illuminate\Support\Carbon;

class SubscriptionBillingService
{
    /**
     * Create the invoice for a business/month if it does not exist yet. Returns
     * the invoice (existing or newly created) or null when the business has no
     * subscription to bill.
     */
    public function ensureForBusiness(Business $business, mixed $period = null): ?SubscriptionInvoice
    {
        $periodStart = ($period !== null ? Carbon::parse($period) : now())->copy()->startOfMonth();

        $subscription = Subscription::withoutGlobalScope('tenant-business')
            ->with('plan')
            ->where('business_id', $business->id)
            ->latest('id')
            ->first();

        if ($subscription === null) {
            return null;
        }

        $number = $this->number($business->id, $periodStart);

        $existing = SubscriptionInvoice::withoutGlobalScope('tenant-business')
            ->where('number', $number)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return SubscriptionInvoice::withoutGlobalScope('tenant-business')->create([
            'business_id' => $business->id,
            'subscription_id' => $subscription->id,
            'number' => $number,
            'status' => 'unpaid',
            'period_start' => $periodStart->toDateString(),
            'period_end' => $periodStart->copy()->endOfMonth()->toDateString(),
            'issued_at' => now()->toDateString(),
            'due_at' => now()->toDateString(),
            'amount' => (float) ($subscription->plan?->monthly_price ?? 0),
            'currency' => $business->currency ?: ($subscription->plan?->currency ?? 'NGN'),
            'meta' => [
                'plan' => $subscription->plan?->name,
                'duration_months' => $subscription->durationMonths(),
            ],
        ]);
    }

    /**
     * Generate invoices for every business (or a single business) for a period.
     *
     * @return array<int, SubscriptionInvoice>
     */
    public function run(?string $period = null, ?int $businessId = null): array
    {
        $query = Business::query()->orderBy('id');

        if ($businessId !== null) {
            $query->whereKey($businessId);
        }

        $created = [];

        foreach ($query->get() as $business) {
            $invoice = $this->ensureForBusiness($business, $period);

            if ($invoice !== null && $invoice->wasRecentlyCreated) {
                $created[] = $invoice;
            }
        }

        return $created;
    }

    public function markPaid(
        SubscriptionInvoice $invoice,
        ?int $adminId,
        ?string $reference = null,
        ?string $note = null,
    ): SubscriptionInvoice {
        $invoice->forceFill([
            'status' => 'paid',
            'paid_at' => now(),
            'paid_by' => $adminId,
            'payment_reference' => $reference ?: $invoice->payment_reference,
            'notes' => $note ?: $invoice->notes,
        ])->save();

        $this->activate($invoice);

        return $invoice->fresh(['business', 'paidBy']);
    }

    public function markUnpaid(SubscriptionInvoice $invoice): SubscriptionInvoice
    {
        $invoice->forceFill([
            'status' => 'unpaid',
            'paid_at' => null,
            'paid_by' => null,
        ])->save();

        return $invoice->fresh(['business', 'paidBy']);
    }

    public function void(SubscriptionInvoice $invoice): SubscriptionInvoice
    {
        $invoice->forceFill(['status' => 'void'])->save();

        return $invoice->fresh(['business', 'paidBy']);
    }

    /**
     * Confirm payment by extending the subscription for one plan duration and
     * reactivating the business.
     */
    private function activate(SubscriptionInvoice $invoice): void
    {
        $subscription = $invoice->subscription
            ?? Subscription::withoutGlobalScope('tenant-business')
                ->with('plan')
                ->where('business_id', $invoice->business_id)
                ->latest('id')
                ->first();

        if ($subscription === null) {
            return;
        }

        $subscription->loadMissing('plan');

        $base = $subscription->expires_at !== null && $subscription->expires_at->isFuture()
            ? $subscription->expires_at->copy()
            : ($invoice->period_end?->copy() ?? now());

        $expires = $base->copy()->addMonthsNoOverflow($subscription->durationMonths());

        $subscription->forceFill([
            'status' => 'active',
            'starts_at' => $subscription->starts_at ?? now()->toDateString(),
            'expires_at' => $expires->toDateString(),
            'grace_ends_at' => $expires->copy()->addDays($subscription->graceDays())->toDateString(),
        ])->save();
    }

    private function number(int $businessId, \Carbon\CarbonInterface $period): string
    {
        return 'INV-'.$period->format('Ym').'-'.str_pad((string) $businessId, 4, '0', STR_PAD_LEFT);
    }
}
