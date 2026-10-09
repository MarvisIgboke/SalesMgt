import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { BrandMark } from '@/components/layout/brand'

/**
 * Hydrates the auth session from a persisted token before rendering
 * the protected application tree.
 */
export function AuthBootstrap() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const status = useAuthStore((s) => s.status)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    void hydrate().finally(() => setBooted(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!booted) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <BrandMark className="h-12 w-12 animate-pulse" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (status === 'authenticating') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <BrandMark className="h-12 w-12 animate-pulse" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Restoring session…</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}