import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Users,
} from 'lucide-react'
import { customersApi, type Customer, type CustomerInput } from '@/lib/api/endpoints/customers'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, formatNumber, initials } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

type CustomerFormState = {
  name: string
  email: string
  phone: string
  address: string
  credit_limit: string
}

const EMPTY_FORM: CustomerFormState = { name: '', email: '', phone: '', address: '', credit_limit: '' }

function toForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    credit_limit: customer.credit_limit ? String(customer.credit_limit) : '',
  }
}

function toInput(form: CustomerFormState): CustomerInput {
  return {
    name: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    credit_limit: form.credit_limit ? Number(form.credit_limit) : undefined,
  }
}

export function CustomersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM)
  const [paying, setPaying] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)

  const { data, isFetching, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => customersApi.list({ search: search || undefined, page, per_page: 12 }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const meta = data?.meta

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm(toForm(customer))
    setEditorOpen(true)
  }

  const save = useMutation({
    mutationFn: (input: CustomerInput) =>
      editing ? customersApi.update(editing.id, input) : customersApi.create(input),
    onSuccess: () => {
      toast.success(editing ? 'Customer updated' : 'Customer created')
      setEditorOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err) => {
      toast.error(`Could not save customer`, {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        description="Customers on credit, balances, statements and payment history."
      >
        <Button size="sm" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          New customer
        </Button>
      </PageHeader>

      <SearchInput
        placeholder="Search name, phone, email…"
        className="mb-4"
        onSearch={(value) => {
          setPage(1)
          setSearch(value)
        }}
      />

      {isLoading && <LoadingState variant="table" rows={8} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="No customers found"
          description="Try adjusting your search, or add your first customer."
          icon={<Users className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              New customer
            </Button>
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Credit limit</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Total purchases</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(customer.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {customer.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.phone ?? customer.email ?? 'No contact'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {customer.credit_limit != null
                      ? formatCurrency(customer.credit_limit)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        customer.outstanding_balance > 0
                          ? 'text-sm font-semibold tabular-nums text-warning'
                          : 'text-sm tabular-nums text-muted-foreground'
                      }
                    >
                      {formatCurrency(customer.outstanding_balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatNumber(customer.total_purchases)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(customer.created_at, { year: 'numeric', month: 'short' })}
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
                        <DropdownMenuItem onClick={() => setViewing(customer)}>
                          <FileText className="h-4 w-4" />
                          Statement
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPaying(customer)}>
                          <Banknote className="h-4 w-4" />
                          Record payment
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(customer)}>
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
            totalLabel="customers"
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {editorOpen && (
        <CustomerEditor
          customer={editing}
          form={form}
          onChange={setForm}
          saving={save.isPending}
          onCancel={() => setEditorOpen(false)}
          onSave={() => save.mutate(toInput(form))}
        />
      )}

      {viewing && <StatementDialog customer={viewing} onClose={() => setViewing(null)} />}

      {paying && <PaymentDialog customer={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

interface CustomerEditorProps {
  customer: Customer | null
  form: CustomerFormState
  onChange: (form: CustomerFormState) => void
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

function CustomerEditor({ customer, form, onChange, saving, onCancel, onSave }: CustomerEditorProps) {
  const set = (patch: Partial<CustomerFormState>) => onChange({ ...form, ...patch })

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
          <DialogDescription>
            Customer data is stored server-side. Credit limits are enforced by the backend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Amaka Foods Ltd"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="billing@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-address">Address</Label>
            <Input
              id="customer-address"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="Street, city, state"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-limit">Credit limit (₦)</Label>
            <Input
              id="customer-limit"
              type="number"
              min={0}
              value={form.credit_limit}
              onChange={(e) => set({ credit_limit: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={onSave}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PaymentDialogProps {
  customer: Customer
  onClose: () => void
}

function PaymentDialog({ customer, onClose }: PaymentDialogProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const pay = useMutation({
    mutationFn: () =>
      customersApi.pay({
        customer_id: customer.id,
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err) => {
      toast.error('Could not record payment', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {customer.name} owes {formatCurrency(customer.outstanding_balance)}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Amount (₦)</Label>
            <Input
              id="payment-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="transfer">Bank transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile money</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference / receipt no."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={pay.isPending}
            disabled={!amount || Number(amount) <= 0}
            onClick={() => pay.mutate()}
          >
            <Banknote className="h-4 w-4" />
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface StatementDialogProps {
  customer: Customer
  onClose: () => void
}

function StatementDialog({ customer, onClose }: StatementDialogProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', customer.id, 'statement'],
    queryFn: () => customersApi.statement(customer.id),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Statement — {customer.name}</DialogTitle>
          <DialogDescription>Ledger entries as calculated by the backend.</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Opening balance</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.opening_balance)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Charges</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.charges)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Payments</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(data.data.payments)}
                </p>
              </div>
              <div className="col-span-3 rounded-xl border border-border/70 p-3">
                <p className="text-[11px] text-muted-foreground">Closing balance</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(data.data.closing_balance)}
                </p>
              </div>
            </div>

            {data.data.entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                No ledger entries in the selected period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(entry.date, { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{entry.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {entry.debit ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {entry.credit ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
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