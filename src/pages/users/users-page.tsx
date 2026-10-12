import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeDollarSign,
  KeyRound,
  MoreHorizontal,
  Power,
  PowerOff,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { usersApi, type PlatformUser, type UserStats } from '@/lib/api/endpoints/users'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { SearchInput } from '@/components/common/search-input'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { LoadingState } from '@/components/common/loading-state'
import { Pagination } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { formatDateTime, formatNumber, initials } from '@/lib/utils'

const PER_PAGE = 20

const emptyStats: UserStats = { total: 0, business_admin: 0, store_manager: 0, sales_rep: 0 }

function roleVariant(role: string) {
  if (role === 'Super Admin') return 'default' as const
  if (role === 'Business Admin') return 'success' as const
  if (role === 'Store Manager') return 'warning' as const
  return 'secondary' as const
}

export function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [confirmReset, setConfirmReset] = useState<PlatformUser | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<PlatformUser | null>(null)

  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['users', { page, search }],
    queryFn: () => usersApi.list({ page, per_page: PER_PAGE, search: search || undefined }),
    placeholderData: (prev) => prev,
  })

  const meta = listQuery.data?.meta
  const members = listQuery.data?.data ?? []
  const stats = meta?.stats ?? emptyStats

  const resetPassword = useMutation({
    mutationFn: (id: number) => usersApi.resetPassword(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Password reset to default')
      setConfirmReset(null)
    },
    onError: (e) => toast.error((e as Error).message || 'Failed to reset password'),
  })

  const toggleActive = useMutation({
    mutationFn: (id: number) => usersApi.toggleActive(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(res.message || 'User updated')
      setConfirmToggle(null)
    },
    onError: (e) => toast.error((e as Error).message || 'Failed to update user'),
  })

  const statCards = [
    { label: 'Total Users', value: stats.total, icon: <Users className="h-4 w-4" /> },
    { label: 'Business Admins', value: stats.business_admin, icon: <ShieldCheck className="h-4 w-4" /> },
    { label: 'Store Managers', value: stats.store_manager, icon: <Store className="h-4 w-4" /> },
    { label: 'Sales Reps', value: stats.sales_rep, icon: <BadgeDollarSign className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Directory of every login credential across all businesses."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={formatNumber(card.value)}
            icon={card.icon}
            loading={listQuery.isLoading}
          />
        ))}
      </div>

      <SearchInput
        placeholder="Search users by name, email or phone..."
        className="w-full sm:w-96"
        onSearch={(value) => {
          setPage(1)
          setSearch(value)
        }}
      />

      {listQuery.isLoading && <LoadingState variant="table" rows={6} />}

      {listQuery.isError && (
        <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
      )}

      {!listQuery.isLoading && !listQuery.isError && members.length === 0 && (
        <div className="rounded-2xl border border-border">
          <EmptyState
            title="No users found"
            description="No login credentials match your search."
            icon={<Users className="h-6 w-6" />}
          />
        </div>
      )}

      {members.length > 0 && (
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                  {initials(m.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    {m.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                    <span>{m.email}</span>
                    {m.phone && <span>{m.phone}</span>}
                    {m.business_name && <span>{m.business_name}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="flex flex-wrap gap-1">
                  {m.roles.length === 0 && <Badge variant="outline">No role</Badge>}
                  {m.roles.map((r) => (
                    <Badge key={r} variant={roleVariant(r)} className="text-[10px] uppercase">
                      {r}
                    </Badge>
                  ))}
                </div>
                <span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
                  Joined {m.created_at ? formatDateTime(m.created_at) : '—'}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <span className="sr-only">Actions</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmReset(m)}>
                      <KeyRound className="h-4 w-4" />
                      Reset password to default
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmToggle(m)}>
                      {m.is_active ? (
                        <>
                          <PowerOff className="h-4 w-4" />
                          Disable user
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4" />
                          Enable user
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && members.length > 0 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          total={meta.total}
          totalLabel="users"
          isFetching={listQuery.isFetching}
          onPageChange={setPage}
        />
      )}

      <Dialog open={!!confirmReset} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Reset the password for <strong>{confirmReset?.name}</strong> to <code>password</code>? They
              will be signed out of all sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={resetPassword.isPending}
              onClick={() => confirmReset && resetPassword.mutate(confirmReset.id)}
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmToggle?.is_active ? 'Disable user' : 'Enable user'}</DialogTitle>
            <DialogDescription>
              {confirmToggle?.is_active
                ? `Disable ${confirmToggle.name}? They will not be able to sign in.`
                : `Enable ${confirmToggle?.name}? They will be able to sign in again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmToggle?.is_active ? 'destructive' : 'success'}
              loading={toggleActive.isPending}
              onClick={() => confirmToggle && toggleActive.mutate(confirmToggle.id)}
            >
              {confirmToggle?.is_active ? 'Disable' : 'Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
