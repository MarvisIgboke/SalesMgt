import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, ReceiptText, RotateCcw, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
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
import { Badge } from '@/components/ui/badge'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { salesApi, type SaleDetail } from '@/lib/api/endpoints/sales'
import { staffApi } from '@/lib/api/endpoints/staff'
import { productsApi } from '@/lib/api/endpoints/products'
import { usePermissions } from '@/lib/use-permissions'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'online', 'credit', 'split']
const STATUSES = ['completed', 'partially_refunded', 'refunded', 'cancelled', 'awaiting_approval']

export function SalesHistoryPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [repId, setRepId] = useState('all')
  const [method, setMethod] = useState('all')
  const [productId, setProductId] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<number | null>(null)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sales', { page, search, from, to, repId, method, productId, status }],
    queryFn: () =>
      salesApi.list({
        page,
        per_page: 15,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        user_id: repId === 'all' ? undefined : Number(repId),
        payment_method: method === 'all' ? undefined : method,
        product_id: productId === 'all' ? undefined : Number(productId),
        status: status === 'all' ? undefined : status,
      }),
    placeholderData: (prev) => prev,
  })

  const reps = useQuery({
    queryKey: ['staff', { per_page: 100 }],
    queryFn: () => staffApi.list({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })

  const products = useQuery({
    queryKey: ['products', { per_page: 100 }],
    queryFn: () => productsApi.list({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const meta = data?.meta

  const resetFilters = () => {
    setPage(1)
    setSearch('')
    setFrom('')
    setTo('')
    setRepId('all')
    setMethod('all')
    setProductId('all')
    setStatus('all')
  }

  const hasFilters =
    search || from || to || repId !== 'all' || method !== 'all' || productId !== 'all' || status !== 'all'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sales History"
        description="Every sale with filters by rep, date, payment method and product."
      >
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          placeholder="Search reference…"
          onSearch={(value) => {
            setPage(1)
            setSearch(value)
          }}
        />
        <div className="grid grid-cols-2 gap-3 xl:col-span-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1)
                setFrom(e.target.value)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1)
                setTo(e.target.value)
              }}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Sales rep</Label>
          <Select
            value={repId}
            onValueChange={(value) => {
              setPage(1)
              setRepId(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {(reps.data?.data ?? []).map((rep) => (
                <SelectItem key={rep.id} value={String(rep.id)}>
                  {rep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Payment method</Label>
          <Select
            value={method}
            onValueChange={(value) => {
              setPage(1)
              setMethod(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {PAYMENT_METHODS.map((item) => (
                <SelectItem key={item} value={item} className="capitalize">
                  {item.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <Select
            value={productId}
            onValueChange={(value) => {
              setPage(1)
              setProductId(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {(products.data?.data ?? []).map((product) => (
                <SelectItem key={product.id} value={String(product.id)}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((item) => (
                <SelectItem key={item} value={item} className="capitalize">
                  {item.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="No sales found"
          description="Try adjusting the filters or date range."
          icon={<ReceiptText className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Sales rep</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs text-foreground">
                    {sale.reference}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(sale.created_at)}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                    {sale.customer_name ?? 'Walk-in'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sale.sales_rep}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {sale.item_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(sale.payment_methods ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        sale.payment_methods.map((item) => (
                          <Badge key={item} variant="outline" className="capitalize">
                            {item.replace(/_/g, ' ')}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(sale.total, sale.currency)}
                    {sale.refunded_total > 0 && (
                      <span className="mt-0.5 block text-[10px] font-normal text-destructive">
                        -{formatCurrency(sale.refunded_total, sale.currency)} refunded
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sale.status} label={sale.status.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelected(sale.id)}>
                      <span className="sr-only">View sale</span>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="sales"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {selected !== null && (
        <SaleDetailSheet saleId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function SaleDetailSheet({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')

  const detail = useQuery({
    queryKey: ['sales', saleId],
    queryFn: () => salesApi.get(saleId),
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
      <Sheet open onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sale {sale?.reference ?? `#${saleId}`}</SheetTitle>
            <SheetDescription>
              {sale ? formatDateTime(sale.created_at) : 'Loading sale details…'}
            </SheetDescription>
          </SheetHeader>

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
            <ScrollArea className="mt-4 flex-1 pr-2">
              <div className="space-y-4 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={sale.status} label={sale.status.replace(/_/g, ' ')} />
                  <Badge variant="outline" className="capitalize">
                    {sale.payment_status.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {sale.customer_name ?? 'Walk-in'}
                  </span>
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
                            <span className="text-destructive">
                              {' '}
                              · {item.refunded_quantity} refunded
                            </span>
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
                    <Row label="Discount" value={`-${formatCurrency(sale.discount_total, sale.currency)}`} />
                  )}
                  {sale.tax_total > 0 && (
                    <Row label="Tax" value={formatCurrency(sale.tax_total, sale.currency)} />
                  )}
                  <Separator />
                  <Row
                    label="Total"
                    value={formatCurrency(sale.total, sale.currency)}
                    strong
                  />
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
                          <span className="font-mono text-xs text-muted-foreground">
                            {refund.reference}
                          </span>
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
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {refundOpen && sale && (
        <RefundDialog sale={sale} onClose={() => setRefundOpen(false)} />
      )}

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
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
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
