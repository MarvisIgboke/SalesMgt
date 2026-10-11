import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Fingerprint,
  Landmark,
  LogOut,
  Minus,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react'
import { shiftApi, type ShiftDetail, type ShiftJournalEvent } from '@/lib/api/endpoints/shifts'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { usePermissions } from '@/lib/use-permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/status-badge'
import { ErrorState } from '@/components/common/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const DENOMINATIONS = [1000, 500, 200, 100] as const

type DenomCounts = Record<number, number>

const JOURNAL_TONE: Record<ShiftJournalEvent['kind'], string> = {
  opening: 'bg-primary/15 text-primary',
  cash_sales: 'bg-success/15 text-success',
  refund: 'bg-destructive/15 text-destructive',
  drop: 'bg-warning/15 text-warning',
  payout: 'bg-info/15 text-info',
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function startedLine(happenedAt: string, terminal: string): string {
  return `Started ${formatDate(happenedAt, { hour: '2-digit', minute: '2-digit' })} • ${terminal}`
}

function xtapeLines(detail: ShiftDetail): string[] {
  const k = detail.kpis
  return [
    `X-REPORT • ${detail.terminal}`,
    `Shift #${detail.id} • ${detail.branch_name}`,
    `Operator: ${detail.user_name} (${detail.user_role})`,
    `Opened: ${formatDateTime(detail.opened_at)}`,
    '────────────────────────────',
    'SESSION',
    `  Gross sales        ${formatCurrency(k.gross_sales)}`,
    `  Transactions       ${k.sales_transactions}`,
    `  Net cash sales     ${formatCurrency(k.net_cash_sales)}`,
    `  Digital & POS      ${formatCurrency(k.digital_pos)}`,
    `  Refunds            ${formatCurrency(k.refunds_total)}`,
    'DRAWER FLOW',
    `  Opening float      ${formatCurrency(k.opening_float)}`,
    `  Safe drops         ${formatCurrency(k.drops_total)}`,
    `  Paid outs          ${formatCurrency(k.payouts_total)}`,
    `  Expected in-drawer ${formatCurrency(k.expected_drawer)}`,
  ]
}

function zReportLines(detail: ShiftDetail): string[] {
  const r = detail.reconciliation
  return [
    ...xtapeLines(detail),
    '────────────────────────────',
    'RECONCILIATION',
    `  Expected           ${formatCurrency(r.expected_cash)}`,
    `  Counted            ${formatCurrency(r.actual_cash)}`,
    `  Variance           ${formatCurrency(r.variance)}`,
    `Closed: ${formatDateTime(detail.closed_at ?? new Date().toISOString())}`,
  ]
}

function openPrintWindow(title: string, lines: string[]) {
  const win = window.open('', '_blank', 'width=640,height=880')
  if (!win) return
  const body = lines
    .map((line) => {
      const text = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const mono = /^[A-Z0-9#/-]+( REPORT| #)/.test(line)
      return `<div style="font-family:${mono ? 'ui-monospace,monospace' : 'monospace'};white-space:pre;line-height:1.55">${text}</div>`
    })
    .join('')
  win.document.write(
    `<!doctype html><html><head><title>${title}</title><style>body{padding:28px;background:#fff;color:#111}</style></head><body>${body}</body></html>`,
  )
  win.document.close()
  win.focus()
  win.onload = () =>
    setTimeout(() => {
      win.print()
    }, 160)
}

export function ShiftDetailPage() {
  const { id } = useParams()
  const shiftId = id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canAny } = usePermissions()

  const [denoms, setDenoms] = useState<DenomCounts>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])) as DenomCounts,
  )
  const [notes, setNotes] = useState('')
  const [closureMode, setClosureMode] = useState<'handover' | 'full'>('full')
  const [coSign, setCoSign] = useState(false)
  const [movementType, setMovementType] = useState<'drop' | 'payout'>('drop')
  const [movementDialog, setMovementDialog] = useState(false)
  const [movementAmount, setMovementAmount] = useState('0')
  const [movementReason, setMovementReason] = useState('')
  const [zOpen, setZOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const detailQuery = useQuery({
    queryKey: ['shifts', 'detail', shiftId],
    queryFn: () => shiftApi.detail(shiftId),
    enabled: !!shiftId,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  const detail = detailQuery.data?.data
  const isOpen = detail?.status === 'open'
  const canOperate = canAny('shifts.operate', 'shifts.reconcile')

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isOpen])

  const counted = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + (denoms[d] ?? 0) * d, 0),
    [denoms],
  )

  const variance = detail ? counted - detail.kpis.expected_drawer : 0
  const varianceKind =
    Math.abs(variance) < 0.005 ? 'match' : variance < 0 ? 'deficit' : 'surplus'

  const elapsedMs = detail
    ? isOpen
      ? Math.max(0, now - Date.parse(detail.opened_at))
      : detail.closed_at
        ? Math.max(0, Date.parse(detail.closed_at) - Date.parse(detail.opened_at))
        : 0
    : 0

  const recordMovement = useMutation({
    mutationFn: (input: { type: 'drop' | 'payout'; amount: number; reason?: string }) =>
      shiftApi.recordMovement(shiftId, input),
    onSuccess: (_data, vars) => {
      toast.success(vars.type === 'drop' ? 'Safe drop recorded' : 'Paid out recorded')
      setMovementDialog(false)
      setMovementAmount('0')
      setMovementReason('')
      void queryClient.invalidateQueries({ queryKey: ['shifts', 'detail', shiftId] })
    },
    onError: (err) => {
      toast.error('Could not record movement', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const closeShift = useMutation({
    mutationFn: (input: { actual_cash: number; notes?: string }) =>
      shiftApi.close({ ...input, shift_id: Number(shiftId) }),
    onSuccess: () => {
      toast.success('Shift closed — Z-report ready')
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
      setZOpen(true)
    },
    onError: (err) => {
      toast.error('Could not close shift', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const resetCount = () => {
    setDenoms(Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])) as DenomCounts)
    toast.info('Denomination count reset')
  }

  const bump = (target: number, delta: number) => {
    setDenoms((prev) => ({ ...prev, [target]: Math.max(0, (prev[target] ?? 0) + delta) }))
  }

  const printX = () => {
    if (!detail) return
    openPrintWindow(`X-REPORT Shift #${detail.id}`, xtapeLines(detail))
  }

  const printZ = () => {
    if (!detail) return
    openPrintWindow(`Z-REPORT Shift #${detail.id}`, zReportLines(detail))
  }

  const submitClose = () => {
    if (!detail) return
    closeShift.mutate({ actual_cash: counted, notes: notes.trim() || undefined })
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Button variant="ghost" size="icon" aria-label="Back to shifts" onClick={() => navigate('/shifts')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
              {detail ? `${detail.branch_name} • Till Session` : 'Till Session'}
            </p>
            <h1 className="flex items-center gap-2 truncate text-lg font-bold tracking-tight text-foreground">
              Shift #{detail?.id ?? '…'}
              {detail && <StatusBadge status={detail.status} />}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <Landmark className="h-3 w-3" />
              {detail ? `${detail.branch_name} • ${detail.terminal}` : 'Loading…'}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider',
            detailQuery.isFetching ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', detailQuery.isFetching ? 'bg-warning' : 'bg-success')} />
          {detailQuery.isFetching ? 'Syncing' : 'Synced'}
        </span>
      </div>

      {detailQuery.isError && (
        <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />
      )}

      {detailQuery.isLoading && !detail && (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      )}

      {detail && (
        <>
          <TelemetryBanner detail={detail} elapsed={elapsedMs} isOpen={isOpen} />

          <DrawerKpiGrid detail={detail} />

          <ActionRibbon
            detail={detail}
            canOperate={canOperate}
            onDrop={() => {
              setMovementType('drop')
              setMovementAmount('0')
              setMovementDialog(true)
            }}
            onPayout={() => {
              setMovementType('payout')
              setMovementAmount('0')
              setMovementDialog(true)
            }}
            onPrintX={printX}
          />

          <DrawerJournal events={detail.journal} />

          {isOpen ? (
            <DenominationCount
              denoms={denoms}
              onChange={bump}
              onReset={resetCount}
              counted={counted}
              expected={detail.kpis.expected_drawer}
              variance={variance}
              varianceKind={varianceKind}
            />
          ) : (
            <ReconSnapshot detail={detail} onPrintZ={printZ} />
          )}

          {isOpen && (
            <CloseProtocol
              canOperate={canOperate}
              detail={detail}
              counted={counted}
              closureMode={closureMode}
              onModeChange={setClosureMode}
              coSign={coSign}
              onCoSignChange={setCoSign}
              notes={notes}
              onNotesChange={setNotes}
              onClose={submitClose}
              closing={closeShift.isPending}
            />
          )}
        </>
      )}

      <MovementDialog
        open={movementDialog}
        onOpenChange={setMovementDialog}
        type={movementType}
        amount={movementAmount}
        onAmountChange={setMovementAmount}
        reason={movementReason}
        onReasonChange={setMovementReason}
        onSubmit={() =>
          recordMovement.mutate({
            type: movementType,
            amount: Number(movementAmount) || 0,
            reason: movementReason.trim() || undefined,
          })
        }
        pending={recordMovement.isPending}
      />

      <ZReportDialog
        detail={detail}
        open={zOpen}
        onOpenChange={setZOpen}
        counted={counted}
        onPrint={printZ}
        onBack={() => navigate('/shifts')}
      />
    </div>
  )
}

function TelemetryBanner({
  detail,
  elapsed,
  isOpen,
}: {
  detail: ShiftDetail
  elapsed: number
  isOpen: boolean
}) {
  const supervisor = detail.supervisor
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider',
              isOpen ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'animate-pulse bg-success' : 'bg-muted-foreground')} />
            {isOpen ? 'Active Session' : 'Closed Session'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Till #{detail.branch_code}
          </span>
        </div>
        <Badge variant="outline" className="font-mono">
          {detail.terminal}
        </Badge>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-foreground">{detail.branch_name}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {startedLine(detail.opened_at, detail.terminal)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Elapsed</p>
          <p
            className={cn(
              'font-mono text-xl font-bold tabular-nums tracking-tight',
              isOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {formatElapsed(elapsed)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-sunken p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{detail.user_name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Staff #{detail.user_id} • {detail.user_role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-sunken p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{supervisor?.name ?? 'Supervisor on duty'}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {supervisor?.role ?? 'Co-sign required at close'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DrawerKpiGrid({ detail }: { detail: ShiftDetail }) {
  const k = detail.kpis
  const cells = [
    {
      label: 'Opening Float',
      value: formatCurrency(k.opening_float),
      meta: 'start float',
      icon: Wallet,
      tone: 'text-primary',
      ring: 'bg-primary/15',
    },
    {
      label: 'Net Cash Sales',
      value: formatCurrency(k.net_cash_sales),
      meta: `${k.cash_transactions} Transactions`,
      icon: Banknote,
      tone: 'text-success',
      ring: 'bg-success/15',
    },
    {
      label: 'Digital & POS',
      value: formatCurrency(k.digital_pos),
      meta: `${k.digital_transactions} Transactions`,
      icon: CircleDollarSign,
      tone: 'text-info',
      ring: 'bg-info/15',
    },
    {
      label: 'Expected In-Drawer',
      value: formatCurrency(k.expected_drawer),
      meta: 'reconciled',
      icon: Calculator,
      tone: 'text-warning',
      ring: 'bg-warning/15',
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col justify-between rounded-2xl border border-border bg-surface-elevated p-3.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{cell.label}</span>
            <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', cell.ring, cell.tone)}>
              <cell.icon className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2.5 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {cell.value}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{cell.meta}</p>
        </div>
      ))}
    </div>
  )
}

function ActionRibbon({
  detail,
  canOperate,
  onDrop,
  onPayout,
  onPrintX,
}: {
  detail: ShiftDetail
  canOperate: boolean
  onDrop: () => void
  onPayout: () => void
  onPrintX: () => void
}) {
  const kickDrawer = () => {
    toast.info('No cash drawer hardware bridge is connected to this terminal')
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TerminalSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Till Hardware Actions</h2>
        </div>
        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3 w-3 text-warning" />
          Link: {detail.terminal}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 justify-start text-success" disabled={!canOperate || !detail || detail.status !== 'open'} onClick={onDrop}>
          <ArrowUpRight className="h-4 w-4" /> Safe Drop
        </Button>
        <Button variant="outline" className="h-11 justify-start text-warning" disabled={!canOperate || !detail || detail.status !== 'open'} onClick={onPayout}>
          <ArrowDownLeft className="h-4 w-4" /> Paid Out / Petty
        </Button>
        <Button variant="outline" className="h-11 justify-start text-muted-foreground" disabled onClick={kickDrawer}>
          <Phone className="h-4 w-4" /> Kick Drawer
        </Button>
        <Button variant="outline" className="h-11 justify-start text-info" onClick={onPrintX}>
          <Printer className="h-4 w-4" /> Print X-Tape
        </Button>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <Fingerprint className="h-3 w-3 text-primary" />
        Pulse Port: RJ11 • Hardware bridge not detected
      </div>
    </div>
  )
}

function DrawerJournal({ events }: { events: ShiftJournalEvent[] }) {
  const reversed = [...events].reverse()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ReceiptText className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">Shift Drawer Journal</h2>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          {events.length} Events
        </span>
      </div>
      <div className="relative flex flex-col gap-3 pl-6 pt-1">
        <div className="absolute bottom-3 left-2.5 top-3 w-0.5 bg-border" />
        {reversed.map((event) => {
          const inflow = event.signed_amount >= 0
          return (
            <div key={event.id} className="relative">
              <span
                className={cn(
                  'absolute -left-6 top-3 h-3 w-3 rounded-full ring-4 ring-surface',
                  inflow ? 'bg-success' : 'bg-destructive',
                )}
              />
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-elevated p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold',
                        JOURNAL_TONE[event.kind],
                      )}
                    >
                      {inflow ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {inflow ? '+' : '−'}
                      {formatCurrency(Math.abs(event.signed_amount))}
                    </span>
                    <h3 className="mt-1 truncate text-sm font-bold text-foreground">{event.label}</h3>
                  </div>
                  <span className="shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    {formatDate(event.happened_at, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Fingerprint className="h-3 w-3 text-primary" />
                    {(event.reference ?? event.note ?? 'ledger')}
                    {event.note && event.reference ? ` • ${event.note}` : ''}
                  </span>
                  <span className="text-foreground">Bal {formatCurrency(event.balance)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DenominationCount({
  denoms,
  onChange,
  onReset,
  counted,
  expected,
  variance,
  varianceKind,
}: {
  denoms: DenomCounts
  onChange: (target: number, delta: number) => void
  onReset: () => void
  counted: number
  expected: number
  variance: number
  varianceKind: 'match' | 'deficit' | 'surplus'
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Physical Cash Count</h2>
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {DENOMINATIONS.map((target) => {
          const count = denoms[target] ?? 0
          return (
            <div key={target} className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken p-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-foreground">₦{target.toLocaleString()}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  N{target.toLocaleString()} notes
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon-sm" aria-label={`Decrement ₦${target}`} onClick={() => onChange(target, -1)}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  className="h-9 w-16 text-center font-mono tabular-nums"
                  value={count}
                  inputMode="numeric"
                  onChange={(e) => onChange(target, Number(e.target.value || 0) - count)}
                />
                <Button variant="secondary" size="icon-sm" aria-label={`Increment ₦${target}`} onClick={() => onChange(target, 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Counted Physical Cash</span>
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(counted)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Expected Drawer Settle</span>
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(expected)}</span>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5',
          varianceKind === 'match'
            ? 'bg-success/15 text-success'
            : varianceKind === 'deficit'
              ? 'bg-destructive/15 text-destructive'
              : 'bg-warning/15 text-warning',
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          {varianceKind === 'match' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {varianceKind === 'match' ? 'Match' : varianceKind === 'deficit' ? 'Deficit' : 'Surplus'}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums">
          {variance > 0 ? '+' : ''}
          {formatCurrency(variance)}
        </span>
      </div>
    </div>
  )
}

function ReconSnapshot({ detail, onPrintZ }: { detail: ShiftDetail; onPrintZ: () => void }) {
  const r = detail.reconciliation
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">Reconciliation Snapshot</h2>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-info" onClick={onPrintZ}>
          <Printer className="h-3.5 w-3.5" /> Z-Report
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Expected</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(r.expected_cash)}</p>
        </div>
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Counted</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(r.actual_cash)}</p>
        </div>
      </div>
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5',
          Math.abs(r.variance) < 0.005
            ? 'bg-success/15 text-success'
            : r.variance < 0
              ? 'bg-destructive/15 text-destructive'
              : 'bg-warning/15 text-warning',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wider">
          {Math.abs(r.variance) < 0.005 ? 'Match' : r.variance < 0 ? 'Deficit' : 'Surplus'}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums">
          {r.variance > 0 ? '+' : ''}
          {formatCurrency(r.variance)}
        </span>
      </div>
    </div>
  )
}

function CloseProtocol({
  canOperate,
  detail,
  counted,
  closureMode,
  onModeChange,
  coSign,
  onCoSignChange,
  notes,
  onNotesChange,
  onClose,
  closing,
}: {
  canOperate: boolean
  detail: ShiftDetail
  counted: number
  closureMode: 'handover' | 'full'
  onModeChange: (mode: 'handover' | 'full') => void
  coSign: boolean
  onCoSignChange: (checked: boolean) => void
  notes: string
  onNotesChange: (value: string) => void
  onClose: () => void
  closing: boolean
}) {
  const supervisor = detail.supervisor
  const dirty = Math.abs(counted - detail.kpis.expected_drawer) >= 0.005
  const mode = detail.status === 'open' ? closureMode : 'full'

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <LogOut className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Shift Conclusion Protocol</h2>
        </div>
        <span className="flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase text-primary">
          3 / 3
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange('handover')}
          className={cn(
            'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
            mode === 'handover' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-surface-elevated text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn('grid h-4 w-4 place-items-center rounded-full border', mode === 'handover' ? 'border-primary' : 'border-border')}>
              {mode === 'handover' && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            Handover
          </span>
          <span className="text-[10px] leading-snug">Next cashier takes over</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('full')}
          className={cn(
            'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
            mode === 'full' ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-surface-elevated text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn('grid h-4 w-4 place-items-center rounded-full border', mode === 'full' ? 'border-primary' : 'border-border')}>
              {mode === 'full' && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            Full Close
          </span>
          <span className="text-[10px] leading-snug">Safe deposit & finalize</span>
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3">
        <input
          type="checkbox"
          checked={coSign}
          onChange={(e) => onCoSignChange(e.target.checked)}
          className="h-4 w-4 rounded accent-primary"
        />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">Supervisor Biometric Co-Sign</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {supervisor ? `${supervisor.name} (${supervisor.role}) confirms the physical cash count.` : 'A supervisor must confirm the physical cash count.'}
          </span>
        </span>
      </label>

      <div className="grid gap-2">
        <Label htmlFor="close-notes">Variance note (optional)</Label>
        <Input
          id="close-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={dirty ? 'Explain the variance before closing…' : 'Shift notes…'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-elevated p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Session Gross Total</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(detail.kpis.gross_sales)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Settle</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(counted)}
          </p>
        </div>
      </div>

      <Button
        className="h-12 w-full"
        size="lg"
        loading={closing}
        disabled={!canOperate || !coSign || counted <= 0}
        onClick={onClose}
      >
        <LogOut className="h-4 w-4" />
        {mode === 'full' ? 'Close Shift & Generate Z-Report' : 'Handover & Generate Z-Report'}
      </Button>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-success" /> PCI-DSS Hardware Audit
        </span>
        <span className="flex items-center gap-1">
          <Clock3 className="h-3 w-3" /> Signed {coSign ? '✓' : 'Pending'}
        </span>
      </div>
    </div>
  )
}

function MovementDialog({
  open,
  onOpenChange,
  type,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'drop' | 'payout'
  amount: string
  onAmountChange: (value: string) => void
  reason: string
  onReasonChange: (value: string) => void
  onSubmit: () => void
  pending: boolean
}) {
  const isDrop = type === 'drop'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isDrop ? 'Safe Drop' : 'Paid Out / Petty'}</DialogTitle>
          <DialogDescription>
            {isDrop
              ? 'Move cash from the drawer into the vault. Expected in-drawer decreases.'
              : 'Record an authorized drawer payout such as petty cash.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="movement-amount">Amount (₦)</Label>
            <Input
              id="movement-amount"
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="movement-reason">{isDrop ? 'Reference note' : 'Reason (required)'}</Label>
            <Input
              id="movement-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={isDrop ? 'e.g. Midday vault drop' : 'e.g. Petty cash — transport'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={pending}
            disabled={!Number(amount) || Number(amount) <= 0}
            onClick={onSubmit}
          >
            Record {isDrop ? 'drop' : 'payout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ZReportDialog({
  detail,
  open,
  onOpenChange,
  counted,
  onPrint,
  onBack,
}: {
  detail?: ShiftDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  counted: number
  onPrint: () => void
  onBack: () => void
}) {
  const r = detail?.reconciliation
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Z-Report Ready</DialogTitle>
          <DialogDescription>Shift closed and signed. The drawer variance is below.</DialogDescription>
        </DialogHeader>
        {r && detail && (
          <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-3 font-mono text-[11px] text-muted-foreground">
            <div className="flex justify-between"><span>Shift #</span><span className="text-foreground">{detail.id} • {detail.terminal}</span></div>
            <div className="flex justify-between"><span>Operator</span><span className="text-foreground">{detail.user_name}</span></div>
            <div className="flex justify-between"><span>Gross sales</span><span className="text-foreground">{formatCurrency(detail.kpis.gross_sales)}</span></div>
            <div className="flex justify-between"><span>Counted settle</span><span className="text-foreground">{formatCurrency(counted)}</span></div>
            <div className="flex justify-between"><span>Expected</span><span className="text-foreground">{formatCurrency(r.expected_cash)}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span>Variance</span>
              <span className={cn(r.variance < 0 ? 'text-destructive' : r.variance > 0 ? 'text-warning' : 'text-success')}>
                {r.variance > 0 ? '+' : ''}{formatCurrency(r.variance)}
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to shifts
          </Button>
          <Button size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4" /> Print Z-Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}