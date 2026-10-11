import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Banknote,
  Building2,
  CalendarRange,
  CheckCircle2,
  Coins,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  Gem,
  Landmark,
  Layers,
  Percent,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  financialReportApi,
  type FinancialChannel,
  type FinancialKpis,
  type FinancialPlan,
  type FinancialReportParams,
  type FinancialRevenuePoint,
  type FinancialShrinkage,
  type FinancialTill,
  type FinancialTax,
  type FinancialPeriod,
} from '@/lib/api/endpoints/financial-report'
import {
  reportsApi,
  type ExportFormat,
  type ReportType,
} from '@/lib/api/endpoints/reports'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatCurrency, formatDate, formatNumber, formatRelative } from '@/lib/utils'

type ReportCategory = 'financial' | 'sales' | 'inventory' | 'statements'

interface ReportEntry {
  type: ReportType
  title: string
  category: ReportCategory
  description: string
}

const REPORT_LIBRARY: ReportEntry[] = [
  { type: 'revenue', title: 'Revenue', category: 'financial', description: 'Revenue recognised by period' },
  { type: 'profit', title: 'Profit & Loss', category: 'financial', description: 'Gross margin by product line' },
  { type: 'expenses', title: 'Expense Ledger', category: 'financial', description: 'Operating expenditure by cost center' },
  { type: 'sales', title: 'Sales Ledger', category: 'sales', description: 'Every completed transaction' },
  { type: 'reconciliation', title: 'Payments Reconciliation', category: 'sales', description: 'Settlement by method' },
  { type: 'cash-variance', title: 'Cash Variance', category: 'sales', description: 'Till variance by shift' },
  { type: 'transfers', title: 'Stock Transfers', category: 'sales', description: 'Inter-branch movements' },
  { type: 'inventory-valuation', title: 'Inventory Valuation', category: 'inventory', description: 'Stock value at cost' },
  { type: 'inventory-movement', title: 'Inventory Movement', category: 'inventory', description: 'In/out stock audit trail' },
  { type: 'low-stock', title: 'Low Stock', category: 'inventory', description: 'Items at or below threshold' },
  { type: 'expired', title: 'Expired Stock', category: 'inventory', description: 'Batches past expiry' },
  { type: 'expiring', title: 'Expiring Stock', category: 'inventory', description: 'Batches within 30 days' },
  { type: 'damaged', title: 'Damage & Waste', category: 'inventory', description: 'Written-off stock entries' },
  { type: 'receivables', title: 'Receivables', category: 'statements', description: 'Customer credit balances' },
  { type: 'payables', title: 'Payables', category: 'statements', description: 'Supplier balances owed' },
]

const CATEGORY_META: Record<ReportCategory, { label: string; text: string; bar: string }> = {
  financial: { label: 'Financial & P&L', text: 'text-primary', bar: 'bg-primary' },
  sales: { label: 'Sales & Tills', text: 'text-success', bar: 'bg-success' },
  inventory: { label: 'Inventory & Waste', text: 'text-tertiary', bar: 'bg-tertiary' },
  statements: { label: 'Statements & Tax', text: 'text-info', bar: 'bg-info' },
}

const CHANNEL_TONE: Record<string, { bar: string; text: string; ring: string }> = {
  counter: { bar: 'bg-primary', text: 'text-primary', ring: 'bg-primary/10' },
  b2b: { bar: 'bg-success', text: 'text-success', ring: 'bg-success/10' },
  digital: { bar: 'bg-tertiary', text: 'text-tertiary', ring: 'bg-tertiary/10' },
}

const PERIOD_OPTIONS: { value: FinancialPeriod; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

function momTone(pct: number | null): { text: string; icon: typeof TrendingUp } {
  if (pct === null) return { text: 'text-muted-foreground', icon: TrendingUp }
  return pct >= 0
    ? { text: 'text-success', icon: TrendingUp }
    : { text: 'text-destructive', icon: TrendingDown }
}

export function FinancialReportPage() {
  const branches = useAppStore((s) => s.branches)
  const { can } = usePermissions()
  const canView = can('reports.view')

  const [period, setPeriod] = useState<FinancialPeriod>('mtd')
  const [branchId, setBranchId] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [category, setCategory] = useState<ReportCategory | 'all'>('all')
  const [auditOpen, setAuditOpen] = useState(false)

  const params: FinancialReportParams = {
    period,
    branch_id: branchId === 'all' ? undefined : Number(branchId),
    from: period === 'custom' ? customFrom || undefined : undefined,
    to: period === 'custom' ? customTo || undefined : undefined,
  }

  const summaryQuery = useQuery({
    queryKey: ['financial-report', params],
    queryFn: () => financialReportApi.summary(params),
    enabled: canView,
    refetchInterval: 60_000,
  })

  const exportMutation = useMutation({
    mutationFn: ({ type, format }: { type: ReportType; format: ExportFormat }) =>
      reportsApi.export(format, {
        report_type: type,
        from: summary?.period.from,
        to: summary?.period.to,
        branch_id: params.branch_id,
      }),
    onSuccess: (res) => {
      toast.success(`${res.data.title} · ${res.data.format.toUpperCase()} ready`, {
        description: res.data.filename,
      })
    },
    onError: (err) => {
      toast.error('Export failed', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const exportReport = (type: ReportType, format: ExportFormat) =>
    exportMutation.mutate({ type, format })

  const summary = summaryQuery.data?.data

  if (!canView) {
    return (
      <div className="animate-fade-in space-y-3 pb-24">
        <PageHeader
          eyebrow="Financial Command"
          title="Financial Intelligence"
          description="Executive ledger, audit and statutory reporting."
        />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Access restricted</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              You need the reports.view permission to open the financial ledger.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        periodLabel={summary?.period.label}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <PageHeader
        eyebrow="Financial Command"
        title="Financial Intelligence"
        description="Executive P&L, till reconciliation, shrinkage and statutory tax position."
      >
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <ShieldCheck className="h-3 w-3" />
          Audit Ready
        </span>
      </PageHeader>

      <ControlBar
        period={period}
        onPeriod={setPeriod}
        branchId={branchId}
        onBranch={setBranchId}
        branches={branches}
        from={customFrom}
        to={customTo}
        onFrom={setCustomFrom}
        onTo={setCustomTo}
        syncedAt={summary?.synced_at}
      />

      {summaryQuery.isError && !summaryQuery.isLoading && (
        <ErrorState error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      )}

      {summaryQuery.isLoading && !summary && <FinancialSkeleton />}

      {summary && (
        <>
          <KpiMatrix kpis={summary.kpis} currency={summary.currency} />

          <QuickActions
            pending={exportMutation.isPending}
            onAuditPack={() => setAuditOpen(true)}
            onExport={exportReport}
          />

          <ReportCategoryPills category={category} onSelect={setCategory} />

          <ReportLibrary
            category={category}
            pending={exportMutation.isPending}
            onExport={exportReport}
          />

          <ChannelVectorModule
            channels={summary.channels}
            pending={exportMutation.isPending}
            onExport={exportReport}
          />

          <TillReconModule till={summary.till} pending={exportMutation.isPending} onExport={exportReport} />

          <ShrinkageModule
            shrinkage={summary.shrinkage}
            pending={exportMutation.isPending}
            onExport={exportReport}
          />

          <TaxModule tax={summary.tax} pending={exportMutation.isPending} onExport={exportReport} />

          <PlanModule plan={summary.plan} />
        </>
      )}

      {auditOpen && (
        <AuditPackDialog
          pending={exportMutation.isPending}
          onExport={exportReport}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </div>
  )
}

function TelemetryBar({
  periodLabel,
  syncing,
  onSync,
}: {
  periodLabel?: string
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
          Financial Ledger
        </span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
          {periodLabel ?? 'All Periods'}
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
  )
}

function ControlBar({
  period,
  onPeriod,
  branchId,
  onBranch,
  branches,
  from,
  to,
  onFrom,
  onTo,
  syncedAt,
}: {
  period: FinancialPeriod
  onPeriod: (value: FinancialPeriod) => void
  branchId: string
  onBranch: (value: string) => void
  branches: { id: number; name: string }[]
  from: string
  to: string
  onFrom: (value: string) => void
  onTo: (value: string) => void
  syncedAt?: string
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface-elevated p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Period</span>
          <Select value={period} onValueChange={(value) => onPeriod(value as FinancialPeriod)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Branch Scope</span>
          <Select value={branchId} onValueChange={onBranch}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {period === 'custom' && (
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
          <CalendarRange className="h-3 w-3" />
          {syncedAt ? `Synced ${formatRelative(syncedAt)}` : 'Awaiting sync'}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5">
          <Landmark className="h-3 w-3 text-success" />
          NGN (₦) Ledger
        </span>
      </div>
    </div>
  )
}

function KpiMatrix({ kpis, currency }: { kpis: FinancialKpis; currency: string }) {
  const revenue = kpis.gross_revenue
  const mom = momTone(revenue.mom_pct)
  const MomIcon = mom.icon

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="relative col-span-2 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-primary/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gross Revenue
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-1.5 font-mono text-lg font-bold tracking-tight text-foreground">
          {formatCurrency(revenue.value, currency)}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className={cn('inline-flex items-center gap-1 font-mono text-[10px] font-semibold', mom.text)}>
            <MomIcon className="h-3 w-3" />
            {revenue.mom_pct === null
              ? 'No prior period'
              : `${revenue.mom_pct >= 0 ? '+' : ''}${revenue.mom_pct}% MoM`}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatNumber(revenue.orders)} orders · avg {formatCurrency(revenue.orders > 0 ? revenue.value / revenue.orders : 0, currency)}
          </span>
        </div>
        <div className={cn('mt-1', mom.text)}>
          <Sparkline points={revenue.trend} />
        </div>
      </div>

      <KpiCard
        label="Net Margin"
        value={formatCurrency(kpis.net_profit.value, currency)}
        tone="success"
        icon={<Wallet className="h-3.5 w-3.5" />}
        primary={`${kpis.net_profit.margin_pct}% rate`}
        secondary={`${formatCurrency(kpis.net_profit.gross_profit, currency)} gross`}
        footer={`OPEX ${formatCurrency(kpis.net_profit.expenses, currency)}`}
      />

      <KpiCard
        label="Cost of Goods"
        value={formatCurrency(kpis.cogs.value, currency)}
        tone="tertiary"
        icon={<Coins className="h-3.5 w-3.5" />}
        primary={`${kpis.cogs.pct_of_gmv}% of GMV`}
        secondary="FEFO weighted cost"
        footer="Landed cost basis"
      />

      <KpiCard
        label="Tax & VAT"
        value={formatCurrency(kpis.tax_vat.value, currency)}
        tone="info"
        icon={<Scale className="h-3.5 w-3.5" />}
        primary={`${kpis.tax_vat.rate}% VAT`}
        secondary={`${formatNumber(kpis.tax_vat.taxed_orders)} taxed orders`}
        footer="Output VAT · FIRS ready"
        className="col-span-2"
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
  icon,
  primary,
  secondary,
  footer,
  className,
}: {
  label: string
  value: string
  tone: 'success' | 'tertiary' | 'info' | 'warning'
  icon: ReactNode
  primary: string
  secondary: string
  footer: string
  className?: string
}) {
  const toneMap = {
    success: { chip: 'bg-success/15 text-success', glow: 'bg-success/10', text: 'text-success' },
    tertiary: { chip: 'bg-tertiary/15 text-tertiary', glow: 'bg-tertiary/10', text: 'text-tertiary' },
    info: { chip: 'bg-info/15 text-info', glow: 'bg-info/10', text: 'text-info' },
    warning: { chip: 'bg-warning/15 text-warning', glow: 'bg-warning/10', text: 'text-warning' },
  }[tone]

  return (
    <div className={cn('relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5', className)}>
      <div className={cn('pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-lg', toneMap.glow)} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('grid h-6 w-6 place-items-center rounded', toneMap.chip)}>{icon}</span>
      </div>
      <div>
        <div className={cn('mt-1.5 font-mono text-base font-bold tracking-tight', toneMap.text)}>{value}</div>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {primary} · {secondary}
        </p>
      </div>
      <div className={cn('mt-1.5 inline-flex w-max items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider', toneMap.text)}>
        {footer}
      </div>
    </div>
  )
}

function Sparkline({ points }: { points: FinancialRevenuePoint[] }) {
  if (points.length < 2) {
    return <div className="h-8" />
  }

  const values = points.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = 100 / (points.length - 1)
  const coords = points
    .map((point, index) => {
      const x = index * step
      const y = 30 - ((point.value - min) / range) * 28
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full text-current">
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function QuickActions({
  pending,
  onAuditPack,
  onExport,
}: {
  pending: boolean
  onAuditPack: () => void
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onAuditPack}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Sparkles className="h-4 w-4" />
        Generate Custom Audit Pack
      </button>
      <div className="grid grid-cols-3 gap-2">
        <ExportChip
          label="P/L (PDF)"
          icon={<FileText className="h-4 w-4 text-primary" />}
          disabled={pending}
          onClick={() => onExport('profit', 'pdf')}
        />
        <ExportChip
          label="Z-Tape"
          icon={<Receipt className="h-4 w-4 text-tertiary" />}
          disabled={pending}
          onClick={() => onExport('cash-variance', 'csv')}
        />
        <ExportChip
          label="FIRS (CSV)"
          icon={<FileSpreadsheet className="h-4 w-4 text-success" />}
          disabled={pending}
          onClick={() => onExport('sales', 'csv')}
        />
      </div>
    </div>
  )
}

function ExportChip({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-2 py-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-sunken disabled:opacity-50"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function ReportCategoryPills({
  category,
  onSelect,
}: {
  category: ReportCategory | 'all'
  onSelect: (value: ReportCategory | 'all') => void
}) {
  const pills: { value: ReportCategory | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All Reports', count: REPORT_LIBRARY.length },
    ...(Object.keys(CATEGORY_META) as ReportCategory[]).map((key) => ({
      value: key,
      label: CATEGORY_META[key].label,
      count: REPORT_LIBRARY.filter((entry) => entry.category === key).length,
    })),
  ]

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pills.map((pill) => {
        const selected = category === pill.value
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
            <span className={cn('rounded-full px-1.5 text-[10px]', selected ? 'bg-primary/15' : 'bg-surface-sunken')}>
              {pill.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ReportLibrary({
  category,
  pending,
  onExport,
}: {
  category: ReportCategory | 'all'
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  const entries = REPORT_LIBRARY.filter((entry) => category === 'all' || entry.category === category)

  return (
    <ModuleCard
      icon={<Layers className="h-4 w-4 text-primary" />}
      title="Regulatory & Audit Pack"
      subtitle={`${entries.length} reports`}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => {
          const meta = CATEGORY_META[entry.category]
          return (
            <div
              key={entry.type}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken p-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.bar)} />
                  <span className="truncate text-xs font-semibold text-foreground">{entry.title}</span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {entry.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Export ${entry.title} PDF`}
                  disabled={pending}
                  onClick={() => onExport(entry.type, 'pdf')}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Export ${entry.title} CSV`}
                  disabled={pending}
                  onClick={() => onExport(entry.type, 'csv')}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </ModuleCard>
  )
}

function ChannelVectorModule({
  channels,
  pending,
  onExport,
}: {
  channels: FinancialChannel[]
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  const total = channels.reduce((sum, channel) => sum + channel.amount, 0)
  const active = channels.filter((channel) => channel.pct > 0)

  return (
    <ModuleCard
      icon={<Store className="h-4 w-4 text-primary" />}
      title="Channel Revenue Vector"
      subtitle="POS · B2B · Digital"
    >
      {total <= 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          No settled revenue in this period.
        </p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
            {active.map((channel) => (
              <div
                key={channel.key}
                className={cn('h-full', (CHANNEL_TONE[channel.key] ?? CHANNEL_TONE.counter).bar)}
                style={{ width: `${channel.pct}%` }}
                title={`${channel.label} · ${channel.pct}%`}
              />
            ))}
          </div>

          <div className="mt-3 space-y-2.5">
            {channels.map((channel) => {
              const tone = CHANNEL_TONE[channel.key] ?? CHANNEL_TONE.counter
              return (
                <div key={channel.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className={cn('h-2 w-2 rounded-full', tone.bar)} />
                      {channel.label}
                    </span>
                    <span className={cn('font-mono font-bold', tone.text)}>
                      {channel.pct}% · {formatCurrency(channel.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{formatNumber(channel.orders)} orders</span>
                    <span>AOV {formatCurrency(channel.aov)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${channel.pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <ModuleActions>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('sales', 'csv')}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
          Detailed Matrix
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('revenue', 'csv')}>
          <Download className="h-3.5 w-3.5 text-success" />
          Channel CSV
        </Button>
      </ModuleActions>
    </ModuleCard>
  )
}

function TillReconModule({
  till,
  pending,
  onExport,
}: {
  till: FinancialTill
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  const balanced = Math.abs(till.variance) < 0.01
  const varianceTone = balanced
    ? { text: 'text-success', chip: 'bg-success/10 text-success', label: 'Balanced' }
    : till.variance > 0
      ? { text: 'text-info', chip: 'bg-info/10 text-info', label: 'Over' }
      : { text: 'text-destructive', chip: 'bg-destructive/10 text-destructive', label: 'Short' }

  return (
    <ModuleCard
      icon={<Banknote className="h-4 w-4 text-success" />}
      title="Till & Cash Reconciliation"
      subtitle={`${till.closed}/${till.tills} tills closed`}
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Expected Cash" value={formatCurrency(till.expected)} />
        <Metric label="Audited Physical" value={formatCurrency(till.audited)} />
      </div>

      <div className={cn('mt-2 flex items-center justify-between rounded-xl border px-3 py-2', balanced ? 'border-success/30' : 'border-destructive/30')}>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase', varianceTone.chip)}>
            {varianceTone.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">Variance vs expected</span>
        </div>
        <span className={cn('font-mono text-sm font-bold tabular-nums', varianceTone.text)}>
          {till.variance > 0 ? '+' : ''}
          {formatCurrency(till.variance)}
          <span className="ml-1 text-[10px] font-normal">({till.variance_pct}%)</span>
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>Reconciliation rate</span>
          <span className="text-foreground">{till.rate_pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, till.rate_pct)}%` }} />
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{till.balanced} balanced draws</span>
          <span>Cash sales {formatCurrency(till.cash_sales)}</span>
        </div>
      </div>

      <ModuleActions>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('cash-variance', 'csv')}>
          <Receipt className="h-3.5 w-3.5 text-tertiary" />
          Consolidated Tape
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('reconciliation', 'csv')}>
          <Download className="h-3.5 w-3.5 text-success" />
          Audit Logs
        </Button>
      </ModuleActions>
    </ModuleCard>
  )
}

function ShrinkageModule({
  shrinkage,
  pending,
  onExport,
}: {
  shrinkage: FinancialShrinkage
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  return (
    <ModuleCard
      icon={<Trash2 className="h-4 w-4 text-destructive" />}
      title="Shrinkage & FEFO Audit"
      subtitle={`Inventory at cost ${formatCurrency(shrinkage.inventory_value)}`}
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Total Waste Void"
          value={formatCurrency(shrinkage.waste_value)}
          hint={`${shrinkage.waste_pct}% of stock · ${formatNumber(shrinkage.waste_units)} units`}
          tone="destructive"
        />
        <Metric
          label="Expired Write-off"
          value={formatCurrency(shrinkage.expired_value)}
          hint={`${formatCurrency(shrinkage.near_expiry_value)} expiring ≤30d`}
          tone="warning"
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Highest Throughput Categories
          </span>
          <Percent className="h-3 w-3 text-muted-foreground" />
        </div>
        {shrinkage.categories.length === 0 ? (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
            No category throughput in this period.
          </p>
        ) : (
          <div className="space-y-2">
            {shrinkage.categories.map((row, index) => (
              <div key={row.name} className="flex items-center justify-between rounded-lg bg-surface-sunken px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-xs text-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatNumber(row.units)} units · {formatCurrency(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleActions>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('expiring', 'csv')}>
          <CalendarRange className="h-3.5 w-3.5 text-warning" />
          Expiry Matrix
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('inventory-movement', 'csv')}>
          <Download className="h-3.5 w-3.5 text-success" />
          Stock Log CSV
        </Button>
      </ModuleActions>
    </ModuleCard>
  )
}

function TaxModule({
  tax,
  pending,
  onExport,
}: {
  tax: FinancialTax
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
}) {
  return (
    <ModuleCard
      icon={<Landmark className="h-4 w-4 text-info" />}
      title="Tax Compliance · FIRS & VAT"
      subtitle={`${tax.rate}% standard rate`}
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Output VAT" value={formatCurrency(tax.output_vat)} tone="info" hint={`${formatNumber(tax.taxed_orders)} taxed orders`} />
        <Metric label="Taxable Base" value={formatCurrency(tax.taxable_base)} hint="Net of VAT" />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-sunken px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Total Remittance Due
        </span>
        <span className="font-mono text-sm font-bold text-info">{formatCurrency(tax.total_remittance)}</span>
      </div>

      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-info/5 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-info" />
        Auto-computed from sale tax lines. Firm-ready schedule matches the ledger for audit reconciliation.
      </p>

      <ModuleActions>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('sales', 'pdf')}>
          <FileText className="h-3.5 w-3.5 text-primary" />
          Tax Audit Packet
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => onExport('sales', 'csv')}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
          FIRS CSV
        </Button>
      </ModuleActions>
    </ModuleCard>
  )
}

function PlanModule({ plan }: { plan: FinancialPlan | null }) {
  return (
    <ModuleCard
      icon={<Gem className="h-4 w-4 text-primary" />}
      title="Active Subscription"
      subtitle={plan ? `${plan.plan} · ${plan.status}` : 'No active plan'}
    >
      {plan === null ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          No subscription is attached to this business.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-surface-sunken px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{plan.plan}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {plan.expires_at ? `Renews ${formatDate(plan.expires_at)}` : 'No expiry'}
                </p>
              </div>
            </div>
            <Badge variant={plan.status === 'active' ? 'success' : 'warning'}>{plan.status}</Badge>
          </div>

          <div className="mt-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Enabled Modules
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {plan.features.length === 0 ? (
                <span className="text-xs text-muted-foreground">No modules listed</span>
              ) : (
                plan.features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-sunken px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    {feature}
                  </span>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </ModuleCard>
  )
}

function AuditPackDialog({
  pending,
  onExport,
  onClose,
}: {
  pending: boolean
  onExport: (type: ReportType, format: ExportFormat) => void
  onClose: () => void
}) {
  const [type, setType] = useState<ReportType>('profit')
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const selected = REPORT_LIBRARY.find((entry) => entry.type === type)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Custom Audit Pack</DialogTitle>
          <DialogDescription>
            Build a regulator-ready dataset from the ledger for the selected period and branch scope.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Report</span>
            <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_LIBRARY.map((entry) => (
                  <SelectItem key={entry.type} value={entry.type}>
                    {entry.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {CATEGORY_META[selected.category].label} · {selected.description}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Format</span>
            <div className="grid grid-cols-3 gap-2">
              {(['pdf', 'excel', 'csv'] as ExportFormat[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormat(option)}
                  className={cn(
                    'rounded-xl border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition-colors',
                    format === option
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              onExport(type, format)
              onClose()
            }}
          >
            <Sparkles className="h-4 w-4" />
            Generate Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModuleCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {subtitle && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ModuleActions({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 pt-0.5">{children}</div>
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'destructive' | 'warning' | 'info' | 'success'
}) {
  const textTone = tone
    ? {
        destructive: 'text-destructive',
        warning: 'text-warning',
        info: 'text-info',
        success: 'text-success',
      }[tone]
    : 'text-foreground'

  return (
    <div className="rounded-xl bg-surface-sunken px-2.5 py-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={cn('mt-0.5 font-mono text-sm font-bold tabular-nums', textTone)}>{value}</div>
      {hint && <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function FinancialSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="col-span-2 h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="col-span-2 h-20 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}
