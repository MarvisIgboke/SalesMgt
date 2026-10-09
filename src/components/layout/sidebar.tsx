import { NavLink } from 'react-router-dom'
import {
  ChevronsLeft,
  ScanLine,
} from 'lucide-react'
import { navSections, type NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Brand } from './brand'
import { useNavBadges } from './use-nav-badges'

function NavItemLink({
  item,
  collapsed,
  badgeValue,
}: {
  item: NavItem
  collapsed: boolean
  badgeValue?: { count: number; variant: string }
}) {
  const linkContent = (
    <>
      <item.icon className={cn('h-[18px] w-[18px] shrink-0', collapsed && 'mt-0')} />
      {!collapsed && <span className="truncate text-sm">{item.label}</span>}
      {!collapsed && badgeValue && badgeValue.count > 0 && (
        <Badge variant={(badgeValue.variant as 'destructive') ?? 'primary'} className="ml-auto px-1.5 py-0 text-[10px]">
          {badgeValue.count > 99 ? '99+' : badgeValue.count}
        </Badge>
      )}
    </>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.path}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-foreground/80 transition-all duration-150 hover:bg-accent hover:text-foreground',
              isActive &&
                'bg-gradient-to-r from-primary/15 to-transparent text-primary after:absolute after:left-0 after:top-1/2 after:h-5 after:w-0.5 after:-translate-y-1/2 after:rounded-full after:bg-primary',
              collapsed && 'justify-center px-2',
            )
          }
          title={collapsed ? item.label : undefined}
        >
          {linkContent}
        </NavLink>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  )
}

export function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    mobileNavOpen,
    setMobileNavOpen,
  } = useAppStore()
  const badges = useNavBadges()

  const collapsed = !sidebarOpen

  return (
    <>
      {/* Mobile slide-out */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden',
          mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-border/70 bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:w-auto lg:translate-x-0',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          !mobileNavOpen ? '-translate-x-full lg:translate-x-0' : 'translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
          {collapsed ? <Brand markOnly /> : <Brand />}
          <button
            type="button"
            onClick={() => (window.innerWidth < 1024 ? setMobileNavOpen(false) : setSidebarOpen(!sidebarOpen))}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5 no-scrollbar">
          {navSections.map((section) => (
            <div key={section.id}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const badge = item.badge ? badges[item.badge.key] : undefined
                  return (
                    <NavItemLink
                      key={item.path}
                      item={item}
                      collapsed={collapsed}
                      badgeValue={badge}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/60 p-3">
          <NavLink
            to="/pos"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-xl bg-primary/10 px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20',
                isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <ScanLine className="h-[18px] w-[18px]" />
            {!collapsed && <span>Sell / Scan</span>}
          </NavLink>
        </div>
      </aside>
    </>
  )
}