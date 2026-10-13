<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionInvoice;
use App\Services\SubscriptionBillingService;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class SubscriptionInvoiceController extends Controller
{
    public function __construct(private readonly SubscriptionBillingService $billing)
    {
    }

    /**
     * Platform-wide invoice ledger for the Super Admin.
     */
    public function index(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $query = SubscriptionInvoice::withoutGlobalScope('tenant-business')
            ->with(['business', 'paidBy']);

        $this->applyFilters($query, $request);

        $paginator = $query
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator(
            $paginator,
            map: fn (SubscriptionInvoice $invoice) => $invoice->toApi(),
            extra: ['summary' => $this->summary()],
        );
    }

    /**
     * Invoices for the caller's own business.
     */
    public function mine(Request $request)
    {
        abort_unless($request->user()->can('subscription.view'), 403);

        $businessId = (int) TenantContext::businessId();

        $query = SubscriptionInvoice::withoutGlobalScope('tenant-business')
            ->with(['business', 'paidBy'])
            ->where('business_id', $businessId);

        $this->applyFilters($query, $request);

        $paginator = $query
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator(
            $paginator,
            map: fn (SubscriptionInvoice $invoice) => $invoice->toApi(),
            extra: ['summary' => $this->summary($businessId)],
        );
    }

    public function generate(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'period' => ['nullable', 'date_format:Y-m'],
            'business_id' => ['nullable', 'integer', 'exists:businesses,id'],
        ]);

        $created = $this->billing->run($data['period'] ?? null, $data['business_id'] ?? null);

        return ApiResponse::success(
            [
                'generated' => count($created),
                'invoices' => array_map(fn (SubscriptionInvoice $invoice) => $invoice->toApi(), $created),
            ],
            sprintf('%d invoice(s) generated.', count($created)),
        );
    }

    public function show(Request $request, int $invoice)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $record = SubscriptionInvoice::withoutGlobalScope('tenant-business')
            ->with(['business', 'paidBy'])
            ->findOrFail($invoice);

        return ApiResponse::success($record->toApi());
    }

    public function markPaid(Request $request, int $invoice)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'payment_reference' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $record = SubscriptionInvoice::withoutGlobalScope('tenant-business')->findOrFail($invoice);

        $updated = $this->billing->markPaid(
            $record,
            $request->user()->id,
            $data['payment_reference'] ?? null,
            $data['notes'] ?? null,
        );

        return ApiResponse::success($updated->toApi(), 'Invoice marked as paid.');
    }

    public function markUnpaid(Request $request, int $invoice)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $record = SubscriptionInvoice::withoutGlobalScope('tenant-business')->findOrFail($invoice);

        return ApiResponse::success($this->billing->markUnpaid($record)->toApi(), 'Invoice returned to unpaid.');
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('business_id')) {
            $query->where('business_id', (int) $request->query('business_id'));
        }

        $status = (string) $request->query('status', '');

        if ($status !== '' && in_array($status, SubscriptionInvoice::STATUSES, true)) {
            $query->where('status', $status);
        } elseif ($status === 'overdue') {
            $query->where('status', 'unpaid')
                ->whereNotNull('due_at')
                ->whereDate('due_at', '<', now());
        }

        if ($request->filled('from')) {
            $query->whereDate('period_start', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('period_start', '<=', $request->query('to'));
        }

        if ($request->filled('search')) {
            $term = (string) $request->query('search');
            $query->where(function ($builder) use ($term) {
                $builder->where('number', 'like', "%{$term}%")
                    ->orWhereHas('business', fn ($business) => $business->where('name', 'like', "%{$term}%"));
            });
        }
    }

    private function summary(?int $businessId = null): array
    {
        $query = SubscriptionInvoice::withoutGlobalScope('tenant-business');

        if ($businessId !== null) {
            $query->where('business_id', $businessId);
        }

        $unpaid = fn () => (clone $query)->where('status', 'unpaid');

        return [
            'total' => (clone $query)->count(),
            'paid' => (clone $query)->where('status', 'paid')->count(),
            'unpaid' => $unpaid()->count(),
            'overdue' => $unpaid()->whereNotNull('due_at')->whereDate('due_at', '<', now())->count(),
            'void' => (clone $query)->where('status', 'void')->count(),
            'collected' => (float) (clone $query)->where('status', 'paid')->sum('amount'),
            'outstanding' => (float) $unpaid()->sum('amount'),
        ];
    }
}
