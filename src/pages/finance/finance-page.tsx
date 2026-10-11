import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BadgeCheck,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  Fingerprint,
  HandCoins,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Square,
  X,
  XCircle,
} from 'lucide-react'
import {
  financeApi,
  type FinanceApprovalSummary,
  type FinanceQueueItem,
} from '@/lib/api/endpoints/finance'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { formatCurrency, formatDateTime, formatRelative, cn } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { useAppStore } from '@/stores/app'

type FinanceSection = 'approvals' | 'receivables' | 'reconciliation'

const KIND_LABEL: Record<string, string> = {
  credit: 'Credit Limit',
  void: 'Void / Refund',
  refund: 'Void / Refund',
  purchase: 'PO Disbursal',
  po: 'PO Disbursal',
  flagged: 'Flagged',
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function humanize(value?: string | null): string {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function kindLabel(kind?: string | null): string {
  if (!kind) return 'Payment'
  return KIND_LABEL[kind] ?? humanize(kind)
}

function isOverdue(iso?: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000
}

const EMPTY_SUMMARY: FinanceApprovalSummary = {
  pending_count: 0,
  pending_amount: 0,
  approved_count: 0,
  rejected_count: 0,
  overdue_count: 0,
  oldest_pending_at: null,
  cleared_today_count: 0,
  cleared_today_amount: 0,
  rejected_today_count: 0,
  rejected_today_amount: 0,
}

export function FinancePage() {
  const [section, setSection] = useState<FinanceSection>('approvals')
  const [reconPage, setReconPage] = useState(1)
  const branchName = useAppStore((state) => state.context?.branch?.name)

  const sections: { value: FinanceSection; label: string }[] = [
    { value: 'approvals', label: 'Approvals' },
    { value: 'receivables', label: 'Receivables & Payables' },
    { value: 'reconciliation', label: 'Reconciliation' },
  ]

  return (
    <div className="animate-fade-in space-y-5">
      <DeskHeader branchName={branchName} />

      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface-elevated p-1">
        {sections.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setSection(item.value)}
            className={cn(
              'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors',
              section === item.value
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'approvals' && <ApprovalsDesk />}
      {section === 'receivables' && <ReceivablesPayablesTab />}
      {section === 'reconciliation' && (
        <ReconciliationTab page={reconPage} setPage={setReconPage} />
      )}
    </div>
  )
}

function DeskHeader({ branchName }: { branchName?: string | null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Dual-Key Escrow Active
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Finance Authorization Desk
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ledger &amp; Finance control — two-factor clearance, payment authorization and
          reconciliation of store operations.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Settlement Node
        </p>
        <p className="font-mono text-sm font-semibold text-foreground">
          {branchName ?? 'All branches'}
        </p>
        <p className="text-[11px] text-muted-foreground">Ledger &amp; Finance · Terminal 04</p>
      </div>
    </div>
  )
}

function ApprovalsDesk() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detail, setDetail] = useState<FinanceQueueItem | null>(null)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance', 'approvals', { page, status }],
    queryFn: () =>
      financeApi.approvalsQueue({
        page,
        per_page: 12,
        status: status === 'all' ? undefined : status,
      }),
    placeholderData: (prev) => prev,
  })

  const rows = useMemo(() => data?.data ?? [], [data])
  const summary = data?.meta?.summary ?? EMPTY_SUMMARY

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      [row.sale_reference, row.customer_name, row.sales_rep, row.branch_name, row.payment_method].some(
        (value) => (value ?? '').toLowerCase().includes(term),
      ),
    )
  }, [rows, query])

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected])
  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + row.amount, 0),
    [selectedRows],
  )

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      notes,
    }: {
      id: number
      decision: 'approved' | 'rejected'
      notes?: string
    }) => financeApi.approve(id, decision, notes),
  })

  function changeStatus(value: string) {
    setPage(1)
    setStatus(value)
    setSelected(new Set())
  }

  async function decideOne(id: number, decision: 'approved' | 'rejected', notes?: string) {
    try {
      await decide.mutateAsync({ id, decision, notes })
      toast.success(decision === 'approved' ? 'Authorization cleared' : 'Request declined')
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
    } catch (err) {
      toast.error('Could not record decision', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    }
  }

  async function decideBatch(decision: 'approved' | 'rejected') {
    const ids = [...selected]
    if (ids.length === 0) return
    let failures = 0
    for (const id of ids) {
      try {
        await decide.mutateAsync({ id, decision })
      } catch {
        failures += 1
      }
    }
    const succeeded = ids.length - failures
    if (succeeded > 0) {
      toast.success(
        `${succeeded} ${succeeded === 1 ? 'request' : 'requests'} ${
          decision === 'approved' ? 'authorized' : 'declined'
        }`,
      )
    }
    if (failures > 0) toast.error(`${failures} could not be processed`)
    setSelected(new Set())
    setDetail(null)
    void queryClient.invalidateQueries({ queryKey: ['finance'] })
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allCount =
    summary.pending_count + summary.approved_count + summary.rejected_count

  const statusCount: Record<string, number> = {
    all: allCount,
    pending: summary.pending_count,
    approved: summary.approved_count,
    rejected: summary.rejected_count,
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Clock}
          tone="warning"
          label="Pending Queue"
          value={summary.pending_count}
          secondary={formatCurrency(summary.pending_amount)}
        />
        <StatTile
          icon={AlertTriangle}
          tone="destructive"
          label="SLA Breach"
          value={summary.overdue_count}
          secondary={
            summary.oldest_pending_at
              ? `oldest ${formatRelative(summary.oldest_pending_at)}`
              : 'queue on track'
          }
        />
        <StatTile
          icon={BadgeCheck}
          tone="success"
          label="Cleared Today"
          value={summary.cleared_today_count}
          secondary={formatCurrency(summary.cleared_today_amount)}
        />
        <StatTile
          icon={XCircle}
          tone="muted"
          label="Declined Today"
          value={summary.rejected_today_count}
          secondary={formatCurrency(summary.rejected_today_amount)}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeStatus(tab.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                status === tab.value
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {statusCount[tab.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <SearchInput
          className="lg:w-72"
          placeholder="Search sale, party, rep…"
          onSearch={(value) => setQuery(value)}
        />
      </div>

      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          title={query ? 'No matches' : 'Queue is clear'}
          description={
            query
              ? 'No requests on this page match your search.'
              : 'No approval requests match the current filter.'
          }
          icon={<ReceiptText className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                busy={decide.isPending}
                onToggle={() => toggle(item.id)}
                onOpen={() => setDetail(item)}
                onApprove={() => decideOne(item.id, 'approved')}
                onReject={() => decideOne(item.id, 'rejected')}
              />
            ))}
          </div>

          <Pagination
            page={data?.meta.current_page ?? page}
            lastPage={data?.meta.last_page ?? 1}
            total={data?.meta.total}
            totalLabel="requests"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {selectedRows.length > 0 && <div className="h-20" />}

      {selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-card backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Fingerprint className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {selectedRows.length} selected
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatCurrency(selectedTotal)} in escrow
                </p>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={decide.isPending}
                onClick={() => decideBatch('rejected')}
              >
                <X /> Decline
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={decide.isPending}
                onClick={() => decideBatch('approved')}
              >
                <ShieldCheck /> Authorize Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      <ApprovalDetailDialog
        item={detail}
        busy={decide.isPending}
        onClose={() => setDetail(null)}
        onApprove={() => detail && decideOne(detail.id, 'approved')}
        onReject={() => detail && decideOne(detail.id, 'rejected')}
      />
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  secondary,
  tone,
}: {
  icon: typeof Clock
  label: string
  value: number
  secondary: string
  tone: 'warning' | 'destructive' | 'success' | 'muted'
}) {
  const toneClass = {
    warning: 'text-warning',
    destructive: 'text-destructive',
    success: 'text-success',
    muted: 'text-muted-foreground',
  }[tone]

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className={cn('h-4 w-4', toneClass)} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{secondary}</p>
    </div>
  )
}

function ApprovalCard({
  item,
  selected,
  busy,
  onToggle,
  onOpen,
  onApprove,
  onReject,
}: {
  item: FinanceQueueItem
  selected: boolean
  busy: boolean
  onToggle: () => void
  onOpen: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const pending = item.status === 'pending'
  const overdue = pending && isOverdue(item.created_at)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 bg-surface-sunken px-4 py-2">
        {pending && (
          <button
            type="button"
            onClick={onToggle}
            role="checkbox"
            aria-checked={selected}
            aria-label="Select request"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {selected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        )}
        <Badge variant={pending ? 'warning' : item.status === 'approved' ? 'success' : 'muted'}>
          {kindLabel(item.kind)}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">#AP-{item.id}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 text-[11px] font-medium',
            overdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {overdue ? 'SLA breach' : formatRelative(item.created_at)}
        </span>
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {kindLabel(item.kind)} Authorization
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{item.sale_reference}</p>
          </div>
          <p className="shrink-0 text-lg font-bold tabular-nums text-warning">
            {formatCurrency(item.amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-sunken p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Requester</p>
            <p className="truncate text-xs font-medium text-foreground">{item.sales_rep}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.branch_name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</p>
            <p className="truncate text-xs font-medium text-foreground">
              {item.customer_name ?? 'Walk-in'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {humanize(item.payment_method)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Detail label="Method" value={humanize(item.payment_method)} />
          <Detail label="Kind" value={humanize(item.kind)} />
          <Detail label="Raised" value={formatRelative(item.created_at)} />
        </div>

        <GovernanceChain item={item} />

        {item.reason && (
          <p className="rounded-lg border border-border/60 bg-card px-3 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Reason:</span> {item.reason}
          </p>
        )}

        {pending ? (
          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            <Button variant="ghost" size="sm" onClick={onOpen}>
              <FileText /> Details
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="destructive" size="sm" disabled={busy} onClick={onReject}>
                <X /> Decline
              </Button>
              <Button variant="success" size="sm" disabled={busy} onClick={onApprove}>
                <ShieldCheck /> Authorize
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">
              Decided {formatRelative(item.decided_at)}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onOpen}>
                <FileText /> Details
              </Button>
              <StatusBadge status={item.status} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  )
}

function GovernanceChain({ item }: { item: FinanceQueueItem }) {
  const pending = item.status === 'pending'
  const failed = item.status === 'rejected'
  const decided = !pending

  const steps = [
    {
      label: 'Requested',
      sub: formatRelative(item.created_at),
      tone: 'done' as const,
    },
    {
      label: 'Finance Clearance',
      sub: pending ? 'Awaiting dual-key' : formatRelative(item.decided_at),
      tone: pending ? ('current' as const) : failed ? ('failed' as const) : ('done' as const),
    },
  ]

  const toneClass = (tone: 'done' | 'current' | 'failed') =>
    ({
      done: 'bg-success/15 text-success',
      current: 'bg-warning/15 text-warning',
      failed: 'bg-destructive/15 text-destructive',
    })[tone]

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
      <div className="flex flex-1 items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                toneClass(step.tone),
              )}
            >
              {step.tone === 'failed' ? (
                <X className="h-3.5 w-3.5" />
              ) : step.tone === 'current' ? (
                <Fingerprint className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-foreground">{step.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{step.sub}</p>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
      {decided && <StatusBadge status={item.status} />}
    </div>
  )
}

function ApprovalDetailDialog({
  item,
  busy,
  onClose,
  onApprove,
  onReject,
}: {
  item: FinanceQueueItem | null
  busy: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const pending = item?.status === 'pending'

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {kindLabel(item.kind)} Authorization
                <StatusBadge status={item.status} />
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono text-xs">{item.sale_reference}</span> · #AP-{item.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-xl bg-surface-sunken p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Escrow Amount
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-warning">
                  {formatCurrency(item.amount)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Customer" value={item.customer_name ?? 'Walk-in'} />
                <Field label="Payment Method" value={humanize(item.payment_method)} />
                <Field label="Requested By" value={item.sales_rep} />
                <Field label="Branch" value={item.branch_name} />
                <Field label="Raised" value={formatDateTime(item.created_at)} />
                <Field
                  label="Decided"
                  value={item.decided_at ? formatDateTime(item.decided_at) : 'Pending'}
                />
              </dl>

              {item.reason && (
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Reason
                  </p>
                  <p className="mt-0.5 text-foreground">{item.reason}</p>
                </div>
              )}

              {item.notes && (
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-0.5 text-foreground">{item.notes}</p>
                </div>
              )}
            </div>

            {pending && (
              <DialogFooter>
                <Button variant="destructive" disabled={busy} onClick={onReject}>
                  <X /> Decline
                </Button>
                <Button variant="success" disabled={busy} onClick={onApprove}>
                  <ShieldCheck /> Authorize
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  )
}

function ReceivablesPayablesTab() {
  const receivables = useQuery({
    queryKey: ['finance', 'receivables'],
    queryFn: () => financeApi.receivables(),
    placeholderData: (prev) => prev,
  })

  const payables = useQuery({
    queryKey: ['finance', 'payables'],
    queryFn: () => financeApi.payables(),
    placeholderData: (prev) => prev,
  })

  if (receivables.isError || payables.isError) {
    return (
      <ErrorState
        error={receivables.error ?? payables.error}
        onRetry={() => {
          void receivables.refetch()
          void payables.refetch()
        }}
      />
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <HandCoins className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Receivables</p>
              <p className="text-[11px] text-muted-foreground">Customer credit owed to the business</p>
            </div>
          </div>
          <SummaryFigure loading={receivables.isLoading} data={receivables.data?.data} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/15 text-info">
              <Landmark className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Payables</p>
              <p className="text-[11px] text-muted-foreground">Money owed to suppliers</p>
            </div>
          </div>
          <SummaryFigure loading={payables.isLoading} data={payables.data?.data} />
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryFigure({
  loading,
  data,
}: {
  loading: boolean
  data?: { total: number; outstanding: number; overdue: number }
}) {
  if (loading) return <LoadingState rows={2} />
  if (!data)
    return (
      <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
        No data reported.
      </p>
    )

  const figures = [
    { label: 'Total', value: data.total },
    { label: 'Outstanding', value: data.outstanding },
    { label: 'Overdue', value: data.overdue, warn: data.overdue > 0 },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {figures.map((figure) => (
        <div key={figure.label} className="rounded-xl border border-border/70 p-4">
          <p className="text-[11px] text-muted-foreground">{figure.label}</p>
          <p
            className={cn(
              'mt-1 text-lg font-bold tabular-nums',
              figure.warn ? 'text-warning' : 'text-foreground',
            )}
          >
            {formatCurrency(figure.value)}
          </p>
        </div>
      ))}
    </div>
  )
}

interface ReconciliationRow {
  id: number
  date: string
  reference?: string
  description?: string
  amount: number
  status: string
}

function ReconciliationTab({
  page,
  setPage,
}: {
  page: number
  setPage: (page: number) => void
}) {
  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance', 'reconciliation', { page }],
    queryFn: () => financeApi.reconciliation({ page, per_page: 12 }),
    placeholderData: (prev) => prev,
  })

  const rows = (data?.data as unknown as ReconciliationRow[] | undefined) ?? []
  const meta = data?.meta

  return (
    <>
      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nothing to reconcile"
          description="Reconciliation records will appear here."
          icon={<ReceiptText className="h-6 w-6" />}
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-foreground">
                    {row.reference ?? `#${row.id}`}
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-sm text-foreground">
                    {row.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTime(row.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="records"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  )
}
