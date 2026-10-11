<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\PushSubscription;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize($request);

        $query = Notification::query()
            ->where('user_id', $request->user()->id)
            ->when($request->boolean('unread'), fn ($q) => $q->where('is_read', false))
            ->orderByDesc('id');

        $perPage = $this->perPage($request);
        $category = (string) $request->query('category', '');

        if (in_array($category, ['sales', 'inventory', 'finance', 'system'], true)) {
            $filtered = $query->get()
                ->filter(fn (Notification $notification) => $this->categoryFor($notification) === $category)
                ->values();

            $page = max((int) $request->query('page', 1), 1);
            $paginator = new LengthAwarePaginator(
                $filtered->forPage($page, $perPage)->values(),
                $filtered->count(),
                $perPage,
                $page,
            );

            return ApiResponse::paginator($paginator, map: fn (Notification $notification) => $this->present($notification));
        }

        $paginator = $query->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (Notification $notification) => $this->present($notification));
    }

    public function unreadCount(Request $request)
    {
        $this->authorize($request);

        $count = Notification::query()
            ->where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count();

        return ApiResponse::success(['count' => $count]);
    }

    /**
     * Feed telemetry for the notification centre: unread/action-required KPIs,
     * read-rate, category + severity breakdowns and filter counts.
     */
    public function summary(Request $request)
    {
        $this->authorize($request);

        $notifications = Notification::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        $todayStart = now()->startOfDay();
        $weekAgo = now()->subDays(7);

        $total = 0;
        $unread = 0;
        $read = 0;
        $today = 0;
        $thisWeek = 0;
        $actionRequired = 0;

        $byCategory = ['sales' => 0, 'inventory' => 0, 'finance' => 0, 'system' => 0];
        $bySeverity = ['critical' => 0, 'warning' => 0, 'info' => 0, 'success' => 0];

        foreach ($notifications as $notification) {
            $total++;
            $isRead = (bool) $notification->is_read;
            $isRead ? $read++ : $unread++;

            $severity = $this->severityFor($notification);
            $category = $this->categoryFor($notification);
            $bySeverity[$severity] = ($bySeverity[$severity] ?? 0) + 1;
            $byCategory[$category] = ($byCategory[$category] ?? 0) + 1;

            if (! $isRead && in_array($severity, ['critical', 'warning'], true)) {
                $actionRequired++;
            }
            if ($notification->created_at !== null) {
                if ($notification->created_at->gte($todayStart)) {
                    $today++;
                }
                if ($notification->created_at->gte($weekAgo)) {
                    $thisWeek++;
                }
            }
        }

        return ApiResponse::success([
            'total' => $total,
            'unread' => $unread,
            'read' => $read,
            'read_rate_pct' => $total > 0 ? round(($read / $total) * 100, 1) : 0.0,
            'today' => $today,
            'this_week' => $thisWeek,
            'action_required' => $actionRequired,
            'by_category' => $byCategory,
            'by_severity' => $bySeverity,
            'filters' => [
                'all' => $total,
                'unread' => $unread,
                'sales' => $byCategory['sales'],
                'inventory' => $byCategory['inventory'],
                'finance' => $byCategory['finance'],
                'system' => $byCategory['system'],
            ],
        ]);
    }

    public function markRead(Request $request, int $notification)
    {
        $this->authorize($request);

        $record = Notification::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($notification);

        if (! $record->is_read) {
            $record->forceFill(['is_read' => true, 'read_at' => now()])->save();
        }

        return ApiResponse::success($this->present($record->fresh()), 'Notification read.');
    }

    public function markAllRead(Request $request)
    {
        $this->authorize($request);

        Notification::query()
            ->where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return ApiResponse::success(null, 'All notifications read.');
    }

    public function subscribe(Request $request)
    {
        $this->authorize($request);

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:500'],
            'keys' => ['required', 'array'],
        ]);

        $endpointKey = substr(md5($data['endpoint']), 0, 32);

        PushSubscription::updateOrCreate(
            ['endpoint_key' => $endpointKey],
            [
                'business_id' => TenantContext::businessId(),
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'keys' => $data['keys'],
            ],
        );

        return ApiResponse::success(['id' => $endpointKey], 'Device subscribed.');
    }

    private function present(Notification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'title' => $notification->title,
            'body' => $notification->body,
            'is_read' => (bool) $notification->is_read,
            'severity' => $this->severityFor($notification),
            'category' => $this->categoryFor($notification),
            'data' => $notification->data,
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }

    /**
     * Classify a notification into a feed category based on its type token.
     */
    private function categoryFor(Notification $notification): string
    {
        $token = strtolower((string) preg_split('/[^a-z0-9]/i', (string) $notification->type)[0]);
        $haystack = strtolower($notification->type.' '.$notification->title);

        $sales = ['sale', 'sales', 'order', 'pos', 'till', 'refund', 'register', 'customer', 'checkout'];
        $inventory = ['inventory', 'stock', 'batch', 'expiry', 'expire', 'product', 'warehouse', 'cold'];
        $finance = ['expense', 'finance', 'ledger', 'payment', 'invoice', 'approval', 'credit', 'balance', 'payout'];

        foreach ($sales as $needle) {
            if ($token === $needle || str_contains($haystack, $needle)) {
                return 'sales';
            }
        }
        foreach ($inventory as $needle) {
            if ($token === $needle || str_contains($haystack, $needle)) {
                return 'inventory';
            }
        }
        foreach ($finance as $needle) {
            if ($token === $needle || str_contains($haystack, $needle)) {
                return 'finance';
            }
        }

        return 'system';
    }

    /**
     * Derive a severity band from the type/title/body keywords.
     */
    private function severityFor(Notification $notification): string
    {
        $haystack = strtolower(trim($notification->type.' '.$notification->title.' '.($notification->body ?? '')));

        $critical = ['critical', 'fraud', 'breach', 'security', 'overdue', 'denied', 'failed', 'error', 'locked', 'anomaly', 'unauthorized', 'out of stock'];
        $warning = ['warning', 'low stock', 'pending', 'due', 'below', 'limit', 'expiry', 'expire', 'expiring', 'review', 'approaching', 'awaiting'];
        $success = ['approved', 'completed', 'success', 'settled', 'paid', 'delivered', 'received', 'restocked', 'reconciled', 'closed'];

        foreach ($critical as $needle) {
            if (str_contains($haystack, $needle)) {
                return 'critical';
            }
        }
        foreach ($warning as $needle) {
            if (str_contains($haystack, $needle)) {
                return 'warning';
            }
        }
        foreach ($success as $needle) {
            if (str_contains($haystack, $needle)) {
                return 'success';
            }
        }

        return 'info';
    }

    private function authorize(Request $request): void
    {
        abort_unless($request->user()->can('notifications.view'), 403);
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
