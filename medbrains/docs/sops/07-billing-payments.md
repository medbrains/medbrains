---
module: billing-payments
priority: P0
status: draft
---

# SOP: Billing & Payments

## Overview
The Billing module handles revenue cycle management for OPD, IPD, Emergency, and day-care encounters. It covers: consultation fee collection, itemised service billing (lab, pharmacy, procedures, room charges), advance management, corporate/CGHS/ECHS credit billing, TPA (Third-Party Administrator) claim processing, GST calculation, payment receipts, refunds, and collection reporting. All billing events are linked to clinical encounters for audit and medico-legal purposes.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `billing_clerk` | Generate invoice, collect payment, apply advances, process TPA | Primary billing actor |
| `insurance_officer` | Pre-auth submission, TPA claims, settlement reconciliation | Works in tandem with billing_clerk |
| `patient` (portal/kiosk) | Online payment, view invoices, download receipts | Read-only after payment |
| `receptionist` | Collect OPD consultation fee at front desk | Limited to OPD billing only |
| `hospital_admin` | Discount override, write-offs, billing reports | Requires approval workflow |

---

## Scenario 1: Billing Clerk Generates OPD Invoice and Collects Payment — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: OPD encounter is `completed`; billing clerk opens Billing → OPD Billing queue  
**Preconditions**: OPD encounter closed by doctor; service items (consultation, lab, pharmacy) are captured in the encounter

**Steps**:
1. Billing clerk finds encounter in OPD billing queue (sorted by completion time).
2. Opens billing view; sees itemised services: consultation fee, lab charges, pharmacy, radiology (if ordered).
3. Applies applicable tax: GST on pharmacy (5% / 12% per drug category), exempt on doctor consultation per GST notification.
4. Applies corporate rate card or CGHS rate if patient registration type warrants it.
5. Discounts: clerk enters any approved discount (requires supervisor approval above threshold configured in settings).
6. Generates invoice (format: `INV-OPD-YYYYNNNNNN`); previews itemised breakdown.
7. Selects payment mode: Cash / Card (POS terminal) / UPI / Online.
8. Records payment → receipt generated; invoice status → `paid`.
9. Prints or emails receipt to patient.

**Exit / Outcome**: Invoice generated and paid; receipt issued; encounter billing lifecycle closed.  
**Regulatory note**: GST Act 2017 — healthcare exempt except pharmacy, diagnostics; invoice must carry HSN/SAC code; CGHS rates apply if enrolled; Consumer Protection Act 2019 — itemised bill must be provided on request.  
**Existing test**: `apps/web/e2e/crud/billing.spec.ts` (partial); `apps/web/e2e/scenarios/billing-invoice.spec.ts` (automated)

---

## Scenario 2: Insurance Officer Submits TPA Pre-Auth for IPD — Actor: Insurance Officer

**Actor**: `insurance_officer`  
**Entry point**: Patient admitted under insurance/TPA scheme; Insurance Officer opens Insurance → Pre-Auth Requests  
**Preconditions**: IPD admission record exists; patient TPA / insurance details captured at registration; TPA panel configured for tenant

**Steps**:
1. Insurance Officer opens new pre-auth request linked to IPD admission.
2. Fills pre-auth form: diagnosis (ICD-10), proposed procedures, estimated cost, room type, estimated LOS.
3. Attaches supporting documents: admission summary, lab reports (generated within system).
4. Selects TPA from configured panel list; pre-auth form auto-formats to TPA's required template.
5. Submits pre-auth; status → `submitted_to_tpa`.
6. TPA responds (via email/portal manually or via NHCX API if integrated) — officer records decision: Approved / Partially Approved / Denied.
7. On approval: records sanctioned amount; IPD billing limit set.
8. Denied cases: officer notifies doctor and patient; alternative billing mode selected.

**Exit / Outcome**: Pre-auth request created, submitted, and outcome recorded; approved amount visible on IPD billing screen.  
**Regulatory note**: IRDAI regulations — TPA pre-auth TAT; NHCX (NHA) standards for claim interchange; NABH — insurance process documented.  
**Existing test**: `— needs test`

---

## Scenario 3: Patient Pays Online via Payment Gateway — Actor: Patient (portal)

**Actor**: `patient` (authenticated portal session)  
**Entry point**: Patient receives SMS/email with invoice link OR logs into portal → My Bills  
**Preconditions**: Invoice status `pending_payment`; online payment gateway configured for tenant

**Steps**:
1. Patient opens invoice link or navigates to My Bills in portal.
2. Sees pending invoice with itemised breakdown.
3. Clicks "Pay Online" → redirected to payment gateway (Razorpay / PayU / HDFC as configured).
4. Completes payment via UPI / card / net banking.
5. Gateway sends webhook to MedBrains backend (`POST /payments/webhook`).
6. Backend verifies signature, updates invoice status → `paid`, records payment reference.
7. Patient receives SMS + email receipt.
8. If payment fails: invoice remains `pending_payment`; patient can retry.

**Exit / Outcome**: Invoice paid; payment reference recorded; receipt delivered to patient via SMS and email.  
**Regulatory note**: IT Act 2000 — payment gateway must use TLS 1.2+; PCI-DSS — card data never stored on MedBrains servers (gateway tokenisation); GST invoice serial number must be sequential (GST Act §31).  
**Existing test**: `— needs test` (payment gateway webhook tested in isolation; end-to-end portal flow needs test)

---

## Scenario 4: Billing Clerk Processes Corporate / CGHS Credit Billing — Actor: Billing Clerk

**Actor**: `billing_clerk`  
**Entry point**: Patient discharged under CGHS / ECHS / corporate scheme; billing clerk opens Billing → IPD Final Bill  
**Preconditions**: Patient registration type is `corporate` or `government`; company/scheme configured in billing master

**Steps**:
1. Billing clerk opens final IPD bill; sees all charges linked to admission.
2. Selects billing scheme: CGHS / ECHS / Corporate XYZ.
3. System applies package rates (if applicable) or CGHS NABH rate card automatically.
4. Non-covered items (cosmetic, certain consumables) flagged; transferred to patient responsibility.
5. Generates credit bill (format: `CRDT-YYYY-NNNNNN`) for corporate/government portion.
6. Patient responsibility amount billed separately and collected.
7. Credit bill submitted to company/government for reimbursement (print / ECHS portal upload).
8. Reimbursement received later: billing clerk records receipt and marks credit bill `settled`.

**Exit / Outcome**: Credit bill generated for company/government; patient responsibility collected; reimbursement tracking open.  
**Regulatory note**: CGHS rates circular (latest) must be applied; ECHS empanelment conditions; GST exemption on government scheme claims; audit trail mandatory (CAG compliance for government-funded patients).  
**Existing test**: `— needs test`
