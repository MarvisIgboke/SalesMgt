<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\GoodsReceipt;
use App\Models\Product;
use App\Models\PurchaseItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequisition;
use App\Models\PurchaseReturn;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Services\InventoryService;
use App\Support\ApiResponse;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PurchasingController extends Controller
{
    private const STATUSES = ['draft', 'pending', 'approved', 'received', 'cancelled', 'requested'];

    public function __construct(private readonly InventoryService $inventory)
    {
    }

    public function requisitions(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $paginator = PurchaseRequisition::query()
            ->with(['product', 'branch', 'requester'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (PurchaseRequisition $req) => $this->presentRequisition($req));
    }

    public function createRequisition(Request $request)
    {
        $this->authorize($request, ['purchases.create']);

        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'variant_id' => ['nullable', 'integer'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'branch_id' => ['required', 'integer'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        Product::query()->findOrFail($data['product_id']);

        $requisition = PurchaseRequisition::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => (int) $data['branch_id'],
            'product_id' => (int) $data['product_id'],
            'variant_id' => isset($data['variant_id']) ? (int) $data['variant_id'] : null,
            'quantity' => (float) $data['quantity'],
            'notes' => $data['notes'] ?? null,
            'status' => 'requested',
            'requested_by' => $request->user()->id,
        ]);

        AuditLog::record('purchasing.requisition_created', 'purchase_requisition', $requisition->id, [
            'product_id' => $requisition->product_id,
            'quantity' => (float) $requisition->quantity,
        ]);

        $requisition->load(['product', 'branch', 'requester']);

        return ApiResponse::success($this->presentRequisition($requisition), 'Requisition created.');
    }

    public function orders(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $paginator = PurchaseOrder::query()
            ->with(['supplier', 'branch', 'creator', 'items.product'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', (int) $request->query('supplier_id')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where(fn ($sub) => $sub
                    ->where('reference', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', $term))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', $term)->orWhere('sku', 'like', $term)));
            })
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (PurchaseOrder $order) => $this->presentOrder($order));
    }

    public function summary(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $businessId = TenantContext::businessId();

        $orders = PurchaseOrder::query()
            ->selectRaw('status, COUNT(*) as aggregate_count, COALESCE(SUM(total), 0) as aggregate_value')
            ->groupBy('status')
            ->get();

        $statusCounts = ['all' => 0, 'draft' => 0, 'pending' => 0, 'approved' => 0, 'received' => 0, 'cancelled' => 0];
        $statusValues = $statusCounts;

        foreach ($orders as $row) {
            $status = (string) $row->status;
            $count = (int) $row->aggregate_count;
            $value = (float) $row->aggregate_value;

            if (array_key_exists($status, $statusCounts)) {
                $statusCounts[$status] = $count;
                $statusValues[$status] = $value;
            }

            $statusCounts['all'] += $count;
        }

        $kpi = fn (string $status): array => [
            'count' => (int) ($statusCounts[$status] ?? 0),
            'value' => round((float) ($statusValues[$status] ?? 0), 2),
        ];

        $openCount = $statusCounts['draft'] + $statusCounts['pending'] + $statusCounts['approved'];
        $openValue = round($statusValues['draft'] + $statusValues['pending'] + $statusValues['approved'], 2);

        $monthStart = Carbon::now()->startOfMonth();

        $receivedThisMonth = PurchaseOrder::query()
            ->where('status', 'received')
            ->where('updated_at', '>=', $monthStart)
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(total), 0) as aggregate_value')
            ->first();

        $mtdOrders = PurchaseOrder::query()
            ->where('created_at', '>=', $monthStart)
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(total), 0) as aggregate_value')
            ->first();

        $payables = SupplierInvoice::query()
            ->where('status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', Carbon::now()->addDays(14)->toDateString())
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(amount), 0) as aggregate_value')
            ->first();

        return ApiResponse::success([
            'kpis' => [
                'open_pos' => ['count' => $openCount, 'value' => $openValue],
                'inbound' => $kpi('approved'),
                'grn_dock' => [
                    'count' => (int) ($receivedThisMonth->aggregate_count ?? 0),
                    'value' => round((float) ($receivedThisMonth->aggregate_value ?? 0), 2),
                ],
                'payables_14d' => [
                    'count' => (int) ($payables->aggregate_count ?? 0),
                    'value' => round((float) ($payables->aggregate_value ?? 0), 2),
                ],
            ],
            'status_counts' => $statusCounts,
            'spend' => [
                'mtd' => round((float) ($mtdOrders->aggregate_value ?? 0), 2),
                'mtd_orders' => (int) ($mtdOrders->aggregate_count ?? 0),
                'open_commitment' => $openValue,
            ],
            'business_id' => $businessId,
        ]);
    }

    public function createOrder(Request $request)
    {
        $this->authorize($request, ['purchases.create']);

        $data = $request->validate([
            'supplier_id' => ['nullable', 'integer'],
            'branch_id' => ['required', 'integer'],
            'expected_at' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $order = DB::transaction(function () use ($data, $request) {
            $products = Product::query()
                ->whereIn('id', collect($data['items'])->pluck('product_id')->unique()->all())
                ->get()
                ->keyBy('id');

            $total = 0.0;
            $lines = [];

            foreach ($data['items'] as $item) {
                $product = $products->get((int) $item['product_id']);
                if ($product === null) {
                    continue;
                }

                $unitCost = isset($item['unit_cost']) ? (float) $item['unit_cost'] : (float) $product->cost_price;
                $quantity = (float) $item['quantity'];
                $total += round($unitCost * $quantity, 2);

                $lines[] = [
                    'product_id' => (int) $item['product_id'],
                    'variant_id' => isset($item['variant_id']) ? (int) $item['variant_id'] : null,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                ];
            }

            $order = PurchaseOrder::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => (int) $data['branch_id'],
                'reference' => ReferenceGenerator::make('PO'),
                'supplier_id' => isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
                'status' => 'draft',
                'expected_at' => $data['expected_at'] ?? null,
                'total' => round($total, 2),
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($lines as $line) {
                $order->items()->create($line);
            }

            return $order;
        });

        AuditLog::record('purchasing.order_created', 'purchase_order', $order->id, [
            'reference' => $order->reference,
            'total' => (float) $order->total,
        ]);

        return ApiResponse::success($this->presentOrder($order->fresh(['supplier', 'branch', 'creator', 'items.product'])), 'Purchase order created.');
    }

    public function order(Request $request, int $order)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $record = PurchaseOrder::query()
            ->with(['supplier', 'branch', 'creator', 'items.product'])
            ->findOrFail($order);

        return ApiResponse::success($this->presentOrder($record, withItems: true));
    }

    public function updateOrderStatus(Request $request, int $order)
    {
        $data = $request->validate([
            'status' => ['required', 'in:draft,pending,approved,received,cancelled'],
        ]);

        $permission = match ($data['status']) {
            'approved' => 'purchases.approve',
            'received' => 'purchases.receive',
            default => 'purchases.create',
        };

        $this->authorize($request, [$permission]);

        $record = PurchaseOrder::query()->with('items')->findOrFail($order);
        $previous = $record->status;

        if ($data['status'] === 'received' && $previous !== 'received') {
            $this->receiveOrder($record, $request->user()->id);
        }

        $record->forceFill(['status' => $data['status']])->save();

        AuditLog::record('purchasing.order_status_changed', 'purchase_order', $record->id, [
            'from' => $previous,
            'to' => $data['status'],
        ]);

        return ApiResponse::success($this->presentOrder($record->fresh(['supplier', 'branch', 'creator', 'items.product'])), 'Order updated.');
    }

    public function invoices(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $paginator = SupplierInvoice::query()
            ->with('supplier')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (SupplierInvoice $invoice) => [
            'id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'supplier_name' => $invoice->supplier?->name,
            'amount' => (float) $invoice->amount,
            'status' => $invoice->status,
            'due_date' => $invoice->due_date?->toDateString(),
            'created_at' => $invoice->created_at?->toIso8601String(),
        ]);
    }

    public function payments(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $paginator = SupplierPayment::query()
            ->with('supplier')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (SupplierPayment $payment) => [
            'id' => $payment->id,
            'supplier_name' => $payment->supplier?->name,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'created_at' => $payment->created_at?->toIso8601String(),
        ]);
    }

    public function returns(Request $request)
    {
        $this->authorize($request, ['purchases.create', 'purchases.approve', 'purchases.receive']);

        $paginator = PurchaseReturn::query()
            ->with('supplier')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (PurchaseReturn $return) => [
            'id' => $return->id,
            'reference' => $return->reference,
            'supplier_name' => $return->supplier?->name,
            'reason' => $return->reason,
            'total' => (float) $return->total,
            'status' => $return->status,
            'created_at' => $return->created_at?->toIso8601String(),
        ]);
    }

    private function receiveOrder(PurchaseOrder $order, int $userId): void
    {
        $order->loadMissing('items');

        DB::transaction(function () use ($order, $userId) {
            $receipt = GoodsReceipt::create([
                'business_id' => TenantContext::businessId(),
                'branch_id' => $order->branch_id,
                'reference' => 'GRN-'.now()->format('ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'purchase_order_id' => $order->id,
                'supplier_id' => $order->supplier_id,
                'notes' => 'Auto-received from '.$order->reference,
                'created_by' => $userId,
            ]);

            foreach ($order->items as $item) {
                $receipt->items()->create([
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'quantity' => (float) $item->quantity,
                    'cost_price' => (float) $item->unit_cost,
                ]);

                $this->inventory->receive(
                    (int) $order->branch_id,
                    (int) $item->product_id,
                    $item->variant_id,
                    (float) $item->quantity,
                    (float) $item->unit_cost,
                    null,
                    null,
                    $order->supplier_id,
                    $receipt->reference,
                    $userId,
                );
            }
        });
    }

    private function presentRequisition(PurchaseRequisition $req): array
    {
        return [
            'id' => $req->id,
            'reference' => 'REQ-'.str_pad((string) $req->id, 5, '0', STR_PAD_LEFT),
            'product_id' => $req->product_id,
            'product_name' => $req->product?->name,
            'quantity' => (float) $req->quantity,
            'branch_id' => $req->branch_id,
            'branch_name' => $req->branch?->name,
            'requested_by' => $req->requester?->name ?? 'System',
            'status' => $req->status,
            'notes' => $req->notes,
            'created_at' => $req->created_at?->toIso8601String(),
        ];
    }

    private function presentOrder(PurchaseOrder $order, bool $withItems = false): array
    {
        $payload = [
            'id' => $order->id,
            'reference' => $order->reference,
            'supplier_id' => $order->supplier_id,
            'supplier_name' => $order->supplier?->name,
            'branch_id' => $order->branch_id,
            'branch_name' => $order->branch?->name,
            'status' => $order->status,
            'expected_at' => $order->expected_at?->toDateString(),
            'total' => (float) $order->total,
            'created_by' => $order->creator?->name ?? 'System',
            'created_at' => $order->created_at?->toIso8601String(),
            'notes' => $order->notes,
        ];

        if ($withItems) {
            $payload['items'] = $order->items->map(fn (PurchaseItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name,
                'variant_id' => $item->variant_id,
                'quantity' => (float) $item->quantity,
                'unit_cost' => (float) $item->unit_cost,
                'line_total' => round((float) $item->quantity * (float) $item->unit_cost, 2),
            ])->values()->all();
        } else {
            $items = $order->relationLoaded('items') ? $order->items : collect();
            $payload['items_count'] = $items->count();
            $payload['units'] = round((float) $items->sum('quantity'), 3);
            $payload['item_preview'] = $items->take(3)
                ->map(fn (PurchaseItem $item) => $item->product?->name)
                ->filter()
                ->values()
                ->all();
        }

        return $payload;
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

