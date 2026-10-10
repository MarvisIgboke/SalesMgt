import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, MoreHorizontal, Pencil, UserPlus } from 'lucide-react'
import { suppliersApi, type Supplier, type SupplierInput } from '@/lib/api/endpoints/suppliers'
import { PageHeader } from '@/components/common/page-header'
import { SearchInput } from '@/components/common/search-input'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate, formatNumber, initials } from '@/lib/utils'
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

export function SuppliersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['suppliers', { search, page }],
    queryFn: () => suppliersApi.list({ search: search || undefined, page, per_page: 12 }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const meta = data?.meta

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
      toast.success(editing ? 'Supplier updated' : 'Supplier created')
      setEditorOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (err) => {
      toast.error('Could not save supplier', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Suppliers"
        description="Vendors, balances owed and total purchase history."
      >
        <Button size="sm" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          New supplier
        </Button>
      </PageHeader>

      <SearchInput
        placeholder="Search name, contact, phone…"
        className="mb-4"
        onSearch={(value) => {
          setPage(1)
          setSearch(value)
        }}
      />

      {isLoading && <LoadingState variant="table" rows={6} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="No suppliers found"
          description="Try adjusting your search, or add your first supplier."
          icon={<Building2 className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              New supplier
            </Button>
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Total purchases</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(supplier.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {supplier.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {supplier.contact_name ?? 'No contact name'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {supplier.phone ?? supplier.email ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        supplier.outstanding_balance > 0
                          ? 'text-sm font-semibold tabular-nums text-warning'
                          : 'text-sm tabular-nums text-muted-foreground'
                      }
                    >
                      {formatCurrency(supplier.outstanding_balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatNumber(supplier.total_purchases)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(supplier.created_at, { year: 'numeric', month: 'short' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <span className="sr-only">Actions</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(supplier)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="suppliers"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit supplier' : 'New supplier'}</DialogTitle>
          <DialogDescription>
            Supplier data is stored server-side and returned from the API.
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
