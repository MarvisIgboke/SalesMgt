<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

final class ApiResponse
{
    public static function success(mixed $data, ?string $message = null): array
    {
        $payload = ['success' => true, 'data' => $data];

        if ($message !== null) {
            $payload['message'] = $message;
        }

        return $payload;
    }

    public static function error(
        string $code,
        string $message,
        ?array $errors = null,
        ?Request $request = null,
        int $status = 400,
        ?array $debug = null,
    ): array {
        $payload = [
            'success' => false,
            'code' => $code,
            'message' => $message,
        ];

        if ($errors !== null && $errors !== []) {
            $payload['errors'] = $errors;
        }

        if ($request !== null) {
            $requestId = $request->attributes->get('request_id');
            if ($requestId !== null) {
                $payload['request_id'] = $requestId;
            }
        }

        if ($debug !== null) {
            $payload['debug'] = $debug;
        }

        return $payload;
    }

    public static function paginator(
        LengthAwarePaginator $paginator,
        ?string $message = null,
        ?callable $map = null,
        array $extra = [],
    ): array {
        $items = $paginator->getCollection()->all();

        if ($map !== null) {
            $items = array_map($map, $items);
        }

        $payload = [
            'success' => true,
            'data' => array_values($items),
            'meta' => array_merge([
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ], $extra),
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
        ];

        if ($message !== null) {
            $payload['message'] = $message;
        }

        return $payload;
    }

    public static function errorHeaders(Request $request): array
    {
        $requestId = $request->attributes->get('request_id');

        return $requestId !== null ? ['X-Request-Id' => $requestId] : [];
    }
}