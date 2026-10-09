import { Badge, type BadgeProps } from '@/components/ui/badge'

type StatusVariant = NonNullable<BadgeProps['variant']>

const STATUS_VARIANT: Record<string, StatusVariant> = {
  // stock levels
  in_stock: 'success',
  low: 'warning',
  out_of_stock: 'destructive',
  // shifts
  open: 'success',
  active: 'info',
  closed: 'secondary',
  // purchase orders / requisitions / expenses
  draft: 'muted',
  pending: 'warning',
  awaiting_approval: 'warning',
  submitted: 'info',
  requested: 'info',
  approved: 'success',
  received: 'success',
  completed: 'success',
  partially_received: 'info',
  cancelled: 'destructive',
  rejected: 'destructive',
  stopped: 'destructive',
  // transfers
  in_transit: 'info',
  transfer_received: 'success',
  // wallet transactions
  credit: 'success',
  debit: 'destructive',
  // finance matching
  matched: 'success',
  partial: 'warning',
  unmatched: 'destructive',
  // subscription
  active_last: 'success',
  trial: 'info',
  expired: 'destructive',
  suspended: 'destructive',
  none: 'muted',
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'secondary'} className={className}>
      {label ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}