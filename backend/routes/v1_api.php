<?php

use App\Http\Controllers\AuditController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerPaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ExpiryController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RiskController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

// Business & active context.
Route::get('/business/context', [BusinessController::class, 'context']);
Route::get('/businesses', [BusinessController::class, 'listBusinesses']);
Route::post('/businesses', [BusinessController::class, 'storeBusiness']);
Route::post('/business/switch-branch', [BusinessController::class, 'switchBranch']);
Route::get('/branches', [BusinessController::class, 'branches']);
Route::post('/branches', [BusinessController::class, 'storeBranch']);
Route::put('/branches/{branch}', [BusinessController::class, 'updateBranch'])->whereNumber('branch');
Route::delete('/branches/{branch}', [BusinessController::class, 'destroyBranch'])->whereNumber('branch');

// Wallet & subscription.
Route::get('/wallet', [WalletController::class, 'show']);
Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
Route::get('/subscription', [SubscriptionController::class, 'show']);
Route::get('/subscription/plans', [SubscriptionController::class, 'plans']);
Route::post('/subscription/plans', [SubscriptionController::class, 'storePlan']);
Route::put('/subscription/plans/{plan}', [SubscriptionController::class, 'updatePlan'])->whereNumber('plan');
Route::delete('/subscription/plans/{plan}', [SubscriptionController::class, 'destroyPlan'])->whereNumber('plan');

// Dashboard.
Route::get('/dashboard', [DashboardController::class, 'show']);

// Catalog lookups.
Route::get('/product-categories', [CatalogController::class, 'categories']);
Route::post('/product-categories', [CatalogController::class, 'storeCategory']);
Route::put('/product-categories/{category}', [CatalogController::class, 'updateCategory'])->whereNumber('category');
Route::delete('/product-categories/{category}', [CatalogController::class, 'destroyCategory'])->whereNumber('category');
Route::get('/product-brands', [CatalogController::class, 'brands']);
Route::post('/product-brands', [CatalogController::class, 'storeBrand']);
Route::put('/product-brands/{brand}', [CatalogController::class, 'updateBrand'])->whereNumber('brand');
Route::delete('/product-brands/{brand}', [CatalogController::class, 'destroyBrand'])->whereNumber('brand');

// Products.
Route::get('/products', [ProductController::class, 'index']);
Route::post('/products', [ProductController::class, 'store'])->middleware('idempotent');
Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
Route::put('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
Route::delete('/products/{product}', [ProductController::class, 'destroy'])->whereNumber('product');
Route::post('/products/{product}/barcodes', [ProductController::class, 'addBarcode'])->whereNumber('product')->middleware('idempotent');
Route::delete('/products/{product}/barcodes/{barcode}', [ProductController::class, 'removeBarcode'])->whereNumber('product');
