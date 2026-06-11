---
module: financial-reporting
priority: P1
status: draft
---

# SOP: Financial Reporting & Revenue Cycle Management

## Overview
Financial reporting in MedBrains spans daily collection reconciliation, payer-wise revenue analysis, outstanding receivables ageing, pharmacy finance (drug margin, dead stock, expiry write-offs), and board-level P&L contribution by department. The Revenue tab in Analytics provides real-time views; deeper financial reports are generated from the Reports module. The Pharmacy Finance submodule tracks drug-level margins, consumption cost, and vendor payment reconciliation. All reports feed the hospital's monthly management accounts and statutory filings (GST, TDS, income tax).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `billing_clerk` | Daily collection reconciliation, invoice ageing, TPA outstanding | Operational finance |
| `hospital_admin` | Revenue by department, P&L contribution, board reports | Strategic finance |
| `audit_officer` | Read-only access to all financial reports | Non-editable audit access |
| `pharmacist` | Pharmacy finance: drug margin, dead stock, expiry | Pharmacy-scoped |
| `procurement_officer` | Purchase cost tracking, vendor payment ageing | Procurement finance |

---

## Scenario 1: Billing Clerk Reconciles Daily Collections — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: Reports → Daily Collection Reconciliation  
**Preconditions**: Day's transactions are entered; POS and UPI terminal settlement reports available

**Steps**:
1. Billing clerk opens Daily Collection Report for the current date.
2. Views system totals by payment mode:
   - Cash collected (system) vs physical cash in drawer — must match.
   - Card (POS): system total vs POS terminal settlement slip — must match.
   - UPI: system total vs payment gateway dashboard — must match.
   - Insurance payments received (TPA bank transfers).
3. Records any discrepancies with explanation (short/excess cash, failed transaction, pending settlement).
4. Submits reconciliation — status `reconciled` with clerk name and timestamp.
5. Cash counted and deposited; deposit slip scanned and attached to reconciliation record.
6. Finance head reviews reconciliation by end of day.
7. System flags if reconciliation not submitted by EOD cutoff time (configurable).

**Exit / Outcome**: Daily collection reconciled; variances documented; cash deposit confirmed.  
**Regulatory note**: Income Tax Act §269ST — cash receipts ≥ ₹2 lakh per person per day prohibited; GST — daily collection forms part of GSTR-1 return; internal audit — daily reconciliation is a key financial control.  
**Existing test**: `— needs test`

---

## Scenario 2: Hospital Admin Reviews Department-Wise Revenue — Actor: Hospital Admin

**Actor**: `hospital_admin`  
**Entry point**: Reports → Revenue by Department  
**Preconditions**: Billing transactions categorised by department for the period

**Steps**:
1. Admin opens Revenue by Department report; selects period (monthly / quarterly / YTD).
2. Views revenue contribution by department: OPD, IPD, Lab, Pharmacy, Radiology, OT, Blood Bank, Ambulance.
3. Views for each department:
   - Gross revenue (billed).
   - Collections (cash in).
   - Discounts given (% of gross).
   - TPA/insurance share vs self-pay.
   - Average revenue per patient encounter.
4. Compares to prior period; identifies departments with revenue decline (drilling to encounter volume vs revenue-per-encounter split).
5. Identifies high-discount departments; reviews discount approval trail.
6. Generates board-level financial summary: top 5 revenue departments, revenue trend chart, payer mix pie chart.

**Exit / Outcome**: Department-wise P&L contribution quantified; board report generated; anomalies flagged.  
**Regulatory note**: Companies Act (if corporate hospital) — monthly MIS for board; CGHS — department-wise reporting for empanelment renewal; GST — department-wise revenue needed for HSN/SAC code filing accuracy.  
**Existing test**: `— needs test`

---

## Scenario 3: Pharmacist Reviews Dead Stock and Expiry Write-Offs — Actor: Pharmacist

**Actor**: `pharmacist`  
**Entry point**: Pharmacy Finance → Dead Stock & Expiry  
**Preconditions**: Pharmacy stock records exist; items near or past expiry flagged by system

**Steps**:
1. Pharmacist opens Dead Stock report:
   - **Near-expiry**: items expiring within 90 days with stock > 0.
   - **Expired**: items past expiry date remaining in stock.
   - **Dead stock**: items with no consumption in last 90 days.
2. For near-expiry items: initiates return to supplier if within return window (supplier-specific policy); or plans promotional use (use-by date clearly communicated to dispensing staff).
3. For expired items: initiates write-off — requests approval from pharmacist-in-charge and procurement officer.
4. On approval: stock decremented; items physically segregated and destroyed per BMW Rules (pharmaceutical waste — yellow bag with black stripe).
5. Destruction certificate (with batch number, quantity, date, witnesses) uploaded to system.
6. Financial impact: write-off value reported to accounts for P&L entry.

**Exit / Outcome**: Near-expiry managed (return/accelerated use); expired stock written off with destruction certificate; financial impact recorded.  
**Regulatory note**: D&C Act — expired drugs must not be dispensed; destruction must be witnessed and documented; CDSCO — batch traceability to destruction; BMW 2016 — pharmaceutical waste as Schedule II waste.  
**Existing test**: `apps/web/e2e/crud/pharmacy-finance.spec.ts` (partial); `— needs write-off workflow test`

---

## Scenario 4: Admin Reviews Outstanding TPA Receivables — Actor: Hospital Admin / Billing Clerk

**Actor**: `hospital_admin` or `billing_clerk`  
**Entry point**: Reports → Receivables Ageing → TPA/Insurance  
**Preconditions**: Insurance claims submitted but not yet settled

**Steps**:
1. Opens Receivables Ageing report; filters to TPA/insurance claims.
2. Views claims bucketed by age: 0–30 days / 31–60 days / 61–90 days / 90+ days.
3. For each TPA: sees total outstanding amount and number of claims.
4. Drills into 90+ day bucket for a specific TPA: sees individual claims with:
   - Claim submission date.
   - Last follow-up date.
   - Current status (under review / additional documents requested / dispute / escalated).
5. Assigns follow-up tasks to insurance officer for aged claims.
6. For claims in dispute: escalates to TPA grievance redressal mechanism (IRDAI Ombudsman if needed).
7. Provisions bad debt for claims > 180 days.
8. Generates TPA performance scorecard: average settlement TAT by TPA.

**Exit / Outcome**: Aged receivables actioned; follow-up tasks assigned; bad debt provisioned; TPA performance scorecard updated.  
**Regulatory note**: IRDAI — TPA settlement within 30 days of complete documentation; IRDAI Ombudsman — escalation path for disputes; accounting standard — provisioning for doubtful debts per IndAS / AS 4.  
**Existing test**: `— needs test`
