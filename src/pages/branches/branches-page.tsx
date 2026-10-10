import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { businessApi, type Branch } from '@/lib/api/endpoints/business'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/lib/use-permissions'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

export function BranchesPage() {
  const queryClient = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const isSuperAdmin = session?.user.roles.includes('Super Admin') ?? false
  const { can } = usePermissions()
  const canManage = can('staff.edit') || isSuperAdmin

  const [editing, setEditing] = useState<Branch | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Branch | null>(null)

  const branches = useQuery({
    queryKey: ['branches', { per_page: 100 }],
    queryFn: () => businessApi.listBranches({ per_page: 100 }),
    placeholderData: (prev) => prev,
  })

  const rows = branches.data?.data ?? []

  const reload = () => {
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Branches & stores"
        description="Locations your business operates from. Each branch has its own stock and sales."
      >
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add branch
          </Button>
        )}
      </PageHeader>

      {branches.isLoading && <LoadingState variant="table" rows={6} />}
      {branches.isError && (
        <ErrorState error={branches.error} onRetry={() => branches.refetch()} />
      )}

      {!branches.isLoading && !branches.isError && rows.length === 0 && (
        <EmptyState
          title="No branches yet"
          description="Add your first branch to start tracking stock and sales by location."
          icon={<Building2 className="h-6 w-6" />}
          action={
            canManage ? (
              <Button variant="outline" size="sm" onClick={openCreate}>
                Add branch
              </Button>
            ) : undefined
          }
        />
      )}

      {!branches.isLoading && !branches.isError && rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{branch.name}</p>
                          {branch.address && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {branch.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {branch.code || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {branch.phone || '—'}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {branch.type || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active ? 'success' : 'muted'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(branch)}>
                            <span className="sr-only">Edit branch</span>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleting(branch)}
                          >
                            <span className="sr-only">Delete branch</span>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dialogOpen && (
        <BranchDialog
          branch={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}

      {deleting && (
        <DeleteBranchDialog
          branch={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={reload}
        />
      )}
    </div>
  )
}

function BranchDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    address: branch?.address ?? '',
    phone: branch?.phone ?? '',
    type: branch?.type ?? '',
    is_active: branch?.is_active ?? true,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = {
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
          <DialogTitle>{branch ? 'Edit branch' : 'Add branch'}</DialogTitle>
          <DialogDescription>
            Branches isolate inventory, sales and shifts for a location.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
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
              placeholder="e.g. Retail"
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
            disabled={!form.name.trim()}
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
          <DialogTitle>Delete “{branch.name}”?</DialogTitle>
          <DialogDescription>
            This permanently removes the branch. Branches with stock or sales history cannot be
            deleted.
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
