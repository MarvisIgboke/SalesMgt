<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Services\SalesService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class SalesController extends Controller
{
    public function __construct(private readonly SalesService $sales)
    {
    }

    public function index(Request $request)
    {
        $this->authorize($request, ['sales.view']);

        $filters = $request->only(['status', 'payment_status', 'customer_id', 'branch_id', 'user_id', 'payment_method', 'product_id', 'from', 'to', 'search']);

        $paginator = $this->sales->index($filters, $this->perPage($request));

        return ApiResponse::paginator(
            $paginator,
            extra: ['summary' => $this->sales->summary($filters)],
        );
    }

    public function show(Request $request, int $sale)
    {
        $this->authorize($request, ['sales.view']);

        $record = Sale::query()->findOrFail($sale);

        return ApiResponse::success($this->sales->present($record, detailed: true));
    }

    public function cancel(Request $request, int $sale)
    {
        $this->authorize($request, ['sales.cancel']);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $record = Sale::query()->findOrFail($sale);
        $cancelled = $this->sales->cancel($record, $data['reason'] ?? null, $request->user()->id);

        return ApiResponse::success($this->sales->present($cancelled, detailed: true), 'Sale cancelled.');
    }

    public function refund(Request $request, int $sale)
    {
        $this->authorize($request, ['sales.refund']);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $record = Sale::query()->findOrFail($sale);

        $result = $this->sales->refund(
            $record,
            $data['items'],
            $data['reason'] ?? null,
            $request->user()->id,
        );

        return ApiResponse::success([
            'refund' => [
                'id' => $result['refund']->id,
                'reference' => $result['refund']->reference,
                'total' => (float) $result['refund']->total,
                'reason' => $result['refund']->reason,
                'status' => $result['refund']->status,
                'created_at' => $result['refund']->created_at?->toIso8601String(),
            ],
            'sale' => $this->sales->present($result['sale'], detailed: true),
        ], 'Refund recorded.');
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
