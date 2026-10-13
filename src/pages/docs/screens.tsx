import type { ReactNode } from 'react'
import {
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  Clock4,
  CreditCard,
  Gem,
  Package,
  ReceiptText,
  ScanBarcode,
  Sparkles,
  Tags,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { Bar, Pill, StatTile } from './mocks'
import { cn } from '@/lib/utils'

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'relative mt-0.5 inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-success' : 'bg-secondary',
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 rounded-full bg-white transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </span>
  )
}

function Btn({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode
  tone?: 'primary' | 'muted' | 'success' | 'destructive'
  className?: string
}) {
  const tones = {
    primary: 'bg-primary text-primary-foreground',
    muted: 'border border-border/60 bg-secondary text-foreground',
    success: 'bg-success text-success-foreground',
    destructive: 'bg-destructive/90 text-destructive-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function MockRegister() {
  const fields = [
    { label: 'Business name', value: 'Demo Retail Ltd' },
    { label: 'Owner name', value: 'Amaka Obi' },
    { label: 'Email', value: 'admin@demo.local' },
    { label: 'Phone', value: '+234 801 234 5678' },
  ]
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-foreground">Create your business</div>
        <div className="text-[11px] text-muted-foreground">Start free · 30-day trial · no card required</div>
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="space-y-2.5">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {f.label}
              </div>
              <div className="mt-1 rounded-lg border border-border/60 bg-surface-sunken px-3 py-2 text-[12px] text-foreground">
                {f.value}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Currency', value: 'NGN · ₦' },
              { label: 'Country', value: 'Nigeria' },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </div>
                <div className="mt-1 rounded-lg border border-border/60 bg-surface-sunken px-3 py-2 text-[12px] text-foreground">
                  {f.value}
                </div>
              </div>
            ))}
          </div>
          <Btn tone="primary" className="w-full">
            Create business
          </Btn>
        </div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-center text-[11px] text-success">
        Business registered successfully
      </div>
    </div>
  )
}

export function MockDashboard() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="primary">Today</Pill>
        <Pill>Yesterday</Pill>
        <Pill>This Week</Pill>
        <Pill>This Month</Pill>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Sales" value="₦1.24M" delta="+12.4%" tone="success" />
        <StatTile label="Transactions" value="312" delta="+8.1%" tone="success" />
        <StatTile label="Gross profit" value="₦478k" delta="38.6% margin" tone="primary" />
        <StatTile label="Low stock" value="14" delta="3 need reorder" tone="warning" />
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="text-xs font-semibold text-foreground">Sales trend</div>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {[42, 55, 38, 68, 50, 78, 62, 84, 59].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function MockPos() {
  const products = [
    { name: 'Coca-Cola 50cl', sku: 'COK-050', price: '₦350', stock: '128 in stock' },
    { name: 'Peak Milk 850g', sku: 'PMK-850', price: '₦2,400', stock: '42 in stock' },
    { name: 'Emzor Paracetamol', sku: 'EMZ-100', price: '₦1,200', stock: '76 in stock' },
    { name: 'Golden Penny Semovita', sku: 'GPS-2KG', price: '₦3,150', stock: 'Low stock' },
  ]
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
        No store shift is open. A manager must open the shift first.
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary px-3 py-2 text-xs text-muted-foreground">
        <ScanBarcode className="h-4 w-4" /> Scan barcode, SKU, batch… [F1]
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="primary">All Items</Pill>
        <Pill>Beverages</Pill>
        <Pill>Pharmacy</Pill>
        <Pill>Food</Pill>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid grid-cols-2 gap-2">
          {products.map((p) => (
            <div key={p.sku} className="rounded-xl border border-border/60 bg-surface p-3">
              <div className="text-xs font-semibold text-foreground">{p.name}</div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.sku}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{p.price}</span>
                <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                  Add
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">{p.stock}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Current sale</span>
            <Pill tone="success">Ready</Pill>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { q: 'x2', n: 'Coca-Cola 50cl', t: '₦700' },
              { q: 'x1', n: 'Peak Milk 850g', t: '₦2,400' },
            ].map((l) => (
              <div key={l.n} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {l.q} {l.n}
                </span>
                <span className="font-medium text-foreground">{l.t}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₦3,100</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>Total</span>
              <span>₦3,100</span>
            </div>
          </div>
          <div className="mt-3">
            <Btn tone="primary">Charge sale</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MockShift() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock4 className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Active shift</span>
        <Pill tone="success" className="ml-auto">
          Open
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Opening float" value="₦50,000" />
        <StatTile label="Expected cash" value="₦214,500" tone="primary" />
        <StatTile label="Sales" value="₦486,200" delta="148 txns" tone="success" />
        <StatTile label="Assigned reps" value="3" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn>View details</Btn>
        <Btn tone="destructive">Close shift</Btn>
      </div>
      <div className="space-y-3 rounded-xl border border-border/60 bg-surface p-3">
        {[
          ['Shifts enabled', 'Reps must operate inside a store shift before taking sales.', true],
          ['Require cash reconciliation', 'Mandatory cash count when closing a shift or sale.', true],
          ['Require an open sale to charge', 'Reps must open a sale before taking a payment.', false],
        ].map(([title, body, on]) => (
          <div key={title as string} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-foreground">{title as string}</div>
              <div className="text-[10px] text-muted-foreground">{body as string}</div>
            </div>
            <Toggle on={on as boolean} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockInventory() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Boxes className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Inventory · Headquarters</span>
        <Pill tone="success" className="ml-auto">
          Ledger in-sync
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Stock valuation" value="₦8.1M" delta="3,420 units" tone="primary" />
        <StatTile label="Health index" value="92%" delta="in / low / out" tone="success" />
        <StatTile label="Movement (24h)" value="+180 / −96" />
        <StatTile label="Shrinkage / risk" value="₦42k" delta="damaged + expired" tone="warning" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="primary">+ Stock Adjustment</Pill>
        <Pill>Transfer / Trace</Pill>
        <Pill>Expiry Vault</Pill>
        <Pill>Movement Log</Pill>
      </div>
      <div className="space-y-2">
        {[
          { n: 'Coca-Cola 50cl', s: 'In Stock', q: '128', tone: 'success' as const, pct: 76 },
          { n: 'Peak Milk 850g', s: 'Low Stock Alert', q: '9', tone: 'warning' as const, pct: 22 },
          { n: 'Emzor Paracetamol', s: 'Out of Stock', q: '0', tone: 'destructive' as const, pct: 4 },
        ].map((item) => (
          <div key={item.n} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-foreground">{item.n}</span>
                <Pill tone={item.tone}>{item.s}</Pill>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Bar value={item.pct} />
                <span className="font-mono text-[10px] text-muted-foreground">on hand {item.q}</span>
              </div>
            </div>
            <Btn>Adjust Qty</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockExpiry() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Expiry Risk Engine</span>
        <Pill tone="destructive" className="ml-auto">
          Automated triage
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Critical <7d" value="6 batches" delta="₦84k · 210 units" tone="destructive" />
        <StatTile label="Near <30d" value="14 batches" delta="₦192k" tone="warning" />
        <StatTile label="At risk <90d" value="31 batches" delta="₦410k" tone="info" />
        <StatTile label="Expired" value="3 batches" delta="₦36k" tone="muted" />
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] text-primary">
        FEFO rotation active: &lt;90d monitor → &lt;30d priority → &lt;7d urgent → expired quarantine &amp; write-off.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { n: 'Emzor Paracetamol 100s', lot: 'LOT-4471', d: 'Expires in 5 days', tone: 'destructive' as const },
          { n: 'Peak Milk 850g', lot: 'LOT-3310', d: 'Expires in 21 days', tone: 'warning' as const },
        ].map((b) => (
          <div key={b.lot} className="rounded-xl border border-border/60 bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{b.n}</span>
              <Pill tone={b.tone}>{b.d}</Pill>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">{b.lot}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockProducts() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Products Catalog</span>
        <Pill className="ml-auto">Branch: All branches</Pill>
        <Btn tone="primary">Add Product</Btn>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Active SKUs" value="286" />
        <StatTile label="Low stock" value="14" tone="warning" />
        <StatTile label="Valuation" value="₦8.1M" tone="primary" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { n: 'Coca-Cola 50cl', code: 'Beverages · Coca-Cola', price: '₦350', m: '32%' },
          { n: 'Peak Milk 850g', code: 'Food · Nestle', price: '₦2,400', m: '24%' },
          { n: 'Samsung 32" TV', code: 'Electronics · Samsung', price: '₦118,000', m: '18%' },
        ].map((p) => (
          <div key={p.n} className="rounded-xl border border-border/60 bg-surface p-3">
            <div className="text-xs font-semibold text-foreground">{p.n}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Tags className="h-3 w-3" /> {p.code}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{p.price}</span>
              <Pill tone="success">margin {p.m}</Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockPurchasing() {
  const steps = ['Approved', 'Dispatched', 'GRN Dock', 'Stocked']
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Procurement Engine</span>
        <Pill tone="info" className="ml-auto">
          ERP sync
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Open POs" value="7" />
        <StatTile label="Inbound logistics" value="3" tone="info" />
        <StatTile label="GRN & QC dock" value="11" tone="success" />
        <StatTile label="Payables (14d)" value="₦620k" tone="warning" />
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold',
                  i < 2 ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className="text-[10px] text-muted-foreground">{s}</span>
              {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-foreground">PO-2026-0042</div>
            <div className="text-[10px] text-muted-foreground">Grand Mills Ltd · ETA 14 Oct</div>
          </div>
          <div className="flex gap-2">
            <Btn tone="primary">Mark Received</Btn>
            <Btn>Track</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MockCustomer() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Customers</span>
        <Pill tone="primary" className="ml-auto">
          AR ₦3.4M
        </Pill>
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Chika Okafor Traders</span>
          <Pill tone="info">Wholesale B2B</Pill>
          <Pill tone="warning">Platinum B2B</Pill>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatTile label="Account" value="B2B-0184" />
          <StatTile label="Credit limit" value="₦1,000,000" />
          <StatTile label="Owes / available" value="₦640k" delta="₦360k available" tone="success" />
        </div>
        <div className="mt-3 flex gap-2">
          <Btn tone="primary">Payment</Btn>
          <Btn>Statement</Btn>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="text-xs font-semibold text-foreground">Statement</div>
        <div className="mt-2 space-y-1.5">
          {[
            { d: '01 Oct · Credit sale INV-2041', a: '₦120,000', tone: 'destructive' as const },
            { d: '04 Oct · Bank transfer repayment', a: '₦80,000', tone: 'success' as const },
            { d: '08 Oct · Opening balance', a: '₦0.00', tone: 'muted' as const },
          ].map((row) => (
            <div key={row.d} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{row.d}</span>
              <span
                className={cn(
                  'font-medium',
                  row.tone === 'success' && 'text-success',
                  row.tone === 'destructive' && 'text-foreground',
                  row.tone === 'muted' && 'text-muted-foreground',
                )}
              >
                {row.a}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MockFinance() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Finance · Approvals</span>
        <Pill tone="primary" className="ml-auto">
          2 pending
        </Pill>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="primary">All</Pill>
        <Pill>Pending</Pill>
        <Pill>Approved</Pill>
        <Pill>Rejected</Pill>
      </div>
      {[
        { kind: 'Credit Limit', ref: '#AP-1042', amt: '₦86,000', who: 'Sales · Festac Town', tone: 'warning' as const },
        { kind: 'Void / Refund', ref: '#AP-1041', amt: '₦12,500', who: 'Sales · Headquarters', tone: 'destructive' as const },
      ].map((a) => (
        <div key={a.ref} className="rounded-xl border border-border/60 bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={a.tone}>{a.kind}</Pill>
            <span className="font-mono text-[10px] text-muted-foreground">{a.ref}</span>
            <span className="ml-auto text-sm font-bold text-foreground">{a.amt}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{a.who}</div>
          <div className="mt-3 flex gap-2">
            <Btn tone="success">Authorize</Btn>
            <Btn tone="destructive">Decline</Btn>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MockExpenses() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ReceiptText className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Expenses</span>
        <Btn tone="primary" className="ml-auto">
          New expense
        </Btn>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="MTD OPEX" value="₦412k" delta="68% cleared" tone="primary" />
        <StatTile label="Pending sign-off" value="5" tone="warning" />
        <StatTile label="Cleared this month" value="₦280k" tone="success" />
        <StatTile label="Top cost center" value="Logistics" />
      </div>
      {[
        { n: 'Generator diesel', c: 'Logistics', a: '₦48,000', s: 'Pending', tone: 'warning' as const },
        { n: 'Staff refreshments', c: 'Admin', a: '₦15,500', s: 'Approved', tone: 'success' as const },
      ].map((e) => (
        <div key={e.n} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">{e.n}</div>
            <div className="text-[10px] text-muted-foreground">{e.c}</div>
          </div>
          <span className="text-sm font-bold text-foreground">{e.a}</span>
          <Pill tone={e.tone}>{e.s}</Pill>
        </div>
      ))}
    </div>
  )
}

export function MockReports() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Reports</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface p-3">
        {['From', 'To', 'Branch', 'Group by'].map((f) => (
          <span key={f} className="rounded-lg border border-border/60 bg-secondary px-3 py-1.5 text-[11px] text-muted-foreground">
            {f}
          </span>
        ))}
        <Btn tone="primary">Run report</Btn>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="flex items-center justify-between border-b border-border/60 bg-surface px-3 py-2">
          <span className="text-xs font-semibold text-foreground">Sales report · This month</span>
          <span className="flex gap-1.5">
            <Pill tone="destructive">PDF</Pill>
            <Pill tone="success">Excel</Pill>
            <Pill tone="info">CSV</Pill>
          </span>
        </div>
        {[
          ['2026-10-08', '₦182,400', '48'],
          ['2026-10-09', '₦221,750', '52'],
          ['2026-10-10', '₦198,120', '44'],
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 border-t border-border/40 px-3 py-2 text-[11px]">
            <span className="text-muted-foreground">{row[0]}</span>
            <span className="font-medium text-foreground">{row[1]}</span>
            <span className="text-muted-foreground">{row[2]} txns</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockSubscription() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Subscription · Growth</span>
        <Pill tone="success" className="ml-auto">
          Active
        </Pill>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Staff seats" value="15" />
        <StatTile label="Branches" value="3" />
        <StatTile label="Products" value="5,000" />
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] text-primary">
        Plan limits apply to the business as a whole and are shared across all branches.
      </div>
      <div className="rounded-xl border border-border/60 bg-surface p-3">
        <div className="text-xs font-semibold text-foreground">Modular features</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['POS', 'Inventory', 'Customers', 'Suppliers', 'Expenses', 'Shifts', 'Finance', 'Reports', 'Expiry'].map(
            (f) => (
              <Pill key={f} tone="primary">
                {f}
              </Pill>
            ),
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn tone="primary">Upgrade plan</Btn>
        <Btn>Available plans</Btn>
      </div>
    </div>
  )
}

export function MockStaff() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Staff</span>
        <Btn tone="primary" className="ml-auto">
          New staff
        </Btn>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Staff" value="27" />
        <StatTile label="Active" value="24" tone="success" />
        <StatTile label="Store managers" value="5" />
        <StatTile label="Sessions" value="11" tone="info" />
      </div>
      {[
        { n: 'Babatunde Adeyemi', r: 'Store Manager', b: 'Headquarters', tone: 'info' as const },
        { n: 'Chika Okafor', r: 'Sales Representative', b: 'Festac Town', tone: 'primary' as const },
        { n: 'Ngozi Eze', r: 'Inventory Officer', b: 'Headquarters', tone: 'warning' as const },
      ].map((s) => (
        <div key={s.n} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface p-3">
          <span className="text-xs font-semibold text-foreground">{s.n}</span>
          <Pill tone={s.tone}>{s.r}</Pill>
          <span className="text-[10px] text-muted-foreground">{s.b}</span>
          <Btn className="ml-auto">Permissions</Btn>
        </div>
      ))}
    </div>
  )
}

export function MockPlatform() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Businesses</span>
        <Pill tone="primary" className="ml-auto">
          <Sparkles className="h-3 w-3" /> Super Admin
        </Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Total" value="12" />
        <StatTile label="Active" value="9" tone="success" />
        <StatTile label="On trial" value="2" tone="info" />
        <StatTile label="Suspended" value="1" tone="destructive" />
      </div>
      {[
        { n: 'Demo Retail', p: 'Growth', s: 'Active', tone: 'success' as const },
        { n: 'GreenMart Stores', p: 'Starter', s: 'Trial', tone: 'info' as const },
      ].map((b) => (
        <div key={b.n} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface p-3">
          <span className="text-xs font-semibold text-foreground">{b.n}</span>
          <Pill tone="primary">
            <Gem className="h-3 w-3" /> {b.p}
          </Pill>
          <Pill tone={b.tone}>{b.s}</Pill>
          <Btn className="ml-auto">Assign plan</Btn>
        </div>
      ))}
    </div>
  )
}
