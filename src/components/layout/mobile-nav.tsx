import { NavLink } from 'react-router-dom'
import {
  Clock,
  Menu,
  Package,
  ReceiptText,
  ScanLine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'

interface MobileTab {
  label: string
  path: string
  icon: LucideIcon
  permissions: string[]
}

const tabs: MobileTab[] = [
  { label: 'Sales', path: '/sales', icon: ReceiptText, permissions: ['sales.view'] },
  { label: 'Shifts', path: '/shifts', icon: Clock, permissions: ['shifts.view', 'shifts.operate'] },
  { label: 'Inventory', path: '/inventory', icon: Package, permissions: ['inventory.view'] },
]

export function MobileNav() {
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen)
  const { canAny } = usePermissions()

  const canSell = canAny('sales.create')

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border/70 bg-surface/95 backdrop-blur-xl lg:hidden">
      {canSell && (
        <NavLink
          to="/pos"
          className={({ isActive }) =>
            cn(
              'flex basis-20 flex-col items-center justify-center gap-1 bg-primary/10 text-primary transition-colors',
              isActive && 'bg-primary text-primary-foreground',
            )
          }
        >
          <ScanLine className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Sell</span>
        </NavLink>
      )}
      {tabs
        .filter((tab) => canAny(...tab.permissions))
        .map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors',
                isActive && 'text-primary',
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </NavLink>
        ))}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
        More
      </button>
    </nav>
  )
}
