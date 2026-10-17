<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\BusinessSetting;
use App\Models\InventoryBalance;
use App\Models\Product;
use App\Models\Sale;
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
