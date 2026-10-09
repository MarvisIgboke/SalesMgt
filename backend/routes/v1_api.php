<?php

use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerPaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

// Business & active context.
Route::get('/business/context', [BusinessController::class, 'context']);
Route::get('/businesses', [BusinessController::class, 'listBusinesses']);
Route::post('/business/switch-branch', [BusinessController::class, 'switchBranch']);
Route::get('/branches', [BusinessController::class, 'branches']);

// Wallet & subscription.
Route::get('/wallet', [WalletController::class, 'show']);
Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
Route::get('/subscription', [SubscriptionController::class, 'show']);
Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);

// Dashboard.
Route::get('/dashboard', [DashboardController::class, 'show']);

// Catalog lookups.
Route::get('/product-categories', [CatalogController::class, 'categories']);
Route::get('/product-brands', [CatalogController::class, 'brands']);

// Products.
Route::get('/products', [ProductController::class, 'index']);
Route::post('/products', [ProductController::class, 'store'])->middleware('idempotent');
Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
Route::put('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
Route::delete('/products/{product}', [ProductController::class, 'destroy'])->whereNumber('product');
Route::post('/products/{product}/barcodes', [ProductController::class, 'addBarcode'])->whereNumber('product');
Route::delete('/products/{product}/barcodes/{barcode}', [ProductController::class, 'removeBarcode'])->whereNumber('product');

// Staff.
Route::get('/staff', [StaffController::class, 'index']);
Route::post('/staff', [StaffController::class, 'store'])->middleware('idempotent');
Route::get('/staff/roles', [StaffController::class, 'roles']);
Route::post('/staff/roles', [StaffController::class, 'createRole']);
Route::get('/staff/permissions', [StaffController::class, 'permissions']);
Route::get('/staff/activity', [StaffController::class, 'activity']);
Route::get('/staff/sessions', [StaffController::class, 'sessions']);
Route::delete('/staff/sessions/{session}', [StaffController::class, 'revokeSession'])->whereNumber('session');
Route::get('/staff/{staff}', [StaffController::class, 'show'])->whereNumber('staff');
Route::put('/staff/{staff}', [StaffController::class, 'update'])->whereNumber('staff');

// Customers & credit ledger.
Route::get('/customers', [CustomerController::class, 'index']);
Route::post('/customers', [CustomerController::class, 'store'])->middleware('idempotent');
Route::get('/customers/{customer}/statement', [CustomerController::class, 'statement'])->whereNumber('customer');
Route::get('/customers/{customer}/purchases', [CustomerController::class, 'purchases'])->whereNumber('customer');
Route::get('/customers/{customer}/payments', [CustomerController::class, 'payments'])->whereNumber('customer');
Route::get('/customers/{customer}', [CustomerController::class, 'show'])->whereNumber('customer');
Route::put('/customers/{customer}', [CustomerController::class, 'update'])->whereNumber('customer');
Route::post('/customer-payments', [CustomerPaymentController::class, 'store'])->middleware('idempotent');

// Suppliers.
Route::get('/suppliers', [SupplierController::class, 'index']);
Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('idempotent');
Route::get('/suppliers/{supplier}/purchases', [SupplierController::class, 'purchases'])->whereNumber('supplier');
Route::get('/suppliers/{supplier}/payments', [SupplierController::class, 'payments'])->whereNumber('supplier');
Route::get('/suppliers/{supplier}', [SupplierController::class, 'show'])->whereNumber('supplier');
Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->whereNumber('supplier');

// Expenses.
Route::get('/expenses', [ExpenseController::class, 'index']);
Route::post('/expenses', [ExpenseController::class, 'create'])->middleware('idempotent');
Route::get('/expenses/dashboard', [ExpenseController::class, 'dashboard']);
Route::get('/expenses/categories', [ExpenseController::class, 'categories']);
Route::get('/expenses/approvals', [ExpenseController::class, 'approvals']);
Route::post('/expenses/{expense}/decision', [ExpenseController::class, 'decide'])->whereNumber('expense');

// Shifts.
Route::get('/shifts', [ShiftController::class, 'history']);
Route::get('/shifts/config', [ShiftController::class, 'config']);
Route::put('/shifts/config', [ShiftController::class, 'setConfig']);
Route::get('/shifts/current', [ShiftController::class, 'current']);
Route::post('/shifts/open', [ShiftController::class, 'open'])->middleware('idempotent');
Route::post('/shifts/close', [ShiftController::class, 'close'])->middleware('idempotent');
Route::post('/shifts/reconcile', [ShiftController::class, 'reconcile']);