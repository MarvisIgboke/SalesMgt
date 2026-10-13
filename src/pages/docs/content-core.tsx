import {
  Briefcase,
  ClipboardList,
  Crown,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  ShoppingCart,
  Smartphone,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { CircleCheck } from 'lucide-react'
import { env } from '@/lib/env'
import { Snapshot, Flow, Pill, StatTile } from './mocks'
import { MockDashboard, MockRegister, MockStaff, MockSubscription } from './screens'
import {
  BulletList,
  Callout,
  CheckList,
  DataTable,
  DefinitionList,
  DocSection,
  Steps,
} from './parts'

function Yes() {
  return <CircleCheck className="h-4 w-4 text-success" />
}
function No() {
  return <span className="text-muted-foreground/50">—</span>
}

const ROLE_CARDS: { icon: LucideIcon; name: string; tone: string; body: string }[] = [
  {
    icon: Crown,
    name: 'Super Admin',
    tone: 'text-primary',
    body: 'Platform owner. Manages every business, plan and user across the ecosystem, and can act inside any tenant.',
  },
  {
    icon: Briefcase,
    name: 'Business Admin',
    tone: 'text-info',
    body: 'Runs one business end to end: branches, staff, plans, finance, settings and reporting.',
  },
  {
    icon: Store,
    name: 'Store Manager',
    tone: 'text-success',
    body: 'Runs a single branch. Opens shifts, assigns cashiers, approves stock and operating expenses.',
  },
  {
    icon: ClipboardList,
    name: 'Inventory Officer',
    tone: 'text-warning',
    body: 'Keeps stock accurate with adjustments, transfers, goods-received notes and expiry handling.',
  },
  {
    icon: ShoppingCart,
    name: 'Sales Representative',
    tone: 'text-primary',
    body: 'Sells at the counter: opens sales, manages customers, handles credit and prints receipts.',
  },
  {
    icon: ScrollText,
    name: 'Auditor',
    tone: 'text-muted-foreground',
    body: 'Read-only oversight across sales, finance, shifts and audit logs for compliance.',
  },
]

const PERMISSION_ROWS = {
  columns: ['Capability', 'Business Admin', 'Store Manager', 'Inventory Officer', 'Sales Rep', 'Auditor'],
  rows: [
    ['Process sales & take payment', <No key="1" />, <Yes key="1" />, <No key="1" />, <Yes key="1" />, <No key="1" />],
    ['Open / close a store shift', <Yes key="2" />, <Yes key="2" />, <No key="2" />, <No key="2" />, <No key="2" />],
    ['Adjust & transfer stock', <Yes key="3" />, <Yes key="3" />, <Yes key="3" />, <No key="3" />, <No key="3" />],
    ['Manage products & catalogue', <Yes key="4" />, <No key="4" />, <Yes key="4" />, <No key="4" />, <No key="4" />],
    ['Create customers & credit sales', <Yes key="5" />, <Yes key="5" />, <No key="5" />, <Yes key="5" />, <No key="5" />],
    ['Approve expenses & payment requests', <Yes key="6" />, <Yes key="6" />, <No key="6" />, <No key="6" />, <No key="6" />],
    ['Manage staff, roles & branches', <Yes key="7" />, <No key="7" />, <No key="7" />, <No key="7" />, <No key="7" />],
    ['View reports & export data', <Yes key="8" />, <Yes key="8" />, <No key="8" />, <No key="8" />, <Yes key="8" />],
    ['Manage subscription & plans', <Yes key="9" />, <No key="9" />, <No key="9" />, <No key="9" />, <No key="9" />],
  ],
}

export function OverviewSection() {
  return (
    <DocSection
      id="overview"
      eyebrow="Overview"
      title={`Welcome to ${env.appName}`}
      lead={`${env.appName} is a multi-branch sales management ecosystem. It brings point of sale, inventory, purchasing, customers, finance, staff and reporting into one fast, offline-ready workspace that scales from a single shop to a nationwide retail network.`}
    >
      <Snapshot
        path="/dashboard"
        active="Dashboard"
        legend={[
          'The dashboard is your daily pulse: sales, transactions, margin and stock health.',
          'Switch the reporting window between today, week, month or a custom range.',
          'Cards drill into the underlying module when a number needs investigating.',
          'A connectivity chip tells you at a glance whether you are online or working offline.',
        ]}
      >
        <MockDashboard />
      </Snapshot>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Everything in the app is organised around a few simple ideas: you run one or more{' '}
        <strong className="font-semibold text-foreground">branches</strong>, staffed by{' '}
        <strong className="font-semibold text-foreground">people</strong> with{' '}
        <strong className="font-semibold text-foreground">roles</strong>, who sell{' '}
        <strong className="font-semibold text-foreground">products</strong> and record everything
        against a <strong className="font-semibold text-foreground">shift</strong>. Money, stock and
        credit always reconcile back to a business.
      </p>

      <CheckList
        items={[
          'Sell with a barcode-first POS that supports holds, split payments and discounts.',
          'Track live stock across every branch with adjustments and transfers.',
          'Run purchasing from requisition to goods-received and supplier payment.',
          'Manage customers, credit limits, statements and repayments.',
          'Approve payment requests and reconcile cash in the finance control room.',
          'Report on sales, stock, operations and full profit and loss, then export.',
        ]}
      />

      <Callout tone="info" title="Built to keep selling">
        The app is an installable PWA with an offline-first sales path. If the network drops, the
        register keeps taking sales and syncs transactions automatically when the connection returns.
      </Callout>
    </DocSection>
  )
}

export function GettingStartedSection() {
  return (
    <DocSection
      id="getting-started"
      eyebrow="Getting started"
      title="From sign-up to your first sale"
      lead="A new workspace is ready in minutes. Follow the onboarding path below, then invite your team and start selling."
    >
      <Flow
        steps={[
          { title: 'Create your account', body: 'Register the business and its owner, then choose currency and country.' },
          { title: 'Set up branches & staff', body: 'Add your locations and invite the people who will use the system.' },
          { title: 'Add products', body: 'Create your catalogue with prices, costs and barcodes.' },
          { title: 'Open a shift & sell', body: 'A manager opens the shift, then reps ring up sales at the POS.' },
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Create the business</h3>
      <Snapshot
        path="/register"
        legend={[
          'Enter the legal or trading name of the business and the owner details.',
          'Pick the operating currency and country — these drive money and tax formatting.',
          'Submitting creates the business, a wallet and a free trial subscription automatically.',
          'The owner is created as the first Business Admin and signed straight in.',
        ]}
      >
        <MockRegister />
      </Snapshot>

      <Steps
        items={[
          {
            title: 'Register and confirm your details',
            body: (
              <>
                On the register screen enter the business name, your name, email, password, phone,
                currency and country. Submitting shows the toast{' '}
                <em>"Business registered successfully"</em>.
              </>
            ),
          },
          {
            title: 'Your workspace is provisioned automatically',
            body: (
              <>
                The system creates your business, a business{' '}
                <strong className="font-semibold text-foreground">wallet</strong>, a{' '}
                <strong className="font-semibold text-foreground">30-day trial subscription</strong>{' '}
                and your user account with the{' '}
                <strong className="font-semibold text-foreground">Business Admin</strong> role.
              </>
            ),
          },
          {
            title: 'Add branches',
            body: 'Open Branches and add each location. Every branch can have its own staff, stock and shifts.',
          },
          {
            title: 'Invite staff',
            body: 'Open Staff, add each person and assign a role. Permissions can be refined per user afterwards.',
          },
          {
            title: 'Create products',
            body: 'Add products with selling price, cost, unit and barcode. Organise them with categories and brands.',
          },
          {
            title: 'Start selling',
            body: 'A Store Manager opens a shift and assigns cashiers, then reps take sales at the POS.',
          },
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Signing in</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        The sign-in screen offers three modes and defaults to the enterprise SSO form.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Smartphone, name: 'PIN / NFC', body: 'Fast counter login with a staff PIN or an NFC tag.' },
          { icon: Fingerprint, name: 'Biometric', body: 'Sign in with the device biometric unlock (passkey).' },
          { icon: KeyRound, name: 'SSO / IAM', body: 'Email (Operator Directory ID) with a passkey or master password.' },
        ].map((mode) => (
          <div key={mode.name} className="rounded-2xl border border-border/60 bg-card p-4">
            <mode.icon className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-semibold text-foreground">{mode.name}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{mode.body}</p>
          </div>
        ))}
      </div>
      <Callout tone="tip" title="Setup checklist">
        Before your first sale, confirm: at least one branch, one staff member with a selling role, one
        product with stock, and a configured receipt in Settings.
      </Callout>
    </DocSection>
  )
}

export function RolesSection() {
  return (
    <DocSection
      id="roles"
      eyebrow="Roles & permissions"
      title="Give everyone the right access"
      lead="Six built-in roles cover the whole organisation. A Business Admin can start from a role and then grant or revoke individual permissions per person."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_CARDS.map((role) => (
          <div key={role.name} className="rounded-2xl border border-border/60 bg-card p-5">
            <role.icon className={`h-6 w-6 ${role.tone}`} />
            <div className="mt-3 text-sm font-semibold text-foreground">{role.name}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{role.body}</p>
          </div>
        ))}
      </div>

      <Snapshot
        path="/staff"
        active="Customers"
        legend={[
          'Staff is where you invite people and assign a role.',
          'Each person is scoped to one or more branches.',
          'Open Permissions on a row to fine-tune access beyond the role default.',
          'Sessions shows where an account is currently signed in and lets you revoke it.',
        ]}
      >
        <MockStaff />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Typical permissions by role</h3>
      <DataTable columns={PERMISSION_ROWS.columns} rows={PERMISSION_ROWS.rows} />
      <Callout tone="warning" title="Principle of least privilege">
        Grant the smallest set of permissions a person needs. Cashiers rarely need stock-adjustment or
        approval rights, and auditors should stay read-only.
      </Callout>
    </DocSection>
  )
}

export function ConceptsSection() {
  return (
    <DocSection
      id="concepts"
      eyebrow="Core concepts"
      title="The vocabulary of the system"
      lead="A quick glossary of the terms you will meet throughout the app. Understanding these makes every module easier to follow."
    >
      <DefinitionList
        items={[
          {
            term: 'Business (tenant)',
            body: 'Your top-level organisation. It owns branches, staff, the catalogue, the subscription and the wallet.',
          },
          {
            term: 'Branch',
            body: 'A physical or logical location. Stock, shifts and staff can each be scoped to a branch.',
          },
          {
            term: 'Staff vs. user',
            body: 'A user is a login account. Staff is the operational profile — role, branch and permissions — attached to that account.',
          },
          {
            term: 'Shift (store shift)',
            body: 'A trading window for a branch opened by a manager with an opening float and closed with a reconciliation.',
          },
          {
            term: 'Sale (session)',
            body: 'A single till session a rep opens before charging. Sales roll up into the branch shift.',
          },
          {
            term: 'Plan & subscription',
            body: 'A subscription ties a plan to a business. Plan limits (staff, branches, products) are shared across all branches.',
          },
          {
            term: 'Wallet',
            body: 'A business-level balance used for platform charges such as subscription billing.',
          },
          {
            term: 'Credit ledger',
            body: 'The running account of what a customer owes, adjusted by credit sales, repayments and statements.',
          },
        ]}
      />

      <Flow
        steps={[
          { title: 'Business', body: 'Owns the subscription, wallet and every branch below it.' },
          { title: 'Branches', body: 'Locations that hold their own stock, shifts and staff assignments.' },
          { title: 'Staff', body: 'Users with a role, branch scope and optional permission overrides.' },
          { title: 'Shifts & sales', body: 'Daily trading windows and the transactions that make up their totals.' },
        ]}
      />

      <Snapshot
        path="/subscription"
        active="Settings"
        legend={[
          'The subscription page shows the current plan and its shared limits.',
          'Limits apply to the whole business and are pooled across every branch.',
          'Enabled features list what the plan unlocks for the whole business.',
          'Upgrade or compare plans from the same screen.',
        ]}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Plan" value="Growth" />
            <StatTile label="Renews" value="10 Aug 2027" tone="primary" />
            <StatTile label="Status" value="Active" tone="success" />
          </div>
          <MockSubscription />
        </div>
      </Snapshot>

      <div className="flex flex-wrap gap-2">
        <Pill tone="primary">Business-scoped</Pill>
        <Pill tone="success">Plan limits shared across branches</Pill>
        <Pill tone="warning">Shift required before selling (configurable)</Pill>
        <Pill tone="info">
          <LayoutDashboard className="h-3 w-3" /> Dashboard is branch-aware
        </Pill>
      </div>

      <BulletList
        items={[
          <>
            <strong className="font-semibold text-foreground">Context switching:</strong> when you
            belong to more than one branch, the header lets you switch branch without signing out.
          </>,
          <>
            <strong className="font-semibold text-foreground">Money is business-scoped:</strong> the
            subscription, wallet and plan limits always apply to the whole business, not one branch.
          </>,
          <>
            <strong className="font-semibold text-foreground">Everything is audited:</strong> sensitive
            actions (voids, price overrides, stock adjustments, approvals) are logged with who and when.
          </>,
        ]}
      />
    </DocSection>
  )
}
