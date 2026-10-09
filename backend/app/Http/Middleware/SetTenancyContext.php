<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class SetTenancyContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null && ! Auth::hasUser()) {
            return $next($request);
        }

        $user ??= Auth::user();

        $assertedBusinessId = $this->asInt($request->header('X-Business-Id'));
        $assertedBranchId = $this->asInt($request->header('X-Branch-Id'));

        $businessId = $user->business_id ?? $assertedBusinessId;

        if ($assertedBusinessId !== null && $user->business_id !== null && $assertedBusinessId !== $user->business_id) {
            throw new ApiException('BUSINESS_MISMATCH', 'Business access denied.', 403);
        }

        if ($businessId === null) {
            throw new ApiException('NO_BUSINESS', 'This account is not attached to a business.', 403);
        }

        TenantContext::setBusinessId($businessId);

        if ($assertedBranchId !== null) {
            $branch = Branch::query()
                ->whereKey($assertedBranchId)
                ->first();

            if (! $branch) {
                throw new ApiException('BRANCH_ACCESS', 'Branch access denied.', 403);
            }

            $allowedBranchIds = $user->branch_ids ?? [];

            if ($allowedBranchIds !== [] && ! in_array($assertedBranchId, $allowedBranchIds, true)) {
                throw new ApiException('BRANCH_ACCESS', 'You do not have access to this branch.', 403);
            }

            TenantContext::setBranchId($assertedBranchId);
        }

        try {
            return $next($request);
        } finally {
            TenantContext::reset();
        }
    }

    private function asInt(?string $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return ctype_digit($value) ? (int) $value : null;
    }
}