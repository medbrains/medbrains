---
module: procurement-indent
priority: P1
status: draft
---

# SOP: Procurement & Indent

## Overview
The Procurement module covers the supply chain from departmental demand to vendor payment: indent (internal purchase request), purchase order creation, vendor management, goods receipt note (GRN), quality check, stock movement to stores, and payment processing. Departments raise indents; procurement officers approve and convert to POs; store keepers receive goods and update stock. The module links to pharmacy (drug procurement), lab (reagents), and OT (surgical supplies/implants).

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `nurse` / department head | Raise indent for supplies | Any department can raise an indent |
| `procurement_officer` | Approve indent, create PO, manage vendors, process GRN | Central procurement role |
| `store_keeper` | Receive goods, verify against PO, enter GRN, update stock | Physical receipt role |
| `hospital_admin` | Approve high-value POs above threshold | Approval workflow |
| `billing_clerk` | Process vendor payment against GRN | Finance interface |

---

## Scenario 1: Department Raises Indent for Supplies — Actor: Nurse / Department Head

**Actor**: `nurse` (or any authorised department staff)  
**Entry point**: Procurement → Raise Indent  
**Preconditions**: User has indent-raising permission; item catalog exists in inventory master

**Steps**:
1. Staff opens New Indent form; selects department (auto-filled from their profile).
2. Searches for items by name or code; adds line items with required quantity and unit.
3. Specifies urgency: Routine / Urgent / Emergency.
4. Adds justification note (mandatory for non-routine items above threshold quantity).
5. Submits indent → status `pending_approval`; procurement officer notified.
6. Procurement officer reviews; approves, partially approves, or rejects with reason.
7. Approved items → status `approved`; converted to PO (automatically or manually).

**Exit / Outcome**: Indent created and approved; items queued for PO creation.  
**Regulatory note**: NABH MOM.6 — medication procurement follows formulary/DTC; NDPS items require separate register (dual-approval indent); FEFO must be applied at issue.  
**Existing test**: `apps/web/e2e/crud/indent.spec.ts` (partial); `— needs approval chain test`

---

## Scenario 2: Procurement Officer Creates and Sends Purchase Order — Actor: Procurement Officer

**Actor**: `procurement_officer`  
**Entry point**: Procurement → Purchase Orders → New PO (or from approved indent)  
**Preconditions**: Indent approved; vendor registered in vendor master; rate contract available (if applicable)

**Steps**:
1. Procurement officer opens approved indent(s); consolidates items into a PO.
2. Selects vendor from approved vendor list; system checks vendor status (active, blacklisted flag, certificate expiry).
3. Reviews unit prices against rate contract or last-purchase rate; edits if negotiated.
4. Generates PO (format: `PO-YYYY-NNNNNN`); previews line items, total amount, and delivery deadline.
5. If PO value > configured threshold: routes for hospital admin approval.
6. On approval: PO status → `approved`; sends to vendor via email / vendor portal.
7. PO status → `sent_to_vendor`.

**Exit / Outcome**: PO generated and sent to vendor; vendor reference recorded; delivery date confirmed.  
**Regulatory note**: GST Act — PO must include HSN/SAC codes and GSTIN; CDSCO — drug POs must specify INN name, pack size, batch; vendor must hold valid Drug Licence for pharmacy items.  
**Existing test**: JNY-EXTU-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers PO creation, approval, and send)

---

## Scenario 3: Store Keeper Receives Goods and Completes GRN — Actor: Store Keeper

**Actor**: `store_keeper`  
**Entry point**: Procurement → Pending GRNs (goods arrived against open PO)  
**Preconditions**: PO status `sent_to_vendor`; vendor delivered goods physically

**Steps**:
1. Store keeper opens the PO linked to the delivered goods.
2. Verifies delivery challan against PO line items (item, quantity, unit).
3. Inspects goods: checks packaging integrity, batch numbers, manufacturing and expiry dates.
4. Enters GRN (format: `GRN-YYYY-NNNNNN`):
   - For each item: quantity received, batch number, expiry date, unit rate (from invoice).
   - Marks any shortages, damaged items, or substitutions separately.
5. QC check for critical items (drugs, reagents, implants): either passes on-receipt inspection or routes to lab/pharmacy QC.
6. On QC pass: GRN status → `accepted`; stock levels updated in inventory (`pharmacy_stock` / `lab_reagent_stock` / `general_store_stock` as applicable).
7. Vendor invoice linked to GRN; payment process triggered.

**Exit / Outcome**: GRN created; stock incremented with FEFO-valid batch data; vendor invoice pending payment.  
**Regulatory note**: CDSCO — batch traceability for drugs from GRN to patient dispensing; NABL — reagent lot number in GRN; NABH MOM.6 — receiving inspection documented.  
**Existing test**: JNY-EXTU-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — covers GRN and payment record creation)

---

## Scenario 4: Billing Clerk Processes Vendor Payment — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: Procurement → Vendor Payments → Pending Invoices  
**Preconditions**: GRN is `accepted`; vendor invoice uploaded or entered

**Steps**:
1. Billing clerk opens pending vendor invoice linked to GRN.
2. Three-way match verified: PO quantity = GRN quantity = invoice quantity; unit rates match.
3. If mismatch: flags discrepancy; procurement officer resolves before payment.
4. Calculates TDS deduction (if applicable per income tax slab for vendor type).
5. Records payment: mode (NEFT/RTGS/cheque), reference number, payment date.
6. Invoice status → `paid`; vendor ledger updated.
7. GST input tax credit (ITC) entry made for accounting integration.

**Exit / Outcome**: Vendor paid; payment traceable to PO and GRN; ITC recorded.  
**Regulatory note**: GST Act — ITC claimed only on valid tax invoice with GSTIN; TDS under Income Tax Act §194C (contractors) / §194Q (purchases above ₹50 lakh); CDSCO — drug purchase records retained 3 years.  
**Existing test**: JNY-EXTU-001 in `apps/web/e2e/scenarios/actor-perspective-journeys.spec.ts` (automated — payment record creation assertion)
