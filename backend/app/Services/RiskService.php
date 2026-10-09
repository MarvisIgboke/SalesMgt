<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\RiskFlag;
use App\Models\Sale;
use App\Support\TenantContext;

class RiskService
{
    /**
     * Evaluate a freshly-created sale and raise any applicable risk flags.
     */
    public function evaluateSale(Sale $sale, ?Customer $customer, string $method): array
    {
        $subtotal = (float) $sale->subtotal;
        $discount = (float) $sale->discount_total;
        $total = (float) $sale->total;
        $raised = [];

        if ($subtotal > 0 && $discount > 0 && ($discount / $subtotal) >= 0.2) {
            $raised[] = $this->flag(
                level: 'medium',
                type: 'large_discount',
                description: sprintf('Discount of %.0f%% applied to %s.', ($discount / $subtotal) * 100, $sale->reference),
                payload: ['sale_id' => $sale->id, 'discount' => $discount, 'subtotal' => $subtotal],
                branchId: $sale->branch_id,
                userId: $sale->user_id,
            );
        }

        if ($total >= 100000) {
            $raised[] = $this->flag(
                level: 'high',
                type: 'high_value_sale',
                description: sprintf('High-value sale %s totalling %.2f.', $sale->reference, $total),
                payload: ['sale_id' => $sale->id, 'total' => $total],
                branchId: $sale->branch_id,
                userId: $sale->user_id,
            );
        }

        if ($method === 'credit' && $customer !== null && $customer->credit_limit !== null) {
            $balance = (float) ($customer->account->balance ?? 0);

            if (($balance + $total) > (float) $customer->credit_limit) {
                $raised[] = $this->flag(
                    level: 'high',
                    type: 'credit_limit_exceeded',
                    description: sprintf('Credit sale %s pushes the balance above the customer limit.', $sale->reference),
                    payload: ['sale_id' => $sale->id, 'balance' => $balance, 'limit' => (float) $customer->credit_limit, 'total' => $total],
                    branchId: $sale->branch_id,
                    userId: $sale->user_id,
                );
            }
        }

        $hour = (int) now()->format('G');

        if ($hour < 6 || $hour >= 22) {
            $raised[] = $this->flag(
                level: 'low',
                type: 'after_hours_sale',
                description: sprintf('Sale %s recorded outside normal trading hours.', $sale->reference),
                payload: ['sale_id' => $sale->id, 'hour' => $hour],
                branchId: $sale->branch_id,
                userId: $sale->user_id,
            );
        }

        return array_values(array_filter($raised));
    }

    public function flag(
        string $level,
        string $type,
        string $description,
        array $payload = [],
        ?int $branchId = null,
        ?int $userId = null,
    ): ?RiskFlag {
        $businessId = TenantContext::businessId();

        if ($businessId === null) {
            return null;
        }

        $exists = RiskFlag::query()
            ->where('type', $type)
            ->where('status', 'open')
            ->where('description', $description)
            ->exists();

        if ($exists) {
            return null;
        }

        return RiskFlag::create([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'user_id' => $userId,
            'level' => $level,
            'type' => $type,
            'description' => $description,
            'payload' => $payload === [] ? null : $payload,
            'status' => 'open',
        ]);
    }
}
