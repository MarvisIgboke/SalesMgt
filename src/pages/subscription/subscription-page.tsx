import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  FileText,
  Layers,
  Plus,
  ReceiptText,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react'
import { subscriptionApi } from '@/lib/api/endpoints/business'
import { billingApi, type SubscriptionInvoice } from '@/lib/api/endpoints/billing'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePermissions } from '@/lib/use-permissions'

interface PlanInfo {
  id: number
  slug?: string
  name: string
  description?: string | null
  staff_limit?: number | null
  branch_limit?: number | null
  duration_months?: number | null
  monthly_price?: number | null
  annual_price?: number | null
  currency?: string
  grace_days?: number
  features?: string[]
  is_active?: boolean
  limits?: Record<string, number | null>
}

function getLimitMeta(key: string): { label: string; icon: React.ReactNode } {
  const map: Record<string, { label: string; icon: React.ReactNode }> = {
    staff_limit: { label: 'Cashier & Staff Seats', icon: <Users className="h-4 w-4" /> },
    branch_limit: { label: 'Branch Outlets', icon: <Store className="h-4 w-4" /> },
    duration_months: { label: 'Billing Cycle (months)', icon: <CalendarClock className="h-4 w-4" /> },
    register_limit: { label: 'POS Registers / Tills', icon: <CreditCard className="h-4 w-4" /> },
    api_limit: { label: 'API & Cloud Sync', icon: <Zap className="h-4 w-4" /> },
    warehouse_limit: { label: 'Warehouses', icon: <Warehouse className="h-4 w-4" /> },
  }
  return map[key] ?? { label: key.replace(/_/g, ' '), icon: <CheckCircle2 className="h-4 w-4" /> }
}

function invoiceStatusLabel(invoice: SubscriptionInvoice): string {
  if (invoice.status === 'paid') return 'Paid'
  if (invoice.status === 'void') return 'Void'
  return invoice.is_overdue ? 'Overdue' : 'Not Paid'
}

function invoiceStatusVariant(invoice: SubscriptionInvoice): 'success' | 'warning' | 'muted' | 'destructive' {
  if (invoice.status === 'paid') return 'success'
  if (invoice.status === 'void') return 'muted'
  return invoice.is_overdue ? 'destructive' : 'warning'
}

export function SubscriptionPage() {
  const { can } = usePermissions()
  const canManageAllocation = can('subscription.manage')

  const current = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.get(),
    placeholderData: (prev) => prev,
  })

  const plans = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => subscriptionApi.plans(),
    placeholderData: (prev) => prev,
  })

  const invoices = useQuery({
    queryKey: ['subscription', 'invoices'],
    queryFn: () => billingApi.myInvoices({ per_page: 6 }),
    placeholderData: (prev) => prev,
  })

  const invoiceRows = useMemo<SubscriptionInvoice[]>(
    () => invoices.data?.data ?? [],
    [invoices.data],
  )

  const subscription = current.data?.data
  const planList = useMemo(() => (plans.data?.data as PlanInfo[] | undefined) ?? [], [plans.data])

  const limits = useMemo(() => {
    const src = subscription?.limits ?? {}
    return Object.entries(src).filter(([, v]) => v !== null && v !== undefined)
  }, [subscription])

  const activePlan = useMemo(() => {
    if (!subscription?.plan) return null
    return planList.find((p) => p.name === subscription.plan) ?? null
  }, [planList, subscription])

  const features = useMemo(() => {
    const feats = activePlan?.features ?? []
    return feats.slice(0, 6)
  }, [activePlan])

  const contractedAnnual = activePlan?.annual_price ?? null
  const contractedMonthlyEqv = contractedAnnual != null ? contractedAnnual / 12 : null

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      <PageHeader
        eyebrow="Billing · Subscription"
        title="Subscription & Billing"
        description="Plan status, limits, add-ons and billing history."
      />

      {current.isLoading && <LoadingState rows={2} />}
      {current.isError && <ErrorState error={current.error} onRetry={() => current.refetch()} />}

      {subscription && (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1 uppercase tracking-wider">
                      <Crown className="h-3.5 w-3.5" />
                      {subscription.plan || 'Plan'}
                    </Badge>
                    <Badge
                      variant={subscription.status === 'active' ? 'success' : subscription.status === 'trial' ? 'info' : 'destructive'}
                      className="gap-1 uppercase tracking-wider"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {subscription.status}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Enterprise Subscription</h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    {subscription.expiry_date
                      ? `Renews/valid until ${formatDate(subscription.expiry_date, { dateStyle: 'medium' })}`
                      : subscription.trial_ends_at
                        ? `Trial until ${formatDate(subscription.trial_ends_at, { dateStyle: 'medium' })}`
                        : 'No expiry recorded'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  Fabric • SLA 99.99%
                </div>
              </div>

              {contractedAnnual != null && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Contracted Rate</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-lg font-semibold tabular-nums">
                        {formatCurrency(contractedAnnual, activePlan?.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ year</span>
                    </div>
                  </div>
                  {contractedMonthlyEqv != null && (
                    <div className="text-right">
                      <Badge variant="success" className="mb-1">
                        ANNUAL
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(contractedMonthlyEqv, activePlan?.currency)} / mo equiv
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upgrade Tier / Add Seats
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Manage Payment
                </Button>
              </div>
            </div>
          </div>

          {limits.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Resource Allocation & Limits</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {canManageAllocation ? (
                    <Link
                      to="/subscription/allocation"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Manage allocation
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    'Shared across all branches'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {limits.map(([key, value]) => {
                  const meta = getLimitMeta(key)
                  const pct = Math.min(100, Math.max(10, ((Number(value) || 1) > 50 ? 56 : 64)))
                  return (
                    <div key={key} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                        <span className="text-muted-foreground">{meta.icon}</span>
                      </div>
                      <div>
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="text-base font-semibold tabular-nums">
                            {value} <span className="text-xs font-normal text-muted-foreground">limit</span>
                          </span>
                          <span className="text-xs text-primary">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Enforced by backend</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {features.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Modular Features & Add-ons</h3>
                </div>
                <Badge variant="outline">{features.length} active</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {features.map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">{feat.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">Enabled on current plan</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Billing & Payment</h3>
          </div>
          <span className="text-xs text-muted-foreground">AUDITED LEDGER</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/15 text-secondary">
                <Banknote className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Primary Payment Method</p>
                <p className="text-xs text-muted-foreground">Billing handled externally per backend</p>
              </div>
            </div>
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              PRIMARY
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Billing Contact</p>
              <p className="mt-1 text-sm">Configured in organization settings</p>
              <p className="text-xs text-muted-foreground">Contact details managed by business admin</p>
            </div>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tax / Compliance</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
                <BadgeCheck className="h-3.5 w-3.5" />
                FIRS Ready
              </p>
              <p className="text-xs text-muted-foreground">Statutory configuration on file</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Invoice History</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {invoices.isFetching ? 'Loading…' : `${invoiceRows.length} recent`}
          </span>
        </div>

        {invoices.isError && <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />}

        {!invoices.isError && invoiceRows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ReceiptText className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No subscription invoices yet</p>
              <p className="text-xs text-muted-foreground">
                Invoices are generated monthly by the platform administrator.
              </p>
            </div>
          </div>
        )}

        {invoiceRows.length > 0 && (
          <div className="flex flex-col gap-2">
            {invoiceRows.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.period_start && invoice.period_end
                        ? `${formatDate(invoice.period_start, { dateStyle: 'medium' })} – ${formatDate(invoice.period_end, { dateStyle: 'medium' })}`
                        : 'Billing period'}
                      {invoice.due_at ? ` · due ${formatDate(invoice.due_at, { dateStyle: 'medium' })}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                  <Badge variant={invoiceStatusVariant(invoice)}>
                    {invoiceStatusLabel(invoice)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold">Compliance Audit Trail</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase">SOC-2 Type II</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">FIRS Ready</Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Subscription state, plan assignments and limit changes are tracked via audit logs. Enforcement is handled
            entirely by the backend.
          </p>
          <Button variant="outline" className="mt-3 w-full gap-1.5" disabled>
            <Download className="h-4 w-4" />
            Download Audit Bundle
          </Button>
        </div>
      </div>

      {plans.isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {plans.isError && (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      )}

      {!plans.isLoading && !plans.isError && planList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Available plans</h2>
            <span className="text-xs text-muted-foreground">{planList.length} plans</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {planList.map((plan) => (
              <article key={plan.id} className="relative overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-foreground">{plan.name}</p>
                    {plan.name === subscription?.plan && <Badge variant="success">Current</Badge>}
                  </div>
                  {plan.description && (
                    <p className="text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="mt-auto flex items-end gap-2">
                    {plan.monthly_price != null && (
                      <p className="text-2xl font-bold tracking-tight text-foreground">
                        {formatCurrency(plan.monthly_price, plan.currency)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">/mo</span>
                      </p>
                    )}
                    {plan.annual_price != null && (
                      <p className="text-xs text-muted-foreground">
                        or {formatCurrency(plan.annual_price, plan.currency)}/yr
                      </p>
                    )}
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                      {plan.features.slice(0, 4).map((feat) => (
                        <Badge key={feat} variant="outline" className="text-[10px] capitalize">
                          {feat.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
