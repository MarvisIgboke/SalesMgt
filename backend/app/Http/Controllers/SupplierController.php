<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SupplierController extends Controller
{
    private const PERMISSIONS = ['purchases.create', 'purchases.approve', 'purchases.receive'];

    public function index(Request $request)
    {
        $this->authorize($request);

        $paginator = Supplier::query()
            ->with('account')
            ->withSum('purchaseOrders as total_purchases', 'total')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('contact_name', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->when($request->filled('filter'), function ($query) use ($request) {
                match ($request->query('filter')) {
                    'balance' => $query->whereHas('account', fn ($a) => $a->where('balance', '>', 0)),
                    'clear' => $query->whereHas('account', fn ($a) => $a->where('balance', '<=', 0)),
                    'active' => $query->whereHas('purchaseOrders'),
                    'new' => $query->whereDoesntHave('purchaseOrders'),
                    default => null,
                };
            })
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Supplier $supplier) => $this->present($supplier));
    }

    public function summary(Request $request)
    {
        $this->authorize($request);

        $suppliers = Supplier::query()
            ->with('account')
            ->withSum('purchaseOrders as total_purchases', 'total')
            ->get();

        $count = $suppliers->count();
        $active = $suppliers->filter(fn (Supplier $s) => (float) $s->total_purchases > 0)->count();
        $withBalance = $suppliers->filter(fn (Supplier $s) => (float) ($s->account->balance ?? 0) > 0)->count();
        $outstanding = round((float) $suppliers->sum(fn (Supplier $s) => (float) ($s->account->balance ?? 0)), 2);
        $purchasesValue = round((float) $suppliers->sum('total_purchases'), 2);

        $orders = PurchaseOrder::query()
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(total), 0) as aggregate_value')
            ->first();

        $inbound = PurchaseOrder::query()
            ->where('status', 'approved')
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(total), 0) as aggregate_value')
            ->first();

        $due = SupplierInvoice::query()
            ->where('status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', Carbon::now()->addDays(14)->toDateString())
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(amount), 0) as aggregate_value')
            ->first();

        return ApiResponse::success([
            'active_suppliers' => ['count' => $count, 'with_orders' => $active],
            'ap_outstanding' => [
                'count' => $withBalance,
                'value' => $outstanding,
            ],
            'purchases' => [
                'count' => (int) ($orders->aggregate_count ?? 0),
                'value' => round((float) ($orders->aggregate_value ?? 0), 2),
            ],
            'inbound' => [
                'count' => (int) ($inbound->aggregate_count ?? 0),
                'value' => round((float) ($inbound->aggregate_value ?? 0), 2),
            ],
            'ap_due_14d' => [
                'count' => (int) ($due->aggregate_count ?? 0),
                'value' => round((float) ($due->aggregate_value ?? 0), 2),
            ],
            'filters' => [
                'all' => $count,
                'active' => $active,
                'new' => $count - $active,
                'balance' => $withBalance,
                'clear' => $count - $withBalance,
            ],
        ]);
    }

    public function show(Request $request, int $supplier)
    {
        $this->authorize($request);

        return ApiResponse::success($this->present($this->find($supplier)));
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('purchases.create'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $supplier = Supplier::create([
            ...$data,
            'business_id' => TenantContext::businessId(),
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('supplier.created', 'supplier', $supplier->id, $supplier->only(['name']));

        return ApiResponse::success($this->present($supplier->fresh()), 'Supplier created.');
    }

    public function update(Request $request, int $supplier)
    {
        abort_unless($request->user()->can('purchases.create'), 403);

        $supplier = $this->find($supplier);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $supplier->fill(array_intersect_key($data, array_flip(['name', 'contact_name', 'email', 'phone', 'address'])));
        $supplier->save();

        AuditLog::record('supplier.updated', 'supplier', $supplier->id, $supplier->only(['name']));

        return ApiResponse::success($this->present($supplier->fresh()), 'Supplier updated.');
    }

    public function purchases(Request $request, int $supplier)
    {
        $this->authorize($request);

        $supplier = $this->find($supplier);

        $paginator = PurchaseOrder::query()
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (PurchaseOrder $order) => [
            'id' => $order->id,
            'reference' => $order->reference,
            'status' => $order->status,
            'total' => (float) $order->total,
            'expected_at' => $order->expected_at?->toDateString(),
            'created_at' => $order->created_at?->toIso8601String(),
        ]);
    }

    public function payments(Request $request, int $supplier)
    {
        $this->authorize($request);

        $supplier = $this->find($supplier);

        $paginator = SupplierPayment::query()
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (SupplierPayment $payment) => [
            'id' => $payment->id,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'created_at' => $payment->created_at?->toIso8601String(),
        ]);
    }

    private function find(int $id): Supplier
    {
        return Supplier::query()->with('account')->findOrFail($id);
    }

    private function present(Supplier $supplier): array
    {
        $orderStats = PurchaseOrder::query()
            ->where('supplier_id', $supplier->id)
            ->selectRaw('COUNT(*) as aggregate_count')
            ->selectRaw("COUNT(CASE WHEN status = 'approved' THEN 1 END) as in_transit")
            ->selectRaw("COUNT(CASE WHEN status NOT IN ('received', 'cancelled') THEN 1 END) as open_orders")
            ->selectRaw('MAX(created_at) as last_order_at')
            ->first();

        return [
            'id' => $supplier->id,
            'name' => $supplier->name,
            'contact_name' => $supplier->contact_name,
            'email' => $supplier->email,
            'phone' => $supplier->phone,
            'address' => $supplier->address,
            'outstanding_balance' => round((float) ($supplier->account->balance ?? 0), 2),
            'total_purchases' => (float) ($supplier->total_purchases ?? 0),
            'orders_count' => (int) ($orderStats->aggregate_count ?? 0),
            'in_transit_count' => (int) ($orderStats->in_transit ?? 0),
            'open_orders' => (int) ($orderStats->open_orders ?? 0),
            'last_order_at' => $orderStats->last_order_at
                ? Carbon::parse($orderStats->last_order_at)->toIso8601String()
                : null,
            'created_at' => $supplier->created_at?->toIso8601String(),
        ];
    }

    private function authorize(Request $request): void
    {
        foreach (self::PERMISSIONS as $permission) {
            if ($request->user()->can($permission)) {
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