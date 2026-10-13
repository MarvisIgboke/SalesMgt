import { Snapshot, Flow } from './mocks'
import {
  MockExpiry,
  MockInventory,
  MockPos,
  MockProducts,
  MockPurchasing,
  MockShift,
} from './screens'
import {
  BulletList,
  Callout,
  CheckList,
  DataTable,
  DocSection,
  StepChips,
  Steps,
} from './parts'

export function PosSection() {
  return (
    <DocSection
      id="pos"
      eyebrow="Point of sale"
      title="The register"
      lead="The POS is built for busy counters: a barcode-first scan field, keyboard shortcuts, a live cart and multi-method payment. Reps can hold a sale, resume it, apply a discount or split payment across methods."
    >
      <Snapshot
        path="/pos"
        active="POS"
        legend={[
          'The warning banner blocks selling until a manager has opened the store shift.',
          'The scan field accepts a barcode, SKU or batch and can be driven entirely by keyboard.',
          'Category chips filter the product grid; tapping or scanning adds to the cart.',
          'The cart totals live and the charge button opens the payment panel.',
        ]}
      >
        <MockPos />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Taking a sale</h3>
      <Steps
        items={[
          {
            title: 'Open your sale',
            body: 'At the start of your till session, open a sale. If no store shift is open, the POS asks a manager to open the shift first — use Go to shifts.',
          },
          {
            title: 'Add items',
            body: 'Scan a barcode or search by name, SKU or batch. Adjust quantity in the cart, or apply a line discount where permitted.',
          },
          {
            title: 'Assign a customer (optional)',
            body: 'Attach a customer for loyalty or to sell on credit. A cash sale can proceed with no customer attached.',
          },
          {
            title: 'Charge',
            body: 'Choose the payment method and confirm. Split payment lets you combine methods if the customer pays part cash and part transfer.',
          },
          {
            title: 'Receipt & change',
            body: 'For cash the register works out change. A printable or on-screen receipt closes the sale and updates stock instantly.',
          },
        ]}
      />

      <Callout tone="tip" title="Keyboard-first">
        The register is designed to be driven without a mouse: jump to the scan field, search, quantity,
        discount and charge controls using the on-screen shortcut hints.
      </Callout>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Payment methods</h3>
      <StepChips steps={['Cash', 'Transfer', 'Card', 'Split', 'Credit (with customer)']} />
      <CheckList
        items={[
          'Holds: park a basket and resume it later without losing the cart.',
          'Discounts: line or basket-level, subject to your permission level.',
          'Refunds & voids: raised as requests that flow to the approval queue.',
          'Offline sales: keep selling when the network drops; the cart syncs on reconnect.',
        ]}
      />
    </DocSection>
  )
}

export function ShiftsSection() {
  return (
    <DocSection
      id="shifts"
      eyebrow="Shifts & reconciliation"
      title="A controlled trading window"
      lead="A shift is a branch trading window opened by a manager with an opening float and closed with a cash reconciliation. Sales are grouped under the shift that was open when they happened, giving you clean daily numbers."
    >
      <Flow
        steps={[
          { title: 'Open a shift', body: 'A manager opens the branch shift and records the opening float.' },
          { title: 'Assign cashiers', body: 'Only assigned reps can sell against the shift.' },
          { title: 'Trade', body: 'Reps open sales and take payments; totals roll up to the shift.' },
          { title: 'Close & reconcile', body: 'Count cash, explain variances, then close the shift.' },
        ]}
      />

      <Snapshot
        path="/shifts"
        active="Settings"
        legend={[
          'The open shift shows opening float, expected cash, sales and assigned reps at a glance.',
          'Only a Store Manager can open or close a shift for the branch.',
          'Closing prompts a cash reconciliation where counted cash is compared to expected.',
          'The settings panel controls whether shifts and sale sessions are mandatory.',
        ]}
      >
        <MockShift />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Shift vs. sale</h3>
      <BulletList
        items={[
          <>
            <strong className="font-semibold text-foreground">Shift</strong> — the branch-level trading
            window. One per branch at a time, owned by the manager.
          </>,
          <>
            <strong className="font-semibold text-foreground">Sale (session)</strong> — a rep's own till
            session inside the shift. Multiple reps can sell under the same shift.
          </>,
          <>
            <strong className="font-semibold text-foreground">Reconciliation</strong> — at close, counted
            cash is compared to expected cash; any variance must be recorded.
          </>,
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Relevant settings</h3>
      <DataTable
        columns={['Setting', 'What it does', 'Default']}
        rows={[
          ['Shifts enabled', 'Require an open shift before any selling can happen at a branch.', 'On'],
          ['Require cash reconciliation', 'Force a cash count when a shift or sale is closed.', 'On'],
          ['Require an open sale to charge', 'Reps must open their own sale before taking a payment.', 'Off'],
        ]}
      />
      <Callout tone="warning" title="Branch representatives">
        Only staff assigned to a branch can sell there. If a rep cannot see the shift, confirm they are
        in the branch's assigned staff list.
      </Callout>
    </DocSection>
  )
}

export function InventorySection() {
  return (
    <DocSection
      id="inventory"
      eyebrow="Inventory"
      title="Live stock you can trust"
      lead="Inventory shows real-time levels for every product across branches, with adjustments, transfers and a full movement history so a count always has a paper trail."
    >
      <Snapshot
        path="/inventory"
        active="Inventory"
        legend={[
          'Headline tiles summarise stock value, health, recent movement and shrinkage risk.',
          'Quick actions open adjustments, transfers, the expiry vault and the movement log.',
          'Each product row shows its on-hand quantity and a health pill (in, low, out).',
          'Adjust Qty records a reason and reference so every change is auditable.',
        ]}
      >
        <MockInventory />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Common tasks</h3>
      <Steps
        items={[
          {
            title: 'Adjust a quantity',
            body: 'Use Stock Adjustment to correct on-hand stock after a count or breakage. A reason and reference are required.',
          },
          {
            title: 'Transfer between branches',
            body: 'Move stock from one branch to another; the source decreases and the destination increases when received.',
          },
          {
            title: 'Trace a product',
            body: 'Open Stock Trace on any product to follow its movement from intake through to sale.',
          },
          {
            title: 'Review the movement log',
            body: 'Every receipt, sale, transfer, adjustment and write-off is timestamped with the user who made it.',
          },
        ]}
      />

      <Callout tone="info" title="Reordering">
        Products carry a reorder level. When on-hand drops to or below it, the item is flagged as low
        stock on the dashboard and in the expiry/low-stock notices so you can replenish.
      </Callout>
    </DocSection>
  )
}

export function ExpirySection() {
  return (
    <DocSection
      id="expiry"
      eyebrow="Expiry management"
      title="Sell first, waste less"
      lead="For pharmacies, food and any perishable stock, the expiry manager groups batches into risk buckets so you can rotate stock and cut write-offs."
    >
      <Snapshot
        path="/inventory/expiry"
        active="Inventory"
        legend={[
          'Batches are grouped by risk: critical, near, at-risk and expired.',
          'The FEFO banner explains the rotation policy the app expects you to follow.',
          'Each batch shows a reference lot number and time-to-expiry pill.',
          'Expired batches can be quarantined and written off with a recorded reason.',
        ]}
      >
        <MockExpiry />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Risk buckets</h3>
      <DataTable
        columns={['Bucket', 'Window', 'Action']}
        rows={[
          ['At risk', 'Under 90 days', 'Monitor and prioritise in promotions.'],
          ['Near expiry', 'Under 30 days', 'Move to the front of the shelf (FEFO).'],
          ['Critical', 'Under 7 days', 'Discount, bundle or return to supplier.'],
          ['Expired', 'Past date', 'Quarantine and write off with a reason.'],
        ]}
      />
      <Callout tone="warning" title="FEFO">
        First-Expired-First-Out: always sell the batch with the earliest expiry first. The POS surfaces
        the oldest batch automatically when stock is scanned.
      </Callout>
    </DocSection>
  )
}

export function ProductsSection() {
  return (
    <DocSection
      id="products"
      eyebrow="Products & catalogue"
      title="A rich, organised catalogue"
      lead="Products hold everything the register and reporting need: pricing, cost, barcodes, units, and optional expiry. Categories and brands keep even a large catalogue tidy."
    >
      <Snapshot
        path="/products"
        active="Inventory"
        legend={[
          'The catalogue lists every product with a per-branch or all-branch view.',
          'Add Product opens the product form; bulk import is available for large catalogues.',
          'Categories and brands are managed from the catalogue module.',
          'Each card shows price, category and gross margin at a glance.',
        ]}
      >
        <MockProducts />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Product fields</h3>
      <DataTable
        columns={['Field', 'Purpose', 'Required']}
        rows={[
          ['Name & SKU', 'Human name and unique stock code used everywhere.', 'Yes'],
          ['Barcode', 'Scanned at the POS; can be assigned automatically.', 'No'],
          ['Unit', 'Selling unit such as piece, pack or carton.', 'Yes'],
          ['Category & brand', 'Organise and filter the catalogue.', 'No'],
          ['Cost price', 'Used for margin and valuation.', 'Yes'],
          ['Selling price', 'The price charged at the register.', 'Yes'],
          ['Tax', 'Tax rate applied to the product where configured.', 'No'],
          ['Reorder level', 'Threshold that raises a low-stock flag.', 'No'],
          ['Expiry tracking', 'Record batch expiry for perishable items.', 'No'],
        ]}
      />

      <h3 className="text-lg font-bold tracking-tight text-foreground">Variants</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        A product can have variants (for example size or colour) when you sell the same item in
        different forms. Each variant can carry its own price, barcode and stock, while rolling up to the
        parent product for reporting.
      </p>

      <Callout tone="tip" title="Bulk import">
        For large catalogues, prepare a spreadsheet and import products in one pass rather than typing
        them one by one.
      </Callout>
    </DocSection>
  )
}

export function PurchasingSection() {
  return (
    <DocSection
      id="purchasing"
      eyebrow="Purchasing & suppliers"
      title="From requisition to goods received"
      lead="Purchasing follows a clear pipeline so that ordering, receiving and paying suppliers stay in step, and stock only increases when goods are actually received."
    >
      <Flow
        steps={[
          { title: 'Requisition', body: 'A branch requests stock; the request is reviewed.' },
          { title: 'Purchase order', body: 'An approved requisition becomes a PO sent to a supplier.' },
          { title: 'Goods received', body: 'On delivery, a GRN is raised and stock increases.' },
          { title: 'Invoice & payment', body: 'Match the supplier invoice and record payment.' },
        ]}
      />

      <Snapshot
        path="/purchasing"
        active="Inventory"
        legend={[
          'Tiles summarise open POs, inbound logistics, the goods-received dock and payables.',
          'Each order shows its stage in the pipeline from approved to stocked.',
          'Mark Received books the delivery into stock; Track follows the order.',
          'Supplier returns reverse stock when goods are sent back.',
        ]}
      >
        <MockPurchasing />
      </Snapshot>

      <h3 className="text-lg font-bold tracking-tight text-foreground">Suppliers</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        The supplier directory stores contact details and full purchase and payment history on every
        account, so you can see what you owe and what you have paid.
      </p>
      <CheckList
        items={[
          'Create orders against approved suppliers only.',
          'Receive full or partial deliveries; stock updates as goods arrive.',
          'Record supplier returns for damaged or wrong items.',
          'Track payables so outstanding balances are always visible.',
        ]}
      />
      <Callout tone="info" title="Stock only on receipt">
        Placing a purchase order does not change stock. Quantities rise only when a goods-received note
        is completed, keeping on-hand numbers honest.
      </Callout>
    </DocSection>
  )
}
