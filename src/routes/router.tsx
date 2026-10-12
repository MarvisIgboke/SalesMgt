import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { AuthBootstrap } from './auth-bootstrap'
import { RequireAuth, RedirectIfAuthed } from './guards'
import { LoadingState } from '@/components/common/loading-state'

function Page({
  children,
  variant = 'cards',
}: {
  children: ReactNode
  variant?: 'dashboard' | 'table' | 'cards'
}) {
  return <Suspense fallback={<LoadingState variant={variant} />}>{children}</Suspense>
}

const DashboardPage = lazy(() =>
  import('@/pages/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
)
const PosPage = lazy(() => import('@/pages/pos/pos-page').then((m) => ({ default: m.PosPage })))
const SalesHistoryPage = lazy(() =>
  import('@/pages/sales/sales-history-page').then((m) => ({ default: m.SalesHistoryPage })),
)
const ProductsPage = lazy(() =>
  import('@/pages/products/products-page').then((m) => ({ default: m.ProductsPage })),
)
const CatalogPage = lazy(() =>
  import('@/pages/catalog/catalog-page').then((m) => ({ default: m.CatalogPage })),
)
const DepartmentsPage = lazy(() =>
  import('@/pages/departments/departments-page').then((m) => ({ default: m.DepartmentsPage })),
)
const InventoryPage = lazy(() =>
  import('@/pages/inventory/inventory-page').then((m) => ({ default: m.InventoryPage })),
)
const StockTracePage = lazy(() =>
  import('@/pages/inventory/stock-trace-page').then((m) => ({ default: m.StockTracePage })),
)
const ExpiryPage = lazy(() =>
  import('@/pages/expiry/expiry-page').then((m) => ({ default: m.ExpiryPage })),
)
const CustomersPage = lazy(() =>
  import('@/pages/customers/customers-page').then((m) => ({ default: m.CustomersPage })),
)
const PurchasingPage = lazy(() =>
  import('@/pages/purchasing/purchasing-page').then((m) => ({ default: m.PurchasingPage })),
)
const SuppliersPage = lazy(() =>
  import('@/pages/suppliers/suppliers-page').then((m) => ({ default: m.SuppliersPage })),
)
const FinancePage = lazy(() =>
  import('@/pages/finance/finance-page').then((m) => ({ default: m.FinancePage })),
)
const ExpensesPage = lazy(() =>
  import('@/pages/expenses/expenses-page').then((m) => ({ default: m.ExpensesPage })),
)
const StaffPage = lazy(() => import('@/pages/staff/staff-page').then((m) => ({ default: m.StaffPage })))
const BranchesPage = lazy(() =>
  import('@/pages/branches/branches-page').then((m) => ({ default: m.BranchesPage })),
)
const BusinessesPage = lazy(() =>
  import('@/pages/businesses/businesses-page').then((m) => ({ default: m.BusinessesPage })),
)
const ShiftsPage = lazy(() =>
  import('@/pages/shifts/shifts-page').then((m) => ({ default: m.ShiftsPage })),
)
const ShiftDetailPage = lazy(() =>
  import('@/pages/shifts/shift-detail-page').then((m) => ({ default: m.ShiftDetailPage })),
)
const ShiftHistoryPage = lazy(() =>
  import('@/pages/shifts/shift-history-page').then((m) => ({ default: m.ShiftHistoryPage })),
)
const SaleSessionPage = lazy(() =>
  import('@/pages/shifts/sale-session-page').then((m) => ({ default: m.SaleSessionPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/reports/reports-page').then((m) => ({ default: m.ReportsPage })),
)
const FinancialReportPage = lazy(() =>
  import('@/pages/reports/financial-report-page').then((m) => ({ default: m.FinancialReportPage })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/notifications/notifications-page').then((m) => ({ default: m.NotificationsPage })),
)
const SubscriptionPage = lazy(() =>
  import('@/pages/subscription/subscription-page').then((m) => ({ default: m.SubscriptionPage })),
)
const PlansPage = lazy(() =>
  import('@/pages/subscription/plans-page').then((m) => ({ default: m.PlansPage })),
)
const WalletPage = lazy(() =>
  import('@/pages/wallet/wallet-page').then((m) => ({ default: m.WalletPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/settings/profile-page').then((m) => ({ default: m.ProfilePage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })),
)
const LoginPage = lazy(() =>
  import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('@/pages/auth/register-page').then((m) => ({ default: m.RegisterPage })),
)
const UsersPage = lazy(() =>
  import('@/pages/users/users-page').then((m) => ({ default: m.UsersPage })),
)

export const router = createBrowserRouter([
  {
    element: <AuthBootstrap />,
    children: [
      {
        element: <RedirectIfAuthed />,
        children: [
          {
            path: '/login',
            element: (
              <Page variant="cards">
                <LoginPage />
              </Page>
            ),
          },
          {
            path: '/register',
            element: (
              <Page variant="cards">
                <RegisterPage />
              </Page>
            ),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              {
                path: '/dashboard',
                element: (
                  <Page variant="dashboard">
                    <DashboardPage />
                  </Page>
                ),
              },
              {
                path: '/pos',
                element: (
                  <Page variant="cards">
                    <PosPage />
                  </Page>
                ),
              },
              {
                path: '/sales',
                element: (
                  <Page variant="cards">
                    <SalesHistoryPage />
                  </Page>
                ),
              },
              {
                path: '/products',
                element: (
                  <Page variant="cards">
                    <ProductsPage />
                  </Page>
                ),
              },
              {
                path: '/catalog',
                element: (
                  <Page variant="cards">
                    <CatalogPage />
                  </Page>
                ),
              },
              {
                path: '/departments',
                element: (
                  <Page variant="cards">
                    <DepartmentsPage />
                  </Page>
                ),
              },
              {
                path: '/inventory',
                element: (
                  <Page variant="cards">
                    <InventoryPage />
                  </Page>
                ),
              },
              {
                path: '/inventory/trace',
                element: (
                  <Page variant="cards">
                    <StockTracePage />
                  </Page>
                ),
              },
              {
                path: '/inventory/expiry',
                element: (
                  <Page variant="cards">
                    <ExpiryPage />
                  </Page>
                ),
              },
              {
                path: '/customers',
                element: (
                  <Page variant="cards">
                    <CustomersPage />
                  </Page>
                ),
              },
              {
                path: '/purchasing',
                element: (
                  <Page variant="cards">
                    <PurchasingPage />
                  </Page>
                ),
              },
              {
                path: '/suppliers',
                element: (
                  <Page variant="cards">
                    <SuppliersPage />
                  </Page>
                ),
              },
              {
                path: '/finance',
                element: (
                  <Page variant="cards">
                    <FinancePage />
                  </Page>
                ),
              },
              {
                path: '/expenses',
                element: (
                  <Page variant="cards">
                    <ExpensesPage />
                  </Page>
                ),
              },
              {
                path: '/staff',
                element: (
                  <Page variant="cards">
                    <StaffPage />
                  </Page>
                ),
              },
              {
                path: '/branches',
                element: (
                  <Page variant="cards">
                    <BranchesPage />
                  </Page>
                ),
              },
              {
                path: '/shifts',
                element: (
                  <Page variant="cards">
                    <ShiftsPage />
                  </Page>
                ),
              },
              {
                path: '/shifts/history',
                element: (
                  <Page variant="cards">
                    <ShiftHistoryPage />
                  </Page>
                ),
              },
              {
                path: '/shifts/:id',
                element: (
                  <Page variant="cards">
                    <ShiftDetailPage />
                  </Page>
                ),
              },
              {
                path: '/sale-sessions/:id',
                element: (
                  <Page variant="cards">
                    <SaleSessionPage />
                  </Page>
                ),
              },
              {
                path: '/reports',
                element: (
                  <Page variant="cards">
                    <ReportsPage />
                  </Page>
                ),
              },
              {
                path: '/reports/financial',
                element: (
                  <Page variant="cards">
                    <FinancialReportPage />
                  </Page>
                ),
              },
              {
                path: '/notifications',
                element: (
                  <Page variant="table">
                    <NotificationsPage />
                  </Page>
                ),
              },
              {
                path: '/subscription',
                element: (
                  <Page variant="cards">
                    <SubscriptionPage />
                  </Page>
                ),
              },
              {
                path: '/subscription/plans',
                element: (
                  <Page variant="cards">
                    <PlansPage />
                  </Page>
                ),
              },
              {
                path: '/users',
                element: (
                  <Page variant="cards">
                    <UsersPage />
                  </Page>
                ),
              },
              {
                path: '/businesses',
                element: (
                  <Page variant="cards">
                    <BusinessesPage />
                  </Page>
                ),
              },
              {
                path: '/wallet',
                element: (
                  <Page variant="cards">
                    <WalletPage />
                  </Page>
                ),
              },
              {
                path: '/settings/profile',
                element: (
                  <Page variant="cards">
                    <ProfilePage />
                  </Page>
                ),
              },
              {
                path: '/settings',
                element: (
                  <Page variant="cards">
                    <SettingsPage />
                  </Page>
                ),
              },
              {
                path: '*',
                element: (
                  <Page variant="cards">
                    <NotFoundPage />
                  </Page>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
])