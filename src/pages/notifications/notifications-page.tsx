import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Cpu,
  Download,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import {
  notificationsApi,
  type AppNotification,
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationSummary,
} from '@/lib/api/endpoints/notifications'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Pagination } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { cn, formatNumber, formatRelative } from '@/lib/utils'

const ALL = 'all'
const UNREAD = 'unread'
const SALES = 'sales'
const INVENTORY = 'inventory'
const FINANCE = 'finance'
const SYSTEM = 'system'

const CATEGORY_FILTERS = new Set([SALES, INVENTORY, FINANCE, SYSTEM])

interface CategoryMeta {
  label: string
  icon: LucideIcon
  tone: string
  route: string
}

const CATEGORY_META: Record<NotificationCategory, CategoryMeta> = {
  sales: { label: 'Sales & Till', icon: ReceiptText, tone: 'text-success bg-success/10', route: '/sales' },
  inventory: { label: 'Inventory', icon: Package, tone: 'text-info bg-info/10', route: '/inventory' },
  finance: { label: 'Finance', icon: Wallet, tone: 'text-primary bg-primary/10', route: '/finance' },
  system: { label: 'System', icon: Cpu, tone: 'text-muted-foreground bg-muted', route: '/settings' },
}

interface SeverityMeta {
  label: string
  edge: string
  variant: 'destructive' | 'warning' | 'success' | 'info'
}

const SEVERITY_META: Record<NotificationSeverity, SeverityMeta> = {
  critical: { label: 'Critical', edge: 'bg-destructive', variant: 'destructive' },
  warning: { label: 'Warning', edge: 'bg-warning', variant: 'warning' },
  success: { label: 'Settled', edge: 'bg-secondary', variant: 'success' },
  info: { label: 'Info', edge: 'bg-primary', variant: 'info' },
}

interface FilterOption {
  key: string
  label: string
  count: number
  dot?: 'destructive'
}

function buildFilters(summary: NotificationSummary | undefined): FilterOption[] {
  if (!summary) return []
  return [
    { key: ALL, label: 'All Alerts', count: summary.filters.all },
    { key: UNREAD, label: 'Unread', count: summary.filters.unread, dot: 'destructive' },
    { key: SALES, label: 'Sales & Till', count: summary.filters.sales },
    { key: INVENTORY, label: 'Inventory & Cold-Chain', count: summary.filters.inventory },
    { key: FINANCE, label: 'Finance & Ledger', count: summary.filters.finance },
    { key: SYSTEM, label: 'System & Security', count: summary.filters.system },
  ]
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function metricGlyph(kind: 'unread' | 'action' | 'ack' | 'feed', className: string) {
  if (kind === 'unread') return <Bell className={className} />
  if (kind === 'action') return <ShieldAlert className={className} />
  if (kind === 'ack') return <CheckCheck className={className} />
  return <Cpu className={className} />
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState(ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const summaryQuery = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => notificationsApi.summary(),
    refetchInterval: 30_000,
  })

  const listQuery = useQuery({
    queryKey: ['notifications', 'list', filter, page],
    queryFn: () =>
      notificationsApi.list({
        per_page: 15,
        page,
        unread: filter === UNREAD || undefined,
        category: CATEGORY_FILTERS.has(filter) ? filter : undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const summary = summaryQuery.data?.data
  const items = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const term = search.trim().toLowerCase()
  const visible = term
    ? items.filter((item) =>
        [item.title, item.body ?? '', item.type].some((value) => value.toLowerCase().includes(term)),
      )
    : items

  const filters = buildFilters(summary)

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications acknowledged')
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not acknowledge notifications'),
  })

  const markOne = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => toast.error('Could not update notification'),
  })

  const changeFilter = (key: string) => {
    setFilter(key)
    setPage(1)
  }

  const exportLogs = () => {
    if (items.length === 0) {
      toast.info('Nothing to export yet')
      return
    }
    const rows: string[][] = [
      ['Severity', 'Category', 'Title', 'Body', 'Status', 'Created'],
      ...items.map((item) => [
        SEVERITY_META[item.severity].label,
        CATEGORY_META[item.category].label,
        item.title,
        item.body ?? '',
        item.is_read ? 'Read' : 'Unread',
        item.created_at,
      ]),
    ]
    downloadCsv('notification-logs.csv', rows)
    toast.success('Notification logs exported')
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        total={summary?.total}
        unread={summary?.unread}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <PageHeader
        eyebrow="System"
        title="Notifications"
        description="Operational alerts, approvals and system activity across the business."
      />

      <MetricGrid summary={summary} loading={summaryQuery.isLoading} errored={summaryQuery.isError} />

      <CommandBar
        unread={summary?.unread ?? 0}
        acknowledging={markAll.isPending}
        onAcknowledge={() => markAll.mutate()}
        onExport={exportLogs}
        onRefresh={() => {
          void summaryQuery.refetch()
          void listQuery.refetch()
        }}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search alerts, titles or module…"
          className="h-11 rounded-xl pl-10"
        />
      </div>

      <FilterPills options={filters} active={filter} onSelect={changeFilter} />

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Alert Feed
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatNumber(visible.length)} shown • {formatNumber(summary?.unread ?? 0)} unread
        </span>
      </div>

      {listQuery.isLoading && <FeedSkeleton />}

      {!listQuery.isLoading && listQuery.isError && (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      )}

      {!listQuery.isLoading && !listQuery.isError && visible.length === 0 && (
        <EmptyState
          title="No notifications"
          description={
            search || filter !== ALL ? 'Try a different search or filter.' : "You're all caught up."
          }
          icon={<Bell className="h-6 w-6" />}
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((item) => (
            <AlertCard
              key={item.id}
              item={item}
              marking={markOne.isPending}
              onMarkRead={() => markOne.mutate(item.id)}
              onOpen={() => navigate(CATEGORY_META[item.category].route)}
            />
          ))}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          total={meta.total}
          totalLabel="notifications"
          isFetching={listQuery.isFetching}
          onPageChange={setPage}
        />
      )}

      {summary && <ComplianceFooter summary={summary} onExport={exportLogs} />}
    </div>
  )
}

function TelemetryBar({
  total,
  unread,
  syncing,
  onSync,
}: {
  total?: number
  unread?: number
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Alert &amp; Audit Feed
          </span>
          <span className="hidden text-muted-foreground sm:inline">•</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            System Integrity Monitor
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-muted-foreground sm:flex">
            <Cpu className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px]">ERP LINKED</span>
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Feed:</span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            {formatNumber(total ?? 0)} notifications • {formatNumber(unread ?? 0)} unread
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricGrid({
  summary,
  loading,
  errored,
}: {
  summary?: NotificationSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined

  const cards: {
    kind: 'unread' | 'action' | 'ack' | 'feed'
    label: string
    value: string
    sub: string
    subTone: string
    iconTone: string
    footer: [string, string]
  }[] = [
    {
      kind: 'unread',
      label: 'Unread Alerts',
      value: dim ?? formatNumber(summary?.unread ?? 0),
      sub: dim ?? `${formatNumber(summary?.today ?? 0)} flagged today`,
      subTone: 'text-destructive',
      iconTone: 'bg-destructive/15 text-destructive',
      footer: [
        `${formatNumber(summary?.by_severity.critical ?? 0)} critical`,
        `${formatNumber(summary?.by_severity.warning ?? 0)} warning`,
      ],
    },
    {
      kind: 'action',
      label: 'Action Required',
      value: dim ?? formatNumber(summary?.action_required ?? 0),
      sub: dim ?? 'High-priority flags',
      subTone: 'text-warning',
      iconTone: 'bg-tertiary/15 text-tertiary',
      footer: [
        `${formatNumber(summary?.by_severity.critical ?? 0)} critical`,
        'Needs review',
      ],
    },
    {
      kind: 'ack',
      label: 'Acknowledged',
      value: dim ?? `${summary?.read_rate_pct ?? 0}%`,
      sub: dim ?? `${formatNumber(summary?.read ?? 0)} of ${formatNumber(summary?.total ?? 0)} read`,
      subTone: 'text-secondary',
      iconTone: 'bg-secondary/15 text-secondary',
      footer: [
        `${formatNumber(summary?.read ?? 0)} read`,
        `${formatNumber(summary?.unread ?? 0)} pending`,
      ],
    },
    {
      kind: 'feed',
      label: "Today's Feed",
      value: dim ?? formatNumber(summary?.today ?? 0),
      sub: dim ?? `${formatNumber(summary?.this_week ?? 0)} this week`,
      subTone: 'text-primary',
      iconTone: 'bg-primary/10 text-primary',
      footer: [
        `${formatNumber(summary?.by_category.sales ?? 0)} sales`,
        `${formatNumber(summary?.by_category.inventory ?? 0)} inventory`,
      ],
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((card) => (
        <div
          key={card.kind}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5"
        >
          <div
            className={cn(
              'pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-lg',
              card.iconTone,
            )}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <span className={cn('grid h-6 w-6 place-items-center rounded', card.iconTone)}>
              {metricGlyph(card.kind, 'h-3.5 w-3.5')}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">
            {card.value}
          </div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
            <span className={cn('h-1.5 w-1.5 rounded-full', loading ? 'bg-muted' : 'bg-primary')} />
            <span className={cn('truncate', card.subTone)}>{card.sub}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="truncate">{card.footer[0]}</span>
            <span className="truncate">{card.footer[1]}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommandBar({
  unread,
  acknowledging,
  onAcknowledge,
  onExport,
  onRefresh,
}: {
  unread: number
  acknowledging: boolean
  onAcknowledge: () => void
  onExport: () => void
  onRefresh: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAcknowledge}
        disabled={acknowledging || unread === 0}
        className={cn(
          'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95',
          (acknowledging || unread === 0) && 'opacity-60',
        )}
      >
        <CheckCheck className={cn('h-4 w-4', acknowledging && 'animate-pulse')} />
        Acknowledge All ({formatNumber(unread)})
      </button>
      <button
        type="button"
        aria-label="Export logs"
        onClick={onExport}
        className="grid h-11 w-12 place-items-center rounded-xl bg-surface-container-high text-on-surface transition-transform active:scale-95"
      >
        <Download className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Refresh feed"
        onClick={onRefresh}
        className="grid h-11 w-12 place-items-center rounded-xl bg-surface-container-high text-on-surface transition-transform active:scale-95"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  )
}

function FilterPills({
  options,
  active,
  onSelect,
}: {
  options: FilterOption[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const selected = active === option.key
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            {option.dot === 'destructive' && (
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            )}
            {option.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px]',
                selected ? 'bg-primary/15' : 'bg-surface-sunken',
              )}
            >
              {option.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function AlertCard({
  item,
  marking,
  onMarkRead,
  onOpen,
}: {
  item: AppNotification
  marking: boolean
  onMarkRead: () => void
  onOpen: () => void
}) {
  const severity = SEVERITY_META[item.severity]
  const category = CATEGORY_META[item.category]
  const CategoryIcon = category.icon
  const dataEntries = Object.entries(item.data ?? {}).slice(0, 3)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-surface-elevated shadow-sm',
        item.is_read ? 'border-border' : 'border-primary/25',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', severity.edge)} aria-hidden />

      <div className="flex flex-col gap-2 p-3.5 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider', category.tone)}>
              <CategoryIcon className="h-3 w-3" />
              {category.label}
            </span>
            <Badge variant={severity.variant} className="px-1.5 py-0 text-[10px]">
              {severity.label}
            </Badge>
            {!item.is_read && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                New
              </span>
            )}
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {formatRelative(item.created_at)}
          </span>
        </div>

        <div>
          <h2 className="font-semibold tracking-tight text-foreground">{item.title}</h2>
          {item.body && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
          )}
        </div>

        {dataEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-sunken px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
            {dataEntries.map(([key, value]) => (
              <span key={key} className="truncate">
                {key.toUpperCase()}:{' '}
                <span className="text-foreground">{String(value)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <CategoryIcon className="h-3.5 w-3.5" />
            Open {category.label}
          </Button>
          {item.is_read ? (
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Check className="h-3 w-3" />
              Acknowledged
            </span>
          ) : (
            <Button variant="secondary" size="sm" loading={marking} onClick={onMarkRead}>
              Mark read
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ComplianceFooter({
  summary,
  onExport,
}: {
  summary: NotificationSummary
  onExport: () => void
}) {
  const critical = summary.by_severity.critical
  return (
    <div className="mt-1 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          {critical > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
          )}
          Feed Health &amp; Compliance
        </span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px]',
            critical > 0 ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary',
          )}
        >
          {critical > 0 ? `${critical} critical` : 'All clear'}
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{formatNumber(summary.total)}</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Unread</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{formatNumber(summary.unread)}</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Read Rate</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-secondary">{summary.read_rate_pct}%</p>
        </div>
      </div>
      <div className="border-t border-border/60 p-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export Audit Log
        </Button>
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-2xl border border-border bg-surface-elevated p-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-3 h-8 w-40" />
        </div>
      ))}
    </div>
  )
}
