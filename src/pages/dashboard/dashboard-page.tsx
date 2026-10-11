import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarX,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  History,
  Lock,
  PackageX,
  PieChart,
  PiggyBank,
  ReceiptText,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  dashboardApi,
  type ActivityEntry,
  type DashboardPeriod,
  type LatestSale,
  type StaffPerformance,
} from '@/lib/api/endpoints/dashboard'
import { shiftApi } from '@/lib/api/endpoints/shifts'
import { useAppStore } from '@/stores/app'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/sonner'
import { StatusBadge } from '@/components/common/status-badge'
import { SectionCard } from '@/components/common/section-card'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { formatCurrency, formatDateTime, formatNumber, formatRelative, cn } from '@/lib/utils'

type Period = DashboardPeriod

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TONE = {
  primary: { text: 'text-primary', bg: 'bg-primary/10', bar: 'bg-primary' },
  success: { text: 'text-success', bg: 'bg-success/10', bar: 'bg-success' },
  warning: { text: 'text-warning', bg: 'bg-warning/10', bar: 'bg-warning' },
  info: { text: 'text-info', bg: 'bg-info/10', bar: 'bg-info' },
  destructive: { text: 'text-destructive', bg: 'bg-destructive/10', bar: 'bg-destructive' },
  muted: { text: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground' },
} as const

type Tone = keyof typeof TONE

const METHOD_META: Record<string, { label: string; tone: Tone }> = {
  cash: { label: 'Cash In Tills', tone: 'success' },
  bank_transfer: { label: 'Instant Transfer', tone: 'primary' },
  transfer: { label: 'Instant Transfer', tone: 'primary' },
  card: { label: 'POS Card', tone: 'info' },
  online: { label: 'Online / USSD', tone: 'info' },
  credit: { label: 'Customer Credit', tone: 'warning' },
  wallet: { label: 'Wallet', tone: 'info' },
  split: { label: 'Split Payment', tone: 'muted' },
}

function methodMeta(method: string) {
  return METHOD_META[method] ?? { label: method.replace(/_/g, ' '), tone: 'muted' as Tone }
}

export function DashboardPage() {
  const context = useAppStore((s) => s.context)
  const branchId = context?.branch?.id
  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return isoDate(d)
  })
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()))

  const isCustom = period === 'custom'
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? 'Today'

  const handleFromChange = (value: string) => {
    if (value === '') return
    if (customTo && value > customTo) {
      setCustomTo(value)
      toast.info('End date moved forward to keep the range valid.')
    }
    setCustomFrom(value)
  }

  const handleToChange = (value: string) => {
    if (value === '') return
    if (customFrom && value < customFrom) {
      setCustomFrom(value)
      toast.info('Start date moved back to keep the range valid.')
    }
    setCustomTo(value)
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', branchId, period, isCustom ? customFrom : null, isCustom ? customTo : null],
    queryFn: () =>
      dashboardApi.get({
        period,
        branch_id: branchId,
        ...(isCustom ? { from: customFrom, to: customTo } : {}),
      }),
    enabled: !!context,
  })

  const shifts = useQuery({
    queryKey: ['shifts', 'open', branchId],
    queryFn: () => shiftApi.history({ status: 'open', per_page: 100 }),
    enabled: !!context,
    retry: false,
  })

  if (!context) return <LoadingState variant="dashboard" />
  if (isLoading) return <LoadingState variant="dashboard" />
  if (isError || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const d = data.data
  const k = d.kpis
  const currency = k.sales.currency
  const salesAmount = k.sales.amount
  const txns = k.transaction_count
  const grossProfit = k.gross_profit.amount
  const expenses = k.expenses.amount
  const netMarginPct = salesAmount > 0 ? (grossProfit / salesAmount) * 100 : 0
  const netEstimate = grossProfit - expenses
  const receivables = k.customer_credit.amount
  const walletBalance = k.wallet_balance.amount
  const paymentTotal = d.payment_breakdown.reduce((sum, p) => sum + p.amount, 0)

  const openShifts = shifts.data?.data ?? []
  const tillsCash = openShifts.reduce((sum, s) => sum + (s.expected_cash ?? 0), 0)

  const trendValues = d.sales_trend.map((p) => p.value)
  const trendMax = Math.max(...trendValues, 1)
  const lastTrend = trendValues[trendValues.length - 1] ?? 0
  const prevTrend = trendValues[trendValues.length - 2] ?? 0
  const trendPct = prevTrend > 0 ? ((lastTrend - prevTrend) / prevTrend) * 100 : null

  const criticalCount =
    (k.pending_payments > 0 ? 1 : 0) +
    (k.pending_inventory_approvals > 0 ? 1 : 0) +
    (k.expired_stock_count > 0 ? 1 : 0) +
    (k.expiring_stock_count > 0 ? 1 : 0) +
    (k.low_stock_count > 0 ? 1 : 0)

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Branch node & live health */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent">
                <Building2 className="h-5 w-5 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Branch Node
                </p>
                <p className="truncate text-base font-semibold text-foreground">
                  {context?.branch?.name ?? 'All branches'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{context?.business.name}</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Online
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <HealthPill tone="warning" icon={<BadgeCheck className="h-3.5 w-3.5" />}>
              {openShifts[0] ? `Shift #${openShifts[0].id} Open` : 'No open shift'}
            </HealthPill>
            <HealthPill tone="success" icon={<CreditCard className="h-3.5 w-3.5" />}>
              {context?.subscription.plan ?? 'No plan'} · {context?.subscription.status ?? 'none'}
            </HealthPill>
            <HealthPill tone="muted" icon={<Coins className="h-3.5 w-3.5" />}>
              {openShifts.length} open drawer{openShifts.length === 1 ? '' : 's'}
            </HealthPill>
          </div>
        </CardContent>
      </Card>

      {/* Period filter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors',
                period === p.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-accent text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-surface p-2.5">
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              From
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => handleFromChange(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              To
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => handleToChange(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </label>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {customFrom} → {customTo}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero KPI */}
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {periodLabel} Gross Sales
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {formatCurrency(salesAmount, currency)}
                  </span>
                  {trendPct !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold',
                        trendPct >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {trendPct >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {trendPct >= 0 ? '+' : ''}
                      {trendPct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(txns)} transactions
                  {txns > 0 && ` · avg ${formatCurrency(salesAmount / txns, currency)}`}
                </p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent">
                <Banknote className="h-5 w-5 text-primary" />
              </span>
            </div>

            {/* 7-day sparkline */}
            <div className="mt-4 flex h-14 items-end justify-between gap-1">
              {d.sales_trend.map((point, i) => {
                const isLast = i === d.sales_trend.length - 1
                const height = Math.max((point.value / trendMax) * 100, 4)
                return (
                  <div key={`${point.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-full rounded-t-sm',
                        isLast ? 'bg-primary' : 'bg-accent',
                      )}
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${formatCurrency(point.value, currency)}`}
                    />
                    <span
                      className={cn(
                        'font-mono text-[9px]',
                        isLast ? 'text-primary' : 'text-muted-foreground/60',
                      )}
                    >
                      {isLast ? 'Now' : point.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-2">
          <MiniKpi
            label="Net Margin"
            value={`${netMarginPct.toFixed(1)}%`}
            hint={`${formatCurrency(netEstimate, currency)} est. net`}
            tone="success"
            icon={<Activity className="h-4 w-4" />}
          />
          <MiniKpi
            label="Receivables"
            value={formatCurrency(receivables, currency)}
            hint="Outstanding customer balances"
            tone="warning"
            icon={<Wallet className="h-4 w-4" />}
          />
          <MiniKpi
            label="Tills Cash"
            value={formatCurrency(tillsCash, currency)}
            hint={`${openShifts.length} open drawer${openShifts.length === 1 ? '' : 's'}`}
            tone="primary"
            icon={<Coins className="h-4 w-4" />}
          />
          <MiniKpi
            label="Org Wallet"
            value={formatCurrency(walletBalance, currency)}
            hint="Business wallet balance"
            tone="success"
            icon={<PiggyBank className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Operational alerts */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Urgent Operational Alerts</h2>
          </div>
          {criticalCount > 0 ? (
            <Badge variant="destructive" className="font-mono text-[10px] font-bold">
              {criticalCount} CRITICAL
            </Badge>
          ) : (
            <Badge variant="success" className="font-mono text-[10px]">
              ALL CLEAR
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {criticalCount === 0 && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/10">
                  <BadgeCheck className="h-4 w-4 text-success" />
                </span>
                <p className="text-sm text-muted-foreground">
                  No urgent actions. Payments, approvals and stock are up to date.
                </p>
              </CardContent>
            </Card>
          )}

          {k.pending_payments > 0 && (
            <AlertRow
              tone="info"
              icon={<ReceiptText className="h-4 w-4" />}
              title={`${k.pending_payments} payment${k.pending_payments === 1 ? '' : 's'} awaiting confirmation`}
              value="Finance"
              description="Sales payments pending finance approval or reconciliation."
              to="/finance"
              cta="Review payments"
            />
          )}

          {k.pending_inventory_approvals > 0 && (
            <AlertRow
              tone="warning"
              icon={<ClipboardList className="h-4 w-4" />}
              title={`${k.pending_inventory_approvals} inventory adjustment${k.pending_inventory_approvals === 1 ? '' : 's'} pending`}
              value="Inventory"
              description="Stock adjustments awaiting approval before they post to inventory."
              to="/inventory"
              cta="Approve adjustments"
            />
          )}

          {k.expired_stock_count > 0 && (
            <AlertRow
              tone="destructive"
              icon={<CalendarX className="h-4 w-4" />}
              title={`${k.expired_stock_count} expired stock batch${k.expired_stock_count === 1 ? '' : 'es'}`}
              value="Expired"
              description="Expired batches are available in stock and should be written off."
              to="/inventory/expiry"
              cta="Write off stock"
            />
          )}

          {k.expiring_stock_count > 0 && (
            <AlertRow
              tone="warning"
              icon={<CalendarX className="h-4 w-4" />}
              title={`${k.expiring_stock_count} SKU${k.expiring_stock_count === 1 ? '' : 's'} expiring within 30 days`}
              value="Expiring"
              description="Consider clearance promotions before these batches expire."
              to="/inventory/expiry"
              cta="Apply clearance discount"
            />
          )}

          {k.low_stock_count > 0 && (
            <AlertRow
              tone="primary"
              icon={<PackageX className="h-4 w-4" />}
              title={`${k.low_stock_count} item${k.low_stock_count === 1 ? '' : 's'} low on stock`}
              value="Restock"
              description="These products are at or below their reorder threshold."
              to="/inventory"
              cta="Review stock levels"
            />
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Branch ranking */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Store className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Store Network Realtime</h2>
              </div>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {d.branch_performance.length} active
              </span>
            </div>

            {d.branch_performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branch data available.</p>
            ) : (
              <div className="space-y-2.5">
                {[...d.branch_performance]
                  .sort((a, b) => b.sales - a.sales)
                  .map((b) => {
                    const top = Math.max(...d.branch_performance.map((x) => x.sales), 1)
                    const pct = Math.round((b.sales / top) * 100)
                    const tier: Tone = pct >= 95 ? 'success' : pct >= 70 ? 'primary' : 'warning'
                    return (
                      <div key={b.branch_id} className="space-y-1.5 rounded-lg bg-surface p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {b.branch_name}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {formatNumber(b.transactions)} txns
                              {b.transactions > 0 &&
                                ` · avg ${formatCurrency(b.sales / b.transactions, currency)}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-bold text-foreground">
                              {formatCurrency(b.sales, currency)}
                            </p>
                            <p className={cn('font-mono text-[10px]', TONE[tier].text)}>{pct}% of top</p>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                          <div
                            className={cn('h-full rounded-full', TONE[tier].bar)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment channel split */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PieChart className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Payment Channel Split</h2>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatCurrency(paymentTotal, currency)} total
              </span>
            </div>

            {d.payment_breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded for this period.</p>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-accent">
                  {d.payment_breakdown.map((p) => {
                    const pct = paymentTotal > 0 ? (p.amount / paymentTotal) * 100 : 0
                    return (
                      <div
                        key={p.method}
                        className={cn('h-full', TONE[methodMeta(p.method).tone].bar)}
                        style={{ width: `${pct}%` }}
                        title={`${methodMeta(p.method).label}: ${pct.toFixed(0)}%`}
                      />
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[...d.payment_breakdown]
                    .sort((a, b) => b.amount - a.amount)
                    .map((p) => {
                      const meta = methodMeta(p.method)
                      const pct = paymentTotal > 0 ? (p.amount / paymentTotal) * 100 : 0
                      return (
                        <div
                          key={p.method}
                          className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[meta.tone].bar)} />
                            <span className="truncate text-xs text-foreground">{meta.label}</span>
                          </div>
                          <div className="shrink-0 text-right font-mono text-[10px]">
                            <span className="font-semibold text-foreground">{pct.toFixed(0)}%</span>
                            <span className="block text-muted-foreground">
                              {formatCurrency(p.amount, currency)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-foreground">Quick Management Actions</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <QuickAction
            icon={<ClipboardCheck className="h-5 w-5 text-success" />}
            title="Approve Pending Payments"
            description={
              k.pending_payments > 0
                ? `${k.pending_payments} payment${k.pending_payments === 1 ? '' : 's'} awaiting finance`
                : 'No payments awaiting approval'
            }
            to="/finance"
          />
          <QuickAction
            icon={<ArrowLeftRight className="h-5 w-5 text-primary" />}
            title="Initiate Stock Transfer"
            description="Rebalance inventory between branches"
            to="/inventory"
          />
          <QuickAction
            icon={<Lock className="h-5 w-5 text-warning" />}
            title="Reconcile / Close Tills"
            description={
              openShifts.length > 0
                ? `${openShifts.length} open shift${openShifts.length === 1 ? '' : 's'} to reconcile`
                : 'Open a shift to start selling'
            }
            to="/shifts"
          />
        </div>
      </section>

      {/* Staff performance + latest sales */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StaffPerformanceCard staff={d.staff_performance} currency={currency} />
        <LatestSalesCard sales={d.latest_sales} currency={currency} />
      </div>

      <RecentActivityCard entries={d.recent_activity} />
    </div>
  )
}

function StaffPerformanceCard({
  staff,
  currency,
}: {
  staff: StaffPerformance[]
  currency: string
}) {
  return (
    <SectionCard
      title="Team Performance"
      icon={<Users className="h-4 w-4" />}
      meta={`${staff.length} staff`}
    >
      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff sales recorded for this period.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((s, i) => (
            <div key={s.staff_id} className="flex items-center gap-3 rounded-lg bg-surface p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-[11px] font-bold text-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{s.staff_name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {formatNumber(s.transactions)} txns
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm font-bold text-foreground">
                {formatCurrency(s.sales, currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function LatestSalesCard({ sales, currency }: { sales: LatestSale[]; currency: string }) {
  return (
    <SectionCard
      title="Latest Sales"
      icon={<ReceiptText className="h-4 w-4" />}
      action={
        <Link
          to="/sales"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface p-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-semibold text-foreground">
                    {sale.reference}
                  </span>
                  <StatusBadge
                    status={sale.payment_status ?? sale.status}
                    className="shrink-0 font-mono text-[9px]"
                  />
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {sale.customer_name ?? 'Walk-in'}
                  {sale.branch_name ? ` · ${sale.branch_name}` : ''} ·{' '}
                  {formatDateTime(sale.created_at)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-bold text-foreground">
                {formatCurrency(Number(sale.total), currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function RecentActivityCard({ entries }: { entries: ActivityEntry[] }) {
  return (
    <SectionCard
      title="Recent Activity"
      icon={<History className="h-4 w-4" />}
      meta={`${entries.length} events`}
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-lg bg-surface p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium capitalize text-foreground">
                  {entry.action.replace(/[._]/g, ' ')}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {entry.entity_type ?? 'system'}
                  {entry.entity_id ? ` #${entry.entity_id}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {formatRelative(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function HealthPill({
  tone,
  icon,
  children,
}: {
  tone: Tone
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        TONE[tone].text,
        TONE[tone].bg,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

function MiniKpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string
  hint: string
  tone: Tone
  icon: React.ReactNode
}) {
  return (
    <Card className="flex flex-col justify-between">
      <CardContent className="flex h-full flex-col justify-between p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className={TONE[tone].text}>{icon}</span>
        </div>
        <div className="mt-2">
          <p className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {value}
          </p>
          <p className={cn('mt-0.5 truncate font-mono text-[10px]', TONE[tone].text)}>{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertRow({
  tone,
  icon,
  title,
  value,
  description,
  to,
  cta,
}: {
  tone: Tone
  icon: React.ReactNode
  title: string
  value: string
  description: string
  to: string
  cta: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONE[tone].bg)}>
          <span className={TONE[tone].text}>{icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
            <span className={cn('shrink-0 font-mono text-[10px]', TONE[tone].text)}>{value}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <Link
            to={to}
            className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 font-mono text-[10px] transition-colors hover:bg-muted',
              TONE[tone].text,
            )}
          >
            {cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAction({
  icon,
  title,
  description,
  to,
}: {
  icon: React.ReactNode
  title: string
  description: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3 text-left shadow-card transition-all hover:bg-surface-elevated active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent">{icon}</span>
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
