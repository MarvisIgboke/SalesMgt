<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use \App\Support\BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'user_id',
        'branch_id',
        'type',
        'title',
        'body',
        'data',
        'is_read',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Queue an in-app notification for one user.
     */
    public static function push(
        int $userId,
        string $type,
        string $title,
        ?string $body = null,
        array $data = [],
        ?int $branchId = null,
    ): self {
        return static::create([
            'business_id' => \App\Support\TenantContext::businessId() ?? optional(\App\Models\User::find($userId))->business_id,
            'user_id' => $userId,
            'branch_id' => $branchId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data === [] ? null : $data,
        ]);
    }
}