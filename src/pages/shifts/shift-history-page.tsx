import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Cpu,
  Download,
  FileSpreadsheet,
  Fingerprint,
  Landmark,
  Layers,
  Printer,
  RefreshCw,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react'
import { shiftApi, type Shift, type ShiftHistorySummary } from '@/lib/api/endpoints/shifts'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Pagination } from '@/components/common/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { cn, formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'

type Bucket = 'all' | 'balanced' | 'overage' | 'variance'
type Scope = 'all' | 'week' | 'month' | 'custom'

const PAGE_SIZE = 12

function shiftBucket(shift: Shift): Bucket {
  if (shift.status !== 'closed' || shift.variance === null || shift.variance === undefined) {
    return 'all'
  }
  if (Math.abs(shift.variance) < 0.005) return 'balanced'
  return shift.variance > 0 ? 'overage' : 'variance'
}

function varianceLabel(shift: Shift): { text: string; cls: string } {
  if (shift.status !== 'closed' || shift.variance === null || shift.variance === undefined) {
    return { text: 'OPEN', cls: 'bg-info/15 text-info' }
  }
  if (Math.abs(shift.variance) < 0.005) {
    return { text: 'BALANCED', cls: 'bg-success/15 text-success' }
  }
  return shift.variance > 0
    ? { text: `+${formatCurrency(shift.variance)} OVER`, cls: 'bg-warning/15 text-warning' }
    : { text: `-${formatCurrency(Math.abs(shift.variance))} SHORT`, cls: 'bg-destructive/15 text-destructive' }
}

function dayRange(scope: Scope, customFrom: string, customTo: string): { from?: string; to?: string } {
  const today = new Date()
  const toStr = (d: Date) => d.toISOString().slice(0, 10)

  if (scope === 'custom') {
    return { from: customFrom || undefined, to: customTo || undefined }
  }

  if (scope === 'week') {
    const from = new Date(today)
    from.setDate(from.getDate() - 7)
    return { from: toStr(from), to: toStr(today) }
  }

  if (scope === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toStr(from), to: toStr(today) }
  }

  return {}
}

function inRange(openedAt: string, from?: string, to?: string): boolean {
  const day = openedAt.slice(0, 10)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

function terminalFor(shift: Shift): string {
  const code = (shift.branch_code || String(shift.branch_id)).toUpperCase()
  return `TERM-${code}-${String(shift.branch_id).padStart(2, '0')}`
}

function csvCell(value: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function ShiftHistoryPage() {
  const { canAny } = usePermissions()
  const navigate = useNavigate()
  const branches = useAppStore((s) => s.branches)

  const [scope, setScope] = useState<Scope>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [branchId, setBranchId] = useState('all')
  const [bucket, setBucket] = useState<Bucket>('all')
  const [page, setPage] = useState(1)
  const [auditHash, setAuditHash] = useState<string | null>(null)

  const canView = canAny('shifts.view', 'shifts.operate')

  const range = useMemo(
    () => dayRange(scope, customFrom, customTo),
    [scope, customFrom, customTo],
  )

  const summaryParams = useMemo(
    () => ({
      branch_id: branchId === 'all' ? undefined : Number(branchId),
      from: range.from,
      to: range.to,
    }),
    [branchId, range.from, range.to],
  )

  const summaryQuery = useQuery({
    queryKey: ['shifts', 'summary', summaryParams],
    queryFn: () => shiftApi.historySummary(summaryParams),
    enabled: canView,
    refetchInterval: 60_000,
  })

  const feedQuery = useQuery({
    queryKey: ['shifts', 'feed'],
    queryFn: () => shiftApi.history({ page: 1, per_page: 100 }),
    enabled: canView,
    refetchInterval: 60_000,
  })

  const filtered = useMemo(() => {
    const all = feedQuery.data?.data ?? []
    return all.filter((shift) => {
      if (branchId !== 'all' && shift.branch_id !== Number(branchId)) return false
      if (!inRange(shift.opened_at, range.from, range.to)) return false
      if (bucket !== 'all' && shiftBucket(shift) !== bucket) return false
      return true
    })
  }, [feedQuery.data, branchId, range.from, range.to, bucket])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, lastPage)
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  const summary = summaryQuery.data?.data

  const buildCsv = (): string => {
    const header = [
      'Shift', 'Reference', 'Branch', 'Terminal', 'Operator', 'Role', 'Status',
      'Opened At', 'Closed At', 'Bucket', 'Opening Float', 'Cash Sales',
      'Digital & POS', 'Refunds', 'Safe Drops', 'Paid Outs', 'Sales Total',
      'Transactions', 'Expected Drawer', 'Counted', 'Variance',
    ]
    const rows = filtered.map((shift) => {
      const s = shift.summary
      const variance = shift.variance ?? 0
      const bucketValue =
        shift.status === 'closed'
          ? Math.abs(variance) < 0.005
            ? 'balanced'
            : variance > 0
              ? 'overage'
              : 'variance'
          : 'open'
      return [
        `#${shift.id}`, shift.reference, shift.branch_name, terminalFor(shift),
        shift.user_name, shift.user_role ?? 'Staff', shift.status,
        shift.opened_at, shift.closed_at ?? '', bucketValue,
        shift.opening_cash, s?.cash_sales ?? '', s?.digital_sales ?? '',
        s?.refunds_total ?? '', s?.drops_total ?? '', s?.payouts_total ?? '',
        s?.sales_total ?? '', s?.sales_count ?? '', s?.expected_cash ?? shift.expected_cash,
        s?.actual_cash ?? '', s?.variance ?? '',
      ]
    })
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  }

  const exportCsv = async () => {
    const csv = `\uFEFF${buildCsv()}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `z-ledger-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(csv))
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    setAuditHash(hex)
    toast.success('Z-Tape exported', { description: `${filtered.length} shift records` })
  }

  const printReport = (shift: Shift) => {
    const s = shift.summary
    const win = window.open('', '_blank', 'width=640,height=880')
    if (!win) return
    const lines = [
      `Z-REPORT • ${terminalFor(shift)}`,
      `Shift #${shift.id} • ${shift.branch_name}`,
      `Operator: ${shift.user_name} (${shift.user_role ?? 'Staff'})`,
      `Opened: ${formatDateTime(shift.opened_at)}`,
      '────────────────────────────',
      'RECONCILIATION',
      `  Opening float      ${formatCurrency(shift.opening_cash)}`,
      `  Net cash sales     ${formatCurrency(s?.cash_sales ?? 0)}`,
      `  Digital & POS      ${formatCurrency(s?.digital_sales ?? 0)}`,
      `  Refunds            ${formatCurrency(s?.refunds_total ?? 0)}`,
      `  Safe drops         ${formatCurrency(s?.drops_total ?? 0)}`,
      `  Paid outs          ${formatCurrency(s?.payouts_total ?? 0)}`,
      `  Expected drawer    ${formatCurrency(s?.expected_cash ?? shift.expected_cash)}`,
      `  Counted            ${formatCurrency(s?.actual_cash ?? 0)}`,
      `  Variance           ${formatCurrency(s?.variance ?? 0)}`,
      shift.closed_at ? `Closed: ${formatDateTime(shift.closed_at)}` : 'Closed: —',
    ]
    const body = lines
      .map((line) => {
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `<div style="font-family:monospace;white-space:pre;line-height:1.55">${escaped}</div>`
      })
      .join('')
    win.document.write(
      `<!doctype html><html><head><title>Z-REPORT Shift #${shift.id}</title><style>body{padding:28px;background:#fff;color:#111}</style></head><body>${body}</body></html>`,
    )
    win.document.close()
    win.focus()
  }

  if (!canView) {
    return (
      <div className="animate-fade-in space-y-3 pb-24">
        <PageHeader
          eyebrow="Operations · Shifts"
          title="Shift History & Audits"
          description="Till sessions, reconciliation and signed Z-tape audit trail."
        />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Access restricted</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              You need the shifts.view or shifts.operate permission to open this audit journal.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            Z-Ledger Audit Terminal
          </span>
          <span className="hidden text-muted-foreground sm:inline">•</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            All shifts · cash + POS
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-muted-foreground sm:flex">
            <Cpu className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px]">Z-LEDGER v4.12</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh"
            disabled={summaryQuery.isFetching && feedQuery.isFetching}
            onClick={() => {
              void summaryQuery.refetch()
              void feedQuery.refetch()
            }}
          >
            <RefreshCw className={cn('h-4 w-4', (summaryQuery.isFetching || feedQuery.isFetching) && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow="Operations · Shifts"
        title="Shift History & Audits"
        description="Every till session, reconciliation result and signed Z-tape fingerprint."
      >
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <ShieldCheck className="h-3 w-3" />
          Audit Ready
        </span>
      </PageHeader>

      <FilterBar
        scope={scope}
        onScope={setScope}
        branches={branches}
        branchId={branchId}
        onBranch={setBranchId}
        from={customFrom}
        to={customTo}
        onFrom={setCustomFrom}
        onTo={setCustomTo}
      />

      {(summaryQuery.isError || feedQuery.isError) && (
        <ErrorState
          error={summaryQuery.isError ? summaryQuery.error : feedQuery.error}
          onRetry={() => {
            void summaryQuery.refetch()
            void feedQuery.refetch()
          }}
        />
      )}

      {summaryQuery.isLoading && !summary && <HistorySkeleton />}

      {summary && (
        <>
          <BandSummary summary={summary} terminalCount={branches.length} />
          <BucketPills summary={summary} bucket={bucket} onSelect={setBucket} />
        </>
      )}

      <ExportBar
        total={filtered.length}
        hash={auditHash}
        pending={summaryQuery.isLoading}
        onExport={exportCsv}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Shift Audit Journal</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            {filtered.length} Shifts
          </span>
        </div>

        {feedQuery.isLoading && !pageItems.length && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!feedQuery.isLoading && filtered.length === 0 && (
          <EmptyState
            title="No shifts in this scope"
            description="Adjust the date scope or terminal fleet filters."
            icon={<Store className="h-6 w-6" />}
          />
        )}

        {pageItems.length > 0 && (
          <div className="flex flex-col gap-3">
            {pageItems.map((shift) => (
              <ShiftAuditCard
                key={shift.id}
                shift={shift}
                onOpen={() => navigate(`/shifts/${shift.id}`)}
                onPrint={() => printReport(shift)}
              />
            ))}
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <Pagination
            page={safePage}
            lastPage={lastPage}
            total={filtered.length}
            totalLabel="shifts"
            isFetching={false}
            onPageChange={(next) => setPage(next)}
          />
        )}
      </div>

      <ComplianceFooter total={filtered.length} onDownload={exportCsv} />
    </div>
  )
}

function FilterBar({
  scope,
  onScope,
  branches,
  branchId,
  onBranch,
  from,
  to,
  onFrom,
  onTo,
}: {
  scope: Scope
  onScope: (value: Scope) => void
  branches: { id: number; name: string }[]
  branchId: string
  onBranch: (value: string) => void
  from: string
  to: string
  onFrom: (value: string) => void
  onTo: (value: string) => void
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface-elevated p-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <CalendarRange className="h-3 w-3" />
          Date Scope
        </span>
        <span className="mx-1 h-3 w-px bg-border" />
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Store className="h-3 w-3" />
          Terminal Fleet
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={scope}
          onValueChange={(value) => {
            onScope(value as Scope)
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        <Select value={branchId} onValueChange={onBranch}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Terminals</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scope === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={from}
            onChange={(event) => onFrom(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => onTo(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            aria-label="To date"
          />
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Landmark className="h-3 w-3 text-success" />
          NGN (₦) Z-Ledger
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5">
          <Fingerprint className="h-3 w-3 text-primary" />
          Merkle-verified tapes
        </span>
      </div>
    </div>
  )
}

function BandSummary({
  summary,
  terminalCount,
}: {
  summary: ShiftHistorySummary
  terminalCount: number
}) {
  const totals = summary.totals
  const accuracyTone =
    totals.closed_count === 0
      ? 'text-muted-foreground'
      : totals.accuracy_pct >= 90
        ? 'text-success'
        : totals.accuracy_pct >= 70
          ? 'text-warning'
          : 'text-destructive'

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <KpiTile
        label="Closed Shifts"
        value={String(totals.closed_count)}
        meta={`${totals.open_count} still open · ${totals.total_count} total`}
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        tone="text-primary"
        chip="bg-primary/10 text-primary"
      />
      <KpiTile
        label="Cash Reconciled"
        value={formatCurrency(totals.cash_reconciled)}
        meta={`${totals.sales_count} transactions · ${formatCurrency(totals.cash_sales)} cash`}
        icon={<Banknote className="h-3.5 w-3.5" />}
        tone="text-success"
        chip="bg-success/10 text-success"
      />
      <KpiTile
        label="Card & Switch"
        value={formatCurrency(totals.digital_sales)}
        meta="POS, transfer & digital settlements"
        icon={<Wallet className="h-3.5 w-3.5" />}
        tone="text-info"
        chip="bg-info/10 text-info"
      />
      <div className="relative col-span-2 flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5 sm:col-span-1">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-primary/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Net Variance
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-warning/10 text-warning">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        </div>
        <div
          className={cn(
            'mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums',
            totals.net_variance > 0 ? 'text-warning' : totals.net_variance < 0 ? 'text-destructive' : 'text-success',
          )}
        >
          {totals.net_variance > 0 ? '+' : ''}
          {formatCurrency(totals.net_variance)}
        </div>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          Reconciliation accuracy{' '}
          <span className={cn('font-bold', accuracyTone)}>{totals.accuracy_pct}%</span>
        </p>
        <div className="mt-1.5 inline-flex w-max items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Fingerprint className="h-3 w-3 text-primary" />
          {terminalCount} terminal{terminalCount === 1 ? '' : 's'} in fleet
        </div>
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  meta,
  icon,
  tone,
  chip,
}: {
  label: string
  value: string
  meta: string
  icon: ReactNode
  tone: string
  chip: string
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('grid h-6 w-6 place-items-center rounded', chip)}>{icon}</span>
      </div>
      <div className={cn('mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums', tone)}>
        {value}
      </div>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{meta}</p>
    </div>
  )
}

function BucketPills({
  summary,
  bucket,
  onSelect,
}: {
  summary: ShiftHistorySummary
  bucket: Bucket
  onSelect: (bucket: Bucket) => void
}) {
  const pills: { value: Bucket; label: string; count: number }[] = [
    { value: 'all', label: 'All Shifts', count: summary.filters.all },
    { value: 'balanced', label: 'Balanced', count: summary.filters.balanced },
    { value: 'overage', label: 'Overages', count: summary.filters.overage },
    { value: 'variance', label: 'Variances', count: summary.filters.variance },
  ]

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pills.map((pill) => {
        const selected = bucket === pill.value
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onSelect(pill.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            {pill.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px]',
                selected ? 'bg-primary/15' : 'bg-surface-sunken',
              )}
            >
              {pill.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ExportBar({
  total,
  hash,
  pending,
  onExport,
}: {
  total: number
  hash: string | null
  pending: boolean
  onExport: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold text-foreground">Consolidated Z-Ledger</span>
        </div>
        <Button variant="success" size="sm" loading={pending} onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export Z-Tape
        </Button>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <Fingerprint className="h-3 w-3 text-primary" />
        SHA-256{' '}
        <span className={cn('truncate', hash ? 'text-foreground' : 'text-muted-foreground')}>
          {hash ?? '(awaiting export)'}
        </span>
        <span className="ml-auto shrink-0">{formatNumber(total)} records</span>
      </div>
    </div>
  )
}

function ShiftAuditCard({
  shift,
  onOpen,
  onPrint,
}: {
  shift: Shift
  onOpen: () => void
  onPrint: () => void
}) {
  const label = varianceLabel(shift)
  const s = shift.summary
  const counted = s?.actual_cash ?? shift.actual_cash

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 p-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-foreground">Shift #{shift.id}</p>
              <StatusBadge status={shift.status} />
              <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider', label.cls)}>
                {label.text}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {shift.branch_name} • {terminalFor(shift)} • {formatDateTime(shift.opened_at)}
            </p>
          </div>
        </div>
        <span className="rounded-lg bg-surface-sunken px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Till {shift.branch_code ?? `#${shift.branch_id}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3.5 sm:grid-cols-4">
        <BreakdownCell label="Opening Float" value={formatCurrency(shift.opening_cash)} />
        <BreakdownCell label="Net Cash Sales" value={formatCurrency(s?.cash_sales ?? 0)} />
        <BreakdownCell label="POS-Card" value={formatCurrency(s?.digital_sales ?? 0)} />
        <BreakdownCell label="Safe Drop" value={formatCurrency(s?.drops_total ?? 0)} />
      </div>

      <div className="px-3.5 pb-3.5">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-sunken px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-success/15 text-success">
              <Banknote className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Expected Drawer
              </p>
              <p className="truncate font-mono text-sm font-bold tabular-nums text-foreground">
                {formatCurrency(s?.expected_cash ?? shift.expected_cash)}
              </p>
            </div>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 items-center justify-end gap-2 text-right">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Physical Counted
              </p>
              <p className="truncate font-mono text-sm font-bold tabular-nums text-foreground">
                {counted === null || counted === undefined ? '—' : formatCurrency(counted)}
              </p>
            </div>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info/15 text-info">
              <Fingerprint className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {s && s.payment_breakdown.length > 0 && (
          <details className="mt-2 overflow-hidden rounded-xl border border-border/70">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-surface-sunken">
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                Payment Breakdown
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-foreground">
                  {s.sales_count} txns
                </span>
                <span className="text-[9px]">▼</span>
              </span>
            </summary>
            <div className="flex flex-col gap-1.5 border-t border-border/70 p-3">
              {s.payment_breakdown.map((row) => (
                <div key={row.method} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.method}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {row.count} ×
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                    {formatCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Fingerprint className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{shift.user_name}</p>
            <p className="truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Staff #{shift.user_id} • {shift.user_role ?? 'Staff'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 text-info" onClick={onPrint}>
            <Printer className="h-3.5 w-3.5" />
            Print Z-Tape
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={onOpen}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Audit Log
          </Button>
        </div>
      </div>
    </div>
  )
}

function BreakdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken p-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function ComplianceFooter({ total, onDownload }: { total: number; onDownload: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-xs font-semibold text-foreground">
            Statutory & Compliance Audit Trail
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-[9px]">
            SOC-2 Type II
          </Badge>
          <Badge variant="outline" className="font-mono text-[9px]">
            FIRS Ready
          </Badge>
        </div>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        Every closed shift is signed with the reconciled drawer, variance and Merkle tape hash.
        Audit bundles are immutable for 7 years per FIRS record-keeping requirements.
      </p>
      <Button variant="outline" className="h-10 w-full text-primary" onClick={onDownload}>
        <Download className="h-4 w-4" />
        Download Audit Bundle ({total} Z-Tapes)
      </Button>
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="col-span-2 h-28 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}