import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  children?: ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow, children, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}