import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MoreHorizontal, Plus, ReceiptText, X } from 'lucide-react'
import { expensesApi, type ExpenseInput } from '@/lib/api/endpoints/expenses'
import { useAppStore } from '@/stores/app'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { LoadingState } from '@/components/common/loading-state'
import { ErrorState } from '@/components/common/error-state'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge } from '@/components/common/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api/errors'

const PER_PAGE = 12

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
]

export function ExpensesPage() {
  const queryClient = useQueryClient()
  const branchId = useAppStore((s) => s.context?.branch?.id)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const dashboardQuery = useQuery({
    queryKey: ['expenses', 'dashboard', branchId],
    queryFn: () => expensesApi.dashboard({ branch_id: branchId }),
    placeholderData: (prev) => prev,
  })

  const listQuery = useQuery({
    queryKey: ['expenses', { page, status, branchId }],
    queryFn: () =>
      expensesApi.list({
        page,
        per_page: PER_PAGE,
        status: status === 'all' ? undefined : status,
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Expenses"
        description="Record, approve and analyse business expenses. Totals and approvals are authoritative from the backend."
      >
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New expense
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(summary?.total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatNumber(summary?.pending_count)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={status}
          onValueChange={(value) => {
            setPage(1)
            setStatus(value)
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setCreating(true)}>
          <ReceiptText className="h-4 w-4" />
          New expense
        </Button>
      </div>

      {listQuery.isLoading && <LoadingState variant="table" rows={8} />}
      {listQuery.isError && <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />}

      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
        <EmptyState
          title="No expenses found"
          description="Try a different status filter, or record your first expense."
          icon={<ReceiptText className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              New expense
            </Button>
          }
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {expense.reference}
                  </TableCell>
                  <TableCell className="max-w-[20rem] truncate text-sm text-foreground">
                    {expense.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.category ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.branch_name}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={expense.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expense.submitted_by}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(expense.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {expense.status === 'pending' || expense.status === 'awaiting_approval' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <span className="sr-only">Actions</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => decide.mutate({ id: expense.id, decision: 'approved' })}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => decide.mutate({ id: expense.id, decision: 'rejected' })}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta?.current_page ?? page}
            lastPage={meta?.last_page ?? 1}
            total={meta?.total}
            totalLabel="expenses"
            isFetching={listQuery.isFetching}
            onPageChange={setPage}
          />
        </>
      )}

      {creating && <NewExpenseDialog branchId={branchId} onClose={() => setCreating(false)} />}
    </div>
  )
}

interface NewExpenseDialogProps {
  branchId?: number
  onClose: () => void
}

function NewExpenseDialog({ branchId, onClose }: NewExpenseDialogProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('none')
  const [date, setDate] = useState('')

  const categoriesQuery = useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: () => expensesApi.categories(),
  })

  const categories = categoriesQuery.data?.data ?? []

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
    createExpense.mutate({
      description: description.trim(),
      amount: Number(amount),
      category: category === 'none' ? undefined : category,
      date: date || undefined,
      branch_id: branchId,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New expense</DialogTitle>
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
              placeholder="e.g. Fuel for delivery van"
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
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((cat) => (
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
            Create expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
