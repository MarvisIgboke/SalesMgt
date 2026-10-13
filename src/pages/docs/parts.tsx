import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DocSection({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/50 pt-10 first:border-0 first:pt-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{lead}</p>
      )}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  )
}

export function SubHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 text-lg font-bold tracking-tight text-foreground sm:text-xl"
    >
      {children}
    </h3>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{children}</p>
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border/60 pl-6">
      {items.map((step, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.94rem] grid h-6 w-6 place-items-center rounded-full border border-primary/40 bg-primary/15 font-mono text-[11px] font-bold text-primary">
            {i + 1}
          </span>
          <div className="text-sm font-semibold text-foreground">{step.title}</div>
          <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.body}</div>
        </li>
      ))}
    </ol>
  )
}

const CALLOUT_TONES = {
  info: {
    icon: Info,
    wrap: 'border-info/30 bg-info/10',
    accent: 'text-info',
  },
  tip: {
    icon: Lightbulb,
    wrap: 'border-success/30 bg-success/10',
    accent: 'text-success',
  },
  warning: {
    icon: CircleAlert,
    wrap: 'border-warning/30 bg-warning/10',
    accent: 'text-warning',
  },
} as const

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONES
  title: string
  children: ReactNode
}) {
  const conf = CALLOUT_TONES[tone]
  const Icon = conf.icon
  return (
    <div className={cn('rounded-2xl border p-4', conf.wrap)}>
      <div className={cn('flex items-center gap-2 text-sm font-semibold', conf.accent)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

export function CheckList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function DataTable({
  columns,
  rows,
  className,
}: {
  columns: string[]
  rows: ReactNode[][]
  className?: string
}) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-2xl border border-border/60', className)}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-surface">
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-border/50 align-top">
              {row.map((cell, c) => (
                <td key={c} className="px-4 py-2.5 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DefinitionList({ items }: { items: { term: string; body: ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
          <dt className="text-sm font-semibold text-foreground">{item.term}</dt>
          <dd className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.body}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StepChips({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          <span className="rounded-lg border border-border/60 bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
            {step}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  )
}
