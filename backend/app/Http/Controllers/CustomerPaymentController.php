<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Services\CustomerLedgerService;
use App\Support\ApiResponse;
use App\Support\AuditLog;
use Illuminate\Http\Request;

class CustomerPaymentController extends Controller
{
    public function __construct(private readonly CustomerLedgerService $ledger)
    {
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('customers.credit'), 403);

        $data = $request->validate([
            'customer_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['required', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $customer = Customer::query()->findOrFail($data['customer_id']);

        [$payment] = $this->ledger->recordPayment(
            $customer,
            (float) $data['amount'],
            $data['method'],
            $data['reference'] ?? null,
            $data['notes'] ?? null,
        );

        AuditLog::record('customer.payment', 'customer', $customer->id, [
            'amount' => $payment->amount,
            'method' => $payment->method,
        ]);

        return ApiResponse::success(['id' => $payment->id], 'Payment recorded.');
    }
}