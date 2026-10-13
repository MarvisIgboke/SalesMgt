import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { env } from '@/lib/env'

export function SecureAuthShell({
  children,
  subtitle = 'Workstation POS & ERP Access Gate',
  backTo = '/login',
  backLabel = 'Sign in',
}: {
  children: ReactNode
  subtitle?: string
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-1.5 rounded bg-secondary px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-success">
              Secure Node
            </span>
          </div>
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-10 pt-3">
          <SecureAuthCard subtitle={subtitle} />
          {children}
        </div>
      </main>
    </div>
  )
}

export function SecureAuthCard({ subtitle }: { subtitle: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-start gap-4">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-elevated shadow-inner">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-primary/20 via-transparent to-success/10" />
          <svg className="relative h-7 w-7 text-primary" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 3L4 9V16C4 22.8 9.1 29.1 16 31C22.9 29.1 28 22.8 28 16V9L16 3Z"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <path
              d="M16 3L4 9V16C4 22.8 9.1 29.1 16 31C22.9 29.1 28 22.8 28 16V9L16 3Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
            <path
              d="M10 16L14 20L22 12"
              stroke="hsl(var(--success))"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {env.appName} Enterprise
            </span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              v4.2-LTS
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>
    </div>
  )
}
