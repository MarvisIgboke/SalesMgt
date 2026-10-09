import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, AlertTriangle, Trash2 } from 'lucide-react'
import { customersApi, type Customer } from '@/lib/api/endpoints/customers'
import { usePosCart } from './use-pos-cart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/empty-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'

interface CartPanelProps {
  onPay: () => void
  paying: boolean
}

export function CartPanel({ onPay, paying }: CartPanelProps) {
  const { cart, cartLoading, updateItem, removeItem, setCustomer } = usePosCart()

  const customersQuery = useQuery({
    queryKey: ['customers', 'simple'],
    queryFn: () => customersApi.list({ per_page: 100 }),
    enabled: !!cart,
  })

  const customers = customersQuery.data?.data ?? []

  if (cartLoading && !cart) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="flex-1" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex h-full flex-col p-4">
        <EmptyState
          title="Cart is empty"
          description="Scan or search for a product to begin a sale."
          className="flex-1 border-0 py-10"
        />
        <Button size="lg" className="mt-2 w-full" disabled>
          Pay
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Current sale</p>
          <p className="font-mono text-[10px] text-muted-foreground">{cart.reference}</p>
        </div>
        <Badge variant={cart.requires_approval ? 'warning' : 'success'}>
          {cart.requires_approval ? 'Approval required' : 'Ready'}
        </Badge>
      </div>

      {cart.warnings.length > 0 && (
        <div className="space-y-1 border-b border-border/60 bg-warning/5 px-4 py-2">
          {cart.warnings.map((w) => (
            <p key={w.code} className="flex items-start gap-1.5 text-[11px] text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w.message}
            </p>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y divide-border/50 px-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.product_name}
                  {item.variant_name && (
                    <span className="text-muted-foreground"> · {item.variant_name}</span>
                  )}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{item.sku}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(item.line_total)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </span>
                </div>
                {(item.stock_warning || item.expiry_warning) && (
                  <div className="mt-1 space-y-0.5">
                    {item.stock_warning && (
                      <p className="flex items-center gap-1 text-[10px] text-warning">
                        <AlertTriangle className="h-3 w-3" /> {item.stock_warning}
                      </p>
                    )}
                    {item.expiry_warning && (
                      <p className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {item.expiry_warning}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => updateItem.mutate({ lineId: item.id, quantity: item.quantity - 1 })}
                  disabled={item.quantity <= 1 || updateItem.isPending}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">
                  {item.quantity}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => updateItem.mutate({ lineId: item.id, quantity: item.quantity + 1 })}
                  disabled={updateItem.isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem.mutate(item.id)}
                  disabled={removeItem.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 px-4 py-3">
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Customer
          </p>
          <Select
            value={cart.customer_id ? String(cart.customer_id) : 'none'}
            onValueChange={(v) => setCustomer.mutate(v === 'none' ? null : Number(v))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Walk-in (no customer)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Walk-in (no customer)</SelectItem>
              {customers.map((customer: Customer) => (
                <SelectItem key={customer.id} value={String(customer.id)}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatCurrency(cart.subtotal)} />
          {cart.discount_total > 0 && (
            <Row label="Discounts" value={formatCurrency(cart.discount_total)} negative />
          )}
          {cart.tax_total > 0 && (
            <Row label="Tax" value={formatCurrency(cart.tax_total)} />
          )}
          <div className="my-1 border-t border-dashed border-border/60" />
          <Row label="Total" value={formatCurrency(cart.total)} strong />
        </div>

        <Button
          size="xl"
          variant={cart.requires_approval ? 'warning' : 'success'}
          className="mt-3 w-full"
          loading={paying}
          onClick={onPay}
        >
          {cart.requires_approval ? 'Submit for approval' : 'Charge sale'}
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value, negative, strong }: { label: string; value: string; negative?: boolean; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', strong && 'text-base font-bold')}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', negative && 'text-destructive', !strong && 'font-medium text-foreground')}>
        {negative ? '-' : ''}
        {value}
      </span>
    </div>
  )
}