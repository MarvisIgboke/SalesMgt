<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Printer extends Model
{
    use BelongsToBusiness;

    public const TYPES = ['receipt', 'kitchen', 'label', 'a4', 'report'];

    public const CONNECTIONS = ['network', 'usb', 'bluetooth', 'system'];

    public const PAPER_WIDTHS = ['58mm', '80mm', 'a4'];

    public const STATUSES = ['online', 'offline', 'unknown'];

    protected $fillable = [
        'business_id',
        'branch_id',
        'name',
        'type',
        'connection',
        'address',
        'paper_width',
        'is_default',
        'is_active',
        'auto_print_receipts',
        'print_kitchen_tickets',
        'print_labels',
        'status',
        'last_seen_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'auto_print_receipts' => 'boolean',
            'print_kitchen_tickets' => 'boolean',
            'print_labels' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function toApi(): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'connection' => $this->connection,
            'address' => $this->address,
            'paper_width' => $this->paper_width,
            'is_default' => (bool) $this->is_default,
            'is_active' => (bool) $this->is_active,
            'auto_print_receipts' => (bool) $this->auto_print_receipts,
            'print_kitchen_tickets' => (bool) $this->print_kitchen_tickets,
            'print_labels' => (bool) $this->print_labels,
            'status' => $this->resolvedStatus(),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'branch_id' => $this->branch_id !== null ? (int) $this->branch_id : null,
            'branch_name' => $this->branch?->name,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * An inactive printer always reads as offline; otherwise trust the last
     * connection check but degrade to offline when it is stale.
     */
    public function resolvedStatus(): string
    {
        if (! $this->is_active) {
            return 'offline';
        }

        if ($this->status === 'online' && $this->last_seen_at !== null
            && $this->last_seen_at->lt(now()->subMinutes(15))) {
            return 'offline';
        }

        return in_array($this->status, self::STATUSES, true) ? $this->status : 'unknown';
    }
}
