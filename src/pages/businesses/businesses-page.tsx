import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, CheckCircle2, Clock4, Gem, Plus, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { StatCard } from '@/components/common/stat-card'
import { Pagination } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  type Business,
} from '@/lib/api/endpoints/business'
import { useAuthStore } from '@/stores/auth'
import { formatDate, formatNumber } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const PER_PAGE = 10

export function BusinessesPage() {
  const queryClient = useQueryClient()
  const isSuperAdmin = useAuthStore((s) => s.session?.user.roles.includes('Super Admin') ?? false)
  const [createOpen, setCreateOpen] = useState(false)
  const [assigning, setAssigning] = useState<Business | null>(null)
  const [page, setPage] = useState(1)

  const businesses = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessApi.listBusinesses(),
    enabled: isSuperAdmin,
    placeholderData: (prev) => prev,
  })

  if (!isSuperAdmin) {
    return (
      <div className="animate-fade-in max-w-3xl">
        <PageHeader title="Businesses" description="Platform tenant management." />
        <EmptyState
          title="Super Admin only"
          description="Creating and managing businesses is restricted to the platform Super Admin."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
      </div>
    )
  }

  const rows = businesses.data?.data ?? []

  const stats = {
    total: rows.length,
    active: rows.filter((b) => b.subscription.status === 'active').length,
    trial: rows.filter((b) => b.subscription.status === 'trial').length,
    suspended: rows.filter((b) =>
      ['suspended', 'expired'].includes(b.subscription.status),
    ).length,
  }

  const lastPage = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const safePage = Math.min(page, lastPage)
  const pageRows = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const reload = () => void queryClient.invalidateQueries({ queryKey: ['businesses'] })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Businesses"
        description="Register new businesses and manage their subscription plan."
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New business
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Businesses"
          value={formatNumber(stats.total)}
          icon={<Building2 className="h-4 w-4" />}
          loading={businesses.isLoading}
        />
        <StatCard
          label="Active"
          value={formatNumber(stats.active)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={businesses.isLoading}
        />
        <StatCard
          label="On Trial"
          value={formatNumber(stats.trial)}
          icon={<Clock4 className="h-4 w-4" />}
          loading={businesses.isLoading}
        />
        <StatCard
          label="Suspended / Expired"
          value={formatNumber(stats.suspended)}
          icon={<Ban className="h-4 w-4" />}
          loading={businesses.isLoading}
        />
      </div>

      {businesses.isLoading && <LoadingState variant="table" rows={6} />}
      {businesses.isError && (
        <ErrorState error={businesses.error} onRetry={() => businesses.refetch()} />
      )}

      {!businesses.isLoading && !businesses.isError && rows.length === 0 && (
        <EmptyState
          title="No businesses yet"
          description="Register your first business to get started."
          icon={<Building2 className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              New business
            </Button>
          }
        />
      )}

      {pageRows.length > 0 && (
        <div className="space-y-3">
          {pageRows.map((business) => (
            <div
              key={business.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                    <span>{business.slug}</span>
                    {business.email && <span>{business.email}</span>}
                    {business.phone && <span>{business.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="flex flex-col gap-1 sm:items-end">
                  <span className="text-sm font-medium text-foreground">
                    {business.subscription.plan}
                  </span>
                  <StatusBadge
                    status={business.subscription.status}
                    label={business.subscription.status}
                  />
                </div>
                <span className="hidden items-center gap-1 rounded-lg bg-surface-sunken px-2 py-1 font-mono text-[11px] text-muted-foreground lg:inline-flex">
                  {business.currency}
                  {business.subscription.expiry_date && (
                    <span>· {formatDate(business.subscription.expiry_date)}</span>
                  )}
                </span>
                <Button variant="outline" size="sm" onClick={() => setAssigning(business)}>
                  <Gem className="h-3.5 w-3.5" />
                  Assign plan
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > PER_PAGE && (
        <Pagination
          page={safePage}
          lastPage={lastPage}
          total={rows.length}
          totalLabel="businesses"
          onPageChange={setPage}
        />
      )}

      {createOpen && <CreateBusinessDialog onClose={() => setCreateOpen(false)} onSaved={reload} />}
      {assigning && (
        <AssignPlanDialog business={assigning} onClose={() => setAssigning(null)} onSaved={reload} />
      )}
    </div>
  )
}

function CreateBusinessDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    address: '',
    email: '',
    phone: '',
    plan_id: '',
  })

  const plans = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => subscriptionApi.plans(),
    placeholderData: (prev) => prev,
  })

  const create = useMutation({
    mutationFn: () =>
      businessApi.createBusiness({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        currency: form.currency.trim() || 'NGN',
        timezone: form.timezone.trim() || 'Africa/Lagos',
        address: form.address.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
      }),
    onSuccess: () => {
      toast.success('Business created')
      onSaved()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not create business', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a business</DialogTitle>
          <DialogDescription>
            Creates a new tenant with its own wallet and a 30-day trial if a plan is selected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="biz-name">Business name</Label>
            <Input
              id="biz-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Acme Stores"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-slug">Slug</Label>
            <Input
              id="biz-slug"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="auto from name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-plan">Initial plan</Label>
            <Select
              value={form.plan_id}
              onValueChange={(v) => setForm((p) => ({ ...p, plan_id: v }))}
            >
              <SelectTrigger id="biz-plan">
                <SelectValue placeholder="Starter (default)" />
              </SelectTrigger>
              <SelectContent>
                {(plans.data?.data ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-currency">Currency</Label>
            <Input
              id="biz-currency"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-timezone">Timezone</Label>
            <Input
              id="biz-timezone"
              value={form.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="biz-email">Email</Label>
            <Input
              id="biz-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="owner@business.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-phone">Phone</Label>
            <Input
              id="biz-phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz-address">Address</Label>
            <Input
              id="biz-address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street, city"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!form.name.trim()}
            onClick={() => create.mutate()}
          >
            Create business
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignPlanDialog({
  business,
  onClose,
  onSaved,
}: {
  business: Business
  onClose: () => void
  onSaved: () => void
}) {
  const [planId, setPlanId] = useState('')
  const [status, setStatus] = useState<'active' | 'trial' | 'expired' | 'suspended'>('active')
  const [expiresAt, setExpiresAt] = useState('')

  const plans = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => subscriptionApi.plans(),
    placeholderData: (prev) => prev,
  })

  const assign = useMutation({
    mutationFn: () =>
      businessApi.assignPlan(business.id, {
        plan_id: Number(planId),
        status,
        expires_at: expiresAt || undefined,
      }),
    onSuccess: () => {
      toast.success('Plan assigned')
      onSaved()
      onClose()
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
          <DialogTitle>Assign plan · {business.name}</DialogTitle>
          <DialogDescription>
            Current plan: <span className="text-foreground">{business.subscription.plan}</span> (
            {business.subscription.status})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {(plans.data?.data ?? []).map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
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
            <Label htmlFor="biz-expires">Expires on</Label>
            <Input
              id="biz-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={assign.isPending}
            disabled={!planId}
            onClick={() => assign.mutate()}
          >
            Assign plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
