import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  Boxes,
  Calculator,
  ChevronLeft,
  CircleDollarSign,
  LogOut,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { saleSessionApi, type SaleSessionDetail } from '@/lib/api/endpoints/shifts'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { usePermissions } from '@/lib/use-permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { ErrorState } from '@/components/common/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function SaleSessionPage() {
  const { id } = useParams()
  const sessionId = id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canAny } = usePermissions()
  const canClose = canAny('sales.session', 'shifts.operate')

  const [closeOpen, setCloseOpen] = useState(false)
  const [closingAmount, setClosingAmount] = useState('0')
  const [notes, setNotes] = useState('')

  const query = useQuery({
    queryKey: ['sale-sessions', 'detail', sessionId],
    queryFn: () => saleSessionApi.detail(sessionId),
    enabled: !!sessionId,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  const detail = query.data?.data
  const isOpen = detail?.status === 'open'

  const cashVariance = detail?.variance ?? 0
  const stockVariance = detail?.stock_variance ?? 0

  const varianceTone = (value: number) =>
    Math.abs(value) < 0.005 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-warning'

  const reconcile = useMemo(() => {
    if (!detail) return []
    const r = detail.reconciliation
    return [
      { label: 'Opening balance', value: formatCurrency(r.opening_balance), icon: Wallet, tone: 'text-primary', ring: 'bg-primary/15' },
      { label: 'Cash sales', value: formatCurrency(r.cash_sales), icon: Banknote, tone: 'text-success', ring: 'bg-success/15' },
      { label: 'Digital sales', value: formatCurrency(r.digital_sales), icon: CircleDollarSign, tone: 'text-info', ring: 'bg-info/15' },
      { label: 'Expected in drawer', value: formatCurrency(r.expected_cash), icon: Calculator, tone: 'text-warning', ring: 'bg-warning/15' },
    ]
  }, [detail])

  const closeSale = useMutation({
    mutationFn: (input: { closing_amount: number; notes?: string }) =>
      saleSessionApi.close(sessionId, input),
    onSuccess: () => {
      toast.success('Sale closed')
      setCloseOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['sale-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err) => {
      toast.error('Could not close sale', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start gap-2.5">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
            {detail ? `${detail.branch_name} • Sale` : 'Sale'}
          </p>
          <h1 className="flex items-center gap-2 truncate text-lg font-bold tracking-tight text-foreground">
            {detail?.reference ?? 'Sale'}
            {detail && <StatusBadge status={detail.status} />}
          </h1>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <UserRound className="h-3 w-3" />
            {detail ? `${detail.user_name} • ${detail.user_role}` : 'Loading…'}
          </p>
        </div>
        {isOpen && canClose && (
          <Button
            variant="success"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => {
              setClosingAmount(String(detail?.expected_cash ?? 0))
              setNotes('')
              setCloseOpen(true)
            }}
          >
            <LogOut className="h-4 w-4" />
            Close sale
          </Button>
        )}
      </div>

      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {query.isLoading && !detail && (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}

      {detail && (
        <>
          <SessionHeader detail={detail} />

          <div className="grid grid-cols-2 gap-2.5">
            {reconcile.map((cell) => (
              <div
                key={cell.label}
                className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {cell.label}
                  </span>
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', cell.ring, cell.tone)}>
                    <cell.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-2.5 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>

          <StockReconciliation detail={detail} stockVariance={stockVariance} varianceTone={varianceTone} />

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ReceiptText className="h-4 w-4 text-success" />
                <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                {detail.sales.length}
              </span>
            </div>
            {detail.sales.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border/70">
                {detail.sales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => navigate(`/sales/${sale.id}`)}
                    className="flex items-center justify-between gap-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {sale.reference ?? `#${sale.id}`}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {sale.customer_name ?? 'Walk-in'} •{' '}
                        {sale.payment_methods.join(', ') || 'unpaid'} •{' '}
                        {formatDate(sale.created_at, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(sale.total)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {detail.status === 'closed' && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Cash variance</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Counted {formatCurrency(detail.closing_amount ?? 0)} vs expected{' '}
                    {formatCurrency(detail.expected_cash)}
                  </p>
                </div>
              </div>
              <span className={cn('font-mono text-lg font-bold tabular-nums', varianceTone(cashVariance))}>
                {cashVariance > 0 ? '+' : ''}
                {formatCurrency(cashVariance)}
              </span>
            </div>
          )}
        </>
      )}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close sale</DialogTitle>
            <DialogDescription>
              Count your cash. Stock and cash variance are reconciled automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ss-closing">Counted cash (₦)</Label>
              <Input
                id="ss-closing"
                type="number"
                min={0}
                step="0.01"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ss-notes">Notes (optional)</Label>
              <Input
                id="ss-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for variance, if any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={closeSale.isPending}
              onClick={() =>
                closeSale.mutate({
                  closing_amount: Number(closingAmount) || 0,
                  notes: notes.trim() || undefined,
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

function SessionHeader({ detail }: { detail: SaleSessionDetail }) {
  const isOpen = detail.status === 'open'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider',
            isOpen ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'animate-pulse bg-success' : 'bg-muted-foreground')} />
          {isOpen ? 'Open sale' : 'Closed sale'}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {detail.shift_reference ?? `Shift #${detail.shift_id}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Opened</p>
          <p className="mt-1 text-xs font-semibold text-foreground">{formatDateTime(detail.opened_at)}</p>
        </div>
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Closed</p>
          <p className="mt-1 text-xs font-semibold text-foreground">
            {detail.closed_at ? formatDateTime(detail.closed_at) : '—'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{detail.sales_count} transactions • {formatCurrency(detail.sales_total)} in sales</span>
        {detail.closed_by_name && <span>Closed by {detail.closed_by_name}</span>}
      </div>
    </div>
  )
}

function StockReconciliation({
  detail,
  stockVariance,
  varianceTone,
}: {
  detail: SaleSessionDetail
  stockVariance: number
  varianceTone: (value: number) => string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-1.5">
        <Boxes className="h-4 w-4 text-info" />
        <h2 className="text-sm font-semibold text-foreground">Stock Reconciliation</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Opening</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(detail.opening_stock_value)}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">{detail.opening_stock_qty} units</p>
        </div>
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Closing</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {detail.closing_stock_value === null ? '—' : formatCurrency(detail.closing_stock_value)}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">
            {detail.closing_stock_qty === null ? 'open' : `${detail.closing_stock_qty} units`}
          </p>
        </div>
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Variance</p>
          <p
            className={cn(
              'mt-1 font-mono text-sm font-bold tabular-nums',
              detail.status === 'open' ? 'text-muted-foreground' : varianceTone(stockVariance),
            )}
          >
            {detail.status === 'open' ? '—' : `${stockVariance > 0 ? '+' : ''}${formatCurrency(stockVariance)}`}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">stock</p>
        </div>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        Cost of goods sold {formatCurrency(detail.reconciliation.cogs)} • sold {detail.reconciliation.sold_qty} units
      </p>
    </div>
  )
}
