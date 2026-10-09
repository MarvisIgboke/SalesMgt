import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CreditCard, Gem, Timer } from 'lucide-react'
import { subscriptionApi } from '@/lib/api/endpoints/business'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { StatusBadge } from '@/components/common/status-badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PlanInfo {
  id: number
  name: string
  description?: string
  monthly_price?: number | null
  annual_price?: number | null
  currency?: string
  limits?: Record<string, number | null>
}

export function SubscriptionPage() {
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

  const subscription = current.data?.data
  const planList = (plans.data?.data as unknown as PlanInfo[] | undefined) ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Subscription"
        description="Plan status, limits and billing. Enforcement is done entirely by the backend."
      />

      {current.isLoading && <LoadingState rows={2} />}
      {current.isError && <ErrorState error={current.error} onRetry={() => current.refetch()} />}

      {subscription && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Gem className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {subscription.plan}
                    <StatusBadge status={subscription.status} label={subscription.status} />
                  </CardTitle>
                  <CardDescription>Current subscription details from the backend.</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="px-3 py-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Billing handled externally
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SubscriptionFigure
              icon={<Timer className="h-4 w-4" />}
              label="Expiry"
              value={
                subscription.expiry_date
                  ? formatDate(subscription.expiry_date, { dateStyle: 'full' })
                  : subscription.trial_ends_at
                    ? `Trial until ${formatDate(subscription.trial_ends_at, { dateStyle: 'full' })}`
                    : 'No expiry recorded'
              }
            />
            {subscription.limits && Object.keys(subscription.limits).length > 0 && (
              <div className="rounded-xl border border-border/70 p-4 sm:col-span-2 lg:col-span-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5" /> Usage limits
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(subscription.limits).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="capitalize">
                      {key.replace(/_/g, ' ')}: {value ?? 'unlimited'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Available plans
        </h2>
        <span className="text-xs text-muted-foreground">
          {planList.length} plans
        </span>
      </div>

      {plans.isLoading && <LoadingState rows={3} />}
      {plans.isError && <ErrorState error={plans.error} onRetry={() => plans.refetch()} />}

      {!plans.isLoading && !plans.isError && planList.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          No plans available from the backend.
        </p>
      )}

      {planList.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {planList.map((plan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-foreground">{plan.name}</p>
                  {plan.name === subscription?.plan && (
                    <Badge variant="success">Current</Badge>
                  )}
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
                {plan.limits && Object.keys(plan.limits).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                    {Object.entries(plan.limits).slice(0, 4).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-[10px] capitalize">
                        {key.replace(/_/g, ' ')}: {value ?? 'unlimited'}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SubscriptionFigure({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}