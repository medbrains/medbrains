# Sprint Plan — Pharmacy Finance Activities

**Status:** Draft
**Date:** 2026-04-29
**Depends on:** Pharmacy Phase 2 (shipped), Razorpay outbox (shipped), Doctor Activities sub-A (signed_records — shipped), Order Basket (shipped)
**Companion:** SPRINT-pharmacy-improvements.md (clinical/operational), SPRINT-doctor-activities.md

## Context

Pharmacy financial surface today (existing routes):

**Payments** (`pharmacy_payments.rs` — 8 handlers):
- list_payments, create_payment, reconcile_payment, auto_reconcile_upi
- day_reconciliation, get_settlement, close_settlement, verify_settlement

**Finance** (`pharmacy_finance.rs` — 13 handlers):
- credit_notes (list/create/get/approve/settle/cancel)
- store_indents (list/create/approve/issue/receive)
- list_patient_orders_for_return, lookup_pos_sale

That covers receipts and credit notes well. The **gaps** are around the day-end financial close, drug margin analysis, supplier payment reconciliation, insurance receivables aging, and shift-level cashier accountability — the things a pharmacy manager actually opens at 09:00 and 21:00 every day.

## 15 finance activities driving the design

### Day-open / day-close

#### 1. Cash drawer open with float
Pharmacist opens shift → enters opening cash float (e.g., ₹2,000 in change). System records `cash_drawer_open` event with timestamp + counter ID + cashier user. Without this, cash variance computation is meaningless.

#### 2. End-of-shift cash count + variance
At shift end, cashier counts physical cash, enters total. System computes:
- Expected = opening_float + cash_payments_received - cash_refunds_paid - cash_petty_expenses
- Variance = actual - expected
- Variance > ₹100 (configurable) requires shift-supervisor sign-off (signed via Ed25519, record_type=`cash_drawer_close`)
- Generates printable shift summary

#### 3. Day reconciliation sheet (printable)
End-of-day report per pharmacy counter:
- Total sales (gross + GST + net)
- Mode breakdown: cash, UPI, card, insurance claim, package consumption, credit note redemption
- Payment gateway expected settlement (T+1) vs received
- Variance per mode
- Top-10 drugs by quantity + revenue
- Returns + refunds count + value
- NDPS dispensed count + balance check
- Free drugs (samples/charity) count

### Petty cash + expense

#### 4. Petty cash voucher
Pharmacy buys plastic bags / printer paper / minor expenses. Cashier creates a `petty_cash_voucher` with category (supplies/stationery/refreshment/transport/repairs/other), amount, paid_to, supporting_bill_url. Supervisor approves. Decrements opening float OR draws from petty fund. Audit log + printable voucher.

#### 5. Cash float top-up
When float runs low, pharmacist requests top-up from cashier head office. Tracked as `cash_float_movement` (transfer between drawers).

### Drug-level profitability

#### 6. Drug margin report
Per drug: avg cost (from latest GRN), MRP, sale price, gross margin %, qty sold this period, total revenue, total cost, total margin. Sorted by total margin descending. Identifies loss-leaders (negative margin) + heroes.

#### 7. Slow-moving + dead stock financial impact
Drugs with no sale in 90 days × current stock value × expiry-risk factor = capital tied up in dead stock. Suggested action: discount sale, return to supplier, charity donation.

#### 8. Free drug / charity dispensing audit
Track free-of-charge dispensing (`pharmacy_free_dispensing` table). Categories: charity scheme, hospital sample, government program (PMJAY, AB-Y), staff drug. Monthly summary + cost write-off entry into journal.

### Insurance + corporate receivables

#### 9. Insurance receivables aging
Per insurance company / TPA: pending claims by age bucket (0-30 / 31-60 / 61-90 / >90 days), total receivable, expected receivable (after discount), oldest pending claim. Drives weekly follow-up calls.

#### 10. Corporate credit aging (employer-paid)
Corporate accounts where employees buy on credit, employer settles monthly. Aging report + auto-reminder via outbox `email.corporate_invoice_due`.

#### 11. TPA claim reconciliation
When TPA settles a claim, payment received may be less than claimed (TPA deductions). Auto-create credit note for the difference; trigger appeal workflow if deduction > threshold.

### Supplier + GST

#### 12. Supplier payment scheduler
Suppliers have payment terms (30/45/60 days from GRN). Scheduler shows POs due this week with: supplier, amount, TDS to deduct, net payable, TDS section (194Q/194C/etc). One-click cut payment + queue UPI/NEFT via outbox.

#### 13. GST input vs output reconciliation
Monthly: total GST input (from GRN purchases) vs GST output (from sales). If output > input → pay difference. If input > output → carry-forward credit. Drives GSTR-3B preparation.

### Shift-level controls

#### 14. Cashier override audit
Track every "manual price override", "discount applied beyond policy", "void after settle", "Schedule X dispense without serial — overridden", with reason. Daily report shows override frequency per cashier.

#### 15. Cashier productivity dashboard
Per cashier per shift: transactions, average ticket, total revenue, void %, override %, return %, customer wait time average. Identifies underperformers + training needs.

## Schema additions (migration `136_pharmacy_finance.sql`)

```sql
-- Cash drawer lifecycle
CREATE TABLE pharmacy_cash_drawers (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_location_id UUID NOT NULL,
  cashier_user_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_float NUMERIC(12,2) NOT NULL CHECK (opening_float >= 0),
  closed_at TIMESTAMPTZ,
  expected_close_amount NUMERIC(12,2),
  actual_close_amount NUMERIC(12,2),
  variance NUMERIC(12,2) GENERATED ALWAYS AS
    (actual_close_amount - expected_close_amount) STORED,
  variance_reason TEXT,
  variance_signed_record_id UUID,                  -- supervisor sig if variance > threshold
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'variance_pending_signoff', 'reopened')),
  notes TEXT
);
CREATE INDEX cash_drawers_open_idx
  ON pharmacy_cash_drawers (tenant_id, pharmacy_location_id)
  WHERE status = 'open';

-- Petty cash + cash float movements
CREATE TABLE pharmacy_petty_cash_vouchers (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cash_drawer_id UUID REFERENCES pharmacy_cash_drawers(id),
  category TEXT NOT NULL CHECK (category IN
    ('supplies','stationery','refreshment','transport','repairs','medical_consumable','other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_to TEXT NOT NULL,
  supporting_bill_url TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','reimbursed')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pharmacy_cash_float_movements (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN
    ('topup_from_main','return_to_main','transfer_between_counters','correction')),
  source_drawer_id UUID REFERENCES pharmacy_cash_drawers(id),
  destination_drawer_id UUID REFERENCES pharmacy_cash_drawers(id),
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  moved_by UUID NOT NULL REFERENCES users(id),
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Free / charity dispensing audit
CREATE TABLE pharmacy_free_dispensings (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_order_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN
    ('charity','hospital_sample','government_program','staff','approved_writeoff')),
  scheme_code TEXT,                                 -- PMJAY / ABY / state-specific
  approving_user_id UUID NOT NULL REFERENCES users(id),
  cost_value NUMERIC(12,2) NOT NULL,                -- writeoff value
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cashier override audit
CREATE TABLE pharmacy_cashier_overrides (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashier_user_id UUID NOT NULL REFERENCES users(id),
  cash_drawer_id UUID REFERENCES pharmacy_cash_drawers(id),
  pharmacy_order_id UUID,
  override_type TEXT NOT NULL CHECK (override_type IN
    ('manual_price','discount_beyond_policy','void_after_settle','schedule_x_paper_missing',
     'allergy_block_override','interaction_block_override','stock_below_threshold')),
  original_value JSONB,
  override_value JSONB,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cashier_overrides_user_idx
  ON pharmacy_cashier_overrides (tenant_id, cashier_user_id, created_at DESC);

-- Supplier payment schedule
CREATE TABLE pharmacy_supplier_payments (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL,
  purchase_order_id UUID,
  grn_id UUID,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  tds_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds_section TEXT,                                 -- 194Q, 194C, etc.
  net_payable NUMERIC(12,2) GENERATED ALWAYS AS (gross_amount - tds_amount) STORED,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','approved','paid','disputed','cancelled')),
  payment_mode TEXT,                                -- upi/neft/cheque
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12,2),
  utr_number TEXT,                                  -- UTR / cheque number
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX supplier_payments_due_idx
  ON pharmacy_supplier_payments (tenant_id, due_date)
  WHERE status IN ('scheduled', 'approved');

-- Drug margin snapshot (daily materialized for fast reports)
CREATE TABLE pharmacy_drug_margin_daily (
  id UUID PK DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  avg_cost NUMERIC(12,4) NOT NULL,
  mrp NUMERIC(12,4) NOT NULL,
  sale_price NUMERIC(12,4) NOT NULL,
  margin_pct NUMERIC(5,2) NOT NULL,
  qty_sold INT NOT NULL DEFAULT 0,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, drug_id, snapshot_date)
);
CREATE INDEX drug_margin_daily_idx
  ON pharmacy_drug_margin_daily (tenant_id, snapshot_date DESC, margin_total DESC);

-- All tenant-scoped + RLS + FORCE ROW LEVEL SECURITY
-- Trigger update_updated_at on tables with updated_at column
```

## Backend routes (~22 new handlers)

### `/api/pharmacy/cash-drawers/*`
- `POST /open` — open shift with float
- `POST /{id}/close` — count + variance + sign if needed
- `GET /me/active` — currently-open drawer for current user
- `GET /` — list with filters (date range, location, cashier)
- `GET /{id}/reconciliation-sheet` — printable end-of-shift report

### `/api/pharmacy/petty-cash/*`
- CRUD + approve + reimburse

### `/api/pharmacy/free-dispensings`
- CRUD + monthly summary report by category

### `/api/pharmacy/cashier-overrides`
- Auto-created from POS/dispense flows (no direct create endpoint needed)
- `GET /` with filters (cashier, type, date range) for audit dashboard

### `/api/pharmacy/supplier-payments/*`
- CRUD + due-this-week + bulk-approve + record-payment

### `/api/pharmacy/reports/*`
- `GET /day-close/{location_id}/{date}` — full day reconciliation sheet
- `GET /margin/{date_range}` — drug margin report
- `GET /receivables-aging` — insurance + corporate aging
- `GET /supplier-payments/due` — payment schedule for the week
- `GET /gst-reconciliation/{month}` — input vs output GST monthly
- `GET /cashier-productivity/{date_range}` — per-cashier metrics

### `/api/pharmacy/jobs/*` (cron-driven)
- nightly drug margin snapshot
- weekly receivables aging email (via outbox)
- daily payment-due alert (via outbox)

## Frontend changes (12-tab pharmacy page → add 3 sub-tabs to Analytics or new Finance tab)

### New "Finance" top-level tab
- **Cash drawer panel** — open shift / current shift / close shift workflow
- **Day reconciliation** — printable end-of-day report (uses PDF signature block component)
- **Receivables aging** — table + drill-down per insurance company
- **Supplier payments** — due-this-week + bulk pay action
- **Margin report** — drug margin chart + table
- **Cashier overrides audit** — table + filters

### POS tab additions
- Banner showing current cash drawer status (open / variance from expected)
- Voucher button (opens petty cash modal)
- Free dispensing toggle on POS — sets pharmacy_free_dispensings + zero-bill

## Permissions

```rust
pub mod pharmacy {
    // existing...
    pub mod cash_drawer {
        pub const OPEN: &str = "pharmacy.cash_drawer.open";
        pub const CLOSE: &str = "pharmacy.cash_drawer.close";
        pub const VIEW: &str = "pharmacy.cash_drawer.view";
        pub const SIGN_VARIANCE: &str = "pharmacy.cash_drawer.sign_variance";
    }
    pub mod petty_cash {
        pub const CREATE: &str = "pharmacy.petty_cash.create";
        pub const APPROVE: &str = "pharmacy.petty_cash.approve";
    }
    pub mod free_dispensing {
        pub const CREATE: &str = "pharmacy.free_dispensing.create";
        pub const APPROVE: &str = "pharmacy.free_dispensing.approve";
    }
    pub mod supplier_payments {
        pub const VIEW: &str = "pharmacy.supplier_payments.view";
        pub const MANAGE: &str = "pharmacy.supplier_payments.manage";
    }
    pub mod finance_reports {
        pub const VIEW: &str = "pharmacy.finance_reports.view";
    }
}
```

## Outbox events

- `email.daily_close_report` — sent to manager nightly
- `email.weekly_receivables_aging` — sent to finance team weekly
- `sms.payment_due_alert` — to procurement when supplier payment due in 3 days
- `sms.variance_alert` — to supervisor when shift variance > threshold

## Tests (8 integration scenarios)

1. open + close drawer with zero variance → balanced
2. close with variance → requires supervisor sign → variance_pending_signoff → after sign → closed
3. petty cash create → approve → decrements drawer expected_close
4. cash float top-up between drawers → both drawer balances reflect
5. free dispensing creates audit row + zero-value pharmacy_order
6. supplier payment scheduler — list due-this-week filters correctly
7. cashier override auto-created on price-override flow → appears in audit list
8. drug margin snapshot job runs → populates pharmacy_drug_margin_daily for yesterday

## Acceptance criteria

1. Cashier opens shift → POS forces drawer-open before first sale
2. Cashier closes shift → enter actual cash → variance computed → if >₹100, supervisor must sign electronically
3. Day reconciliation sheet printable PDF with embedded supervisor signature
4. Petty cash voucher decrements expected close + supports printable voucher
5. Free dispensing logged as zero-amount pharmacy_order + audit row
6. Margin report shows top 10 + bottom 10 drugs by margin_total
7. Receivables aging shows accurate buckets matching invoice + claim states
8. Supplier payments due-this-week list matches POs aged past payment terms
9. CI green: cargo clippy, pnpm typecheck, pnpm build, signatures_test passes

## Effort estimate

| Phase | Hours |
|-------|-------|
| Migration 136 + RLS + indexes | 6 |
| Cash drawer backend (open, close, variance, list) | 12 |
| Petty cash + cash float movement | 8 |
| Free dispensing + cashier override schema + writes | 8 |
| Supplier payments backend + scheduler logic | 12 |
| Drug margin snapshot cron + report endpoint | 10 |
| Receivables aging + GST reconciliation reports | 12 |
| Day-close printable report + signature embed | 10 |
| Frontend: Finance tab with 6 sub-views | 28 |
| Frontend: POS drawer banner + voucher modal | 8 |
| Permissions + i18n + nav entries | 4 |
| Tests (8 scenarios) | 16 |
| **Total** | **~134h ≈ 3.3 dev-weeks** |

Recommend split into 2 PRs:

- **PR-1 (`feature/pharmacy-finance-shift`)** — cash drawers + petty cash + free dispensing + cashier overrides + day-close report (~62h)
- **PR-2 (`feature/pharmacy-finance-receivables`)** — supplier payments + receivables aging + GST recon + margin report (~64h)

## Out of scope

- Tally / SAP ERP export of these journals — use existing `billing.erp.export` once data lands in standard journal_entries
- Bank statement upload for auto-reconciling supplier payments — that's billing.bank_recon
- Hardware cash counter integration (DRAWER signal protocol) — Phase 2
- Real-time CCTV link with each transaction — Phase 3

## Critical files to touch

### New
- `migrations/136_pharmacy_finance.sql`
- `routes/pharmacy_cash_drawer.rs`
- `routes/pharmacy_petty_cash.rs`
- `routes/pharmacy_free_dispensing.rs`
- `routes/pharmacy_supplier_payments.rs`
- `routes/pharmacy_finance_reports.rs`
- `routes/pharmacy_cashier_audit.rs`
- `services/pharmacy_margin_snapshot.rs` (cron job)
- `apps/web/src/pages/pharmacy/finance.tsx` (new sub-page or top-level Finance tab)
- `apps/web/src/components/Pharmacy/CashDrawerPanel.tsx`
- `apps/web/src/components/Pharmacy/DayCloseReport.tsx`
- `apps/web/src/components/Pharmacy/PettyCashModal.tsx`
- `apps/web/src/components/Pharmacy/SupplierPaymentSchedule.tsx`
- `apps/web/src/components/Pharmacy/MarginReport.tsx`
- `apps/web/src/components/Pharmacy/ReceivablesAging.tsx`
- `apps/web/src/components/Pharmacy/CashierOverrideAudit.tsx`

### Modified
- `routes/pharmacy.rs` — emit cashier_overrides on price/discount/Schedule X overrides
- `routes/pharmacy_payments.rs` — link payments to active cash drawer + reconciliation flow
- `routes/billing.rs` — extend journal_entries on close, free dispensing, write-off
- `apps/web/src/pages/pharmacy.tsx` — add Finance tab, POS drawer banner

### Reused
- `signed_documents::*` — supervisor signs variance + day-close PDF
- `outbox_events` — daily-close email, weekly receivables, supplier payment due alerts
- existing `pharmacy_payments.rs::day_reconciliation` — extend to include cash variance
- `journal_entries` from billing — petty cash + free dispensing entries flow through GL
- `signing` module — Ed25519 sigs on day-close + variance approvals

## Compliance posture

- **Income Tax Act §40A(3)**: cash payments to suppliers above ₹10,000 disallowed — supplier_payments validates
- **GST**: monthly GST reconciliation report drives GSTR-3B preparation
- **NABH FMS**: every cash transaction has audit trail (cashier user + drawer + override)
- **ICAI Cash Audit Standards**: variance threshold + sign-off + monthly review

## Verification

1. Apply migration 136
2. Login cashier → open drawer ₹2000 → take 5 sales total ₹4500 cash → close drawer with ₹6500 actual → variance 0 → balanced
3. Same flow with ₹6300 actual → variance -₹200 → supervisor sign required → after sign → drawer closed
4. Create petty cash voucher ₹100 → approve → expected close drops ₹100
5. Free dispense 1 paracetamol → audit row + zero-value pharmacy_order
6. Cron runs → drug_margin_daily populated for 100 drugs
7. Open Finance tab → see all 6 sub-views render with mock data
