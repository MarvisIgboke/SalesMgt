import type { ReactNode } from 'react'
import { Construction, ExternalLink, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface ModuleWorkflow {
  title: string
  description: string
  endpoints: string[]
  status?: 'ready' | 'planned'
}

interface ModulePageProps {
  title: string
  description?: string
  workflows: ModuleWorkflow[]
  actions?: ReactNode
  children?: ReactNode
}

export function ModulePage({ title, description, workflows, actions, children }: ModulePageProps) {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} description={description}>
        {actions}
      </PageHeader>

      {children}

      {workflows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <Card key={w.title} className="group relative overflow-hidden">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Construction className="h-4 w-4" />
                  </span>
                  <Badge variant={w.status === 'ready' ? 'success' : 'muted'}>
                    {w.status === 'ready' ? 'Wired' : 'Planned'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{w.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {w.description}
                  </p>
                </div>
                <div className="mt-auto space-y-1.5 border-t border-border/60 pt-3">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    <ExternalLink className="h-3 w-3" /> Backend endpoints
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {w.endpoints.map((e) => (
                      <code
                        key={e}
                        className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-primary"
                      >
                        {e}
                      </code>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        <p className="text-xs text-muted-foreground">
          This module is a presentation shell. All business rules are enforced and executed by
          the Laravel backend — the UI only renders backend responses and submits input.
        </p>
      </div>
    </div>
  )
}