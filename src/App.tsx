import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/routes/router'
import { queryClient } from '@/lib/api/query-client'
import { AUTH_UNAUTHORIZED_EVENT } from '@/lib/api/client'
import { clearToken } from '@/lib/auth-token'
import { setRequestContext } from '@/lib/api/context'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { initConnectivityListeners } from '@/stores/connectivity'

export default function App() {
  const initRef = useRef(false)
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    initConnectivityListeners()

    const onUnauthorized = () => {
      clearToken()
      setRequestContext({ businessId: null, branchId: null })
      useAuthStore.setState({ status: 'unauthenticated', session: null })
    }
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && !useAppStore.getState().contextLoaded) {
      void useAppStore.getState().loadContext(useAuthStore.getState().session)
    }
  }, [status])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}