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
const ProductsPage = lazy(() =>
  import('@/pages/products/products-page').then((m) => ({ default: m.ProductsPage })),
)
const InventoryPage = lazy(() =>
  import('@/pages/inventory/inventory-page').then((m) => ({ default: m.InventoryPage })),
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
const ShiftsPage = lazy(() =>
  import('@/pages/shifts/shifts-page').then((m) => ({ default: m.ShiftsPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/reports/reports-page').then((m) => ({ default: m.ReportsPage })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/notifications/notifications-page').then((m) => ({ default: m.NotificationsPage })),
)
const SubscriptionPage = lazy(() =>
  import('@/pages/subscription/subscription-page').then((m) => ({ default: m.SubscriptionPage })),
)
const WalletPage = lazy(() =>
  import('@/pages/wallet/wallet-page').then((m) => ({ default: m.WalletPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })),
)
const LoginPage = lazy(() =>
  import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })),
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
                path: '/products',
                element: (
                  <Page variant="cards">
                    <ProductsPage />
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
                path: '/shifts',
                element: (
                  <Page variant="cards">
                    <ShiftsPage />
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
                path: '/wallet',
                element: (
                  <Page variant="cards">
                    <WalletPage />
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