import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  trend?: number
  trendLabel?: string
  loading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  loading = false,
  className,
}: StatCardProps) {
  const showDown = trend !== undefined && trend < 0
  const goodDown = ['expenses', 'low stock', 'expiring', 'damaged'].some((k) =>
    label.toLowerCase().includes(k),
  )

  return (
    <Card className={cn('relative overflow-hidden transition-shadow hover:shadow-card-hover', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          {icon && <span className="text-muted-foreground/70">{icon}</span>}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-1/2 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          )}
          {trend !== undefined && !loading && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                showDown ? (goodDown ? 'text-success' : 'text-destructive') : goodDown ? 'text-destructive' : 'text-success',
              )}
            >
              {showDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        {(hint || trendLabel) && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {trendLabel ?? hint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}