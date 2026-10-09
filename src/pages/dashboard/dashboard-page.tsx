import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Activity,
  Banknote,
  CalendarClock,
  PackageX,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { dashboardApi } from '@/lib/api/endpoints/dashboard'
import { useAppStore } from '@/stores/app'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { BarChart } from '@/components/common/bar-chart'
import { BudgetSelector } from '@/components/common/budget-selector'

export function DashboardPage() {
  const context = useAppStore((s) => s.context)
  const branchId = context?.branch?.id

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => dashboardApi.get({ period: 'today', branch_id: branchId }),
    enabled: !!context,
  })

  if (isLoading) return <LoadingState variant="dashboard" />

  if (isError || !data) return <ErrorState error={error} onRetry={() => refetch()} />

  const d = data.data
  const k = d.kpis
  const maxTrend = Math.max(...d.sales_trend.map((p) => p.value), 1)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`${context?.business.name} · ${context?.branch?.name ?? 'All branches'} — ${k.period}`}
      >
        <BudgetSelector />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatCurrency(k.sales.amount)}
          hint={`${formatNumber(k.transaction_count)} transactions`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Gross profit"
          value={formatCurrency(k.gross_profit.amount)}
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label="Pending payments"
          value={formatNumber(k.pending_payments)}
          hint="Awaiting finance confirmation"
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <StatCard
          label="Customer credit"
          value={formatCurrency(k.customer_credit.amount)}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
        <StatCard
          label="Low stock items"
          value={formatNumber(k.low_stock_count)}
          icon={<PackageX className="h-4 w-4" />}
          className="sm:col-span-1"
        />
        <StatCard
          label="Expiring stock"
          value={formatNumber(k.expiring_stock_count)}
          hint={`${formatNumber(k.expired_stock_count)} expired`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Inventory approvals"
          value={formatNumber(k.pending_inventory_approvals)}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>Revenue this period across branches</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart data={d.sales_trend} max={maxTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment breakdown</CardTitle>
            <CardDescription>By payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {d.payment_breakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            )}
            {d.payment_breakdown.map((p) => {
              const pct = k.sales.amount > 0 ? Math.round((p.amount / k.sales.amount) * 100) : 0
              return (
                <div key={p.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize text-foreground">{p.method.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(p.amount)}
                      <span className="ml-1.5 text-xs text-muted-foreground/60">{pct}%</span>
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-1.5">
                Branch performance <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Sales by branch</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.branch_performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branch data available.</p>
            ) : (
              <div className="space-y-4">
                {d.branch_performance.map((b) => {
                  const pct =
                    d.branch_performance.length > 0
                      ? Math.round(
                          (b.sales /
                            Math.max(...d.branch_performance.map((x) => x.sales), 1)) *
                            100,
                        )
                      : 0
                  return (
                    <div key={b.branch_id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium text-foreground">{b.branch_name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(b.sales)} · {formatNumber(b.transactions)}
                          </span>
                        </div>
                        <Progress value={pct} className="mt-2 h-1.5" />
                      </div>
                      {b.trend_percent !== undefined && (
                        <Badge variant={b.trend_percent >= 0 ? 'success' : 'destructive'}>
                          {b.trend_percent >= 0 ? '+' : ''}
                          {b.trend_percent}%
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>This period</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {formatCurrency(k.expenses.amount)}
            </p>
            <StatCard
              label="Wallet balance"
              value={formatCurrency(k.wallet_balance.amount)}
              icon={<Wallet className="h-4 w-4" />}
              className="mt-4 border-transparent bg-surface"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}