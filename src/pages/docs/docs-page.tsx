import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, LogIn, Menu, X } from 'lucide-react'
import { BrandImage } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'
import { OverviewSection, GettingStartedSection, RolesSection, ConceptsSection } from './content-core'
import {
  PosSection,
  ShiftsSection,
  InventorySection,
  ExpirySection,
  ProductsSection,
  PurchasingSection,
} from './content-flow'
import { CustomersSection, FinanceSection, ExpensesSection, ReportsSection } from './content-money'
import {
  StaffSection,
  BranchesSection,
  SubscriptionSection,
  PlatformSection,
  PlaybooksSection,
  FaqSection,
  GlossarySection,
} from './content-admin'

const NAV_GROUPS: { title: string; items: { id: string; label: string }[] }[] = [
  {
    title: 'Start here',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'getting-started', label: 'Getting started' },
      { id: 'roles', label: 'Roles & permissions' },
      { id: 'concepts', label: 'Core concepts' },
    ],
  },
  {
    title: 'Selling',
    items: [
      { id: 'pos', label: 'Point of sale' },
      { id: 'shifts', label: 'Shifts & reconciliation' },
    ],
  },
  {
    title: 'Stock & supply',
    items: [
      { id: 'inventory', label: 'Inventory' },
      { id: 'expiry', label: 'Expiry management' },
      { id: 'products', label: 'Products & catalogue' },
      { id: 'purchasing', label: 'Purchasing & suppliers' },
    ],
  },
  {
    title: 'Customers & money',
    items: [
      { id: 'customers', label: 'Customers & credit' },
      { id: 'finance', label: 'Finance' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'reports', label: 'Reports & exports' },
    ],
  },
  {
    title: 'Administer',
    items: [
      { id: 'staff', label: 'Staff & access' },
      { id: 'branches', label: 'Branches & settings' },
      { id: 'subscription', label: 'Subscription & plans' },
      { id: 'platform', label: 'Platform admin' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { id: 'playbooks', label: 'Role playbooks' },
      { id: 'faq', label: 'FAQ & troubleshooting' },
      { id: 'glossary', label: 'Glossary' },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

export function DocsPage() {
  const [active, setActive] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)

  const ids = useMemo(() => ALL_ITEMS.map((item) => item.id), [])

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label={`${env.appName} home`}>
            <BrandImage className="h-9 p-1.5" />
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Documentation
            </span>
          </Link>

          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Guide
          </span>

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
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/register">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-background/95 lg:hidden">
            <div className="mx-auto max-h-[70vh] w-full max-w-7xl overflow-y-auto px-4 py-4 sm:px-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="mb-4 last:mb-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="mt-2 grid gap-0.5">
                    {group.items.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm font-medium',
                          active === item.id
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
                <Button asChild variant="secondary">
                  <Link to="/login">
                    <LogIn className="h-4 w-4" />
                    Sign in
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
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-10 px-4 py-10 sm:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-6 last:mb-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.title}
                </div>
                <ul className="mt-2 border-l border-border/60">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={cn(
                          '-ml-px flex border-l-2 py-1.5 pl-3 text-[13px] font-medium transition-colors',
                          active === item.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <DocsHero />
          <div className="mt-12 space-y-14">
            <OverviewSection />
            <GettingStartedSection />
            <RolesSection />
            <ConceptsSection />
            <PosSection />
            <ShiftsSection />
            <InventorySection />
            <ExpirySection />
            <ProductsSection />
            <PurchasingSection />
            <CustomersSection />
            <FinanceSection />
            <ExpensesSection />
            <ReportsSection />
            <StaffSection />
            <BranchesSection />
            <SubscriptionSection />
            <PlatformSection />
            <PlaybooksSection />
            <FaqSection />
            <GlossarySection />
          </div>

          <div className="mt-16 flex flex-col items-start gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-bold tracking-tight text-foreground">
                Ready to try it yourself?
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a workspace in minutes, or sign in to an existing one.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign in
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
    </div>
  )
}

function DocsHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-8 sm:p-10">
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-72 rounded-full bg-primary/20 blur-[100px]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-3 w-3 text-primary" />
          User guide
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          How to use {env.appName}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          A complete, visual walkthrough of every role and module — from creating your business and
          onboarding staff, through day-to-day selling and stock control, to finance, reporting and
          platform administration.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {ALL_ITEMS.slice(0, 8).map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-full border border-border/70 bg-surface/70 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
