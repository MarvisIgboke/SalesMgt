import { Pill, Snapshot, StatTile } from './mocks'
import { MockPlatform, MockStaff, MockSubscription } from './screens'
import {
  BulletList,
  Callout,
  CheckList,
  DataTable,
  DefinitionList,
  DocSection,
  Steps,
} from './parts'

const BRANCHES = [
  { name: 'Headquarters', code: 'HQ-001', staff: '12', status: 'Active', tone: 'success' as const },
  { name: 'Festac Town', code: 'FT-002', staff: '8', status: 'Active', tone: 'success' as const },
  { name: 'Ikeja City Mall', code: 'IK-003', staff: '7', status: 'Opening soon', tone: 'info' as const },
]

const PLAYBOOKS: { role: string; tone: string; tasks: string[] }[] = [
  {
    role: 'Business Admin',
    tone: 'text-info',
    tasks: [
      'Check the dashboard for overnight sales and low-stock alerts.',
      'Clear the approvals queue in Finance.',
      'Review the subscription usage and branch performance.',
      'Invite new staff and review access.',
    ],
  },
  {
    role: 'Store Manager',
    tone: 'text-success',
    tasks: [
      'Confirm your branch reps are assigned for the day.',
      'Open the store shift with the opening float.',
      'Approve counter requests (voids, credit limits).',
      'Close the shift and reconcile cash at the end of the day.',
    ],
  },
  {
    role: 'Inventory Officer',
    tone: 'text-warning',
    tasks: [
      'Review reorder and low-stock notices.',
      'Receive goods-received notes for expected deliveries.',
      'Raise transfers between branches as needed.',
      'Check the expiry vault for near-expiry batches.',
    ],
  },
  {
    role: 'Sales Representative',
    tone: 'text-primary',
    tasks: [
      'Sign in and confirm a shift is open for your branch.',
      'Open your sale before the first customer.',
      'Serve customers, attach accounts for credit sales.',
      'Close your sale at the end of your session.',
    ],
  },
  {
    role: 'Auditor',
    tone: 'text-muted-foreground',
    tasks: [
      'Review sales history and voids for the period.',
      'Inspect shift reconciliations and variances.',
      'Check stock adjustments for unusual patterns.',
      'Export reports for the compliance file.',
    ],
  },
  {
    role: 'Super Admin',
    tone: 'text-primary',
    tasks: [
      'Monitor business registrations and trials.',
      'Assign or adjust subscription plans.',
      'Manage platform users and sessions.',
      'Use global search to investigate any record.',
    ],
  },
]

const FAQ = [
  {
    term: 'The POS will not let me charge — it says no shift is open.',
    body: 'A Store Manager must open the store shift for your branch first. Ask them to open the shift, or if you have the permission, go to Shifts and open it.',
  },
  {
    term: 'A product is missing from the register.',
    body: 'Check the product is active and has stock at your branch. The POS only offers products available to the branch with stock on hand.',
  },
  {
    term: 'A customer cannot buy on credit.',
    body: 'The sale would exceed the customer credit limit. Raise the limit (with permission) or take a partial payment first.',
  },
  {
    term: 'A download is not appearing.',
    body: 'Exports download as files. Check your browser is not blocking automatic downloads for this site, then try the export again.',
  },
  {
    term: 'I cannot see a branch in the branch switcher.',
    body: 'You are only assigned to branches your account has access to. Ask an admin to assign you to the branch.',
  },
  {
    term: 'Why are plan limits the same across my branches?',
    body: 'Plan limits (staff, branches, products) apply to the whole business and are shared across every branch, not allocated per branch.',
  },
]

const GLOSSARY = [
  { term: 'Business / tenant', body: 'The top-level organisation that owns branches, staff, the catalogue, the plan and the wallet.' },
  { term: 'Branch', body: 'A location where you sell and hold stock. Staff and shifts are scoped to branches.' },
  { term: 'Staff', body: 'An operational profile (role, branch, permissions) attached to a login account.' },
  { term: 'Role', body: 'A preset bundle of permissions: Super Admin, Business Admin, Store Manager, Inventory Officer, Sales Representative or Auditor.' },
  { term: 'Permission', body: 'A single capability (for example, adjusting stock). Granted by role and adjustable per user.' },
  { term: 'Shift', body: 'A branch trading window opened by a manager with an opening float and closed with reconciliation.' },
  { term: 'Sale session', body: "A rep's own till session within a shift." },
  { term: 'GRN', body: 'Goods Received Note — the record that increases stock when a delivery arrives.' },
  { term: 'FEFO', body: 'First-Expired-First-Out: sell the earliest-expiring batch first.' },
  { term: 'Credit ledger', body: 'The running balance of what a customer owes, updated by credit sales and repayments.' },
  { term: 'Wallet', body: 'A business-level balance used for platform charges such as subscription billing.' },
  { term: 'Plan limits', body: 'Caps on staff, branches and products for the business, shared across all its branches.' },
]

export function StaffSection() {
  return (
    <DocSection
      id="staff"
      eyebrow="Staff & access"
      title="Invite, assign and control"
      lead="Staff is the operational side of user management. Invite a person, assign a role and branch, then refine their permissions and manage where they are signed in."
    >
      <Snapshot
        path="/staff"
        active="Customers"
        legend={[
          'New staff invites a person and assigns their role and branch.',
          'Each row shows role, branch and current status.',
          'Permissions opens a fine-grained access editor for that person.',
          'Sessions lists active logins and lets you revoke one immediately.',
        ]}
      >
        <MockStaff />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Adding a team member</h3>
      <Steps
        items={[
          { title: 'Invite', body: 'Open Staff and choose New staff. Enter the name, email and phone.' },
          { title: 'Assign a role', body: 'Pick the closest built-in role: manager, inventory officer, sales rep and so on.' },
          { title: 'Scope the branch', body: 'Choose which branches the person belongs to. Multi-branch staff switch context from the header.' },
          { title: 'Fine-tune permissions', body: 'Open Permissions to grant or revoke individual capabilities beyond the role default.' },
        ]}
      />

      <Callout tone="warning" title="Review access regularly">
        When someone changes role or leaves, update their access immediately and revoke any active
        sessions so they can no longer sign in.
      </Callout>

      <CheckList
        items={[
          'Only a Business Admin can invite staff and edit permissions.',
          'Per-user permissions override the role default, both granting and revoking.',
          'Revoking a session signs that device out on its next action.',
          'Staff can be scoped to one branch or many without separate logins.',
        ]}
      />
    </DocSection>
  )
}

export function BranchesSection() {
  return (
    <DocSection
      id="branches"
      eyebrow="Branches & settings"
      title="Scale beyond one location"
      lead="A business can run many branches under a single roof. Each branch has its own staff, stock and shifts, while the plan and wallet stay shared at the business level."
    >
      <Snapshot
        path="/branches"
        active="Settings"
        legend={[
          'Each branch has a name, a short code and its assigned staff.',
          'Branch status shows whether it is active or still being set up.',
          'Switch between branches from the header without signing out.',
          'Stock, shifts and staff assignments are all branch-scoped.',
        ]}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Branches" value="3" />
            <StatTile label="Staff" value="27" tone="primary" />
            <StatTile label="Plan allows" value="3 branches" tone="success" />
          </div>
          {BRANCHES.map((branch) => (
            <div
              key={branch.code}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface p-3"
            >
              <span className="text-xs font-semibold text-foreground">{branch.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{branch.code}</span>
              <Pill tone={branch.tone}>{branch.status}</Pill>
              <span className="ml-auto text-[10px] text-muted-foreground">{branch.staff} staff</span>
            </div>
          ))}
        </div>
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Business settings</h3>
      <DataTable
        columns={['Setting', 'What you control']}
        rows={[
          ['Business profile', 'Legal name, logo, contact details and address.'],
          ['Currency & tax', 'Default currency, tax rates and price inclusion.'],
          ['Receipt', 'Header, footer, logo and what appears on a printed receipt.'],
          ['Branches', 'Add, edit and deactivate branches and their assigned staff.'],
          ['Preferences', 'Shift rules, reconciliation requirements and low-stock thresholds.'],
        ]}
      />

      <Callout tone="info" title="One plan, many branches">
        Branches never have their own subscription. The plan, its limits and the wallet are owned by the
        business and shared across every branch.
      </Callout>
    </DocSection>
  )
}

export function SubscriptionSection() {
  return (
    <DocSection
      id="subscription"
      eyebrow="Subscription & plans"
      title="Plans, limits and billing"
      lead="Your subscription records which plan the business is on, when it renews and what the plan allows. Limits are shared across all branches of the business."
    >
      <Snapshot
        path="/subscription"
        active="Settings"
        legend={[
          'The current plan card shows name, renewal date and status.',
          'Limit tiles show staff, branch and product allowances for the whole business.',
          'Features list what the plan unlocks.',
          'Available plans and upgrade options sit alongside the current plan.',
        ]}
      >
        <MockSubscription />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Plan comparison</h3>
      <DataTable
        columns={['Plan', 'Price / month', 'Staff', 'Branches', 'Products']}
        rows={[
          ['Starter', 'Free', '1', '1', '500'],
          ['Growth', '₦15,000', '15', '3', '5,000'],
          ['Scale', '₦50,000', '100', '20', '50,000'],
          ['Enterprise', 'Custom', 'Unlimited', 'Unlimited', 'Custom'],
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Upgrading a plan</h3>
      <Steps
        items={[
          { title: 'Compare plans', body: 'Open Subscription and review the available plans.' },
          { title: 'Confirm the change', body: 'Choose the target plan; the change takes effect for the business.' },
          { title: 'Check limits', body: 'The new limits apply immediately and are shared across all branches.' },
        ]}
      />

      <Callout tone="tip" title="Trial period">
        A new business starts on a 30-day trial. Upgrade at any time from the subscription page before
        the trial ends to keep every module available.
      </Callout>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Plan and price management is a platform concern: only a Super Admin defines plans and their
        limits. A Business Admin chooses among the plans offered.
      </p>
    </DocSection>
  )
}

export function PlatformSection() {
  return (
    <DocSection
      id="platform"
      eyebrow="Platform admin"
      title="Super Admin tools"
      lead="Super Admins operate the ecosystem itself: registering businesses, assigning plans and overseeing every user across all tenants."
    >
      <Snapshot
        path="/businesses"
        active="Settings"
        legend={[
          'Businesses lists every tenant with its plan and status.',
          'Tiles summarise totals: active, on trial and suspended businesses.',
          'Assign plan moves a business onto a different subscription.',
          'Users and Plans give platform-wide control over accounts and pricing.',
        ]}
      >
        <MockPlatform />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Platform tasks</h3>
      <Steps
        items={[
          { title: 'Register a business', body: 'Create a tenant directly, or let a business self-register and appear here.' },
          { title: 'Assign a plan', body: 'Choose the subscription plan and limits for the business.' },
          { title: 'Manage users', body: 'Oversee every account across tenants and revoke sessions where needed.' },
          { title: 'Use global search', body: 'Find any product, sale, customer or supplier instantly to investigate an issue.' },
        ]}
      />

      <Callout tone="info" title="A global view, safely">
        Platform tools span every business. Changes here are audited, and the Super Admin role should be
        held by as few people as possible.
      </Callout>
    </DocSection>
  )
}

export function PlaybooksSection() {
  return (
    <DocSection
      id="playbooks"
      eyebrow="Role playbooks"
      title="What each role does day to day"
      lead="A short checklist for every role, so a new team member can be productive on day one."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAYBOOKS.map((pb) => (
          <div key={pb.role} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className={`text-sm font-semibold ${pb.tone}`}>{pb.role}</div>
            <div className="mt-3">
              <BulletList items={pb.tasks} />
            </div>
          </div>
        ))}
      </div>
    </DocSection>
  )
}

export function FaqSection() {
  return (
    <DocSection
      id="faq"
      eyebrow="FAQ & troubleshooting"
      title="Quick answers to common questions"
      lead="The issues new users hit most often, and how to resolve them."
    >
      <DefinitionList items={FAQ} />
    </DocSection>
  )
}

export function GlossarySection() {
  return (
    <DocSection
      id="glossary"
      eyebrow="Glossary"
      title="Terms used in this guide"
      lead="A one-line refresher for every term you are likely to meet."
    >
      <DefinitionList items={GLOSSARY} />
      <div className="flex flex-wrap gap-2 pt-2">
        <Pill tone="primary">Tip</Pill>
        <Pill tone="success">Everything is audited</Pill>
        <Pill tone="info">Offline-ready PWA</Pill>
        <Pill tone="warning">Limits are business-scoped</Pill>
      </div>
    </DocSection>
  )
}
