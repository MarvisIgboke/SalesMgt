import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  Cpu,
  FileDown,
  FolderPlus,
  FolderTree,
  Layers,
  MoreVertical,
  Package,
  Pencil,
  Pill,
  ScanLine,
  Search,
  Snowflake,
  Tags,
  Trash2,
  TrendingUp,
  Wine,
} from 'lucide-react'
import { catalogApi, type CatalogStat } from '@/lib/api/endpoints/products'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

type Segment = 'categories' | 'brands'
type TaxonomyFilter = 'all' | 'bound' | 'empty' | 'expiry'

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'categories', label: 'Categories & Trees' },
  { value: 'brands', label: 'Brand Portfolio' },
]

function labelFor(kind: Segment): string {
  return kind === 'categories' ? 'Category' : 'Brand'
}

function categoryGlyph(name: string, className: string) {
  const value = name.toLowerCase()
  if (/(pharm|medic|\brx\b|health|drug|clinic)/.test(value)) return <Pill className={className} />
  if (/(cold|frozen|dairy|fridge|chill|ice)/.test(value)) return <Snowflake className={className} />
  if (/(vault|spirit|wine|alcohol|bar|liquor|whisk)/.test(value)) return <Wine className={className} />
  if (/(elect|tech|gadget|device|computer)/.test(value)) return <Cpu className={className} />
  if (/(food|grocery|snack|bever|drink|water)/.test(value)) return <Package className={className} />
  return <FolderTree className={className} />
}

export function CatalogPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const branchName = useAppStore((s) => s.context?.branch?.name)

  const canManage = can('products.create') || can('products.edit')
  const canDelete = can('products.delete')

  const [segment, setSegment] = useState<Segment>('categories')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TaxonomyFilter>('all')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: number | null; kind: Segment; name: string } | null>(null)
  const [removing, setRemoving] = useState<{ id: number; kind: Segment; name: string } | null>(null)

  const overview = useQuery({
    queryKey: ['catalog', 'overview', { branchId }],
    queryFn: () => catalogApi.overview({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const categories = useMemo(() => overview.data?.data.categories ?? [], [overview.data])
  const brands = useMemo(() => overview.data?.data.brands ?? [], [overview.data])
  const metrics = overview.data?.data.metrics

  const source = segment === 'categories' ? categories : brands

  const counts = useMemo(
    () => ({
      all: source.length,
      bound: source.filter((item) => item.sku_count > 0).length,
      empty: source.filter((item) => item.sku_count === 0).length,
      expiry: segment === 'categories' ? source.filter((item) => item.expiry_count > 0).length : 0,
    }),
    [source, segment],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return source.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term)) return false
      if (filter === 'bound' && item.sku_count <= 0) return false
      if (filter === 'empty' && item.sku_count > 0) return false
      if (filter === 'expiry' && item.expiry_count <= 0) return false
      return true
    })
  }, [source, search, filter])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const save = useMutation({
    mutationFn: (input: { id: number | null; kind: Segment; name: string }) => {
      if (input.kind === 'categories') {
        return input.id
          ? catalogApi.updateCategory(input.id, input.name)
          : catalogApi.createCategory(input.name)
      }
      return input.id ? catalogApi.updateBrand(input.id, input.name) : catalogApi.createBrand(input.name)
    },
    onSuccess: (_result, input) => {
      toast.success(`${labelFor(input.kind)} ${input.id ? 'updated' : 'created'}`)
      setEditing(null)
      invalidate()
    },
    onError: (err) => {
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const remove = useMutation({
    mutationFn: (input: { id: number; kind: Segment }) =>
      input.kind === 'categories'
        ? catalogApi.deleteCategory(input.id)
        : catalogApi.deleteBrand(input.id),
    onSuccess: (_result, input) => {
      toast.success(`${labelFor(input.kind)} deleted`)
      setRemoving(null)
      invalidate()
    },
    onError: (err) => {
      toast.error('Could not delete', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const activeFilter = segment === 'categories' ? filter : filter === 'expiry' ? 'all' : filter

  return (
    <div className="animate-fade-in space-y-4">
      <TaxonomyHero
        branchName={branchName}
        node={branchId}
        onScan={() => setScannerOpen(true)}
      />

      <MetricsMosaic
        metrics={metrics}
        loading={overview.isLoading}
        errored={overview.isError}
      />

      <ActionRail
        canManage={canManage}
        onAddCategory={() => setEditing({ id: null, kind: 'categories', name: '' })}
        onAddBrand={() => setEditing({ id: null, kind: 'brands', name: '' })}
        onExport={() => {
          if (source.length === 0) {
            toast.error('Nothing to export')
            return
          }
          downloadCsv(segment, source)
        }}
      />

      <SegmentSwitcher
        value={segment}
        counts={{ categories: categories.length, brands: brands.length }}
        onChange={(next) => {
          setSegment(next)
          setFilter('all')
        }}
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              segment === 'categories'
                ? 'Search categories, tags, or tax codes…'
                : 'Search brands in the portfolio…'
            }
            className="h-11 rounded-xl pl-10 pr-12"
          />
          <button
            type="button"
            aria-label="Scan barcode"
            onClick={() => setScannerOpen(true)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-primary transition-colors hover:bg-muted"
          >
            <ScanLine className="h-4 w-4" />
          </button>
        </div>

        <FilterPills
          segment={segment}
          active={activeFilter}
          counts={counts}
          onChange={setFilter}
        />
      </div>

      {overview.isLoading && <CatalogSkeleton />}
      {overview.isError && <ErrorState error={overview.error} onRetry={() => overview.refetch()} />}

      {!overview.isLoading && !overview.isError && filtered.length === 0 && (
        <EmptyState
          title={source.length === 0 ? `No ${segment} yet` : 'Nothing matches'}
          description={
            source.length === 0
              ? `Add your first ${segment === 'categories' ? 'category' : 'brand'} to organise products.`
              : 'Adjust your search or filters to see more.'
          }
          icon={<Tags className="h-6 w-6" />}
          action={
            canManage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing({ id: null, kind: segment, name: '' })}
              >
                New {labelFor(segment).toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      )}

      {!overview.isLoading && !overview.isError && filtered.length > 0 && (
        <div className="space-y-3">
          {segment === 'categories'
            ? filtered.map((item) => (
                <CategoryCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  canDelete={canDelete}
                  onEdit={() => setEditing({ id: item.id, kind: 'categories', name: item.name })}
                  onDelete={() => setRemoving({ id: item.id, kind: 'categories', name: item.name })}
                  onProducts={() => navigate('/products')}
                />
              ))
            : filtered.map((item) => (
                <BrandCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  canDelete={canDelete}
                  onEdit={() => setEditing({ id: item.id, kind: 'brands', name: item.name })}
                  onDelete={() => setRemoving({ id: item.id, kind: 'brands', name: item.name })}
                />
              ))}
        </div>
      )}

      {metrics && (
        <UtilitiesCard
          label={segment === 'categories' ? 'Categories' : 'Brands'}
          count={source.length}
          onExport={() => {
            if (source.length === 0) {
              toast.error('Nothing to export')
              return
            }
            downloadCsv(segment, source)
          }}
        />
      )}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(barcode) => {
          setScannerOpen(false)
          setSearch(barcode)
        }}
      />

      {editing && (
        <TaxonomyDialog
          kind={editing.kind}
          id={editing.id}
          initialName={editing.name}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(name) => save.mutate({ id: editing.id, kind: editing.kind, name })}
        />
      )}

      {removing && (
        <Dialog open onOpenChange={() => setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {labelFor(removing.kind).toLowerCase()}</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{removing.name}</span> will be removed
                from the taxonomy. Products that referenced it stay intact but become uncategorised.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                loading={remove.isPending}
                onClick={() => remove.mutate({ id: removing.id, kind: removing.kind })}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function TaxonomyHero({
  branchName,
  node,
  onScan,
}: {
  branchName?: string | null
  node?: number
  onScan: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-success">
                Taxonomy engine
              </span>
              <span className="text-border">•</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Live sync
              </span>
            </div>
            <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Category &amp; Brand Catalog
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderTree className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-foreground">{branchName ?? 'All branches'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Node #{String(node ?? 0).padStart(2, '0')}
          </span>
          <Button variant="outline" size="sm" onClick={onScan}>
            <ScanLine /> Scan
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetricsMosaic({
  metrics,
  loading,
  errored,
}: {
  metrics?: {
    category_count: number
    brand_count: number
    sku_count: number
    valuation: number
    margin: number
    expiry_count: number
  }
  loading: boolean
  errored: boolean
}) {
  const show = (format: (v: number) => string, value: number | undefined) =>
    loading ? '—' : errored || value === undefined ? 'n/a' : format(value)

  const tiles = [
    {
      label: 'Categories',
      icon: FolderTree,
      tone: 'text-primary',
      value: show(formatNumber, metrics?.category_count),
      sub: loading ? '' : `${formatNumber(metrics?.brand_count ?? 0)} brands`,
    },
    {
      label: 'Managed Brands',
      icon: BadgeCheck,
      tone: 'text-success',
      value: show(formatNumber, metrics?.brand_count),
      sub: loading ? '' : `${formatNumber(metrics?.sku_count ?? 0)} SKUs bound`,
    },
    {
      label: 'Bound Catalog',
      icon: Package,
      tone: 'text-warning',
      value: show(formatNumber, metrics?.sku_count),
      sub: loading ? '' : `${formatCurrency(metrics?.valuation ?? 0)} valuation`,
    },
    {
      label: 'Target Margin',
      icon: TrendingUp,
      tone: 'text-primary',
      value: show((v) => `${v}%`, metrics?.margin),
      sub: loading ? '' : `${formatNumber(metrics?.expiry_count ?? 0)} expiry-tracked`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </span>
            <tile.icon className={cn('h-4 w-4 shrink-0', tile.tone)} />
          </div>
          <div className="mt-2">
            <span className={cn('block truncate font-mono text-xl font-bold tabular-nums', tile.tone)}>
              {tile.value}
            </span>
            {tile.sub && (
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{tile.sub}</span>
            )}
          </div>
          <span className="pointer-events-none absolute -bottom-4 -right-4 h-12 w-12 rounded-full bg-primary/5" />
        </div>
      ))}
    </div>
  )
}

function ActionRail({
  canManage,
  onAddCategory,
  onAddBrand,
  onExport,
}: {
  canManage: boolean
  onAddCategory: () => void
  onAddBrand: () => void
  onExport: () => void
}) {
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      <Button size="sm" onClick={onAddCategory} disabled={!canManage} className="shrink-0">
        <FolderPlus /> New Category
      </Button>
      <Button variant="secondary" size="sm" onClick={onAddBrand} disabled={!canManage} className="shrink-0">
        <Tags /> Add Brand
      </Button>
      <Button variant="ghost" size="sm" onClick={onExport} className="shrink-0">
        <FileDown /> Export
      </Button>
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
        <BadgeCheck className="h-3.5 w-3.5 text-success" /> Ledger synced
      </span>
    </div>
  )
}

function SegmentSwitcher({
  value,
  counts,
  onChange,
}: {
  value: Segment
  counts: { categories: number; brands: number }
  onChange: (value: Segment) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-sunken p-1">
      {SEGMENTS.map((item) => {
        const isActive = value === item.value
        const count = item.value === 'categories' ? counts.categories : counts.brands
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-surface-elevated text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="truncate">{item.label}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function FilterPills({
  segment,
  active,
  counts,
  onChange,
}: {
  segment: Segment
  active: TaxonomyFilter
  counts: { all: number; bound: number; empty: number; expiry: number }
  onChange: (value: TaxonomyFilter) => void
}) {
  const pills: { value: TaxonomyFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    {
      value: 'bound',
      label: segment === 'categories' ? 'With SKUs' : 'Bound',
      count: counts.bound,
    },
    {
      value: 'empty',
      label: segment === 'categories' ? 'Empty' : 'Unmapped',
      count: counts.empty,
    },
  ]
  if (segment === 'categories') {
    pills.push({ value: 'expiry', label: 'Expiry tracked', count: counts.expiry })
  }

  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {pills.map((pill) => {
        const isActive = active === pill.value
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onChange(pill.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            {pill.label}
            <span className={cn('font-mono text-[10px] tabular-nums', isActive ? 'text-primary/70' : 'text-muted-foreground')}>
              {pill.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CategoryCard({
  item,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onProducts,
}: {
  item: CatalogStat
  canManage: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  onProducts: () => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-primary">
            {categoryGlyph(item.name, 'h-5 w-5')}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-foreground">{item.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.expiry_count > 0 ? (
                <Badge variant="warning" className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {item.expiry_count} expiry-tracked
                </Badge>
              ) : (
                <Badge variant="muted">{item.sku_count} SKUs</Badge>
              )}
              {item.tax_rate !== null && <Badge variant="outline">{item.tax_rate}% tax</Badge>}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Category options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onProducts}>
              <Package className="h-4 w-4" /> View products
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="!text-destructive focus:!bg-destructive/10 focus:!text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-sunken p-2.5">
        <Metric label="SKU Count" value={`${formatNumber(item.sku_count)}`} tone="text-foreground" />
        <Metric label="Valuation" value={formatCurrency(item.valuation)} tone="text-warning" />
        <Metric
          label="Tgt. Margin"
          value={item.sku_count > 0 ? `${item.margin}%` : '—'}
          tone="text-success"
        />
      </div>

      <div className="rounded-xl bg-surface p-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <FolderTree className="h-3.5 w-3.5" />
            Bound products ({item.sku_count})
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="mt-2 space-y-1.5">
            {item.products.length === 0 ? (
              <p className="rounded-lg bg-surface-sunken px-2.5 py-2 text-xs text-muted-foreground">
                No products linked yet.
              </p>
            ) : (
              item.products.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-lg bg-surface-sunken px-2.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="truncate text-xs font-medium text-foreground">{name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-success" />
          {item.tax_rate !== null ? (
            <>
              Default: <strong className="font-mono text-foreground">{item.tax_rate}% VAT</strong>
            </>
          ) : (
            'No tax rule'
          )}
        </span>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onProducts}>
            <Package /> Products
          </Button>
        </div>
      </div>
    </div>
  )
}

function BrandCard({
  item,
  canManage,
  canDelete,
  onEdit,
  onDelete,
}: {
  item: CatalogStat
  canManage: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const tier =
    item.sku_count >= 5
      ? { label: 'Tier-1 Direct', variant: 'success' as const }
      : item.sku_count >= 2
        ? { label: 'Growth', variant: 'info' as const }
        : item.sku_count === 1
          ? { label: 'Standard', variant: 'muted' as const }
          : { label: 'Unmapped', variant: 'outline' as const }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-lg font-bold text-primary">
          {item.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">{item.name}</span>
            {item.sku_count > 0 && <BadgeCheck className="h-4 w-4 shrink-0 text-success" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="text-primary">{formatNumber(item.sku_count)} bound SKUs</span>
            <span>•</span>
            <span>{formatCurrency(item.valuation)}</span>
            {item.sku_count > 0 && (
              <>
                <span>•</span>
                <span>{item.margin}% margin</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={tier.variant} className="hidden sm:inline-flex">
          {tier.label}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Brand options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="!text-destructive focus:!bg-destructive/10 focus:!text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('mt-0.5 block truncate text-xs font-bold tabular-nums', tone)}>{value}</span>
    </div>
  )
}

function UtilitiesCard({
  label,
  count,
  onExport,
}: {
  label: string
  count: number
  onExport: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="flex items-center gap-2.5">
        <FolderTree className="h-5 w-5 text-muted-foreground" />
        <div>
          <span className="block text-sm font-semibold text-foreground">Taxonomy hygiene</span>
          <span className="block text-xs text-muted-foreground">
            {formatNumber(count)} {label.toLowerCase()} mapped across this branch
          </span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onExport}>
        <FileDown /> Export {label}
      </Button>
    </div>
  )
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function TaxonomyDialog({
  kind,
  id,
  initialName,
  saving,
  onClose,
  onSave,
}: {
  kind: Segment
  id: number | null
  initialName: string
  saving: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(initialName)
  const noun = labelFor(kind).toLowerCase()
  const valid = name.trim().length > 0

  const submit = () => {
    if (valid) onSave(name.trim())
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {id ? `Rename ${noun}` : `New ${noun}`}
          </DialogTitle>
          <DialogDescription>
            {kind === 'categories'
              ? 'Categories group products and drive catalog reporting.'
              : 'Brands group products for supplier and reporting insights.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="taxonomy-name">Name</Label>
          <Input
            id="taxonomy-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === 'categories' ? 'e.g. Cold Vault' : 'e.g. Nestle'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} disabled={!valid} onClick={submit}>
            {id ? 'Save changes' : `Create ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function downloadCsv(segment: Segment, items: CatalogStat[]) {
  const header = ['Name', 'SKU Count', 'Valuation', 'Margin %', 'Expiry Tracked', 'Tax %']
  const lines = items.map((item) =>
    [
      item.name,
      item.sku_count,
      item.valuation,
      item.margin,
      item.expiry_count,
      item.tax_rate ?? '',
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
  link.download = `${segment}-${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
