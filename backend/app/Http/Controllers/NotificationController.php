<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\PushSubscription;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize($request);

        $paginator = Notification::query()
            ->where('user_id', $request->user()->id)
            ->when($request->boolean('unread'), fn ($q) => $q->where('is_read', false))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

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
            'data' => $notification->data,
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
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
