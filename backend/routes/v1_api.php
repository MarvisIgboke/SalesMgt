<?php

use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerPaymentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\ExpiryController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\FinancialReportController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RiskController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\SaleSessionController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

// Business & active context.
Route::get('/business/context', [BusinessController::class, 'context']);
Route::get('/businesses', [BusinessController::class, 'listBusinesses']);
Route::post('/businesses', [BusinessController::class, 'storeBusiness']);
Route::post('/businesses/{business}/plan', [BusinessController::class, 'assignPlan'])->whereNumber('business');
Route::post('/business/switch-branch', [BusinessController::class, 'switchBranch']);
Route::get('/branches/summary', [BusinessController::class, 'branchesSummary']);
Route::get('/branches', [BusinessController::class, 'branches']);
Route::post('/branches', [BusinessController::class, 'storeBranch']);
Route::put('/branches/{branch}', [BusinessController::class, 'updateBranch'])->whereNumber('branch');
Route::delete('/branches/{branch}', [BusinessController::class, 'destroyBranch'])->whereNumber('branch');

// Platform user directory (Super Admin only).
Route::get('/users', [UserController::class, 'index']);
Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->whereNumber('user');
Route::post('/users/{user}/toggle-active', [UserController::class, 'toggleActive'])->whereNumber('user');

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
Route::get('/catalog/overview', [CatalogController::class, 'overview']);
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
Route::post('/products/{product}/barcodes', [ProductController::class, 'addBarcode'])->whereNumber('product');
Route::delete('/products/{product}/barcodes/{barcode}', [ProductController::class, 'removeBarcode'])->whereNumber('product');

// Staff.
Route::get('/staff', [StaffController::class, 'index']);
Route::get('/staff/summary', [StaffController::class, 'summary']);
Route::post('/staff', [StaffController::class, 'store'])->middleware('idempotent');
Route::get('/staff/roles', [StaffController::class, 'roles']);
Route::post('/staff/roles', [StaffController::class, 'createRole']);
Route::get('/staff/permissions', [StaffController::class, 'permissions']);
Route::get('/staff/activity', [StaffController::class, 'activity']);
Route::get('/staff/sessions', [StaffController::class, 'sessions']);
Route::delete('/staff/sessions/{session}', [StaffController::class, 'revokeSession'])->whereNumber('session');
Route::get('/staff/{staff}', [StaffController::class, 'show'])->whereNumber('staff');
Route::put('/staff/{staff}', [StaffController::class, 'update'])->whereNumber('staff');
Route::get('/staff/{staff}/permissions', [StaffController::class, 'staffPermissions'])->whereNumber('staff');
Route::put('/staff/{staff}/permissions', [StaffController::class, 'syncPermissions'])->whereNumber('staff');

// Customers & credit ledger.
Route::get('/customers', [CustomerController::class, 'index']);
Route::get('/customers/summary', [CustomerController::class, 'summary']);
Route::post('/customers', [CustomerController::class, 'store'])->middleware('idempotent');
Route::get('/customers/{customer}/statement', [CustomerController::class, 'statement'])->whereNumber('customer');
Route::get('/customers/{customer}/purchases', [CustomerController::class, 'purchases'])->whereNumber('customer');
Route::get('/customers/{customer}/payments', [CustomerController::class, 'payments'])->whereNumber('customer');
Route::get('/customers/{customer}', [CustomerController::class, 'show'])->whereNumber('customer');
Route::put('/customers/{customer}', [CustomerController::class, 'update'])->whereNumber('customer');
Route::post('/customer-payments', [CustomerPaymentController::class, 'store'])->middleware('idempotent');

// Suppliers.
Route::get('/suppliers', [SupplierController::class, 'index']);
Route::get('/suppliers/summary', [SupplierController::class, 'summary']);
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

// Departments (everyone can view; only the store manager can manage).
Route::get('/departments', [DepartmentController::class, 'index']);
Route::post('/departments', [DepartmentController::class, 'store'])->middleware('idempotent');
Route::put('/departments/{department}', [DepartmentController::class, 'update'])->middleware('idempotent')->whereNumber('department');
Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->whereNumber('department');

// Shifts.
Route::get('/shifts/history/summary', [ShiftController::class, 'historySummary']);
Route::get('/shifts', [ShiftController::class, 'history']);
Route::get('/shifts/config', [ShiftController::class, 'config']);
Route::put('/shifts/config', [ShiftController::class, 'setConfig']);
Route::get('/shifts/current', [ShiftController::class, 'current']);
Route::post('/shifts/open', [ShiftController::class, 'open'])->middleware('idempotent');
Route::post('/shifts/close', [ShiftController::class, 'close'])->middleware('idempotent');
Route::post('/shifts/reconcile', [ShiftController::class, 'reconcile']);
Route::get('/shifts/{shift}', [ShiftController::class, 'show'])->whereNumber('shift');
Route::post('/shifts/{shift}/movements', [ShiftController::class, 'storeMovement'])->middleware('idempotent')->whereNumber('shift');
// Sale sessions (a sales rep opens/closes a sale within an open shift).
Route::get('/sale-sessions', [SaleSessionController::class, 'index']);
Route::get('/sale-sessions/current', [SaleSessionController::class, 'current']);
Route::post('/sale-sessions/open', [SaleSessionController::class, 'open'])->middleware('idempotent');
Route::post('/sale-sessions/{saleSession}/close', [SaleSessionController::class, 'close'])->middleware('idempotent')->whereNumber('saleSession');
Route::get('/sale-sessions/{saleSession}', [SaleSessionController::class, 'show'])->whereNumber('saleSession');

// Inventory.
Route::get('/inventory/dashboard', [InventoryController::class, 'dashboard']);
Route::get('/inventory/levels', [InventoryController::class, 'levels']);
Route::get('/inventory/movements', [InventoryController::class, 'movements']);
Route::get('/inventory/trace/{product}', [InventoryController::class, 'trace'])->whereNumber('product');
Route::post('/inventory/adjustments', [InventoryController::class, 'adjust'])->middleware('idempotent');
Route::get('/inventory/transfers', [InventoryController::class, 'transfers']);
Route::post('/inventory/transfers', [InventoryController::class, 'transfer'])->middleware('idempotent');
Route::get('/inventory/goods-received', [InventoryController::class, 'goodsReceivedList']);
Route::post('/inventory/goods-received', [InventoryController::class, 'goodsReceived'])->middleware('idempotent');
Route::get('/inventory/damaged', [InventoryController::class, 'damaged']);
Route::get('/inventory/expired', [InventoryController::class, 'expired']);
Route::get('/inventory/batches', [InventoryController::class, 'batches']);
Route::get('/inventory/approvals', [InventoryController::class, 'approvals']);
Route::post('/inventory/approvals/{adjustment}', [InventoryController::class, 'approve'])->whereNumber('adjustment');

// Expiry.
Route::get('/expiry/dashboard', [ExpiryController::class, 'dashboard']);
Route::get('/expiry/items', [ExpiryController::class, 'items']);
Route::get('/expiry/buckets', [ExpiryController::class, 'buckets']);

// Point of sale.
Route::get('/pos/search', [PosController::class, 'search']);
Route::get('/pos/barcode/{barcode}', [PosController::class, 'barcode']);
Route::get('/pos/cart', [PosController::class, 'getCart']);
Route::post('/pos/cart/items', [PosController::class, 'addItem']);
Route::post('/pos/cart/customer', [PosController::class, 'setCustomer']);
Route::put('/pos/cart/items/{line}', [PosController::class, 'updateItem'])->whereNumber('line');
Route::delete('/pos/cart/items/{line}', [PosController::class, 'removeItem'])->whereNumber('line');
Route::post('/pos/sales/initialize', [PosController::class, 'initialize']);
Route::post('/pos/sales/charge', [PosController::class, 'charge'])->middleware('idempotent');
Route::post('/pos/sales/hold', [PosController::class, 'hold']);
Route::post('/pos/sales/resume', [PosController::class, 'resume']);
Route::get('/pos/receipts/{reference}', [PosController::class, 'receipt']);

// Sales management & refunds.
Route::get('/sales', [SalesController::class, 'index']);
Route::get('/sales/{sale}', [SalesController::class, 'show'])->whereNumber('sale');
Route::post('/sales/{sale}/cancel', [SalesController::class, 'cancel'])->whereNumber('sale')->middleware('idempotent');
Route::post('/sales/{sale}/refund', [SalesController::class, 'refund'])->whereNumber('sale')->middleware('idempotent');

// Purchasing.
Route::get('/purchasing/summary', [PurchasingController::class, 'summary']);
Route::get('/purchasing/requisitions', [PurchasingController::class, 'requisitions']);
Route::post('/purchasing/requisitions', [PurchasingController::class, 'createRequisition'])->middleware('idempotent');
Route::get('/purchasing/orders', [PurchasingController::class, 'orders']);
Route::post('/purchasing/orders', [PurchasingController::class, 'createOrder'])->middleware('idempotent');
Route::get('/purchasing/orders/{order}', [PurchasingController::class, 'order'])->whereNumber('order');
Route::post('/purchasing/orders/{order}/status', [PurchasingController::class, 'updateOrderStatus'])->whereNumber('order');
Route::get('/purchasing/invoices', [PurchasingController::class, 'invoices']);
Route::get('/purchasing/payments', [PurchasingController::class, 'payments']);
Route::get('/purchasing/returns', [PurchasingController::class, 'returns']);

// Finance.
Route::get('/finance/approvals', [FinanceController::class, 'approvals']);
Route::post('/finance/approvals/{approval}', [FinanceController::class, 'decide'])->whereNumber('approval');
Route::get('/finance/reconciliation', [FinanceController::class, 'reconciliation']);
Route::get('/finance/receivables-summary', [FinanceController::class, 'receivables']);
Route::get('/finance/payables-summary', [FinanceController::class, 'payables']);

// Reports.
Route::get('/reports', [ReportController::class, 'show']);
Route::get('/reports/financial', [FinancialReportController::class, 'summary']);
Route::get('/reports/export/{format}', [ReportController::class, 'export']);
Route::get('/reports/download/{file}', [ReportController::class, 'download'])->where('file', '[A-Za-z0-9_.-]+');

// Notifications.
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/summary', [NotificationController::class, 'summary']);
Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
Route::post('/notifications/subscribe', [NotificationController::class, 'subscribe']);
Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->whereNumber('notification');

// Global search.
Route::get('/search', [SearchController::class, 'global']);

// Settings.
Route::get('/settings/preferences', [SettingsController::class, 'preferences']);
Route::get('/settings', [SettingsController::class, 'show']);
Route::put('/settings', [SettingsController::class, 'update']);

// Audit & risk.
Route::get('/audit-logs', [AuditController::class, 'index']);
Route::get('/audit-logs/{audit}', [AuditController::class, 'show'])->whereNumber('audit');
Route::get('/risk-flags', [RiskController::class, 'index']);
Route::post('/risk-flags/{flag}/resolve', [RiskController::class, 'resolve'])->whereNumber('flag');
