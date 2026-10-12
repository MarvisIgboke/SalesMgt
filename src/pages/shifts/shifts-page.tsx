import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  LogOut,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react'
import {
  shiftApi,
  saleSessionApi,
  type Shift,
} from '@/lib/api/endpoints/shifts'
import { staffApi } from '@/lib/api/endpoints/staff'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/lib/use-permissions'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function ShiftsPage() {
  const { can } = usePermissions()
  const canManage = can('shifts.operate')
  const canSell = can('sales.session')

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Shifts"
        description="The Store Manager opens the store shift and assigns reps; each Sales Rep opens their own sale on the shift."
      />
      {canManage ? (
        <ManagerView />
      ) : canSell ? (
        <RepView />
      ) : (
        <EmptyState
          title="No access"
          description="You do not have permission to view shifts."
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Store Manager view                                                          */
/* -------------------------------------------------------------------------- */

function ManagerView() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [openingCash, setOpeningCash] = useState('0')
  const [assigned, setAssigned] = useState<number[]>([])
  const [actualCash, setActualCash] = useState('0')
  const [closeNotes, setCloseNotes] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] = useState<string>('all')

  const current = useQuery({
    queryKey: ['shifts', 'current', branchId],
    queryFn: () => shiftApi.current(branchId),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  const config = useQuery({
    queryKey: ['shifts', 'config'],
    queryFn: () => shiftApi.config(),
    placeholderData: (prev) => prev,
  })

  const staff = useQuery({
    queryKey: ['staff', 'list', 'reps'],
    queryFn: () => staffApi.list({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })

  const history = useQuery({
    queryKey: ['shifts', 'history', { page: historyPage, status: historyStatus }],
    queryFn: () =>
      shiftApi.history({
        page: historyPage,
        per_page: 12,
        status: historyStatus === 'all' ? undefined : (historyStatus as Shift['status']),
      }),
    placeholderData: (prev) => prev,
  })

  const reps = useMemo(
    () =>
      (staff.data?.data ?? []).filter((member) =>
        member.roles?.includes('Sales Representative'),
      ),
    [staff.data],
  )

  const openShift = useMutation({
    mutationFn: (input: { branch_id?: number; opening_cash: number; assigned_user_ids: number[] }) =>
      shiftApi.open(input),
    onSuccess: () => {
      toast.success('Shift opened')
      setOpenDialog(false)
      setOpeningCash('0')
      setAssigned([])
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not open shift', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const closeShift = useMutation({
    mutationFn: (input: { actual_cash: number; notes?: string; shift_id: number }) =>
      shiftApi.close(input),
    onSuccess: () => {
      toast.success('Shift closed')
      setCloseDialog(false)
      setCloseNotes('')
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not close shift', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const setConfig = useMutation({
    mutationFn: (input: Partial<{ shifts_enabled: boolean; require_cash_reconciliation: boolean; require_sale_session: boolean }>) =>
      shiftApi.setConfig(input),
    onSuccess: () => {
      toast.success('Settings updated')
      void queryClient.invalidateQueries({ queryKey: ['shifts', 'config'] })
    },
    onError: (err) => {
      toast.error('Could not update settings', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const currentShift = current.data?.data ?? null

  const toggleRep = (id: number) =>
    setAssigned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="space-y-4">
        {current.isLoading && <LoadingState rows={2} />}
        {current.isError && <ErrorState error={current.error} onRetry={() => current.refetch()} />}

        {!current.isLoading && !current.isError && !currentShift && (
          <EmptyState
            title="No active shift"
            description="Open the store shift and assign the sales reps that can operate on it."
            icon={<Store className="h-6 w-6" />}
            action={
              <Button variant="success" size="sm" onClick={() => setOpenDialog(true)}>
                <Play className="h-4 w-4" />
                Open shift
              </Button>
            }
          />
        )}

        {currentShift && (
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Active shift
                  <StatusBadge status={currentShift.status} />
                </CardTitle>
                <CardDescription>
                  {currentShift.reference} · {currentShift.branch_name} · opened by{' '}
                  {currentShift.user_name}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Opened</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDateTime(currentShift.opened_at)}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Opening float" value={formatCurrency(currentShift.opening_cash)} />
                <Metric label="Expected cash" value={formatCurrency(currentShift.expected_cash)} />
                <Metric label="Sales" value={String(currentShift.sales_count ?? 0)} />
                <Metric
                  label="Assigned reps"
                  value={String(currentShift.assigned_user_ids?.length ?? 0)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => navigate(`/shifts/${currentShift.id}`)}>
                  <ArrowUpRight className="h-4 w-4" />
                  View details
                </Button>
                <Button
                  variant="success"
                  onClick={() => {
                    setActualCash(String(currentShift.expected_cash))
                    setCloseNotes('')
                    setCloseDialog(true)
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Close shift
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {history.data?.meta ? `${history.data.meta.total} shifts` : 'Shift history'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-primary"
              onClick={() => navigate('/shifts/history')}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Shift History &amp; Audits
            </Button>
            <div className="w-44">
              <Select
                value={historyStatus}
                onValueChange={(value) => {
                  setHistoryPage(1)
                  setHistoryStatus(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {history.isLoading && <LoadingState variant="table" rows={8} />}
        {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}

        {!history.isLoading && !history.isError && (history.data?.data?.length ?? 0) === 0 && (
          <EmptyState title="No shifts found" description="Try a different status filter." />
        )}

        {!history.isLoading && !history.isError && (history.data?.data?.length ?? 0) > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Opened by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data!.data.map((shift) => (
                  <TableRow
                    key={shift.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/shifts/${shift.id}`)}
                  >
                    <TableCell className="text-sm font-medium text-foreground">
                      {shift.reference ?? `#${shift.id}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shift.branch_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shift.user_name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={shift.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(shift.opened_at)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {shift.sales_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                      {formatCurrency(shift.expected_cash)}
                    </TableCell>
                    <TableCell className="pr-2 text-right text-muted-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              page={history.data?.meta?.current_page ?? historyPage}
              lastPage={history.data?.meta?.last_page ?? 1}
              total={history.data?.meta?.total}
              totalLabel="shifts"
              isFetching={history.isFetching}
              onPageChange={setHistoryPage}
            />
          </>
        )}
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        {config.isLoading && <LoadingState rows={2} />}
        {config.isError && <ErrorState error={config.error} onRetry={() => config.refetch()} />}

        {config.data?.data && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Shift configuration
              </CardTitle>
              <CardDescription>
                Saved per business. The backend enforces these rules on open/close.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConfigRow
                label="Shifts enabled"
                hint="Reps must operate inside a store shift before taking sales."
                checked={config.data.data.shifts_enabled}
                disabled={setConfig.isPending}
                onChange={(next) => setConfig.mutate({ shifts_enabled: next })}
              />
              <ConfigRow
                label="Require cash reconciliation"
                hint="Mandatory cash count when closing a shift or sale."
                checked={config.data.data.require_cash_reconciliation}
                disabled={setConfig.isPending}
                onChange={(next) => setConfig.mutate({ require_cash_reconciliation: next })}
              />
              <ConfigRow
                label="Require an open sale to charge"
                hint="Sales reps must open a sale before taking a payment."
                checked={config.data.data.require_sale_session}
                disabled={setConfig.isPending}
                onChange={(next) => setConfig.mutate({ require_sale_session: next })}
              />
              {config.isFetching && !config.isLoading && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => config.refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Open shift dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Open store shift</DialogTitle>
            <DialogDescription>
              Set the opening float and assign the sales reps that may operate on this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="opening-cash">Opening float (₦)</Label>
              <Input
                id="opening-cash"
                type="number"
                min={0}
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Assign sales reps</Label>
              {staff.isLoading && <LoadingState rows={2} />}
              {!staff.isLoading && reps.length === 0 && (
                <p className="text-xs text-muted-foreground">No sales representatives found.</p>
              )}
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                {reps.map((rep) => (
                  <label
                    key={rep.user_id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-sunken"
                  >
                    <input
                      type="checkbox"
                      checked={assigned.includes(rep.user_id)}
                      onChange={() => toggleRep(rep.user_id)}
                      className="h-4 w-4 shrink-0 rounded accent-primary"
                    />
                    <span className="text-sm text-foreground">{rep.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{rep.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={openShift.isPending}
              onClick={() =>
                openShift.mutate({
                  branch_id: branchId,
                  opening_cash: Number(openingCash) || 0,
                  assigned_user_ids: assigned,
                })
              }
            >
              Open shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close shift dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Close shift</DialogTitle>
            <DialogDescription>
              Record the actual cash count. All sales on the shift must be closed first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="actual-cash">Actual cash (₦)</Label>
              <Input
                id="actual-cash"
                type="number"
                min={0}
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Input
                id="close-notes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Reason for variance, if any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCloseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={closeShift.isPending}
              disabled={!currentShift}
              onClick={() =>
                currentShift &&
                closeShift.mutate({
                  shift_id: currentShift.id,
                  actual_cash: Number(actualCash) || 0,
                  notes: closeNotes.trim() || undefined,
                })
              }
            >
              Close shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}

/* -------------------------------------------------------------------------- */
/* Sales Representative view                                                   */
/* -------------------------------------------------------------------------- */

function RepView() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const userId = useAuthStore((s) => s.session?.user.id)
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('0')
  const [closingAmount, setClosingAmount] = useState('0')
  const [closeNotes, setCloseNotes] = useState('')

  const shiftQuery = useQuery({
    queryKey: ['shifts', 'current', branchId],
    queryFn: () => shiftApi.current(branchId),
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
  })

  const sessionQuery = useQuery({
    queryKey: ['sale-sessions', 'current', userId, branchId],
    queryFn: () => saleSessionApi.current({ branch_id: branchId }),
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
  })

  const openSale = useMutation({
    mutationFn: (input: { shift_id?: number; opening_balance: number }) =>
      saleSessionApi.open(input),
    onSuccess: () => {
      toast.success('Sale opened')
      setOpenDialog(false)
      setOpeningBalance('0')
      void queryClient.invalidateQueries({ queryKey: ['sale-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not open sale', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const closeSale = useMutation({
    mutationFn: (input: { id: number; closing_amount: number; notes?: string }) =>
      saleSessionApi.close(input.id, { closing_amount: input.closing_amount, notes: input.notes }),
    onSuccess: () => {
      toast.success('Sale closed')
      setCloseDialog(false)
      void queryClient.invalidateQueries({ queryKey: ['sale-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not close sale', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const shift = shiftQuery.data?.data ?? null
  const session = sessionQuery.data?.data ?? null
  const isAssigned = shift ? shift.assigned_user_ids?.includes(userId ?? -1) : false

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              Store shift
              {shift && <StatusBadge status={shift.status} />}
            </CardTitle>
            <CardDescription>
              {shift
                ? `${shift.reference} · ${shift.branch_name} · opened by ${shift.user_name}`
                : 'No store shift is currently open.'}
            </CardDescription>
          </div>
          {shift && (
            <p className="text-sm text-muted-foreground">{formatDateTime(shift.opened_at)}</p>
          )}
        </CardHeader>
      </Card>

      {!shift && (
        <EmptyState
          title="No shift open"
          description="A shift must be opened by your store manager before you can start selling."
          icon={<Store className="h-6 w-6" />}
        />
      )}

      {shift && !isAssigned && (
        <EmptyState
          title="Not assigned to this shift"
          description="You have not been assigned to the current shift. Ask your manager to add you."
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      )}

      {shift && isAssigned && !session && (
        <EmptyState
          title="No open sale"
          description="Open your sale to start taking payments for this shift."
          icon={<UserRound className="h-6 w-6" />}
          action={
            <Button variant="success" size="sm" onClick={() => setOpenDialog(true)}>
              <Play className="h-4 w-4" />
              Open my sale
            </Button>
          }
        />
      )}

      {session && (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                My sale
                <StatusBadge status={session.status} />
              </CardTitle>
              <CardDescription>
                {session.reference} · {session.branch_name} · opened{' '}
                {formatDateTime(session.opened_at)}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Sales</p>
              <p className="text-sm font-medium tabular-nums text-foreground">
                {session.sales_count} · {formatCurrency(session.sales_total)}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Opening balance" value={formatCurrency(session.opening_balance)} />
              <Metric label="Expected cash" value={formatCurrency(session.expected_cash)} />
              <Metric
                label="Opening stock"
                value={formatCurrency(session.opening_stock_value)}
              />
              <Metric
                label="Stock value now"
                value={formatCurrency(session.closing_stock_value ?? session.opening_stock_value)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/sale-sessions/${session.id}`)}>
                <ArrowUpRight className="h-4 w-4" />
                View my sale
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  setClosingAmount(String(session.expected_cash))
                  setCloseNotes('')
                  setCloseDialog(true)
                }}
              >
                <LogOut className="h-4 w-4" />
                Close my sale
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open my sale</DialogTitle>
            <DialogDescription>
              Set your opening cash float. Stock at open is captured automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="opening-balance">Opening balance (₦)</Label>
            <Input
              id="opening-balance"
              type="number"
              min={0}
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={openSale.isPending}
              onClick={() =>
                openSale.mutate({
                  shift_id: shift?.id,
                  opening_balance: Number(openingBalance) || 0,
                })
              }
            >
              Open sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close my sale</DialogTitle>
            <DialogDescription>
              Count your cash. Stock and cash variance are reconciled automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="closing-amount">Counted cash (₦)</Label>
              <Input
                id="closing-amount"
                type="number"
                min={0}
                step="0.01"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sale-close-notes">Notes (optional)</Label>
              <Input
                id="sale-close-notes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Reason for variance, if any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCloseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={closeSale.isPending}
              disabled={!session}
              onClick={() =>
                session &&
                closeSale.mutate({
                  id: session.id,
                  closing_amount: Number(closingAmount) || 0,
                  notes: closeNotes.trim() || undefined,
                })
              }
            >
              Close sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                 */
/* -------------------------------------------------------------------------- */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function ConfigRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}
