import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileDown,
  History,
  Package,
  PackageX,
  Pill,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Snowflake,
  Wallet,
  Wine,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, debounce, formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { inventoryApi, type StockLevel, type StockMovement } from '@/lib/api/endpoints/inventory'
import { productsApi, type Product } from '@/lib/api/endpoints/products'
import { usePermissions } from '@/lib/use-permissions'

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Stock in',
  out: 'Stock out',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  damage: 'Damage',
  expired: 'Expired',
  return: 'Return',
}

const MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'transfer_in', 'transfer_out', 'damage', 'expired'] as const

type Segment = 'items' | 'movements'
type StatusFilter = 'all' | 'in_stock' | 'low' | 'out_of_stock'

const STATUS_META: Record<
  StatusFilter,
  { label: string; tone: string }
> = {
  all: { label: 'All Stock', tone: 'text-foreground' },
  in_stock: { label: 'In Stock', tone: 'text-success' },
  low: { label: 'Low & Reorder', tone: 'text-warning' },
  out_of_stock: { label: 'Out of Stock', tone: 'text-destructive' },
}

function stockGlyph(name: string, className: string) {
  const value = name.toLowerCase()
  if (/(pharm|medic|\brx\b|health|drug|clinic|paracet|amox)/.test(value)) return <Pill className={className} />
  if (/(cold|frozen|dairy|fridge|chill|ice|water|drink|bever)/.test(value)) return <Snowflake className={className} />
  if (/(vault|spirit|wine|alcohol|bar|liquor|whisk)/.test(value)) return <Wine className={className} />
  if (/(elect|tech|gadget|device|computer|cable|usb)/.test(value)) return <Cpu className={className} />
  return <Package className={className} />
}

export function InventoryPage() {
  const navigate = useNavigate()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const branchName = useAppStore((s) => s.context?.branch?.name)
  const { can } = usePermissions()
  const canAdjust = can('inventory.adjust')

  const [segment, setSegment] = useState<Segment>('items')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [movementType, setMovementType] = useState<string>('all')
  const [movementsPage, setMovementsPage] = useState(1)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustProductId, setAdjustProductId] = useState<number | undefined>(undefined)

  const searchDebounced = useRef(
    debounce((value: string) => {
      setPage(1)
      setSearch(value)
    }, 350),
  )

  const dashboard = useQuery({
    queryKey: ['inventory', 'dashboard', { branchId }],
    queryFn: () => inventoryApi.dashboard({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const levels = useQuery({
    queryKey: ['inventory', 'levels', { page, search, branchId, status }],
    queryFn: () =>
      inventoryApi.levels({
        page,
        per_page: 8,
        search: search || undefined,
        branch_id: branchId,
        status: status === 'all' ? undefined : status,
      }),
    placeholderData: (prev) => prev,
  })

  const movements = useQuery({
    queryKey: ['inventory', 'movements', { movementsPage, branchId, movementType }],
    queryFn: () =>
      inventoryApi.movements({
        page: movementsPage,
        per_page: 12,
        branch_id: branchId,
        type: movementType === 'all' ? undefined : movementType,
      }),
    placeholderData: (prev) => prev,
  })

  const recent = useQuery({
    queryKey: ['inventory', 'movements', 'recent', { branchId }],
    queryFn: async () => {
      const response = await inventoryApi.movements({ page: 1, per_page: 50, branch_id: branchId })
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      let inbound = 0
      let outbound = 0
      for (const item of response.data as StockMovement[]) {
        if (new Date(item.happened_at).getTime() < cutoff) continue
        if (item.quantity > 0) inbound += item.quantity
        else outbound += Math.abs(item.quantity)
      }
      return { response, in24: inbound, out24: outbound }
    },
    placeholderData: (prev) => prev,
  })

  const stats = dashboard.data?.data
  const rows = useMemo(() => (levels.data?.data as StockLevel[] | undefined) ?? [], [levels.data])
  const movementRows = useMemo(
    () => (movements.data?.data as StockMovement[] | undefined) ?? [],
    [movements.data],
  )

  const inStock = Math.max(0, (stats?.total_sku ?? 0) - (stats?.low_stock_count ?? 0) - (stats?.out_of_stock_count ?? 0))
  const healthPct = stats && stats.total_sku > 0 ? Math.round((inStock / stats.total_sku) * 1000) / 10 : 100

  const openAdjust = (productId?: number) => {
    setAdjustProductId(productId)
    setAdjustOpen(true)
  }

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error('Nothing to export')
      return
    }
    const header = ['Product', 'SKU', 'Category', 'Branch', 'On Hand', 'Threshold', 'Status', 'Cost', 'Price', 'Valuation']
    const lines = rows.map((row) =>
      [
        row.product_name,
        row.sku,
        row.category ?? '',
        row.branch_name,
        row.quantity,
        row.low_stock_threshold ?? '',
        row.status,
        row.cost_price ?? '',
        row.selling_price ?? '',
        row.valuation ?? '',
      ]
        .map((value) => {
          const text = String(value ?? '')
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in space-y-4">
      <TelemetryBar branchName={branchName} node={branchId} onSync={() => { void dashboard.refetch(); void levels.refetch() }} syncing={dashboard.isFetching || levels.isFetching} />

      <MetricMosaic
        stats={stats}
        inStock={inStock}
        healthPct={healthPct}
        in24={recent.data?.in24 ?? 0}
        out24={recent.data?.out24 ?? 0}
        loading={dashboard.isLoading}
        errored={dashboard.isError}
      />

      <QuickActions
        canAdjust={canAdjust}
        onAdjust={() => openAdjust()}
        onTransfer={() => navigate('/inventory/trace')}
        onExpiry={() => navigate('/inventory/expiry')}
        onMovements={() => setSegment('movements')}
      />

      <SegmentTabs value={segment} onChange={setSegment} itemsCount={stats?.total_sku} movementsCount={recent.data?.response.meta.total} />

      {segment === 'items' && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              defaultValue={search}
              onChange={(event) => searchDebounced.current(event.target.value)}
              placeholder="SKU, barcode, product name…"
              className="h-11 rounded-xl pl-10 pr-24"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Scan barcode" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <StatusPills
            active={status}
            counts={{
              all: stats?.total_sku ?? 0,
              in_stock: inStock,
              low: stats?.low_stock_count ?? 0,
              out_of_stock: stats?.out_of_stock_count ?? 0,
            }}
            onChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          />

          <DistributionBar inStock={inStock} low={stats?.low_stock_count ?? 0} out={stats?.out_of_stock_count ?? 0} />

          {levels.isLoading && <ItemsSkeleton />}
          {levels.isError && <ErrorState error={levels.error} onRetry={() => levels.refetch()} />}

          {!levels.isLoading && !levels.isError && rows.length === 0 && (
            <EmptyState
              title="No stock records"
              description="No balances match this filter at the selected branch."
              icon={<PackageX className="h-6 w-6" />}
              action={
                canAdjust ? (
                  <Button variant="outline" size="sm" onClick={() => openAdjust()}>
                    Post adjustment
                  </Button>
                ) : undefined
              }
            />
          )}

          {!levels.isLoading && !levels.isError && rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {rows.map((row) => (
                  <StockCard
                    key={row.id}
                    row={row}
                    canAdjust={canAdjust}
                    onAdjust={() => openAdjust(row.product_id)}
                  />
                ))}
              </div>
              <Pagination
                page={levels.data?.meta.current_page ?? page}
                lastPage={levels.data?.meta.last_page ?? 1}
                total={levels.data?.meta.total}
                totalLabel="records"
                isFetching={levels.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {segment === 'movements' && (
        <>
          <div className="flex items-center gap-2">
            <Select
              value={movementType}
              onValueChange={(value) => {
                setMovementsPage(1)
                setMovementType(value)
              }}
            >
              <SelectTrigger className="h-10 w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MOVEMENT_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {formatNumber(movements.data?.meta.total ?? 0)} events
            </span>
          </div>

          {movements.isLoading && <ItemsSkeleton rows={3} />}
          {movements.isError && <ErrorState error={movements.error} onRetry={() => movements.refetch()} />}

          {!movements.isLoading && !movements.isError && movementRows.length === 0 && (
            <EmptyState title="No movements" description="No stock movements for this filter." />
          )}

          {!movements.isLoading && !movements.isError && movementRows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <StatusBadge status={row.type} label={MOVEMENT_LABELS[row.type] ?? row.type} />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm">{row.product_name}</p>
                          {row.variant_name && (
                            <p className="truncate text-xs text-muted-foreground">{row.variant_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'font-semibold tabular-nums',
                          row.quantity < 0 ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {row.quantity > 0 ? `+${formatNumber(row.quantity)}` : formatNumber(row.quantity)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.reference || '—'}</TableCell>
                      <TableCell className="text-sm">{row.staff_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.happened_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={movements.data?.meta.current_page ?? movementsPage}
                lastPage={movements.data?.meta.last_page ?? 1}
                total={movements.data?.meta.total}
                totalLabel="movements"
                isFetching={movements.isFetching}
                onPageChange={setMovementsPage}
              />
            </>
          )}
        </>
      )}

      <ReconBanner
        damaged={stats?.damaged_count ?? 0}
        expired={stats?.expired_count ?? 0}
        canAdjust={canAdjust}
        onExport={exportCsv}
        onCycleCount={() => openAdjust()}
      />

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(barcode) => {
          setScannerOpen(false)
          setSegment('items')
          setPage(1)
          setSearch(barcode)
        }}
      />

      {adjustOpen && (
        <AdjustDialog
          open={adjustOpen}
          onClose={() => {
            setAdjustOpen(false)
            setAdjustProductId(undefined)
          }}
          branchId={branchId}
          initialProductId={adjustProductId}
        />
      )}
    </div>
  )
}

function TelemetryBar({
  branchName,
  node,
  syncing,
  onSync,
}: {
  branchName?: string | null
  node?: number
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-sunken px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-semibold text-foreground">{branchName ?? 'All branches'}</span>
            <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              Node #{String(node ?? 0).padStart(2, '0')}
            </span>
          </div>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {syncing ? 'Syncing inventory ledger…' : 'Ledger in-sync • live balances'}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onSync} disabled={syncing}>
        <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} /> Re-sync
      </Button>
    </div>
  )
}

function MetricMosaic({
  stats,
  inStock,
  healthPct,
  in24,
  out24,
  loading,
  errored,
}: {
  stats?: {
    total_sku: number
    total_units: number
    inventory_value: number
    low_stock_count: number
    out_of_stock_count: number
    damaged_count: number
    expired_count: number
  }
  inStock: number
  healthPct: number
  in24: number
  out24: number
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Stock Valuation</span>
          <Wallet className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2">
          <span className="block truncate font-mono text-base font-bold tabular-nums text-foreground">
            {dim ?? formatCurrency(stats?.inventory_value ?? 0)}
          </span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {loading ? '' : `${formatNumber(stats?.total_sku ?? 0)} SKUs • ${formatNumber(stats?.total_units ?? 0)} units`}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Health Index</span>
          <ShieldCheck className="h-4 w-4 text-success" />
        </div>
        <div className="mt-2">
          <span className="block truncate font-mono text-base font-bold tabular-nums text-success">
            {dim ?? `${healthPct}%`}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]">
            <span className="text-muted-foreground">{formatNumber(inStock)} in</span>
            <span className="text-warning">{formatNumber(stats?.low_stock_count ?? 0)} low</span>
            <span className="text-destructive">{formatNumber(stats?.out_of_stock_count ?? 0)} out</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Movement (24h)</span>
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-1 font-mono text-sm font-bold tabular-nums">
            <span className="text-destructive">-{formatNumber(out24)}</span>
            <span className="text-success">+{formatNumber(in24)}</span>
          </div>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">out / in last 24 hours</span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Shrinkage / Risk</span>
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <div className="mt-2">
          <span className="block truncate font-mono text-base font-bold tabular-nums text-warning">
            {dim ?? formatNumber((stats?.damaged_count ?? 0) + (stats?.expired_count ?? 0))}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {formatNumber(stats?.damaged_count ?? 0)} damaged • {formatNumber(stats?.expired_count ?? 0)} expired
          </span>
        </div>
      </div>
    </div>
  )
}

function QuickActions({
  canAdjust,
  onAdjust,
  onTransfer,
  onExpiry,
  onMovements,
}: {
  canAdjust: boolean
  onAdjust: () => void
  onTransfer: () => void
  onExpiry: () => void
  onMovements: () => void
}) {
  const actions = [
    ...(canAdjust
      ? [
          {
            label: '+ Stock Adjustment',
            icon: ArrowUpDown,
            onClick: onAdjust,
            tone: 'bg-primary/15 text-primary',
          },
        ]
      : []),
    { label: 'Transfer / Trace', icon: ArrowLeftRight, onClick: onTransfer, tone: 'text-foreground' },
    { label: 'Expiry Vault', icon: Snowflake, onClick: onExpiry, tone: 'text-foreground' },
    { label: 'Movement Log', icon: ClipboardList, onClick: onMovements, tone: 'text-foreground' },
  ]
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-sunken',
            action.tone,
          )}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </button>
      ))}
    </div>
  )
}

function SegmentTabs({
  value,
  itemsCount,
  movementsCount,
  onChange,
}: {
  value: Segment
  itemsCount?: number
  movementsCount?: number
  onChange: (value: Segment) => void
}) {
  const options: { value: Segment; label: string; count?: number }[] = [
    { value: 'items', label: 'Monitored Items', count: itemsCount },
    { value: 'movements', label: 'Movement Log', count: movementsCount },
  ]
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1">
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
              isActive ? 'bg-surface-elevated text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {formatNumber(option.count)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function StatusPills({
  active,
  counts,
  onChange,
}: {
  active: StatusFilter
  counts: Record<StatusFilter, number>
  onChange: (value: StatusFilter) => void
}) {
  const order: StatusFilter[] = ['all', 'in_stock', 'low', 'out_of_stock']
  const dot: Record<StatusFilter, string> = {
    all: 'bg-primary',
    in_stock: 'bg-success',
    low: 'bg-warning',
    out_of_stock: 'bg-destructive',
  }
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {order.map((key) => {
        const isActive = active === key
        const meta = STATUS_META[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive ? 'bg-primary/15 text-primary' : 'bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', dot[key])} />
            {meta.label}
            <span className={cn('font-mono text-[10px] tabular-nums', isActive ? 'text-primary/70' : 'text-muted-foreground')}>
              {formatNumber(counts[key])}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DistributionBar({ inStock, low, out }: { inStock: number; low: number; out: number }) {
  const total = Math.max(inStock + low + out, 1)
  const segments = [
    { label: 'In stock', value: inStock, color: 'bg-success' },
    { label: 'Low', value: low, color: 'bg-warning' },
    { label: 'Out', value: out, color: 'bg-destructive' },
  ]
  return (
    <div className="rounded-2xl border border-border bg-surface-sunken p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Package className="h-3.5 w-3.5 text-primary" /> Stock distribution
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-success">Ledger synced</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.color}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', segment.color)} />
            {segment.label}: {Math.round((segment.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function StockCard({
  row,
  canAdjust,
  onAdjust,
}: {
  row: StockLevel
  canAdjust: boolean
  onAdjust: () => void
}) {
  const tone =
    row.status === 'out_of_stock' ? 'text-destructive' : row.status === 'low' ? 'text-warning' : 'text-success'
  const statusLabel =
    row.status === 'out_of_stock' ? 'Out of Stock' : row.status === 'low' ? 'Low Stock Alert' : 'In Stock'
  const threshold = row.low_stock_threshold ?? null
  const target = Math.max(threshold ?? 0, 1) * 2
  const pct = Math.max(2, Math.min(100, Math.round((row.quantity / target) * 100)))
  const bar = row.status === 'out_of_stock' ? 'bg-destructive' : row.status === 'low' ? 'bg-warning' : 'bg-success'
  const valuation = row.valuation ?? row.quantity * (row.cost_price ?? 0)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface', tone)}>
            {stockGlyph(row.product_name, 'h-6 w-6')}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {row.sku || `#${row.product_id}`}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  row.status === 'out_of_stock'
                    ? 'bg-destructive/10 text-destructive'
                    : row.status === 'low'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-success/10 text-success',
                )}
              >
                {row.status === 'out_of_stock' ? (
                  <XCircle className="h-3 w-3" />
                ) : row.status === 'low' ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {statusLabel}
              </span>
              {row.category && <Badge variant="muted">{row.category}</Badge>}
            </div>
            <h3 className="mt-1 truncate text-sm font-bold text-foreground">{row.product_name}</h3>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {row.barcode ? `EAN: ${row.barcode}` : row.variant_name ?? row.brand ?? 'Unmapped'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn('block font-mono text-lg font-bold tabular-nums', tone)}>{formatNumber(row.quantity)}</span>
          <span className="block text-[10px] text-muted-foreground">{row.unit ?? 'units'}</span>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            Capacity {formatNumber(row.quantity)} / {formatNumber(target)}
          </span>
          <span className={cn('font-semibold', tone)}>
            {threshold != null ? `${pct}% • Reorder at ${formatNumber(threshold)}` : `${pct}% load`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-sunken p-2.5 font-mono text-[10px]">
        <div className="min-w-0">
          <span className="block text-muted-foreground">Branch / Unit:</span>
          <span className="block truncate text-foreground">{row.branch_name}</span>
          <span className="block truncate text-muted-foreground">{row.brand ?? row.unit ?? '—'}</span>
        </div>
        <div className="min-w-0 text-right">
          <span className="block text-muted-foreground">Valuation:</span>
          <span className="block truncate font-semibold text-foreground">{formatCurrency(valuation)}</span>
          <span className="block truncate text-muted-foreground">
            Cost {formatCurrency(row.cost_price ?? 0)} • Sell {formatCurrency(row.selling_price ?? 0)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        {canAdjust && (
          <Button variant="secondary" size="sm" className="flex-1" onClick={onAdjust}>
            <ArrowUpDown /> Adjust Qty
          </Button>
        )}
        {row.barcode ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              void navigator.clipboard?.writeText(row.barcode ?? '')
              toast.success('Barcode copied')
            }}
          >
            <Barcode /> Copy Code
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => toast.info(`${formatNumber(row.quantity)} ${row.unit ?? 'units'} on hand`)}
          >
            <History /> On Hand
          </Button>
        )}
      </div>
    </div>
  )
}

function ReconBanner({
  damaged,
  expired,
  canAdjust,
  onExport,
  onCycleCount,
}: {
  damaged: number
  expired: number
  canAdjust: boolean
  onExport: () => void
  onCycleCount: () => void
}) {
  const discrepancies = damaged + expired
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/10 text-success">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Daily Cycle Count</h3>
            <p className={cn('font-mono text-[10px]', discrepancies > 0 ? 'text-warning' : 'text-success')}>
              {discrepancies > 0 ? `${discrepancies} exceptions • review required` : '0 discrepancies • shift ready'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown /> Export CSV
        </Button>
      </div>
      {canAdjust && (
        <Button onClick={onCycleCount} className="w-full">
          <ScanLine /> Launch Cycle Count
        </Button>
      )}
    </div>
  )
}

function ItemsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function AdjustDialog({
  open,
  onClose,
  branchId,
  initialProductId,
}: {
  open: boolean
  onClose: () => void
  branchId: number | undefined
  initialProductId?: number
}) {
  const queryClient = useQueryClient()
  const branches = useAppStore((s) => s.branches)
  const [productId, setProductId] = useState<string>(initialProductId ? String(initialProductId) : '')
  const [branchIdState, setBranchIdState] = useState<string>(branchId ? String(branchId) : '')
  const [quantity, setQuantity] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  const { data: productsData } = useQuery({
    queryKey: ['products', { per_page: 50 }],
    queryFn: () => productsApi.list({ per_page: 50 }),
    placeholderData: (prev) => prev,
    enabled: open,
  })

  const products = (productsData?.data as Product[] | undefined) ?? []

  const { data: stockData } = useQuery({
    queryKey: ['inventory', 'product-stock', productId, branchIdState],
    queryFn: () =>
      inventoryApi.levels({
        product_id: Number(productId),
        branch_id: branchIdState ? Number(branchIdState) : undefined,
        per_page: 100,
      }),
    enabled: open && !!productId && !!branchIdState,
  })

  const currentStock = ((stockData?.data as StockLevel[] | undefined) ?? []).reduce(
    (sum, row) => sum + row.quantity,
    0,
  )

  const mutate = useMutation({
    mutationFn: (input: { product_id: number; branch_id: number; quantity: number; reason?: string }) =>
      inventoryApi.adjust({
        product_id: input.product_id,
        branch_id: input.branch_id,
        quantity: input.quantity,
        reason: input.reason,
      }),
    onSuccess: (res) => {
      toast.success(
        res.message ??
          (res.data?.status === 'pending'
            ? 'Adjustment submitted for approval.'
            : 'Stock adjusted'),
      )
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      onClose()
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not adjust stock')
    },
  })

  const handleSubmit = () => {
    if (!productId || !branchIdState || !quantity) return
    mutate.mutate({
      product_id: Number(productId),
      branch_id: Number(branchIdState),
      quantity: Number(quantity),
      reason: reason || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="adjust-product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="adjust-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.name} ({product.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-branch">Branch</Label>
            <Select value={branchIdState} onValueChange={setBranchIdState}>
              <SelectTrigger id="adjust-branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {productId && branchIdState && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-sunken px-3 py-2 text-sm">
              <span className="text-muted-foreground">Current stock</span>
              <span className="font-semibold tabular-nums">{stockData ? formatNumber(currentStock) : '…'}</span>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="adjust-qty">Quantity (negative for out)</Label>
            <Input
              id="adjust-qty"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Stock count adjustment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={mutate.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={mutate.isPending} disabled={mutate.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
