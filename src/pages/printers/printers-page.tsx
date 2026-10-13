import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Bluetooth,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer as PrinterIcon,
  ReceiptText,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Star,
  Tags,
  Trash2,
  Usb,
  Wifi,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { businessApi, type Branch } from '@/lib/api/endpoints/business'
import {
  printersApi,
  type Printer,
  type PrinterConnection,
  type PrinterInput,
  type PrinterPaperWidth,
  type PrinterStatus,
  type PrinterSummary,
  type PrinterType,
} from '@/lib/api/endpoints/printers'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatRelative } from '@/lib/utils'

const ALL = 'all'

const TYPE_META: Record<PrinterType, { label: string; icon: LucideIcon }> = {
  receipt: { label: 'Receipt', icon: ReceiptText },
  kitchen: { label: 'Kitchen ticket', icon: PrinterIcon },
  label: { label: 'Label', icon: Tags },
  a4: { label: 'A4 / Letter', icon: FileText },
  report: { label: 'Report', icon: BarChart3 },
}

const CONNECTION_META: Record<PrinterConnection, { label: string; icon: LucideIcon }> = {
  network: { label: 'Network', icon: Wifi },
  usb: { label: 'USB', icon: Usb },
  bluetooth: { label: 'Bluetooth', icon: Bluetooth },
  system: { label: 'System driver', icon: Server },
}

const STATUS_META: Record<PrinterStatus, { label: string; tone: string; icon: LucideIcon }> = {
  online: { label: 'Online', tone: 'text-success', icon: CheckCircle2 },
  offline: { label: 'Offline', tone: 'text-destructive', icon: XCircle },
  unknown: { label: 'Unknown', tone: 'text-muted-foreground', icon: Clock3 },
}

type StatusFilter = 'all' | 'online' | 'offline' | 'disabled'

export function PrintersPage() {
  const { can } = usePermissions()
  const canView = can('printers.view')
  const canManage = can('printers.manage')

  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PrinterType | typeof ALL>(ALL)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL)
  const [branchFilter, setBranchFilter] = useState<string>(ALL)
  const [editing, setEditing] = useState<Printer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Printer | null>(null)
  const [pingingId, setPingingId] = useState<number | null>(null)

  const printersQuery = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersApi.list().then((res) => res.data),
    enabled: canView,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => businessApi.listBranches({ per_page: 100 }).then((res) => res.data),
    enabled: canView,
  })

  const branches = branchesQuery.data ?? []
  const payload = printersQuery.data
  const printers = useMemo(() => payload?.printers ?? [], [payload])

  const reload = () => void queryClient.invalidateQueries({ queryKey: ['printers'] })

  const ping = useMutation({
    mutationFn: (printer: Printer) => printersApi.ping(printer.id),
    onMutate: (printer) => setPingingId(printer.id),
    onSettled: () => setPingingId(null),
    onSuccess: ({ data }) => {
      const description = data.latency_ms
        ? `${data.latency_ms} ms · ${data.printer.address ?? 'no address'}`
        : undefined
      if (data.reachable) {
        toast.success(`${data.printer.name} is reachable`, { description })
      } else {
        toast.warning(`${data.printer.name} is disabled`, { description })
      }
      reload()
    },
    onError: (err) => {
      toast.error('Connection check failed', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const makeDefault = useMutation({
    mutationFn: (printer: Printer) => printersApi.setDefault(printer.id),
    onSuccess: ({ data }) => {
      toast.success(`${data.name} is now the default printer`)
      reload()
    },
    onError: (err) => {
      toast.error('Could not set default', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  const term = search.trim().toLowerCase()
  const visible = useMemo(() => {
    return printers.filter((printer) => {
      if (typeFilter !== ALL && printer.type !== typeFilter) return false
      if (statusFilter === 'online' && printer.status !== 'online') return false
      if (statusFilter === 'offline' && printer.status !== 'offline') return false
      if (statusFilter === 'disabled' && printer.is_active) return false
      if (branchFilter !== ALL) {
        const branchId = Number(branchFilter)
        if (printer.branch_id !== branchId && printer.branch_id !== null) return false
      }
      if (!term) return true
      return [printer.name, printer.address, printer.branch_name, printer.type, printer.connection]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [printers, typeFilter, statusFilter, branchFilter, term])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  if (!canView) {
    return (
      <div className="animate-fade-in max-w-3xl space-y-4">
        <PageHeader
          title="Printers"
          eyebrow="Hardware"
          description="Manage receipt, kitchen and label printers."
        />
        <EmptyState
          title="You don't have access"
          description="Printer management is available to store managers and business administrators."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Printers"
        eyebrow="Hardware"
        description="Register and monitor receipt, kitchen and label printers for each branch."
      >
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add printer
          </Button>
        )}
      </PageHeader>

      <MetricGrid summary={payload?.summary} loading={printersQuery.isLoading} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search printer, address or branch…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as PrinterType | typeof ALL)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {(payload?.options.types ?? []).map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_META[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {branches.map((branch: Branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatusPills summary={payload?.summary} value={statusFilter} onSelect={setStatusFilter} />

      {printersQuery.isLoading && <DirectorySkeleton />}

      {!printersQuery.isLoading && printersQuery.isError && (
        <ErrorState error={printersQuery.error} onRetry={reload} />
      )}

      {!printersQuery.isLoading && !printersQuery.isError && visible.length === 0 && (
        <EmptyState
          title="No printers found"
          description={
            printers.length === 0
              ? 'Register your first receipt or kitchen printer to get started.'
              : 'Try a different search or filter.'
          }
          icon={<PrinterIcon className="h-6 w-6" />}
          action={
            canManage && printers.length === 0 ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add printer
              </Button>
            ) : undefined
          }
        />
      )}

      {!printersQuery.isLoading && !printersQuery.isError && visible.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              canManage={canManage}
              pinging={pingingId === printer.id}
              onCheck={() => ping.mutate(printer)}
              onDefault={() => makeDefault.mutate(printer)}
              onEdit={() => {
                setEditing(printer)
                setDialogOpen(true)
              }}
              onDelete={() => setDeleting(printer)}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <PrinterDialog
          printer={editing}
          branches={branches}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}

      {deleting && (
        <DeletePrinterDialog printer={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub: string
  tone: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('grid h-6 w-6 place-items-center rounded', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1.5 font-mono text-lg font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function MetricGrid({ summary, loading }: { summary?: PrinterSummary; loading: boolean }) {
  const dim = loading ? '—' : undefined
  const cards = [
    {
      label: 'Total printers',
      value: dim ?? String(summary?.total ?? 0),
      sub: `${summary?.defaults ?? 0} default`,
      tone: 'bg-primary/10 text-primary',
      icon: PrinterIcon,
    },
    {
      label: 'Online',
      value: dim ?? String(summary?.online ?? 0),
      sub: 'reachable now',
      tone: 'bg-success/15 text-success',
      icon: CheckCircle2,
    },
    {
      label: 'Offline',
      value: dim ?? String(summary?.offline ?? 0),
      sub: `${summary?.unknown ?? 0} unknown`,
      tone: 'bg-destructive/15 text-destructive',
      icon: XCircle,
    },
    {
      label: 'Disabled',
      value: dim ?? String(summary?.inactive ?? 0),
      sub: 'skipped at checkout',
      tone: 'bg-warning/15 text-warning',
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  )
}

function StatusPills({
  summary,
  value,
  onSelect,
}: {
  summary?: PrinterSummary
  value: StatusFilter
  onSelect: (value: StatusFilter) => void
}) {
  const pills: Array<{ key: StatusFilter; label: string; count?: number; tone?: string }> = [
    { key: ALL, label: 'All', count: summary?.total },
    { key: 'online', label: 'Online', count: summary?.online, tone: 'text-success' },
    { key: 'offline', label: 'Offline', count: summary?.offline, tone: 'text-destructive' },
    { key: 'disabled', label: 'Disabled', count: summary?.inactive, tone: 'text-muted-foreground' },
  ]

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pills.map((pill) => {
        const selected = value === pill.key
        return (
          <button
            key={pill.key}
            type="button"
            onClick={() => onSelect(pill.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn(pill.tone)}>{pill.label}</span>
            {pill.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px]',
                  selected ? 'bg-primary/15' : 'bg-surface-sunken',
                )}
              >
                {pill.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  )
}

function PrinterCard({
  printer,
  canManage,
  pinging,
  onCheck,
  onDefault,
  onEdit,
  onDelete,
}: {
  printer: Printer
  canManage: boolean
  pinging: boolean
  onCheck: () => void
  onDefault: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const type = TYPE_META[printer.type]
  const connection = CONNECTION_META[printer.connection]
  const status = STATUS_META[printer.status]
  const TypeIcon = type.icon
  const ConnectionIcon = connection.icon
  const StatusIcon = status.icon

  const stripe = !printer.is_active
    ? 'bg-muted-foreground'
    : printer.status === 'online'
      ? 'bg-success'
      : printer.status === 'offline'
        ? 'bg-destructive'
        : 'bg-warning'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span className={cn('absolute inset-x-0 top-0 h-1', stripe)} aria-hidden />

      <div className="p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                <TypeIcon className="h-3 w-3" />
                {type.label}
              </span>
              {printer.is_default && (
                <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              )}
              {!printer.is_active && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Disabled
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate font-semibold tracking-tight text-foreground">
              {printer.name}
            </h2>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <ConnectionIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {connection.label}
                {printer.address ? ` · ${printer.address}` : ''}
              </span>
            </div>
          </div>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Printer actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!printer.is_default && (
                  <DropdownMenuItem onClick={onDefault}>
                    <Star className="h-4 w-4" />
                    Set as default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit printer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-sunken p-2.5">
          <span className={cn('flex items-center gap-1.5 font-mono text-[11px]', status.tone)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {printer.last_seen_at ? `seen ${formatRelative(printer.last_seen_at)}` : 'never checked'}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {printer.auto_print_receipts && <Chip>Auto receipt</Chip>}
          {printer.print_kitchen_tickets && <Chip>Kitchen tickets</Chip>}
          {printer.print_labels && <Chip>Labels</Chip>}
          <Chip>{printer.paper_width.toUpperCase()}</Chip>
          <span className="flex items-center gap-1 rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {printer.branch_name ?? 'All branches'}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
          <Button variant="outline" size="sm" className="flex-1" loading={pinging} onClick={onCheck}>
            <RefreshCw className="h-3.5 w-3.5" />
            Check connection
          </Button>
          {canManage && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function PrinterDialog({
  printer,
  branches,
  onClose,
  onSaved,
}: {
  printer: Printer | null
  branches: Branch[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: printer?.name ?? '',
    type: printer?.type ?? ('receipt' as PrinterType),
    connection: printer?.connection ?? ('network' as PrinterConnection),
    address: printer?.address ?? '',
    paper_width: printer?.paper_width ?? ('80mm' as PrinterPaperWidth),
    branch_id: printer?.branch_id ?? null,
    is_default: printer?.is_default ?? false,
    is_active: printer?.is_active ?? true,
    auto_print_receipts: printer?.auto_print_receipts ?? true,
    print_kitchen_tickets: printer?.print_kitchen_tickets ?? false,
    print_labels: printer?.print_labels ?? false,
    notes: printer?.notes ?? '',
  })

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  const save = useMutation({
    mutationFn: () => {
      const input: PrinterInput = {
        name: form.name.trim(),
        type: form.type,
        connection: form.connection,
        address: form.address.trim() || null,
        paper_width: form.paper_width,
        branch_id: form.branch_id,
        is_default: form.is_default,
        is_active: form.is_active,
        auto_print_receipts: form.auto_print_receipts,
        print_kitchen_tickets: form.print_kitchen_tickets,
        print_labels: form.print_labels,
        notes: form.notes.trim() || null,
      }
      return printer ? printersApi.update(printer.id, input) : printersApi.create(input)
    },
    onSuccess: () => {
      toast.success(printer ? 'Printer updated' : 'Printer added')
      onSaved()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not save printer', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{printer ? 'Edit printer' : 'Add printer'}</DialogTitle>
          <DialogDescription>
            Register a device and choose what it prints at the point of sale.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="printer-name">Name</Label>
            <Input
              id="printer-name"
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="e.g. Front counter receipt"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(value) => set({ type: value as PrinterType })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_META) as PrinterType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_META[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Connection</Label>
            <Select
              value={form.connection}
              onValueChange={(value) => set({ connection: value as PrinterConnection })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONNECTION_META) as PrinterConnection[]).map((connection) => (
                  <SelectItem key={connection} value={connection}>
                    {CONNECTION_META[connection].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="printer-address">
              {form.connection === 'network'
                ? 'IP address / hostname'
                : form.connection === 'usb'
                  ? 'USB port or device'
                  : form.connection === 'bluetooth'
                    ? 'Bluetooth address'
                    : 'System printer name'}
            </Label>
            <Input
              id="printer-address"
              value={form.address}
              onChange={(event) => set({ address: event.target.value })}
              placeholder={form.connection === 'network' ? '192.168.1.50:9100' : 'e.g. EPSON-TM-T20'}
            />
          </div>

          <div className="grid gap-2">
            <Label>Paper width</Label>
            <Select
              value={form.paper_width}
              onValueChange={(value) => set({ paper_width: value as PrinterPaperWidth })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm thermal</SelectItem>
                <SelectItem value="80mm">80mm thermal</SelectItem>
                <SelectItem value="a4">A4 / Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Branch</Label>
            <Select
              value={form.branch_id !== null ? String(form.branch_id) : ALL}
              onValueChange={(value) => set({ branch_id: value === ALL ? null : Number(value) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ToggleRow
            label="Active"
            description="Disabled printers are skipped at checkout."
            checked={form.is_active}
            onChange={(value) => set({ is_active: value })}
          />
          <ToggleRow
            label="Default for branch"
            description="Used first when printing without a choice."
            checked={form.is_default}
            onChange={(value) => set({ is_default: value })}
          />
          <ToggleRow
            label="Auto-print receipts"
            description="Print a receipt automatically after each sale."
            checked={form.auto_print_receipts}
            onChange={(value) => set({ auto_print_receipts: value })}
          />
          <ToggleRow
            label="Kitchen tickets"
            description="Send order tickets for food and drink items."
            checked={form.print_kitchen_tickets}
            onChange={(value) => set({ print_kitchen_tickets: value })}
          />
          <ToggleRow
            label="Label printing"
            description="Use this device for shelf and product labels."
            checked={form.print_labels}
            onChange={(value) => set({ print_labels: value })}
          />

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="printer-notes">Notes</Label>
            <Input
              id="printer-notes"
              value={form.notes}
              onChange={(event) => set({ notes: event.target.value })}
              placeholder="Optional location or maintenance notes"
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
            disabled={!form.name.trim()}
            onClick={() => save.mutate()}
          >
            {printer ? 'Save changes' : 'Add printer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
      <div className="min-w-0">
        <Label className="leading-tight">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function DeletePrinterDialog({
  printer,
  onClose,
  onDeleted,
}: {
  printer: Printer
  onClose: () => void
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => printersApi.remove(printer.id),
    onSuccess: () => {
      toast.success('Printer removed')
      onDeleted()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not remove printer', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove printer?</DialogTitle>
          <DialogDescription>
            This removes “{printer.name}” from the register. You can add it again later.
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
            Remove printer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-52 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export default PrintersPage
