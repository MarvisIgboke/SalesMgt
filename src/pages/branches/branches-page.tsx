import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  Clock4,
  Cpu,
  Download,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Network,
  Package,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
  Trash2,
  Warehouse,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import {
  businessApi,
  type Branch,
  type BranchSummary,
  type BranchTypeCount,
  type Business,
} from '@/lib/api/endpoints/business'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

const ALL_FILTER = 'all'
const ACTIVE_FILTER = 'active'
const INACTIVE_FILTER = 'inactive'
const TYPE_PREFIX = 'type:'

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
}

function typeKey(type?: string | null): string {
  return (type ?? '').trim() || 'Unclassified'
}

function nodeLabel(branch: Branch): string {
  if (branch.code) return branch.code.toUpperCase()
  return `NODE-${String(branch.id).padStart(2, '0')}`
}

function nodeIcon(type: string | undefined | null, className: string) {
  const value = (type ?? '').toLowerCase()
  if (value.includes('express')) return <Zap className={className} />
  if (value.includes('warehouse') || value.includes('vault')) return <Warehouse className={className} />
  if (value.includes('pharmacy')) return <Pill className={className} />
  if (value.includes('outlet') || value.includes('mall')) return <Store className={className} />
  return <Building2 className={className} />
}

function metricGlyph(kind: 'branches' | 'gmv' | 'tills' | 'vault', className: string) {
  if (kind === 'branches') return <Network className={className} />
  if (kind === 'gmv') return <Package className={className} />
  if (kind === 'tills') return <Store className={className} />
  return <Warehouse className={className} />
}

interface FilterOption {
  key: string
  label: string
  count: number
  tone?: 'success'
}

function buildFilters(summary: BranchSummary | undefined): FilterOption[] {
  if (!summary) return []
  const options: FilterOption[] = [
    { key: ALL_FILTER, label: 'All Branches', count: summary.nodes.total },
  ]
  summary.nodes.by_type.forEach((row: BranchTypeCount) => {
    options.push({
      key: `${TYPE_PREFIX}${typeKey(row.type)}`,
      label: titleCase(typeKey(row.type)),
      count: row.count,
    })
  })
  options.push({ key: ACTIVE_FILTER, label: 'Operational', count: summary.nodes.active, tone: 'success' })
  if (summary.nodes.inactive > 0) {
    options.push({ key: INACTIVE_FILTER, label: 'Offline', count: summary.nodes.inactive })
  }
  return options
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function BranchesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const isSuperAdmin = session?.user.roles.includes('Super Admin') ?? false
  const { can } = usePermissions()
  const canManage = can('staff.edit') || isSuperAdmin

  const context = useAppStore((s) => s.context)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(ALL_FILTER)
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const businesses = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessApi.listBusinesses(),
    enabled: isSuperAdmin,
  })

  const businessList = businesses.data?.data ?? []
  const activeBusinessId = isSuperAdmin
    ? (selectedBusinessId ?? context?.business.id ?? businessList[0]?.id ?? null)
    : undefined

  const summaryQuery = useQuery({
    queryKey: ['branch-summary', { business_id: activeBusinessId }],
    queryFn: () => businessApi.branchSummary({ business_id: activeBusinessId }),
    refetchInterval: 30_000,
  })

  const summary = summaryQuery.data?.data
  const branches = summary?.branches ?? []

  const term = search.trim().toLowerCase()
  const visible = branches.filter((branch) => {
    if (filter === ACTIVE_FILTER && !branch.is_active) return false
    if (filter === INACTIVE_FILTER && branch.is_active) return false
    if (filter.startsWith(TYPE_PREFIX) && typeKey(branch.type) !== filter.slice(TYPE_PREFIX.length)) {
      return false
    }
    if (!term) return true
    return [branch.name, branch.code, branch.address, branch.manager, branch.type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  const filters = buildFilters(summary)

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['branch-summary'] })
    void queryClient.invalidateQueries({ queryKey: ['branches'] })
    void useAppStore.getState().loadContext(session ?? undefined)
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (branch: Branch) => {
    setEditing(branch)
    setDialogOpen(true)
  }

  const exportZReport = () => {
    if (branches.length === 0) {
      toast.info('Nothing to export yet')
      return
    }
    const rows: string[][] = [
      ['Branch', 'Code', 'Type', 'Manager', 'Status', "Today's Sales", 'Stock Value', 'Open Tills', 'Variance'],
      ...branches.map((branch) => [
        branch.name,
        branch.code ?? '',
        branch.type ?? '',
        branch.manager ?? 'Unassigned',
        branch.is_active ? 'Active' : 'Inactive',
        String(branch.today_sales ?? 0),
        String(branch.stock_value ?? 0),
        String(branch.open_tills ?? 0),
        String(branch.variance ?? 0),
      ]),
    ]
    downloadCsv('z-report-branches.csv', rows)
    toast.success('Z-report exported')
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        businessName={context?.business.name}
        nodeCount={summary?.nodes.total}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <PageHeader
        eyebrow="Network Operations"
        title="Branches & Stores"
        description="Multi-store telemetry, till health and inventory value across the network."
      >
        {isSuperAdmin && (
          <Select
            value={activeBusinessId != null ? String(activeBusinessId) : undefined}
            onValueChange={(value) => {
              setSelectedBusinessId(Number(value))
              setFilter(ALL_FILTER)
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select business" />
            </SelectTrigger>
            <SelectContent>
              {businessList.map((business) => (
                <SelectItem key={business.id} value={String(business.id)}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      <MetricGrid summary={summary} loading={summaryQuery.isLoading} errored={summaryQuery.isError} />

      <ActionBar
        canManage={canManage}
        onProvision={openCreate}
        onPriceSync={() => {
          toast.info('Opening the catalog for a global price sync.')
          navigate('/catalog')
        }}
        onTransfer={() => navigate('/inventory')}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search branch, code, location or manager…"
            className="h-11 rounded-xl pl-10 pr-10"
          />
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Scan to locate branch"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills options={filters} active={filter} onSelect={setFilter} />

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Branch Node Matrix
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatNumber(visible.length)} of {formatNumber(summary?.nodes.total ?? 0)} nodes
        </span>
      </div>

      {summaryQuery.isLoading && <DirectorySkeleton />}

      {!summaryQuery.isLoading && summaryQuery.isError && (
        <ErrorState error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length === 0 && (
        <EmptyState
          title="No branches found"
          description={
            search || filter !== ALL_FILTER
              ? 'Try a different search or filter.'
              : 'Provision your first branch to start tracking stock and sales by location.'
          }
          icon={<Building2 className="h-6 w-6" />}
          action={
            canManage ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Provision branch
              </Button>
            ) : undefined
          }
        />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              canManage={canManage}
              isSuperAdmin={isSuperAdmin}
              onDashboard={() => navigate('/dashboard')}
              onRoster={() => navigate('/shifts')}
              onStock={() => navigate('/inventory')}
              onEdit={() => openEdit(branch)}
              onDelete={() => setDeleting(branch)}
            />
          ))}
        </div>
      )}

      {summary && (
        <GovernanceFooter
          summary={summary}
          onTax={() => navigate('/settings')}
          onExport={exportZReport}
        />
      )}

      {dialogOpen && (
        <BranchDialog
          branch={editing}
          businesses={businessList}
          isSuperAdmin={isSuperAdmin}
          defaultBusinessId={activeBusinessId ?? null}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}

      {deleting && (
        <DeleteBranchDialog branch={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
      )}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(value) => {
          setScannerOpen(false)
          setSearch(value)
          toast.info(`Searching "${value}"`)
        }}
      />
    </div>
  )
}

function TelemetryBar({
  businessName,
  nodeCount,
  syncing,
  onSync,
}: {
  businessName?: string
  nodeCount?: number
  syncing: boolean
  onSync: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-secondary">
            Multi-Store Network
          </span>
          <span className="hidden text-muted-foreground sm:inline">•</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            {nodeCount !== undefined ? `${formatNumber(nodeCount)} locations` : 'Omnichannel fabric'}
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
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Network className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Cluster:
          </span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            {businessName ?? 'All businesses'} • PROD-WEST-1
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricGrid({
  summary,
  loading,
  errored,
}: {
  summary?: BranchSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const activeShare =
    summary && summary.nodes.total > 0
      ? Math.round((summary.nodes.active / summary.nodes.total) * 100)
      : 0

  const cards: {
    kind: 'branches' | 'gmv' | 'tills' | 'vault'
    label: string
    value: string
    sub: string
    subTone: string
    iconTone: string
    footer: [string, string]
  }[] = [
    {
      kind: 'branches',
      label: 'Active Branches',
      value: dim ?? `${summary?.nodes.active ?? 0} / ${summary?.nodes.total ?? 0}`,
      sub: dim ?? `${activeShare}% operational`,
      subTone: 'text-success',
      iconTone: 'bg-success/15 text-success',
      footer:
        summary && summary.nodes.by_type.length > 0
          ? [
              `${titleCase(typeKey(summary.nodes.by_type[0]?.type))} ×${summary.nodes.by_type[0]?.count ?? 0}`,
              summary.nodes.by_type[1]
                ? `${titleCase(typeKey(summary.nodes.by_type[1]?.type))} ×${summary.nodes.by_type[1]?.count ?? 0}`
                : '',
            ]
          : ['', ''],
    },
    {
      kind: 'gmv',
      label: '24h Network GMV',
      value: dim ?? formatCurrency(summary?.gmv_24h.value ?? 0),
      sub: dim ?? `${formatNumber(summary?.gmv_24h.orders ?? 0)} orders settled`,
      subTone: 'text-primary',
      iconTone: 'bg-primary/10 text-primary',
      footer: [
        `${formatNumber(summary?.gmv_24h.orders ?? 0)} orders`,
        `Avg ${formatCurrency(summary?.gmv_24h.average ?? 0)}`,
      ],
    },
    {
      kind: 'tills',
      label: 'Unified Fleet Tills',
      value: dim ?? `${formatNumber(summary?.registers.open ?? 0)} Open`,
      sub:
        dim ??
        ((summary?.registers.variance ?? 0) === 0
          ? '₦0.00 variance logged'
          : `${formatCurrency(summary?.registers.variance ?? 0)} variance`),
      subTone: (summary?.registers.variance ?? 0) < 0 ? 'text-warning' : 'text-success',
      iconTone: 'bg-info/15 text-info',
      footer: [
        `${formatNumber(summary?.registers.branches ?? 0)} branches live`,
        'Shift ledger',
      ],
    },
    {
      kind: 'vault',
      label: 'Vault & Inventory',
      value: dim ?? formatCurrency(summary?.inventory.value ?? 0),
      sub: dim ?? `${formatNumber(summary?.inventory.skus ?? 0)} SKUs tracked`,
      subTone: 'text-primary',
      iconTone: 'bg-tertiary/15 text-tertiary',
      footer: [
        `${formatNumber(summary?.inventory.skus ?? 0)} SKUs`,
        `${summary?.inventory.in_stock_pct ?? 0}% in-stock`,
      ],
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
              {metricGlyph(card.kind, 'h-3.5 w-3.5')}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">
            {card.value}
          </div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
            <span className={cn('h-1.5 w-1.5 rounded-full', loading ? 'bg-muted' : 'bg-primary')} />
            <span className={card.subTone}>{card.sub}</span>
          </div>
          {card.footer[0] && (
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="truncate">{card.footer[0]}</span>
              <span className="truncate">{card.footer[1]}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ActionBar({
  canManage,
  onProvision,
  onPriceSync,
  onTransfer,
}: {
  canManage: boolean
  onProvision: () => void
  onPriceSync: () => void
  onTransfer: () => void
}) {
  return (
    <div className="space-y-2">
      {canManage && (
        <button
          type="button"
          onClick={onProvision}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Provision New Branch / Outlet
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPriceSync}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <Tags className="h-4 w-4 text-primary" />
          Global Price Sync
        </button>
        <button
          type="button"
          onClick={onTransfer}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <ArrowRightLeft className="h-4 w-4 text-secondary" />
          Transfer Matrix
        </button>
      </div>
    </div>
  )
}

function FilterPills({
  options,
  active,
  onSelect,
}: {
  options: FilterOption[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const selected = active === option.key
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            {option.tone === 'success' && (
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            )}
            {option.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px]',
                selected ? 'bg-primary/15' : 'bg-surface-sunken',
              )}
            >
              {option.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function BranchCard({
  branch,
  canManage,
  isSuperAdmin,
  onDashboard,
  onRoster,
  onStock,
  onEdit,
  onDelete,
}: {
  branch: Branch
  canManage: boolean
  isSuperAdmin: boolean
  onDashboard: () => void
  onRoster: () => void
  onStock: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const variance = branch.variance ?? 0
  const openTills = branch.open_tills ?? 0

  const stripe = !branch.is_active
    ? 'bg-muted-foreground'
    : variance < 0
      ? 'bg-warning'
      : openTills > 0
        ? 'bg-secondary'
        : 'bg-primary'

  const varianceTone =
    variance < 0 ? 'text-warning' : variance > 0 ? 'text-primary' : 'text-secondary'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', stripe)} aria-hidden />

      <div className="p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
                  branch.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {nodeLabel(branch)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {titleCase(typeKey(branch.type))}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider',
                  branch.is_active ? 'text-secondary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    branch.is_active ? 'bg-secondary' : 'bg-muted-foreground',
                  )}
                />
                {branch.is_active ? 'Online' : 'Offline'}
              </span>
            </div>
            <h2 className="mt-1 truncate font-semibold tracking-tight text-foreground">
              {branch.name}
            </h2>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {branch.address ?? 'No address on file'}
                {branch.manager ? ` • Mgr: ${branch.manager}` : ' • Unassigned'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-primary">
              {nodeIcon(branch.type, 'h-5 w-5')}
            </span>
            {(canManage || isSuperAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Branch actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canManage && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                      Edit branch
                    </DropdownMenuItem>
                  )}
                  {isSuperAdmin && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete branch
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-2.5">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Today&apos;s Sales
            </p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatCurrency(branch.today_sales ?? 0)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {formatNumber(branch.today_orders ?? 0)} orders
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Stock Value
            </p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatCurrency(branch.stock_value ?? 0)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {formatNumber(branch.stock_skus ?? 0)} SKUs
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Till Variance
            </p>
            <p className={cn('truncate font-mono text-xs font-semibold', varianceTone)}>
              {formatCurrency(variance)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {openTills} open tills
            </p>
          </div>
        </div>

        {branch.is_active && variance < 0 && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-warning/10 p-2">
            <span className="font-mono text-[11px] text-warning">
              Till short by {formatCurrency(Math.abs(variance))} — reconcile before close.
            </span>
          </div>
        )}
        {branch.is_active && openTills === 0 && variance >= 0 && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-surface-sunken p-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              No registers open at this node right now.
            </span>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1">
          <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {titleCase(typeKey(branch.type))}
          </span>
          <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {branch.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-primary">
            {formatNumber(branch.stock_skus ?? 0)} SKUs carried
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
          <Button variant="secondary" size="sm" onClick={onDashboard}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={onRoster}>
            <Clock4 className="h-3.5 w-3.5" />
            Tills
          </Button>
          <Button variant="outline" size="sm" onClick={onStock}>
            <Boxes className="h-3.5 w-3.5" />
            Stock
          </Button>
        </div>
      </div>
    </div>
  )
}

function GovernanceFooter({
  summary,
  onTax,
  onExport,
}: {
  summary: BranchSummary
  onTax: () => void
  onExport: () => void
}) {
  const tillTone = summary.registers.variance < 0 ? 'text-warning' : 'text-secondary'
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Enterprise Multi-Store Governance
        </span>
        <span className="rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-[10px] text-secondary">
          SLA &lt;1.5s
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Network Nodes
          </p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
            {summary.nodes.active}/{summary.nodes.total}
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Till Variance
          </p>
          <p className={cn('mt-0.5 font-mono text-sm font-bold', tillTone)}>
            {formatCurrency(summary.registers.variance)}
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Vault Value
          </p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
            {formatCurrency(summary.inventory.value)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-3">
        <Button variant="outline" size="sm" onClick={onTax}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Tax Jurisdictions
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export Z-Report
        </Button>
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
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-16 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

function BranchDialog({
  branch,
  businesses,
  isSuperAdmin,
  defaultBusinessId,
  onClose,
  onSaved,
}: {
  branch: Branch | null
  businesses: Business[]
  isSuperAdmin: boolean
  defaultBusinessId: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    business_id: branch?.business_id ?? defaultBusinessId ?? businesses[0]?.id ?? null,
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    address: branch?.address ?? '',
    phone: branch?.phone ?? '',
    type: branch?.type ?? '',
    is_active: branch?.is_active ?? true,
  })

  const showBusinessField = isSuperAdmin
  const missingBusiness = showBusinessField && !branch && form.business_id == null

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        business_id: showBusinessField && !branch ? (form.business_id ?? undefined) : undefined,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        type: form.type.trim() || undefined,
        is_active: form.is_active,
      }
      return branch ? businessApi.updateBranch(branch.id, payload) : businessApi.createBranch(payload)
    },
    onSuccess: () => {
      toast.success(branch ? 'Branch updated' : 'Branch created')
      onSaved()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not save branch', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{branch ? 'Edit branch' : 'Provision new branch'}</DialogTitle>
          <DialogDescription>
            Branches isolate inventory, sales and shifts for a location.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {showBusinessField && (
            <div className="grid gap-2 sm:col-span-2">
              <Label>Business</Label>
              {branch ? (
                <p className="text-sm text-muted-foreground">
                  {businesses.find((b) => b.id === branch.business_id)?.name ?? '—'}
                </p>
              ) : (
                <Select
                  value={form.business_id != null ? String(form.business_id) : undefined}
                  onValueChange={(value) => setForm((p) => ({ ...p, business_id: Number(value) }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select the business this branch belongs to" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((business) => (
                      <SelectItem key={business.id} value={String(business.id)}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Festac Town"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-code">Code</Label>
            <Input
              id="branch-code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. FST"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-type">Type</Label>
            <Input
              id="branch-type"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              placeholder="e.g. Megastore"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="branch-address">Address</Label>
            <Input
              id="branch-address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street, city"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input
              id="branch-phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 sm:col-span-2">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive branches are hidden from POS.</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={save.isPending}
            disabled={!form.name.trim() || missingBusiness}
            onClick={() => save.mutate()}
          >
            {branch ? 'Save changes' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteBranchDialog({
  branch,
  onClose,
  onDeleted,
}: {
  branch: Branch
  onClose: () => void
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => businessApi.deleteBranch(branch.id),
    onSuccess: () => {
      toast.success('Branch deleted')
      onDeleted()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not delete branch', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete branch?</DialogTitle>
          <DialogDescription>
            This permanently removes “{branch.name}”. Branches with stock or sales history cannot
            be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
