import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  Clock4,
  CreditCard,
  Crown,
  Gem,
  Globe,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  Lock,
  LogIn,
  Menu,
  Package,
  ReceiptText,
  RefreshCcw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tags,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { BrandImage } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Modules', href: '#modules' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Roles', href: '#roles' },
  { label: 'Plans', href: '#plans' },
] as const

const HERO_STATS = [
  { label: 'Sales today', value: '₦1.24M', delta: '+12.4%', tone: 'success' as const },
  { label: 'Gross margin', value: '38.6%', delta: '+1.8pts', tone: 'primary' as const },
  { label: 'Low stock', value: '14', delta: '3 need reorder', tone: 'warning' as const },
]

const METRICS = [
  { label: 'Transactions', value: '9,482' },
  { label: 'Active staff', value: '27' },
  { label: 'Branches live', value: '5' },
  { label: 'Stock value', value: '₦8.1M' },
]

const HIGHLIGHTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShoppingCart,
    title: 'Lightning-fast POS',
    body: 'Scan, split-pay, hold and resume sales with a keyboard and barcode-first register built for busy counters.',
  },
  {
    icon: Boxes,
    title: 'Real-time inventory',
    body: 'Live stock across every branch with adjustments, transfers, goods-received and approval workflows.',
  },
  {
    icon: Users,
    title: 'Customers & credit',
    body: 'Segments, credit limits, statements and repayments tracked to the kobo for every account.',
  },
  {
    icon: Wallet,
    title: 'Finance control room',
    body: 'Payment approvals, cash reconciliation, receivables and payables in one audited workspace.',
  },
  {
    icon: BarChart3,
    title: 'Reports that export',
    body: 'Sales, stock, operations and full P&L reporting, ready to download for stakeholders.',
  },
  {
    icon: Truck,
    title: 'Purchasing pipeline',
    body: 'Requisitions, purchase orders, invoices, payments and supplier returns end to end.',
  },
]

interface ModuleItem {
  icon: LucideIcon
  name: string
  body: string
}

interface ModuleGroup {
  id: string
  eyebrow: string
  title: string
  body: string
  items: ModuleItem[]
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: 'management',
    eyebrow: 'Management',
    title: 'Your daily command center',
    body: 'Everything a growing retailer checks first thing in the morning — sales, stock, staff and money.',
    items: [
      {
        icon: LayoutDashboard,
        name: 'Dashboard',
        body: 'A live pulse of revenue, sales, stock, staff and pending approvals the moment you sign in.',
      },
      {
        icon: ShoppingCart,
        name: 'POS / Sales',
        body: 'A scanner-and-keyboard register with cart holds, split payments, discounts and printable receipts.',
      },
      {
        icon: ReceiptText,
        name: 'Sales History',
        body: 'Every transaction with filters, refunds, cancellations and a complete audit trail.',
      },
      {
        icon: Wallet,
        name: 'Finance',
        body: 'Approvals, reconciliation, receivables and payables in one control room.',
      },
    ],
  },
  {
    id: 'operations',
    eyebrow: 'Operations',
    title: 'Stock, suppliers and the catalogue',
    body: 'Keep shelves full and margins healthy with tooling built for high-volume, multi-branch retail.',
    items: [
      {
        icon: Package,
        name: 'Products',
        body: 'Rich product records with variants, barcodes, pricing tiers, cost and images.',
      },
      {
        icon: Tags,
        name: 'Catalog',
        body: 'Curate product categories and brands to keep even the largest catalogue organised.',
      },
      {
        icon: Layers,
        name: 'Departments',
        body: 'Group what you sell and who sells it by department for clearer reporting.',
      },
      {
        icon: Boxes,
        name: 'Inventory',
        body: 'Real-time levels across branches with adjustments, transfers and approval flows.',
      },
      {
        icon: History,
        name: 'Stock Trace',
        body: "Follow any product's movement history from intake all the way to sale.",
      },
      {
        icon: CalendarClock,
        name: 'Expiry Manager',
        body: 'Track batch expiry with near-expiry and expired buckets to cut waste.',
      },
      {
        icon: ShoppingBag,
        name: 'Purchasing',
        body: 'Requisitions, purchase orders, invoices, payments and returns in one pipeline.',
      },
      {
        icon: Truck,
        name: 'Suppliers',
        body: 'A supplier directory with full purchase and payment history on every account.',
      },
    ],
  },
  {
    id: 'people',
    eyebrow: 'Finance & People',
    title: 'Staff, shifts and branch network',
    body: 'Run the whole organisation — expenses, branches, teams, shifts and the customer ledger.',
    items: [
      {
        icon: ReceiptText,
        name: 'Expenses',
        body: 'Capture, categorise and approve operating expenses with receipts attached.',
      },
      {
        icon: Building2,
        name: 'Branches',
        body: 'Spin up and manage unlimited branches under a single business.',
      },
      {
        icon: UserCog,
        name: 'Staff & Roles',
        body: 'Invite staff, assign roles and fine-tune per-user permissions.',
      },
      {
        icon: Clock4,
        name: 'Shifts',
        body: 'Open shifts, assign cashiers, reconcile cash and track every movement.',
      },
      {
        icon: Users,
        name: 'Customers & Credit',
        body: 'Profiles, segments, statements, credit limits and repayments in one ledger.',
      },
    ],
  },
  {
    id: 'system',
    eyebrow: 'System',
    title: 'Reporting, billing and control',
    body: 'Turn activity into insight, keep everyone informed and manage the subscription behind it all.',
    items: [
      {
        icon: BarChart3,
        name: 'Reports',
        body: 'Summary reporting across sales, stock and operations, exportable for stakeholders.',
      },
      {
        icon: Landmark,
        name: 'Financial Report',
        body: 'Profit and loss, cash flow and margin analysis, ready to export.',
      },
      {
        icon: Bell,
        name: 'Notifications',
        body: 'In-app and push alerts for approvals, low stock and expiring items.',
      },
      {
        icon: CreditCard,
        name: 'Subscription',
        body: 'Plan, limits, renewal dates and usage for the business at a glance.',
      },
      {
        icon: Settings,
        name: 'Settings',
        body: 'Business profile, currency, tax and receipt configuration in one place.',
      },
    ],
  },
  {
    id: 'platform',
    eyebrow: 'Platform',
    title: 'Super Admin tools',
    body: 'For operators running the ecosystem itself — every business, plan and user under one roof.',
    items: [
      {
        icon: Building2,
        name: 'Businesses',
        body: 'Register tenants and assign subscription plans from a single console.',
      },
      {
        icon: Gem,
        name: 'Plans',
        body: 'Define pricing tiers and shared limits for staff, branches and products.',
      },
      {
        icon: Users,
        name: 'Users',
        body: 'Oversee every account across the platform with session control.',
      },
      {
        icon: Globe,
        name: 'Global Search',
        body: 'Find any product, sale, customer or supplier the instant you need it.',
      },
    ],
  },
]

const CAPABILITIES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: WifiOff,
    title: 'Offline-first PWA',
    body: 'Install it like an app and keep selling even when the network drops, syncing when you reconnect.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    body: 'Six built-in roles with granular, per-user permission overrides — grant exactly what each person needs.',
  },
  {
    icon: Building2,
    title: 'Multi-branch native',
    body: 'One business, unlimited branches. Switch context instantly without separate logins.',
  },
  {
    icon: RefreshCcw,
    title: 'Idempotent transactions',
    body: 'Sales, payments and stock moves are safe to retry — no accidental double charges.',
  },
  {
    icon: ScrollText,
    title: 'Audit & risk flags',
    body: 'Every sensitive action is logged and suspicious activity is surfaced automatically.',
  },
  {
    icon: Search,
    title: 'Instant global search',
    body: 'A single command palette across products, customers, sales and suppliers.',
  },
  {
    icon: CreditCard,
    title: 'Plans & wallet',
    body: 'Subscription plans, shared limits and a business wallet keep billing predictable.',
  },
  {
    icon: Lock,
    title: 'Enterprise security',
    body: 'Tokenised sessions you can revoke, secure password resets and scoped API access.',
  },
]

const ROLES: { icon: LucideIcon; name: string; body: string; tone: string }[] = [
  {
    icon: Crown,
    name: 'Super Admin',
    body: 'Owns the whole ecosystem — every business, plan, user and platform setting.',
    tone: 'text-primary',
  },
  {
    icon: Briefcase,
    name: 'Business Admin',
    body: 'Runs the entire business across all branches, staff and finances.',
    tone: 'text-info',
  },
  {
    icon: Store,
    name: 'Store Manager',
    body: 'Operates a single branch: opens shifts, approves stock and expenses.',
    tone: 'text-success',
  },
  {
    icon: ClipboardList,
    name: 'Inventory Officer',
    body: 'Keeps stock accurate with adjustments, transfers and goods-received.',
    tone: 'text-warning',
  },
  {
    icon: ShoppingCart,
    name: 'Sales Rep',
    body: 'Sells fast, manages customers and handles credit at the counter.',
    tone: 'text-primary',
  },
  {
    icon: ScrollText,
    name: 'Auditor',
    body: 'Read-only visibility across sales, finance and audit for compliance.',
    tone: 'text-muted-foreground',
  },
]

const PLANS: {
  name: string
  tagline: string
  price: string
  cadence: string
  featured?: boolean
  features: string[]
}[] = [
  {
    name: 'Starter',
    tagline: 'For a single-store business finding its feet.',
    price: 'Free',
    cadence: 'forever',
    features: ['1 branch', '3 staff seats', '500 products', 'POS, inventory & customers', 'Core reporting'],
  },
  {
    name: 'Growth',
    tagline: 'Multi-user teams with approvals and finance.',
    price: '₦15,000',
    cadence: 'per month',
    featured: true,
    features: [
      '3 branches',
      '15 staff seats',
      '5,000 products',
      'Suppliers, expenses & shifts',
      'Finance & expiry tools',
    ],
  },
  {
    name: 'Scale',
    tagline: 'Multi-branch operations with the full toolkit.',
    price: '₦50,000',
    cadence: 'per month',
    features: [
      '20 branches',
      '100 staff seats',
      '50,000 products',
      'Audit, wallet & roles',
      'Everything in Growth',
    ],
  },
  {
    name: 'Enterprise',
    tagline: 'Custom limits, dedicated support and integrations.',
    price: 'Let’s talk',
    cadence: 'tailored',
    features: ['Unlimited branches', 'Unlimited staff', 'Custom limits', 'Integrations', 'Priority support'],
  },
]

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Modules', href: '#modules' },
      { label: 'Capabilities', href: '#capabilities' },
      { label: 'Plans', href: '#plans' },
      { label: 'Documentation', href: '/docs' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Retail & supermarkets', href: '#modules' },
      { label: 'Pharmacies', href: '#modules' },
      { label: 'Restaurants', href: '#modules' },
      { label: 'Wholesale & B2B', href: '#modules' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Register a business', href: '/register' },
      { label: 'Roles', href: '#roles' },
      { label: 'Pricing', href: '#plans' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Documentation', href: '/docs' },
    ],
  },
]

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center" aria-label={`${env.appName} home`}>
            <BrandImage className="h-9 p-1.5" />
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/docs"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Documentation
            </Link>
          </nav>

          <div className="flex items-center gap-2">
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
              className="lg:hidden"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/docs"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Documentation
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent sm:hidden"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-grid-fade" />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div className="animate-slide-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Enterprise Retail OS · v4.2-LTS
              </span>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Run every branch of your business from{' '}
                <span className="bg-gradient-to-br from-primary via-primary to-info bg-clip-text text-transparent">
                  one command center
                </span>
                .
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {env.appName} is a multi-branch sales, inventory and finance ecosystem for retail,
                supermarkets, pharmacies, restaurants and wholesalers. Sell, stock, staff, reconcile
                and report — all in one fast, offline-ready workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="xl">
                  <Link to="/register">
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="xl">
                  <Link to="/login">
                    <LogIn className="h-4 w-4" />
                    Sign in to your workspace
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <Link to="/docs">
                    <BookOpen className="h-4 w-4" />
                    Read the docs
                  </Link>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {['No card required', 'Works offline', 'Unlimited branches on Scale'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative animate-slide-up">
              <HeroPreview />
            </div>
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-4">
            {METRICS.map((metric) => (
              <div key={metric.label} className="bg-card px-5 py-6 text-center">
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {metric.value}
                </div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHeading
            eyebrow="Why SalesMgt"
            title="Everything you need to sell, stock and scale"
            body="One ecosystem replaces a patchwork of tills, spreadsheets and disconnected apps — and every part talks to the others."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <article
                key={item.title}
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="modules" className="scroll-mt-20 border-y border-border/60 bg-surface/40 py-16 lg:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="All modules"
              title="A complete toolkit, module by module"
              body="Twenty-plus purpose-built modules, organised the way real retail teams work."
            />

            <div className="mt-14 flex flex-col gap-16">
              {MODULE_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                        {group.eyebrow}
                      </span>
                      <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                        {group.title}
                      </h3>
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">{group.body}</p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-elevated text-primary">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHeading
            eyebrow="Platform capabilities"
            title="Built like an enterprise product, priced like a tool"
            body="The fundamentals that keep a growing retailer fast, safe and always open for business."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-card"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/12 text-success ring-1 ring-inset ring-success/20">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="roles" className="scroll-mt-20 border-y border-border/60 bg-surface/40 py-16 lg:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Built for every role"
              title="The right access for the right people"
              body="Six ready-made roles with permission-level control — so cashiers move fast and admins stay in command."
            />

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ROLES.map((role) => (
                <article key={role.name} className="rounded-2xl border border-border/60 bg-card p-6">
                  <role.icon className={cn('h-6 w-6', role.tone)} />
                  <h3 className="mt-4 text-base font-semibold text-foreground">{role.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHeading
            eyebrow="Plans"
            title="Simple pricing that grows with you"
            body="Start free, upgrade when the business does. Limits are shared across every branch on the plan."
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-card p-6 shadow-card',
                  plan.featured ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/60',
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold tracking-tight text-foreground">{plan.name}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{plan.tagline}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{plan.cadence}</span>
                </div>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.featured ? 'default' : 'secondary'}
                  className="mt-6 w-full"
                >
                  <Link to="/register">
                    {plan.price === 'Let’s talk' ? 'Contact sales' : 'Get started'}
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/20 via-card to-card p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Ready to run your whole business from one place?
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Create your workspace in minutes — no card required. Bring your branches, staff and
                stock, and start selling.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link to="/register">
                    Create your business
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="xl">
                  <Link to="/login">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <Link to="/docs">
                    <BookOpen className="h-4 w-4" />
                    Browse the guide
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-surface/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <BrandImage className="h-9 p-1.5" />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                The multi-branch sales management ecosystem for modern retail.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                Offline-ready · PWA
              </div>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {column.title}
                </h4>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) =>
                    link.href.startsWith('#') ? (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>
              © {new Date().getFullYear()} {env.appName}. All rights reserved.
            </span>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <Link to="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link to="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link to="/docs" className="transition-colors hover:text-foreground">
                Docs
              </Link>
            </nav>
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              Built for growing retail teams.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function HeroPreview() {
  const bars = [42, 58, 36, 72, 64, 88, 54]
  const lines = [
    { label: 'POS terminals', value: '18', width: '92%' },
    { label: 'Inventory sync', value: '5 branches', width: '78%' },
    { label: 'Pending approvals', value: '6', width: '46%' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="relative rounded-3xl border border-border/60 bg-card/90 p-4 shadow-card backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Demo Retail · HQ
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border/60 bg-surface p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-1.5 text-sm font-bold text-foreground">{stat.value}</div>
              <div
                className={cn(
                  'mt-1 text-[10px] font-medium',
                  stat.tone === 'success' && 'text-success',
                  stat.tone === 'primary' && 'text-primary',
                  stat.tone === 'warning' && 'text-warning',
                )}
              >
                {stat.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Weekly sales</span>
            <span className="font-mono text-[10px] text-muted-foreground">last 7 days</span>
          </div>
          <div className="mt-4 flex h-24 items-end gap-2">
            {bars.map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-md bg-gradient-to-t from-primary/30 to-primary"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-surface p-4">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-[11px] text-muted-foreground">{line.label}</div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-info"
                  style={{ width: line.width }}
                />
              </div>
              <div className="w-16 shrink-0 text-right font-mono text-[10px] text-foreground">
                {line.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
