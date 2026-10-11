import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, LogOut, Play, RefreshCw, Settings2 } from 'lucide-react'
import { shiftApi, type Shift } from '@/lib/api/endpoints/shifts'
import { useAppStore } from '@/stores/app'
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
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const navigate = useNavigate()

  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [openingCash, setOpeningCash] = useState('0')
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

  const openShift = useMutation({
    mutationFn: (input: { branch_id?: number; opening_cash: number }) =>
      shiftApi.open(input),
    onSuccess: () => {
      toast.success('Shift opened')
      setOpenDialog(false)
      setOpeningCash('0')
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not open shift', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const closeShift = useMutation({
    mutationFn: (input: { actual_cash: number; notes?: string }) => shiftApi.close(input),
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
    mutationFn: (input: Partial<{ shifts_enabled: boolean; require_cash_reconciliation: boolean }>) =>
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
  const reconciliation = closeShift.data?.data?.reconciliation

  const openCloseDialog = (shift: Shift) => {
    setActualCash(String(shift.expected_cash))
    setCloseNotes('')
    setCloseDialog(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Shifts"
        description="Open, close and reconcile cash for shifts. Expected cash and variance are calculated by the backend."
      />

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
              description="Open a shift to start tracking cash for this branch."
              icon={<Play className="h-6 w-6" />}
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
                    {currentShift.branch_name} · opened by {currentShift.user_name}
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
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-[11px] text-muted-foreground">Opening cash</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {formatCurrency(currentShift.opening_cash)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-[11px] text-muted-foreground">Expected cash</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {formatCurrency(currentShift.expected_cash)}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-end justify-end gap-2 sm:col-span-2">
                    <Button variant="outline" onClick={() => navigate(`/shifts/${currentShift.id}`)}>
                      <ArrowUpRight className="h-4 w-4" />
                      View details
                    </Button>
                    <Button variant="success" onClick={() => openCloseDialog(currentShift)}>
                      <LogOut className="h-4 w-4" />
                      Close shift
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {reconciliation && (
            <Card>
              <CardHeader>
                <CardTitle>Shift reconciliation</CardTitle>
                <CardDescription>Variance reported by the backend on close.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="text-[11px] text-muted-foreground">Expected</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(reconciliation.expected_cash)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="text-[11px] text-muted-foreground">Actual</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(reconciliation.actual_cash)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="text-[11px] text-muted-foreground">Variance</p>
                    <p
                      className={
                        'text-sm font-semibold tabular-nums ' +
                        (reconciliation.variance !== 0 ? 'text-warning' : 'text-success')
                      }
                    >
                      {formatCurrency(reconciliation.variance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-3">
                    <p className="text-[11px] text-muted-foreground">Sales</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(reconciliation.sales_total)}
                    </p>
                  </div>
                </div>
                {reconciliation.payment_breakdown.length > 0 && (
                  <div className="space-y-1.5">
                    {reconciliation.payment_breakdown.map((p) => (
                      <div
                        key={p.method}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <span className="capitalize text-foreground">{p.method.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">
                          {p.count} txns · {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {history.data?.meta
                ? `${history.data.meta.total} shifts`
                : 'Shift history'}
            </p>
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

          {history.isLoading && <LoadingState variant="table" rows={8} />}
          {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}

          {!history.isLoading && !history.isError && (history.data?.data?.length ?? 0) === 0 && (
            <EmptyState title="No shifts found" description="Try a different status filter." />
          )}

          {!history.isLoading &&
            !history.isError &&
            (history.data?.data?.length ?? 0) > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
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
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {shift.closed_at ? formatDateTime(shift.closed_at) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(shift.opening_cash)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                          {formatCurrency(shift.expected_cash)}
                        </TableCell>
                        <TableCell className="w-8 pr-2 text-right text-muted-foreground">
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
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Shifts enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Staff must open a shift before taking sales.
                    </p>
                  </div>
                  <Switch
                    checked={config.data.data.shifts_enabled}
                    disabled={setConfig.isPending}
                    onCheckedChange={(next) => setConfig.mutate({ shifts_enabled: next })}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Require cash reconciliation</p>
                    <p className="text-xs text-muted-foreground">
                      Mandatory cash count when closing a shift.
                    </p>
                  </div>
                  <Switch
                    checked={config.data.data.require_cash_reconciliation}
                    disabled={setConfig.isPending}
                    onCheckedChange={(next) => setConfig.mutate({ require_cash_reconciliation: next })}
                  />
                </div>
                {config.isFetching && !config.isLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => config.refetch()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Open shift</DialogTitle>
            <DialogDescription>Set the opening cash float for the current branch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="opening-cash">Opening cash (₦)</Label>
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
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={openShift.isPending}
              onClick={() => openShift.mutate({ branch_id: branchId, opening_cash: Number(openingCash) || 0 })}
            >
              Open shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Close shift</DialogTitle>
            <DialogDescription>Record the actual cash count and close the active shift.</DialogDescription>
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
              onClick={() =>
                closeShift.mutate({
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
    </div>
  )
}