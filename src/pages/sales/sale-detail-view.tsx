import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { StatusBadge } from '@/components/common/status-badge'
import { salesApi, type SaleDetail } from '@/lib/api/endpoints/sales'
import { usePermissions } from '@/lib/use-permissions'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function SaleDetailSheet({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['sales', saleId],
    queryFn: () => salesApi.get(saleId),
    enabled: Number.isFinite(saleId) && saleId > 0,
  })
  const sale = detail.data?.data

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Sale {sale?.reference ?? `#${saleId}`}</SheetTitle>
          <SheetDescription>
            {sale ? formatDateTime(sale.created_at) : 'Loading sale details…'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 flex-1 pr-2">
          <SaleDetailBody saleId={saleId} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export function SaleDetailBody({ saleId }: { saleId: number }) {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')

  const detail = useQuery({
    queryKey: ['sales', saleId],
    queryFn: () => salesApi.get(saleId),
    enabled: Number.isFinite(saleId) && saleId > 0,
  })

  const sale = detail.data?.data

  const cancel = useMutation({
    mutationFn: () => salesApi.cancel(saleId, reason || undefined),
    onSuccess: () => {
      toast.success('Sale cancelled')
      setCancelOpen(false)
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (err) => {
      toast.error('Could not cancel sale', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const canCancel = can('sales.cancel') && sale && !['cancelled', 'refunded'].includes(sale.status)
  const canRefund =
    can('sales.refund') && sale && ['completed', 'partially_refunded'].includes(sale.status)

  return (
    <>
      {detail.isLoading && (
        <div className="mt-4">
          <LoadingState rows={6} />
        </div>
      )}
      {detail.isError && (
        <div className="mt-4">
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        </div>
      )}

      {sale && (
        <div className="space-y-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sale.status} label={sale.status.replace(/_/g, ' ')} />
            <Badge variant="outline" className="capitalize">
              {sale.payment_status.replace(/_/g, ' ')}
            </Badge>
            <span className="text-sm text-muted-foreground">{sale.customer_name ?? 'Walk-in'}</span>
          </div>

          <div className="rounded-xl border border-border/70">
            {sale.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-border/60 p-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                    {item.variant_name ? ` · ${item.variant_name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price, sale.currency)}
                    {item.refunded_quantity > 0 && (
                      <span className="text-destructive"> · {item.refunded_quantity} refunded</span>
                    )}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.line_total, sale.currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Row label="Subtotal" value={formatCurrency(sale.subtotal, sale.currency)} />
            {sale.discount_total > 0 && (
              <Row
                label="Discount"
                value={`-${formatCurrency(sale.discount_total, sale.currency)}`}
              />
            )}
            {sale.tax_total > 0 && (
              <Row label="Tax" value={formatCurrency(sale.tax_total, sale.currency)} />
            )}
            <Separator />
            <Row label="Total" value={formatCurrency(sale.total, sale.currency)} strong />
            <Row label="Paid" value={formatCurrency(sale.paid_amount, sale.currency)} />
          </div>

          {sale.payments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payments
              </p>
              <div className="space-y-1.5">
                {sale.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {payment.method.replace(/_/g, ' ')}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatCurrency(payment.amount, sale.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sale.refunds.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Refunds
              </p>
              <div className="space-y-1.5">
                {sale.refunds.map((refund) => (
                  <div key={refund.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{refund.reference}</span>
                    <span className="tabular-nums text-destructive">
                      -{formatCurrency(refund.total, sale.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(canCancel || canRefund) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {canRefund && (
                <Button variant="secondary" size="sm" onClick={() => setRefundOpen(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Refund
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                  <XCircle className="h-4 w-4" />
                  Cancel sale
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {refundOpen && sale && <RefundDialog sale={sale} onClose={() => setRefundOpen(false)} />}

      {cancelOpen && (
        <Dialog open onOpenChange={setCancelOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel this sale?</DialogTitle>
              <DialogDescription>
                Stock will be returned and any customer credit reversed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Input
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this sale being cancelled?"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>
                Keep sale
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Cancel sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function RefundDialog({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {}
    sale.items.forEach((item) => {
      initial[item.id] = ''
    })
    return initial
  })

  const refund = useMutation({
    mutationFn: () => {
      const items = sale.items
        .map((item) => ({
          sale_item_id: item.id,
          quantity: Number(quantities[item.id] || 0),
        }))
        .filter((item) => item.quantity > 0)

      return salesApi.refund(sale.id, { reason: reason || undefined, items })
    },
    onSuccess: () => {
      toast.success('Refund recorded')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (err) => {
      toast.error('Could not record refund', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const total = sale.items.reduce((sum, item) => {
    const qty = Number(quantities[item.id] || 0)
    return sum + qty * item.unit_price
  }, 0)

  const hasSelection = sale.items.some((item) => Number(quantities[item.id] || 0) > 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund {sale.reference}</DialogTitle>
          <DialogDescription>
            Enter the quantity to refund for each item. Stock and credit are reversed automatically.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-3">
            {sale.items.map((item) => {
              const refundable = item.quantity - item.refunded_quantity
              return (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Refundable: {refundable} of {item.quantity}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={refundable}
                    step="1"
                    className="w-24"
                    value={quantities[item.id] ?? ''}
                    disabled={refundable <= 0}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="grid gap-2">
          <Label htmlFor="refund-reason">Reason (optional)</Label>
          <Input
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this refund being issued?"
          />
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Refund total:{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(total, sale.currency)}
            </span>
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={refund.isPending}
              disabled={!hasSelection}
              onClick={() => refund.mutate()}
            >
              <RotateCcw className="h-4 w-4" />
              Refund
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  )
}
