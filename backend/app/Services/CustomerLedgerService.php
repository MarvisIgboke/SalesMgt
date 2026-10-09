<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Customer;
use App\Models\CustomerAccount;
use App\Models\CustomerPayment;
use App\Models\CustomerTransaction;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerLedgerService
{
    public function account(Customer $customer): CustomerAccount
    {
        return CustomerAccount::query()->firstOrCreate(
            ['customer_id' => $customer->id],
            ['business_id' => TenantContext::businessId(), 'balance' => 0],
        );
    }

    /**
     * Increase what the customer owes (a credit sale / charge).
     */
    public function charge(Customer $customer, float $amount, string $description, ?string $reference = null, string $type = 'charge'): CustomerTransaction
    {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            throw new ApiException('INVALID_AMOUNT', 'The charge amount must be greater than zero.', 422);
        }

        return DB::transaction(function () use ($customer, $amount, $description, $reference, $type) {
            $account = $this->lockAccount($customer);
            $account->balance = round((float) $account->balance + $amount, 2);
            $account->save();

            return CustomerTransaction::create([
                'customer_id' => $customer->id,
                'business_id' => TenantContext::businessId(),
                'type' => $type,
                'description' => $description,
                'debit' => $amount,
                'credit' => 0,
                'balance_after' => $account->balance,
                'reference' => $reference,
                'created_by' => auth()->id(),
            ]);
        });
    }

    /**
     * Record a customer payment and reduce their outstanding balance.
     *
     * @return array{0: CustomerPayment, 1: CustomerTransaction}
     */
    public function recordPayment(Customer $customer, float $amount, string $method, ?string $reference = null, ?string $notes = null): array
    {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            throw new ApiException('INVALID_AMOUNT', 'The payment amount must be greater than zero.', 422);
        }

        return DB::transaction(function () use ($customer, $amount, $method, $reference, $notes) {
            $account = $this->lockAccount($customer);

            $payment = CustomerPayment::create([
                'customer_id' => $customer->id,
                'business_id' => TenantContext::businessId(),
                'amount' => $amount,
                'method' => $method,
                'reference' => $reference ?? ReferenceGenerator::make('CPAY'),
                'notes' => $notes,
                'status' => 'confirmed',
                'recorded_by' => auth()->id(),
            ]);

            $account->balance = round((float) $account->balance - $amount, 2);
            $account->save();

            $transaction = CustomerTransaction::create([
                'customer_id' => $customer->id,
                'business_id' => TenantContext::businessId(),
                'type' => 'payment',
                'description' => 'Payment received'.($notes ? ': '.$notes : ''),
                'debit' => 0,
                'credit' => $amount,
                'balance_after' => $account->balance,
                'reference' => $payment->reference,
                'created_by' => auth()->id(),
            ]);

            return [$payment, $transaction];
        });
    }

    public function statement(Customer $customer, ?string $from = null, ?string $to = null): array
    {
        $base = CustomerTransaction::query()->where('customer_id', $customer->id);

        $opening = (float) (clone $base)
            ->when($from, fn ($q) => $q->where('created_at', '<', Carbon::parse($from)->startOfDay()))
            ->selectRaw('COALESCE(SUM(debit - credit), 0) AS opening')
            ->value('opening');

        $entries = (clone $base)
            ->when($from, fn ($q) => $q->where('created_at', '>=', Carbon::parse($from)->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', Carbon::parse($to)->endOfDay()))
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $charges = (float) $entries->sum('debit');
        $payments = (float) $entries->sum('credit');

        return [
            'customer_id' => $customer->id,
            'opening_balance' => round($opening, 2),
            'charges' => round($charges, 2),
            'payments' => round($payments, 2),
            'closing_balance' => round($opening + $charges - $payments, 2),
            'entries' => $entries->map(fn (CustomerTransaction $entry) => [
                'id' => $entry->id,
                'date' => $entry->created_at?->toIso8601String(),
                'description' => $entry->description ?? ucfirst($entry->type),
                'debit' => (float) $entry->debit,
                'credit' => (float) $entry->credit,
                'balance' => (float) $entry->balance_after,
            ])->values()->all(),
        ];
    }

    private function lockAccount(Customer $customer): CustomerAccount
    {
        $account = CustomerAccount::query()
            ->where('customer_id', $customer->id)
            ->lockForUpdate()
            ->first();

        if ($account === null) {
            $account = CustomerAccount::create([
                'customer_id' => $customer->id,
                'business_id' => TenantContext::businessId(),
                'balance' => 0,
            ]);
        }

        return $account;
    }
}