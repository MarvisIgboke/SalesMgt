<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\RiskFlag;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RiskController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('audit.view'), 403);

        $query = RiskFlag::query()
            ->with(['user', 'branch'])
            ->when($request->filled('level'), fn ($q) => $q->where('level', $request->query('level')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->query('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('created_at', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('created_at', '<=', $request->query('to')));

        $paginator = $query->orderByDesc('id')->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (RiskFlag $flag) => $this->present($flag));
    }

    public function resolve(Request $request, int $flag)
    {
        abort_unless($request->user()->can('audit.view'), 403);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['resolved', 'dismissed'])],
        ]);

        $record = RiskFlag::query()->findOrFail($flag);

        if ($record->status !== 'open') {
            return ApiResponse::success($this->present($record), 'This flag has already been closed.');
        }

        $record->forceFill(['status' => $data['decision']])->save();

        AuditLog::record('risk.flag_'.$data['decision'], 'risk_flag', $record->id, [
            'type' => $record->type,
            'level' => $record->level,
        ]);

        return ApiResponse::success($this->present($record->fresh(['user', 'branch'])), 'Risk flag updated.');
    }

    private function present(RiskFlag $flag): array
    {
        return [
            'id' => $flag->id,
            'level' => $flag->level,
            'type' => $flag->type,
            'description' => $flag->description,
            'payload' => $flag->payload,
            'status' => $flag->status,
            'branch_id' => $flag->branch_id,
            'branch_name' => $flag->branch?->name,
            'user_id' => $flag->user_id,
            'user_name' => $flag->user?->name,
            'created_at' => $flag->created_at?->toIso8601String(),
        ];
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
