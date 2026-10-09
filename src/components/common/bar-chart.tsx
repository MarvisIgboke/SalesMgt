import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface BarDatum {
  label: string
  value: number
}

interface BarChartProps {
  data: BarDatum[]
  max?: number
  className?: string
}

export function BarChart({ data, max, className }: BarChartProps) {
  const peak = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data])
  const displayMax = max ?? peak

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data in this period.</p>
  }

  return (
    <div className={cn('flex h-56 items-end gap-1.5 sm:gap-2', className)}>
      {data.map((d, i) => {
        const pct = displayMax > 0 ? Math.max((d.value / displayMax) * 100, d.value > 0 ? 3 : 0) : 0
        const isPeak = d.value === peak && peak > 0
        return (
          <div
            key={`${d.label}-${i}`}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
            title={`${d.label}: ${d.value}`}
          >
            <div className="relative flex h-48 w-full items-end">
              <div
                className={cn(
                  'w-full rounded-md transition-all duration-500 group-hover:brightness-110',
                  isPeak
                    ? 'bg-gradient-to-t from-primary/70 to-primary'
                    : 'bg-primary/25',
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}