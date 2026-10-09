<?php

namespace App\Http\Controllers;

use App\Models\StockBatch;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class ExpiryController extends Controller
{
    private const BUCKETS = [
        'expired' => 'Expired',
        'critical' => '0-7 days',
        'warning' => '8-30 days',
        'watch' => '31-90 days',
        'safe' => '90+ days',
    ];

    public function dashboard(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : TenantContext::branchId();

        $batches = $this->base($branchId)->with(['product', 'variant', 'branch'])->get();

        $counts = array_fill_keys(array_keys(self::BUCKETS), 0);
        $totalQuantity = 0.0;
        $estimatedLoss = 0.0;

        foreach ($batches as $batch) {
            $days = $batch->daysRemaining();
            $counts[$this->bucketKey($days)]++;
            $totalQuantity += (float) $batch->quantity_available;
            if ($days !== null && $days < 0) {
                $estimatedLoss += (float) $batch->quantity_available * (float) $batch->cost_price;
            }
        }

        $buckets = [];
        foreach (self::BUCKETS as $key => $label) {
            $buckets[] = ['key' => $key, 'label' => $label, 'count' => $counts[$key]];
        }

        return ApiResponse::success([
            'buckets' => $buckets,
            'total_expired' => $counts['expired'],
            'total_quantity' => round($totalQuantity, 3),
            'estimated_loss' => round($estimatedLoss, 2),
        ]);
    }

    public function items(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : TenantContext::branchId();

        $query = $this->base($branchId)->with(['product', 'variant', 'branch']);

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(fn ($q) => $q->whereHas('product', fn ($p) => $p->where('name', 'like', $term)->orWhere('sku', 'like', $term)));
        }

        $window = $request->query('window');
        $paginator = $query->orderBy('expiry_date')->paginate($this->perPage($request));

        $items = collect($paginator->items())
            ->filter(fn (StockBatch $batch) => $this->inWindow($batch->daysRemaining(), $window))
            ->map(fn (StockBatch $batch) => $this->present($batch))
            ->values()
            ->all();

        return ApiResponse::paginator($paginator->setCollection(collect($items)));
    }

    public function buckets(Request $request)
    {
        $this->authorize($request, ['inventory.view']);

        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : TenantContext::branchId();

        $counts = array_fill_keys(array_keys(self::BUCKETS), 0);

        foreach ($this->base($branchId)->get() as $batch) {
            $counts[$this->bucketKey($batch->daysRemaining())]++;
        }

        $out = [];
        foreach (self::BUCKETS as $key => $label) {
            $out[] = ['key' => $key, 'label' => $label, 'count' => $counts[$key]];
        }

        return ApiResponse::success($out);
    }

    private function base(?int $branchId)
    {
        return StockBatch::query()
            ->whereNotNull('expiry_date')
            ->where('quantity_available', '>', 0)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId));
    }

    private function bucketKey(?int $days): string
    {
        return match (true) {
            $days === null => 'safe',
            $days < 0 => 'expired',
            $days <= 7 => 'critical',
            $days <= 30 => 'warning',
            $days <= 90 => 'watch',
            default => 'safe',
        };
    }

    private function inWindow(?int $days, ?string $window): bool
    {
        if ($window === null || $window === '' || $window === 'all') {
            return true;
        }

        return match ($window) {
            'expired' => $days !== null && $days < 0,
            '7', 'critical' => $days !== null && $days >= 0 && $days <= 7,
            '30', 'warning' => $days !== null && $days >= 0 && $days <= 30,
            '90', 'watch' => $days !== null && $days >= 0 && $days <= 90,
            default => true,
        };
    }

    private function risk(?int $days): string
    {
        return match (true) {
            $days === null => 'low',
            $days < 0 => 'expired',
            $days <= 7 => 'critical',
            $days <= 30 => 'high',
            $days <= 90 => 'medium',
            default => 'low',
        };
    }

    private function recommendedAction(string $risk): string
    {
        return match ($risk) {
            'expired' => 'Remove from sale and write off',
            'critical' => 'Discount and prioritise sale',
            'high' => 'Prioritise sale or return to supplier',
            'medium' => 'Monitor closely',
            default => 'No action needed',
        };
    }

    private function present(StockBatch $batch): array
    {
        $days = $batch->daysRemaining();
        $risk = $this->risk($days);

        return [
            'id' => $batch->id,
            'product_name' => $batch->product?->name,
            'variant_name' => $batch->variant?->name,
            'batch_number' => $batch->batch_number,
            'branch_name' => $batch->branch?->name,
            'quantity' => (float) $batch->quantity_available,
            'expiry_date' => $batch->expiry_date?->toDateString(),
            'days_remaining' => $days,
            'risk' => $risk,
            'recommended_action' => $this->recommendedAction($risk),
            'status' => $batch->expiryStatus(),
        ];
    }

    private function authorize(Request $request, array $permissions): void
    {
        $user = $request->user();
        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return;
            }
        }
        abort(403);
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
