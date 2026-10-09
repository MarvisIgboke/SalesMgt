import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/80 to-info shadow-glow',
        className,
      )}
    >
      <span className="text-sm font-extrabold tracking-tight text-primary-foreground">S</span>
      <span className="pointer-events-none absolute inset-0 bg-glass-shine" />
    </div>
  )
}

interface BrandProps {
  markOnly?: boolean
  className?: string
}

export function Brand({ markOnly = false, className }: BrandProps) {
  return (
    <Link
      to="/dashboard"
      className={cn('group flex items-center gap-2.5', className)}
      aria-label="SalesMgt home"
    >
      <BrandMark className="transition-transform duration-200 group-hover:scale-105" />
      {!markOnly && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-foreground">SalesMgt</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Ecosystem
          </span>
        </span>
      )}
    </Link>
  )
}