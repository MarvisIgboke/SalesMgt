import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  icon?: ReactNode
  eyebrow?: string
  meta?: ReactNode
  action?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

/**
 * Shared section card matching the dashboard design language: a compact header
 * with an optional icon, title, mono meta label and/or right-aligned action.
 */
export function SectionCard({
  title,
  icon,
  eyebrow,
  meta,
  action,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  const hasHeader = Boolean(title || icon || meta != null || action)

  return (
    <Card className={className}>
      <CardContent className={cn('space-y-3 p-4', contentClassName)}>
        {hasHeader && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {icon && <span className="shrink-0 text-primary">{icon}</span>}
              {title && (
                <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              )}
            </div>
            {action ??
              (meta != null && (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {meta}
                </span>
              ))}
          </div>
        )}
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
