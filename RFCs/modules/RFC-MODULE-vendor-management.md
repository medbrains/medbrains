# RFC-MODULE — Vendor, supplier and contractor management

Status: **Draft, for owner review.** Planning only; no code in this PR.
Companion: `RFC-MODULE-revenue-integrity.md` (branch `docs/rfc-revenue-integrity`). Its §3.8
vendor leakage rows (VN1–VN11), CC4 (consignment), PH13 (rebates) and AS1 (linen) are the
leakage register this module feeds; they are referenced by ID here, not restated. Its §12 report
centre rules govern the analytics page in §8.

## 0. How to read this

- Each external claim carries a link and a strength: *Official* (statute, regulator, the
  issuing body), *Professional* (CA/law-firm commentary), *Vendor* (a product's own page),
  *News*. Where we could not find a source we say so rather than fill the gap.
- Statute details (thresholds, rates) change every Finance Act. The module stores them as
  **configuration with an effective date**, never as constants, so a change is a settings row.

## 1. Problem

### 1.1 What goes wrong, with figures

| Pain | Figure / rule | Source | Strength |
|---|---|---|---|
| Duplicate or wrong payments | Median 1.5% of payment count | [APQC](https://www.apqc.org/resources/benchmarking/open-standards-benchmarking/measures/percentage-total-annual-number) (cited in revenue RFC §1.4) | Association |
| Billing-scheme fraud | 22% of occupational fraud cases, median loss $100,000 | [ACFE 2024](https://www.ivey.uwo.ca/media/kjljj5cy/2024-report-to-the-nations.pdf) (revenue RFC §1.4) | Association |
| Contract value leakage | About 9% of contract value lost on average | [WorldCC 2025](https://info.worldcc.com/contract-management-aug-2025) (revenue RFC §1.4) | Association |
| Bank-account change fraud | A pharma company lost about ₹50 lakh after a forged "bank details changed" request; found only when the real payee (a lab) said it had asked for no change | [Medical Dialogues](https://medicaldialogues.in/news/industry/pharma/ahmedabad-based-troikaa-pharma-falls-victim-to-rs-50-lakh-cyber-fraud-146335); a second case diverted ₹2.16 crore [Medical Dialogues](https://medicaldialogues.in/amp/news/industry/pharma/cybercriminals-trick-dr-reddys-finance-team-divert-rs-216-crore-payment-158412) | News |
| Bank guidance on that fraud | Verify any bank-change request on a phone number already on record, never one in the email | [FAB India](https://www.bankfab.bank.in/en-in/about-fab/security-and-certifications/detecting-fraud) | Bank |
| Late MSME payment: tax | Payment to a registered micro/small supplier beyond 15 days (no written agreement) or 45 days (agreement) is deductible only in the year actually paid (s.43B(h), from AY 2024-25) | [TaxGuru analysis](https://taxguru.in/income-tax/complete-analysis-section-43b-h-income-tax-act-w-r-t-msme-payment.html), [Tally](https://tallysolutions.com/accounting/section-43b-h-msme-payment-rules-compliance/) | Professional |
| Late MSME payment: interest | MSMED Act s.15 caps credit at 45 days from acceptance; s.16 charges compound interest at three times the RBI bank rate, monthly rests, notwithstanding any agreement | [DC-MSME legal framework](https://www.dcmsme.gov.in/publications/LegalFramework.pdf), [SCC Online](https://www.scconline.com/blog/post/2022/12/14/when-is-the-interest-rate-payable-under-section-16-of-the-msmed-act-2006-applicable/) | Official / Professional |

We found **no Indian study** measuring duplicate vendors, expired-licence suppliers, unrecovered
SLA penalties or AMC paid during downtime in hospitals. The module's first value is to measure
them per hospital (§8), not to quote a national figure.

### 1.2 Compliance each vendor type carries

| Vendor type | Owner dept | Must hold / we must check | Source |
|---|---|---|---|
| All taxable vendors | Finance | GSTIN (format + status), PAN; GSTR-2B match for input credit (revenue VN7) | [GSTN public search via GSP, e.g. Vayana docs](https://docs.gsp.vayana.com/GSTN/searchTaxpayer-get-api/) — Vendor |
| Contractors (works, housekeeping, security, laundry, diet, civil/electrical) | Finance | TDS s.194C (1% individual/HUF, 2% others; per-payment and aggregate thresholds) | [Zoho TDS thresholds](https://www.zoho.com/in/books/academy/taxes-and-compliance/tds-threshold-india.html) — Professional |
| Professionals (visiting consultants paid as vendors, IT services) | Finance | TDS s.194J (10% professional, 2% technical; threshold disputed ₹30k vs ₹50k — config) | [TaxBuddy](https://www.taxbuddy.com/blog/tds-194c-vs-194j-what-s-the-difference), [RegisterKaro](https://www.registerkaro.in/post/tds-rate-chart) — Professional, conflicting |
| Goods suppliers (drugs, consumables) | Finance | TDS s.194Q, 0.1% above ₹50 lakh a year, buyer turnover above ₹10 crore | [Zoho](https://www.zoho.com/in/books/academy/taxes-and-compliance/tds-threshold-india.html) — Professional |
| Micro/small suppliers | Finance | Udyam certificate; 15/45-day clock; registration is prospective (bills before the Udyam date are outside) | [Tally](https://tallysolutions.com/gst/msme-payment-rule-changes) — Professional |
| Drug suppliers | Pharmacy, purchase | Wholesale drug licence Form 20B / 21B (state licensing authority, 5-year validity, premises-bound) | [Meghalaya Form 20B](https://www.meghealth.gov.in/forms/Form_20B_Wholesale_Licence.pdf), [Form 21B](https://meghealth.gov.in/forms/Form_21B_Wholesale_Licence.pdf) — Official |
| Medical-device suppliers / OEMs / implant consignors | Biomedical, purchase | MD-42 (sale/distribution, state), MD-15 (import, CDSCO), MD-5/MD-9 (manufacture) | [CDSCO MDR-2017 pathway](https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/medical-device/RegulatoryMDR-2017.pdf), [CDSCO MD-14/15 checklist](https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/medical-device/14MD.pdf) — Official |
| Biomedical waste operator (CBWTF) | Facilities, infection control | BMW Rules 2016 authorisation from the SPCB; the hospital may hand waste only to an operator with a valid authorisation | [CPCB BMW rules page](https://cpcb.nic.in/rules-3/), [OSPCB](https://ospcboard.odisha.gov.in/divisions/bio-medical-cell) — Official |
| Outsourced lab | Lab, quality | NABL accreditation (scope + expiry); outsourced imaging chosen on its QA system | NABH 6th ed. standard PDF [portal.nabh.co](https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf) — Official; NABL certificate source not fetched |
| Outsourced imaging | Radiology | AERB licence for the X-ray/CT units | Not sourced in this pass (open item §13) |
| Any outsourced service | Quality, management | NABH 6th ed. ROM: documented agreements for outsourced services and monitoring of their quality | [ROM chapter notes](https://sites.google.com/view/bcmchtraining/accreditation/nabh-6th-edition/07-rom-chapter) — Training page; confirm against the standard |
| Vendors handling patient data (outsourced lab, IT, transcription, BPO billing, courier of reports) | DPO, IT | DPDP Act s.8(2): a processor only under a valid contract; s.8(1) fiduciary stays liable; s.8(7)(b) processor erases on end | [DPDPA s.8 text](https://www.dpdpa.com/dpdpa2023/chapter-2/section8.html), [KS&K](https://ksandk.com/data-protection-and-data-privacy/data-processor-duties-under-indias-dpdp-act-2023/) — Official text / Law firm. Commencement date of s.8 conflicts across sources (open §13) |
| Food / diet | Diet kitchen | FSSAI licence (field already exists on `vendors`) | Not re-sourced |

### 1.3 Online verification that exists

| Check | Route | Cost / access | Source |
|---|---|---|---|
| GSTIN status, legal name, state | GSTN public "Search Taxpayer" API, only through a GST Suvidha Provider (GSP) | GSP contract | [Vayana GSP docs](https://docs.gsp.vayana.com/GSTN/searchTaxpayer-get-api/), [Chartered Info](https://gsthelp.charteredinfo.com/ucl/search_taxpayer.htm) — Vendor |
| PAN valid + name | Protean (ex-NSDL) online PAN verification, authorised by the Income Tax Department, for registered entities; bulk file up to 1,000 | Annual registration, reported ₹14,160 | [Protean overview](https://tinpan.proteantech.in/services/online-pan-verification/pan-verification-overview.html) — Official |
| Bank account + name | Penny drop (₹1 over IMPS, beneficiary name returned) or penny-less name enquiry; only via payment providers | Per call | [Cashfree BAV](https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/bank-account-verification-sync-v2.md), [Razorpay reverse penny drop](https://razorpay.com/docs/x/fund-accounts/reverse-penny-drop/) — Vendor. No NPCI primary source found |
| Udyam, drug licence, MD-42, BMW authorisation, NABL | No official API found | Upload + manual check + expiry | — |

All three paid checks sit behind a **provider trait**, like payments (project rule: never code a
channel against one provider). A hospital with no provider configured still works: the check is
recorded as "manual, by <user>" with the evidence file.

### 1.4 Competitors (vendor pages only)

| Product | What their own page claims | Note |
|---|---|---|
| MocDoc | Purchase management, supplier comparison, GRN, batch and expiry ([MocDoc blog](https://mocdoc.com/blog/mocdoc-vs-karexpert-hospital-management-software-comparison)) | No vendor compliance, contract or MSME feature claimed |
| KareXpert | "Supply chain management" (same page, written by MocDoc) | Own page not fetched |
| Insta HMS | Modular HMS ([Capterra listing](https://www.capterra.com/p/161290/MocDoc-HMS/reviews/4926282/) not theirs) | No vendor-management claim found |
| SAP Ariba / Coupa | Supplier lifecycle, onboarding, risk, performance (pages returned 403; via [SAPinsider](https://sapinsider.org/articles/sap-ariba-vs-coupa-choosing-the-right-procurement-solution/), [Kodiak Hub](https://www.kodiakhub.com/blog/ariba-vs-coupa)) | Global benchmark; no Indian statutory layer (MSME, Form 20B, BMW, NABH) |

**Gap:** no Indian HMS page we found ties vendor compliance (licences, MSME clock, BMW,
NABL, DPDP) to the purchase, AMC and outsourced-service records the HMS already holds.

## 2. What exists in our code (audit, 2026-11-08, origin/main 24f714d5f)

| Area | Tables | Code | Screen | Gap |
|---|---|---|---|---|
| Vendor master | `vendors` (code, name, `vendor_type` free text, `vendor_status` incl. `blacklisted`, GSTIN, PAN **twice** (`pan_number`, `pan`), drug licence, FSSAI **twice**, bank name/account/IFSC, credit days, rating, categories **twice** (`categories` jsonb, `supply_categories` text[]), `is_pharmacy_vendor`) | `medbrains-materials/src/procurement.rs` (`list/get/create/update_vendor`) | `apps/web/src/pages/procurement/vendor-panel.tsx` | No type config, no documents/expiry, no Udyam, no maker-checker, **bank fields edited by a plain update with no second approver**, no dedup, no format checks, duplicated columns |
| Purchase | `purchase_orders`, `purchase_order_items`, `rate_contracts`, `rate_contract_items` | `procurement.rs` | `purchase-order-panel.tsx`, `rate-contract-panel.tsx` | Rate-contract leakage (PO price above contract) not reported |
| Receipt | `goods_receipt_notes`, `goods_receipts`, `grn_items`, `grn_scan_corrections`, `supplier_item_aliases` (mig 1139) | `medbrains-materials/src/grn.rs` (duplicate invoice, VN1 built) | `grn-*.tsx` | Three-way match partial (VN2) |
| Payment | `supplier_payments`, `pharmacy_supplier_payments` (two ledgers), `tds_deductions`, `tds_certificates` | `procurement.rs` (`vendor_ledger`, `create_supplier_payment`), `medbrains-pharmacy-finance` | `supplier-payments-panel.tsx` | Two payment tables; no MSME due date; TDS section not driven by vendor type (VN8) |
| Performance | — | `vendor_performance`, `vendor_comparison` (VN10 built) | `vendor-performance-panel.tsx` | Delivery-only score; no quality, complaints, SLA |
| AMC/CMC | `bme_contracts` (type, vendor, dates, value, SLA response/resolution hours, renewal alert days), `bme_breakdowns`, `bme_work_orders`, `bme_vendor_evaluations`, `nabh_equipment_downtime_log` | `crates/medbrains-bme` | `apps/web/src/pages/bme/` | SLA hours stored, **breach and penalty never computed** (VN5); uptime vs payment not joined |
| Consignment | `batch_stock.is_consignment`, `implant_registry` | `medbrains-indent/src/lib.rs` (`list_consignment_stock`, consignment usage) | indent pages | CC4: patient optional, no vendor usage report or reconciliation |
| Outsourced lab | `lab_outsourced_orders` | `medbrains-lab` | lab pages | VN3: no vendor invoice match; no NABL check on the partner |
| Outsourced services | `laundry_batches`, `nabh_bmw_disposal_log`, housekeeping/security/diet modules | `medbrains-materials/src/housekeeping.rs` etc. | `housekeeping/`, `security/`, `diet-kitchen/` | Not linked to a vendor contract; VN4 contract staff, AS1 linen |
| Vendor apps | OAuth client-credentials, manifest permissions | `crates/medbrains-connected-apps` (#5182), `medbrains-oauth` | connected-apps admin | Platform for vendor self-service and proof of service (VN11); not used for vendor portal yet |
| Approvals | maker-checker engine | `medbrains-approvals*` (`approvals-core/src/controls.rs`) | approvals inbox | Reuse for intake and bank change — do not build a second one |

"Vendor control panel" in the memory notes is MedBrains-the-company's control panel for its own
customers (platform commercial), not hospital supplier management; out of scope.

**Conclusion:** the data model is ~60% there and scattered. The work is one master with typed
configuration, documents and controls on top of what exists, plus the joins that turn existing
rows into a 360° view. Not a new procurement module.

## 3. Who uses it

| Role | Does |
|---|---|
| Purchase officer | Raises intake, sees rates and contracts, chooses vendor on PO |
| Stores / pharmacy in-charge | Sees licence status at GRN; consignment usage |
| Biomedical engineer | AMC/CMC contracts, uptime, SLA breach, vendor evaluation |
| Facilities / housekeeping / security / diet heads | Outsourced-service contracts, attendance vs invoice, BMW authorisation |
| Lab / radiology heads | Outsourced partner NABL/AERB, test volume vs vendor bill |
| Finance / accounts | Approves intake, bank change (second approver), TDS section, MSME clock, payments |
| Quality (NABH) / DPO | Outsourced-service monitoring, DPDP processor contracts |
| Management / audit officer | Overall values, leakage, concentration |
| Vendor (via vendor app, later) | Uploads renewed documents, sees own POs and payment status |

## 4. One vendor master, configurable types

- `vendors` stays the single table; `vendor_type` text becomes a FK to **`vendor_types`**
  (tenant-configurable, seeded: drug supplier, consumable supplier, implant consignor, equipment
  OEM / AMC, outsourced lab, outsourced imaging, laundry, housekeeping, security, diet,
  BMW operator, civil/electrical contractor, IT/software, ambulance, visiting consultant, other).
  A vendor may hold several types (a distributor that is also an AMC provider) via
  `vendor_type_links`.
- Each type defines: **required fields**, **required documents** (with "expires: yes/no",
  "blocks: PO | GRN | payment | none"), **default TDS section**, **owning department**,
  **is data processor** (DPDP), and **MSME applicable**.
- Duplicated columns are merged in the same migration (`pan`→`pan_number`, `fssai_number`→
  `fssai_license`, `categories`→`supply_categories`), with a backfill.
- `vendor_documents`: vendor, document type, number, issued by, valid from/to, file (existing
  document store), verified by / at / method (`api:<provider>` or `manual`).
- `vendor_bank_accounts`: separate table with `status` (pending, verified, active, retired);
  only an *active* row can be paid; history is never overwritten.
- Seed data has a maker: the configuration screens in §7 ship with it.

## 5. Easy intake

Short form, one screen, five fields to start; the rest is asked only if the chosen type requires it.

```
┌ New vendor ─────────────────────────────────────────────────────────┐
│ Type        [ Drug supplier            ▾ ]  (search picker, multi)  │
│ GSTIN       [ 29ABCDE1234F1Z5 ] ✓ format  [Verify]  → legal name,  │
│                                                state, status filled │
│ PAN         [ ABCDE1234F ] (auto from GSTIN chars 3–12) ✓          │
│ Name        [ prefilled from GST, editable ]                        │
│ Contact     [ name ] [ phone ] [ email ]                            │
│ ── Required for Drug supplier ──────────────────────────────────── │
│ Form 20B    [ number ] valid to [ date ] [Upload]                   │
│ Form 21B    [ number ] valid to [ date ] [Upload]                   │
│ Udyam       ( ) Not MSME  (•) Micro  ( ) Small  [ UDYAM-… ] [Upload]│
│ Bank        [ IFSC ▾ bank+branch ] [ account ] [Verify account]     │
│ Departments [ Pharmacy ✕ ] [ + ]                                    │
│                              [ Save draft ]  [ Submit for approval ]│
└─────────────────────────────────────────────────────────────────────┘
```

- Pickers, not text: type, department, state, IFSC (bank and branch shown), payment terms.
- Format checks client and server side: GSTIN (15 chars, state code, PAN inside, check digit),
  PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), IFSC (`[A-Z]{4}0[A-Z0-9]{6}`), Udyam (`UDYAM-XX-00-0000000`).
- **Dedup before save**: same GSTIN, same PAN, same bank account, or a fuzzy name match in the
  same state shows the existing vendor and blocks a second one unless an approver overrides with
  a reason.
- Verification via provider trait (§1.3); without a provider, "Verify" is a manual tick with evidence.
- **Maker-checker** through `medbrains-approvals`: the maker cannot approve their own intake;
  approval rules per type (e.g. finance + pharmacy head for drug suppliers). Until approved the
  vendor is `pending` and cannot be put on a PO.

## 6. Bank-account change control

1. Change is a new `vendor_bank_accounts` row (`pending`), never an edit.
2. Requires: the vendor's request letter on letterhead or a vendor-app request, a cancelled
   cheque, and a **call-back to the phone number on record before the change** (logged: who
   called, when, number) — per bank guidance above.
3. Penny drop (if a provider is configured): name returned must match the legal name (fuzzy
   score shown; below threshold needs a written reason).
4. **Two people**: requester ≠ approver, approver holds `vendor.bank.approve`; both on the audit chain.
5. **Cooling period** (config, default 24 h) and a notification to the vendor's old email/phone
   saying "your bank account on file was changed".
6. Payments in flight to the old account are held for review.

## 7. Configuration screens (Admin → Vendors → Settings)

| Screen | Holds |
|---|---|
| Vendor types | Name, owner dept, TDS section, MSME applicable, data processor, required fields |
| Document requirements | Per type: document, expiry, renewal alert days, what it blocks |
| Categories | Supply categories (existing `supply_categories`), linked to item masters |
| Approval rules | Per type and per action (intake, bank change, blacklist, reactivate): approver roles, count |
| Statutory parameters | Effective-dated: TDS rates/thresholds, MSME days (15/45), RBI bank rate for s.16 interest, cooling period |
| Verification providers | GSP, PAN, bank provider credentials (secret references under the tenant namespace per #5264) |

## 8. Per-vendor 360° view

All numbers are reads of existing tables (POs, GRNs, `supplier_payments` +
`pharmacy_supplier_payments`, `bme_contracts`, `bme_breakdowns`, `lab_outsourced_orders`,
`batch_stock`) plus the new documents. One query per panel, batched, one round trip for the page.

```
┌ Sri Example Pharma Distributors  · DRUG SUPPLIER · MICRO (MSME) · Active ┐
│ GSTIN 29ABCDE1234F1Z5 ✓  PAN ✓  Bank ✓ verified 12-Oct  Rating 4.1      │
│ ⚠ Form 21B expires in 18 days        ⚠ 3 invoices past MSME day 45      │
├─ Money (this FY) ───────────────────────────────────────────────────────┤
│ PO value ₹42.1L │ Received ₹39.8L │ Invoiced ₹39.6L │ Paid ₹31.0L       │
│ Outstanding ₹8.6L (of which MSME overdue ₹2.4L, interest accrued ₹6,120)│
├─ Contracts & rates ─────────────┬─ Performance ──────────────────────────┤
│ RC-2026-14 to 31-Mar  412 items │ On-time delivery 92%  Short supply 3%  │
│ PO above contract rate: 7 lines │ Rejected at GRN 1.2%  Complaints 2     │
│   ₹18,400 over (VN2)            │ NSQ batches 0                          │
├─ AMC / SLA (if OEM) ────────────┼─ Consignment (if implant) ────────────┤
│ 4 contracts · uptime 97.2%      │ On hand 38 · used 12 · billed 11 (CC4) │
│ SLA breaches 3 · penalty due    │ Not reported to vendor 2               │
│   ₹22,000 · deducted ₹0 (VN5)   │                                        │
├─ Documents ─────────────────────┴────────────────────────────────────────┤
│ 20B ✓ 2029 · 21B ⚠ 26-Nov · Udyam ✓ · GST ✓ · DPDP contract n/a        │
├─ Leakage rows (from revenue-integrity register) ─────────────────────────┤
│ VN2 ₹18,400 · VN5 ₹22,000 · CC4 1 implant ₹64,000      [Open in queue]  │
└──────────────────────────────────────────────────────────────────────────┘
Tabs: Overview · POs · GRNs · Invoices & payments · Contracts · SLA · Documents · Audit
```

A panel whose data cannot be read says "could not load", never ₹0 (authz rule 6).

## 9. Overall values (analytics)

Report-centre page (revenue RFC §12 rules: each tile drills to rows, the source query is named,
a total that cannot be read says so, field access hides amounts by `billing.amount`-style class).

- Group by **vendor**, **vendor type**, **department**, period (month / FY).
- Measures: PO value, received, invoiced, paid, outstanding, MSME overdue + interest accrued,
  s.43B(h) at-risk amount at year end, contract-rate leakage, SLA penalty due vs deducted,
  AMC paid vs uptime, consignment used vs billed, documents expired, top-10 concentration share,
  count of vendors by status.
- Charts via `@mantine/charts` (bar by type, stacked by department); table alternative always.

## 10. Alerts

| Alert | Trigger | To |
|---|---|---|
| Licence / insurance / authorisation expiry | `renewal_alert_days` before `valid_to`; on expiry the type's "blocks" rule applies | Owning dept, purchase |
| MSME breach | Accepted-goods date + 15/45 days − 7 days (warn) and on the day (breach) | Finance |
| Contract renewal | `bme_contracts.renewal_alert_days`, rate-contract end | Biomedical, purchase |
| SLA breach | Breakdown open beyond `sla_response_hours` / `sla_resolution_hours` | Biomedical; penalty line queued for next invoice |
| Bank change | Any change submitted / approved | Finance approvers, vendor's old contact |

Delivered by the existing notification hub; scheduled by the one automation engine.

## 11. Permissions (names only; define in Rust first)

`vendor.master.view`, `vendor.master.create`, `vendor.master.update`, `vendor.master.approve`,
`vendor.master.blacklist`, `vendor.bank.view`, `vendor.bank.request`, `vendor.bank.approve`,
`vendor.documents.view`, `vendor.documents.manage`, `vendor.documents.verify`,
`vendor.config.manage`, `vendor.analytics.view`, `vendor.msme.view`, `vendor.sla.manage`.
Bank account numbers are a redactable field class (masked except to `vendor.bank.view`).

## 12. First slice: scenarios (Given/When/Then)

Slice 1 = types + intake form + format checks + dedup + documents with expiry + maker-checker +
bank-change control + MSME due date on invoices. No paid APIs yet (manual verification).

1. **Happy intake.** Given a purchase officer with `vendor.master.create`, When they choose "Drug
   supplier", enter a valid GSTIN, upload Form 20B and 21B with expiry dates and submit, Then the
   vendor is `pending`, PAN is filled from the GSTIN, and a finance approver sees it in the
   approvals inbox.
2. **Self-approval refused.** Given the same officer also holds `vendor.master.approve`, When they
   open their own request, Then Approve is not offered and the API answers 403.
3. **Bad GSTIN.** Given GSTIN `29ABCDE1234F1Z6` (wrong check digit), When submitted, Then the field
   shows "This GSTIN's last character does not match; check the number" and nothing is saved.
4. **Duplicate.** Given an active vendor with PAN ABCDE1234F, When a new vendor is entered with
   the same PAN, Then the form shows the existing vendor and Submit is blocked unless an approver
   overrides with a reason, which is audited.
5. **Pending vendor on a PO.** Given a `pending` vendor, When a PO is raised for it, Then the
   picker does not list it and the API answers 409 "Vendor not yet approved".
6. **Expired drug licence.** Given a drug supplier whose Form 21B expired yesterday and the type
   rule "blocks: GRN", When stores posts a GRN, Then the GRN is refused with the document and
   date named, and the purchase officer is notified.
7. **Expiry alert.** Given `renewal_alert_days` 30, When a licence is 30 days from expiry, Then
   one alert is raised (not daily repeats) to the owning department.
8. **Bank change, two people.** Given a vendor with an active account, When a clerk with
   `vendor.bank.request` submits a new account with the call-back logged, Then the new row is
   `pending`, payments still go to the old account, and only a different user with
   `vendor.bank.approve` can activate it after the cooling period.
9. **Bank change without call-back.** When the call-back is not logged, Then Submit is disabled.
10. **Payment to unverified account.** When a payment is posted to a `pending` account, Then the
    API answers 409 and the attempt is audited.
11. **MSME clock.** Given a Micro vendor with a written agreement and goods accepted on 1 Oct,
    When the invoice is listed, Then its MSME due date is 15 Nov, it turns amber on 8 Nov and red
    after 15 Nov, with interest accrued at 3× the configured bank rate shown.
12. **Pre-Udyam bills.** Given a vendor whose Udyam date is 10 Oct, When an invoice dated 5 Oct
    is listed, Then no MSME due date is applied.
13. **Permission denied.** Given a user without `vendor.bank.view`, When they open a vendor, Then
    the account number is masked and the bank tab's query is not issued.

## 13. Phased plan

| Phase | Scope | Value |
|---|---|---|
| **P1 (first slice)** | §12: types, intake, checks, dedup, documents + expiry, maker-checker, bank-change control, MSME due date + breach alert, column merge | Stops bank fraud and duplicate vendors; MSME and licence exposure visible |
| P2 | 360° view (§8) from existing tables; overall values page (§9) | One place to see a vendor's money and risk |
| P3 | SLA breach + penalty queue on `bme_contracts` (VN5); AMC paid vs uptime; rate-contract leakage (VN2) | Recover penalties and over-rate lines |
| P4 | Verification providers (GSP, Protean PAN, penny drop) behind the provider trait | Fewer manual checks |
| P5 | TDS section from type (VN8); merge the two supplier-payment ledgers | Correct deductions, one ledger |
| P6 | Outsourced services: contract staff attendance vs invoice (VN4), linen (AS1), outsourced lab invoice match (VN3), consignment reconciliation (CC4) | Per-type leakage closed |
| P7 | Vendor self-service via connected apps (#5182): document renewal, PO/payment status, proof of service (VN11) | Vendors keep their own records current |
| P8 | DPDP processor register: contract on file, erasure confirmation at end | DPDP s.8 readiness |

## 14. Open questions for the owner

1. MSME days: default to 45 (written agreement assumed) or 15 unless a contract document is attached?
2. Which providers to integrate first for GSTIN, PAN and penny drop (each is a paid contract)?
3. Expired licence: block PO, GRN, payment, or warn only — per type default?
4. Bank-change cooling period: 24 h default acceptable?
5. Merge `pharmacy_supplier_payments` into `supplier_payments` (P5) — agree?
6. DPDP s.8 commencement date conflicts across sources (Rules notified Nov 2025; one source says
   s.8 from May 2027) — confirm with counsel before P8 priority.
7. AERB and NABL certificate checks: manual upload only, acceptable?
8. Visiting consultants paid as vendors: keep in vendor master or in HR/payroll?
