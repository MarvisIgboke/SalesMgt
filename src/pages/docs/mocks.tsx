import type { ReactNode } from 'react'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'muted' | 'primary' | 'success' | 'warning' | 'destructive' | 'info'

const TONE_TEXT: Record<Tone, string> = {
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
}

const TONE_BG: Record<Tone, string> = {
  muted: 'bg-secondary text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
}

export function Pill({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        TONE_BG[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatTile({
  label,
  value,
  delta,
  tone = 'muted',
}: {
  label: string
  value: string
  delta?: string
  tone?: Tone
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-bold text-foreground">{value}</div>
      {delta && <div className={cn('mt-0.5 text-[10px] font-medium', TONE_TEXT[tone])}>{delta}</div>}
    </div>
  )
}

export function Bar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'primary'
            ? 'bg-gradient-to-r from-primary to-info'
            : 'bg-gradient-to-r from-success to-primary',
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function MiniSidebar({ active }: { active: string }) {
  const items: { icon: LucideIcon; label: string }[] = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: ShoppingCart, label: 'POS' },
    { icon: Boxes, label: 'Inventory' },
    { icon: Users, label: 'Customers' },
    { icon: Wallet, label: 'Finance' },
    { icon: BarChart3, label: 'Reports' },
    { icon: Settings, label: 'Settings' },
  ]
  return (
    <div className="hidden w-40 shrink-0 flex-col gap-0.5 border-r border-border/60 bg-surface p-2 sm:flex">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium',
            item.label === active ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export function AppFrame({
  path = '/dashboard',
  active,
  children,
}: {
  path?: string
  active?: string
  children: ReactNode
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-surface px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <div className="ml-2 min-w-0 flex-1 truncate rounded-md bg-surface-sunken px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          salesmgt.app{path}
        </div>
      </div>
      <div className="flex">
        {active && <MiniSidebar active={active} />}
        <div className="min-w-0 flex-1 bg-background p-3 sm:p-4">{children}</div>
      </div>
    </div>
  )
}

export function Snapshot({
  path,
  active,
  legend,
  children,
}: {
  path?: string
  active?: string
  legend?: string[]
  children: ReactNode
}) {
  return (
    <figure className="my-6">
      <AppFrame path={path} active={active}>
        {children}
      </AppFrame>
      {legend && (
        <figcaption className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {legend.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground"
            >
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-[9px] font-bold text-primary">
                {i + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </figcaption>
      )}
    </figure>
  )
}

export function Flow({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => (
        <li key={step.title} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
            {i + 1}
          </span>
          <div className="mt-3 text-sm font-semibold text-foreground">{step.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</div>
        </li>
      ))}
    </ol>
  )
}
