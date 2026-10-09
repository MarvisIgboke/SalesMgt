<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('audit.view'), 403);

        $query = AuditLog::query()
            ->with('user')
            ->where('business_id', TenantContext::businessId())
            ->when($request->filled('action'), fn ($q) => $q->where('action', $request->query('action')))
            ->when($request->filled('entity_type'), fn ($q) => $q->where('entity_type', $request->query('entity_type')))
            ->when($request->filled('entity_id'), fn ($q) => $q->where('entity_id', (int) $request->query('entity_id')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', (int) $request->query('user_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('created_at', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('created_at', '<=', $request->query('to')));

        $paginator = $query->orderByDesc('id')->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (AuditLog $log) => $this->present($log));
    }

    public function show(Request $request, int $audit)
    {
        abort_unless($request->user()->can('audit.view'), 403);

        $log = AuditLog::query()
            ->with('user')
            ->where('business_id', TenantContext::businessId())
            ->findOrFail($audit);

        return ApiResponse::success($this->present($log));
    }

    private function present(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'entity_type' => $log->entity_type,
            'entity_id' => $log->entity_id,
            'user_id' => $log->user_id,
            'user_name' => $log->user?->name,
            'branch_id' => $log->branch_id,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'reason' => $log->reason,
            'ip_address' => $log->ip_address,
            'device_id' => $log->device_id,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
