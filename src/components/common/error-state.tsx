import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { ApiError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useConnectivityStore } from '@/stores/connectivity'

interface ErrorStateProps {
  error?: unknown
  onRetry?: () => void
  title?: string
}

export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const status = useConnectivityStore((s) => s.status)
  const isOffline = status === 'offline'
  const apiError = error instanceof ApiError ? error : undefined
  const message =
    apiError?.message ??
    (isOffline ? 'You are offline. Reconnect to load this data.' : 'Something went wrong while loading this data.')

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/70 px-6 py-14 text-center">
      <span
        className={
          'grid h-12 w-12 place-items-center rounded-2xl ' +
          (isOffline ? 'bg-warning/10 text-warning' : apiError?.isNetworkError ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive')
        }
      >
        {isOffline || apiError?.isNetworkError ? (
          <CloudOff className="h-6 w-6" />
        ) : (
          <AlertTriangle className="h-6 w-6" />
        )}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title ?? 'Unable to load data'}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
        {apiError?.code && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
            Error {apiError.code}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className={cn('h-3.5 w-3.5')} />
            Retry
          </Button>
        )}
        {apiError && apiError.status > 0 && apiError.status < 600 && (
          <span className="text-[10px] font-medium text-muted-foreground/60">
            HTTP {apiError.status}
          </span>
        )}
      </div>
    </div>
  )
}