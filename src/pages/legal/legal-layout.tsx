import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock3, FileText, LogIn, Menu, ScrollText, ShieldCheck, X } from 'lucide-react'
import { BrandImage } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

export interface LegalSection {
  id: string
  title: string
  content: ReactNode
}

export const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
] as const

interface LegalLayoutProps {
  eyebrow: string
  title: string
  summary: string
  updatedAt: string
  icon: 'terms' | 'privacy'
  sections: LegalSection[]
}

export function LegalLayout({ eyebrow, title, summary, updatedAt, icon, sections }: LegalLayoutProps) {
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const [menuOpen, setMenuOpen] = useState(false)

  const ids = useMemo(() => sections.map((section) => section.id), [sections])

  useEffect(() => {
    document.documentElement.classList.add('scroll-smooth')
    return () => document.documentElement.classList.remove('scroll-smooth')
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])

  const HeroIcon = icon === 'privacy' ? ShieldCheck : ScrollText

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label={`${env.appName} home`}>
            <BrandImage className="h-9 p-1.5" />
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Legal
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground',
                  link.to === (icon === 'privacy' ? '/privacy' : '/terms')
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FileText className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-10 px-4 py-10 sm:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              On this page
            </div>
            <ul className="mt-3 border-l border-border/60">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      '-ml-px flex border-l-2 py-1.5 pl-3 text-[13px] font-medium transition-colors',
                      active === section.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Other documents
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {LEGAL_LINKS.filter((link) => link.to !== (icon === 'privacy' ? '/privacy' : '/terms')).map(
                  (link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ),
                )}
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Documentation
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/12 via-card to-card p-6 sm:p-9">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <HeroIcon className="h-3 w-3 text-primary" />
                {eyebrow}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                {summary}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 px-3 py-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                Last updated {updatedAt}
              </div>
            </div>
          </section>

          <div className="mt-12 space-y-12">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 border-t border-border/50 pt-10 first:border-0 first:pt-0"
              >
                <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-5">{section.content}</div>
              </section>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-start gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-bold tracking-tight text-foreground">
                Questions about this document?
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Reach our team at {env.appName} support — or head back to the product.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/docs">
                  <FileText className="h-4 w-4" />
                  Read the docs
                </Link>
              </Button>
              <Button asChild>
                <Link to="/register">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </main>
      </div>

      <footer className="border-t border-border/60 bg-surface/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <BrandImage className="h-9 p-1.5" />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
            <Link to="/docs" className="transition-colors hover:text-foreground">
              Documentation
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function LegalPara({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{children}</p>
  )
}

export function LegalSubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{children}</h3>
}

export function LegalBullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="max-w-3xl space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function LegalNumbered({ items }: { items: ReactNode[] }) {
  return (
    <ol className="max-w-3xl space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/15 font-mono text-[10px] font-bold text-primary">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function LegalCallout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning'
  title: string
  children: ReactNode
}) {
  const tones = {
    info: { wrap: 'border-info/30 bg-info/10', accent: 'text-info', icon: ShieldCheck },
    warning: { wrap: 'border-warning/30 bg-warning/10', accent: 'text-warning', icon: ScrollText },
  } as const
  const { wrap, accent, icon: Icon } = tones[tone]
  return (
    <div className={cn('max-w-3xl rounded-2xl border p-4', wrap)}>
      <div className={cn('flex items-center gap-2 text-sm font-semibold', accent)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}
