import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react'
import { useConnectivityStore, type ConnectionStatus } from '@/stores/connectivity'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

const statusConfig: Record<ConnectionStatus, { icon: typeof Wifi; label: string; tone: string }> = {
  online: { icon: Wifi, label: 'Online', tone: 'text-success' },
  offline: { icon: WifiOff, label: 'Offline', tone: 'text-destructive' },
  syncing: { icon: RefreshCw, label: 'Syncing…', tone: 'text-info animate-spin', },
  sync_complete: { icon: CheckCircle2, label: 'Sync complete', tone: 'text-success' },
  sync_failed: { icon: AlertTriangle, label: 'Sync failed', tone: 'text-warning' },
}

export function ConnectivityIndicator({ compact = false }: { compact?: boolean }) {
  const { status, offlineQueueCount, setSyncComplete } = useConnectivityStore()
  const { icon: Icon, label, tone } = statusConfig[status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {compact ? (
          <span className={cn('grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-surface', tone)}>
            <Icon className={cn('h-4 w-4', status === 'syncing' ? 'animate-spin' : '')} />
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-2 text-xs text-muted-foreground', status !== 'online' && 'text-foreground')}
            onClick={() => {
              if (status !== 'sync_complete' && navigator.onLine) {
                setSyncComplete()
              }
            }}
          >
            <Icon className={cn('h-4 w-4', status === 'syncing' ? 'animate-spin' : '', tone)} />
            {label}
            {offlineQueueCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                {offlineQueueCount}
              </span>
            )}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {status === 'offline'
          ? 'You are offline. New transactions will be queued and sent when you reconnect.'
          : offlineQueueCount > 0
            ? `${offlineQueueCount} queued transaction${offlineQueueCount === 1 ? '' : 's'} waiting to sync.`
            : `Connected — ${label}`}
      </TooltipContent>
    </Tooltip>
  )
}