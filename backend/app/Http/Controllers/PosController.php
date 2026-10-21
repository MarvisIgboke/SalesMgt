<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Services\PosService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class PosController extends Controller
{
    public function __construct(private readonly PosService $pos)
    {
    }

    public function search(Request $request)
    {
        $this->authorize($request, ['sales.create', 'sales.view']);

        $paginator = $this->pos->search(
            (string) $request->query('q', ''),
            $this->branchId($request),
            $this->perPage($request),
            $request->query('category') ? (string) $request->query('category') : null,
            $request->user(),
        );

        return ApiResponse::paginator($paginator);
    }

    public function barcode(Request $request, string $barcode)
    {
        $this->authorize($request, ['sales.create', 'sales.view']);

        return ApiResponse::success($this->pos->productForBarcode($barcode, $this->branchId($request), $request->user()));
    }

    public function getCart(Request $request)
    {
        $this->authorize($request, ['sales.create', 'sales.view']);

        $cart = $this->pos->resolveCart($request->query('reference'), $request->user(), $this->branchId($request));

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function addItem(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'variant_id' => ['nullable', 'integer'],
            'quantity' => ['nullable', 'numeric', 'min:0.001'],
            'reference' => ['nullable', 'string'],
        ]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));
        $cart = $this->pos->addItem($cart, (int) $data['product_id'], isset($data['variant_id']) ? (int) $data['variant_id'] : null, (float) ($data['quantity'] ?? 1), $request->user());

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function updateItem(Request $request, int $line)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate([
            'quantity' => ['required', 'numeric'],
            'reference' => ['nullable', 'string'],
        ]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));
        $cart = $this->pos->updateItem($cart, $line, (float) $data['quantity']);

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function removeItem(Request $request, int $line)
    {
        $this->authorize($request, ['sales.create']);

        $cart = $this->pos->resolveCart($request->query('reference'), $request->user(), $this->branchId($request));
        $cart = $this->pos->removeItem($cart, $line);

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function setCustomer(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate([
            'customer_id' => ['nullable', 'integer'],
            'reference' => ['nullable', 'string'],
        ]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));
        $cart = $this->pos->setCustomer($cart, $data['customer_id'] ?? null);

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function initialize(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate(['reference' => ['nullable', 'string']]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    public function charge(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate([
            'reference' => ['nullable', 'string'],
            'method' => ['required', 'in:cash,bank_transfer,card,online,credit,split'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'split' => ['nullable', 'array'],
            'split.*.method' => ['required_with:split', 'string'],
            'split.*.amount' => ['required_with:split', 'numeric', 'min:0'],
            'bank_reference' => ['nullable', 'string', 'max:100'],
            'cash_received' => ['nullable', 'numeric', 'min:0'],
            'customer_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));

        if (array_key_exists('customer_id', $data) && $data['customer_id'] !== null) {
            $cart = $this->pos->setCustomer($cart, (int) $data['customer_id']);
        }

        $clientRequestId = $request->header('X-Client-Request-Id');

        $result = $this->pos->charge($cart, $data, $request->user(), $clientRequestId);

        $payload = [
            'status' => $result['status'],
            'client_request_id' => $clientRequestId,
            'message' => $result['message'],
        ];

        if ($result['sale'] !== null) {
            $payload['sale'] = [
                'id' => $result['sale']->id,
                'reference' => $result['sale']->reference,
                'receipt' => $this->pos->receipt($result['sale']),
                'approval' => $this->approvalPayload($result['sale']),
            ];
        }

        return ApiResponse::success($payload, $result['message']);
    }

    public function receipt(Request $request, string $reference)
    {
        $this->authorize($request, ['sales.view', 'sales.create']);

        $sale = Sale::query()->where('reference', $reference)->firstOrFail();

        return ApiResponse::success($this->pos->receipt($sale));
    }

    public function hold(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate(['reference' => ['nullable', 'string']]);

        $cart = $this->pos->resolveCart($data['reference'] ?? null, $request->user(), $this->branchId($request));

        if ((int) $cart->user_id !== (int) $request->user()->id) {
            abort(403);
        }

        $cart = $this->pos->hold($cart);

        return ApiResponse::success([
            'reference' => $cart->reference,
            'held_until' => $cart->held_until?->toIso8601String(),
        ], 'Sale held.');
    }

    public function held(Request $request)
    {
        $this->authorize($request, ['sales.create', 'sales.view']);

        $carts = $this->pos->listHeld($request->user(), $this->branchId($request));

        return ApiResponse::success(['carts' => $carts]);
    }

    public function resume(Request $request)
    {
        $this->authorize($request, ['sales.create']);

        $data = $request->validate(['reference' => ['required', 'string']]);

        $cart = $this->pos->resumeHeld($data['reference'], $request->user(), $this->branchId($request));

        return ApiResponse::success($this->pos->presentCart($cart, $request->user()));
    }

    private function approvalPayload(Sale $sale): array
    {
        $state = $sale->approval_state ?? [];

        return [
            'status' => $state['status'] ?? ($sale->status === 'awaiting_approval' ? 'pending' : 'approved'),
            'approved_by' => null,
            'approved_at' => null,
            'reason' => $sale->status === 'awaiting_approval' ? 'Sale requires approval.' : null,
        ];
    }

    private function branchId(Request $request): ?int
    {
        if ($request->filled('branch_id')) {
            return (int) $request->query('branch_id');
        }

        return TenantContext::branchId();
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
        return min(max((int) $request->query('per_page', 24), 1), 100);
    }
}
