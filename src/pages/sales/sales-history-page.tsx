import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  Clock,
  Coins,
  Download,
  Eye,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingBasket,
  Store,
  Undo2,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  salesApi,
  type SaleDetail,
  type SaleListItem,
} from '@/lib/api/endpoints/sales'
import { shiftApi } from '@/lib/api/endpoints/shifts'
import { staffApi } from '@/lib/api/endpoints/staff'
import { productsApi } from '@/lib/api/endpoints/products'
import { departmentsApi } from '@/lib/api/endpoints/departments'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { formatCurrency, formatDateTime, formatNumber, cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'online', 'credit', 'split']
const STATUSES = ['completed', 'partially_refunded', 'refunded', 'cancelled', 'awaiting_approval']

const TONE = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
} as const

type Tone = keyof typeof TONE

const METHOD_META: Record<string, { label: string; tone: Tone }> = {
  cash: { label: 'Cash', tone: 'success' },
  bank_transfer: { label: 'Transfer', tone: 'primary' },
  transfer: { label: 'Transfer', tone: 'primary' },
  card: { label: 'Card', tone: 'info' },
  online: { label: 'Online', tone: 'info' },
  credit: { label: 'Credit', tone: 'warning' },
  split: { label: 'Split', tone: 'muted' },
}

function methodMeta(method: string) {
  return METHOD_META[method] ?? { label: method.replace(/_/g, ' '), tone: 'muted' as Tone }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function dayKey(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  if (key === today) return 'Today'
  if (key === dayKey(yesterdayDate.toISOString())) return 'Yesterday'
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeOnly(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function compactCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return formatCurrency(value, currency)
  }
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function exportCsv(rows: SaleListItem[]) {
  const header = [
    'Reference',
    'Date',
    'Customer',
    'Sales rep',
    'Items',
    'Payment methods',
    'Total',
    'Refunded',
    'Status',
  ]
  const body = rows.map((sale) => [
    sale.reference,
    formatDateTime(sale.created_at),
    sale.customer_name ?? 'Walk-in',
    sale.sales_rep,
    String(sale.item_count),
    (sale.payment_methods ?? []).map((m) => m.replace(/_/g, ' ')).join('; '),
    String(sale.total),
    String(sale.refunded_total),
    sale.status,
  ])
  const csv = [header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sales-history-${dayKey(new Date().toISOString())}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function SalesHistoryPage() {
  const context = useAppStore((s) => s.context)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [repId, setRepId] = useState('all')
  const [method, setMethod] = useState('all')
  const [productId, setProductId] = useState('all')
  const [departmentId, setDepartmentId] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<number | null>(null)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sales', { page, search, from, to, repId, method, productId, departmentId, status }],
    queryFn: () =>
      salesApi.list({
        page,
        per_page: 20,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        user_id: repId !== 'all' ? Number(repId) : undefined,
        payment_method: method !== 'all' ? method : undefined,
        product_id: productId !== 'all' ? Number(productId) : undefined,
        department_id: departmentId !== 'all' ? Number(departmentId) : undefined,
        status: status !== 'all' ? status : undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const reps = useQuery({
    queryKey: ['staff', { per_page: 100 }],
    queryFn: () => staffApi.list({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })

  const products = useQuery({
    queryKey: ['products', 'for-sale-filter'],
    queryFn: () => productsApi.list({ per_page: 200 }),
    placeholderData: (prev) => prev,
  })

  const departments = useQuery({
    queryKey: ['departments', 'for-sale-filter'],
    queryFn: () => departmentsApi.list(),
    placeholderData: (prev) => prev,
  })

  const shifts = useQuery({
    queryKey: ['shifts', 'open'],
    queryFn: () => shiftApi.history({ status: 'open', per_page: 100 }),
    retry: false,
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const meta = data?.meta
  const summary = meta?.summary
  const currency = rows[0]?.currency ?? 'NGN'
  const openShifts = shifts.data?.data ?? []
  const activeShift = openShifts[0]

  const groups = useMemo(() => {
    const map = new Map<string, SaleListItem[]>()
    for (const sale of rows) {
      const key = dayKey(sale.created_at)
      const bucket = map.get(key)
      if (bucket) bucket.push(sale)
      else map.set(key, [sale])
    }
    return Array.from(map.entries())
  }, [rows])

  const tenderAmounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const tender of summary?.tenders ?? []) map.set(tender.method, tender.amount)
    return map
  }, [summary])

  const resetFilters = () => {
    setPage(1)
    setSearch('')
    setFrom('')
    setTo('')
    setRepId('all')
    setMethod('all')
    setProductId('all')
    setDepartmentId('all')
    setStatus('all')
  }

  const hasFilters =
    search || from || to || repId !== 'all' || method !== 'all' || productId !== 'all' || departmentId !== 'all' || status !== 'all'

  const contextLabel = [
    activeShift ? `Shift #${activeShift.id}` : 'No open shift',
    method === 'all' ? 'All tenders' : methodMeta(method).label,
    context?.branch?.name ?? 'All branches',
  ].join(' · ')

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader
        title="Sales History & Logs"
        description="Every tape, tender and override captured at the point of sale."
      >
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-[11px]"
          disabled={!hasFilters}
          onClick={resetFilters}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </PageHeader>

      {/* Branch & operational shift ribbon */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent">
                <Store className="h-5 w-5 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {context?.branch?.name ?? 'All branches'}
                </p>
                <div className="flex items-center gap-1.5">
                  {activeShift ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-success">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                      </span>
                      Active Shift #{activeShift.id}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      No open shift
                    </span>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {context?.business.name}
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
              <Coins className="h-3 w-3" />
              {openShifts.length} {openShifts.length === 1 ? 'drawer' : 'drawers'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MetricTile
              label="Gross Ledger"
              value={formatCurrency(summary?.gross_total ?? 0, currency)}
              hint={`${formatNumber(summary?.count ?? meta?.total ?? 0)} records`}
              tone="success"
              icon={<Banknote className="h-4 w-4" />}
            />
            <MetricTile
              label="Tx Count"
              value={formatNumber(summary?.count ?? meta?.total ?? 0)}
              hint={summary ? 'filtered transactions' : 'matching sales'}
              tone="primary"
              icon={<ReceiptText className="h-4 w-4" />}
            />
            <MetricTile
              label="Avg Basket"
              value={formatCurrency(summary?.avg_total ?? 0, currency)}
              hint="average ticket value"
              tone="warning"
              icon={<ShoppingBasket className="h-4 w-4" />}
            />
            <MetricTile
              label="Voids & Returns"
              value={formatNumber(summary?.void_count ?? 0)}
              hint={`${formatCurrency(summary?.void_amount ?? 0, currency)} reversed`}
              tone="destructive"
              icon={<Undo2 className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Multi-facet filter console */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <SearchInput
            placeholder="Receipt #, customer, rep, SKU…"
            onSearch={(value) => {
              setPage(1)
              setSearch(value)
            }}
          />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 rounded-xl bg-surface px-3 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                Period
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="From date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    setPage(1)
                    setFrom(e.target.value)
                  }}
                  className="h-8 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  aria-label="To date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setPage(1)
                    setTo(e.target.value)
                  }}
                  className="h-8 border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                />
              </div>
            </div>

            <Select
              value={repId}
              onValueChange={(value) => {
                setPage(1)
                setRepId(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sales reps</SelectItem>
                {(reps.data?.data ?? []).map((rep) => (
                  <SelectItem key={rep.id} value={String(rep.id)}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Select
              value={productId}
              onValueChange={(value) => {
                setPage(1)
                setProductId(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
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

            <Select
              value={departmentId}
              onValueChange={(value) => {
                setPage(1)
                setDepartmentId(value)
              }}
            >
              <SelectTrigger>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="All departments" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(departments.data?.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatus(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
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

          {/* Tender chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <TenderChip active={method === 'all'} onClick={() => setMethod('all')}>
              All Tenders
            </TenderChip>
            {PAYMENT_METHODS.filter((m) => m !== 'split' || tenderAmounts.has('split')).map(
              (m) => {
                const amount = tenderAmounts.get(m) ?? 0
                const meta = methodMeta(m)
                return (
                  <TenderChip
                    key={m}
                    active={method === m}
                    dotClass={cn('bg-current', TONE[meta.tone])}
                    onClick={() => {
                      setPage(1)
                      setMethod(m)
                    }}
                  >
                    {meta.label}
                    {amount > 0 ? ` (${compactCurrency(amount, currency)})` : ''}
                  </TenderChip>
                )
              },
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
              Context: <span className="font-bold text-primary">{contextLabel}</span>
            </span>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-primary transition-colors hover:underline disabled:opacity-40"
            >
              Reset
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>

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
        <div className="flex flex-col gap-4">
          {groups.map(([key, groupRows]) => {
            const groupTotal = groupRows.reduce((sum, sale) => sum + sale.total, 0)
            return (
              <section key={key} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {dayLabel(key)}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-bold text-success">
                    {groupRows.length} {groupRows.length === 1 ? 'tape' : 'tapes'} •{' '}
                    {formatCurrency(groupTotal, currency)}
                  </span>
                </div>

                {groupRows.map((sale) => (
                  <SaleCard key={sale.id} sale={sale} currency={currency} onView={setSelected} />
                ))}
              </section>
            )
          })}

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="sales"
            isFetching={isFetching}
            onPageChange={setPage}
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[11px]"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset filters
            </Button>
            <Button
              size="sm"
              className="font-mono text-[11px]"
              disabled={rows.length === 0}
              onClick={() => {
                exportCsv(rows)
                toast.success(`Exported ${rows.length} sale${rows.length === 1 ? '' : 's'}`)
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      )}

      {selected !== null && (
        <SaleDetailSheet saleId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string
  hint: string
  tone: Tone
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl bg-surface p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('shrink-0', TONE[tone])}>{icon}</span>
      </div>
      <p
        className={cn(
          'mt-1 truncate text-lg font-bold tracking-tight',
          tone === 'destructive' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function TenderChip({
  active,
  dotClass,
  onClick,
  children,
}: {
  active: boolean
  dotClass?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold transition-colors active:scale-95',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-surface text-muted-foreground hover:text-foreground',
      )}
    >
      {!active && dotClass && <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />}
      {children}
    </button>
  )
}

function SaleCard({
  sale,
  currency,
  onView,
}: {
  sale: SaleListItem
  currency: string
  onView: (id: number) => void
}) {
  const isVoid = ['refunded', 'partially_refunded', 'cancelled'].includes(sale.status)
  const customer = sale.customer_name ?? 'Walk-in Guest'

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate font-mono text-xs font-bold tracking-wider',
              isVoid ? 'text-destructive' : 'text-primary',
            )}
          >
            {sale.reference}
          </span>
          {sale.branch_name && (
            <span className="truncate text-[11px] text-muted-foreground">{sale.branch_name}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {timeOnly(sale.created_at)}
          </span>
          <StatusBadge
            status={sale.status}
            label={sale.status.replace(/_/g, ' ')}
            className="font-mono text-[9px] uppercase tracking-wider"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-elevated px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-[10px] font-bold text-foreground">
            {initials(customer)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{customer}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              by {sale.sales_rep}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
          {sale.item_count} {sale.item_count === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Gross Ledger
          </span>
          <span className="font-mono text-sm font-bold text-foreground">
            {formatCurrency(sale.total, currency)}
          </span>
        </div>
        {sale.refunded_total > 0 && (
          <div className="flex items-center justify-between font-mono text-[10px] text-destructive">
            <span>Refunded</span>
            <span>-{formatCurrency(sale.refunded_total, currency)}</span>
          </div>
        )}
        {(sale.payment_methods ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {sale.payment_methods.map((m) => (
              <Badge key={m} variant="outline" className="font-mono text-[9px] capitalize">
                {m.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatDateTime(sale.created_at)}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-[10px]"
          onClick={() => onView(sale.id)}
        >
          <Eye className="h-3.5 w-3.5" />
          Inspect tape
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
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
