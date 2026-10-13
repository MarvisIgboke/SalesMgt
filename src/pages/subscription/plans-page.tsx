import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Gem, Pencil, Plus, Trash2, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  businessApi,
  subscriptionApi,
  type PlanInput,
  type SubscriptionPlan,
} from '@/lib/api/endpoints/business'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function PlansPage() {
  const isSuperAdmin = useAuthStore((s) => s.session?.user.roles.includes('Super Admin') ?? false)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [assignPlan, setAssignPlan] = useState<SubscriptionPlan | null>(null)

  const plans = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => subscriptionApi.plans(),
    enabled: isSuperAdmin,
    placeholderData: (prev) => prev,
  })

  const planList = plans.data?.data ?? []

  if (!isSuperAdmin) {
    return (
      <div className="animate-fade-in max-w-3xl">
        <PageHeader title="Subscription plans" description="Platform plan management." />
        <EmptyState
          title="Super Admin only"
          description="Subscription plans are managed by the platform Super Admin."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
      </div>
    )
  }

  const openCreate = () => {
    setEditing(null)
    setPlanOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Subscription plans"
        description="Create and manage platform plans, then assign them to businesses."
      >
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </PageHeader>

      {plans.isLoading && <LoadingState rows={3} />}
      {plans.isError && <ErrorState error={plans.error} onRetry={() => plans.refetch()} />}

      {!plans.isLoading && !plans.isError && planList.length === 0 && (
        <EmptyState
          title="No plans yet"
          description="Create your first subscription plan to offer to businesses."
          icon={<Gem className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              New plan
            </Button>
          }
        />
      )}

      {planList.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {planList.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => {
                setEditing(plan)
                setPlanOpen(true)
              }}
              onAssign={() => setAssignPlan(plan)}
            />
          ))}
        </div>
      )}

      {planOpen && <PlanDialog plan={editing} onClose={() => setPlanOpen(false)} />}
      {assignPlan && (
        <AssignPlanDialog plan={assignPlan} onClose={() => setAssignPlan(null)} />
      )}
    </div>
  )
}

function PlanCard({
  plan,
  onEdit,
  onAssign,
}: {
  plan: SubscriptionPlan
  onEdit: () => void
  onAssign: () => void
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation({
    mutationFn: () => subscriptionApi.deletePlan(plan.id),
    onSuccess: () => {
      toast.success('Plan deleted')
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['subscription', 'plans'] })
    },
    onError: (err) => {
      toast.error('Could not delete plan', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const limits = plan.limits ?? {
    staff_limit: plan.staff_limit,
    branch_limit: plan.branch_limit,
    duration_months: plan.duration_months,
    grace_days: plan.grace_days,
  }

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-foreground">{plan.name}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {plan.slug}
            </p>
          </div>
          <Badge variant={plan.is_active === false ? 'muted' : 'success'}>
            {plan.is_active === false ? 'Inactive' : 'Active'}
          </Badge>
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

        <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
          {Object.entries(limits).map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-[10px] capitalize">
              {key.replace(/_/g, ' ')}: {value ?? 'unlimited'}
            </Badge>
          ))}
        </div>

        {confirming ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
            <span className="text-xs text-destructive">Delete this plan?</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={onAssign}>
              <Building2 className="h-3.5 w-3.5" />
              Assign to business
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <span className="sr-only">Delete plan</span>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PlanDialog({ plan, onClose }: { plan: SubscriptionPlan | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    slug: plan?.slug ?? '',
    description: plan?.description ?? '',
    staff_limit: plan?.staff_limit ?? '',
    branch_limit: plan?.branch_limit ?? '',
    duration_months: plan?.duration_months ?? 1,
    monthly_price: plan?.monthly_price ?? '',
    quarterly_price: plan?.quarterly_price ?? '',
    annual_price: plan?.annual_price ?? '',
    currency: plan?.currency ?? 'NGN',
    grace_days: plan?.grace_days ?? 0,
    features: (plan?.features ?? []).join(', '),
    is_active: plan?.is_active ?? true,
  })

  const set = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = useMutation({
    mutationFn: (input: PlanInput) =>
      plan ? subscriptionApi.updatePlan(plan.id, input) : subscriptionApi.createPlan(input),
    onSuccess: () => {
      toast.success(plan ? 'Plan updated' : 'Plan created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['subscription', 'plans'] })
    },
    onError: (err) => {
      toast.error('Could not save plan', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const num = (value: string | number): number | null => {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const submit = () => {
    const features = form.features
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    save.mutate({
      name: form.name.trim(),
      slug: (form.slug.trim() || form.name.trim()).toLowerCase().replace(/\s+/g, '-'),
      description: form.description.trim() || null,
      staff_limit: num(form.staff_limit),
      branch_limit: num(form.branch_limit),
      duration_months: num(form.duration_months) ?? 1,
      monthly_price: num(form.monthly_price),
      quarterly_price: num(form.quarterly_price),
      annual_price: num(form.annual_price),
      currency: form.currency.trim() || 'NGN',
      grace_days: num(form.grace_days) ?? 0,
      features,
      is_active: form.is_active,
    })
  }

  const canSave = form.name.trim().length > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
          <DialogDescription>
            Limits apply to the business as a whole and are shared across all of its branches.
            Leave a limit blank for unlimited.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Growth"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plan-slug">Slug</Label>
            <Input
              id="plan-slug"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="auto from name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plan-currency">Currency</Label>
            <Input
              id="plan-currency"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              placeholder="NGN"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="plan-description">Description</Label>
            <Input
              id="plan-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short summary of the plan"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="staff_limit">Staff limit</Label>
            <Input
              id="staff_limit"
              type="number"
              min={0}
              value={form.staff_limit}
              onChange={(e) => set('staff_limit', e.target.value)}
              placeholder="unlimited"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch_limit">Branch limit</Label>
            <Input
              id="branch_limit"
              type="number"
              min={0}
              value={form.branch_limit}
              onChange={(e) => set('branch_limit', e.target.value)}
              placeholder="unlimited"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="duration_months">Validity (months)</Label>
            <Input
              id="duration_months"
              type="number"
              min={1}
              value={form.duration_months}
              onChange={(e) => set('duration_months', e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monthly_price">Monthly price</Label>
            <Input
              id="monthly_price"
              type="number"
              min={0}
              step="0.01"
              value={form.monthly_price}
              onChange={(e) => set('monthly_price', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quarterly_price">Quarterly price</Label>
            <Input
              id="quarterly_price"
              type="number"
              min={0}
              step="0.01"
              value={form.quarterly_price}
              onChange={(e) => set('quarterly_price', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="annual_price">Annual price</Label>
            <Input
              id="annual_price"
              type="number"
              min={0}
              step="0.01"
              value={form.annual_price}
              onChange={(e) => set('annual_price', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grace_days">Grace days</Label>
            <Input
              id="grace_days"
              type="number"
              min={0}
              value={form.grace_days}
              onChange={(e) => set('grace_days', e.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="plan-features">Features</Label>
            <Input
              id="plan-features"
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              placeholder="Comma separated, e.g. Multi-branch, Priority support"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 sm:col-span-2">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive plans cannot be assigned.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set('is_active', v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!canSave} onClick={submit}>
            {plan ? 'Save changes' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignPlanDialog({
  plan,
  onClose,
}: {
  plan: SubscriptionPlan
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [businessId, setBusinessId] = useState('')
  const [status, setStatus] = useState<'active' | 'trial' | 'expired' | 'suspended'>('active')
  const [expiresAt, setExpiresAt] = useState('')

  const businesses = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessApi.listBusinesses(),
    placeholderData: (prev) => prev,
  })

  const options = useMemo(() => businesses.data?.data ?? [], [businesses.data])

  const assign = useMutation({
    mutationFn: () =>
      businessApi.assignPlan(Number(businessId), {
        plan_id: plan.id,
        status,
        expires_at: expiresAt || undefined,
      }),
    onSuccess: () => {
      toast.success(`Plan "${plan.name}" assigned`)
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
    onError: (err) => {
      toast.error('Could not assign plan', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign “{plan.name}”</DialogTitle>
          <DialogDescription>
            Apply this plan to a business. Its resources are shared across every branch in the
            business. This replaces the current subscription plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Business</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a business" />
              </SelectTrigger>
              <SelectContent>
                {options.map((business) => (
                  <SelectItem key={business.id} value={String(business.id)}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as typeof status)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assign-expires">Expires on</Label>
            <Input
              id="assign-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            {expiresAt && (
              <p className="text-xs text-muted-foreground">Ends {formatDate(expiresAt)}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={assign.isPending}
            disabled={!businessId}
            onClick={() => assign.mutate()}
          >
            Assign plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
