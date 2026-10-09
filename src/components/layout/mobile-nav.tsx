import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  BarChart3,
  ScanLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Shop', path: '/products', icon: Package },
  { label: 'Receive', path: '/notifications', icon: Users },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
]

export function MobileNav() {
  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border/70 bg-surface/95 backdrop-blur-xl lg:hidden">
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
          <span className="text-[10px] font-semibold">Scan / Sell</span>
        </NavLink>
        {tabs.map((tab) => (
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
      </nav>
    </>
  )
}