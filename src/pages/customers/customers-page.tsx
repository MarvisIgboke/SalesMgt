import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Banknote,
  Cpu,
  Download,
  FileText,
  Gauge,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  RefreshCw,
  ScanLine,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  customersApi,
  CUSTOMER_SEGMENTS,
  CUSTOMER_TIERS,
  type CustomerCard,
  type CustomerInput,
  type CustomerSummary,
} from '@/lib/api/endpoints/customers'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { LoadingState } from '@/components/common/loading-state'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatCurrency, formatDate, formatNumber, formatRelative, initials } from '@/lib/utils'

const ALL = 'all'
const WHOLESALE = 'wholesale'
const VIP = 'vip'
const CREDIT_DUE = 'credit_due'
const WALKIN = 'walkin'
const CREDIT_DUE_THRESHOLD = 500_000

interface FilterOption {
  key: string
  label: string
  count: number
  tone?: 'warning'
}

function buildFilters(summary: CustomerSummary | undefined): FilterOption[] {
  if (!summary) return []
  return [
    { key: ALL, label: 'All Customers', count: summary.filters.all },
    { key: WHOLESALE, label: 'Wholesale B2B', count: summary.filters.wholesale },
    { key: VIP, label: 'Retail VIP', count: summary.filters.vip },
    {
      key: CREDIT_DUE,
      label: `Credit Due > ${formatCurrencyCompact(CREDIT_DUE_THRESHOLD)}`,
      count: summary.filters.credit_due,
      tone: 'warning',
    },
    { key: WALKIN, label: 'Walk-in Registered', count: summary.filters.walkin },
  ]
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `₦${value / 1_000_000}m`
  if (value >= 1_000) return `₦${value / 1_000}k`
  return `₦${value}`
}

function matchesFilter(card: CustomerCard, filter: string): boolean {
  if (filter === WHOLESALE) return card.segment === 'Wholesale B2B'
  if (filter === VIP) return card.segment === 'Retail VIP'
  if (filter === CREDIT_DUE) return card.outstanding_balance > CREDIT_DUE_THRESHOLD
  if (filter === WALKIN) return card.is_walkin
  return true
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

function metricGlyph(kind: 'profiles' | 'ar' | 'retention' | 'gmv', className: string) {
  if (kind === 'profiles') return <Users className={className} />
  if (kind === 'ar') return <Wallet className={className} />
  if (kind === 'retention') return <Repeat className={className} />
  return <TrendingUp className={className} />
}

export function CustomersPage() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canCreate = can('customers.create')
  const canEdit = can('customers.edit')
  const canCredit = can('customers.credit')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(ALL)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerCard | null>(null)
  const [paying, setPaying] = useState<CustomerCard | null>(null)
  const [viewing, setViewing] = useState<CustomerCard | null>(null)

  const summaryQuery = useQuery({
    queryKey: ['customers', 'summary'],
    queryFn: () => customersApi.summary(),
    refetchInterval: 30_000,
  })

  const summary = summaryQuery.data?.data
  const cards = summary?.customers ?? []

  const term = search.trim().toLowerCase()
  const visible = cards.filter((card) => {
    if (!matchesFilter(card, filter)) return false
    if (!term) return true
    return [card.name, card.account_code, card.tier, card.segment, card.phone ?? '', card.email ?? '', card.address ?? '']
      .some((value) => value.toLowerCase().includes(term))
  })

  const filters = buildFilters(summary)

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['customers'] })
  }

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (card: CustomerCard) => {
    setEditing(card)
    setEditorOpen(true)
  }

  const exportAgeing = () => {
    if (cards.length === 0) {
      toast.info('Nothing to export yet')
      return
    }
    const rows: string[][] = [
      ['Account', 'Customer', 'Segment', 'Tier', 'Credit Limit', 'Outstanding', 'Utilisation %', 'Over Limit', 'Last Purchase'],
      ...cards.map((card) => [
        card.account_code,
        card.name,
        card.segment,
        card.tier,
        String(card.credit_limit ?? 0),
        String(card.outstanding_balance),
        String(card.utilisation_pct),
        card.over_limit ? 'Yes' : 'No',
        card.last_purchase_at ?? '—',
      ]),
    ]
    downloadCsv('ar-ageing.csv', rows)
    toast.success('AR ageing report exported')
  }

  const syncErp = () => {
    void summaryQuery.refetch()
    toast.info('Syncing CRM ledger with ERP…')
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        profiles={summary?.profiles.total}
        outstanding={summary?.ar.total}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <PageHeader
        eyebrow="Customer CRM & Accounts"
        title="Customers"
        description="Omnichannel profiles, credit facilities, AR ledger and lifetime value."
      />

      <MetricGrid summary={summary} loading={summaryQuery.isLoading} errored={summaryQuery.isError} />

      <ActionBar
        canCreate={canCreate}
        onCreate={openCreate}
        onStatements={() => toast.info('Open a customer card to view its AR statement.')}
        onGiftCard={() => toast.info('Gift cards are not enabled for this business yet.')}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, account, phone or tier…"
            className="h-11 rounded-xl pl-10 pr-10"
          />
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Scan customer QR to open profile"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills options={filters} active={filter} onSelect={setFilter} />

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Customer Accounts
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatNumber(visible.length)} of {formatNumber(summary?.profiles.total ?? 0)} profiles
        </span>
      </div>

      {summaryQuery.isLoading && <RosterSkeleton />}

      {!summaryQuery.isLoading && summaryQuery.isError && (
        <ErrorState error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length === 0 && (
        <EmptyState
          title="No customers found"
          description={
            search || filter !== ALL
              ? 'Try a different search or filter.'
              : 'Add your first customer account to start tracking credit and lifetime value.'
          }
          icon={<Users className="h-6 w-6" />}
          action={
            canCreate ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                New customer
              </Button>
            ) : undefined
          }
        />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((card) => (
            <CustomerAccountCard
              key={card.id}
              card={card}
              canEdit={canEdit}
              canCredit={canCredit}
              onStatement={() => setViewing(card)}
              onPayment={() => setPaying(card)}
              onEdit={() => openEdit(card)}
            />
          ))}
        </div>
      )}

      {summary && <ArPipelineFooter summary={summary} onExport={exportAgeing} onSync={syncErp} />}

      {editorOpen && (
        <CustomerEditor
          customer={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={reload}
        />
      )}

      {viewing && <StatementDialog card={viewing} onClose={() => setViewing(null)} />}

      {paying && <PaymentDialog card={paying} onClose={() => setPaying(null)} onSaved={reload} />}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(value) => {
          setScannerOpen(false)
          setSearch(value)
          toast.info(`Searching "${value}"`)
        }}
      />
    </div>
  )
}

function TelemetryBar({
  profiles,
  outstanding,
  syncing,
  onSync,
}: {
  profiles?: number
  outstanding?: number
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
            Customer CRM &amp; Accounts
          </span>
          <span className="hidden text-muted-foreground sm:inline">•</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            Omnichannel • AR Ledger
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
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ledger:</span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            {formatNumber(profiles ?? 0)} profiles • {formatCurrency(outstanding ?? 0)} AR outstanding
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
  summary?: CustomerSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const mom = summary?.gmv_30d.mom_pct ?? 0
  const momUp = mom >= 0

  const cards: {
    kind: 'profiles' | 'ar' | 'retention' | 'gmv'
    label: string
    value: string
    sub: string
    subTone: string
    iconTone: string
    footer: [string, string]
  }[] = [
    {
      kind: 'profiles',
      label: 'Active Profiles',
      value: dim ?? formatNumber(summary?.profiles.total ?? 0),
      sub: dim ?? `+${formatNumber(summary?.profiles.new_this_week ?? 0)} this week`,
      subTone: 'text-success',
      iconTone: 'bg-success/15 text-success',
      footer: [
        `${formatNumber(summary?.profiles.wholesale ?? 0)} wholesale`,
        `${formatNumber(summary?.profiles.vip ?? 0)} VIP`,
      ],
    },
    {
      kind: 'ar',
      label: 'AR Ledger Bal.',
      value: dim ?? formatCurrency(summary?.ar.total ?? 0),
      sub: dim ?? `${formatNumber(summary?.ar.accounts ?? 0)} accounts carrying`,
      subTone: 'text-warning',
      iconTone: 'bg-tertiary/15 text-tertiary',
      footer: [
        `Health ${summary?.ar.book_health_pct ?? 0}%`,
        `${formatNumber(summary?.ar.due_high ?? 0)} due > ${formatCurrencyCompact(CREDIT_DUE_THRESHOLD)}`,
      ],
    },
    {
      kind: 'retention',
      label: 'Repeat Buyers',
      value: dim ?? formatNumber(summary?.loyalty.repeat_buyers ?? 0),
      sub: dim ?? `${summary?.loyalty.retention_pct ?? 0}% retention`,
      subTone: 'text-primary',
      iconTone: 'bg-info/15 text-info',
      footer: [
        `${formatNumber(summary?.loyalty.lifetime_orders ?? 0)} orders`,
        'Loyalty fabric',
      ],
    },
    {
      kind: 'gmv',
      label: '30D LTV / GMV',
      value: dim ?? formatCurrency(summary?.gmv_30d.value ?? 0),
      sub: dim ?? `${momUp ? '+' : ''}${mom}% MoM`,
      subTone: momUp ? 'text-success' : 'text-destructive',
      iconTone: 'bg-primary/10 text-primary',
      footer: [
        `${formatNumber(summary?.gmv_30d.orders ?? 0)} orders`,
        `Avg ${formatCurrency(summary?.gmv_30d.average ?? 0)}`,
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

function ActionBar({
  canCreate,
  onCreate,
  onStatements,
  onGiftCard,
}: {
  canCreate: boolean
  onCreate: () => void
  onStatements: () => void
  onGiftCard: () => void
}) {
  return (
    <div className="space-y-2">
      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Customer Account
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStatements}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <FileText className="h-4 w-4 text-primary" />
          AR Statements
        </button>
        <button
          type="button"
          onClick={onGiftCard}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <Wallet className="h-4 w-4 text-secondary" />
          Issue Gift Card
        </button>
      </div>
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
            {option.tone === 'warning' && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
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

function CustomerAccountCard({
  card,
  canEdit,
  canCredit,
  onStatement,
  onPayment,
  onEdit,
}: {
  card: CustomerCard
  canEdit: boolean
  canCredit: boolean
  onStatement: () => void
  onPayment: () => void
  onEdit: () => void
}) {
  const stripe = card.over_limit
    ? 'bg-destructive'
    : card.segment === 'Wholesale B2B'
      ? 'bg-primary'
      : card.segment === 'Retail VIP'
        ? 'bg-warning'
        : 'bg-muted-foreground'

  const tierVariant = card.over_limit
    ? 'destructive'
    : card.segment === 'Retail VIP'
      ? 'warning'
      : card.segment === 'Wholesale B2B'
        ? 'info'
        : 'muted'

  const barTone = card.over_limit
    ? 'bg-destructive'
    : card.utilisation_pct >= 80
      ? 'bg-warning'
      : 'bg-primary'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', stripe)} aria-hidden />

      <div className="p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback>{initials(card.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-semibold tracking-tight text-foreground">{card.name}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {card.account_code}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {card.segment}
                </span>
                <Badge variant={tierVariant} className="px-1.5 py-0 text-[10px]">
                  {card.tier}
                </Badge>
              </div>
            </div>
          </div>
          {(canEdit || canCredit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Customer actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onStatement}>
                  <FileText className="h-4 w-4" />
                  Statement
                </DropdownMenuItem>
                {canCredit && (
                  <DropdownMenuItem onClick={onPayment}>
                    <Banknote className="h-4 w-4" />
                    Record payment
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                      Edit customer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="truncate">{card.phone ?? card.email ?? 'No contact on file'}</span>
          {card.is_walkin && <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[9px]">Walk-in</span>}
          {card.over_limit && (
            <span className="flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" />
              Over limit
            </span>
          )}
        </div>

        <div className="mt-3 rounded-lg bg-surface-sunken p-2.5">
          {card.credit_limit != null ? (
            <>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                <span className="text-muted-foreground">
                  Terms · {formatCurrency(card.credit_limit)} limit
                </span>
                <span className={cn('font-semibold', card.over_limit ? 'text-destructive' : 'text-foreground')}>
                  {card.utilisation_pct}% used
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={cn('h-full rounded-full', barTone)}
                  style={{ width: `${Math.min(card.utilisation_pct, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>
                  Owes <span className="font-semibold text-foreground">{formatCurrency(card.outstanding_balance)}</span>
                </span>
                <span>Available {formatCurrency(Math.max(card.credit_remaining ?? 0, 0))}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>No credit facility · cash &amp; card only</span>
              <span>
                Spent <span className="font-semibold text-foreground">{formatCurrency(card.outstanding_balance)}</span>
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Lifetime</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatCurrency(card.lifetime_spend)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{formatNumber(card.orders_total)} orders</p>
          </div>
          <div className="min-w-0 border-l border-border/60 pl-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">30D Volume</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatCurrency(card.spend_30d)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{formatNumber(card.orders_30d)} orders</p>
          </div>
          <div className="min-w-0 border-l border-border/60 pl-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Region</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {card.address ? card.address.split(',')[0] : '—'}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.last_purchase_at ? `Last ${formatRelative(card.last_purchase_at)}` : 'No purchases'}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Member since {card.created_at ? formatDate(card.created_at, { year: 'numeric', month: 'short' }) : '—'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onStatement}>
              <FileText className="h-3.5 w-3.5" />
              Ledger
            </Button>
            {canCredit && (
              <Button variant="secondary" size="sm" onClick={onPayment}>
                <Banknote className="h-3.5 w-3.5" />
                Payment
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ArPipelineFooter({
  summary,
  onExport,
  onSync,
}: {
  summary: CustomerSummary
  onExport: () => void
  onSync: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          AR Collection Pipeline
        </span>
        <span className="rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-[10px] text-secondary">
          Health {summary.ar.book_health_pct}%
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold text-foreground">
            {formatCurrency(summary.pipeline.outstanding)}
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Accounts</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{summary.pipeline.accounts}</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Available</p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold text-secondary">
            {formatCurrency(summary.pipeline.available)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-3">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Ageing Analysis
        </Button>
        <Button variant="outline" size="sm" onClick={onSync}>
          <RefreshCw className="h-3.5 w-3.5" />
          Sync CRM with ERP
        </Button>
      </div>
    </div>
  )
}

function RosterSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-2xl border border-border bg-surface-elevated p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-3 h-14 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

type CustomerFormState = {
  name: string
  email: string
  phone: string
  address: string
  credit_limit: string
  segment: string
  tier: string
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  credit_limit: '',
  segment: CUSTOMER_SEGMENTS[2],
  tier: CUSTOMER_TIERS[4],
}

function toInput(form: CustomerFormState): CustomerInput {
  return {
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    credit_limit: form.credit_limit ? Number(form.credit_limit) : undefined,
    segment: form.segment,
    tier: form.tier,
  }
}

function CustomerEditor({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerCard | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CustomerFormState>(() =>
    customer
      ? {
          name: customer.name,
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          address: customer.address ?? '',
          credit_limit: customer.credit_limit != null ? String(customer.credit_limit) : '',
          segment: customer.segment || CUSTOMER_SEGMENTS[2],
          tier: customer.tier || CUSTOMER_TIERS[4],
        }
      : EMPTY_FORM,
  )

  const set = (patch: Partial<CustomerFormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const save = useMutation({
    mutationFn: (input: CustomerInput) =>
      customer ? customersApi.update(customer.id, input) : customersApi.create(input),
    onSuccess: () => {
      toast.success(customer ? 'Customer updated' : 'Customer created')
      onClose()
      onSaved()
    },
    onError: (err) => {
      toast.error('Could not save customer', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
          <DialogDescription>
            Customer data is stored server-side. Credit limits are enforced by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Amaka Foods Ltd"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="billing@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-address">Address</Label>
            <Input
              id="customer-address"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street, city, state"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-limit">Credit limit (₦)</Label>
            <Input
              id="customer-limit"
              type="number"
              min={0}
              value={form.credit_limit}
              onChange={(e) => set({ credit_limit: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customer-segment">Segment</Label>
              <Select value={form.segment} onValueChange={(value) => set({ segment: value })}>
                <SelectTrigger id="customer-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_SEGMENTS.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {segment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-tier">Tier</Label>
              <Select value={form.tier} onValueChange={(value) => set({ tier: value })}>
                <SelectTrigger id="customer-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={save.isPending}
            disabled={!form.name.trim()}
            onClick={() => save.mutate(toInput(form))}
          >
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialog({
  card,
  onClose,
  onSaved,
}: {
  card: CustomerCard
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const pay = useMutation({
    mutationFn: () =>
      customersApi.pay({
        customer_id: card.id,
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded')
      onClose()
      onSaved()
    },
    onError: (err) => {
      toast.error('Could not record payment', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {card.name} owes {formatCurrency(card.outstanding_balance)}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Amount (₦)</Label>
            <Input
              id="payment-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="transfer">Bank transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile money</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference / receipt no."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={pay.isPending}
            disabled={!amount || Number(amount) <= 0}
            onClick={() => pay.mutate()}
          >
            <Banknote className="h-4 w-4" />
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatementDialog({ card, onClose }: { card: CustomerCard; onClose: () => void }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', card.id, 'statement'],
    queryFn: () => customersApi.statement(card.id),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statement — {card.name}</DialogTitle>
          <DialogDescription>Ledger entries as calculated by the backend.</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <LoadingState variant="table" rows={5} />
        )}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Opening balance</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.opening_balance)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Charges</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.charges)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Payments</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.payments)}
                </p>
              </div>
              <div className="col-span-3 rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Closing balance</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(data.data.closing_balance)}
                </p>
              </div>
            </div>

            {data.data.entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                No ledger entries in the selected period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(entry.date, { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{entry.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {entry.debit ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {entry.credit ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
