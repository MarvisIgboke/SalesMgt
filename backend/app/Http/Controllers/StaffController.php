<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserSession;
use App\Support\ApiResponse;
use App\Support\PermissionCatalog;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('staff.view'), 403);

        $perPage = $this->perPage($request);

        $paginator = User::query()
            ->where('business_id', TenantContext::businessId())
            ->with('roles')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term));
            })
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (User $user) => $this->present($user));
    }

    public function show(Request $request, int $staff)
    {
        abort_unless($request->user()->can('staff.view'), 403);

        return ApiResponse::success($this->present($this->find($staff)));
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('staff.create'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:191', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:30'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['integer'],
        ]);

        $user = User::create([
            'business_id' => TenantContext::businessId(),
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'] ?? Str::password(12),
            'branch_ids' => $data['branch_ids'] ?? [],
            'is_active' => true,
        ]);

        if (! empty($data['roles'])) {
            $user->syncRoles($this->allowedRoles($data['roles']));
        }

        AuditLog::record('staff.created', 'user', $user->id, $user->only(['name', 'email']));

        return ApiResponse::success($this->present($user->fresh('roles')), 'Staff member created.');
    }

    public function update(Request $request, int $staff)
    {
        abort_unless($request->user()->can('staff.edit'), 403);

        $user = $this->find($staff);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'email' => ['sometimes', 'email', 'max:191', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:30'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_active', $data) && $data['is_active'] === false && $user->id === $request->user()->id) {
            throw new ApiException('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.', 422);
        }

        $user->fill(array_filter([
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
        ], fn ($value) => $value !== null));

        if (array_key_exists('branch_ids', $data)) {
            $user->branch_ids = $data['branch_ids'] ?? [];
        }
        if (array_key_exists('is_active', $data)) {
            $user->is_active = $data['is_active'];
        }
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        if (array_key_exists('roles', $data) && $data['roles'] !== null) {
            $user->syncRoles($this->allowedRoles($data['roles']));
        }

        AuditLog::record('staff.updated', 'user', $user->id, $user->only(['name', 'email']));

        return ApiResponse::success($this->present($user->fresh('roles')), 'Staff member updated.');
    }

    public function roles(Request $request)
    {
        abort_unless($request->user()->can('staff.view') || $request->user()->can('staff.permissions'), 403);

        $businessId = TenantContext::businessId();

        $roles = Role::query()
            ->where(fn ($q) => $q->whereNull('business_id')->orWhere('business_id', $businessId))
            ->with('permissions')
            ->orderBy('name')
            ->get();

        return ApiResponse::success($roles->map(fn (Role $role) => $this->presentRole($role))->values()->all());
    }

    public function createRole(Request $request)
    {
        abort_unless($request->user()->can('staff.permissions'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ]);

        if (Role::query()->where('name', $data['name'])->where('guard_name', 'web')->exists()) {
            throw new ApiException('ROLE_EXISTS', 'A role with this name already exists.', 422, [
                'name' => ['A role with this name already exists.'],
            ]);
        }

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->forceFill(['business_id' => TenantContext::businessId()])->save();

        $permissions = array_values(array_intersect($data['permissions'] ?? [], PermissionCatalog::all()));
        $role->syncPermissions($permissions);

        AuditLog::record('role.created', 'role', $role->id, ['name' => $role->name]);

        return ApiResponse::success($this->presentRole($role->load('permissions')), 'Role created.');
    }

    public function permissions(Request $request)
    {
        abort_unless($request->user()->can('staff.view') || $request->user()->can('staff.permissions'), 403);

        return ApiResponse::success(PermissionCatalog::catalog());
    }

    public function staffPermissions(Request $request, int $staff)
    {
        abort_unless($request->user()->can('staff.permissions') || $request->user()->can('staff.view'), 403);

        $user = $this->find($staff);

        return ApiResponse::success([
            'user_id' => $user->id,
            'name' => $user->name,
            'roles' => $user->getRoleNames()->values()->all(),
            'permissions' => $user->getDirectPermissions()->pluck('name')->values()->all(),
            'effective_permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'catalog' => PermissionCatalog::catalog(),
        ]);
    }

    public function syncPermissions(Request $request, int $staff)
    {
        abort_unless($request->user()->can('staff.permissions'), 403);

        $user = $this->find($staff);

        if ($user->id === $request->user()->id) {
            throw new ApiException('CANNOT_EDIT_OWN_PERMISSIONS', 'You cannot change your own permissions.', 422);
        }

        $data = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string'],
        ]);

        $requested = array_values(array_intersect($data['permissions'], PermissionCatalog::all()));

        if (! $request->user()->isSuperAdmin()) {
            $actorPermissions = $request->user()->getAllPermissions()->pluck('name')->all();
            $requested = array_values(array_intersect($requested, $actorPermissions));
        }

        $user->syncPermissions($requested);

        AuditLog::record('staff.permissions_synced', 'user', $user->id, ['permissions' => $requested]);

        $fresh = User::with(['permissions', 'roles.permissions'])->findOrFail($user->id);

        return ApiResponse::success([
            'user_id' => $fresh->id,
            'permissions' => $fresh->getDirectPermissions()->pluck('name')->values()->all(),
            'effective_permissions' => $fresh->getAllPermissions()->pluck('name')->values()->all(),
        ], 'Permissions updated.');
    }

    public function activity(Request $request)
    {
        abort_unless($request->user()->can('staff.view') || $request->user()->can('audit.view'), 403);

        $perPage = $this->perPage($request);

        $paginator = AuditLog::query()
            ->where('business_id', TenantContext::businessId())
            ->with('user:id,name')
            ->orderByDesc('id')
            ->paginate($perPage);

        return ApiResponse::paginator($paginator, map: fn (AuditLog $log) => [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user?->name ?? 'System',
            'action' => $log->action,
            'description' => trim(($log->entity_type ?? '').($log->entity_id ? ' #'.$log->entity_id : '')),
            'ip' => $log->ip_address,
            'created_at' => $log->created_at?->toIso8601String(),
        ]);
    }

    public function sessions(Request $request)
    {
        $sessions = UserSession::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('is_current')
            ->orderByDesc('last_active_at')
            ->get();

        return ApiResponse::success($sessions->map(fn (UserSession $session) => [
            'id' => $session->id,
            'device' => $session->device ?? 'Unknown device',
            'ip' => $session->ip,
            'is_current' => $session->is_current,
            'last_active_at' => $session->last_active_at?->toIso8601String(),
        ])->values()->all());
    }

    public function revokeSession(Request $request, int $session)
    {
        $record = UserSession::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($session);

        if ($record->is_current) {
            throw new ApiException('CANNOT_REVOKE_CURRENT', 'You cannot revoke your current session.', 422);
        }

        if ($record->personal_access_token_id !== null) {
            $request->user()->tokens()->whereKey($record->personal_access_token_id)->delete();
        }

        $record->delete();

        return ApiResponse::success(null, 'Session revoked.');
    }

    private function find(int $id): User
    {
        return User::query()
            ->where('business_id', TenantContext::businessId())
            ->findOrFail($id);
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatar_url,
            'roles' => $user->getRoleNames()->values()->all(),
            'branch_ids' => $user->branch_ids ?? [],
            'is_active' => (bool) $user->is_active,
            'last_active_at' => $user->last_login_at?->toIso8601String(),
        ];
    }

    private function presentRole(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'description' => null,
            'is_custom' => $role->business_id !== null,
            'permissions' => $role->permissions->pluck('name')->values()->all(),
        ];
    }

    /**
     * @param  array<int, string>  $names
     * @return array<int, string>
     */
    private function allowedRoles(array $names): array
    {
        $businessId = TenantContext::businessId();

        return Role::query()
            ->whereIn('name', $names)
            ->where(fn ($q) => $q->whereNull('business_id')->orWhere('business_id', $businessId))
            ->pluck('name')
            ->values()
            ->all();
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}