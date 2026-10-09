import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { notificationsApi } from '@/lib/api/endpoints/notifications'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDateTime } from '@/lib/utils'

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: () => notificationsApi.list({ per_page: 50, unread: filter === 'unread' || undefined }),
  })

  const unreadCount = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
  })

  const items = data?.data ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        description="Alerts, approvals and system activity."
      >
        <div className="flex items-center gap-2">
          <Badge variant="muted">{unreadCount.data?.data.count ?? 0} unread</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await notificationsApi.markAllRead()
              await queryClient.invalidateQueries({ queryKey: ['notifications'] })
            }}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </Button>
        ))}
      </div>

      {isLoading && <LoadingState variant="table" rows={6} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title="No notifications"
          description="You're all caught up."
          icon={<Bell className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-border',
                !item.is_read && 'border-primary/25 bg-primary/[0.03]',
              )}
            >
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  {!item.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                {item.body && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                )}
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  {formatDateTime(item.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}