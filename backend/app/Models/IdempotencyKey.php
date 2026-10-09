<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IdempotencyKey extends Model
{
    protected $fillable = [
        'key',
        'user_id',
        'business_id',
        'path',
        'request_method',
        'request_data',
        'response_status',
        'response_json',
    ];

    protected function casts(): array
    {
        return [
            'request_data' => 'array',
            'response_status' => 'integer',
        ];
    }
}