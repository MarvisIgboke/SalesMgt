import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Check,
  Clock4,
  Cpu,
  CreditCard,
  Download,
  Fingerprint,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  ShieldPlus,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import {
  staffApi,
  type PermissionItem,
  type Role,
  type StaffInput,
  type StaffSummary,
  type StaffSummaryMember,
} from '@/lib/api/endpoints/staff'
import { departmentsApi } from '@/lib/api/endpoints/departments'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { LoadingState } from '@/components/common/loading-state'
import { ScannerDialog } from '@/features/pos/scanner-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatCurrency, formatDateTime, formatNumber, formatRelative, initials } from '@/lib/utils'

const ALL = 'all'
const ON_DUTY = 'on_duty'
const CASHIERS = 'cashiers'
const INVENTORY = 'inventory'
const SUPERVISORS = 'supervisors'
const OFF_DUTY = 'off_duty'

const CRUD_ACTIONS = ['view', 'create', 'edit', 'delete'] as const
type CrudAction = (typeof CRUD_ACTIONS)[number]

const CRUD_LABELS: Record<CrudAction, string> = {
  view: 'View',
  create: 'Add',
  edit: 'Edit',
  delete: 'Delete',
}

interface FilterOption {
  key: string
  label: string
  count: number
  tone?: 'success'
}

interface ResourceRow {
  prefix: string
  label: string
  cells: Record<CrudAction, PermissionItem | undefined>
}

function buildFilters(summary: StaffSummary | undefined): FilterOption[] {
  if (!summary) return []
  return [
    { key: ALL, label: 'All Staff', count: summary.filters.all },
    { key: ON_DUTY, label: 'On Duty', count: summary.filters.on_duty, tone: 'success' },
    { key: CASHIERS, label: 'Cashiers & Tills', count: summary.filters.cashiers },
    { key: INVENTORY, label: 'Inventory Leads', count: summary.filters.inventory },
    { key: SUPERVISORS, label: 'Supervisors', count: summary.filters.supervisors },
    { key: OFF_DUTY, label: 'Off Duty', count: summary.filters.off_duty },
  ]
}

function actionOf(key: string): string {
  return key.split('.')[1] ?? ''
}

function isCrud(action: string): action is CrudAction {
  return (CRUD_ACTIONS as readonly string[]).includes(action)
}

function buildResourceRows(catalog: PermissionItem[]): ResourceRow[] {
  const map = new Map<string, ResourceRow>()
  for (const permission of catalog) {
    const prefix = permission.key.split('.')[0]
    const action = actionOf(permission.key)
    if (!prefix || !isCrud(action)) continue
    const row =
      map.get(prefix) ??
      ({ prefix, label: permission.group, cells: { view: undefined, create: undefined, edit: undefined, delete: undefined } } as ResourceRow)
    row.cells[action] = permission
    map.set(prefix, row)
  }
  return Array.from(map.values())
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

function metricGlyph(kind: 'staff' | 'tills' | 'gmv' | 'drawer', className: string) {
  if (kind === 'staff') return <Users className={className} />
  if (kind === 'tills') return <Wallet className={className} />
  if (kind === 'gmv') return <Activity className={className} />
  return <ShieldCheck className={className} />
}

export function StaffPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const currentUserId = session?.user.id ?? -1
  const { can } = usePermissions()
  const canManage = can('staff.permissions')
  const canEdit = can('staff.edit') || (session?.user.roles.includes('Super Admin') ?? false)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(ALL)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [editing, setEditing] = useState<StaffSummaryMember | null>(null)
  const [accessMember, setAccessMember] = useState<StaffSummaryMember | null>(null)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [toggling, setToggling] = useState<StaffSummaryMember | null>(null)

  const summaryQuery = useQuery({
    queryKey: ['staff', 'summary'],
    queryFn: () => staffApi.summary(),
    refetchInterval: 30_000,
  })

  const summary = summaryQuery.data?.data
  const members = summary?.members ?? []

  const term = search.trim().toLowerCase()
  const visible = members.filter((member) => {
    if (filter === ON_DUTY && !member.on_duty) return false
    if (filter === OFF_DUTY && member.on_duty) return false
    if (filter === CASHIERS && !member.is_cashier) return false
    if (filter === INVENTORY && !member.is_inventory_lead) return false
    if (filter === SUPERVISORS && !member.is_supervisor) return false
    if (!term) return true
    return [member.name, member.email, member.employee_code, member.tier, member.phone ?? '', ...member.roles, ...member.branch_names]
      .some((value) => value.toLowerCase().includes(term))
  })

  const filters = buildFilters(summary)

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['staff'] })
  }

  const openCreate = () => {
    setEditing(null)
    setMemberOpen(true)
  }

  const openEdit = (member: StaffSummaryMember) => {
    setEditing(member)
    setMemberOpen(true)
  }

  const openAccess = (member: StaffSummaryMember) => {
    if (!canManage) {
      toast.error('You do not have permission to manage access')
      return
    }
    setAccessMember(member)
  }

  const exportPayroll = () => {
    if (members.length === 0) {
      toast.info('Nothing to export yet')
      return
    }
    const rows: string[][] = [
      ['Code', 'Name', 'Role', 'Tier', 'Branches', 'Status', 'On Duty', 'Sales Today', 'Orders', 'Shift Cash', 'Permissions'],
      ...members.map((member) => [
        member.employee_code,
        member.name,
        member.roles[0] ?? 'Unassigned',
        member.tier,
        member.branch_names.join(' / ') || '—',
        member.is_active ? 'Active' : 'Inactive',
        member.on_duty ? 'Yes' : 'No',
        String(member.sales_today),
        String(member.orders_today),
        String(member.shift?.expected_cash ?? 0),
        String(member.permissions_count),
      ]),
    ]
    downloadCsv('payroll-roster.csv', rows)
    toast.success('Payroll roster exported')
  }

  const lockInactiveTills = () => {
    navigate('/shifts')
    toast.info('Opening the shift ledger to reconcile and lock tills.')
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <TelemetryBar
        onDuty={summary?.staff.on_duty}
        total={summary?.staff.total}
        tills={summary?.tills.open}
        syncing={summaryQuery.isFetching}
        onSync={() => void summaryQuery.refetch()}
      />

      <PageHeader
        eyebrow="Workforce Operations"
        title="Staff & Access"
        description="Shift roster, till terminals and per-member access control."
      />

      <MetricGrid summary={summary} loading={summaryQuery.isLoading} errored={summaryQuery.isError} />

      <ActionBar
        canManage={canEdit || canManage}
        onAddStaff={openCreate}
        onRoster={() => navigate('/shifts')}
        onSecurity={() => setSecurityOpen(true)}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code, role or branch…"
            className="h-11 rounded-xl pl-10 pr-10"
          />
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Scan badge to locate staff"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
        </Button>
      </div>

      <FilterPills options={filters} active={filter} onSelect={setFilter} />

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Roster &amp; Access Matrix
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatNumber(visible.length)} of {formatNumber(summary?.staff.total ?? 0)} staff
        </span>
      </div>

      {summaryQuery.isLoading && <RosterSkeleton />}

      {!summaryQuery.isLoading && summaryQuery.isError && (
        <ErrorState error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length === 0 && (
        <EmptyState
          title="No staff found"
          description={
            search || filter !== ALL
              ? 'Try a different search or filter.'
              : 'Add your first team member to start tracking duty, sales and access.'
          }
          icon={<Users className="h-6 w-6" />}
          action={
            canEdit || canManage ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add member
              </Button>
            ) : undefined
          }
        />
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canEdit={canEdit}
              canManage={canManage}
              isSelf={member.id === currentUserId}
              onAccess={() => openAccess(member)}
              onEdit={() => openEdit(member)}
              onToggleActive={() => setToggling(member)}
            />
          ))}
        </div>
      )}

      {summary && (
        <HandoverFooter summary={summary} onLock={lockInactiveTills} onExport={exportPayroll} />
      )}

      {memberOpen && <MemberDialog member={editing} onClose={() => setMemberOpen(false)} onSaved={reload} />}

      {accessMember && (
        <AccessDialog
          member={accessMember}
          isSelf={accessMember.id === currentUserId}
          onClose={() => setAccessMember(null)}
        />
      )}

      {securityOpen && (
        <SecurityDialog
          onClose={() => setSecurityOpen(false)}
          onNewRole={() => {
            setSecurityOpen(false)
            setRoleOpen(true)
          }}
        />
      )}

      {roleOpen && <RoleDialog onClose={() => setRoleOpen(false)} />}

      {toggling && (
        <ToggleActiveDialog
          member={toggling}
          onClose={() => setToggling(null)}
          onSaved={() => {
            setToggling(null)
            reload()
          }}
        />
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
  onDuty,
  total,
  tills,
  syncing,
  onSync,
}: {
  onDuty?: number
  total?: number
  tills?: number
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
            Shift Roster &amp; Access Audit
          </span>
          <span className="hidden text-muted-foreground sm:inline">•</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
            {onDuty !== undefined ? `${formatNumber(onDuty)} active on duty` : 'Workforce fabric'}
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
          <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Roster:
          </span>
          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            {formatNumber(total ?? 0)} staff • {formatNumber(tills ?? 0)} tills live
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
  summary?: StaffSummary
  loading: boolean
  errored: boolean
}) {
  const dim = loading ? '—' : errored ? 'n/a' : undefined
  const activeShare =
    summary && summary.staff.total > 0
      ? Math.round((summary.staff.active / summary.staff.total) * 100)
      : 0
  const accuracy = summary?.drawer.accuracy_pct ?? 0
  const variance = summary?.drawer.variance ?? 0

  const cards: {
    kind: 'staff' | 'tills' | 'gmv' | 'drawer'
    label: string
    value: string
    sub: string
    subTone: string
    iconTone: string
    footer: [string, string]
  }[] = [
    {
      kind: 'staff',
      label: 'Active Staff',
      value: dim ?? `${summary?.staff.active ?? 0} / ${summary?.staff.total ?? 0}`,
      sub: dim ?? `${summary?.staff.on_duty ?? 0} on duty now`,
      subTone: 'text-success',
      iconTone: 'bg-success/15 text-success',
      footer: [`${activeShare}% active`, `${summary?.staff.off_duty ?? 0} off duty`],
    },
    {
      kind: 'tills',
      label: 'Till Terminals',
      value: dim ?? `${formatNumber(summary?.tills.open ?? 0)} Open`,
      sub: dim ?? `${formatNumber(summary?.tills.branches ?? 0)} branches live`,
      subTone: 'text-primary',
      iconTone: 'bg-info/15 text-info',
      footer: [`${formatNumber(summary?.tills.open ?? 0)} terminals`, 'Shift ledger'],
    },
    {
      kind: 'gmv',
      label: 'Shift Attributed',
      value: dim ?? formatCurrency(summary?.shift_gmv.value ?? 0),
      sub: dim ?? `${formatNumber(summary?.shift_gmv.orders ?? 0)} orders settled`,
      subTone: 'text-primary',
      iconTone: 'bg-primary/10 text-primary',
      footer: [
        `${formatNumber(summary?.shift_gmv.orders ?? 0)} orders`,
        `Avg ${formatCurrency(summary?.shift_gmv.average ?? 0)}`,
      ],
    },
    {
      kind: 'drawer',
      label: 'Drawer Audit',
      value: dim ?? `${accuracy}%`,
      sub:
        dim ??
        (variance === 0
          ? '₦0.00 variance logged'
          : `${formatCurrency(variance)} variance`),
      subTone: variance < 0 ? 'text-warning' : 'text-success',
      iconTone: 'bg-tertiary/15 text-tertiary',
      footer: [`${formatNumber(summary?.drawer.audits ?? 0)} audits`, 'Last 24h close'],
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
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="truncate">{card.footer[0]}</span>
            <span className="truncate">{card.footer[1]}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionBar({
  canManage,
  onAddStaff,
  onRoster,
  onSecurity,
}: {
  canManage: boolean
  onAddStaff: () => void
  onRoster: () => void
  onSecurity: () => void
}) {
  return (
    <div className="space-y-2">
      {canManage && (
        <button
          type="button"
          onClick={onAddStaff}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Add Staff / Role Assignment
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRoster}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <Clock4 className="h-4 w-4 text-primary" />
          Shift Roster &amp; Clock
        </button>
        <button
          type="button"
          onClick={onSecurity}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-sunken"
        >
          <ShieldCheck className="h-4 w-4 text-secondary" />
          Access &amp; Security
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
            {option.tone === 'success' && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
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

function MemberCard({
  member,
  canEdit,
  canManage,
  isSelf,
  onAccess,
  onEdit,
  onToggleActive,
}: {
  member: StaffSummaryMember
  canEdit: boolean
  canManage: boolean
  isSelf: boolean
  onAccess: () => void
  onEdit: () => void
  onToggleActive: () => void
}) {
  const stripe = !member.is_active
    ? 'bg-muted-foreground'
    : member.on_duty
      ? 'bg-secondary'
      : 'bg-primary'

  const role = member.roles[0] ?? 'Unassigned'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', stripe)} aria-hidden />

      <div className="p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-semibold tracking-tight text-foreground">{member.name}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  #{member.employee_code}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </span>
                <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                  {member.tier}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Staff actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                    Edit member
                  </DropdownMenuItem>
                  {!isSelf && (
                    <DropdownMenuItem
                      onClick={onToggleActive}
                      className={member.is_active ? 'text-destructive focus:text-destructive' : undefined}
                    >
                      <Lock className="h-4 w-4" />
                      {member.is_active ? 'Deactivate account' : 'Activate account'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider',
              member.on_duty ? 'text-secondary' : 'text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', member.on_duty ? 'bg-secondary' : 'bg-muted-foreground')} />
            {member.on_duty ? 'On Duty' : 'Off Duty'}
          </span>
          {member.on_duty && member.shift ? (
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              • {member.shift.branch_name ?? 'Branch'} • since {formatDateTime(member.shift.opened_at)}
            </span>
          ) : (
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              • {member.branch_names.join(' / ') || 'No branch assigned'}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-2.5">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Sales Today</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatCurrency(member.sales_today)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {formatNumber(member.orders_today)} orders
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Till Cash</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {member.shift ? formatCurrency(member.shift.expected_cash) : '—'}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {member.shift ? 'Expected' : 'No open till'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Access</p>
            <p className="truncate font-mono text-xs font-semibold text-foreground">
              {formatNumber(member.permissions_count)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">permissions</p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          <PermissionPill label="Credit Sales" on={member.can.credit} />
          <PermissionPill label="Discounts" on={member.can.discount} />
          <PermissionPill label="Refunds" on={member.can.refund} />
          <PermissionPill label="Approvals" on={member.can.approve} />
          <PermissionPill label="Reconcile" on={member.can.reconcile} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Last active {formatRelative(member.last_active_at)}
          </span>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button variant="secondary" size="sm" onClick={onAccess}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Access
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PermissionPill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        on
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-surface-sunken text-muted-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-success' : 'bg-muted-foreground')} />
      {label}
    </span>
  )
}

function HandoverFooter({
  summary,
  onLock,
  onExport,
}: {
  summary: StaffSummary
  onLock: () => void
  onExport: () => void
}) {
  const varianceTone = summary.drawer.variance < 0 ? 'text-warning' : 'text-secondary'
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Shift Handover &amp; Payroll
        </span>
        <span className="rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-[10px] text-secondary">
          Audit {summary.drawer.accuracy_pct}%
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">On Duty</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
            {summary.staff.on_duty}/{summary.staff.total}
          </p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Open Tills</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{summary.tills.open}</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Drawer Var.</p>
          <p className={cn('mt-0.5 font-mono text-sm font-bold', varianceTone)}>
            {formatCurrency(summary.drawer.variance)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-3">
        <Button variant="outline" size="sm" onClick={onLock}>
          <Lock className="h-3.5 w-3.5" />
          Lock Inactive Tills
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export Payroll
        </Button>
      </div>
    </div>
  )
}

function RosterSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-2xl border border-border bg-surface-elevated p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-3 h-16 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

function AccessToggle({
  checked,
  locked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean
  locked: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || locked}
      onClick={onToggle}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md border transition-colors',
        checked
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-surface-sunken text-muted-foreground',
        (disabled || locked) && 'cursor-not-allowed opacity-60',
      )}
    >
      {checked ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30" />
      )}
    </button>
  )
}

function AccessRow({
  checked,
  locked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean
  locked: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}) {
  const interactive = !(disabled || locked)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={!interactive}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface-sunken',
        !interactive && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded border',
          checked ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground',
        )}
      >
        {checked ? (
          <Check className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30" />
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function MemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: StaffSummaryMember | null
  onClose: () => void
  onSaved: () => void
}) {
  const branches = useAppStore((s) => s.branches)
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(member?.is_active ?? true)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(member?.roles ?? [])
  const [selectedBranches, setSelectedBranches] = useState<number[]>(member?.branch_ids ?? [])
  const [departmentId, setDepartmentId] = useState<number | null>(member?.department_id ?? null)

  const roles = useQuery({
    queryKey: ['staff', 'roles'],
    queryFn: () => staffApi.roles(),
    placeholderData: (prev) => prev,
  })

  const departments = useQuery({
    queryKey: ['departments', { with_counts: false }],
    queryFn: () => departmentsApi.list(),
    placeholderData: (prev) => prev,
  })

  const save = useMutation({
    mutationFn: (input: StaffInput) =>
      member ? staffApi.update(member.id, input) : staffApi.create(input),
    onSuccess: () => {
      toast.success(member ? 'Member updated' : 'Member created')
      onClose()
      onSaved()
    },
    onError: (err) => {
      toast.error(member ? 'Could not update member' : 'Could not create member', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const toggleRole = (value: string) => {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  const toggleBranch = (value: number) => {
    setSelectedBranches((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  const submit = () => {
    const input: StaffInput = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      roles: selectedRoles,
      branch_ids: selectedBranches,
      department_id: departmentId,
    }
    if (member) {
      input.is_active = isActive
    } else if (password.trim()) {
      input.password = password.trim()
    }
    save.mutate(input)
  }

  const canSave = name.trim().length > 0 && email.trim().length > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Access is enforced server-side. Changes apply on the next request.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Bello"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@business.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="staff-phone">Phone</Label>
            <Input
              id="staff-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>
          {!member && (
            <div className="grid gap-2">
              <Label htmlFor="staff-password">Initial password</Label>
              <Input
                id="staff-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a temporary password"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Roles</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(roles.data?.data ?? [])
                .filter((role: Role) => role.name !== 'Super Admin')
                .map((role: Role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.name)}
                      onChange={() => toggleRole(role.name)}
                    />
                    {role.name}
                  </label>
                ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Branches</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Department</Label>
            <Select
              value={departmentId != null ? String(departmentId) : '__none'}
              onValueChange={(v) => setDepartmentId(v === '__none' ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {(departments.data?.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sales reps only ring up products filed under their department.
            </p>
          </div>
          {member && (
            <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive members cannot sign in or ring up sales.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={save.isPending} disabled={!canSave} onClick={submit}>
            {member ? 'Save changes' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccessDialog({
  member,
  isSelf,
  onClose,
}: {
  member: StaffSummaryMember
  isSelf: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[] | null>(null)

  const detail = useQuery({
    queryKey: ['staff', member.id, 'permissions'],
    queryFn: () => staffApi.staffPermissions(member.id),
  })

  const catalog = detail.data?.data.catalog ?? []
  const roles = detail.data?.data.roles ?? []
  const direct = detail.data?.data.permissions ?? []
  const effective = detail.data?.data.effective_permissions ?? []
  const value = selected ?? effective

  const inherited = new Set(effective.filter((key) => !direct.includes(key)))
  const disabled = isSelf

  const resourceRows = buildResourceRows(catalog)
  const advanced = catalog.filter((permission) => {
    const action = actionOf(permission.key)
    return !isCrud(action) && permission.key !== 'sales.credit'
  })

  const creditOn = value.includes('sales.credit')
  const creditLocked = disabled

  const save = useMutation({
    mutationFn: () => staffApi.syncPermissions(member.id, value),
    onSuccess: () => {
      toast.success('Access updated')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err) => {
      toast.error('Could not update access', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const toggle = (key: string) => {
    if (disabled) return
    setSelected(value.includes(key) ? value.filter((item) => item !== key) : [...value, key])
  }

  const toggleCredit = (on: boolean) => {
    if (disabled) return
    setSelected(on ? [...value, 'sales.credit'] : value.filter((item) => item !== 'sales.credit'))
  }

  const advancedGroups = advanced.reduce<Map<string, PermissionItem[]>>((acc, permission) => {
    const list = acc.get(permission.group) ?? []
    list.push(permission)
    acc.set(permission.group, list)
    return acc
  }, new Map())

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Access &amp; Security · {member.name}</DialogTitle>
          <DialogDescription>
            Toggle exactly what this member can access. Rights inherited from
            {roles.length > 0 ? ` the ${roles.join(', ')} role` : ' assigned roles'} are pre-selected and can be revoked here.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading && <LoadingState variant="cards" rows={4} />}
        {detail.isError && <ErrorState error={detail.error} onRetry={() => detail.refetch()} />}

        {!detail.isLoading && !detail.isError && (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="grid gap-4">
              {isSelf && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 font-mono text-[11px] text-warning">
                  You cannot change your own permissions.
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Sell on Credit</p>
                    <p className="text-xs text-muted-foreground">
                      Allow this member to complete credit sales and settle later.
                    </p>
                    {inherited.has('sales.credit') && (
                      <span className="mt-0.5 inline-block rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        Granted via role
                      </span>
                    )}
                  </div>
                </div>
                <Switch checked={creditOn} disabled={creditLocked} onCheckedChange={toggleCredit} />
              </div>

              <div>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Page Access
                </p>
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] border-b border-border bg-surface-sunken px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Page</span>
                    <span className="text-center">View</span>
                    <span className="text-center">Add</span>
                    <span className="text-center">Edit</span>
                    <span className="text-center">Delete</span>
                  </div>
                  {resourceRows.map((row) => (
                    <div
                      key={row.prefix}
                      className="grid grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] items-center border-b border-border/60 px-3 py-1.5 last:border-b-0"
                    >
                      <span className="truncate pr-2 text-xs font-medium text-foreground">{row.label}</span>
                      {CRUD_ACTIONS.map((action) => {
                        const permission = row.cells[action]
                        return (
                          <span key={action} className="flex justify-center">
                            {permission ? (
                              <AccessToggle
                                checked={value.includes(permission.key)}
                                locked={false}
                                disabled={disabled}
                                label={`${CRUD_LABELS[action]} ${row.label}`}
                                onToggle={() => toggle(permission.key)}
                              />
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground/40">–</span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Advanced Actions
                </p>
                <div className="grid gap-3">
                  {Array.from(advancedGroups.entries()).map(([group, items]) => (
                    <div key={group} className="grid gap-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {group}
                      </p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {items.map((permission) => (
                          <AccessRow
                            key={permission.key}
                            checked={value.includes(permission.key)}
                            locked={false}
                            disabled={disabled}
                            label={permission.label}
                            onToggle={() => toggle(permission.key)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={save.isPending}
            disabled={detail.isLoading || isSelf}
            onClick={() => save.mutate()}
          >
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecurityDialog({
  onClose,
  onNewRole,
}: {
  onClose: () => void
  onNewRole: () => void
}) {
  const roles = useQuery({
    queryKey: ['staff', 'roles'],
    queryFn: () => staffApi.roles(),
    placeholderData: (prev) => prev,
  })

  const roleList = roles.data?.data ?? []

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Access &amp; Security</DialogTitle>
          <DialogDescription>
            Roles bundle permissions your team can be assigned. Open a member to tune their access.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {roleList.map((role) => (
              <div key={role.id} className="rounded-xl border border-border bg-surface-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{role.name}</p>
                  {role.is_custom && <Badge variant="outline">Custom</Badge>}
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {role.permissions.length} permissions
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={onNewRole}>
            <ShieldPlus className="h-4 w-4" />
            New role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [checked, setChecked] = useState<string[]>([])

  const permissions = useQuery({
    queryKey: ['staff', 'permissions'],
    queryFn: () => staffApi.permissions(),
    placeholderData: (prev) => prev,
  })

  const groups = (permissions.data?.data ?? []).reduce<Map<string, Array<{ key: string; label: string }>>>(
    (acc, permission) => {
      const list = acc.get(permission.group) ?? []
      list.push({ key: permission.key, label: permission.label })
      acc.set(permission.group, list)
      return acc
    },
    new Map(),
  )

  const create = useMutation({
    mutationFn: () =>
      staffApi.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: checked,
      }),
    onSuccess: () => {
      toast.success('Role created')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['staff', 'roles'] })
    },
    onError: (err) => {
      toast.error('Could not create role', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const toggle = (value: string) => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Pick the permissions this role grants. Rules are enforced by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Branch supervisor"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional summary of this role"
            />
          </div>
          <div className="grid gap-2">
            <Label>Permissions</Label>
            <ScrollArea className="h-64 pr-4">
              <div className="grid gap-4">
                {Array.from(groups.entries()).map(([group, items]) => (
                  <div key={group} className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    <div className="grid gap-2">
                      {items.map((permission) => (
                        <label key={permission.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked.includes(permission.key)}
                            onChange={() => toggle(permission.key)}
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ToggleActiveDialog({
  member,
  onClose,
  onSaved,
}: {
  member: StaffSummaryMember
  onClose: () => void
  onSaved: () => void
}) {
  const nextActive = !member.is_active
  const update = useMutation({
    mutationFn: () => staffApi.update(member.id, { is_active: nextActive }),
    onSuccess: () => {
      toast.success(nextActive ? 'Account activated' : 'Account deactivated')
      onSaved()
    },
    onError: (err) => {
      toast.error('Could not update member', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{nextActive ? 'Activate account?' : 'Deactivate account?'}</DialogTitle>
          <DialogDescription>
            {nextActive
              ? `${member.name} will regain sign-in and till access.`
              : `${member.name} will be blocked from signing in until reactivated.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={nextActive ? 'default' : 'destructive'}
            size="sm"
            loading={update.isPending}
            onClick={() => update.mutate()}
          >
            {nextActive ? 'Activate' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
