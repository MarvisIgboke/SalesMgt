import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  CalendarClock,
  History,
  Users,
  ShoppingBag,
  Truck,
  Wallet,
  ReceiptText,
  UserCog,
  Clock4,
  BarChart3,
  Landmark,
  Bell,
  Settings,
  CreditCard,
  Gem,
  Tags,
  Building2,
  Layers,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  section: 'management' | 'operations' | 'finance' | 'people' | 'system' | 'platform'
  description?: string
  badge?: NavBadge
  superAdminOnly?: boolean
  /** Any-of permission gate; the item is hidden when the user has none. Omit for always-visible. */
  permissions?: string[]
}

export interface NavBadge {
  key: 'pendingInventory' | 'expiring' | 'lowStock' | 'pendingFinance'
  variant: 'destructive' | 'warning' | 'info' | 'primary'
}

export interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    id: 'management',
    title: 'Management',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, section: 'management', permissions: ['dashboard.view'] },
      { label: 'POS / Sales', path: '/pos', icon: ShoppingCart, section: 'management', permissions: ['sales.create', 'sales.view'] },
      { label: 'Sales History', path: '/sales', icon: ReceiptText, section: 'management', permissions: ['sales.view'] },
      { label: 'Finance', path: '/finance', icon: Wallet, section: 'management', permissions: ['finance.view', 'finance.payment_approve', 'finance.payment_reject', 'finance.reconcile'], badge: { key: 'pendingFinance', variant: 'primary' } },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      { label: 'Products', path: '/products', icon: Package, section: 'operations', permissions: ['products.view', 'sales.create'] },
      { label: 'Catalog', path: '/catalog', icon: Tags, section: 'operations', permissions: ['products.view', 'products.create', 'products.edit'] },
      { label: 'Departments', path: '/departments', icon: Layers, section: 'operations', permissions: ['departments.view'] },
      { label: 'Inventory', path: '/inventory', icon: Boxes, section: 'operations', permissions: ['inventory.view'], badge: { key: 'lowStock', variant: 'warning' } },
      { label: 'Stock Trace', path: '/inventory/trace', icon: History, section: 'operations', permissions: ['inventory.view'] },
      { label: 'Expiry Manager', path: '/inventory/expiry', icon: CalendarClock, section: 'operations', permissions: ['inventory.view'], badge: { key: 'expiring', variant: 'destructive' } },
      { label: 'Purchasing', path: '/purchasing', icon: ShoppingBag, section: 'operations', permissions: ['purchases.create', 'purchases.approve', 'purchases.receive'] },
      { label: 'Suppliers', path: '/suppliers', icon: Truck, section: 'operations', permissions: ['purchases.create', 'purchases.approve', 'purchases.receive'] },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & People',
    items: [
      { label: 'Expenses', path: '/expenses', icon: ReceiptText, section: 'finance', permissions: ['expenses.create', 'expenses.approve', 'finance.view'] },
      { label: 'Branches', path: '/branches', icon: Building2, section: 'people', permissions: ['staff.edit'] },
      { label: 'Staff', path: '/staff', icon: UserCog, section: 'people', permissions: ['staff.view'] },
      { label: 'Shifts', path: '/shifts', icon: Clock4, section: 'people', permissions: ['shifts.view', 'shifts.operate'] },
      { label: 'Customers', path: '/customers', icon: Users, section: 'people', permissions: ['customers.view', 'sales.create'] },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { label: 'Reports', path: '/reports', icon: BarChart3, section: 'system', permissions: ['reports.view'] },
      { label: 'Financial Report', path: '/reports/financial', icon: Landmark, section: 'system', permissions: ['reports.view'] },
      { label: 'Notifications', path: '/notifications', icon: Bell, section: 'system', permissions: ['notifications.view'] },
      { label: 'Subscription', path: '/subscription', icon: CreditCard, section: 'system', permissions: ['subscription.view'] },
      { label: 'Settings', path: '/settings', icon: Settings, section: 'system' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    items: [
      { label: 'Businesses', path: '/businesses', icon: Building2, section: 'platform', superAdminOnly: true },
      { label: 'Plans', path: '/subscription/plans', icon: Gem, section: 'platform', superAdminOnly: true },
      { label: 'Users', path: '/users', icon: Users, section: 'platform', superAdminOnly: true },
    ],
  },
]

export const flatNav = navSections.flatMap((section) =>
  section.items.map((item) => ({ ...item, sectionId: section.id })),
)

const sectionTitleById: Record<string, string> = Object.fromEntries(
  navSections.map((section) => [section.id, section.title]),
)

/**
 * Resolve the navigation section title that owns a path (longest prefix match).
 * Used to render a consistent mono "eyebrow" label in page headers.
 */
export function navSectionTitleForPath(path: string): string | null {
  const normalized = path.replace(/\/+$/, '') || '/'
  let best: NavItem | null = null

  for (const item of flatNav) {
    const itemPath = item.path.replace(/\/+$/, '')
    if (normalized === itemPath || normalized.startsWith(`${itemPath}/`)) {
      if (!best || item.path.length > best.path.length) best = item
    }
  }

  return best ? (sectionTitleById[best.section] ?? null) : null
}

export const primaryActions = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'POS', path: '/pos' },
  { label: 'Products', path: '/products' },
  { label: 'Customers', path: '/customers' },
  { label: 'Reports', path: '/reports' },
]