<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Sale;
use App\Services\CustomerLedgerService;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    private const VIP_SPEND = 1_000_000;

    private const CREDIT_DUE = 500_000;

    public const SEGMENTS = ['Wholesale B2B', 'Retail VIP', 'Retail'];

    public const TIERS = ['Platinum B2B', 'Black Card VIP', 'Gold', 'Silver', 'Standard'];

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

    /**
     * CRM telemetry for the customer accounts dashboard: profile + AR ledger
     * KPIs, segment/credit filters and a per-customer roster with lifetime
     * spend, 30d volume, credit utilisation and dates.
     */
    public function summary(Request $request)
    {
        $this->authorize($request, ['customers.view', 'sales.create']);

        $businessId = TenantContext::businessId();
        $currency = Business::query()->whereKey($businessId)->value('currency') ?? 'NGN';

        $customers = Customer::query()
            ->with('account')
            ->orderBy('name')
            ->get();

        $completed = ['completed', 'partially_refunded'];
        $since30 = now()->subDays(30);
        $since60 = now()->subDays(60);
        $weekAgo = now()->subDays(7);

        $lifetime = $this->salesByCustomer($businessId, $completed);
        $recent = $this->salesByCustomer($businessId, $completed, $since30);
        $previous = $this->salesByCustomer($businessId, $completed, $since60, $since30);

        $gmv30 = (float) $recent->sum('value');
        $orders30 = (int) $recent->sum('orders');
        $gmvPrev = (float) $previous->sum('value');

        $arTotal = 0.0;
        $arAccounts = 0;
        $dueHigh = 0;
        $creditAccounts = 0;
        $currentAccounts = 0;
        $limitTotal = 0.0;
        $available = 0.0;
        $wholesale = 0;
        $vip = 0;
        $walkin = 0;
        $newThisWeek = 0;
        $repeatBuyers = 0;
        $lifetimeOrders = 0;

        $cards = [];

        foreach ($customers as $customer) {
            $balance = (float) ($customer->account->balance ?? 0);
            $limit = $customer->credit_limit === null ? null : (float) $customer->credit_limit;
            $hasCredit = $limit !== null && $limit > 0;
            $row = $lifetime->get($customer->id);
            $spend = (float) ($row->value ?? 0);
            $orders = (int) ($row->orders ?? 0);
            $segment = $customer->segment ?: ($hasCredit ? 'Wholesale B2B' : ($spend >= self::VIP_SPEND ? 'Retail VIP' : 'Retail'));
            $isWholesale = $segment === 'Wholesale B2B';
            $isVip = $segment === 'Retail VIP';
            $isWalkin = $customer->phone === null && $customer->email === null;

            $arTotal += $balance;
            if ($balance > 0) {
                $arAccounts++;
            }
            if ($balance > self::CREDIT_DUE) {
                $dueHigh++;
            }
            if ($isWholesale) {
                $wholesale++;
            } elseif ($isVip) {
                $vip++;
            }

            if ($hasCredit) {
                $creditAccounts++;
                $limitTotal += $limit;
                $available += max($limit - $balance, 0);
                if ($balance <= $limit) {
                    $currentAccounts++;
                }
            }
            if ($isWalkin) {
                $walkin++;
            }
            if ($customer->created_at !== null && $customer->created_at->gte($weekAgo)) {
                $newThisWeek++;
            }
            if ($orders >= 2) {
                $repeatBuyers++;
            }
            $lifetimeOrders += $orders;

            $recentRow = $recent->get($customer->id);
            $utilisation = $hasCredit ? round(($balance / $limit) * 100, 1) : 0.0;

            $cards[] = [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'address' => $customer->address,
                'account_code' => $this->accountCode($customer->id, $this->accountPrefix($segment)),
                'segment' => $segment,
                'tier' => $customer->tier ?: $this->tier($spend, $limit),
                'credit_limit' => $limit,
                'outstanding_balance' => round($balance, 2),
                'credit_remaining' => $limit === null ? null : round($limit - $balance, 2),
                'utilisation_pct' => $utilisation,
                'over_limit' => $hasCredit && $balance > $limit,
                'lifetime_spend' => round($spend, 2),
                'orders_total' => $orders,
                'orders_30d' => (int) ($recentRow->orders ?? 0),
                'spend_30d' => round((float) ($recentRow->value ?? 0), 2),
                'last_purchase_at' => isset($row->last_at) && $row->last_at ? \Illuminate\Support\Carbon::parse($row->last_at)->toIso8601String() : null,
                'is_walkin' => $isWalkin,
                'created_at' => $customer->created_at?->toIso8601String(),
            ];
        }

        $total = $customers->count();
        $bookHealth = $creditAccounts > 0 ? round(($currentAccounts / $creditAccounts) * 100, 1) : 100.0;
        $retention = $total > 0 ? round(($repeatBuyers / $total) * 100, 1) : 0.0;
        $utilisation = $limitTotal > 0 ? round(($arTotal / $limitTotal) * 100, 1) : 0.0;

        return ApiResponse::success([
            'business_id' => $businessId,
            'currency' => $currency,
            'profiles' => [
                'total' => $total,
                'new_this_week' => $newThisWeek,
                'wholesale' => $wholesale,
                'vip' => $vip,
                'walkin' => $walkin,
            ],
            'ar' => [
                'total' => round($arTotal, 2),
                'accounts' => $arAccounts,
                'due_high' => $dueHigh,
                'credit_accounts' => $creditAccounts,
                'current_accounts' => $currentAccounts,
                'book_health_pct' => $bookHealth,
                'available' => round($available, 2),
                'utilisation_pct' => $utilisation,
            ],
            'loyalty' => [
                'repeat_buyers' => $repeatBuyers,
                'retention_pct' => $retention,
                'lifetime_orders' => $lifetimeOrders,
            ],
            'gmv_30d' => [
                'value' => round($gmv30, 2),
                'orders' => $orders30,
                'average' => $orders30 > 0 ? round($gmv30 / $orders30, 2) : 0.0,
                'prev_value' => round($gmvPrev, 2),
                'mom_pct' => $gmvPrev > 0 ? round((($gmv30 - $gmvPrev) / $gmvPrev) * 100, 1) : 0.0,
            ],
            'filters' => [
                'all' => $total,
                'wholesale' => $wholesale,
                'vip' => $vip,
                'credit_due' => $dueHigh,
                'walkin' => $walkin,
            ],
            'pipeline' => [
                'outstanding' => round($arTotal, 2),
                'accounts' => $arAccounts,
                'available' => round($available, 2),
            ],
            'customers' => $cards,
        ]);
    }

    public function show(Request $request, int $customer)
    {
        $this->authorize($request, ['customers.view', 'sales.create']);

        return ApiResponse::success($this->present($this->find($customer)));
    }

    /**
     * @param  array<int, string>  $statuses
     * @return \Illuminate\Support\Collection<int, object>
     */
    private function salesByCustomer(int $businessId, array $statuses, ?\DateTimeInterface $from = null, ?\DateTimeInterface $to = null)
    {
        return DB::table('sales')
            ->where('business_id', $businessId)
            ->whereIn('status', $statuses)
            ->whereNotNull('customer_id')
            ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('created_at', '<', $to))
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS value, MAX(created_at) AS last_at')
            ->get()
            ->keyBy('customer_id');
    }

    private function accountPrefix(string $segment): string
    {
        return match ($segment) {
            'Wholesale B2B' => 'B2B',
            'Retail VIP' => 'VIP',
            default => 'RET',
        };
    }

    private function accountCode(int $id, string $prefix): string
    {
        return $prefix.'-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    private function tier(float $spend, ?float $limit): string
    {
        if ($limit !== null && $limit >= 1_000_000) {
            return 'Platinum B2B';
        }
        if ($spend >= 3_000_000) {
            return 'Black Card VIP';
        }
        if ($spend >= 1_000_000) {
            return 'Gold';
        }
        if ($spend >= 200_000) {
            return 'Silver';
        }

        return 'Standard';
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
            'segment' => ['nullable', 'string', Rule::in(self::SEGMENTS)],
            'tier' => ['nullable', 'string', Rule::in(self::TIERS)],
        ]);

        $customer = Customer::create([
            'business_id' => TenantContext::businessId(),
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'credit_limit' => $data['credit_limit'] ?? null,
            'segment' => $data['segment'] ?? null,
            'tier' => $data['tier'] ?? null,
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
            'segment' => ['nullable', 'string', Rule::in(self::SEGMENTS)],
            'tier' => ['nullable', 'string', Rule::in(self::TIERS)],
        ]);

        $customer->fill(array_intersect_key($data, array_flip(['name', 'email', 'phone', 'address', 'credit_limit', 'segment', 'tier'])));
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
            'segment' => $customer->segment,
            'tier' => $customer->tier,
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