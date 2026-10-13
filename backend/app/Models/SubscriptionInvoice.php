<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionInvoice extends Model
{
    use BelongsToBusiness;

    public const STATUSES = ['unpaid', 'paid', 'void'];

    protected $fillable = [
        'business_id',
        'subscription_id',
        'number',
        'status',
        'period_start',
        'period_end',
        'issued_at',
        'due_at',
        'amount',
        'currency',
        'paid_at',
        'paid_by',
        'payment_reference',
        'notes',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'issued_at' => 'date',
            'due_at' => 'date',
            'paid_at' => 'datetime',
            'amount' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    public function isOverdue(): bool
    {
        return $this->status === 'unpaid'
            && $this->due_at !== null
            && $this->due_at->isPast();
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status,
            'business_id' => $this->business_id,
            'business_name' => $this->relationLoaded('business') ? $this->business?->name : null,
            'period_start' => $this->period_start?->toDateString(),
            'period_end' => $this->period_end?->toDateString(),
            'issued_at' => $this->issued_at?->toDateString(),
            'due_at' => $this->due_at?->toDateString(),
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'paid_by' => $this->relationLoaded('paidBy') ? $this->paidBy?->name : null,
            'payment_reference' => $this->payment_reference,
            'notes' => $this->notes,
            'is_overdue' => $this->isOverdue(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
