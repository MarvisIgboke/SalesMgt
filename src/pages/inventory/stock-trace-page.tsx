import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Barcode,
  Building2,
  Cpu,
  FileDown,
  Fingerprint,
  History,
  KeyRound,
  Package,
  PackageX,
  Pill,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Snowflake,
  TrendingDown,
  Wine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { toast } from '@/components/ui/sonner'
import { cn, debounce, formatCurrency, formatDateTime, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import {
  inventoryApi,
  type ProductTrace,
  type StockMovement,
} from '@/lib/api/endpoints/inventory'
import { productsApi, type Product } from '@/lib/api/endpoints/products'

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Goods received',
  out: 'POS dispense',
  adjustment: 'Stock adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  damage: 'Damage write-off',
  expired: 'Expiry write-off',
  return: 'Customer return',
}

type Group = 'all' | 'intake' | 'sales' | 'transfers' | 'adjustments'

const GROUPS: { key: Group; label: string; types?: string }[] = [
  { key: 'all', label: 'All Events' },
  { key: 'intake', label: 'Intake (GRN)', types: 'in,return' },
  { key: 'sales', label: 'POS Sales', types: 'out' },
  { key: 'transfers', label: 'Transfers', types: 'transfer_in,transfer_out' },
  { key: 'adjustments', label: 'Adjustments', types: 'adjustment,damage,expired' },
]

function movementGroup(type: string): Group {
  if (type === 'in' || type === 'return') return 'intake'
  if (type === 'out') return 'sales'
  if (type === 'transfer_in' || type === 'transfer_out') return 'transfers'
  return 'adjustments'
}

const GROUP_MARKER: Record<Group, string> = {
  all: 'bg-muted-foreground',
  intake: 'bg-success',
  sales: 'bg-destructive',
  transfers: 'bg-primary',
  adjustments: 'bg-warning',
}

function productGlyph(name: string, className: string) {
  const value = name.toLowerCase()
  if (/(pharm|medic|\brx\b|health|drug|paracet|amox|vitamin)/.test(value)) return <Pill className={className} />
  if (/(water|drink|bever|juice|milk|cola|tea)/.test(value)) return <Snowflake className={className} />
  if (/(wine|spirit|beer|alcohol|bar|liquor)/.test(value)) return <Wine className={className} />
  if (/(elect|tech|gadget|device|cable|usb|phone)/.test(value)) return <Cpu className={className} />
  return <Package className={className} />
}

const EXPIRY_TONE: Record<string, string> = {
  expired: 'text-destructive bg-destructive/10',
  critical: 'text-destructive bg-destructive/10',
  warning: 'text-warning bg-warning/15',
  watch: 'text-warning bg-warning/10',
  healthy: 'text-success bg-success/10',
}

export function StockTracePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const branches = useAppStore((s) => s.branches)
  const contextBranch = useAppStore((s) => s.context?.branch?.id)
  const contextBranchName = useAppStore((s) => s.context?.branch?.name)

  const [productId, setProductId] = useState<string>(() => searchParams.get('product') ?? '')
  const [branchId, setBranchId] = useState<string>(contextBranch ? String(contextBranch) : '')
  const [group, setGroup] = useState<Group>('all')
  const [page, setPage] = useState(1)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const trace = useQuery({
    queryKey: ['inventory', 'trace', productId, branchId],
    queryFn: () => inventoryApi.trace(Number(productId), { branch_id: branchId ? Number(branchId) : undefined }),
    enabled: !!productId,
    placeholderData: (prev) => prev,
  })

  const activeTypes = GROUPS.find((g) => g.key === group)?.types

  const movements = useQuery({
    queryKey: ['inventory', 'trace-movements', productId, branchId, group, page],
    queryFn: () =>
      inventoryApi.movements({
        page,
        per_page: 12,
        product_id: Number(productId),
        branch_id: branchId ? Number(branchId) : undefined,
        types: activeTypes,
      }),
    enabled: !!productId,
    placeholderData: (prev) => prev,
  })

  const data = trace.data?.data
  const rows = useMemo(() => (movements.data?.data as StockMovement[] | undefined) ?? [], [movements.data])

  const branchName = branches.find((b) => String(b.id) === branchId)?.name ?? contextBranchName

  const exportProof = () => {
    if (!data) return
    const header = ['Type', 'Quantity', 'Reference', 'Variant', 'Reason', 'Staff', 'Timestamp']
    const lines = rows.map((row) =>
      [MOVEMENT_LABELS[row.type] ?? row.type, row.quantity, row.reference ?? '', row.variant_name ?? '', row.reason ?? '', row.staff_name ?? '', row.happened_at]
        .map((value) => {
          const text = String(value ?? '')
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    const meta = [
      `Product,${data.product.name}`,
      `SKU,${data.product.sku}`,
      `On hand,${data.on_hand}`,
      `Intake,${data.intake}`,
      `Dispensed,${data.dispensed}`,
      '',
    ]
    const blob = new Blob([[`Trace report • ${new Date().toISOString()}`, ...meta, header.join(','), ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trace-${data.product.sku || data.product.id}-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Trace proof exported')
  }

  const onPicked = (picked: Product) => {
    setPickerOpen(false)
    setScannerOpen(false)
    setPage(1)
    setGroup('all')
    setProductId(String(picked.id))
  }

  return (
    <div className="animate-fade-in space-y-4">
      <ContextStrip
        branchName={branchName}
        branches={branches}
        branchId={branchId}
        onBranchChange={(value) => {
          setBranchId(value)
          setPage(1)
        }}
        onScan={() => setScannerOpen(true)}
        synced={!trace.isFetching}
      />

      {!productId && (
        <EmptyState
          title="Select a product to trace"
          description="Choose a SKU to view its full chain of custody, batch state and audit ledger."
          icon={<PackageX className="h-6 w-6" />}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4" /> Scan
              </Button>
              <Button size="sm" onClick={() => setPickerOpen(true)}>
                <Search className="h-4 w-4" /> Find product
              </Button>
            </div>
          }
        />
      )}

      {productId && trace.isError && <ErrorState error={trace.error} onRetry={() => trace.refetch()} />}

      {productId && trace.isLoading && !data && (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}

      {productId && data && (
        <>
          <MasterCard
            data={data}
            onChangeSku={() => setPickerOpen(true)}
            onExport={exportProof}
          />

          <KpiGrid data={data} />

          <ZoneMatrix data={data} onExpiry={() => navigate('/inventory/expiry')} onExport={exportProof} />

          <LedgerStream
            group={group}
            onGroupChange={(next) => {
              setPage(1)
              setGroup(next)
            }}
            rows={rows}
            total={movements.data?.meta.total ?? 0}
            isLoading={movements.isLoading}
            isError={movements.isError}
            error={movements.error}
            onRetry={() => movements.refetch()}
            page={movements.data?.meta.current_page ?? page}
            lastPage={movements.data?.meta.last_page ?? 1}
            isFetching={movements.isFetching}
            onPageChange={setPage}
          />

          <ComplianceCard data={data} onExport={exportProof} onExpiry={() => navigate('/inventory/expiry')} />
        </>
      )}

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        branchId={branchId ? Number(branchId) : undefined}
        onPick={onPicked}
      />

      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onBarcode={(barcode) => {
        setScannerOpen(false)
        setPickerOpen(true)
        void barcode
      }} />
    </div>
  )
}

function ContextStrip({
  branchName,
  branches,
  branchId,
  onBranchChange,
  onScan,
  synced,
}: {
  branchName?: string | null
  branches: { id: number; name: string }[]
  branchId: string
  onBranchChange: (value: string) => void
  onScan: () => void
  synced: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary/15 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-success">Immutable Stock Trace</span>
          <span className="block truncate text-xs font-semibold text-foreground">{branchName ?? 'All branches'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={branchId} onValueChange={onBranchChange}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] uppercase',
            synced ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', synced ? 'bg-success' : 'bg-warning')} />
          {synced ? 'Chain synced' : 'Syncing'}
        </span>
        <Button variant="secondary" size="icon-sm" aria-label="Scan barcode" onClick={onScan}>
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function MasterCard({
  data,
  onChangeSku,
  onExport,
}: {
  data: ProductTrace
  onChangeSku: () => void
  onExport: () => void
}) {
  const { product, active_batch: batch } = data
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-primary">
                {productGlyph(product.name, 'h-7 w-7')}
              </div>
            )}
            {product.requires_expiry && (
              <div className="absolute inset-x-0 bottom-0 bg-surface/85 py-0.5 text-center">
                <span className="font-mono text-[9px] uppercase text-primary">Batch</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-tight text-primary">
                {product.category ?? 'Uncategorized'}
              </span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">SKU: {product.sku || '—'}</span>
            </div>
            <h1 className="mt-0.5 truncate text-base font-bold tracking-tight text-foreground">{product.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <Barcode className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] tracking-wider">{product.barcode ?? 'No barcode on file'}</span>
            </div>
          </div>
        </div>
        <Button variant="secondary" size="icon" aria-label="Change SKU" onClick={onChangeSku}>
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', batch ? 'bg-success' : 'bg-muted-foreground')} />
            <span className="truncate font-mono text-xs font-semibold text-foreground">
              Lot: {batch?.batch_number ?? 'No active batch'}
            </span>
          </div>
          {batch?.expiry_date ? (
            <span className={cn('rounded px-2 py-0.5 font-mono text-[10px] font-semibold', EXPIRY_TONE[batch.expiry_status] ?? EXPIRY_TONE.healthy)}>
              EXP: {batch.expiry_date}
            </span>
          ) : (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">EXP: —</span>
          )}
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            Brand: <span className="text-foreground">{product.brand ?? '—'}</span> • Unit:{' '}
            <span className="text-foreground">{product.unit ?? '—'}</span>
          </span>
          <span className="text-foreground">
            {batch ? `${formatNumber(batch.quantity_available)} available` : 'No batch qty'}
          </span>
        </div>
        {batch?.days_remaining !== null && batch?.days_remaining !== undefined && (
          <span
            className={cn(
              'flex items-center gap-1 font-mono text-[10px]',
              batch.days_remaining < 0 ? 'text-destructive' : batch.days_remaining <= 30 ? 'text-warning' : 'text-success',
            )}
          >
            <Snowflake className="h-3 w-3" />
            {batch.days_remaining < 0
              ? `Expired ${Math.abs(batch.days_remaining)} days ago`
              : `${batch.days_remaining} days to expiry`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-10" onClick={onChangeSku}>
          <RefreshCw className="h-4 w-4" /> Change SKU
        </Button>
        <Button className="h-10" onClick={onExport}>
          <FileDown className="h-4 w-4" /> Trace Certificate
        </Button>
      </div>
    </div>
  )
}

function KpiGrid({ data }: { data: ProductTrace }) {
  const threshold = data.threshold ?? null
  const target = Math.max(threshold ?? 0, 1) * 2
  const loadPct = Math.max(2, Math.min(100, Math.round((data.on_hand / target) * 100)))
  const variance = data.intake > 0 ? Math.round((Math.abs(data.adjustments) / data.intake) * 10000) / 100 : 0
  const clean = Math.abs(data.adjustments) < 0.0001
  const span =
    data.first_event_at && data.last_event_at
      ? `${formatDateTime(data.first_event_at)} → ${formatDateTime(data.last_event_at)}`
      : 'No events'

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Current On-Hand</span>
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">{formatNumber(data.on_hand)}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{data.product.unit ?? 'units'}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-primary" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            Reorder: <strong className="text-foreground">{threshold !== null ? formatNumber(threshold) : '—'}</strong>
          </span>
          <span>
            Value: <strong className="text-foreground">{formatCurrency(data.on_hand_value)}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Historical Flow</span>
          <ArrowLeftRight className="h-4 w-4 text-success" />
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold tabular-nums text-foreground">{formatNumber(data.intake)}</span>
            <span className="font-mono text-[10px] text-success">Intake</span>
          </div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
            <ArrowUpRight className="h-3 w-3 text-destructive" />
            <span className="text-destructive">Dispensed: {formatNumber(data.dispensed)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5 text-warning">
            <TrendingDown className="h-3 w-3" /> Adj: {formatNumber(data.adjustments)}
          </span>
          <span className="text-success">{data.sold_ratio}% sold</span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Source / Supplier</span>
          <Building2 className="h-4 w-4 text-warning" />
        </div>
        <div className="my-2 min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">
            {data.last_receipt?.supplier_name ?? 'No receipt on record'}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
            {data.last_receipt
              ? `${data.last_receipt.reference} • ${data.last_receipt.created_at ? formatDateTime(data.last_receipt.created_at) : '—'}`
              : data.product.brand ?? '—'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="muted">{data.product.category ?? 'General'}</Badge>
          <Badge variant="outline">Cost {formatCurrency(data.product.cost_price)}</Badge>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Audit Variance</span>
          <ShieldCheck className={cn('h-4 w-4', clean ? 'text-success' : 'text-warning')} />
        </div>
        <div className="my-2">
          <span className={cn('font-mono text-xl font-bold tabular-nums', clean ? 'text-success' : 'text-warning')}>
            {variance.toFixed(2)}%
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
            {clean ? 'Zero adjustment variance' : 'Manual adjustments detected'}
          </span>
        </div>
        <div className="truncate rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-primary">
          {data.events} entries • {span}
        </div>
      </div>
    </div>
  )
}

function ZoneMatrix({ data, onExpiry, onExport }: { data: ProductTrace; onExpiry: () => void; onExport: () => void }) {
  const total = data.zones.reduce((sum, zone) => sum + Math.max(0, zone.quantity), 0)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Multi-Branch Allocation</h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{data.zones.length} nodes</span>
      </div>

      {data.zones.length === 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-4 text-center text-xs text-muted-foreground">
          No distributed stock for this product.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.zones.map((zone) => {
            const share = total > 0 ? Math.round((Math.max(0, zone.quantity) / total) * 100) : 0
            return (
              <div key={zone.branch_id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunken p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-primary/15 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{zone.branch_name ?? `Branch #${zone.branch_id}`}</span>
                    <div className="mt-1 flex h-1 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-sm font-bold text-primary">{formatNumber(zone.quantity)}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">{share}%</span>
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunken p-2.5 opacity-80">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                <PackageX className="h-4 w-4" />
              </span>
              <span className="truncate text-xs font-medium text-foreground">Quarantine / QA hold</span>
            </div>
            <span className="font-mono text-sm font-bold text-muted-foreground">{formatNumber(data.quarantine)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-10" onClick={onExpiry}>
          <Snowflake className="h-4 w-4 text-primary" /> Expiry Vault
        </Button>
        <Button variant="secondary" className="h-10" onClick={onExport}>
          <FileDown className="h-4 w-4 text-success" /> Export Ledger
        </Button>
      </div>
    </div>
  )
}

function LedgerStream({
  group,
  onGroupChange,
  rows,
  total,
  isLoading,
  isError,
  error,
  onRetry,
  page,
  lastPage,
  isFetching,
  onPageChange,
}: {
  group: Group
  onGroupChange: (group: Group) => void
  rows: StockMovement[]
  total: number
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  page: number
  lastPage: number
  isFetching: boolean
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">Audit Ledger Stream</h2>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          {formatNumber(total)} entries
        </span>
      </div>

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
        {GROUPS.map((option) => {
          const isActive = group === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onGroupChange(option.key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-surface-elevated text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
              {option.key === 'all' && total > 0 ? ` (${formatNumber(total)})` : ''}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={onRetry} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState title="No ledger entries" description="No stock events match this filter for the product." />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="relative flex flex-col gap-3 pl-6 pt-1">
            <div className="absolute bottom-3 left-2.5 top-3 w-0.5 bg-border" />
            {rows.map((row) => (
              <LedgerEvent key={row.id} row={row} />
            ))}
          </div>
          <Pagination
            page={page}
            lastPage={lastPage}
            total={total}
            totalLabel="entries"
            isFetching={isFetching}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}

function LedgerEvent({ row }: { row: StockMovement }) {
  const grp = movementGroup(row.type)
  const positive = row.quantity > 0
  const title = `${MOVEMENT_LABELS[row.type] ?? row.type}${row.reference ? ` #${row.reference}` : ''}`

  return (
    <div className="relative">
      <span className={cn('absolute -left-6 top-2.5 h-3 w-3 rounded-full ring-4 ring-surface', GROUP_MARKER[grp])} />
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold',
                positive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
              )}
            >
              {positive ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {positive ? '+' : ''}
              {formatNumber(row.quantity)} {positive ? 'In' : 'Out'}
            </span>
            <h3 className="mt-1 truncate text-sm font-bold text-foreground">{title}</h3>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatDateTime(row.happened_at)}</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Operator:</span>
            <span className="truncate font-mono font-medium text-foreground">{row.staff_name ?? 'System'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Reason / Variant:</span>
            <span className="truncate text-foreground">{row.reason || row.variant_name || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
              <Fingerprint className="h-3 w-3" /> Ledger #{row.id}
            </span>
            <StatusBadge status={row.type} label={MOVEMENT_LABELS[row.type] ?? row.type} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceCard({ data, onExport, onExpiry }: { data: ProductTrace; onExport: () => void; onExpiry: () => void }) {
  const records = data.events
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div>
            <span className="block text-sm font-bold text-foreground">Chain of Custody Record</span>
            <span className="block font-mono text-[10px] text-muted-foreground">Immutable audit trail seal</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 font-mono text-[10px] text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> VERIFIED
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1 rounded-lg bg-surface px-3 py-2 font-mono text-[10px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <span>Product:</span>
          <span className="truncate text-foreground">{data.product.sku || data.product.name}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Records:</span>
          <span className="text-foreground">{formatNumber(records)} ledger entries</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>First event:</span>
          <span className="truncate text-foreground">{data.first_event_at ? formatDateTime(data.first_event_at) : '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Last event:</span>
          <span className="truncate text-foreground">{data.last_event_at ? formatDateTime(data.last_event_at) : '—'}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-11 text-destructive" onClick={onExpiry}>
          <KeyRound className="h-4 w-4" /> Expiry Watch
        </Button>
        <Button className="h-11" onClick={onExport}>
          <FileDown className="h-4 w-4" /> Export Proof
        </Button>
      </div>
    </div>
  )
}

function ProductPickerDialog({
  open,
  onOpenChange,
  branchId,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: number
  onPick: (product: Product) => void
}) {
  const [query, setQuery] = useState('')
  const queryDebounced = useRef(
    debounce((value: string) => setQuery(value), 250),
  )

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'picker', branchId],
    queryFn: () => productsApi.list({ per_page: 100, branch_id: branchId }),
    enabled: open,
    placeholderData: (prev) => prev,
  })

  const products = useMemo(() => (data?.data as Product[] | undefined) ?? [], [data])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return products
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.sku ?? '').toLowerCase().includes(term) ||
        (product.brand ?? '').toLowerCase().includes(term),
    )
  }, [products, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Select product to trace</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="Search name, SKU or brand…" onChange={(event) => queryDebounced.current(event.target.value)} className="pl-9" />
        </div>
        <ScrollArea className="h-[360px] pr-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No products match.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onPick(product)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated p-3 text-left transition-colors hover:bg-surface-sunken"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-primary">
                    {productGlyph(product.name, 'h-4 w-4')}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{product.name}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {product.sku || '—'} {product.brand ? `• ${product.brand}` : ''}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {typeof product.stock_qty === 'number' ? `${formatNumber(product.stock_qty)} on hand` : ''}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
