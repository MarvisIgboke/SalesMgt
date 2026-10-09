<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Unauthenticated endpoints.
    require __DIR__.'/v1_auth.php';

    // Authenticated, tenant-scoped endpoints.
    Route::middleware(['auth:sanctum', 'tenant', 'throttle:auth-api'])->group(function () {
        require __DIR__.'/v1_api.php';
    });
});

// Public health (no auth).
Route::get('/v1/health', fn () => response()->json([
    'success' => true,
    'data' => ['status' => 'ok', 'time' => now()->toIso8601String()],
]))->name('api.health');