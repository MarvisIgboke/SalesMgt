import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  rows?: number
  className?: string
  variant?: 'cards' | 'table' | 'dashboard'
}

export function LoadingState({ rows = 4, className, variant = 'cards' }: LoadingStateProps) {
  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-72 w-full rounded-2xl lg:col-span-3" />
          <Skeleton className="h-72 w-full rounded-2xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-8 w-1/2" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}