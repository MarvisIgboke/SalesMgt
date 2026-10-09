<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use App\Support\TenantContext;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class Idempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('X-Client-Request-Id');

        if ($key === null || ! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $next($request);
        }

        $user = $request->user() ?? Auth::user();

        if ($user === null) {
            return $next($request);
        }

        $scope = [
            'X-Client-Request-Id' => $key,
            'user_id' => $user->id,
            'business_id' => TenantContext::businessId(),
            'path' => $request->path(),
        ];

        $existing = IdempotencyKey::query()
            ->where('key', $key)
            ->where('user_id', $user->id)
            ->where('path', $request->path())
            ->first();

        if ($existing) {
            return response($existing->response_json, $existing->response_status, [
                'Content-Type' => 'application/json',
                'X-Idempotent-Replay' => 'true',
            ]);
        }

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            throw $e;
        }

        if ($response->getStatusCode() < 500) {
            try {
                IdempotencyKey::create([
                    'key' => $key,
                    'user_id' => $user->id,
                    'business_id' => TenantContext::businessId(),
                    'path' => $request->path(),
                    'request_method' => $request->method(),
                    'request_data' => $request->except(['password']),
                    'response_status' => $response->getStatusCode(),
                    'response_json' => $response->getContent(),
                ]);
            } catch (QueryException $e) {
                // Unique key raced with a concurrent identical request; replay what won.
                $winner = IdempotencyKey::query()
                    ->where('key', $key)
                    ->where('user_id', $user->id)
                    ->where('path', $request->path())
                    ->first();

                if ($winner) {
                    return response($winner->response_json, $winner->response_status, [
                        'Content-Type' => 'application/json',
                        'X-Idempotent-Replay' => 'true',
                    ]);
                }

                throw $e;
            }
        }

        return $response;
    }
}