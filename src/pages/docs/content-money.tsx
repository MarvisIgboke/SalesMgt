import { Snapshot, Flow } from './mocks'
import { MockCustomer, MockExpenses, MockFinance, MockReports } from './screens'
import {
  BulletList,
  Callout,
  CheckList,
  DataTable,
  DocSection,
  StepChips,
  Steps,
} from './parts'

export function CustomersSection() {
  return (
    <DocSection
      id="customers"
      eyebrow="Customers & credit"
      title="Every account, down to the kobo"
      lead="Customers hold a profile, a segment, an optional credit limit and a running ledger. Credit sales, repayments and statements all reconcile against the same account."
    >
      <Snapshot
        path="/customers"
        active="Customers"
        legend={[
          'The customer card shows segment, tier, account number and credit limit.',
          'Owes and available credit update live with every credit sale and repayment.',
          'Payment opens the repayment form; Statement shows the full ledger.',
          'Ledger rows separate debits (credit sales) from credits (repayments).',
        ]}
      >
        <MockCustomer />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Selling on credit</h3>
      <Steps
        items={[
          { title: 'Create the customer', body: 'Add a name and phone, then set a segment such as Retail or Wholesale B2B.' },
          { title: 'Set a credit limit', body: 'A limit caps how much the customer can owe. Zero means cash only.' },
          { title: 'Sell on credit', body: 'At the POS, attach the customer and choose Credit. The sale checks available credit first.' },
          { title: 'Record repayments', body: 'Record payments against the account; available credit is restored immediately.' },
          { title: 'Share a statement', body: 'Generate a statement showing every charge and payment for a period.' },
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Segments & tiers</h3>
      <DataTable
        columns={['Field', 'Examples', 'Used for']}
        rows={[
          ['Segment', 'Retail, Wholesale B2B, Corporate', 'Grouping and reporting.'],
          ['Tier', 'Standard, Silver, Gold, Platinum B2B', 'Loyalty and pricing tiers.'],
          ['Credit limit', '₦0 – custom', 'Caps how much can be owed at once.'],
        ]}
      />

      <Callout tone="warning" title="Credit limit checks">
        A credit sale that would exceed the customer's limit is blocked at the POS. Raise the limit (with
        the right permission) before selling further on credit.
      </Callout>

      <CheckList
        items={[
          'Search customers by name, phone or account number.',
          'Attach a customer to any sale for history and loyalty.',
          'Record part-payments; the ledger keeps the running balance.',
          'Export a customer list or statement for finance and reconciliation.',
        ]}
      />
    </DocSection>
  )
}

export function FinanceSection() {
  return (
    <DocSection
      id="finance"
      eyebrow="Finance"
      title="The control room"
      lead="Finance brings approvals, cash reconciliation, receivables and payables into one audited workspace, so money moving through the business is always accounted for."
    >
      <Snapshot
        path="/finance"
        active="Finance"
        legend={[
          'Approvals queue lists requests that need authorising, such as credit limits or voids.',
          'Each row shows the type, reference, amount and the branch it came from.',
          'Authorize or Decline records the decision with your name and a timestamp.',
          'Reconciliation and receivables/payables views sit alongside approvals.',
        ]}
      >
        <MockFinance />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">What lives here</h3>
      <BulletList
        items={[
          <>
            <strong className="font-semibold text-foreground">Approvals</strong> — requests raised at the
            counter or in stock (credit limits, voids, refunds, adjustments) that a manager or admin must
            approve or decline.
          </>,
          <>
            <strong className="font-semibold text-foreground">Reconciliation</strong> — compare expected
            takings with counted cash and card or transfer settlements.
          </>,
          <>
            <strong className="font-semibold text-foreground">Receivables</strong> — money owed to you,
            chiefly customer credit balances.
          </>,
          <>
            <strong className="font-semibold text-foreground">Payables</strong> — money you owe, chiefly
            supplier invoices and recorded expenses.
          </>,
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Approving a request</h3>
      <Steps
        items={[
          { title: 'Review the queue', body: 'Open Finance and review the pending approvals list.' },
          { title: 'Inspect the request', body: 'Check the type, amount, branch and reason before deciding.' },
          { title: 'Authorize or decline', body: 'Your decision is logged and the requester is notified.' },
        ]}
      />

      <Callout tone="info" title="Audited by design">
        Every approval, void and adjustment is written to the audit trail. Nothing sensitive changes
        silently, which keeps the books defensible.
      </Callout>
    </DocSection>
  )
}

export function ExpensesSection() {
  return (
    <DocSection
      id="expenses"
      eyebrow="Expenses"
      title="Keep operating costs visible"
      lead="Record operating expenses with categories and receipts, route the larger ones for approval, and see how much of the month's spend is cleared versus pending."
    >
      <Snapshot
        path="/expenses"
        active="Finance"
        legend={[
          'Tiles summarise month-to-date spend, what is awaiting sign-off and what has cleared.',
          'New expense captures the amount, category, branch and an optional receipt.',
          'Each expense shows its status: pending, approved or rejected.',
          'Approved expenses feed into the financial report as operating costs.',
        ]}
      >
        <MockExpenses />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Recording an expense</h3>
      <Steps
        items={[
          { title: 'Open New expense', body: 'Enter the amount, date and a short description of the cost.' },
          { title: 'Choose a category', body: 'Categories such as rent, utilities, transport and supplies keep reporting clean.' },
          { title: 'Attach a receipt', body: 'Upload the receipt or invoice so the record is complete.' },
          { title: 'Submit for approval', body: 'Expenses above the threshold you configured go to a manager for sign-off.' },
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Common categories</h3>
      <StepChips steps={['Rent', 'Utilities', 'Transport', 'Supplies', 'Salaries', 'Maintenance', 'Other']} />

      <Callout tone="info" title="Where it appears">
        Approved operating expenses appear in the financial report, reducing profit, so keep categories
        consistent for meaningful month-on-month comparisons.
      </Callout>
    </DocSection>
  )
}

export function ReportsSection() {
  return (
    <DocSection
      id="reports"
      eyebrow="Reports & exports"
      title="Turn activity into insight"
      lead="Reports cover sales, stock, operations and full financial performance. Every report can be filtered and exported so the numbers can travel beyond the app."
    >
      <Snapshot
        path="/reports"
        active="Reports"
        legend={[
          'Set a date range, branch and grouping, then run the report.',
          'Results render as a table you can read on screen or export.',
          'Export to PDF, Excel or CSV depending on how the data will be used.',
          'The financial report adds profit-and-loss and margin analysis.',
        ]}
      >
        <MockReports />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Report families</h3>
      <DataTable
        columns={['Report', 'Answers the question', 'Export']}
        rows={[
          ['Sales', 'How much did we sell, by day, branch or product?', 'PDF · Excel · CSV'],
          ['Stock', 'What do we hold and what is it worth?', 'Excel · CSV'],
          ['Operations', 'Shifts, sessions and activity across branches.', 'Excel · CSV'],
          ['Financial (P&L)', 'Revenue, cost of goods, expenses and profit.', 'PDF · Excel'],
          ['Expiry', 'Which batches are at risk or expired?', 'CSV'],
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Exporting</h3>
      <Flow
        steps={[
          { title: 'Filter', body: 'Choose the period, branch and grouping.' },
          { title: 'Run', body: 'Generate the report and review it on screen.' },
          { title: 'Export', body: 'Pick a format; the file downloads to your device.' },
          { title: 'Share', body: 'Send the file to accountants, owners or auditors.' },
        ]}
      />

      <Callout tone="tip" title="Exports are download-safe">
        Export buttons produce a file download. If a download is blocked, check that your browser is not
        suppressing automatic downloads for this site.
      </Callout>
    </DocSection>
  )
}
