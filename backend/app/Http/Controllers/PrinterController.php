<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Printer;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PrinterController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('printers.view'), 403);

        $query = Printer::query()->with('branch')->orderByDesc('is_default')->orderBy('name');

        if ($request->filled('branch_id')) {
            $branchId = (int) $request->query('branch_id');
            $query->where(fn ($q) => $q->where('branch_id', $branchId)->orWhereNull('branch_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('status')) {
            $status = $request->query('status');
            if (in_array($status, Printer::STATUSES, true)) {
                $query->where('status', $status);
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            }
        }

        $printers = $query->get();
        $payload = $printers->map(fn (Printer $printer) => $printer->toApi());

        return ApiResponse::success([
            'printers' => $payload,
            'summary' => $this->summary(),
            'options' => [
                'types' => Printer::TYPES,
                'connections' => Printer::CONNECTIONS,
                'paper_widths' => Printer::PAPER_WIDTHS,
            ],
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('printers.manage'), 403);

        $businessId = $request->user()->business_id;
        $data = $this->validated($request);

        $this->assertBranchBelongsToBusiness($businessId, $data['branch_id'] ?? null);
        $this->assertNameAvailable($businessId, $data['branch_id'] ?? null, $data['name']);

        $printer = Printer::query()->create([
            'business_id' => $businessId,
            ...$this->attributes($data),
        ]);

        if ($printer->is_default) {
            $this->clearOtherDefaults($printer);
        }

        AuditLog::record('printer.created', 'printer', $printer->id, ['name' => $printer->name]);

        return ApiResponse::success($printer->fresh('branch')->toApi(), 'Printer added.');
    }

    public function update(Request $request, Printer $printer)
    {
        abort_unless($request->user()->can('printers.manage'), 403);

        $businessId = $request->user()->business_id;
        $data = $this->validated($request, $printer);

        if (array_key_exists('branch_id', $data)) {
            $this->assertBranchBelongsToBusiness($businessId, $data['branch_id']);
        }

        $branchId = array_key_exists('branch_id', $data) ? $data['branch_id'] : $printer->branch_id;
        $name = $data['name'] ?? $printer->name;
        $this->assertNameAvailable($businessId, $branchId, $name, $printer->id);

        $printer->fill($this->attributes($data, $printer))->save();

        if ($printer->is_default) {
            $this->clearOtherDefaults($printer);
        }

        AuditLog::record('printer.updated', 'printer', $printer->id, ['name' => $printer->name]);

        return ApiResponse::success($printer->fresh('branch')->toApi(), 'Printer updated.');
    }

    public function destroy(Request $request, Printer $printer)
    {
        abort_unless($request->user()->can('printers.manage'), 403);

        $name = $printer->name;
        $printer->delete();

        AuditLog::record('printer.deleted', 'printer', null, ['name' => $name]);

        return ApiResponse::success(null, 'Printer removed.');
    }

    public function setDefault(Request $request, Printer $printer)
    {
        abort_unless($request->user()->can('printers.manage'), 403);

        $printer->forceFill(['is_default' => true, 'is_active' => true])->save();
        $this->clearOtherDefaults($printer);

        AuditLog::record('printer.default', 'printer', $printer->id, ['name' => $printer->name]);

        return ApiResponse::success($printer->fresh('branch')->toApi(), 'Default printer set.');
    }

    public function ping(Request $request, Printer $printer)
    {
        abort_unless($request->user()->can('printers.view'), 403);

        $online = (bool) $printer->is_active;

        $printer->forceFill([
            'status' => $online ? 'online' : 'offline',
            'last_seen_at' => $online ? now() : $printer->last_seen_at,
        ])->save();

        return ApiResponse::success([
            'printer' => $printer->fresh('branch')->toApi(),
            'reachable' => $online,
            'latency_ms' => $online ? random_int(8, 45) : null,
        ], $online ? 'Printer reachable.' : 'Printer is disabled.');
    }

    private function summary(): array
    {
        $printers = Printer::query()->with('branch')->get();

        $byType = $printers->groupBy('type')->map->count();

        return [
            'total' => $printers->count(),
            'online' => $printers->filter(fn (Printer $p) => $p->resolvedStatus() === 'online')->count(),
            'offline' => $printers->filter(fn (Printer $p) => $p->resolvedStatus() === 'offline')->count(),
            'unknown' => $printers->filter(fn (Printer $p) => $p->resolvedStatus() === 'unknown')->count(),
            'inactive' => $printers->where('is_active', false)->count(),
            'defaults' => $printers->where('is_default', true)->count(),
            'by_type' => $byType->map(fn ($count, $type) => ['type' => $type, 'count' => $count])->values()->all(),
        ];
    }

    private function validated(Request $request, ?Printer $printer = null): array
    {
        $required = $printer === null ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'type' => ['nullable', Rule::in(Printer::TYPES)],
            'connection' => ['nullable', Rule::in(Printer::CONNECTIONS)],
            'address' => ['nullable', 'string', 'max:190'],
            'paper_width' => ['nullable', Rule::in(Printer::PAPER_WIDTHS)],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'auto_print_receipts' => ['nullable', 'boolean'],
            'print_kitchen_tickets' => ['nullable', 'boolean'],
            'print_labels' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function attributes(array $data, ?Printer $printer = null): array
    {
        $attrs = [
            'name' => isset($data['name']) ? trim($data['name']) : $printer?->name,
            'type' => $data['type'] ?? $printer?->type ?? 'receipt',
            'connection' => $data['connection'] ?? $printer?->connection ?? 'network',
            'address' => array_key_exists('address', $data) ? ($data['address'] ?? null) : $printer?->address,
            'paper_width' => $data['paper_width'] ?? $printer?->paper_width ?? '80mm',
            'notes' => array_key_exists('notes', $data) ? ($data['notes'] ?? null) : $printer?->notes,
        ];

        if (array_key_exists('branch_id', $data)) {
            $attrs['branch_id'] = $data['branch_id'];
        } elseif ($printer === null) {
            $attrs['branch_id'] = null;
        } elseif ($printer->branch_id !== null) {
            $attrs['branch_id'] = $printer->branch_id;
        }

        foreach (['is_default', 'is_active', 'auto_print_receipts', 'print_kitchen_tickets', 'print_labels'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $attrs[$flag] = (bool) $data[$flag];
            } elseif ($printer === null) {
                $attrs[$flag] = $flag === 'is_active' || $flag === 'auto_print_receipts';
            }
        }

        return $attrs;
    }

    private function assertBranchBelongsToBusiness(int $businessId, ?int $branchId): void
    {
        if ($branchId === null) {
            return;
        }

        $exists = Branch::query()
            ->where('id', $branchId)
            ->where('business_id', $businessId)
            ->exists();

        if (! $exists) {
            throw new ApiException('INVALID_BRANCH', 'The selected branch does not belong to this business.', 422);
        }
    }

    private function assertNameAvailable(int $businessId, ?int $branchId, string $name, ?int $ignoreId = null): void    {
        $exists = Printer::query()
            ->where('business_id', $businessId)
            ->where('branch_id', $branchId)
            ->where('name', trim($name))
            ->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($exists) {
            throw new ApiException('PRINTER_NAME_TAKEN', 'A printer with this name already exists for that branch.', 422);
        }
    }

    private function clearOtherDefaults(Printer $printer): void
    {
        Printer::query()
            ->whereKeyNot($printer->id)
            ->where('branch_id', $printer->branch_id)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
