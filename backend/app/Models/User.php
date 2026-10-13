<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Contracts\Permission;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;
    use HasRoles {
        hasPermissionTo as protected spatieHasPermissionTo;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'business_id',
        'department_id',
        'phone',
        'avatar_url',
        'branch_ids',
        'is_active',
        'revoked_permissions',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'branch_ids' => 'array',
            'revoked_permissions' => 'array',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function departmentId(): ?int
    {
        return $this->department_id === null ? null : (int) $this->department_id;
    }

    public function hasBranchAccess(int $branchId): bool
    {
        $allowed = $this->branch_ids ?? [];

        return $allowed === [] || in_array($branchId, $allowed, true);
    }

    public function canAccessBusiness(int $businessId): bool
    {
        return $this->business_id === $businessId;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('Super Admin');
    }

    /**
     * Resolve a permission identifier to its string name, when possible.
     */
    private function permissionName(mixed $permission): ?string
    {
        if (is_string($permission)) {
            return $permission;
        }

        if ($permission instanceof Permission) {
            return $permission->name;
        }

        if ($permission instanceof \BackedEnum) {
            return (string) $permission->value;
        }

        return null;
    }

    /**
     * Honor explicitly revoked permissions on top of Spatie's role/direct checks.
     */
    public function hasPermissionTo($permission, $guardName = null): bool
    {
        $name = $this->permissionName($permission);

        if ($name !== null && in_array($name, $this->revoked_permissions ?? [], true)) {
            return false;
        }

        return $this->spatieHasPermissionTo($permission, $guardName);
    }

    public function getAllPermissions(): Collection
    {
        $revoked = $this->revoked_permissions ?? [];

        return $this->permissions
            ->merge($this->getPermissionsViaRoles())
            ->reject(fn ($permission) => in_array($permission->name, $revoked, true))
            ->sort()
            ->values();
    }
}