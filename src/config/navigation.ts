import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  CalendarClock,
  Users,
  ShoppingBag,
  Truck,
  Wallet,
  ReceiptText,
  UserCog,
  Clock4,
  BarChart3,
  Bell,
  Settings,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  section: 'management' | 'operations' | 'finance' | 'people' | 'system'
  description?: string
  badge?: NavBadge
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
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, section: 'management' },
      { label: 'POS / Sales', path: '/pos', icon: ShoppingCart, section: 'management' },
      { label: 'Finance', path: '/finance', icon: Wallet, section: 'management', badge: { key: 'pendingFinance', variant: 'primary' } },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      { label: 'Products', path: '/products', icon: Package, section: 'operations' },
      { label: 'Inventory', path: '/inventory', icon: Boxes, section: 'operations', badge: { key: 'lowStock', variant: 'warning' } },
      { label: 'Expiry Manager', path: '/inventory/expiry', icon: CalendarClock, section: 'operations', badge: { key: 'expiring', variant: 'destructive' } },
      { label: 'Purchasing', path: '/purchasing', icon: ShoppingBag, section: 'operations' },
      { label: 'Suppliers', path: '/suppliers', icon: Truck, section: 'operations' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & People',
    items: [
      { label: 'Expenses', path: '/expenses', icon: ReceiptText, section: 'finance' },
      { label: 'Staff', path: '/staff', icon: UserCog, section: 'people' },
      { label: 'Shifts', path: '/shifts', icon: Clock4, section: 'people' },
      { label: 'Customers', path: '/customers', icon: Users, section: 'people' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { label: 'Reports', path: '/reports', icon: BarChart3, section: 'system' },
      { label: 'Notifications', path: '/notifications', icon: Bell, section: 'system' },
      { label: 'Subscription', path: '/subscription', icon: CreditCard, section: 'system' },
      { label: 'Settings', path: '/settings', icon: Settings, section: 'system' },
    ],
  },
]

export const flatNav = navSections.flatMap((section) =>
  section.items.map((item) => ({ ...item, sectionId: section.id })),
)

export const primaryActions = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'POS', path: '/pos' },
  { label: 'Products', path: '/products' },
  { label: 'Customers', path: '/customers' },
  { label: 'Reports', path: '/reports' },
]