import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Layers, Lock, Save, ShieldCheck, Store, Users } from 'lucide-react'
import { billingApi, type AllocationBranch, type AllocationUser } from '@/lib/api/endpoints/billing'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { usePermissions } from '@/lib/use-permissions'
import { cn, formatDate, formatNumber } from '@/lib/utils'

export function ResourceAllocationPage() {
  const { can } = usePermissions()
  const canManage = can('subscription.manage')

  const queryClient = useQueryClient()
  const [branchSel, setBranchSel] = useState<number[] | null>(null)
  const [userSel, setUserSel] = useState<number[] | null>(null)

  const query = useQuery({
    queryKey: ['subscription', 'allocation'],
    queryFn: () => billingApi.allocation(),
    enabled: canManage,
    placeholderData: (prev) => prev,
  })

  const data = query.data?.data
  const branches = useMemo(() => data?.branches ?? [], [data])
  const users = useMemo(() => data?.users ?? [], [data])

  const selectedBranches = useMemo(
    () => new Set(branchSel ?? branches.filter((branch) => branch.allocated).map((branch) => branch.id)),
    [branchSel, branches],
  )
  const selectedUsers = useMemo(
    () => new Set(userSel ?? users.filter((user) => user.allocated).map((user) => user.id)),
    [userSel, users],
  )

  const toggleBranch = (id: number) =>
    setBranchSel((prev) => {
      const base = prev ?? branches.filter((b) => b.allocated).map((b) => b.id)
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })

  const toggleUser = (id: number) =>
    setUserSel((prev) => {
      const base = prev ?? users.filter((u) => u.allocated).map((u) => u.id)
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })

  const save = useMutation({
    mutationFn: () =>
      billingApi.updateAllocation({
        branch_ids: Array.from(selectedBranches),
        user_ids: Array.from(selectedUsers),
      }),
    onSuccess: () => {
      toast.success('Resource allocation updated')
      setBranchSel(null)
      setUserSel(null)
      void queryClient.invalidateQueries({ queryKey: ['subscription', 'allocation'] })
      void queryClient.invalidateQueries({ queryKey: ['subscription'] })
      void queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: (err) => {
      toast.error('Could not update allocation', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  if (!canManage) {
    return (
      <div className="animate-fade-in space-y-4 pb-8">
        <PageHeader
          eyebrow="Billing · Allocation"
          title="Resource Allocation"
          description="Choose which branches and staff accounts are active on your plan."
        />
        <EmptyState
          title="Not available"
          description="You need the subscription management permission to allocate resources."
          icon={<Lock className="h-6 w-6" />}
        />
      </div>
    )
  }

  const branchLimit = data?.limits.branch_limit ?? null
  const staffLimit = data?.limits.staff_limit ?? null
  const dirty = branchSel !== null || userSel !== null

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      <PageHeader
        eyebrow="Billing · Allocation"
        title="Resource Allocation"
        description="Choose which branches and staff accounts are active on your plan. Anything deselected is disabled."
      >
        <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
          <Save className="h-4 w-4" />
          Save changes
        </Button>
      </PageHeader>

      {query.isLoading && <LoadingState rows={3} />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryCard
              icon={<Store className="h-4 w-4" />}
              label="Branches allocated"
              used={data.usage.branches_allocated}
              total={branchLimit}
              caption={`${formatNumber(data.usage.branches)} branch(es) on file`}
            />
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Staff accounts allocated"
              used={data.usage.staff_allocated}
              total={staffLimit}
              caption={`${formatNumber(data.usage.staff)} staff on file`}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{data.plan.name} plan</p>
                  <p className="text-xs text-muted-foreground">
                    {data.plan.expires_at
                      ? `Valid until ${formatDate(data.plan.expires_at, { dateStyle: 'medium' })}`
                      : 'No expiry recorded'}
                    {data.plan.duration_months ? ` · ${data.plan.duration_months} month billing cycle` : ''}
                  </p>
                </div>
              </div>
              <Badge variant={data.plan.status === 'active' ? 'success' : 'warning'} className="capitalize">
                {data.plan.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Branches</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedBranches.size}
                  {branchLimit != null ? ` / ${branchLimit}` : ''} selected
                </span>
              </div>
              {branches.length === 0 ? (
                <EmptyState title="No branches" description="Add a branch to allocate it." icon={<Store className="h-5 w-5" />} />
              ) : (
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <BranchRow
                      key={branch.id}
                      branch={branch}
                      selected={selectedBranches.has(branch.id)}
                      onToggle={() => toggleBranch(branch.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Staff accounts</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedUsers.size}
                  {staffLimit != null ? ` / ${staffLimit}` : ''} selected
                </span>
              </div>
              {users.length === 0 ? (
                <EmptyState title="No staff" description="Add staff to allocate seats." />
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      selected={selectedUsers.has(user.id)}
                      onToggle={() => toggleUser(user.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.plan.status !== 'active' && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your subscription is not active. Settle outstanding invoices to keep allocated resources online.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  used,
  total,
  caption,
}: {
  icon: React.ReactNode
  label: string
  used: number
  total: number | null
  caption: string
}) {
  const pct = total && total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{formatNumber(used)}</span>
        <span className="text-xs text-muted-foreground">
          {total != null ? `of ${formatNumber(total)}` : 'unlimited'}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

function BranchRow({
  branch,
  selected,
  onToggle,
}: {
  branch: AllocationBranch
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors',
        selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-surface/60',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Store className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{branch.name}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">
            {branch.code ? `${branch.code} · ` : ''}
            {branch.type ?? 'branch'}
          </p>
        </div>
      </div>
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full border',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}

function UserRow({
  user,
  selected,
  onToggle,
}: {
  user: AllocationUser
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={user.locked ? undefined : onToggle}
      disabled={user.locked}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors',
        selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-surface/60',
        user.locked && 'cursor-not-allowed opacity-80',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary/15 text-xs font-semibold uppercase text-secondary">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {user.roles.length > 0 && (
          <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
            {user.roles[0]}
          </Badge>
        )}
        {user.locked ? (
          <Badge variant="muted" className="gap-1 text-[10px]">
            <Lock className="h-3 w-3" />
            Admin
          </Badge>
        ) : (
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full border',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
            )}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
    </button>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
