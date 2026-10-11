import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  Cpu,
  Eye,
  PackageCheck,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Store,
  Trash2,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  purchasingApi,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type PurchaseRequisition,
  type PurchasingSummary,
} from '@/lib/api/endpoints/purchasing'
import { suppliersApi } from '@/lib/api/endpoints/suppliers'
import { productsApi } from '@/lib/api/endpoints/products'
import type { Branch } from '@/lib/api/endpoints/business'
import { useAppStore } from '@/stores/app'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { usePermissions } from '@/lib/use-permissions'
import { cn, debounce, formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'

const STATUS_OPTIONS = ['all', 'draft', 'pending', 'approved', 'received', 'cancelled'] as const

type Option = { id: number; name: string }
type ProductOption = { id: number; name: string; sku: string }

interface OrderLine {
  key: number
  productId: string
  quantity: string
  unitCost: string
}

const PIPELINE_STAGES = ['Approved', 'Dispatched', 'GRN Dock', 'Stocked'] as const

interface StatusMeta {
  label: string
  chip: string
  dot: string
  referenceTone: string
  steps: number
  current: string
}

function orderStatusMeta(status: string): StatusMeta {
  switch (status) {
    case 'approved':
      return {
        label: 'In-Transit',
        chip: 'bg-primary/10 text-primary',
        dot: 'bg-primary animate-pulse',
        referenceTone: 'text-primary',
        steps: 2,
        current: 'Approved & Dispatched',
      }
    case 'received':
      return {
        label: 'Reconciled',
        chip: 'bg-success/10 text-success',
        dot: 'bg-success',
        referenceTone: 'text-success',
        steps: 4,
        current: 'Stocked — GRN verified',
      }
    case 'pending':
      return {
        label: 'Pending Approval',
        chip: 'bg-warning/15 text-warning',
        dot: 'bg-warning',
        referenceTone: 'text-primary',
        steps: 0,
        current: 'Awaiting approval',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        chip: 'bg-destructive/10 text-destructive',
        dot: 'bg-destructive/40',
        referenceTone: 'text-muted-foreground',
        steps: -1,
        current: 'Cancelled',
      }
    default:
      return {
        label: 'Draft',
        chip: 'bg-surface-container-highest text-muted-foreground',
        dot: 'bg-muted-foreground',
        referenceTone: 'text-muted-foreground',
        steps: 0,
        current: 'Draft — not submitted',
      }
  }
}

function kpiGlyph(kind: 'open' | 'inbound' | 'dock' | 'payables', className: string) {
  if (kind === 'open') return <ClipboardCheck className={className} />
  if (kind === 'inbound') return <Truck className={className} />
  if (kind === 'dock') return <PackageCheck className={className} />
  return <Wallet className={className} />
}

export function PurchasingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const contextBranchName = useAppStore((s) => s.context?.branch?.name)
  const branches = useAppStore((s) => s.branches)
  const { canAny } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()

  const canCreate = canAny('purchases.create', 'purchases.approve', 'purchases.receive')

  const presetSupplierId = (() => {
    const raw = searchParams.get('supplier')
    if (!raw) return undefined
    const id = Number(raw)
    return Number.isFinite(id) && id > 0 ? id : undefined
  })()

  const [segment, setSegment] = useState<'orders' | 'requisitions'>('orders')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [requisitionsPage, setRequisitionsPage] = useState(1)
  const [orderDialogOpen, setOrderDialogOpen] = useState(() => presetSupplierId !== undefined && canCreate)
  const [requisitionDialogOpen, setRequisitionDialogOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const searchDebounced = useRef(
    debounce((value: string) => {
      setPage(1)
      setSearch(value)
    }, 350),
  )

  const closeOrderDialog = () => {
    setOrderDialogOpen(false)
    if (searchParams.has('supplier')) {
      const next = new URLSearchParams(searchParams)
      next.delete('supplier')
      setSearchParams(next, { replace: true })
    }
  }

  const productsQuery = useQuery({
    queryKey: ['products', 'options'],
    queryFn: () => productsApi.list({ per_page: 50 }),
    staleTime: 60_000,
  })

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'options'],
    queryFn: () => suppliersApi.list({ per_page: 50 }),
    staleTime: 60_000,
  })

  const vendorsQuery = useQuery({
    queryKey: ['suppliers', 'health'],
    queryFn: () => suppliersApi.list({ per_page: 20 }),
    staleTime: 60_000,
  })

  const summaryQuery = useQuery({
    queryKey: ['purchasing', 'summary'],
    queryFn: () => purchasingApi.summary(),
    refetchInterval: 30_000,
  })

  const ordersQuery = useQuery({
    queryKey: ['purchasing', 'orders', { page, status, search }],
    queryFn: () =>
      purchasingApi.orders({
        page,
        per_page: 10,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const requisitionsQuery = useQuery({
    queryKey: ['purchasing', 'requisitions', { page: requisitionsPage }],
    queryFn: () => purchasingApi.requisitions({ page: requisitionsPage, per_page: 10 }),
    placeholderData: (prev) => prev,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      purchasingApi.updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order updated')
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not update order', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const products = productsQuery.data?.data ?? []
  const suppliers = suppliersQuery.data?.data ?? []
  const summary = summaryQuery.data?.data
  const orders: PurchaseOrder[] = ordersQuery.data?.data ?? []
  const ordersMeta = ordersQuery.data?.meta
  const requisitions: PurchaseRequisition[] = requisitionsQuery.data?.data ?? []
  const requisitionsMeta = requisitionsQuery.data?.meta

  const vendors = useMemo(
    () =>
      [...(vendorsQuery.data?.data ?? [])]
        .map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          purchases: supplier.total_purchases,
          balance: supplier.outstanding_balance,
        }))
        .filter((vendor) => vendor.purchases > 0 || vendor.balance > 0)
        .sort((a, b) => b.purchases - a.purchases)
        .slice(0, 4),
    [vendorsQuery.data],
  )

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        branchName={contextBranchName ?? undefined}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <MetricGrid summary={summary} loading={summaryQuery.isLoading} errored={summaryQuery.isError} />

      <ActionBar
        onCreate={() => setOrderDialogOpen(true)}
        onReceive={() => {
          setSegment('orders')
          setStatus('approved')
          setPage(1)
          toast.info('Approved POs shown — mark received to land stock at the GRN dock.')
        }}
        onSuppliers={() => navigate('/suppliers')}
      />

      <div className="flex items-center gap-2 rounded-lg bg-surface-sunken p-1">
        <button
          type="button"
          onClick={() => setSegment('orders')}
          className={cn(
            'h-9 flex-1 rounded-md text-xs font-semibold transition-colors',
            segment === 'orders' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          Purchase Orders
        </button>
        <button
          type="button"
          onClick={() => setSegment('requisitions')}
          className={cn(
            'flex h-9 flex-1 items-center justify-center gap-1 rounded-md text-xs font-semibold transition-colors',
            segment === 'requisitions' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <ClipboardPlus className="h-3.5 w-3.5" />
          Requisitions
        </button>
      </div>

      {segment === 'orders' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                defaultValue={search}
                onChange={(event) => searchDebounced.current(event.target.value)}
                placeholder="Search PO#, vendor, SKU…"
                className="h-11 rounded-xl pl-10 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                PO
              </span>
            </div>
            <Button variant="secondary" size="icon" aria-label="Scan barcode" onClick={() => setScannerOpen(true)}>
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>

          <StatusPills
            active={status}
            counts={summary?.status_counts}
            onChange={(next) => {
              setPage(1)
              setStatus(next)
            }}
          />

          <OrderStream
            orders={orders}
            loading={ordersQuery.isLoading}
            error={ordersQuery.error}
            onRetry={() => ordersQuery.refetch()}
            meta={ordersMeta}
            page={page}
            isFetching={ordersQuery.isFetching}
            onPageChange={setPage}
            onInspect={setDetailOrder}
            onMutate={updateStatus.mutate}
            canCreate={canCreate}
            onNewOrder={() => setOrderDialogOpen(true)}
          />
        </>
      )}

      {segment === 'requisitions' && (
        <RequisitionStream
          requisitions={requisitions}
          loading={requisitionsQuery.isLoading}
          error={requisitionsQuery.error}
          onRetry={() => requisitionsQuery.refetch()}
          meta={requisitionsMeta}
          page={requisitionsPage}
          isFetching={requisitionsQuery.isFetching}
          onPageChange={setRequisitionsPage}
          canCreate={canCreate}
          onNew={() => setRequisitionDialogOpen(true)}
        />
      )}

      <SpendCard summary={summary} vendors={vendors} />

      {orderDialogOpen && (
        <OrderDialog
          suppliers={suppliers}
          products={products}
          branches={branches}
          defaultBranchId={branchId}
          defaultSupplierId={presetSupplierId}
          onClose={closeOrderDialog}
        />
      )}

      {requisitionDialogOpen && (
        <RequisitionDialog
          products={products}
          defaultBranchId={branchId}
          onClose={() => setRequisitionDialogOpen(false)}
        />
      )}

      {detailOrder && <OrderDetailDialog order={detailOrder} onClose={() => setDetailOrder(null)} />}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(barcode) => {
          setScannerOpen(false)
          setPage(1)
          setSearch(barcode)
        }}
      />
    </div>
  )
}

function TelemetryBar({
  branchName,
  syncing,
  onSync,
}: {
  branchName?: string
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
          Procurement Engine
        </span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
          {branchName ?? 'All Branches'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-muted-foreground sm:flex">
          <Cpu className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px]">ERP SYNC</span>
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onSync} disabled={syncing}>
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
        </Button>
      </div>
    </div>
  )
}

function MetricGrid({
  summary,
  loading,
  errored,
}: {
  summary?: PurchasingSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const kpi = summary?.kpis
  const cards: {
    kind: 'open' | 'inbound' | 'dock' | 'payables'
    label: string
    value: string | number
    sub: string
    subTone: string
    iconTone: string
  }[] = [
    {
      kind: 'open',
      label: 'Open POs',
      value: dim ?? formatCurrency(kpi?.open_pos.value ?? 0),
      sub: (dim ?? '') || `${formatNumber(kpi?.open_pos.count ?? 0)} orders pending`,
      subTone: 'text-primary',
      iconTone: 'bg-primary/10 text-primary',
    },
    {
      kind: 'inbound',
      label: 'Inbound Logistics',
      value: dim ?? formatCurrency(kpi?.inbound.value ?? 0),
      sub: (dim ?? '') || `${formatNumber(kpi?.inbound.count ?? 0)} in transit`,
      subTone: 'text-success',
      iconTone: 'bg-primary/15 text-primary',
    },
    {
      kind: 'dock',
      label: 'GRN & QC Dock',
      value: dim ?? `${formatNumber(kpi?.grn_dock.count ?? 0)} deliveries`,
      sub: (dim ?? '') || `${formatCurrency(kpi?.grn_dock.value ?? 0)} stock landed`,
      subTone: 'text-warning',
      iconTone: 'bg-warning/15 text-warning',
    },
    {
      kind: 'payables',
      label: 'Payables (14d)',
      value: dim ?? formatCurrency(kpi?.payables_14d.value ?? 0),
      sub: (dim ?? '') || `${formatNumber(kpi?.payables_14d.count ?? 0)} invoices due`,
      subTone: 'text-success',
      iconTone: 'bg-success/15 text-success',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((card) => (
        <div
          key={card.kind}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5"
        >
          <div className={cn('pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-lg', card.iconTone)} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <span className={cn('grid h-6 w-6 place-items-center rounded', card.iconTone)}>
              {kpiGlyph(card.kind, 'h-3.5 w-3.5')}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">{card.value}</div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', loading ? 'bg-muted' : 'bg-primary')} />
            <span className={card.subTone}>{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionBar({
  onCreate,
  onReceive,
  onSuppliers,
}: {
  onCreate: () => void
  onReceive: () => void
  onSuppliers: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onCreate}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-accent shadow-md transition-all active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" />
        Create Purchase Order
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onReceive}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-semibold text-foreground transition-all active:scale-95"
        >
          <ScanLine className="h-4 w-4 text-primary" />
          Receive GRN
        </button>
        <button
          type="button"
          onClick={onSuppliers}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-semibold text-foreground transition-all active:scale-95"
        >
          <Store className="h-4 w-4 text-success" />
          Supplier Hub
        </button>
      </div>
    </div>
  )
}

function StatusPills({
  active,
  counts,
  onChange,
}: {
  active: (typeof STATUS_OPTIONS)[number]
  counts?: PurchasingSummary['status_counts']
  onChange: (status: (typeof STATUS_OPTIONS)[number]) => void
}) {
  const labels: Record<(typeof STATUS_OPTIONS)[number], string> = {
    all: 'All POs',
    draft: 'Draft',
    pending: 'Pending Approval',
    approved: 'In-Transit',
    received: 'Received',
    cancelled: 'Cancelled',
  }

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      {STATUS_OPTIONS.map((key) => {
        const isActive = active === key
        const count = counts ? counts[key] : 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-surface-elevated hover:bg-surface-sunken',
            )}
          >
            {labels[key]}
            <span
              className={cn(
                'grid h-4 w-4 place-items-center rounded-full font-mono text-[9px]',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-surface-container-highest text-muted-foreground',
              )}
            >
              {formatNumber(count)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function OrderStream({
  orders,
  loading,
  error,
  onRetry,
  meta,
  page,
  isFetching,
  onPageChange,
  onInspect,
  onMutate,
  canCreate,
  onNewOrder,
}: {
  orders: PurchaseOrder[]
  loading: boolean
  error: unknown
  onRetry: () => void
  meta?: { current_page: number; last_page: number; total: number }
  page: number
  isFetching: boolean
  onPageChange: (page: number) => void
  onInspect: (order: PurchaseOrder) => void
  onMutate: (input: { id: number; status: string }) => void
  canCreate: boolean
  onNewOrder: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && !!error && <ErrorState error={error} onRetry={onRetry} />}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="No purchase orders found"
          description="Adjust the status filter, clear search, or create your first purchase order."
          icon={<ClipboardCheck className="h-6 w-6" />}
          action={
            canCreate ? (
              <Button variant="outline" size="sm" onClick={onNewOrder}>
                <Plus className="h-4 w-4" />
                New order
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading &&
        !error &&
        orders.map((order) => (
          <PurchaseOrderCard key={order.id} order={order} onInspect={onInspect} onMutate={onMutate} />
        ))}

      {!loading && !error && orders.length > 0 && (
        <Pagination
          page={meta?.current_page ?? page}
          lastPage={meta?.last_page ?? 1}
          total={meta?.total}
          totalLabel="orders"
          isFetching={isFetching}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}

function PurchaseOrderCard({
  order,
  onInspect,
  onMutate,
}: {
  order: PurchaseOrder
  onInspect: (order: PurchaseOrder) => void
  onMutate: (input: { id: number; status: string }) => void
}) {
  const meta = orderStatusMeta(order.status)
  const preview = order.item_preview ?? []
  const previewText = preview.length > 0 ? preview.join(', ') : 'Items on this order'
  const quantityLine = `${formatNumber(order.items_count ?? 0)} line${(order.items_count ?? 0) === 1 ? '' : 's'} • ${formatNumber(order.units ?? 0)} units`

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-sm font-bold', meta.referenceTone)}>{order.reference}</span>
            <span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase', meta.chip)}>
              {order.supplier_name ? 'Tier-1 Direct' : 'Unassigned Vendor'}
            </span>
          </div>
          <h3 className="mt-0.5 truncate text-sm font-bold text-foreground">
            {order.supplier_name ?? 'No supplier assigned'}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn('inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] font-semibold uppercase', meta.chip)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
            {meta.label}
          </span>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {order.expected_at ? `ETA ${formatDate(order.expected_at)}` : 'No ETA set'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken p-2.5">
        <div className="min-w-0 pr-2">
          <div className="truncate text-xs font-medium text-foreground">{quantityLine}</div>
          <div className="truncate text-xs text-muted-foreground">{previewText}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-bold text-foreground">{formatCurrency(order.total)}</div>
          <div className="font-mono text-[10px] text-success">{order.branch_name}</div>
        </div>
      </div>

      <PipelineStepper status={order.status} current={meta.current} />

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken/60 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{order.created_by}</span>
          <span className="hidden text-border sm:inline">•</span>
          <span className="hidden truncate sm:inline">{formatDateTime(order.created_at)}</span>
        </span>
        <span className="shrink-0 font-mono text-[10px]">{order.expected_at ? formatDate(order.expected_at) : '—'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        {order.status === 'draft' && (
          <>
            <FooterButton onClick={() => onMutate({ id: order.id, status: 'pending' })} Icon={Send} label="Submit" />
            <FooterButton onClick={() => onMutate({ id: order.id, status: 'cancelled' })} Icon={XCircle} label="Cancel" tone="text-destructive" />
            <FooterButton onClick={() => onInspect(order)} Icon={Eye} label="Inspect" />
          </>
        )}
        {order.status === 'pending' && (
          <>
            <FooterButton onClick={() => onMutate({ id: order.id, status: 'approved' })} Icon={CheckCircle2} label="Authorize" tone="bg-success/15 text-success" />
            <FooterButton onClick={() => onMutate({ id: order.id, status: 'cancelled' })} Icon={XCircle} label="Reject" tone="text-destructive" />
            <FooterButton onClick={() => onInspect(order)} Icon={Eye} label="Inspect" />
          </>
        )}
        {order.status === 'approved' && (
          <>
            <FooterButton onClick={() => onMutate({ id: order.id, status: 'received' })} Icon={PackageCheck} label="Mark Received" tone="bg-primary/15 text-primary" />
            <FooterButton onClick={() => onInspect(order)} Icon={Eye} label="Track" />
            <span />
          </>
        )}
        {(order.status === 'received' || order.status === 'cancelled') && (
          <>
            <FooterButton onClick={() => onInspect(order)} Icon={Eye} label={order.status === 'received' ? 'Inspect GRN' : 'Details'} />
            <span />
            <span />
          </>
        )}
      </div>
    </article>
  )
}

function FooterButton({
  onClick,
  Icon,
  label,
  tone,
}: {
  onClick: () => void
  Icon: typeof Eye
  label: string
  tone?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95',
        tone ?? 'border border-border bg-surface-elevated text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function PipelineStepper({ status, current }: { status: string; current: string }) {
  const steps = status === 'received' ? 4 : status === 'approved' ? 2 : status === 'cancelled' ? -1 : 0

  return (
    <div className="py-1">
      <div className="mb-1.5 flex items-center justify-between px-0.5 font-mono text-[10px] text-muted-foreground">
        {steps === -1 ? (
          <span className="font-semibold text-destructive">Cancelled</span>
        ) : (
          <>
            <span className={steps > 0 ? 'font-semibold text-success' : 'font-semibold text-muted-foreground'}>
              1. Approved
            </span>
            <span className={steps >= 2 ? 'font-bold text-primary' : ''}>2. Dispatched</span>
            <span>3. GRN Dock</span>
            <span>4. Stocked</span>
          </>
        )}
      </div>
      {steps === -1 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
          <div className="h-full bg-destructive/40" />
        </div>
      ) : (
        <div className="flex h-1.5 w-full gap-0.5 overflow-hidden">
          {PIPELINE_STAGES.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-full flex-1 rounded-full transition-colors',
                index < steps ? 'bg-success' : index === steps && steps < 4 ? 'animate-pulse bg-primary' : 'bg-surface-container',
              )}
            />
          ))}
        </div>
      )}
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{current}</div>
    </div>
  )
}

function RequisitionStream({
  requisitions,
  loading,
  error,
  onRetry,
  meta,
  page,
  isFetching,
  onPageChange,
  canCreate,
  onNew,
}: {
  requisitions: PurchaseRequisition[]
  loading: boolean
  error: unknown
  onRetry: () => void
  meta?: { current_page: number; last_page: number; total: number }
  page: number
  isFetching: boolean
  onPageChange: (page: number) => void
  canCreate: boolean
  onNew: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Replenishment Requests
        </span>
        {canCreate && (
          <Button size="sm" onClick={onNew}>
            <ClipboardPlus className="h-4 w-4" /> New requisition
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && !!error && <ErrorState error={error} onRetry={onRetry} />}

      {!loading && !error && requisitions.length === 0 && (
        <EmptyState
          title="No requisitions found"
          description="Requisition forms are converted into purchase orders at approval."
          icon={<ClipboardPlus className="h-6 w-6" />}
        />
      )}

      {!loading &&
        !error &&
        requisitions.map((req) => (
          <article key={req.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated p-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{req.reference}</span>
                <StatusBadge status={req.status} />
              </div>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">{req.product_name}</h3>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {req.branch_name} • {req.requested_by} • {formatDateTime(req.created_at)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-sm font-bold text-foreground">{formatNumber(req.quantity)}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground">units</div>
            </div>
          </article>
        ))}

      {!loading && !error && requisitions.length > 0 && (
        <Pagination
          page={meta?.current_page ?? page}
          lastPage={meta?.last_page ?? 1}
          total={meta?.total}
          totalLabel="requisitions"
          isFetching={isFetching}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}

function SpendCard({
  summary,
  vendors,
}: {
  summary?: PurchasingSummary
  vendors: { id: number; name: string; purchases: number; balance: number }[]
}) {
  const mtd = summary?.spend.mtd ?? 0
  const open = summary?.spend.open_commitment ?? 0
  const base = mtd + open
  const mtdPct = base > 0 ? Math.min((mtd / base) * 100, 100) : 0
  const openPct = base > 0 ? Math.min((open / base) * 100, 100) : 0

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-foreground">Procurement Cap &amp; Cadence</h3>
        </div>
        <span className="rounded bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">MTD</span>
      </div>

      {summary ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">MTD Procurement Spend</span>
            <span className="font-mono text-sm font-bold text-foreground">
              {formatCurrency(mtd)}{' '}
              <span className="font-normal text-muted-foreground">/ {formatCurrency(base)} committed</span>
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full bg-primary" style={{ width: `${mtdPct}%` }} />
            <div className="h-full bg-warning/60" style={{ width: `${openPct}%` }} />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{formatNumber(summary.spend.mtd_orders)} orders placed</span>
            <span className="text-warning">{formatCurrency(open)} open commitment</span>
          </div>
        </div>
      ) : (
        <Skeleton className="h-24 w-full rounded-lg" />
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vendor Health &amp; SLAs
        </span>
        {vendors.length === 0 ? (
          <div className="rounded-lg bg-surface-sunken p-3 text-center font-mono text-[10px] text-muted-foreground">
            Add suppliers to track vendor compliance.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-foreground">{vendor.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {formatNumber(vendor.purchases)} purchases
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn('font-mono text-xs font-bold', vendor.balance > 0 ? 'text-warning' : 'text-success')}>
                    {formatCurrency(vendor.balance)}
                  </span>
                  <div className="font-mono text-[10px] text-muted-foreground">Owing</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OrderDetailDialog({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ['purchasing', 'order', order.id],
    queryFn: () => purchasingApi.order(order.id),
  })

  const detail = detailQuery.data?.data

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.reference}</DialogTitle>
          <DialogDescription>
            {order.supplier_name ?? 'No supplier'} • {order.branch_name} • {formatDate(order.created_at)}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading && <Skeleton className="h-48 w-full rounded-xl" />}

        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />}

        {detail && (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-surface-sunken p-2">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">Status</div>
                <StatusBadge status={detail.status} className="mt-1" />
              </div>
              <div className="rounded-lg bg-surface-sunken p-2">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">Expected</div>
                <div className="mt-1 font-mono text-xs font-semibold text-foreground">
                  {detail.expected_at ? formatDate(detail.expected_at) : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-surface-sunken p-2">
                <div className="font-mono text-[10px] uppercase text-muted-foreground">Total</div>
                <div className="mt-1 font-mono text-xs font-bold text-foreground">{formatCurrency(detail.total)}</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium text-foreground">
                      {item.product_name ?? `Product #${item.product_id}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatNumber(item.quantity)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(item.unit_cost)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatCurrency(item.line_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {detail.notes && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Notes: </span>
                {detail.notes}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface OrderDialogProps {
  suppliers: Option[]
  products: ProductOption[]
  branches: Branch[]
  defaultBranchId?: number
  defaultSupplierId?: number
  onClose: () => void
}

function OrderDialog({
  suppliers,
  products,
  branches,
  defaultBranchId,
  defaultSupplierId,
  onClose,
}: OrderDialogProps) {
  const queryClient = useQueryClient()
  const nextKey = useRef(2)
  const [supplierId, setSupplierId] = useState(
    defaultSupplierId ? String(defaultSupplierId) : 'none',
  )
  const [branch, setBranch] = useState(defaultBranchId ? String(defaultBranchId) : '')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([
    { key: 1, productId: '', quantity: '1', unitCost: '' },
  ])

  const createOrder = useMutation({
    mutationFn: (input: PurchaseOrderInput) => purchasingApi.createOrder(input),
    onSuccess: () => {
      toast.success('Order created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not create order', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const updateLine = (key: number, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: nextKey.current++, productId: '', quantity: '1', unitCost: '' },
    ])
  }

  const removeLine = (key: number) => {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  const hasProduct = lines.some((line) => line.productId)

  const submit = () => {
    const rows = lines.filter((line) => line.productId)
    if (rows.length === 0) {
      toast.error('Add at least one product line')
      return
    }
    if (!branch) {
      toast.error('Select a branch')
      return
    }
    createOrder.mutate({
      supplier_id: supplierId === 'none' ? undefined : Number(supplierId),
      branch_id: Number(branch),
      expected_at: expectedAt || undefined,
      items: rows.map((line) => ({
        product_id: Number(line.productId),
        quantity: Number(line.quantity) || 1,
        unit_cost: line.unitCost ? Number(line.unitCost) : undefined,
      })),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>
            Commit a supplier order. Totals and stock effects are calculated by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-expected">Expected date</Label>
            <Input
              id="order-expected"
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Items</Label>
            <div className="grid gap-3 rounded-xl border border-border/70 p-3">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-6 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Product</Label>
                    <Select
                      value={line.productId}
                      onValueChange={(value) => updateLine(line.key, { productId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3 grid gap-1">
                    <Label className="text-[11px] text-muted-foreground">Unit cost</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                    >
                      <span className="sr-only">Remove line</span>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={addLine}>
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="order-notes">Notes</Label>
            <Input
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, terms…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={createOrder.isPending} disabled={!hasProduct || !branch} onClick={submit}>
            Create order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface RequisitionDialogProps {
  products: ProductOption[]
  defaultBranchId?: number
  onClose: () => void
}

function RequisitionDialog({ products, defaultBranchId, onClose }: RequisitionDialogProps) {
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  const createRequisition = useMutation({
    mutationFn: (input: {
      product_id: number
      quantity: number
      branch_id: number
      notes?: string
    }) => purchasingApi.createRequisition(input),
    onSuccess: () => {
      toast.success('Requisition created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['purchasing'] })
    },
    onError: (err) => {
      toast.error('Could not create requisition', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const submit = () => {
    if (!productId) {
      toast.error('Select a product')
      return
    }
    if (!defaultBranchId) {
      toast.error('No active branch selected')
      return
    }
    createRequisition.mutate({
      product_id: Number(productId),
      quantity: Number(quantity) || 1,
      branch_id: defaultBranchId,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New requisition</DialogTitle>
          <DialogDescription>
            Request stock replenishment for the active branch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requisition-quantity">Quantity</Label>
            <Input
              id="requisition-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requisition-notes">Notes</Label>
            <Input
              id="requisition-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, urgency…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={createRequisition.isPending}
            disabled={!productId || !defaultBranchId}
            onClick={submit}
          >
            Create requisition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}