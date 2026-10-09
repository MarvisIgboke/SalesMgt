<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Models\Business;
use App\Services\BusinessContextService;
use App\Support\ApiResponse;
use App\Support\Presenter;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class BusinessController extends Controller
{
    public function __construct(private readonly BusinessContextService $context)
    {
    }

    public function context(Request $request)
    {
        abort_unless($request->user()->can('dashboard.view') || $request->user()->can('sales.view'), 403);

        return ApiResponse::success(
            $this->context->context(TenantContext::branchId()),
        );
    }

    public function branches(Request $request)
    {
        $perPage = $this->perPage($request);

        $paginator = Branch::query()
            ->when($request->user()->branch_ids, fn ($q, $ids) => $q->whereIn('id', $ids))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (Branch $branch) => Presenter::branch($branch));
    }

    public function listBusinesses(Request $request)
    {
        $user = $request->user();

        $businesses = $user->isSuperAdmin()
            ? Business::query()->with(['subscription.plan', 'wallet'])->orderBy('name')->get()
            : Business::query()->with(['subscription.plan', 'wallet'])->whereKey($user->business_id)->get();

        return ApiResponse::success(
            $businesses->map(fn (Business $business) => Presenter::business(
                $business,
                $business->subscription,
                $business->wallet,
            ))->values()->all(),
        );
    }

    public function switchBranch(Request $request)
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer'],
        ]);

        $user = $request->user();

        $branch = Branch::query()->find($data['branch_id']);

        if ($branch === null) {
            throw new ApiException('BRANCH_NOT_FOUND', 'The selected branch could not be found.', 404);
        }

        if (! $user->hasBranchAccess($branch->id)) {
            throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
        }

        TenantContext::setBranchId($branch->id);

        return ApiResponse::success($this->context->context($branch->id), 'Branch switched.');
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}