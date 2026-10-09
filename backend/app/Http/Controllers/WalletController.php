<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\WalletTransaction;
use App\Support\ApiResponse;
use App\Support\Presenter;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function show(Request $request)
    {
        abort_unless($request->user()->can('wallet.view'), 403);

        $business = Business::query()->with('wallet')->findOrFail(TenantContext::businessId());

        return ApiResponse::success(Presenter::wallet($business->wallet, $business->currency));
    }

    public function transactions(Request $request)
    {
        abort_unless($request->user()->can('wallet.view') || $request->user()->can('wallet.transactions'), 403);

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        $transactions = WalletTransaction::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->orderByDesc('id')
            ->paginate($perPage);

        return ApiResponse::paginator($transactions, map: fn (WalletTransaction $tx) => [
            'id' => $tx->id,
            'type' => $tx->type,
            'amount' => $tx->amount,
            'balance_before' => $tx->balance_before,
            'balance_after' => $tx->balance_after,
            'reference' => $tx->reference,
            'method' => $tx->method,
            'status' => $tx->status,
            'meta' => $tx->meta,
            'created_at' => $tx->created_at?->toIso8601String(),
        ]);
    }
}