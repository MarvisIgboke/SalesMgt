import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  Layers,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
  departmentsApi,
  type Department,
  type DepartmentInput,
} from '@/lib/api/endpoints/departments'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'
import { cn, formatNumber } from '@/lib/utils'

export function DepartmentsPage() {
  const queryClient = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const isSuperAdmin = session?.user.roles.includes('Super Admin') ?? false
  const { can } = usePermissions()
  const canManage = can('departments.manage') || isSuperAdmin

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Department | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Department | null>(null)

  const query = useQuery({
    queryKey: ['departments', { with_counts: true }],
    queryFn: () => departmentsApi.list({ with_counts: true }),
    refetchInterval: 30_000,
  })

  const departments = useMemo(() => query.data?.data ?? [], [query.data])
  const term = search.trim().toLowerCase()
  const visible = useMemo(
    () =>
      departments.filter(
        (dept) =>
          !term ||
          [dept.name, dept.code, dept.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
      ),
    [departments, term],
  )

  const totals = useMemo(
    () =>
      departments.reduce(
        (acc, dept) => ({
          staff: acc.staff + (dept.staff_count ?? 0),
          products: acc.products + (dept.products_count ?? 0),
        }),
        { staff: 0, products: 0 },
      ),
    [departments],
  )

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ['departments'] })
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (department: Department) => {
    setEditing(department)
    setDialogOpen(true)
  }

  return (
    <div className="animate-fade-in space-y-3 pb-24">
      <PageHeader
        eyebrow="Operations"
        title="Departments"
        description="Organize staff and products into departments. Sales reps only see and sell their own department's products."
      >
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-2.5">
        <SummaryTile label="Departments" value={formatNumber(departments.length)} icon={<Layers className="h-4 w-4" />} tone="bg-primary/10 text-primary" />
        <SummaryTile label="Staff Assigned" value={formatNumber(totals.staff)} icon={<Users className="h-4 w-4" />} tone="bg-secondary/15 text-secondary" />
        <SummaryTile label="Products Filed" value={formatNumber(totals.products)} icon={<Package className="h-4 w-4" />} tone="bg-info/15 text-info" />
      </div>

      {canManage && (
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Department
        </button>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search departments…"
          className="h-11 rounded-xl pl-10"
        />
      </div>

      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Department Registry
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatNumber(visible.length)} of {formatNumber(departments.length)}
        </span>
      </div>

      {query.isLoading && <RegistrySkeleton />}

      {!query.isLoading && query.isError && (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      )}

      {!query.isLoading && !query.isError && visible.length === 0 && (
        <EmptyState
          title={search ? 'No departments match' : 'No departments yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first department to organize staff and products.'
          }
          icon={<Boxes className="h-6 w-6" />}
          action={
            canManage ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                New department
              </Button>
            ) : undefined
          }
        />
      )}

      {!query.isLoading && !query.isError && visible.length > 0 && (
        <div className="space-y-2.5">
          {visible.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
              canManage={canManage}
              onEdit={() => openEdit(department)}
              onDelete={() => setDeleting(department)}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <DepartmentDialog
          department={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}

      {deleting && (
        <DeleteDepartmentDialog
          department={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={reload}
        />
      )}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: ReactNode
  tone: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('grid h-6 w-6 place-items-center rounded', tone)}>{icon}</span>
      </div>
      <div className="mt-1.5 font-mono text-base font-bold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  )
}

function DepartmentCard({
  department,
  canManage,
  onEdit,
  onDelete,
}: {
  department: Department
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <span
        className={cn('absolute inset-x-0 top-0 h-1', department.is_active ? 'bg-primary' : 'bg-muted-foreground')}
        aria-hidden
      />
      <div className="p-3.5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                {department.code || `DEPT-${String(department.id).padStart(2, '0')}`}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider',
                  department.is_active ? 'text-secondary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    department.is_active ? 'bg-secondary' : 'bg-muted-foreground',
                  )}
                />
                {department.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h2 className="mt-1 truncate font-semibold tracking-tight text-foreground">
              {department.name}
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {department.description || 'No description on file'}
            </p>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Department actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit department
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete department
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-sunken p-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-secondary" />
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Staff</p>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatNumber(department.staff_count ?? 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Products</p>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatNumber(department.products_count ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DepartmentDialog({
  department,
  onClose,
  onSaved,
}: {
  department: Department | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: department?.name ?? '',
    code: department?.code ?? '',
    description: department?.description ?? '',
    is_active: department?.is_active ?? true,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload: DepartmentInput = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        is_active: form.is_active,
      }
      return department ? departmentsApi.update(department.id, payload) : departmentsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(department ? 'Department updated' : 'Department created')
      onSaved()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not save department', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{department ? 'Edit department' : 'New department'}</DialogTitle>
          <DialogDescription>
            Staff and products are grouped under a department so sales reps only sell their own range.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Beverages"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dept-code">Code</Label>
            <Input
              id="dept-code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. BEV"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dept-description">Description</Label>
            <Input
              id="dept-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What this department covers"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive departments stay visible but are flagged.</p>
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
            disabled={!form.name.trim()}
            onClick={() => save.mutate()}
          >
            {department ? 'Save changes' : 'Create department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDepartmentDialog({
  department,
  onClose,
  onDeleted,
}: {
  department: Department
  onClose: () => void
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => departmentsApi.remove(department.id),
    onSuccess: () => {
      toast.success('Department deleted')
      onDeleted()
      onClose()
    },
    onError: (err) => {
      toast.error('Could not delete department', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete department?</DialogTitle>
          <DialogDescription>
            This permanently removes “{department.name}”. Departments with staff or products assigned
            cannot be deleted.
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
            Delete department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RegistrySkeleton() {
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
          <Skeleton className="mt-3 h-14 w-full" />
        </div>
      ))}
    </div>
  )
}
