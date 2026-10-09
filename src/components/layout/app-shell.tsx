import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { MobileNav } from './mobile-nav'
import { ConnectivityIndicator } from './connectivity-indicator'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'

export function AppShell() {
  const location = useLocation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const isPos = location.pathname.startsWith('/pos')

  return (
    <div className="min-h-dvh bg-background bg-grid-fade">
      <Sidebar />

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-300 lg:pl-64',
          !sidebarOpen && 'lg:pl-[76px]',
        )}
      >
        <Header />

        <main
          className={cn(
            'mx-auto w-full flex-1 px-3 pb-24 pt-5 sm:px-5 sm:pt-6 lg:pb-10',
            isPos ? 'max-w-[1600px]' : 'max-w-7xl',
          )}
        >
          <Outlet />
        </main>

        <footer className="hidden border-t border-border/50 px-6 py-4 text-center text-[11px] text-muted-foreground/60 lg:block">
          SalesMgt · Presentation layer only — all business logic is executed by the backend.
        </footer>
      </div>

      {/* Mobile floating connectivity pill */}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <div className="pointer-events-auto rounded-full border border-border/70 bg-surface/90 px-3 py-1 shadow-card backdrop-blur-xl">
          <ConnectivityIndicator compact />
        </div>
      </div>

      <MobileNav />
    </div>
  )
}