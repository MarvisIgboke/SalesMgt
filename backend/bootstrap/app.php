<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureSubscriptionActive;
use App\Http\Middleware\Idempotency;
use App\Http\Middleware\SetRequestId;
use App\Http\Middleware\SetTenancyContext;
use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(append: [
            SetRequestId::class,
        ]);

        $middleware->statefulApi();

        $middleware->alias([
            'tenant' => SetTenancyContext::class,
            'idempotent' => Idempotency::class,
            'subscription.active' => EnsureSubscriptionActive::class,
        ]);

        $middleware->redirectGuestsTo(fn () => response()->json(ApiResponse::error(
            'AUTH_REQUIRED',
            'Unauthenticated.',
            status: 401,
        ), 401));
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (ApiException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(
                $e->toArray(),
                $e->getStatusCode(),
                ApiResponse::errorHeaders($request),
            );
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                'VALIDATION_ERROR',
                'The request could not be completed.',
                errors: $e->errors(),
                request: $request,
            ), 422, ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                'AUTH_REQUIRED',
                'Unauthenticated.',
                request: $request,
            ), 401, ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                'FORBIDDEN',
                'You do not have permission to perform this action.',
                request: $request,
            ), 403, ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                'NOT_FOUND',
                'The requested resource was not found.',
                request: $request,
            ), 404, ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                'NOT_FOUND',
                $e->getMessage() ?: 'The requested endpoint was not found.',
                request: $request,
            ), 404, ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (HttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json(ApiResponse::error(
                sprintf('HTTP_%s', $e->getStatusCode()),
                $e->getMessage() ?: 'The request could not be completed.',
                request: $request,
            ), $e->getStatusCode(), ApiResponse::errorHeaders($request));
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $detailed = $request->header('Accept') === 'application/json'
                && app()->hasDebugModeEnabled();

            return response()->json(ApiResponse::error(
                'SERVER_ERROR',
                'An unexpected error occurred.',
                request: $request,
                debug: $detailed ? [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ] : null,
            ), 500, ApiResponse::errorHeaders($request));
        });
    })->create();