<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\GoodsReceipt;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockBatch;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\DatabaseSeeder::class);
    }

    public function test_health_endpoint_and_login_return_success(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.status', 'ok');

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@demo.local',
            'password' => 'password',
        ])->assertOk();

        $token = $response->json('data.access_token') ?? $response->json('data.token');
        $this->assertNotEmpty($token);
    }

    public function test_cash_charge_completes_sale_and_reduces_stock(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 3,
        ])->assertOk();

        $reference = $cart->json('data.reference');

        $charge = $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $reference,
            'method' => 'cash',
            'cash_received' => 1000,
        ])->assertOk();

        $charge->assertJsonPath('data.status', 'completed');

        $this->assertSame(7.0, $this->balanceFor($product, $branch));

        $sale = Sale::query()->firstOrFail();
        $this->assertSame('completed', $sale->status);
        $this->assertSame('paid', $sale->payment_status);
    }

    public function test_charge_replays_when_the_same_client_request_id_is_reused(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 2,
        ])->assertOk();

        $reference = $cart->json('data.reference');
        $clientId = (string) \Illuminate\Support\Str::uuid();

        $first = $this->withHeader('X-Client-Request-Id', $clientId)->postJson('/api/v1/pos/sales/charge', [
            'reference' => $reference,
            'method' => 'cash',
            'cash_received' => 400,
        ])->assertOk();

        $second = $this->withHeader('X-Client-Request-Id', $clientId)->postJson('/api/v1/pos/sales/charge', [
            'reference' => $reference,
            'method' => 'cash',
            'cash_received' => 400,
        ]);

        $second->assertOk()->assertHeader('X-Idempotent-Replay', 'true');

        $this->assertSame(
            $first->json('data.sale.reference'),
            $second->json('data.sale.reference'),
        );
        $this->assertSame(1, Sale::query()->count());
    }

    public function test_over_selling_requires_approval_then_finance_approves(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 2);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 5,
        ])->assertOk();

        $reference = $cart->json('data.reference');

        $charge = $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $reference,
            'method' => 'cash',
            'cash_received' => 2000,
        ])->assertOk();

        $charge->assertJsonPath('data.status', 'awaiting_approval');

        $sale = Sale::query()->firstOrFail();
        $this->assertSame('awaiting_approval', $sale->status);

        $approvalId = \App\Models\SaleApproval::query()->firstOrFail()->id;

        $this->postJson("/api/v1/finance/approvals/{$approvalId}", [
            'decision' => 'approved',
        ])->assertOk();

        $this->assertSame('completed', $sale->fresh()->status);
        $this->assertSame(5.0, $this->movedOut($product, $branch));
    }

    public function test_purchasing_order_receive_increases_stock(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');

        $order = $this->postJson('/api/v1/purchasing/orders', [
            'branch_id' => $branch->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 10, 'unit_cost' => 120],
            ],
        ])->assertOk();

        $orderId = $order->json('data.id');
        $this->assertSame('draft', $order->json('data.status'));

        $this->postJson("/api/v1/purchasing/orders/{$orderId}/status", [
            'status' => 'received',
        ])->assertOk()->assertJsonPath('data.status', 'received');

        $this->assertSame(10.0, $this->balanceFor($product, $branch));
        $this->assertSame(1, GoodsReceipt::query()->count());
    }

    public function test_refund_restocks_inventory_and_marks_sale_refunded(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 4,
        ])->assertOk();

        $reference = $cart->json('data.reference');

        $charge = $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $reference,
            'method' => 'cash',
            'cash_received' => 800,
        ])->assertOk();

        $saleId = $charge->json('data.sale.id');
        $this->assertSame(6.0, $this->balanceFor($product, $branch));

        $detail = $this->getJson("/api/v1/sales/{$saleId}")->assertOk();
        $saleItemId = $detail->json('data.items.0.id');

        $this->postJson("/api/v1/sales/{$saleId}/refund", [
            'reason' => 'Damaged goods',
            'items' => [
                ['sale_item_id' => $saleItemId, 'quantity' => 4],
            ],
        ])->assertOk()->assertJsonPath('data.sale.status', 'refunded');

        $this->assertSame(10.0, $this->balanceFor($product, $branch));
    }

    public function test_writes_are_blocked_when_subscription_is_inactive(): void
    {
        $this->scene('WTR-75');

        Subscription::query()->update(['status' => 'expired', 'expires_at' => now()->subDay()->toDateString()]);

        $this->postJson('/api/v1/customers', ['name' => 'Blocked Customer'])
            ->assertStatus(402)
            ->assertJsonPath('code', 'SUBSCRIPTION_INACTIVE');
    }

    public function test_audit_log_records_sale_events_for_admin(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 5);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk();

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart->json('data.reference'),
            'method' => 'cash',
            'cash_received' => 200,
        ])->assertOk();

        $this->getJson('/api/v1/audit-logs')
            ->assertOk()
            ->assertJsonFragment(['action' => 'sale.created']);
    }

    /**
     * @return array{0: User, 1: Branch, 2: Product}
     */
    private function scene(string $sku): array
    {
        $admin = User::query()->where('email', 'admin@demo.local')->firstOrFail();
        $branch = Branch::query()->where('code', 'HQ')->firstOrFail();
        $product = Product::query()->where('sku', $sku)->firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->withHeaders(['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id]);

        return [$admin, $branch, $product];
    }

    private function ensureStock(Product $product, Branch $branch, float $quantity): void
    {
        StockBatch::create([
            'business_id' => $product->business_id,
            'branch_id' => $branch->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'batch_number' => 'TEST-'.$product->id,
            'expiry_date' => null,
            'quantity_received' => $quantity,
            'quantity_available' => $quantity,
            'cost_price' => (float) $product->cost_price,
            'status' => 'available',
        ]);

        InventoryBalance::create([
            'business_id' => $product->business_id,
            'branch_id' => $branch->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'quantity' => $quantity,
            'low_stock_threshold' => $product->low_stock_threshold,
        ]);
    }

    private function balanceFor(Product $product, Branch $branch): float
    {
        return (float) InventoryBalance::query()
            ->where('branch_id', $branch->id)
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->value('quantity');
    }

    private function movedOut(Product $product, Branch $branch): float
    {
        return (float) \App\Models\InventoryTransaction::query()
            ->where('branch_id', $branch->id)
            ->where('product_id', $product->id)
            ->where('type', 'out')
            ->sum('quantity') * -1;
    }
}
