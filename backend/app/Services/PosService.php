<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\InventoryBalance;
use App\Models\Payment;
use App\Models\PosCart;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleApproval;
use App\Models\StockBatch;
use App\Models\User;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class PosService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly CustomerLedgerService $ledger,
        private readonly RiskService $risk,
    ) {
    }

    public function search(string $term, ?int $branchId, int $perPage): LengthAwarePaginator
    {
        $query = Product::query()
            ->where('is_active', true)
            ->with(['brand', 'category', 'unit', 'barcodes', 'variants.barcodes']);

        if ($term !== '') {
            $like = '%'.$term.'%';
            $query->where(fn ($x) => $x->where('name', 'like', $like)
                ->orWhere('sku', 'like', $like)
                ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', $like))
                ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $like))
                ->orWhereHas('barcodes', fn ($bc) => $bc->where('barcode', 'like', $like))
                ->orWhereHas('variants', fn ($v) => $v->where('name', 'like', $like)->orWhere('sku', 'like', $like))
                ->orWhereHas('variants.barcodes', fn ($bc) => $bc->where('barcode', 'like', $like)));
        }

        $paginator = $query->orderBy('name')->paginate($perPage);

        $mapped = collect($paginator->items())
            ->map(fn (Product $product) => $this->presentProduct($product, $branchId))
            ->all();

        return $paginator->setCollection(collect($mapped));
    }

    public function productForBarcode(string $barcode, ?int $branchId): array
    {
        $match = ProductBarcode::query()
            ->with(['product.brand', 'product.category', 'product.unit', 'product.barcodes', 'product.variants.barcodes'])
            ->where('barcode', $barcode)
            ->first();

        if ($match === null || $match->product === null) {
            throw new ApiException('not_found', 'No product matches that barcode.', 404);
        }

        return $this->presentProduct($match->product, $branchId);
    }

    public function stockFor(int $branchId, int $productId, ?int $variantId): float
    {
        return (float) InventoryBalance::query()
            ->where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->where('variant_id', $variantId)
            ->sum('quantity');
    }

    public function presentProduct(Product $product, ?int $branchId): array
    {
        $requiresExpiry = (bool) $product->requires_expiry;

        $variants = $product->relationLoaded('variants')
            ? $product->variants->map(function (ProductVariant $variant) use ($branchId, $requiresExpiry) {
                $stock = $branchId === null ? 0.0 : $this->stockFor($branchId, (int) $variant->product_id, (int) $variant->id);
                $warning = $branchId === null ? null : $this->expiryWarning($branchId, (int) $variant->product_id, (int) $variant->id);

                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'sku' => $variant->sku ?? '',
                    'barcode' => $variant->relationLoaded('barcodes') ? $variant->barcodes->first()?->barcode : null,
                    'price' => (float) $variant->selling_price,
                    'cost_price' => (float) $variant->cost_price,
                    'stock_qty' => $stock,
                    'is_sellable' => $variant->is_active && $stock > 0 && ! ($requiresExpiry && ($warning['status'] ?? 'ok') === 'expired'),
                    'reason' => $this->sellableReason($stock, $warning, $requiresExpiry),
                ];
            })->values()->all()
            : [];

        if ($product->has_variants && $variants !== []) {
            $stock = array_sum(array_column($variants, 'stock_qty'));
            $warning = null;
            foreach ($variants as $variant) {
                $vWarning = $branchId === null ? null : $this->expiryWarning($branchId, (int) $product->id, (int) $variant['id']);
                if ($vWarning !== null && ($warning === null || ($vWarning['days'] ?? 999) < ($warning['days'] ?? 999))) {
                    $warning = $vWarning;
                }
            }
        } else {
            $stock = $branchId === null ? 0.0 : $this->stockFor($branchId, (int) $product->id, null);
            $warning = $branchId === null ? null : $this->expiryWarning($branchId, (int) $product->id, null);
        }

        return [
            'id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku ?? '',
            'brand' => $product->brand?->name,
            'category' => $product->category?->name,
            'unit' => $product->unit?->name,
            'image_url' => $product->image_url,
            'price' => (float) $product->selling_price,
            'cost_price' => (float) $product->cost_price,
            'discount' => 0.0,
            'tax_rate' => (float) $product->tax_rate,
            'stock_qty' => $stock,
            'low_stock_threshold' => $product->low_stock_threshold === null ? null : (float) $product->low_stock_threshold,
            'is_sellable' => $product->is_active && $stock > 0 && ! ($requiresExpiry && ($warning['status'] ?? 'ok') === 'expired'),
            'reason' => $this->sellableReason($stock, $warning, $requiresExpiry),
            'requires_expiry' => $requiresExpiry,
            'expiry_warning' => $warning,
            'variants' => $variants,
        ];
    }

    private function sellableReason(float $stock, ?array $warning, bool $requiresExpiry): ?string
    {
        if ($stock <= 0) {
            return 'Out of stock';
        }
        if ($requiresExpiry && ($warning['status'] ?? 'ok') === 'expired') {
            return 'Expired batch';
        }

        return null;
    }

    private function expiryWarning(int $branchId, int $productId, ?int $variantId): ?array
    {
        $batch = StockBatch::query()
            ->where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->where('variant_id', $variantId)
            ->where('quantity_available', '>', 0)
            ->whereNotNull('expiry_date')
            ->orderBy('expiry_date')
            ->first();

        if ($batch === null) {
            return null;
        }

        $days = $batch->daysRemaining();
        $status = match (true) {
            $days !== null && $days < 0 => 'expired',
            $days !== null && $days <= 14 => 'expiring_soon',
            default => 'ok',
        };

        return [
            'status' => $status,
            'days' => $days,
            'message' => match ($status) {
                'expired' => 'This batch has expired.',
                'expiring_soon' => $days === 0 ? 'Expires today.' : "Expires in {$days} day(s).",
                default => 'Fresh stock.',
            },
        ];
    }

    public function resolveCart(?string $reference, User $user, ?int $branchId): PosCart
    {
        if ($reference !== null && $reference !== '') {
            $cart = PosCart::query()->where('reference', $reference)->first();
            if ($cart !== null && $cart->state !== 'converted') {
                return $cart;
            }
        }

        $resolvedBranch = $branchId
            ?? TenantContext::branchId()
            ?? (is_array($user->branch_ids) ? ($user->branch_ids[0] ?? null) : null);

        if ($resolvedBranch === null) {
            throw new ApiException('branch_required', 'Select a branch before starting a sale.', 422);
        }

        return PosCart::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => (int) $resolvedBranch,
            'user_id' => $user->id,
            'reference' => 'CART-'.now()->format('ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
            'customer_id' => null,
            'items' => [],
            'currency' => 'NGN',
            'state' => 'active',
        ]);
    }

    public function presentCart(PosCart $cart, ?User $user = null): array
    {
        $customer = $cart->customer_id ? Customer::query()->with('account')->find($cart->customer_id) : null;
        $items = [];
        $reasons = [];
        $warnings = [];

        foreach ($cart->items ?? [] as $line) {
            $stock = $cart->branch_id === null ? 0.0 : $this->stockFor((int) $cart->branch_id, (int) $line['product_id'], $line['variant_id'] ?? null);
            $warning = $cart->branch_id === null ? null : $this->expiryWarning((int) $cart->branch_id, (int) $line['product_id'], $line['variant_id'] ?? null);

            $lineReasons = [];
            if ((float) $line['quantity'] > $stock) {
                $lineReasons[] = 'Insufficient stock';
                $warnings[] = ['code' => 'insufficient_stock', 'message' => "{$line['product_name']}: only {$stock} in stock."];
            }
            if ($warning !== null && $warning['status'] === 'expired') {
                $lineReasons[] = 'Expired batch';
                $warnings[] = ['code' => 'expired_batch', 'message' => "{$line['product_name']}: batch expired."];
            }

            $items[] = [
                'id' => (int) $line['id'],
                'product_id' => (int) $line['product_id'],
                'variant_id' => $line['variant_id'] ?? null,
                'product_name' => $line['product_name'],
                'variant_name' => $line['variant_name'] ?? null,
                'sku' => $line['sku'] ?? '',
                'quantity' => (float) $line['quantity'],
                'unit_price' => (float) $line['unit_price'],
                'discount' => (float) ($line['discount'] ?? 0),
                'tax' => (float) ($line['tax'] ?? 0),
                'line_total' => (float) ($line['line_total'] ?? 0),
                'stock_qty' => $stock,
                'stock_warning' => (float) $line['quantity'] > $stock ? "Only {$stock} in stock" : null,
                'expiry_warning' => $warning !== null && $warning['status'] !== 'ok' ? $warning['message'] : null,
                'requires_approval' => $lineReasons !== [],
                'approval_reasons' => $lineReasons,
            ];

            foreach ($lineReasons as $reason) {
                $reasons[$reason] = true;
            }
        }

        $credit = 0.0;
        if ($customer !== null) {
            $credit = (float) ($customer->account->balance ?? 0);
        }

        return [
            'reference' => $cart->reference,
            'customer_id' => $cart->customer_id,
            'items' => $items,
            'subtotal' => (float) $cart->subtotal,
            'discount_total' => (float) $cart->discount_total,
            'tax_total' => (float) $cart->tax_total,
            'total' => (float) $cart->total,
            'currency' => $cart->currency,
            'customer_credit' => round($credit, 2),
            'requires_approval' => $reasons !== [],
            'approval_reasons' => array_keys($reasons),
            'warnings' => $warnings,
        ];
    }

    public function addItem(PosCart $cart, int $productId, ?int $variantId, float $quantity): PosCart
    {
        if ($quantity <= 0) {
            throw new ApiException('validation_error', 'Quantity must be greater than zero.', 422);
        }

        $product = Product::query()->with('variants')->findOrFail($productId);
        if (! $product->is_active) {
            throw new ApiException('not_sellable', 'This product is not available for sale.', 422);
        }

        $variant = null;
        if ($variantId !== null) {
            $variant = $product->variants->firstWhere('id', $variantId);
            if ($variant === null) {
                throw new ApiException('not_found', 'Variant not found for this product.', 404);
            }
        }

        $price = (float) ($variant?->selling_price ?? $product->selling_price);
        $taxRate = (float) $product->tax_rate;

        $items = $cart->items ?? [];
        $matched = false;
        foreach ($items as &$line) {
            if ((int) $line['product_id'] === $productId && ($line['variant_id'] ?? null) === $variantId) {
                $line['quantity'] = round((float) $line['quantity'] + $quantity, 3);
                $matched = true;
                break;
            }
        }
        unset($line);

        if (! $matched) {
            $nextId = 1;
            foreach ($items as $line) {
                $nextId = max($nextId, ((int) $line['id']) + 1);
            }

            $items[] = [
                'id' => $nextId,
                'product_id' => $productId,
                'variant_id' => $variantId,
                'product_name' => $product->name,
                'variant_name' => $variant?->name,
                'sku' => $variant?->sku ?? $product->sku ?? '',
                'quantity' => round($quantity, 3),
                'unit_price' => $price,
                'tax_rate' => $taxRate,
                'discount' => 0.0,
                'tax' => 0.0,
                'line_total' => 0.0,
            ];
        }

        $cart->items = $items;
        $this->recompute($cart);

        return $cart->fresh();
    }

    public function updateItem(PosCart $cart, int $lineId, float $quantity): PosCart
    {
        $items = $cart->items ?? [];

        foreach ($items as $index => $line) {
            if ((int) $line['id'] === $lineId) {
                if ($quantity <= 0) {
                    unset($items[$index]);
                } else {
                    $items[$index]['quantity'] = round($quantity, 3);
                }
                break;
            }
        }

        $cart->items = array_values($items);
        $this->recompute($cart);

        return $cart->fresh();
    }

    public function removeItem(PosCart $cart, int $lineId): PosCart
    {
        $cart->items = array_values(array_filter($cart->items ?? [], fn ($line) => (int) $line['id'] !== $lineId));
        $this->recompute($cart);

        return $cart->fresh();
    }

    public function setCustomer(PosCart $cart, ?int $customerId): PosCart
    {
        if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
            throw new ApiException('not_found', 'Customer not found.', 404);
        }

        $cart->customer_id = $customerId;
        $cart->save();

        return $cart->fresh();
    }

    public function hold(PosCart $cart): PosCart
    {
        $cart->forceFill([
            'state' => 'held',
            'held_until' => now()->addMinutes(30),
        ])->save();

        return $cart->fresh();
    }

    public function resume(PosCart $cart): PosCart
    {
        $cart->forceFill(['state' => 'active', 'held_until' => null])->save();

        return $cart->fresh();
    }

    /**
     * @return array{status: string, sale: ?Sale, message: ?string}
     */
    public function charge(PosCart $cart, array $input, User $user, ?string $clientRequestId): array
    {
        $items = $cart->items ?? [];
        if ($items === []) {
            throw new ApiException('empty_cart', 'The cart is empty.', 422);
        }

        $method = (string) ($input['method'] ?? 'cash');
        $total = round((float) $cart->total, 2);
        $customer = $cart->customer_id ? Customer::query()->with('account')->find($cart->customer_id) : null;

        $requiresApproval = $this->cartRequiresApproval($cart);
        $approvalKind = 'inventory';

        if ($method === 'credit') {
            if ($customer === null) {
                throw new ApiException('customer_required', 'A credit sale requires a customer.', 422);
            }
            $limit = $customer->credit_limit === null ? null : (float) $customer->credit_limit;
            $balance = (float) ($customer->account->balance ?? 0);
            if ($limit !== null && ($balance + $total) > $limit) {
                $requiresApproval = true;
                $approvalKind = 'credit';
            }
        }

        $result = DB::transaction(function () use ($cart, $items, $input, $user, $clientRequestId, $method, $total, $customer, $requiresApproval, $approvalKind) {
            $sale = Sale::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $cart->branch_id,
                'reference' => 'SAL-'.now()->format('ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'client_request_id' => $clientRequestId,
                'customer_id' => $cart->customer_id,
                'user_id' => $user->id,
                'status' => $requiresApproval ? 'awaiting_approval' : 'completed',
                'subtotal' => $cart->subtotal,
                'discount_total' => $cart->discount_total,
                'tax_total' => $cart->tax_total,
                'total' => $total,
                'currency' => $cart->currency,
                'payment_status' => $requiresApproval ? 'pending' : ($method === 'credit' ? 'credit' : 'paid'),
                'paid_amount' => $requiresApproval ? 0 : ($method === 'credit' ? 0 : $total),
                'change_due' => 0,
                'requires_approval' => $requiresApproval,
                'approval_state' => $requiresApproval ? ['status' => 'pending', 'kind' => $approvalKind, 'method' => $method] : null,
                'notes' => $input['notes'] ?? null,
            ]);

            if ($requiresApproval) {
                foreach ($items as $line) {
                    $sale->items()->create($this->saleItemAttributes($line, (float) ($line['unit_price'] ?? 0) * 0));
                }

                SaleApproval::create([
                    'sale_id' => $sale->id,
                    'kind' => $approvalKind,
                    'status' => 'pending',
                    'reason' => 'Sale requires approval.',
                ]);

                $cart->forceFill(['state' => 'converted'])->save();

                return [
                    'status' => 'awaiting_approval',
                    'sale' => $sale->fresh(['items', 'customer', 'branch', 'user']),
                    'message' => 'This sale is awaiting approval.',
                ];
            }

            foreach ($items as $line) {
                $quantity = (float) $line['quantity'];
                $cost = $this->inventory->consumeFefo(
                    (int) $cart->branch_id,
                    (int) $line['product_id'],
                    $line['variant_id'] ?? null,
                    $quantity,
                    'out',
                    (string) $sale->reference,
                    $user->id,
                );

                $sale->items()->create($this->saleItemAttributes($line, $quantity > 0 ? round($cost / $quantity, 2) : 0));
            }

            $paymentStatus = $this->settle($sale, $method, $input, $total, $user, $customer);
            $sale->forceFill(['payment_status' => $paymentStatus, 'paid_amount' => $method === 'credit' ? 0 : $total])->save();

            $cart->forceFill(['state' => 'converted'])->save();

            return [
                'status' => 'completed',
                'sale' => $sale->fresh(['items', 'customer', 'branch', 'user', 'payments']),
                'message' => 'Sale completed.',
            ];
        });

        $sale = $result['sale'];

        if ($sale !== null) {
            AuditLog::record('sale.created', 'sale', $sale->id, [
                'reference' => $sale->reference,
                'status' => $sale->status,
                'total' => (float) $sale->total,
                'requires_approval' => (bool) $sale->requires_approval,
            ]);

            $this->risk->evaluateSale($sale, $customer, $method);
        }

        return $result;
    }

    private function cartRequiresApproval(PosCart $cart): bool
    {
        foreach ($cart->items ?? [] as $line) {
            $stock = $cart->branch_id === null ? 0.0 : $this->stockFor((int) $cart->branch_id, (int) $line['product_id'], $line['variant_id'] ?? null);
            if ((float) $line['quantity'] > $stock) {
                return true;
            }
        }

        return false;
    }

    private function saleItemAttributes(array $line, float $costPrice): array
    {
        return [
            'product_id' => (int) $line['product_id'],
            'variant_id' => $line['variant_id'] ?? null,
            'name' => $line['product_name'],
            'variant_name' => $line['variant_name'] ?? null,
            'sku' => $line['sku'] ?? null,
            'quantity' => (float) $line['quantity'],
            'unit_price' => (float) $line['unit_price'],
            'cost_price' => $costPrice,
            'discount' => (float) ($line['discount'] ?? 0),
            'tax' => (float) ($line['tax'] ?? 0),
            'line_total' => (float) ($line['line_total'] ?? 0),
        ];
    }

    private function settle(Sale $sale, string $method, array $input, float $total, User $user, ?Customer $customer): string
    {
        if ($method === 'credit') {
            $this->ledger->charge($customer, $total, 'Credit sale '.$sale->reference, $sale->reference, 'charge');

            return 'credit';
        }

        $base = [
            'business_id' => TenantContext::businessId(),
            'branch_id' => $sale->branch_id,
            'sale_id' => $sale->id,
            'customer_id' => $sale->customer_id,
            'reference' => ReferenceGenerator::make('PAY'),
            'status' => 'confirmed',
            'client_request_id' => $sale->client_request_id,
            'created_by' => $user->id,
            'confirmed_by' => $user->id,
            'confirmed_at' => now(),
        ];

        if ($method === 'split') {
            $split = $input['split'] ?? [];
            $splitTotal = array_sum(array_map(fn ($part) => (float) ($part['amount'] ?? 0), $split));
            if ($splitTotal < $total) {
                throw new ApiException('insufficient_payment', 'Split payments do not cover the sale total.', 422);
            }

            Payment::create($base + ['method' => 'split', 'amount' => $total, 'split' => $split]);

            return 'paid';
        }

        if ($method === 'cash') {
            $cashReceived = isset($input['cash_received']) ? (float) $input['cash_received'] : $total;
            if ($cashReceived < $total) {
                throw new ApiException('insufficient_payment', 'Cash received is less than the amount due.', 422);
            }

            $change = round($cashReceived - $total, 2);
            Payment::create($base + ['method' => 'cash', 'amount' => $total, 'cash_received' => $cashReceived, 'change_due' => $change]);
            $sale->forceFill(['change_due' => $change])->save();

            return 'paid';
        }

        Payment::create($base + ['method' => $method, 'amount' => $total, 'bank_reference' => $input['bank_reference'] ?? null]);

        return 'paid';
    }

    public function receipt(Sale $sale): array
    {
        $sale->loadMissing(['items', 'customer', 'branch', 'user', 'payments']);

        $items = $sale->items->map(fn ($item) => [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'variant_id' => $item->variant_id,
            'product_name' => $item->name,
            'variant_name' => $item->variant_name,
            'sku' => $item->sku ?? '',
            'quantity' => (float) $item->quantity,
            'unit_price' => (float) $item->unit_price,
            'discount' => (float) $item->discount,
            'tax' => (float) $item->tax,
            'line_total' => (float) $item->line_total,
            'stock_qty' => 0,
            'stock_warning' => null,
            'expiry_warning' => null,
            'requires_approval' => false,
            'approval_reasons' => [],
        ])->values()->all();

        $paymentMethods = $sale->payments->map(fn (Payment $payment) => [
            'method' => $payment->method,
            'amount' => (float) $payment->amount,
        ])->values()->all();

        if ($paymentMethods === []) {
            $paymentMethods[] = ['method' => $sale->payment_status === 'credit' ? 'credit' : 'cash', 'amount' => (float) $sale->total];
        }

        return [
            'business_name' => $sale->branch?->business?->name ?? 'Business',
            'branch_name' => $sale->branch?->name ?? 'Branch',
            'receipt_number' => 'RCP-'.str_pad((string) $sale->id, 6, '0', STR_PAD_LEFT),
            'sale_reference' => $sale->reference,
            'customer_name' => $sale->customer?->name,
            'staff_name' => $sale->user?->name ?? 'Staff',
            'items' => $items,
            'subtotal' => (float) $sale->subtotal,
            'discount_total' => (float) $sale->discount_total,
            'tax_total' => (float) $sale->tax_total,
            'total' => (float) $sale->total,
            'amount_paid' => (float) $sale->paid_amount,
            'change_due' => (float) $sale->change_due,
            'payment_status' => $sale->payment_status,
            'payment_methods' => $paymentMethods,
            'created_at' => $sale->created_at?->toIso8601String(),
            'qr_verification' => [
                'payload' => implode('|', [$sale->reference, number_format((float) $sale->total, 2, '.', ''), substr(sha1($sale->reference.'|'.$sale->id), 0, 12)]),
            ],
        ];
    }

    private function recompute(PosCart $cart): void
    {
        $items = $cart->items ?? [];
        $subtotal = 0.0;
        $discount = 0.0;
        $tax = 0.0;

        foreach ($items as &$line) {
            $lineSubtotal = round((float) $line['unit_price'] * (float) $line['quantity'], 2);
            $lineTax = round($lineSubtotal * ((float) ($line['tax_rate'] ?? 0) / 100), 2);
            $lineDiscount = (float) ($line['discount'] ?? 0);

            $line['tax'] = $lineTax;
            $line['line_total'] = round($lineSubtotal - $lineDiscount + $lineTax, 2);

            $subtotal += $lineSubtotal;
            $discount += $lineDiscount;
            $tax += $lineTax;
        }
        unset($line);

        $cart->items = $items;
        $cart->subtotal = round($subtotal, 2);
        $cart->discount_total = round($discount, 2);
        $cart->tax_total = round($tax, 2);
        $cart->total = round($subtotal - $discount + $tax, 2);
        $cart->save();
    }
}
