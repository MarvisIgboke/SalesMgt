<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BusinessSetting;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Shift;
use App\Models\StockBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShiftPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\DatabaseSeeder::class);
    }

    public function test_sale_is_blocked_when_no_shift_has_been_opened(): void
    {
        [$branch, $product] = $this->boot();

        $cart = $this->startCart($product);

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart,
            'method' => 'cash',
            'cash_received' => 200,
        ])->assertStatus(422)->assertJsonPath('code', 'NO_OPEN_SHIFT');

        $this->assertSame(0, Sale::query()->count());
    }

    public function test_branch_level_override_cannot_disable_the_shift_requirement(): void
    {
        [$branch, $product] = $this->boot();

        BusinessSetting::withoutGlobalScopes()->create([
            'business_id' => $branch->business_id,
            'branch_id' => $branch->id,
            'setting_key' => 'shifts_enabled',
            'value' => false,
        ]);

        $cart = $this->startCart($product);

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart,
            'method' => 'cash',
            'cash_received' => 200,
        ])->assertStatus(422)->assertJsonPath('code', 'NO_OPEN_SHIFT');

        $this->assertSame(0, Sale::query()->count());
    }

    public function test_shifts_can_be_disabled_for_the_whole_business(): void
    {
        [$branch, $product] = $this->boot();

        $this->putJson('/api/v1/shifts/config', ['shifts_enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.shifts_enabled', false);

        $cart = $this->startCart($product);

        $this->postJson('/api/v1/pos/sales/charge', [
            'reference' => $cart,
            'method' => 'cash',
            'cash_received' => 200,
        ])->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertSame(1, Sale::query()->count());
    }

    public function test_shift_cannot_be_closed_while_a_rep_sale_is_still_open(): void
    {
        [$branch] = $this->boot();

        $headers = ['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id];

        $manager = User::create([
            'name' => 'Store Manager',
            'email' => 'manager@demo.local',
            'password' => 'password',
            'business_id' => $branch->business_id,
            'is_active' => true,
        ]);
        $manager->assignRole('Store Manager');

        $rep = User::query()->where('email', 'cashier@demo.local')->firstOrFail();
        $rep->forceFill(['branch_ids' => [$branch->id], 'is_active' => true])->save();

        $shiftId = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/open', [
                'branch_id' => $branch->id,
                'opening_cash' => 1000,
                'assigned_user_ids' => [$rep->id],
            ])->assertOk()->json('data.id');

        $sessionId = $this->actingAs($rep, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/sale-sessions/open', [
                'shift_id' => $shiftId,
                'opening_balance' => 0,
            ])->assertOk()->json('data.id');

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/close', [
                'shift_id' => $shiftId,
                'actual_cash' => 1000,
            ])->assertStatus(422)->assertJsonPath('code', 'SHIFT_HAS_OPEN_SALES');

        $this->assertSame('open', Shift::query()->find($shiftId)->status);

        $this->actingAs($rep, 'sanctum')->withHeaders($headers)
            ->postJson("/api/v1/sale-sessions/{$sessionId}/close", [
                'closing_amount' => 0,
            ])->assertOk();

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/close', [
                'shift_id' => $shiftId,
                'actual_cash' => 1000,
            ])->assertOk()->assertJsonPath('data.status', 'closed');
    }

    public function test_shift_sales_total_is_the_sum_of_every_representatives_sales(): void
    {
        [$branch, $product] = $this->boot();
        $headers = ['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id];

        $manager = User::create([
            'name' => 'Store Manager',
            'email' => 'manager@demo.local',
            'password' => 'password',
            'business_id' => $branch->business_id,
            'is_active' => true,
        ]);
        $manager->assignRole('Store Manager');

        $rep1 = User::query()->where('email', 'cashier@demo.local')->firstOrFail();
        $rep1->forceFill(['branch_ids' => [$branch->id], 'is_active' => true])->save();

        $rep2 = User::create([
            'name' => 'Rep Two',
            'email' => 'rep2@demo.local',
            'password' => 'password',
            'business_id' => $branch->business_id,
            'branch_ids' => [$branch->id],
            'is_active' => true,
        ]);
        $rep2->assignRole('Sales Representative');

        $shiftId = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/open', [
                'branch_id' => $branch->id,
                'opening_cash' => 0,
                'assigned_user_ids' => [$rep1->id, $rep2->id],
            ])->assertOk()->json('data.id');

        $this->sellOnSale($rep1, $headers, $product, 1);
        $this->sellOnSale($rep2, $headers, $product, 2);

        $expected = (float) Sale::query()->where('shift_id', $shiftId)->sum('total');
        $this->assertGreaterThan(0, $expected);

        $response = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->getJson("/api/v1/shifts/{$shiftId}")
            ->assertOk();

        $this->assertEquals(round($expected, 2), $response->json('data.reconciliation.sales_total'));
        $this->assertSame(2, $response->json('data.reconciliation.transaction_count'));
        $this->assertSame(2, $response->json('data.kpis.sales_transactions'));
    }

    public function test_store_manager_cannot_charge_without_an_open_sale(): void
    {
        [$branch, $product] = $this->boot();
        $headers = ['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id];

        $manager = $this->storeManager($branch);

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/open', [
                'branch_id' => $branch->id,
                'opening_cash' => 0,
                'assigned_user_ids' => [],
            ])->assertOk();

        $reference = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/cart/items', [
                'product_id' => $product->id,
                'quantity' => 1,
            ])->assertOk()->json('data.reference');

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/sales/charge', [
                'reference' => $reference,
                'method' => 'cash',
                'cash_received' => 500,
            ])->assertStatus(422)->assertJsonPath('code', 'NO_SALE_OPEN');

        $this->assertSame(0, Sale::query()->count());
    }

    public function test_store_manager_can_open_their_own_sale_even_when_not_assigned(): void
    {
        [$branch, $product] = $this->boot();
        $headers = ['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id];

        $manager = $this->storeManager($branch);

        $shiftId = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/shifts/open', [
                'branch_id' => $branch->id,
                'opening_cash' => 0,
                'assigned_user_ids' => [],
            ])->assertOk()->json('data.id');

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/sale-sessions/open', [
                'shift_id' => $shiftId,
                'opening_balance' => 0,
            ])->assertOk();

        $reference = $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/cart/items', [
                'product_id' => $product->id,
                'quantity' => 1,
            ])->assertOk()->json('data.reference');

        $this->actingAs($manager, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/sales/charge', [
                'reference' => $reference,
                'method' => 'cash',
                'cash_received' => 500,
            ])->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertSame(1, Sale::query()->count());
    }

    private function storeManager(Branch $branch): User
    {
        $manager = User::create([
            'name' => 'Store Manager',
            'email' => 'manager@demo.local',
            'password' => 'password',
            'business_id' => $branch->business_id,
            'is_active' => true,
        ]);
        $manager->assignRole('Store Manager');

        return $manager;
    }

    private function sellOnSale(User $rep, array $headers, Product $product, int $quantity): void
    {
        $this->actingAs($rep, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/sale-sessions/open', ['opening_balance' => 0])
            ->assertOk();

        $reference = $this->actingAs($rep, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/cart/items', [
                'product_id' => $product->id,
                'quantity' => $quantity,
            ])->assertOk()->json('data.reference');

        $this->actingAs($rep, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/pos/sales/charge', [
                'reference' => $reference,
                'method' => 'cash',
                'cash_received' => 100000,
            ])->assertOk();
    }

    /**
     * @return array{0: Branch, 1: Product}
     */
    private function boot(string $sku = 'WTR-75'): array
    {
        $admin = User::query()->where('email', 'owner@demo.local')->firstOrFail();
        $branch = Branch::query()->where('code', 'HQ')->firstOrFail();
        $product = Product::query()->where('sku', $sku)->firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->withHeaders(['Accept' => 'application/json', 'X-Branch-Id' => (string) $branch->id]);

        StockBatch::create([
            'business_id' => $product->business_id,
            'branch_id' => $branch->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'batch_number' => 'POLICY-'.$product->id,
            'expiry_date' => null,
            'quantity_received' => 10,
            'quantity_available' => 10,
            'cost_price' => (float) $product->cost_price,
            'status' => 'available',
        ]);

        InventoryBalance::create([
            'business_id' => $product->business_id,
            'branch_id' => $branch->id,
            'product_id' => $product->id,
            'variant_id' => null,
            'quantity' => 10,
            'low_stock_threshold' => $product->low_stock_threshold,
        ]);

        return [$branch, $product];
    }

    private function startCart(Product $product): string
    {
        return $this->postJson('/api/v1/pos/cart/items', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])->assertOk()->json('data.reference');
    }
}
