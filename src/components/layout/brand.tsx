import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const LOGO_SRC = '/brand/salesmgt-logo.jpeg'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-black/10',
        className,
      )}
    >
      <img src={LOGO_SRC} alt="" className="h-full w-full object-contain p-1" />
    </span>
  )
}

export function BrandImage({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="SalesMgt"
      className={cn(
        'h-9 w-auto shrink-0 rounded-xl bg-white object-contain p-1.5 ring-1 ring-black/10',
        className,
      )}
    />
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
      {markOnly ? (
        <BrandMark className="transition-transform duration-200 group-hover:scale-105" />
      ) : (
        <BrandImage className="transition-transform duration-200 group-hover:scale-105" />
      )}
    </Link>
  )
}
