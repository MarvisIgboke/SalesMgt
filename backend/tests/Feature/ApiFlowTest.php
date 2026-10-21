<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\GoodsReceipt;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Shift;
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

    public function test_held_sales_can_be_listed_and_resumed_to_complete(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $held = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 2,
        ])->assertOk();
        $heldReference = $held->json('data.reference');

        $this->postJson('/api/v1/pos/sales/hold', ['reference' => $heldReference])
            ->assertOk()
            ->assertJsonPath('data.reference', $heldReference);

        $this->assertDatabaseHas('pos_carts', [
            'reference' => $heldReference,
            'state' => 'held',
        ]);

        $next = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk();
        $this->assertNotSame($heldReference, $next->json('data.reference'));

        $list = $this->getJson('/api/v1/pos/sales/held')->assertOk();
        $this->assertCount(1, $list->json('data.carts'));
        $this->assertSame($heldReference, $list->json('data.carts.0.reference'));

        $resumed = $this->postJson('/api/v1/pos/sales/resume', ['reference' => $heldReference])
            ->assertOk()
            ->assertJsonPath('data.reference', $heldReference);
        $this->assertSame(2.0, (float) $resumed->json('data.items.0.quantity'));

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $heldReference,
            'method' => 'cash',
            'cash_received' => 1000,
        ])->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('pos_carts', [
            'reference' => $heldReference,
            'state' => 'converted',
        ]);
    }

    public function test_holding_an_empty_cart_is_rejected(): void
    {
        $this->scene('WTR-75');

        $cart = $this->postJson('/api/v1/pos/sales/initialize', [])->assertOk();

        $this->postJson('/api/v1/pos/sales/hold', [
            'reference' => $cart->json('data.reference'),
        ])->assertStatus(422)->assertJsonPath('code', 'empty_cart');
    }

    public function test_a_held_sale_cannot_be_resumed_by_another_user(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $held = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk();
        $heldReference = $held->json('data.reference');

        $this->postJson('/api/v1/pos/sales/hold', ['reference' => $heldReference])->assertOk();

        $cashier = User::query()->where('email', 'cashier@demo.local')->firstOrFail();
        $this->actingAs($cashier, 'sanctum');

        $this->postJson('/api/v1/pos/sales/resume', ['reference' => $heldReference])
            ->assertStatus(404)
            ->assertJsonPath('code', 'not_found');

        $this->getJson('/api/v1/pos/sales/held')
            ->assertOk()
            ->assertJsonCount(0, 'data.carts');
    }

    public function test_a_sale_can_only_be_resumed_once_while_held(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        $held = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk();
        $heldReference = $held->json('data.reference');

        $this->postJson('/api/v1/pos/sales/hold', ['reference' => $heldReference])->assertOk();
        $this->postJson('/api/v1/pos/sales/resume', ['reference' => $heldReference])->assertOk();

        $this->postJson('/api/v1/pos/sales/resume', ['reference' => $heldReference])
            ->assertStatus(422)
            ->assertJsonPath('code', 'not_held');
    }

    public function test_charge_is_blocked_when_no_shift_is_open(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 10);

        Shift::withoutGlobalScopes()
            ->where('reference', 'SHF-TEST-'.$branch->id)
            ->update(['status' => 'closed', 'closed_at' => now()]);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk();

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart->json('data.reference'),
            'method' => 'cash',
            'cash_received' => 200,
        ])->assertStatus(422)->assertJsonPath('code', 'NO_OPEN_SHIFT');

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(10.0, $this->balanceFor($product, $branch));
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

    public function test_over_selling_is_blocked_when_stock_is_insufficient(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 2);

        $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 5,
        ])->assertStatus(422)->assertJsonPath('code', 'insufficient_stock');

        $this->assertSame(0, Sale::query()->count());
        $this->assertSame(2.0, $this->balanceFor($product, $branch));
    }

    public function test_selling_all_stock_then_further_sale_is_blocked(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 3);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 3,
        ])->assertOk();

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart->json('data.reference'),
            'method' => 'cash',
            'cash_received' => 2000,
        ])->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertSame(0.0, $this->balanceFor($product, $branch));

        $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertStatus(422)->assertJsonPath('code', 'insufficient_stock');
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

    public function test_product_low_stock_threshold_is_persisted_and_synced_to_balances(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $this->ensureStock($product, $branch, 20);

        $response = $this->putJson("/api/v1/products/{$product->id}", [
            'low_stock_threshold' => 7,
        ])->assertOk();

        $this->assertEquals(7, $response->json('data.low_stock_threshold'));
        $this->assertSame(7.0, (float) $product->fresh()->low_stock_threshold);
        $this->assertSame(
            7.0,
            (float) InventoryBalance::query()
                ->where('product_id', $product->id)
                ->value('low_stock_threshold'),
        );
    }

    public function test_low_stock_notification_is_emitted_when_stock_crosses_threshold(): void
    {
        [$admin, $branch, $product] = $this->scene('WTR-75');
        $product->update(['low_stock_threshold' => 5]);
        $this->ensureStock($product, $branch, 10);

        $cart = $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 6,
        ])->assertOk();

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart->json('data.reference'),
            'method' => 'cash',
            'cash_received' => 5000,
        ])->assertOk();

        $this->assertSame(4.0, $this->balanceFor($product, $branch));

        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type' => 'inventory.low_stock',
            'branch_id' => $branch->id,
        ]);
    }

    /**
     * @return array{0: User, 1: Branch, 2: Product}
     */
    private function scene(string $sku): array
    {
        $admin = User::query()->where('email', 'owner@demo.local')->firstOrFail();
        $branch = Branch::query()->where('code', 'HQ')->firstOrFail();
        $product = Product::query()->where('sku', $sku)->firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->withHeaders(['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id]);

        $shift = $this->openShift($admin, $branch);

        $this->postJson('/api/v1/sale-sessions/open', [
            'shift_id' => $shift->id,
            'opening_balance' => 0,
        ])->assertOk();

        return [$admin, $branch, $product];
    }

    private function openShift(User $user, Branch $branch): Shift
    {
        return Shift::query()->create([
            'business_id' => $branch->business_id,
            'branch_id' => $branch->id,
            'reference' => 'SHF-TEST-'.$branch->id,
            'user_id' => $user->id,
            'status' => 'open',
            'assigned_user_ids' => [],
            'opened_at' => now(),
            'opening_cash' => 0,
            'expected_cash' => 0,
        ]);
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
