import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  FileDown,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, debounce, formatDateTime, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { inventoryApi, type StockAdjustmentTrail } from '@/lib/api/endpoints/inventory'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export function AdjustmentTrailPage() {
  const queryClient = useQueryClient()
  const branches = useAppStore((s) => s.branches)
  const contextBranch = useAppStore((s) => s.context?.branch?.id)
  const { can } = usePermissions()
  const canApprove = can('inventory.approve')

  const [branchId, setBranchId] = useState<string>(contextBranch ? String(contextBranch) : '')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [decisionFor, setDecisionFor] = useState<StockAdjustmentTrail | null>(null)

  const searchDebounced = useRef(debounce((value: string) => {
    setSearch(value)
    setPage(1)
  }, 300))

  const filtersActive = !!search || !!dateFrom || !!dateTo || status !== 'all'

  const trail = useQuery({
    queryKey: ['inventory', 'adjustments', { branchId, status, search, dateFrom, dateTo, page }],
    queryFn: () =>
      inventoryApi.adjustments({
        page,
        per_page: 20,
        status: status === 'all' ? undefined : status,
        branch_id: branchId ? Number(branchId) : undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const rows = (trail.data?.data ?? []) as StockAdjustmentTrail[]
  const summary = trail.data?.meta.summary ?? { pending: 0, approved: 0, rejected: 0, applied_quantity: 0 }

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info('No rows to export')
      return
    }
    const header = ['Reference', 'Created', 'Product', 'SKU', 'Branch', 'Change', 'Before', 'After', 'Status', 'Reason', 'Requested by', 'Decided by', 'Decision notes']
    const lines = rows.map((row) =>
      [
        row.reference,
        row.created_at,
        row.product_name ?? '',
        row.sku ?? '',
        row.branch_name ?? '',
        row.quantity,
        row.balance_before ?? '',
        row.balance_after ?? '',
        row.status,
        row.reason ?? '',
        row.created_by_name ?? '',
        row.decided_by_name ?? '',
        row.decision_notes ?? '',
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
    link.download = `inventory-adjustment-trail-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Audit trail exported')
  }

  const resetFilters = () => {
    setStatus('all')
    setSearchInput('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const decide = useMutation({
    mutationFn: ({ row, decision, notes }: { row: StockAdjustmentTrail; decision: 'approved' | 'rejected'; notes?: string }) =>
      inventoryApi.approve(row.id, decision, notes),
    onSuccess: (res, variables) => {
      toast.success(res.message ?? (variables.decision === 'approved' ? 'Adjustment approved' : 'Adjustment rejected'))
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      setDecisionFor(null)
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not record decision')
    },
  })

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Inventory Qty Adjust Audit Trail"
        description="Every stock quantity adjustment — who requested it, who approved or rejected it, and the before/after balance it produced."
      >
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <SummaryCard
          label="Pending"
          value={formatNumber(summary.pending)}
          icon={<ClipboardList className="h-4 w-4" />}
          tone={summary.pending > 0 ? 'warning' : 'muted'}
        />
        <SummaryCard
          label="Approved"
          value={formatNumber(summary.approved)}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone="success"
        />
        <SummaryCard
          label="Rejected"
          value={formatNumber(summary.rejected)}
          icon={<ClipboardX className="h-4 w-4" />}
          tone="destructive"
        />
        <SummaryCard
          label="Net applied qty"
          value={formatNumber(summary.applied_quantity)}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="primary"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                status === tab.value
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="trail-branch">Branch</Label>
            <Select value={branchId} onValueChange={(value) => { setBranchId(value); setPage(1) }}>
              <SelectTrigger id="trail-branch">
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
          <div className="grid gap-2">
            <Label htmlFor="trail-search">Search product</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="trail-search"
                placeholder="Name or SKU…"
                value={searchInput}
                className="pl-9"
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  searchDebounced.current(event.target.value)
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="trail-from">From</Label>
            <Input id="trail-from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="trail-to">To</Label>
            <Input id="trail-to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {formatNumber(trail.data?.meta.total ?? 0)} adjustment{(trail.data?.meta.total ?? 0) === 1 ? '' : 's'}
          </p>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {trail.isError && <ErrorState error={trail.error} onRetry={() => trail.refetch()} />}

      {trail.isLoading && !trail.data && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 w-full animate-pulse rounded-xl bg-surface-elevated" />
          ))}
        </div>
      )}

      {!trail.isError && !!trail.data && rows.length === 0 && (
        <EmptyState
          title="No adjustments recorded"
          description="Stock quantity adjustments and their approval decisions will appear here."
          icon={<SlidersHorizontal className="h-6 w-6" />}
        />
      )}

      {!trail.isError && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <TrailCard
              key={row.id}
              row={row}
              canApprove={canApprove}
              pending={decide.isPending && decide.variables?.row.id === row.id}
              onDecide={() => setDecisionFor(row)}
            />
          ))}
          <div className="pt-2">
            <Pagination
              page={trail.data?.meta.current_page ?? page}
              lastPage={trail.data?.meta.last_page ?? 1}
              total={trail.data?.meta.total ?? 0}
              totalLabel="adjustments"
              isFetching={trail.isFetching}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <DecideDialog
        row={decisionFor}
        isPending={decide.isPending}
        onClose={() => setDecisionFor(null)}
        onConfirm={(decision, notes) => {
          if (decisionFor) decide.mutate({ row: decisionFor, decision, notes })
        }}
      />
    </div>
  )
}

const TONE: Record<string, string> = {
  muted: 'text-muted-foreground bg-muted',
  success: 'text-success bg-success/10',
  destructive: 'text-destructive bg-destructive/10',
  warning: 'text-warning bg-warning/10',
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: keyof typeof TONE }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', TONE[tone])}>{icon}</span>
      </div>
      <span className="mt-2 block font-mono text-xl font-bold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function TrailCard({
  row,
  canApprove,
  pending,
  onDecide,
}: {
  row: StockAdjustmentTrail
  canApprove: boolean
  pending: boolean
  onDecide: () => void
}) {
  const positive = row.quantity > 0
  const applied = row.status === 'approved'
  const hasBalance =
    row.balance_before !== null &&
    row.balance_before !== undefined &&
    row.balance_after !== null &&
    row.balance_after !== undefined

  const pendingApproval = row.status === 'pending' && canApprove

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-3.5 transition-colors hover:border-border/70 hover:bg-surface-sunken/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{row.reference}</span>
            <StatusBadge status={row.status} />
          </div>
          <h3 className="mt-1 truncate text-sm font-bold text-foreground">{row.product_name ?? '—'}</h3>
          <span className="block font-mono text-[10px] text-muted-foreground">
            {row.variant_name ? `${row.variant_name} • ` : ''}
            {row.sku ?? 'No SKU'}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={cn(
              'block font-mono text-lg font-bold tabular-nums',
              positive ? 'text-success' : 'text-destructive',
            )}
          >
            {positive ? '+' : ''}
            {formatNumber(row.quantity)}
          </span>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Qty change</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-surface-sunken p-3 sm:grid-cols-4">
        <Detail label="Branch" value={row.branch_name ?? '—'} />
        <Detail
          label="Requested by"
          value={row.created_by_name ?? 'System'}
          sub={formatDateTime(row.created_at)}
        />
        <Detail
          label="On hand"
          value={hasBalance ? `${formatNumber(row.balance_before!)} → ${formatNumber(row.balance_after!)}` : 'Not applied'}
        />
        <Detail
          label={row.status === 'rejected' ? 'Rejected by' : 'Approved by'}
          value={applied || row.status === 'rejected' ? row.decided_by_name ?? '—' : '—'}
          sub={row.decided_at ? formatDateTime(row.decided_at) : undefined}
        />
        {row.reason && <Detail label="Reason" value={row.reason} className="col-span-2 sm:col-span-4" />}
        {row.decision_notes && (
          <Detail
            label="Decision notes"
            value={row.decision_notes}
            className="col-span-2 sm:col-span-4"
            tone="primary"
          />
        )}
      </div>

      {pendingApproval && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <span className="text-[11px] text-muted-foreground">
            Awaiting business admin approval
          </span>
          <Button variant="outline" size="sm" onClick={onDecide} loading={pending}>
            <ClipboardCheck className="h-3.5 w-3.5" /> Review
          </Button>
        </div>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  sub,
  className,
  tone,
}: {
  label: string
  value: string
  sub?: string
  className?: string
  tone?: 'primary'
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('block truncate text-xs font-medium', tone === 'primary' ? 'text-primary' : 'text-foreground')}>
        {value}
      </span>
      {sub && <span className="block truncate font-mono text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

function DecideDialog({
  row,
  isPending,
  onClose,
  onConfirm,
}: {
  row: StockAdjustmentTrail | null
  isPending: boolean
  onClose: () => void
  onConfirm: (decision: 'approved' | 'rejected', notes?: string) => void
}) {
  const [notes, setNotes] = useState('')

  const preview =
    row && row.balance_before !== null && row.balance_before !== undefined
      ? row.balance_before + row.quantity
      : null

  return (
    <Dialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) {
          setNotes('')
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Review stock adjustment</DialogTitle>
        </DialogHeader>

        {row && (
          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-sunken p-3">
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{row.product_name ?? '—'}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {row.reference} • {row.branch_name ?? '—'}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{row.reason || 'No reason provided'}</span>
              </div>
              <span className={cn('shrink-0 font-mono text-lg font-bold tabular-nums', row.quantity > 0 ? 'text-success' : 'text-destructive')}>
                {row.quantity > 0 ? '+' : ''}
                {formatNumber(row.quantity)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-surface-elevated p-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">On hand now</span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-foreground">
                  {row.balance_before !== null && row.balance_before !== undefined ? formatNumber(row.balance_before) : '—'}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated p-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">If approved</span>
                <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-primary">
                  {preview !== null ? formatNumber(preview) : '—'}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="decision-notes">Decision notes (optional)</Label>
              <Input
                id="decision-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Count verified against physical stock"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onConfirm('rejected', notes || undefined)}
            disabled={isPending}
          >
            Reject
          </Button>
          <Button size="sm" onClick={() => onConfirm('approved', notes || undefined)} loading={isPending} disabled={isPending}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
