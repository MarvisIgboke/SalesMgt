import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  Copy,
  Cpu,
  Droplets,
  Factory,
  FileText,
  Layers,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  Truck,
  UserPlus,
  Wallet,
} from 'lucide-react'
import {
  suppliersApi,
  type Supplier,
  type SupplierFilter,
  type SupplierInput,
  type SupplierSummary,
} from '@/lib/api/endpoints/suppliers'
import { purchasingApi } from '@/lib/api/endpoints/purchasing'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate, formatNumber, formatRelative, initials, cn, debounce } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

type SupplierFormState = {
  name: string
  contact_name: string
  email: string
  phone: string
  address: string
}

const EMPTY_FORM: SupplierFormState = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
}

function toForm(supplier: Supplier): SupplierFormState {
  return {
    name: supplier.name,
    contact_name: supplier.contact_name ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    address: supplier.address ?? '',
  }
}

function toInput(form: SupplierFormState): SupplierInput {
  return {
    name: form.name.trim(),
    contact_name: form.contact_name.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
  }
}

const FILTER_OPTIONS: { value: SupplierFilter; label: string }[] = [
  { value: 'all', label: 'All Vendors' },
  { value: 'active', label: 'Active Suppliers' },
  { value: 'balance', label: 'With Balance' },
  { value: 'clear', label: 'Clear AP' },
  { value: 'new', label: 'New Vendors' },
]

interface SupplierState {
  chip: string
  dot: string
  bar: string
  stripe: string
  label: string
}

function supplierState(supplier: Supplier): SupplierState {
  if (supplier.outstanding_balance > 0) {
    return {
      chip: 'bg-warning/10 text-warning',
      dot: 'bg-warning',
      bar: 'bg-warning',
      stripe: 'bg-warning',
      label: 'Balance outstanding',
    }
  }
  if ((supplier.open_orders ?? 0) > 0) {
    return {
      chip: 'bg-info/10 text-info',
      dot: 'bg-info',
      bar: 'bg-info',
      stripe: 'bg-info',
      label: 'Orders in progress',
    }
  }
  if ((supplier.orders_count ?? 0) > 0) {
    return {
      chip: 'bg-success/10 text-success',
      dot: 'bg-success',
      bar: 'bg-success',
      stripe: 'bg-success',
      label: 'Account in good standing',
    }
  }
  return {
    chip: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
    bar: 'bg-muted-foreground',
    stripe: 'bg-muted-foreground',
    label: 'New vendor — no orders yet',
  }
}

const GLYPHS = [Building2, Truck, Factory, Package, Store, Droplets, Layers, FileText]

function vendorGlyph(index: number, className: string) {
  const Glyph = GLYPHS[index % GLYPHS.length]
  return <Glyph className={className} />
}

function kpiGlyph(kind: 'vendors' | 'ap' | 'volume' | 'inbound', className: string) {
  if (kind === 'vendors') return <Building2 className={className} />
  if (kind === 'ap') return <Wallet className={className} />
  if (kind === 'volume') return <ClipboardList className={className} />
  return <Truck className={className} />
}

export function SuppliersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const contextBranchName = useAppStore((s) => s.context?.branch?.name)
  const { canAny } = usePermissions()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<SupplierFilter>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM)
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null)
  const [contactSupplier, setContactSupplier] = useState<Supplier | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const canManage = canAny('purchases.create', 'purchases.approve', 'purchases.receive')

  const searchDebounced = useRef(
    debounce((value: string) => {
      setPage(1)
      setSearch(value)
    }, 350),
  )

  const listQuery = useQuery({
    queryKey: ['suppliers', { search, page, filter }],
    queryFn: () =>
      suppliersApi.list({
        search: search || undefined,
        filter: filter === 'all' ? undefined : filter,
        page,
        per_page: 12,
      }),
    placeholderData: (prev) => prev,
  })

  const summaryQuery = useQuery({
    queryKey: ['suppliers-summary'],
    queryFn: () => suppliersApi.summary(),
    refetchInterval: 30_000,
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const summary = summaryQuery.data?.data

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm(toForm(supplier))
    setEditorOpen(true)
  }

  const save = useMutation({
    mutationFn: (input: SupplierInput) =>
      editing ? suppliersApi.update(editing.id, input) : suppliersApi.create(input),
    onSuccess: () => {
      toast.success(editing ? 'Supplier updated' : 'Supplier onboarded')
      setEditorOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      void queryClient.invalidateQueries({ queryKey: ['suppliers-summary'] })
    },
    onError: (err) => {
      toast.error('Could not save supplier', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        branchName={contextBranchName ?? undefined}
        vendorCount={summary?.filters.all ?? meta?.total}
        syncing={summaryQuery.isFetching}
        onSync={() => {
          void summaryQuery.refetch()
          void listQuery.refetch()
        }}
      />

      <PageHeader
        eyebrow="Enterprise Hub"
        title="Suppliers & Vendors"
        description="AP ledger, inbound pipeline and vendor performance across the network."
      >
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <ShieldCheck className="h-3 w-3" />
          Verified
        </span>
      </PageHeader>

      <MetricGrid
        summary={summary}
        loading={summaryQuery.isLoading}
        errored={summaryQuery.isError}
      />

      <ActionBar
        canManage={canManage}
        onOnboard={openCreate}
        onCreatePo={() => {
          toast.info('Draft a purchase order on the Procurement Engine.')
          navigate('/purchasing')
        }}
        onAudit={() => setAuditOpen(true)}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={search}
            onChange={(event) => searchDebounced.current(event.target.value)}
            placeholder="Search vendor, contact or phone…"
            className="h-11 rounded-xl pl-10 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            VEND
          </span>
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Scan barcode"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills active={filter} counts={summary?.filters} onSelect={setFilter} />

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Directory Matrix
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {meta?.total !== undefined ? `${formatNumber(meta.total)} vendors` : 'Sorted by name'}
        </span>
      </div>

      {listQuery.isLoading && <DirectorySkeleton />}

      {!listQuery.isLoading && listQuery.isError && (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
        <EmptyState
          title="No suppliers found"
          description={
            search || filter !== 'all'
              ? 'Try a different search or filter.'
              : 'Onboard your first supplier to start tracking purchases and payables.'
          }
          icon={<Building2 className="h-6 w-6" />}
          action={
            canManage ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                New supplier
              </Button>
            ) : undefined
          }
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((supplier, index) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              index={index}
              canManage={canManage}
              onEdit={() => openEdit(supplier)}
              onLedger={() => setLedgerSupplier(supplier)}
              onContact={() => setContactSupplier(supplier)}
              onCreatePo={() => navigate(`/purchasing?supplier=${supplier.id}`)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total}
        totalLabel="suppliers"
        isFetching={listQuery.isFetching}
        onPageChange={setPage}
      />

      {summary && <GovernanceBanner summary={summary} />}

      {editorOpen && (
        <SupplierEditor
          supplier={editing}
          form={form}
          onChange={setForm}
          saving={save.isPending}
          onCancel={() => setEditorOpen(false)}
          onSave={() => save.mutate(toInput(form))}
        />
      )}

      {ledgerSupplier && (
        <LedgerDialog
          supplier={ledgerSupplier}
          onClose={() => setLedgerSupplier(null)}
        />
      )}

      {contactSupplier && (
        <ContactDialog
          supplier={contactSupplier}
          onClose={() => setContactSupplier(null)}
        />
      )}

      {auditOpen && <AuditDialog onClose={() => setAuditOpen(false)} />}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(value) => {
          setScannerOpen(false)
          setPage(1)
          setFilter('all')
          setSearch(value)
          toast.info(`Searching “${value}”`)
        }}
      />
    </div>
  )
}

function TelemetryBar({
  branchName,
  vendorCount,
  syncing,
  onSync,
}: {
  branchName?: string
  vendorCount?: number
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
          Supplier Ecosystem
        </span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
          {vendorCount !== undefined ? `${formatNumber(vendorCount)} vendors` : branchName ?? 'All Branches'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-muted-foreground sm:flex">
          <Cpu className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px]">LIVE SYNC</span>
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
  summary?: SupplierSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const cards: {
    kind: 'vendors' | 'ap' | 'volume' | 'inbound'
    label: string
    value: string | number
    sub: string
    subTone: string
    iconTone: string
  }[] = [
    {
      kind: 'vendors',
      label: 'Active Suppliers',
      value: dim ?? formatNumber(summary?.active_suppliers.count ?? 0),
      sub: (dim ?? '') || `${formatNumber(summary?.active_suppliers.with_orders ?? 0)} with orders booked`,
      subTone: 'text-primary',
      iconTone: 'bg-primary/10 text-primary',
    },
    {
      kind: 'ap',
      label: 'AP Ledger Outstanding',
      value: dim ?? formatCurrency(summary?.ap_outstanding.value ?? 0),
      sub: (dim ?? '') || `${formatNumber(summary?.ap_outstanding.count ?? 0)} suppliers with balances`,
      subTone: 'text-warning',
      iconTone: 'bg-warning/15 text-warning',
    },
    {
      kind: 'volume',
      label: 'Purchase Volume',
      value: dim ?? formatCurrency(summary?.purchases.value ?? 0),
      sub: (dim ?? '') || `${formatNumber(summary?.purchases.count ?? 0)} orders all-time`,
      subTone: 'text-success',
      iconTone: 'bg-success/15 text-success',
    },
    {
      kind: 'inbound',
      label: 'Inbound Logistics',
      value: dim ?? formatNumber(summary?.inbound.count ?? 0),
      sub: (dim ?? '') || `${formatCurrency(summary?.inbound.value ?? 0)} valued in transit`,
      subTone: 'text-info',
      iconTone: 'bg-info/15 text-info',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((card) => (
        <div
          key={card.kind}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5"
        >
          <div
            className={cn(
              'pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-lg',
              card.iconTone,
            )}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <span className={cn('grid h-6 w-6 place-items-center rounded', card.iconTone)}>
              {kpiGlyph(card.kind, 'h-3.5 w-3.5')}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">
            {card.value}
          </div>
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
  canManage,
  onOnboard,
  onCreatePo,
  onAudit,
}: {
  canManage: boolean
  onOnboard: () => void
  onCreatePo: () => void
  onAudit: () => void
}) {
  return (
    <div className="space-y-2">
      {canManage && (
        <button
          type="button"
          onClick={onOnboard}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Onboard New Supplier
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCreatePo}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <ClipboardList className="h-4 w-4 text-primary" />
          Create RFQ / PO
        </button>
        <button
          type="button"
          onClick={onAudit}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <FileText className="h-4 w-4 text-info" />
          Vendor Audit Log
        </button>
      </div>
    </div>
  )
}

function FilterPills({
  active,
  counts,
  onSelect,
}: {
  active: SupplierFilter
  counts?: SupplierSummary['filters']
  onSelect: (filter: SupplierFilter) => void
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTER_OPTIONS.map((option) => {
        const selected = active === option.value
        const count = counts?.[option.value]
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[10px]', selected ? 'bg-primary/15' : 'bg-surface-sunken')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SupplierCard({
  supplier,
  index,
  canManage,
  onEdit,
  onLedger,
  onContact,
  onCreatePo,
}: {
  supplier: Supplier
  index: number
  canManage: boolean
  onEdit: () => void
  onLedger: () => void
  onContact: () => void
  onCreatePo: () => void
}) {
  const state = supplierState(supplier)
  const vendorId = `#SPL-${String(supplier.id).padStart(3, '0')}`
  const lifetime = supplier.total_purchases
  const utilization =
    lifetime > 0 ? Math.min(100, Math.round((supplier.outstanding_balance / lifetime) * 100)) : 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', state.stripe)} aria-hidden />

      <div className="p-3.5 pt-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-sunken text-primary">
            {vendorGlyph(index, 'h-5 w-5')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {vendorId}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(lifetime)}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {formatNumber(supplier.orders_count ?? 0)} orders
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {supplier.outstanding_balance > 0 && (
                <Badge variant="warning">AP Balance</Badge>
              )}
              {(supplier.in_transit_count ?? 0) > 0 && (
                <Badge variant="info">{supplier.in_transit_count} in transit</Badge>
              )}
              {(supplier.orders_count ?? 0) > 0 ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="muted">New vendor</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border/70 bg-surface-sunken p-3">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contact &amp; Logistics
          </p>
          <div className="mt-1.5 grid gap-1 text-xs">
            <span className="flex items-center gap-2 text-foreground">
              <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{supplier.contact_name ?? 'No named contact'}</span>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{supplier.phone ?? 'No phone on file'}</span>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{supplier.email ?? 'No email on file'}</span>
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              AP Ledger Outstanding
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-foreground">
              {formatCurrency(supplier.outstanding_balance)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn('h-full rounded-full transition-all', state.bar)}
              style={{ width: `${utilization}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span className={state.chip}>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              <span className="align-middle text-muted-foreground">{state.label}</span>
            </span>
            <span>
              {lifetime > 0 ? `${utilization}% of lifetime` : 'No purchases yet'}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback>{initials(supplier.contact_name ?? supplier.name)}</AvatarFallback>
            </Avatar>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {supplier.last_order_at
                ? `Last order ${formatRelative(supplier.last_order_at)}`
                : 'No order history'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onLedger}>
                <Wallet className="h-4 w-4" />
                View ledger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onContact}>
                <Mail className="h-4 w-4" />
                Contact details
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit supplier
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={onCreatePo} disabled={!canManage}>
            Create PO
          </Button>
          <Button variant="outline" size="sm" onClick={onLedger}>
            Ledger
          </Button>
          <Button variant="outline" size="sm" onClick={onContact}>
            Contact
          </Button>
        </div>
      </div>
    </div>
  )
}

function GovernanceBanner({ summary }: { summary: SupplierSummary }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-success/30 bg-success/5">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          Supplier Governance &amp; Risk Health
        </span>
        <Badge variant="success">Auto-audited</Badge>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-success/20">
        <div className="p-3.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            AP Ledger Balance
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground">
            {formatCurrency(summary.ap_outstanding.value)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatNumber(summary.ap_outstanding.count)} suppliers owing
          </p>
        </div>
        <div className="p-3.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Invoices Due (14d)
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-foreground">
            {formatCurrency(summary.ap_due_14d.value)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatNumber(summary.ap_due_14d.count)} scheduled
          </p>
        </div>
      </div>
    </div>
  )
}

function DirectorySkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-2xl border border-border bg-surface-elevated p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="mt-3 h-16 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

interface SupplierEditorProps {
  supplier: Supplier | null
  form: SupplierFormState
  onChange: (form: SupplierFormState) => void
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

function SupplierEditor({ supplier, form, onChange, saving, onCancel, onSave }: SupplierEditorProps) {
  const set = (patch: Partial<SupplierFormState>) => onChange({ ...form, ...patch })

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit supplier' : 'Onboard new supplier'}</DialogTitle>
          <DialogDescription>
            Supplier records are stored server-side and returned from the API.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Name</Label>
            <Input
              id="supplier-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Grand Mills Ltd"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact">Contact name</Label>
            <Input
              id="supplier-contact"
              value={form.contact_name}
              onChange={(e) => set({ contact_name: e.target.value })}
              placeholder="Person to reach out to"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-phone">Phone</Label>
            <Input
              id="supplier-phone"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-email">Email</Label>
            <Input
              id="supplier-email"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="orders@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-address">Address</Label>
            <Input
              id="supplier-address"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street, city, state"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={onSave}>
            {supplier ? 'Save changes' : 'Create supplier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LedgerDialog({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const purchasesQuery = useQuery({
    queryKey: ['supplier-ledger', 'purchases', supplier.id],
    queryFn: () => suppliersApi.purchases(supplier.id, { per_page: 8 }),
  })

  const paymentsQuery = useQuery({
    queryKey: ['supplier-ledger', 'payments', supplier.id],
    queryFn: () => suppliersApi.payments(supplier.id, { per_page: 8 }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier.name}</DialogTitle>
          <DialogDescription>
            AP ledger — outstanding {formatCurrency(supplier.outstanding_balance)} across{' '}
            {formatNumber(supplier.orders_count ?? 0)} orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Purchase Orders
            </p>
            {purchasesQuery.isLoading && <Skeleton className="h-24 w-full" />}
            {purchasesQuery.isError && (
              <ErrorState error={purchasesQuery.error} onRetry={() => void purchasesQuery.refetch()} />
            )}
            {purchasesQuery.data && purchasesQuery.data.data.length === 0 && (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
                No purchase orders recorded.
              </p>
            )}
            <div className="space-y-1.5">
              {purchasesQuery.data?.data.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-sunken px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">{order.reference}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {order.expected_at ? `ETA ${formatDate(order.expected_at)}` : formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={order.status} />
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Payments Made
            </p>
            {paymentsQuery.isLoading && <Skeleton className="h-16 w-full" />}
            {paymentsQuery.data && paymentsQuery.data.data.length === 0 && (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
                No payments recorded yet.
              </p>
            )}
            <div className="space-y-1.5">
              {paymentsQuery.data?.data.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-sunken px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">
                      {payment.reference ?? payment.method ?? 'Payment'}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {formatDate(payment.created_at)}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-success">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContactDialog({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const rows: { label: string; value?: string | null; icon: typeof Phone }[] = [
    { label: 'Contact person', value: supplier.contact_name, icon: UserPlus },
    { label: 'Phone', value: supplier.phone, icon: Phone },
    { label: 'Email', value: supplier.email, icon: Mail },
    { label: 'Address', value: supplier.address, icon: MapPin },
  ]

  const copy = (value?: string | null) => {
    if (!value) return
    void navigator.clipboard?.writeText(value)
    toast.success('Copied to clipboard')
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier.name}</DialogTitle>
          <DialogDescription>
            Vendor since {formatDate(supplier.created_at, { year: 'numeric', month: 'short' })}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-sunken px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </p>
                  <p className="truncate text-sm text-foreground">{row.value ?? '—'}</p>
                </div>
              </div>
              {row.value && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Copy ${row.label}`}
                  onClick={() => copy(row.value)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AuditDialog({ onClose }: { onClose: () => void }) {
  const invoicesQuery = useQuery({
    queryKey: ['vendor-audit', 'invoices'],
    queryFn: () => purchasingApi.invoices({ per_page: 12 }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vendor Audit Log</DialogTitle>
          <DialogDescription>
            Recent supplier invoices and settlement status across the network.
          </DialogDescription>
        </DialogHeader>

        {invoicesQuery.isLoading && <Skeleton className="h-32 w-full" />}
        {invoicesQuery.isError && (
          <ErrorState error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} />
        )}
        {invoicesQuery.data && invoicesQuery.data.data.length === 0 && (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
            No supplier invoices recorded.
          </p>
        )}

        <div className="space-y-1.5">
          {invoicesQuery.data?.data.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-sunken px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">
                  {invoice.invoice_number ?? `#${invoice.id}`}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {invoice.supplier_name ?? 'Unassigned'}
                  {invoice.due_date ? ` • due ${formatDate(invoice.due_date)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={invoice.status} />
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
