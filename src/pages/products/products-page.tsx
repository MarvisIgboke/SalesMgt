import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  CheckSquare,
  FileDown,
  History,
  Hourglass,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Snowflake,
  Square,
  Trash2,
  TrendingDown,
  Warehouse,
  X,
} from 'lucide-react'
import {
  catalogApi,
  productsApi,
  type Product,
  type ProductInput,
} from '@/lib/api/endpoints/products'
import { departmentsApi } from '@/lib/api/endpoints/departments'
import { inventoryApi } from '@/lib/api/endpoints/inventory'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { useAppStore } from '@/stores/app'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate, formatNumber, cn, debounce } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { usePermissions } from '@/lib/use-permissions'

type CatalogView = 'catalog' | 'categories' | 'brands'

const STOCK_META: Record<
  string,
  { label: string; dot: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }
> = {
  in_stock: { label: 'In Stock', dot: 'bg-success', variant: 'success' },
  low: { label: 'Low Stock', dot: 'bg-warning', variant: 'warning' },
  out_of_stock: { label: 'Out of Stock', dot: 'bg-destructive', variant: 'destructive' },
  untracked: { label: 'Not Stocked', dot: 'bg-muted-foreground', variant: 'muted' },
}

interface ProductFormState {
  name: string
  sku: string
  brand: string
  category: string
  unit: string
  department_id: number | null
  cost_price: string
  selling_price: string
  tax_rate: string
  requires_expiry: boolean
  expiry_date: string
  is_active: boolean
  barcodes: string
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  sku: '',
  brand: '',
  category: '',
  unit: '',
  department_id: null,
  cost_price: '',
  selling_price: '',
  tax_rate: '',
  requires_expiry: false,
  expiry_date: '',
  is_active: true,
  barcodes: '',
}

function toForm(product: Product): ProductFormState {
  return {
    name: product.name,
    sku: product.sku ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
    unit: product.unit ?? '',
    department_id: product.department_id ?? null,
    cost_price: product.cost_price ? String(product.cost_price) : '',
    selling_price: product.selling_price ? String(product.selling_price) : '',
    tax_rate: product.tax_rate != null ? String(product.tax_rate) : '',
    requires_expiry: product.requires_expiry,
    expiry_date: product.expiry_date ? product.expiry_date.slice(0, 10) : '',
    is_active: product.is_active,
    barcodes: '',
  }
}

function parseBarcodes(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function csvCell(value: string | number): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(rows: Product[]) {
  const header = [
    'Name',
    'SKU',
    'Brand',
    'Category',
    'Unit',
    'Cost',
    'Price',
    'Tax %',
    'Active',
    'Stock',
    'Status',
  ]
  const lines = rows.map((product) =>
    [
      product.name,
      product.sku,
      product.brand ?? '',
      product.category ?? '',
      product.unit ?? '',
      product.cost_price,
      product.selling_price,
      product.tax_rate ?? '',
      product.is_active ? 'yes' : 'no',
      product.stock_tracked ? product.stock_qty ?? 0 : '',
      product.stock_status ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  const blob = new Blob([[header.join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `products-${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const branchName = useAppStore((s) => s.context?.branch?.name)
  const { can } = usePermissions()
  const canCreate = can('products.create')
  const canEdit = can('products.edit')
  const canDelete = can('products.delete')

  const [view, setView] = useState<CatalogView>('catalog')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [scannerOpen, setScannerOpen] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [barcoding, setBarcoding] = useState<Product | null>(null)

  const dashboard = useQuery({
    queryKey: ['inventory', 'dashboard', { branchId }],
    queryFn: () => inventoryApi.dashboard({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', { search, page, branchId, category }],
    queryFn: () =>
      productsApi.list({
        search: search || undefined,
        category: category ?? undefined,
        page,
        per_page: 12,
        branch_id: branchId,
      }),
    placeholderData: (prev) => prev,
  })

  const categories = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: () => catalogApi.categories(),
    placeholderData: (prev) => prev,
  })

  const brands = useQuery({
    queryKey: ['products', 'brands'],
    queryFn: () => catalogApi.brands(),
    placeholderData: (prev) => prev,
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const meta = data?.meta
  const stats = dashboard.data?.data

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected])

  const remove = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Product deleted')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (err) => {
      toast.error('Could not delete product', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, is_active }: { ids: number[]; is_active: boolean }) => {
      for (const id of ids) {
        await productsApi.update(id, { is_active })
      }
      return ids.length
    },
    onSuccess: (count, variables) => {
      toast.success(
        `${count} ${count === 1 ? 'product' : 'products'} ${variables.is_active ? 'activated' : 'deactivated'}`,
      )
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Bulk update failed', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm(toForm(product))
    setEditorOpen(true)
  }

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const all = rows.length > 0 && rows.every((row) => prev.has(row.id))
      return all ? new Set() : new Set(rows.map((row) => row.id))
    })
  }

  const closeDialogs = () => {
    setEditorOpen(false)
    setBarcoding(null)
    setDeleting(null)
  }

  return (
    <div className="animate-fade-in space-y-4">
      <CatalogHeader
        branchName={branchName}
        canAdd={canCreate}
        onAdd={openCreate}
        onExport={() => {
          if (rows.length === 0) {
            toast.error('Nothing to export')
            return
          }
          downloadCsv(rows)
        }}
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface-elevated p-1">
        {(
          [
            { value: 'catalog', label: 'Catalog' },
            { value: 'categories', label: 'Categories' },
            { value: 'brands', label: 'Brands' },
          ] as { value: CatalogView; label: string }[]
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setView(item.value)}
            className={cn(
              'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
              view === item.value
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'catalog' && (
        <>
          <CatalogStats stats={stats} loading={dashboard.isLoading} errored={dashboard.isError} />

          <CatalogSearch
            onSearch={(value) => {
              setPage(1)
              setSearch(value)
            }}
            onScan={() => setScannerOpen(true)}
          />

          <CategoryChips
            categories={categories.data?.data ?? []}
            active={category}
            total={meta?.total}
            onChange={(value) => {
              setPage(1)
              setCategory(value)
            }}
          />

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                role="checkbox"
                aria-checked={selected.size > 0 && selected.size === rows.length}
                aria-label="Select all"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {rows.length > 0 && selected.size === rows.length ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Select all on screen
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {rows.length} / {formatNumber(meta?.total ?? 0)} shown
            </span>
          </div>

          {isLoading && <LoadingState rows={6} />}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !isError && rows.length === 0 && (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filters, or add a product."
              icon={<PackagePlus className="h-6 w-6" />}
              action={
                canCreate ? (
                  <Button variant="outline" size="sm" onClick={openCreate}>
                    New product
                  </Button>
                ) : undefined
              }
            />
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                {rows.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selected={selected.has(product.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onToggle={() => toggle(product.id)}
                    onEdit={() => openEdit(product)}
                    onStock={() => navigate('/inventory')}
                    onBarcodes={() => setBarcoding(product)}
                    onDelete={() => setDeleting(product)}
                  />
                ))}
              </div>

              <Pagination
                page={meta?.current_page ?? page}
                lastPage={meta?.last_page ?? 1}
                total={meta?.total}
                totalLabel="products"
                isFetching={isFetching}
                onPageChange={setPage}
              />
            </>
          )}

          {isFetching && !isLoading && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'categories' && (
        <TagPanel
          query={categories}
          title="No categories yet"
          description="Categories are created automatically when you tag a product."
          variant="secondary"
        />
      )}

      {view === 'brands' && (
        <TagPanel
          query={brands}
          title="No brands yet"
          description="Brands are created automatically when you tag a product."
          variant="outline"
        />
      )}

      {selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-card backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                {selectedRows.length}
              </span>
              <span className="text-xs font-medium text-foreground">selected</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkStatus.isPending}
                    onClick={() => bulkStatus.mutate({ ids: [...selected], is_active: false })}
                  >
                    <PackageX /> Deactivate
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={bulkStatus.isPending}
                    onClick={() => bulkStatus.mutate({ ids: [...selected], is_active: true })}
                  >
                    <CheckCircle2 /> Activate
                  </Button>
                </>
              )}
              <Button variant="success" size="sm" onClick={() => downloadCsv(selectedRows)}>
                <FileDown /> Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedRows.length > 0 && <div className="h-20" />}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(barcode) => {
          setScannerOpen(false)
          setPage(1)
          setCategory(null)
          setSearch(barcode)
        }}
      />

      {editorOpen && (
        <ProductEditorDialog
          product={editing}
          form={form}
          onChange={setForm}
          categories={categories.data?.data ?? []}
          brands={brands.data?.data ?? []}
          onClose={closeDialogs}
        />
      )}

      {barcoding && <BarcodesDialog product={barcoding} onClose={closeDialogs} />}

      {deleting && (
        <Dialog open onOpenChange={closeDialogs}>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Delete product</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{deleting.name}</span> will be
                permanently removed. History may keep references to it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                loading={remove.isPending}
                onClick={() => remove.mutate(deleting.id)}
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

function CatalogHeader({
  branchName,
  canAdd,
  onAdd,
  onExport,
}: {
  branchName?: string | null
  canAdd: boolean
  onAdd: () => void
  onExport: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-success">
              Catalogue
            </span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Products Catalog
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Warehouse className="h-3.5 w-3.5 shrink-0 text-primary" />
            Branch: <span className="truncate text-foreground">{branchName ?? 'All branches'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <FileDown /> CSV
          </Button>
          {canAdd && (
            <Button size="sm" onClick={onAdd}>
              <Plus /> Add Product
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CatalogStats({
  stats,
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
  loading: boolean
  errored: boolean
}) {
  const totalSku = stats?.total_sku ?? 0
  const low = stats?.low_stock_count ?? 0
  const out = stats?.out_of_stock_count ?? 0
  const inStock = Math.max(0, totalSku - low - out)
  const inStockPct = totalSku > 0 ? Math.round((inStock / totalSku) * 100) : 0

  const value = (n: number, format: (v: number) => string) =>
    loading ? '—' : errored ? 'n/a' : format(n)

  const tiles = [
    { label: 'Active SKUs', value: value(totalSku, formatNumber), tone: 'text-foreground' },
    { label: 'Low Stock', value: value(low, formatNumber), tone: 'text-warning' },
    { label: 'Valuation', value: value(stats?.inventory_value ?? 0, formatCurrency), tone: 'text-primary' },
  ]

  const kpis = [
    {
      icon: CheckCircle2,
      tone: 'text-success',
      value: loading ? '—' : errored ? 'n/a' : `${inStockPct}%`,
      sub: loading ? '' : `${formatNumber(inStock)} in stock`,
      label: 'In Stock',
    },
    {
      icon: TrendingDown,
      tone: 'text-warning',
      value: value(low, formatNumber),
      sub: 'Reorder',
      label: 'Low Level',
    },
    {
      icon: PackageX,
      tone: 'text-destructive',
      value: value(out, formatNumber),
      sub: 'Stockout',
      label: 'Zero',
    },
    {
      icon: Hourglass,
      tone: 'text-warning',
      value: value(stats?.expired_count ?? 0, formatNumber),
      sub: 'Expiring',
      label: '< 30d',
    },
  ]

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Boxes className="h-3.5 w-3.5 text-primary" /> Inventory health
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> Ledger synced
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-surface p-2.5">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </span>
            <span className={cn('mt-0.5 block truncate text-sm font-bold tabular-nums', tile.tone)}>
              {tile.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col items-center rounded-lg bg-surface p-2 text-center"
          >
            <span className={cn('flex items-center gap-1 font-mono text-[9px]', kpi.tone)}>
              <kpi.icon className="h-3.5 w-3.5" />
              {kpi.label}
            </span>
            <span className={cn('mt-0.5 text-sm font-bold tabular-nums', kpi.tone)}>{kpi.value}</span>
            {kpi.sub && (
              <span className="mt-0.5 truncate text-[9px] text-muted-foreground">{kpi.sub}</span>
            )}
          </div>
        ))}
      </div>

      {errored && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Inventory insights need the inventory.view permission.
        </p>
      )}
    </div>
  )
}

function CatalogSearch({
  onSearch,
  onScan,
}: {
  onSearch: (value: string) => void
  onScan: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useRef(debounce((value: string) => onSearch(value), 350))

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F2' || (event.key === '/' && !isTypingTarget(event.target))) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder="Search SKU, barcode, name, brand… [F2]"
        className="h-12 rounded-xl pl-10 pr-28"
        onChange={(event) => debounced.current(event.target.value)}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          F2
        </kbd>
        <Button variant="outline" size="sm" onClick={onScan}>
          <ScanLine /> Scan
        </Button>
      </div>
    </div>
  )
}

function CategoryChips({
  categories,
  active,
  total,
  onChange,
}: {
  categories: Array<{ id: number; name: string }>
  active: string | null
  total?: number
  onChange: (value: string | null) => void
}) {
  const chip = (label: string, value: string | null, count?: number) => {
    const isActive = active === value
    return (
      <button
        key={value ?? 'all'}
        type="button"
        onClick={() => onChange(value)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-surface-elevated text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        {count !== undefined && (
          <span
            className={cn(
              'rounded-full px-1.5 text-[10px] tabular-nums',
              isActive ? 'bg-primary-foreground/20' : 'bg-muted',
            )}
          >
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      {chip('All SKUs', null, total)}
      {categories.map((category) => chip(category.name, category.name))}
    </div>
  )
}

function ProductCard({
  product,
  selected,
  canEdit,
  canDelete,
  onToggle,
  onEdit,
  onStock,
  onBarcodes,
  onDelete,
}: {
  product: Product
  selected: boolean
  canEdit: boolean
  canDelete: boolean
  onToggle: () => void
  onEdit: () => void
  onStock: () => void
  onBarcodes: () => void
  onDelete: () => void
}) {
  const status = STOCK_META[product.stock_status ?? 'untracked'] ?? STOCK_META.untracked
  const threshold = product.low_stock_threshold ?? null
  const margin =
    product.selling_price > 0
      ? ((product.selling_price - product.cost_price) / product.selling_price) * 100
      : null
  const barcode = product.barcodes[0]

  return (
    <Card
      className={cn(
        'flex flex-col gap-3 p-4 transition-shadow hover:shadow-card-hover',
        selected && 'ring-1 ring-primary/50',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-border/70 bg-surface text-lg font-semibold text-muted-foreground">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              product.name.charAt(0).toUpperCase()
            )}
          </div>
          {product.requires_expiry && (
            <span className="absolute -bottom-1 -right-1 rounded bg-surface-sunken p-0.5" title="Expiry tracked">
              <Snowflake className="h-3.5 w-3.5 text-info" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[11px] text-primary">
              {product.sku || `#${product.id}`}
            </span>
            <Badge variant={status.variant} className="shrink-0 gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {status.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{product.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {barcode && (
              <>
                <span className="truncate font-mono">EAN {barcode}</span>
                <span>•</span>
              </>
            )}
            <span className="truncate">
              {product.category ?? 'Uncategorised'}
              {product.brand ? ` · ${product.brand}` : ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${product.name}`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {selected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
        </button>
      </div>

      <div className="rounded-lg bg-surface-sunken p-3">
        {product.stock_tracked ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                ON HAND:{' '}
                <strong className="text-sm font-semibold text-foreground">
                  {formatNumber(product.stock_qty ?? 0)} {product.unit ?? 'units'}
                </strong>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Reorder: {threshold ?? '—'}
              </span>
            </div>
            <StockBar qty={product.stock_qty ?? 0} threshold={threshold} />
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No inventory records at this branch yet.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted p-2 text-center">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Retail
          </span>
          <span className="text-xs font-semibold text-foreground">
            {formatCurrency(product.selling_price)}
          </span>
        </div>
        <div className="rounded-lg bg-muted p-2 text-center">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Cost
          </span>
          <span className="text-xs font-semibold text-foreground">
            {formatCurrency(product.cost_price)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          Tax: {product.tax_rate ? `${product.tax_rate}%` : '—'}
          {product.has_variants ? ` · ${product.variants?.length ?? 0} variants` : ''}
          {product.expiry_date ? ` · Exp ${formatDate(product.expiry_date)}` : ''}
        </span>
        {margin !== null && (
          <span className={cn('font-semibold', margin >= 0 ? 'text-success' : 'text-destructive')}>
            Margin: {margin.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 border-t border-border/60 pt-3">
        {canEdit ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 gap-1 px-1 text-[11px]"
              onClick={onEdit}
            >
              <Pencil /> Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 gap-1 px-1 text-[11px]"
              onClick={onBarcodes}
            >
              <Barcode /> Codes
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="col-span-3 h-9 gap-1 px-1 text-[11px]"
            onClick={onStock}
          >
            <History /> Stock movements
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-9 px-1 text-[11px]">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onStock}>
              <History className="h-4 w-4" />
              Stock movements
            </DropdownMenuItem>
            {barcode && (
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard?.writeText(barcode)
                  toast.success('Barcode copied')
                }}
              >
                <Barcode className="h-4 w-4" />
                Copy barcode
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="!text-destructive focus:!bg-destructive/10 focus:!text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}

function StockBar({ qty, threshold }: { qty: number; threshold: number | null }) {
  const target = Math.max(threshold ?? 0, 1) * 2
  const pct = Math.max(2, Math.min(100, Math.round((qty / target) * 100)))
  const color =
    qty <= 0 ? 'bg-destructive' : threshold !== null && qty <= threshold ? 'bg-warning' : 'bg-success'

  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TagPanel({
  query,
  title,
  description,
  variant,
}: {
  query: {
    isLoading: boolean
    isError: boolean
    error: unknown
    data?: { data: Array<{ id: number; name: string }> }
    refetch: () => void
  }
  title: string
  description: string
  variant: 'secondary' | 'outline'
}) {
  if (query.isLoading) return <LoadingState rows={4} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const items = query.data?.data ?? []
  if (items.length === 0) return <EmptyState title={title} description={description} />
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.id} variant={variant} className="px-3 py-1.5 text-sm">
          {item.name}
        </Badge>
      ))}
    </div>
  )
}

function ProductEditorDialog({
  product,
  form,
  onChange,
  categories,
  brands,
  onClose,
}: {
  product: Product | null
  form: ProductFormState
  onChange: (form: ProductFormState) => void
  categories: Array<{ id: number; name: string }>
  brands: Array<{ id: number; name: string }>
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const set = (patch: Partial<ProductFormState>) => onChange({ ...form, ...patch })

  const departmentsQuery = useQuery({
    queryKey: ['departments', { with_counts: false }],
    queryFn: () => departmentsApi.list(),
  })
  const departmentOptions = departmentsQuery.data?.data ?? []

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      product ? productsApi.update(product.id, input) : productsApi.create(input),
    onSuccess: () => {
      toast.success(product ? 'Product updated' : 'Product created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['pos'] })
    },
    onError: (err) => {
      toast.error('Could not save product', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const categoryOptions = uniqueOptions(form.category, categories)
  const brandOptions = uniqueOptions(form.brand, brands)
  const valid = form.name.trim().length > 0

  const submit = () => {
    const input: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      brand: form.brand || undefined,
      category: form.category || undefined,
      unit: form.unit.trim() || undefined,
      department_id: form.department_id,
      cost_price: form.cost_price ? Number(form.cost_price) : undefined,
      selling_price: form.selling_price ? Number(form.selling_price) : undefined,
      tax_rate: form.tax_rate ? Number(form.tax_rate) : null,
      requires_expiry: form.requires_expiry,
      expiry_date: form.expiry_date || null,
      is_active: form.is_active,
    }
    if (!product) input.barcodes = parseBarcodes(form.barcodes)
    save.mutate(input)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            Catalogue data lives on the backend. Pricing, tax and barcode validation are enforced
            by Laravel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Peak Milk 850g"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="Auto if empty"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-unit">Unit</Label>
              <Input
                id="product-unit"
                value={form.unit}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder="e.g. pack, kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set({ category: v === '__none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Brand</Label>
              <Select
                value={form.brand}
                onValueChange={(v) => set({ brand: v === '__none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {brandOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Department</Label>
            <Select
              value={form.department_id != null ? String(form.department_id) : '__none'}
              onValueChange={(v) => set({ department_id: v === '__none' ? null : Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {departmentOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sales reps can only sell products filed under their own department.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-cost">Cost (₦)</Label>
              <Input
                id="product-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.cost_price}
                onChange={(e) => set({ cost_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-price">Selling (₦)</Label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={(e) => set({ selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-tax">Tax rate %</Label>
              <Input
                id="product-tax"
                type="number"
                min={0}
                step="0.01"
                value={form.tax_rate}
                onChange={(e) => set({ tax_rate: e.target.value })}
                placeholder="e.g. 7.5"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Requires expiry tracking</p>
                <p className="text-xs text-muted-foreground">Batch/expiry enforced by the backend.</p>
              </div>
              <Switch
                checked={form.requires_expiry}
                onCheckedChange={(next) => set({ requires_expiry: next })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-xs text-muted-foreground">Hidden from POS when inactive.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(next) => set({ is_active: next })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-expiry">Expiry date</Label>
            <Input
              id="product-expiry"
              type="date"
              value={form.expiry_date}
              onChange={(e) => set({ expiry_date: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Drives the Expiry Manager. Leave blank for non-perishable items.
            </p>
          </div>

          {!product && (
            <div className="grid gap-2">
              <Label htmlFor="product-barcodes">Barcodes</Label>
              <Input
                id="product-barcodes"
                value={form.barcodes}
                onChange={(e) => set({ barcodes: e.target.value })}
                placeholder="One per line or comma separated"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!valid} onClick={submit}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BarcodesDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [barcode, setBarcode] = useState('')

  const add = useMutation({
    mutationFn: (value: string) => productsApi.addBarcode(product.id, value),
    onSuccess: () => {
      toast.success('Barcode added')
      setBarcode('')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Could not add barcode', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const remove = useMutation({
    mutationFn: (barcode: string | number) => productsApi.removeBarcode(product.id, barcode),
    onSuccess: () => {
      toast.success('Barcode removed')
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      toast.error('Could not remove barcode', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const submit = () => {
    const value = barcode.trim()
    if (!value) return
    add.mutate(value)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Barcodes — {product.name}</DialogTitle>
          <DialogDescription>Scan codes that map to this product in the backend.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {product.barcodes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No barcodes yet.
            </p>
          ) : (
            product.barcodes.map((code) => (
              <div
                key={code}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-2.5"
              >
                <span className="font-mono text-sm text-foreground">{code}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove.mutate(code)}
                  disabled={remove.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type a barcode"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <Button size="icon" onClick={submit} disabled={add.isPending || !barcode.trim()}>
              {add.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function uniqueOptions(current: string, options: Array<{ id: number; name: string }>) {
  const seen = new Set<string>()
  const result: Array<{ value: string; label: string }> = []
  const push = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push({ value: trimmed, label: trimmed })
    }
  }
  if (current && current !== '__none') push(current)
  for (const option of options) push(option.name)
  return result
}
