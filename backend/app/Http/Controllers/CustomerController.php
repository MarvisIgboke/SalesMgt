<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Sale;
use App\Services\CustomerLedgerService;
use App\Support\ApiResponse;
use App\Support\AuditLog;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(private readonly CustomerLedgerService $ledger)
    {
    }

    public function index(Request $request)
    {
        $this->authorize($request, ['customers.view', 'sales.create']);

        $paginator = Customer::query()
            ->with('account')
            ->withSum(['sales as total_purchases' => fn ($q) => $q->whereIn('status', ['completed', 'partially_refunded'])], 'total')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhere('email', 'like', $term));
            })
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Customer $customer) => $this->present($customer));
    }

    public function show(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.view', 'sales.create']);

        return ApiResponse::success($this->present($this->find($customer)));
    }

    public function store(Request $request)
    {
        $this->authorize($request, ['customers.create']);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $customer = Customer::create([
            'business_id' => TenantContext::businessId(),
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'credit_limit' => $data['credit_limit'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        $this->ledger->account($customer);

        AuditLog::record('customer.created', 'customer', $customer->id, $customer->only(['name']));

        return ApiResponse::success($this->present($customer->fresh()), 'Customer created.');
    }

    public function update(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.edit']);

        $customer = $this->find($customer);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $customer->fill(array_intersect_key($data, array_flip(['name', 'email', 'phone', 'address', 'credit_limit'])));
        $customer->save();

        AuditLog::record('customer.updated', 'customer', $customer->id, $customer->only(['name']));

        return ApiResponse::success($this->present($customer->fresh()), 'Customer updated.');
    }

    public function statement(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.view', 'customers.credit']);

        $customer = $this->find($customer);

        return ApiResponse::success(
            $this->ledger->statement($customer, $request->query('from'), $request->query('to')),
        );
    }

    public function purchases(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.view', 'sales.create']);

        $customer = $this->find($customer);

        $paginator = Sale::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Sale $sale) => [
            'id' => $sale->id,
            'reference' => $sale->reference,
            'total' => (float) $sale->total,
            'status' => $sale->status,
            'payment_status' => $sale->payment_status,
            'created_at' => $sale->created_at?->toIso8601String(),
        ]);
    }

    public function payments(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.view', 'customers.credit']);

        $customer = $this->find($customer);

        $paginator = CustomerPayment::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (CustomerPayment $payment) => [
            'id' => $payment->id,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'status' => $payment->status,
            'created_at' => $payment->created_at?->toIso8601String(),
        ]);
    }

    private function find(int $id): Customer
    {
        return Customer::query()->with('account')->findOrFail($id);
    }

    private function present(Customer $customer): array
    {
        $balance = (float) ($customer->account->balance ?? 0);
        $creditLimit = $customer->credit_limit === null ? null : (float) $customer->credit_limit;

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'address' => $customer->address,
            'credit_limit' => $creditLimit,
            'outstanding_balance' => round($balance, 2),
            'credit_remaining' => $creditLimit === null ? null : round($creditLimit - $balance, 2),
            'total_purchases' => (float) ($customer->total_purchases ?? 0),
            'created_at' => $customer->created_at?->toIso8601String(),
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