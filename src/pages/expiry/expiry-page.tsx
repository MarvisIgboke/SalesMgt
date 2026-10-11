import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  Clock,
  Copy,
  FileDown,
  History,
  Hourglass,
  PackagePlus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { toast } from '@/components/ui/sonner'
import { cn, debounce, formatCurrency, formatDate, formatNumber, formatRelative } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import {
  inventoryApi,
  type ExpiryBatch,
  type ExpiryRiskBucket,
  type ExpirySummary,
} from '@/lib/api/endpoints/inventory'

type BucketFilter = 'all' | ExpiryRiskBucket

interface BucketMeta {
  label: string
  short: string
  tone: string
  chip: string
  bar: string
}

const BUCKET_META: Record<ExpiryRiskBucket, BucketMeta> = {
  expired: {
    label: 'Expired',
    short: 'Expired',
    tone: 'text-destructive',
    chip: 'bg-destructive/20 text-destructive',
    bar: 'bg-destructive',
  },
  critical: {
    label: 'Critical <7d',
    short: '<7 Days',
    tone: 'text-destructive',
    chip: 'bg-destructive/20 text-destructive',
    bar: 'bg-destructive',
  },
  near: {
    label: 'Near <30d',
    short: '<30 Days',
    tone: 'text-warning',
    chip: 'bg-warning/20 text-warning',
    bar: 'bg-warning',
  },
  at_risk: {
    label: 'At Risk <90d',
    short: '<90 Days',
    tone: 'text-primary',
    chip: 'bg-primary/15 text-primary',
    bar: 'bg-primary',
  },
  stable: {
    label: 'Stable >90d',
    short: 'Stable',
    tone: 'text-success',
    chip: 'bg-success/15 text-success',
    bar: 'bg-success',
  },
}

function bucketIcon(bucket: ExpiryRiskBucket, className: string) {
  if (bucket === 'expired') return <XCircle className={className} />
  if (bucket === 'critical') return <AlertTriangle className={className} />
  if (bucket === 'near') return <Hourglass className={className} />
  if (bucket === 'at_risk') return <Clock className={className} />
  return <ShieldCheck className={className} />
}

function daysLabel(batch: ExpiryBatch): string {
  if (batch.days_remaining === null) return 'No expiry'
  if (batch.days_remaining < 0) return `Expired ${Math.abs(batch.days_remaining)}d ago`
  if (batch.days_remaining === 0) return 'Expires today'
  return `${batch.days_remaining}d remaining`
}

export function ExpiryPage() {
  const navigate = useNavigate()
  const branchId = useAppStore((s) => s.context?.branch?.id)

  const [bucket, setBucket] = useState<BucketFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [scannerOpen, setScannerOpen] = useState(false)

  const searchDebounced = useRef(
    debounce((value: string) => {
      setPage(1)
      setSearch(value)
    }, 350),
  )

  const batches = useQuery({
    queryKey: ['expiry', 'batches', { branchId, bucket, search, page }],
    queryFn: () =>
      inventoryApi.batches({
        page,
        per_page: 10,
        branch_id: branchId,
        search: search || undefined,
        bucket: bucket === 'all' ? undefined : bucket,
      }),
    placeholderData: (prev) => prev,
  })

  const rows = useMemo(() => batches.data?.data ?? [], [batches.data])
  const summary: ExpirySummary | undefined = batches.data?.meta.summary

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected])
  const selectedValue = selectedRows.reduce((sum, row) => sum + row.value, 0)

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportRows = (target: ExpiryBatch[]) => {
    if (target.length === 0) {
      toast.error('Nothing to export')
      return
    }
    const header = ['Product', 'SKU', 'Lot', 'EAN', 'Branch', 'Qty', 'Cost', 'Value', 'Expiry', 'Days', 'Bucket']
    const lines = target.map((row) =>
      [
        row.product_name,
        row.sku,
        row.batch_number ?? '',
        row.barcode ?? '',
        row.branch_name ?? '',
        row.quantity_available,
        row.cost_price,
        row.value,
        row.expiry_date ?? '',
        row.days_remaining ?? '',
        row.bucket,
      ]
        .map((value) => {
          const text = String(value ?? '')
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expiry-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${target.length} batch${target.length === 1 ? '' : 'es'}`)
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        updatedAt={batches.dataUpdatedAt}
        syncing={batches.isFetching}
        onSync={() => batches.refetch()}
      />

      <MetricGrid summary={summary} loading={batches.isLoading} errored={batches.isError} />

      <PolicyBanner />

      <ActionStrip
        onIntake={() => navigate('/purchasing')}
        onSweep={() => batches.refetch()}
        onQuarantine={() => {
          setPage(1)
          setBucket('expired')
        }}
        onInventory={() => navigate('/inventory')}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={search}
            onChange={(event) => searchDebounced.current(event.target.value)}
            placeholder="Search batch #, SKU, drug lot, barcodeâ€¦"
            className="h-11 rounded-xl pl-10 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            LOT
          </span>
        </div>
        <Button variant="secondary" size="icon" aria-label="Scan barcode" onClick={() => setScannerOpen(true)}>
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills
        active={bucket}
        summary={summary}
        onChange={(next) => {
          setPage(1)
          setBucket(next)
        }}
      />

      {summary && <DistributionBar summary={summary} />}

      {batches.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {batches.isError && <ErrorState error={batches.error} onRetry={() => batches.refetch()} />}

      {!batches.isLoading && !batches.isError && rows.length === 0 && (
        <EmptyState
          title="No batches in this view"
          description="No batches match the current urgency filter or search."
          icon={<Boxes className="h-6 w-6" />}
        />
      )}

      {!batches.isLoading && !batches.isError && rows.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <BatchCard
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
                onTrace={() => navigate(`/inventory/trace?product=${row.product_id}`)}
              />
            ))}
          </div>
          <Pagination
            page={batches.data?.meta.current_page ?? page}
            lastPage={batches.data?.meta.last_page ?? 1}
            total={batches.data?.meta.total}
            totalLabel="batches"
            isFetching={batches.isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {selected.size > 0 && (
        <SelectionDock
          count={selected.size}
          value={selectedValue}
          onExport={() => exportRows(selectedRows)}
          onClear={() => setSelected(new Set())}
        />
      )}

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
  updatedAt,
  syncing,
  onSync,
}: {
  updatedAt: number
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-primary" />
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
          Expiry Risk Engine â€¢ Automated Triage
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
          Sweep {updatedAt ? formatRelative(new Date(updatedAt)) : 'â€”'}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Re-sweep" onClick={onSync} disabled={syncing}>
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
  summary?: ExpirySummary
  loading: boolean
  errored: boolean
}) {
  const cards: { bucket: ExpiryRiskBucket; note: string }[] = [
    { bucket: 'critical', note: 'within 7 days' },
    { bucket: 'near', note: '8â€“30 days' },
    { bucket: 'at_risk', note: '31â€“90 days' },
    { bucket: 'expired', note: 'past expiry' },
  ]
  const dim = loading ? 'â€”' : errored ? 'n/a' : undefined

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map(({ bucket, note }) => {
        const meta = BUCKET_META[bucket]
        const stat = summary?.[bucket]
        return (
          <div key={bucket} className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
            <div className={cn('pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-lg', meta.chip)} />
            <div className="flex items-center justify-between">
              <span className={cn('flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider', meta.tone)}>
                {bucketIcon(bucket, 'h-3.5 w-3.5')} {meta.label}
              </span>
              <span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-medium', meta.chip)}>
                {dim ?? `${formatNumber(stat?.count ?? 0)} batches`}
              </span>
            </div>
            <div className={cn('mt-1.5 font-mono text-base font-bold tracking-tight', 'text-foreground')}>
              {dim ?? formatCurrency(stat?.value ?? 0)}
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1 font-mono text-[10px] text-muted-foreground">
              <span>{note}</span>
              <span>{loading ? '' : `${formatNumber(stat?.quantity ?? 0)} units`}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PolicyBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-elevated p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            FEFO Rotation Protocol Active
            <span className="h-2 w-2 rounded-full bg-success" />
          </span>
          <button
            type="button"
            onClick={() => toast.info('Policy thresholds are fixed by the FEFO engine')}
            className="shrink-0 font-mono text-[10px] uppercase text-primary hover:underline"
          >
            Policy
          </button>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          Rule: &lt;90d monitor â†’ &lt;30d priority FEFO â†’ &lt;7d urgent dispatch â†’ expired quarantine &amp; write-off.
        </p>
      </div>
    </div>
  )
}

function ActionStrip({
  onIntake,
  onSweep,
  onQuarantine,
  onInventory,
}: {
  onIntake: () => void
  onSweep: () => void
  onQuarantine: () => void
  onInventory: () => void
}) {
  const actions = [
    { label: '+ Intake Batch', icon: PackagePlus, onClick: onIntake, tone: 'bg-primary text-primary-foreground' },
    { label: 'Risk Sweep', icon: RefreshCw, onClick: onSweep, tone: 'text-foreground' },
    { label: 'Quarantine Log', icon: XCircle, onClick: onQuarantine, tone: 'text-destructive' },
    { label: 'Inventory Hub', icon: Boxes, onClick: onInventory, tone: 'text-foreground' },
  ]
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-colors active:scale-95',
            action.tone.includes('bg-primary') ? action.tone + ' border-transparent shadow-sm' : 'bg-surface-elevated hover:bg-surface-sunken ' + action.tone,
          )}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </button>
      ))}
    </div>
  )
}

function FilterPills({
  active,
  summary,
  onChange,
}: {
  active: BucketFilter
  summary?: ExpirySummary
  onChange: (bucket: BucketFilter) => void
}) {
  const order: BucketFilter[] = ['all', 'expired', 'critical', 'near', 'at_risk', 'stable']
  const countFor = (key: BucketFilter) =>
    key === 'all' ? summary?.all.count ?? 0 : summary?.[key].count ?? 0

  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {order.map((key) => {
        const isActive = active === key
        const meta = key === 'all' ? null : BUCKET_META[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-surface-elevated hover:bg-surface-sunken',
              !isActive && (meta?.tone ?? 'text-muted-foreground'),
            )}
          >
            {key === 'all' ? 'All Batches' : meta?.short}
            <span className={cn('font-mono text-[10px]', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              {formatNumber(countFor(key))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DistributionBar({ summary }: { summary: ExpirySummary }) {
  const order: ExpiryRiskBucket[] = ['expired', 'critical', 'near', 'at_risk', 'stable']
  const total = Math.max(summary.all.count, 1)
  return (
    <div className="rounded-2xl border border-border bg-surface-sunken p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Boxes className="h-3.5 w-3.5 text-primary" /> Shelf-life distribution
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{formatCurrency(summary.all.value)} at risk value</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {order.map((key) => (
          <div key={key} className={BUCKET_META[key].bar} style={{ width: `${(summary[key].count / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {order.map((key) => (
          <span key={key} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', BUCKET_META[key].bar)} />
            {BUCKET_META[key].short}: {formatNumber(summary[key].count)}
          </span>
        ))}
      </div>
    </div>
  )
}

function BatchCard({
  row,
  selected,
  onToggle,
  onTrace,
}: {
  row: ExpiryBatch
  selected: boolean
  onToggle: () => void
  onTrace: () => void
}) {
  const meta = BUCKET_META[row.bucket]
  const expired = row.bucket === 'expired'

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm', expired ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-surface-elevated')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider', meta.chip)}>
              {bucketIcon(row.bucket, 'h-3 w-3')} {expired ? `Expired ${formatDate(row.expiry_date)}` : `${meta.short} â€¢ ${daysLabel(row)}`}
            </span>
            {row.branch_name && <span className="font-mono text-[10px] text-muted-foreground">{row.branch_name}</span>}
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{row.product_name}</h3>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            SKU: {row.sku || 'â€”'} â€¢ Lot: {row.batch_number ?? 'â€”'}
            {row.barcode ? ` â€¢ EAN: ${row.barcode}` : ''}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Tag batch"
            className={cn(
              'grid h-14 w-14 place-items-center rounded-lg border text-center transition-colors',
              selected ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('font-mono text-sm font-bold', meta.tone)}>{formatNumber(row.quantity_available)}</span>
            <span className="font-mono text-[9px] uppercase">units</span>
          </button>
        </div>
      </div>

      <div className="my-2 grid grid-cols-3 gap-1 rounded-lg bg-surface-sunken p-2">
        <div>
          <span className="block font-mono text-[9px] uppercase text-muted-foreground">Stocked</span>
          <span className="block font-mono text-xs font-semibold text-foreground">{formatNumber(row.quantity_available)}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase text-muted-foreground">Unit Cost</span>
          <span className="block font-mono text-xs font-semibold text-foreground">{formatCurrency(row.cost_price)}</span>
        </div>
        <div className="text-right">
          <span className="block font-mono text-[9px] uppercase text-muted-foreground">Batch Value</span>
          <span className={cn('block font-mono text-xs font-bold', meta.tone)}>{formatCurrency(row.value)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken px-2.5 py-1.5 font-mono text-[10px]">
        <span className={cn('flex items-center gap-1 truncate', row.supplier_name ? 'text-primary' : 'text-muted-foreground')}>
          <Truck className="h-3.5 w-3.5" />
          {row.supplier_name ?? 'No supplier on file'}
        </span>
        <span className="shrink-0 text-muted-foreground">
          Exp {row.expiry_date ? formatDate(row.expiry_date) : 'â€”'} â€¢ {daysLabel(row)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-9" onClick={onTrace}>
          <History className="h-4 w-4" /> Stock Trace
        </Button>
        <Button
          variant="secondary"
          className="h-9"
          onClick={() => {
            void navigator.clipboard?.writeText(row.batch_number ?? row.sku ?? '')
            toast.success('Batch reference copied')
          }}
        >
          <Copy className="h-4 w-4" /> Copy Lot
        </Button>
      </div>
    </div>
  )
}

function SelectionDock({
  count,
  value,
  onExport,
  onClear,
}: {
  count: number
  value: number
  onExport: () => void
  onClear: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-2 lg:bottom-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/95 p-2.5 shadow-card backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/20 font-mono text-xs font-bold text-primary">
            {count}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-foreground">Batches Tagged</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground">Value: {formatCurrency(value)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={onExport}>
            <FileDown className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

