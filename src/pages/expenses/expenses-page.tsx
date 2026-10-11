import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Eye,
  FileDown,
  Gavel,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Tags,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  expensesApi,
  type Expense,
  type ExpenseInput,
  type ExpenseSummary,
} from '@/lib/api/endpoints/expenses'
import { useAppStore } from '@/stores/app'
import { usePermissions } from '@/lib/use-permissions'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate, formatNumber, cn, debounce } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const PER_PAGE = 12

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

interface StatusMeta {
  label: string
  chip: string
  stripe: string
  dot: string
  text: string
}

function expenseStatusMeta(status: string): StatusMeta {
  switch (status) {
    case 'approved':
    case 'paid':
      return {
        label: status === 'paid' ? 'Paid' : 'Approved',
        chip: 'bg-success/10 text-success',
        stripe: 'bg-success',
        dot: 'bg-success',
        text: 'text-success',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        chip: 'bg-destructive/10 text-destructive',
        stripe: 'bg-destructive',
        dot: 'bg-destructive',
        text: 'text-destructive',
      }
    case 'awaiting_approval':
      return {
        label: 'Awaiting Approval',
        chip: 'bg-info/10 text-info',
        stripe: 'bg-info',
        dot: 'bg-info',
        text: 'text-info',
      }
    default:
      return {
        label: 'Pending',
        chip: 'bg-warning/10 text-warning',
        stripe: 'bg-warning',
        dot: 'bg-warning',
        text: 'text-warning',
      }
  }
}

function kpiGlyph(kind: 'opex' | 'pending' | 'approved' | 'center', className: string) {
  if (kind === 'opex') return <Wallet className={className} />
  if (kind === 'pending') return <Clock className={className} />
  if (kind === 'approved') return <BadgeCheck className={className} />
  return <Tags className={className} />
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const lines = rows.map((row) => row.map(csvCell).join(','))
  const blob = new Blob([[header.join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ExpensesPage() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const branchName = useAppStore((s) => s.context?.branch?.name)
  const { can } = usePermissions()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [capsOpen, setCapsOpen] = useState(false)
  const [detail, setDetail] = useState<Expense | null>(null)

  const canCreate = can('expenses.create')
  const canApprove = can('expenses.approve')

  const searchDebounced = useRef(
    debounce((value: string) => {
      setPage(1)
      setSearch(value)
    }, 350),
  )

  const dashboardQuery = useQuery({
    queryKey: ['expenses', 'dashboard', branchId],
    queryFn: () => expensesApi.dashboard({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const listQuery = useQuery({
    queryKey: ['expenses', { page, status, category, search, branchId }],
    queryFn: () =>
      expensesApi.list({
        page,
        per_page: PER_PAGE,
        status: status === 'all' ? undefined : status,
        category: category || undefined,
        search: search || undefined,
        branch_id: branchId,
      }),
    placeholderData: (prev) => prev,
  })

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'approved' | 'rejected' }) =>
      expensesApi.decide(id, decision),
    onSuccess: (_data, variables) => {
      toast.success(variables.decision === 'approved' ? 'Expense approved' : 'Expense rejected')
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err) => {
      toast.error('Could not update expense', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const summary = dashboardQuery.data?.data

  const openCreate = (preset?: string) => {
    setPresetCategory(preset)
    setCreating(true)
  }

  const selectStatus = (value: StatusFilter) => {
    setStatus(value)
    setCategory('')
    setPage(1)
  }

  const selectCategory = (value: string) => {
    setCategory(value)
    setStatus('all')
    setPage(1)
  }

  const exportLedger = () => {
    if (rows.length === 0) {
      toast.error('Nothing to export on this page')
      return
    }
    downloadCsv(
      `expense-ledger-${Date.now()}.csv`,
      ['Reference', 'Description', 'Category', 'Branch', 'Amount', 'Status', 'Submitted By', 'Date'],
      rows.map((row) => [
        row.reference,
        row.description,
        row.category ?? '',
        row.branch_name,
        row.amount,
        row.status,
        row.submitted_by,
        row.created_at,
      ]),
    )
    toast.success(`Exported ${rows.length} record${rows.length === 1 ? '' : 's'}`)
  }

  const exportCategories = () => {
    const totals = summary?.by_category ?? []
    if (totals.length === 0) {
      toast.error('No approved spend to export yet')
      return
    }
    downloadCsv(
      `cost-centers-${Date.now()}.csv`,
      ['Cost Center', 'Approved Total'],
      totals.map((row) => [row.category, row.total]),
    )
    toast.success('Cost center breakdown exported')
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        branchName={branchName ?? undefined}
        recordCount={summary?.status_counts.all ?? meta?.total}
        syncing={dashboardQuery.isFetching}
        onSync={() => {
          void dashboardQuery.refetch()
          void listQuery.refetch()
        }}
      />

      <PageHeader
        eyebrow="Expense Command"
        title="Expenses Finance"
        description="Operating expenditure, petty claims and category cost-center control."
      >
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <ShieldCheck className="h-3 w-3" />
          Audit Sync
        </span>
      </PageHeader>

      <MetricGrid
        summary={summary}
        loading={dashboardQuery.isLoading}
        errored={dashboardQuery.isError}
      />

      <ActionBar
        canCreate={canCreate}
        onRecord={() => openCreate()}
        onVoucher={() => openCreate('Petty Cash')}
        onCaps={() => setCapsOpen(true)}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={search}
            onChange={(event) => searchDebounced.current(event.target.value)}
            placeholder="Search reference, description, staff, category…"
            className="h-11 rounded-xl pl-10 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            EXP
          </span>
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="OCR receipt lookup"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills
        status={status}
        category={category}
        summary={summary}
        onSelectStatus={selectStatus}
        onSelectCategory={selectCategory}
      />

      {listQuery.isLoading && <ExpenseSkeleton />}

      {!listQuery.isLoading && listQuery.isError && (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
        <EmptyState
          title="No expenses found"
          description={
            search || category || status !== 'all'
              ? 'Try a different search or filter.'
              : 'Record your first expense or petty claim to get started.'
          }
          icon={<ReceiptText className="h-6 w-6" />}
          action={
            canCreate ? (
              <Button variant="outline" size="sm" onClick={() => openCreate()}>
                New expense
              </Button>
            ) : undefined
          }
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              canApprove={canApprove}
              deciding={decide.isPending}
              onDecide={(decision) => decide.mutate({ id: expense.id, decision })}
              onView={() => setDetail(expense)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={meta?.current_page ?? page}
        lastPage={meta?.last_page ?? 1}
        total={meta?.total}
        totalLabel="expenses"
        isFetching={listQuery.isFetching}
        onPageChange={setPage}
      />

      {summary && <CategoryMixCard summary={summary} />}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={exportLedger}>
          <Download className="h-4 w-4 text-primary" />
          <span className="truncate">Export Ledger</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={exportCategories}>
          <FileDown className="h-4 w-4 text-success" />
          <span className="truncate">Cost Centers</span>
        </Button>
      </div>

      {creating && (
        <NewExpenseDialog
          branchId={branchId}
          presetCategory={presetCategory}
          onClose={() => {
            setCreating(false)
            setPresetCategory(undefined)
          }}
        />
      )}

      {capsOpen && summary && <CategoryCapsDialog summary={summary} onClose={() => setCapsOpen(false)} />}

      {detail && (
        <ExpenseDetailDialog
          expense={detail}
          canApprove={canApprove}
          deciding={decide.isPending}
          onDecide={(decision) => decide.mutate({ id: detail.id, decision })}
          onClose={() => setDetail(null)}
        />
      )}

      <ScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcode={(value) => {
          setScannerOpen(false)
          setPage(1)
          setStatus('all')
          setCategory('')
          setSearch(value)
          toast.info(`Searching “${value}”`)
        }}
      />
    </div>
  )
}

function TelemetryBar({
  branchName,
  recordCount,
  syncing,
  onSync,
}: {
  branchName?: string
  recordCount?: number
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
          Operating Expenditure
        </span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
          {recordCount !== undefined ? `${formatNumber(recordCount)} records` : branchName ?? 'All Branches'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1 rounded bg-surface-elevated px-2 py-0.5 text-muted-foreground sm:flex">
          <Cpu className="h-3 w-3 text-primary" />
          <span className="font-mono text-[10px]">AUDIT SYNC</span>
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
  summary?: ExpenseSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const period = summary?.period
  const topCenter = summary?.by_category[0]
  const submittedValue = period?.submitted_value ?? 0
  const clearedPct =
    submittedValue > 0 ? Math.min(100, Math.round(((period?.approved_value ?? 0) / submittedValue) * 100)) : 0

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-primary/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            MTD OPEX Total
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-primary">
            {kpiGlyph('opex', 'h-3.5 w-3.5')}
          </span>
        </div>
        <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">
          {dim ?? formatCurrency(summary?.total ?? 0)}
        </div>
        <div className="mt-1.5 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-primary" style={{ width: `${clearedPct}%` }} />
          </div>
          <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
            <span className="text-primary">{clearedPct}% cleared</span>
            <span>{formatCurrency(submittedValue)} submitted</span>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-warning/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Sign-off
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-warning/15 text-warning">
            {kpiGlyph('pending', 'h-3.5 w-3.5')}
          </span>
        </div>
        <div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-warning">
            {dim ?? formatCurrency(summary?.pending_value ?? 0)}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {formatNumber(summary?.pending_count ?? 0)} claims await approval
          </p>
        </div>
        <div className="mt-1.5 inline-flex w-max items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning">
          <Clock className="h-3 w-3" />
          Action Required
        </div>
      </div>

      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-success/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cleared This Month
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-success/15 text-success">
            {kpiGlyph('approved', 'h-3.5 w-3.5')}
          </span>
        </div>
        <div>
          <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-success">
            {dim ?? formatCurrency(period?.approved_value ?? 0)}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {formatNumber(period?.approved_count ?? 0)} approved claims
          </p>
        </div>
        <div className="mt-1.5 inline-flex w-max items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
          <CheckCircle2 className="h-3 w-3" />
          {formatNumber(period?.rejected_count ?? 0)} declined
        </div>
      </div>

      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-elevated p-3.5">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-tertiary/10 blur-lg" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top Cost Center
          </span>
          <span className="grid h-6 w-6 place-items-center rounded bg-tertiary/15 text-tertiary">
            {kpiGlyph('center', 'h-3.5 w-3.5')}
          </span>
        </div>
        <div>
          <div className="mt-1.5 truncate font-mono text-sm font-bold tracking-tight text-tertiary">
            {dim ?? topCenter?.category ?? 'No spend yet'}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {formatCurrency(topCenter?.total ?? 0)} approved MTD
          </p>
        </div>
        <div className="mt-1.5 inline-flex w-max items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Tags className="h-3 w-3" />
          {formatNumber(summary?.by_category.length ?? 0)} cost centers
        </div>
      </div>
    </div>
  )
}

function ActionBar({
  canCreate,
  onRecord,
  onVoucher,
  onCaps,
}: {
  canCreate: boolean
  onRecord: () => void
  onVoucher: () => void
  onCaps: () => void
}) {
  return (
    <div className="space-y-2">
      {canCreate && (
        <button
          type="button"
          onClick={onRecord}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Record Expense / Claim
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onVoucher}
          disabled={!canCreate}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken disabled:opacity-50"
        >
          <Receipt className="h-4 w-4 text-primary" />
          Petty Voucher
        </button>
        <button
          type="button"
          onClick={onCaps}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <Tags className="h-4 w-4 text-tertiary" />
          Category Caps
        </button>
      </div>
    </div>
  )
}

function FilterPills({
  status,
  category,
  summary,
  onSelectStatus,
  onSelectCategory,
}: {
  status: StatusFilter
  category: string
  summary?: ExpenseSummary
  onSelectStatus: (value: StatusFilter) => void
  onSelectCategory: (value: string) => void
}) {
  const counts = summary?.status_counts
  const statusPills: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All Expenses', count: counts?.all },
    { value: 'pending', label: 'Pending', count: counts?.pending },
    { value: 'approved', label: 'Approved', count: counts?.approved },
    { value: 'rejected', label: 'Rejected', count: counts?.rejected },
  ]
  const categoryPills = (summary?.category_counts ?? []).slice(0, 5)

  const pillClass = (selected: boolean) =>
    cn(
      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
      selected
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {statusPills.map((pill) => {
        const selected = category === '' && status === pill.value
        return (
          <button key={pill.value} type="button" onClick={() => onSelectStatus(pill.value)} className={pillClass(selected)}>
            {pill.label}
            {pill.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[10px]', selected ? 'bg-primary/15' : 'bg-surface-sunken')}>
                {pill.count}
              </span>
            )}
          </button>
        )
      })}
      {categoryPills.map((pill) => {
        const selected = category === pill.category
        return (
          <button
            key={pill.category}
            type="button"
            onClick={() => onSelectCategory(selected ? '' : pill.category)}
            className={pillClass(selected)}
          >
            {pill.category}
            <span className={cn('rounded-full px-1.5 text-[10px]', selected ? 'bg-primary/15' : 'bg-surface-sunken')}>
              {pill.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ExpenseCard({
  expense,
  canApprove,
  deciding,
  onDecide,
  onView,
}: {
  expense: Expense
  canApprove: boolean
  deciding: boolean
  onDecide: (decision: 'approved' | 'rejected') => void
  onView: () => void
}) {
  const meta = expenseStatusMeta(expense.status)
  const isPending = expense.status === 'pending' || expense.status === 'awaiting_approval'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', meta.stripe)} aria-hidden />

      <div className="space-y-3 p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold text-primary">{expense.reference}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {expense.category ?? 'Uncategorized'}
              </span>
              <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider', meta.chip)}>
                {meta.label}
              </span>
            </div>
            <h3 className="truncate text-sm font-semibold text-foreground">{expense.description}</h3>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-mono text-sm font-bold tabular-nums text-foreground">
              {formatCurrency(expense.amount)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {expense.branch_name}
            </span>
          </div>
        </div>

        <div className="space-y-1 rounded-xl bg-surface-sunken p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Submitted By</span>
            <span className="truncate text-foreground">{expense.submitted_by}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Expense Date</span>
            <span className="text-foreground">{formatDate(expense.created_at)}</span>
          </div>
          {expense.approved_by && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Decision By</span>
              <span className={cn('truncate', meta.text)}>{expense.approved_by}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className={cn('inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px]', meta.chip)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
            {isPending ? 'Awaiting sign-off' : meta.label}
          </span>
          <div className="flex items-center gap-1.5">
            {isPending && canApprove ? (
              <>
                <Button
                  size="sm"
                  loading={deciding}
                  onClick={() => onDecide('approved')}
                  className="h-8 bg-success/15 px-3 text-success hover:bg-success/25"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deciding}
                  onClick={() => onDecide('rejected')}
                  className="h-8 px-3 text-destructive"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={onView}>
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryMixCard({ summary }: { summary: ExpenseSummary }) {
  const categories = summary.by_category
  const total = summary.total
  const tones = ['bg-primary', 'bg-success', 'bg-tertiary', 'bg-info', 'bg-destructive']
  const textTones = ['text-primary', 'text-success', 'text-tertiary', 'text-info', 'text-destructive']

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Cost Center Allocation</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatCurrency(total)} MTD
        </span>
      </div>

      {categories.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          No approved spend recorded this month.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {categories.slice(0, 6).map((row, index) => {
            const pct = total > 0 ? Math.round((row.total / total) * 100) : 0
            return (
              <div key={row.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-foreground">{row.category}</span>
                  <span className={cn('font-mono font-bold', textTones[index % textTones.length])}>
                    {pct}% · {formatCurrency(row.total)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={cn('h-full rounded-full', tones[index % tones.length])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpenseSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-2xl border border-border bg-surface-elevated p-3.5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3.5 w-44" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="mt-3 h-16 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

interface NewExpenseDialogProps {
  branchId?: number
  presetCategory?: string
  onClose: () => void
}

function NewExpenseDialog({ branchId, presetCategory, onClose }: NewExpenseDialogProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(presetCategory ?? 'none')
  const [date, setDate] = useState('')

  const categoriesQuery = useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: () => expensesApi.categories(),
  })

  const categories = categoriesQuery.data?.data ?? []
  const hasPreset = presetCategory ? categories.some((cat) => cat.name === presetCategory) : false

  const createExpense = useMutation({
    mutationFn: (input: ExpenseInput) => expensesApi.create(input),
    onSuccess: () => {
      toast.success('Expense created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err) => {
      toast.error('Could not create expense', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const valid = description.trim().length > 0 && amount !== '' && Number(amount) > 0

  const submit = () => {
    const chosen = category === 'none' || category === 'preset' ? presetCategory : category
    createExpense.mutate({
      description: description.trim(),
      amount: Number(amount),
      category: chosen || undefined,
      date: date || undefined,
      branch_id: branchId,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{presetCategory ? `${presetCategory} voucher` : 'New expense'}</DialogTitle>
          <DialogDescription>
            Expenses are recorded against the active branch and submitted for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Diesel top-up for generator"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-amount">Amount (₦)</Label>
            <Input
              id="expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-2">
            <Label>Cost Center / Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {hasPreset && <SelectItem value="preset">{presetCategory}</SelectItem>}
                {categories
                  .filter((cat) => cat.name !== presetCategory)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={createExpense.isPending} disabled={!valid} onClick={submit}>
            Submit for Sign-off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryCapsDialog({ summary, onClose }: { summary: ExpenseSummary; onClose: () => void }) {
  const counts = new Map(summary.category_counts.map((row) => [row.category, row.count]))
  const totals = summary.by_category
  const total = summary.total

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Category Spend Allocation</DialogTitle>
          <DialogDescription>
            Approved expenditure by cost center for the current cycle. {formatNumber(summary.period.submitted_count)}{' '}
            claims submitted this period.
          </DialogDescription>
        </DialogHeader>

        {totals.length === 0 ? (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
            No approved spend recorded this month.
          </p>
        ) : (
          <div className="space-y-3">
            {totals.map((row, index) => {
              const pct = total > 0 ? Math.round((row.total / total) * 100) : 0
              const tones = ['bg-primary', 'bg-success', 'bg-tertiary', 'bg-info', 'bg-destructive']
              return (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-foreground">{row.category}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(row.total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn('h-full rounded-full', tones[index % tones.length])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatNumber(counts.get(row.category) ?? 0)} claims recorded
                  </p>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseDetailDialog({
  expense,
  canApprove,
  deciding,
  onDecide,
  onClose,
}: {
  expense: Expense
  canApprove: boolean
  deciding: boolean
  onDecide: (decision: 'approved' | 'rejected') => void
  onClose: () => void
}) {
  const meta = expenseStatusMeta(expense.status)
  const isPending = expense.status === 'pending' || expense.status === 'awaiting_approval'

  const exportVoucher = () => {
    downloadCsv(
      `${expense.reference}.csv`,
      ['Reference', 'Description', 'Category', 'Branch', 'Amount', 'Status', 'Submitted By', 'Date'],
      [
        [
          expense.reference,
          expense.description,
          expense.category ?? '',
          expense.branch_name,
          expense.amount,
          expense.status,
          expense.submitted_by,
          expense.created_at,
        ],
      ],
    )
    toast.success('Voucher exported')
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense.description}</DialogTitle>
          <DialogDescription>
            {expense.reference} · {expense.category ?? 'Uncategorized'} · {expense.branch_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Amount</span>
            <span className="font-mono text-base font-bold text-foreground">
              {formatCurrency(expense.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
            <span className={cn('inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px]', meta.chip)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Submitted By</span>
            <span className="text-sm text-foreground">{expense.submitted_by}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Decision By</span>
            <span className="text-sm text-foreground">{expense.approved_by ?? 'Pending'}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</span>
            <span className="text-sm text-foreground">{formatDate(expense.created_at)}</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={exportVoucher}>
            <FileDown className="h-4 w-4" />
            Voucher
          </Button>
          {isPending && canApprove ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={deciding}
                onClick={() => {
                  onDecide('rejected')
                  onClose()
                }}
                className="text-destructive"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                size="sm"
                loading={deciding}
                onClick={() => {
                  onDecide('approved')
                  onClose()
                }}
                className="bg-success/15 text-success hover:bg-success/25"
              >
                <Gavel className="h-4 w-4" />
                Authorize
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
