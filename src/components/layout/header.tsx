import { Menu, ScanLine } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app'
import { BranchSwitcher } from './branch-switcher'
import { GlobalSearch } from './global-search'
import { ConnectivityIndicator } from './connectivity-indicator'
import { NotificationsMenu } from './notifications-menu'
import { SubscriptionBadge } from './subscription-badge'
import { UserMenu } from './user-menu'

export function Header() {
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen)
  const context = useAppStore((s) => s.context)
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-surface text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-1.5 lg:flex">
        <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
          {context?.business.name}
        </span>
        <span className="text-muted-foreground/50">/</span>
        <BranchSwitcher />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden w-full max-w-xs md:block lg:max-w-md">
          <GlobalSearch />
        </div>

        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary md:hidden"
          aria-label="Scan / Sell"
        >
          <ScanLine className="h-5 w-5" />
        </button>

        <div className="hidden sm:block">
          <ConnectivityIndicator />
        </div>
        <SubscriptionBadge />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  )
}