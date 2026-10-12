<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * Platform-wide user directory (Super Admin only): every login credential
     * across all businesses with their roles, business and registration info.
     */
    public function index(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        $paginator = User::query()
            ->with(['roles', 'business'])
            ->when($request->filled('role'), fn ($query) => $query->whereHas(
                'roles',
                fn ($q) => $q->where('name', $request->string('role')),
            ))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginator(
            $paginator,
            map: fn (User $user) => $this->present($user),
            extra: ['stats' => $this->stats()],
        );
    }

    /**
     * Reset a user's password back to the platform default.
     */
    public function resetPassword(Request $request, int $user)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $target = User::query()->findOrFail($user);
        $target->password = 'password';
        $target->save();

        AuditLog::record('user.password_reset', 'user', $target->id, ['email' => $target->email]);

        return ApiResponse::success(
            $this->present($target->fresh(['roles', 'business'])),
            'Password reset to default.',
        );
    }

    /**
     * Enable or disable a user's login access.
     */
    public function toggleActive(Request $request, int $user)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $target = User::query()->findOrFail($user);

        if ($target->id === $request->user()->id) {
            throw new ApiException('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.', 422);
        }

        $target->is_active = ! $target->is_active;
        $target->save();

        AuditLog::record(
            $target->is_active ? 'user.enabled' : 'user.disabled',
            'user',
            $target->id,
            ['email' => $target->email],
        );

        return ApiResponse::success(
            $this->present($target->fresh(['roles', 'business'])),
            $target->is_active ? 'User enabled.' : 'User disabled.',
        );
    }

    /**
     * @return array{total: int, business_admin: int, store_manager: int, sales_rep: int}
     */
    private function stats(): array
    {
        return [
            'total' => User::query()->count(),
            'business_admin' => $this->roleCount('Business Admin'),
            'store_manager' => $this->roleCount('Store Manager'),
            'sales_rep' => $this->roleCount('Sales Representative'),
        ];
    }

    private function roleCount(string $role): int
    {
        return User::query()
            ->whereHas('roles', fn ($q) => $q->where('name', $role))
            ->count();
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatar_url,
            'roles' => $user->getRoleNames()->values()->all(),
            'business_id' => $user->business_id,
            'business_name' => $user->relationLoaded('business') ? $user->business?->name : null,
            'branch_ids' => $user->branch_ids ?? [],
            'is_active' => (bool) $user->is_active,
            'last_active_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
