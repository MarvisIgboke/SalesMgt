import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCheck,
  FileText,
  PackageCheck,
  ReceiptText,
  ShieldAlert,
  Info,
  Loader2,
} from 'lucide-react'
import { notificationsApi } from '@/lib/api/endpoints/notifications'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatRelative } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

const typeIcon: Record<string, { icon: typeof Info; tone: string }> = {
  sale: { icon: ReceiptText, tone: 'text-success bg-success/10' },
  approval: { icon: ShieldAlert, tone: 'text-warning bg-warning/10' },
  inventory: { icon: PackageCheck, tone: 'text-info bg-info/10' },
  expense: { icon: FileText, tone: 'text-primary bg-primary/10' },
}

export function NotificationsMenu() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authenticated = useAuthStore((s) => s.status === 'authenticated')

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: authenticated,
    refetchInterval: 60_000,
  })

  const { data: list, isFetching } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ per_page: 8 }),
    enabled: authenticated,
  })

  const unreadCount = unread?.data.count ?? 0

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const items = list?.data ?? []

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            disabled={markAll.isPending || unreadCount === 0}
            onClick={() => markAll.mutate()}
          >
            {markAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isFetching && (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {!isFetching && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Bell className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground">New alerts will appear here.</p>
            </div>
          )}

          {items.map((notification) => {
            const conf = typeIcon[notification.type] ?? { icon: Info, tone: 'bg-muted text-muted-foreground' }
            const Icon = conf.icon
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  navigate('/notifications')
                  void notificationsApi.markRead(notification.id).then(() =>
                    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
                  )
                }}
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/60',
                  !notification.is_read && 'bg-primary/[0.04]',
                )}
              >
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', conf.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {notification.title}
                  </span>
                  {notification.body && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {notification.body}
                    </span>
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground/70">
                    {formatRelative(notification.created_at)}
                  </span>
                </span>
                {!notification.is_read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        <Button
          variant="ghost"
          className="w-full rounded-none border-t border-border/70 text-xs text-muted-foreground"
          onClick={() => navigate('/notifications')}
        >
          View all notifications
        </Button>
      </PopoverContent>
    </Popover>
  )
}