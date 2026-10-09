<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Expense;
use App\Models\ExpenseApproval;
use App\Models\ExpenseCategory;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\ReferenceGenerator;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeView($request);

        $paginator = Expense::query()
            ->with(['category', 'branch', 'submitter', 'approver'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Expense $expense) => $this->present($expense));
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->can('expenses.create'), 403);

        $data = $request->validate([
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'category' => ['nullable', 'string', 'max:120'],
            'branch_id' => ['nullable', 'integer'],
            'date' => ['nullable', 'date'],
        ]);

        $branchId = $data['branch_id'] ?? TenantContext::branchId();

        if ($branchId === null) {
            throw new ApiException('BRANCH_REQUIRED', 'A branch is required to record an expense.', 422);
        }

        $categoryId = null;
        if (! empty($data['category'])) {
            $categoryId = ExpenseCategory::query()->firstOrCreate([
                'business_id' => TenantContext::businessId(),
                'name' => trim($data['category']),
            ])->id;
        }

        $expense = Expense::create([
            'business_id' => TenantContext::businessId(),
            'branch_id' => $branchId,
            'reference' => ReferenceGenerator::make('EXP'),
            'expense_category_id' => $categoryId,
            'description' => $data['description'],
            'amount' => $data['amount'],
            'status' => 'pending',
            'submitted_by' => $request->user()->id,
            'expense_date' => $data['date'] ?? now()->toDateString(),
        ]);

        AuditLog::record('expense.created', 'expense', $expense->id, ['amount' => $expense->amount]);

        return ApiResponse::success($this->present($expense->load(['category', 'branch', 'submitter', 'approver'])), 'Expense submitted.');
    }

    public function dashboard(Request $request)
    {
        $this->authorizeView($request);

        $validated = $request->validate([
            'period' => ['nullable', 'in:today,week,month'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        [$from, $to] = match ($validated['period'] ?? 'month') {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };

        $base = fn () => Expense::query()
            ->when($validated['branch_id'] ?? null, fn ($q, $branch) => $q->where('expenses.branch_id', $branch))
            ->whereBetween('expenses.created_at', [$from, $to]);

        $total = (float) $base()->whereIn('expenses.status', ['approved', 'paid'])->sum('expenses.amount');

        $byCategory = $base()
            ->whereIn('expenses.status', ['approved', 'paid'])
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->groupBy('expense_categories.name')
            ->selectRaw('expense_categories.name AS category, COALESCE(SUM(expenses.amount), 0) AS total')
            ->get()
            ->map(fn ($row) => ['category' => $row->category, 'total' => (float) $row->total])
            ->values()
            ->all();

        $pendingCount = Expense::query()
            ->when($validated['branch_id'] ?? null, fn ($q, $branch) => $q->where('branch_id', $branch))
            ->where('status', 'pending')
            ->count();

        return ApiResponse::success([
            'total' => round($total, 2),
            'by_category' => $byCategory,
            'pending_count' => $pendingCount,
        ]);
    }

    public function categories(Request $request)
    {
        $this->authorizeView($request);

        return ApiResponse::success(
            ExpenseCategory::query()->orderBy('name')->get(['id', 'name'])->all(),
        );
    }

    public function approvals(Request $request)
    {
        abort_unless($request->user()->can('expenses.approve'), 403);

        $paginator = Expense::query()
            ->with(['category', 'branch', 'submitter', 'approver'])
            ->where('status', 'pending')
            ->orderBy('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginator($paginator, map: fn (Expense $expense) => $this->present($expense));
    }

    public function decide(Request $request, int $expense)
    {
        abort_unless($request->user()->can('expenses.approve'), 403);

        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $record = Expense::query()->findOrFail($expense);

        if ($record->status !== 'pending') {
            throw new ApiException('EXPENSE_ALREADY_DECIDED', 'This expense has already been decided.', 422);
        }

        DB::transaction(function () use ($record, $data, $request) {
            $record->forceFill([
                'status' => $data['decision'],
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ])->save();

            ExpenseApproval::create([
                'expense_id' => $record->id,
                'approver_id' => $request->user()->id,
                'decision' => $data['decision'],
                'notes' => $data['notes'] ?? null,
            ]);
        });

        AuditLog::record('expense.'.$data['decision'], 'expense', $record->id, ['notes' => $data['notes'] ?? null]);

        return ApiResponse::success(
            $this->present($record->fresh(['category', 'branch', 'submitter', 'approver'])),
            'Expense '.$data['decision'].'.',
        );
    }

    private function present(Expense $expense): array
    {
        return [
            'id' => $expense->id,
            'reference' => $expense->reference,
            'description' => $expense->description,
            'amount' => (float) $expense->amount,
            'category' => $expense->category?->name,
            'branch_id' => $expense->branch_id,
            'branch_name' => $expense->branch?->name ?? '',
            'status' => $expense->status,
            'submitted_by' => $expense->submitter?->name ?? 'System',
            'approved_by' => $expense->approver?->name,
            'created_at' => $expense->created_at?->toIso8601String(),
        ];
    }

    private function authorizeView(Request $request): void
    {
        foreach (['expenses.create', 'expenses.approve', 'finance.view', 'reports.view'] as $permission) {
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