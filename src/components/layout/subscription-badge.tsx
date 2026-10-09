import { Crown } from 'lucide-react'
import { useAppStore } from '@/stores/app'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/utils'

export function SubscriptionBadge() {
  const context = useAppStore((s) => s.context)
  const subscription = context?.subscription

  if (!subscription) return null

  const ok = subscription.status === 'active'
  const trial = subscription.status === 'trial'
  const variant = ok ? 'success' : trial ? 'info' : 'destructive'
  const label = ok ? subscription.plan : trial ? `${subscription.plan} · trial` : subscription.status

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="hidden h-7 gap-1.5 px-2.5 capitalize sm:inline-flex">
          <Crown className="h-3 w-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {subscription.expiry_date
          ? `Subscription valid until ${formatDate(subscription.expiry_date)}`
          : `Plan: ${subscription.plan}`}
      </TooltipContent>
    </Tooltip>
  )
}