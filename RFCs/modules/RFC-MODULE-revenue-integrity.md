# RFC-MODULE — Revenue integrity and analytics

Status: **Proposed** (2026-11-08). Waiting for the owner. Nothing here is built by this RFC.
Scope: the whole hospital, clinical and non-clinical. Web first; native and TV follow the
report-centre rules in §12.
Related: `RFCs/RFC-MODULE-reports-center.md` (report UX and governance, kept),
`medbrains/RFCs/RFC-HOSPITAL-OS.md` (bricks, kernel), `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md`.

## 0. How to read this

- **The goal.** Close every place a hospital loses money. Small leaks first, then the big ones.
  Revenue integrity, regulation and security together are the moat.
- **The method.** One register of leaks (§3). One ranked inbox (§6). One metrics catalogue (§5).
  A person approves every action (§7).
- **Evidence.** Every figure has a link. Links were opened on 2026-11-08. Most figures were read
  from search results or press reports of a primary source, not from the primary document.
  Each figure says which. A figure we could not confirm says so. Nothing is filled from memory.
- **Ideas are not evidence.** §10 (new ideas) and the ₹ impact column are our judgement.
- **Code references** were found with grep on `origin/main` at `041cb9221`. Paths are under
  `medbrains/crates/` unless shown otherwise.

---

## 1. Problem: where Indian hospitals lose money

### 1.1 Insurance pays less than it is billed

| Figure | Source | Strength |
|---|---|---|
| FY24 health claims not paid: ₹26,037.65 cr = ₹15,100.14 cr **disallowed** + ₹10,937.17 cr **repudiated** | Government reply in Parliament, reported by [Moneylife 2025](https://moneylife.in/article/health-insurance-claims-worth-rs2603765-crore-rejected-by-insurers-in-fy2324-govt/76282.html) | Press report of a government answer |
| FY24: about ₹1.17 lakh cr claimed; 71.29% paid; 9.34% repudiated; 6.48% outstanding | IRDAI annual report 2023-24, via [Medical Dialogues 2024](https://medicaldialogues.in/news/health/129-per-cent-of-claims-rejected-by-health-insurance-companies-during-fy24-140774) and [Business Standard 2024](https://business-standard.com/industry/news/health-insurers-disallowed-claims-worth-rs-15-100-cr-during-fy24-irdai-124123000562_1.html) | Press report; IRDAI PDF not read |
| Disallowed amounts rose from ₹12,754 cr (FY23) to ₹15,100 cr (FY24) | [Business Today 2024](https://www.businesstoday.in/personal-finance/insurance/story/health-insurance-claim-rejections-by-insurance-companies-went-up-by-1910-in-fy24-458593-2024-12-26) | Press |
| Over half of claimants in 3 years had a claim rejected or partly paid; about 25% fully paid | LocalCircles survey, via [Business Today 2025](https://www.businesstoday.in/amp/personal-finance/insurance/story/insurance-claims-over-50-health-cover-claims-faced-rejection-or-partial-approval-says-survey-459394-2025-01-02) | Consumer survey |
| 70% of 262 doctors said claim amounts were cut in more than 10% of their cases | Indian J Med Sci 2019, [record](https://zendy.io/title/10.25259/ijms_13_2019) | Peer-reviewed survey |
| IRDAI non-payable items list: about 199 items in four groups (consumables, personal items, admin charges, items bundled into procedures) | [Cafemutual](https://cafemutual.com/news/press-news/14189-irdai-reviews-list-of-non-payable-items-under-health-insurance) | Trade press |

**What it means for a hospital.** "Disallowed" is the part cut from a claim that was otherwise
paid. The hospital feels it as a short payment. Much of it is avoidable: a missing document, a
non-payable item billed to the insurer, a room above the policy limit, a late query answer.

### 1.2 Government schemes pay late or not at all

| Figure | Source | Strength |
|---|---|---|
| PMJAY pays within 15 days intra-state, 30 days for portability claims | [Rajya Sabha reply, 18 Mar 2025](https://rsdebate.nic.in/bitstream/123456789/759227/1/PQ_267_18032025_U2041_p393_p395.pdf) | Government |
| PMJAY: 3.56 lakh claims worth ₹643 cr rejected as fraudulent; 1,114 hospitals de-empanelled | [Business Today 2025](https://www.businesstoday.in/personal-finance/insurance/story/centre-rejects-356-lakh-fraudulent-claims-under-ayushman-bharat-scheme-check-details-467748-2025-03-12) | Press report of government data |
| ₹1.21 lakh cr of AB-PMJAY claims pending (RTI, IMA white paper) | [Medical Dialogues](https://medicaldialogues.in/news/health/hospital-diagnostics/rs-121-lakh-crore-claims-pending-under-ayushman-bharat-reveals-rti-144237) | Press report of RTI |
| Actual PMJAY payment turnaround was 2–6 times the guideline | [BMC Health Services Research 2021](https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-021-07448-3/tables/2) | Peer-reviewed |
| CAG audit 2023: non-unique IDs, treatment of people recorded as dead, patients paying out of pocket | [CAG chapter V](https://cag.gov.in/uploads/download_audit_report/2023/09_Chapter-V-064d22bab412c53.02505839.pdf) | Government audit |
| CGHS rates revised 3 Oct 2025 (about 2,000 procedures); non-NABH hospitals paid 15% below NABH rates | [gconnect](https://www.gconnect.in/cghs-apps/treatment-rates/guidelines/overview) | Secondary |
| ECHS adopted the revised CGHS rates from 15 Dec 2025 | [Outlook Money](https://www.outlookmoney.com/personal-finance/cghs-rates-revised-for-echs-beneficiaries-healthcare-treatment-at-new-rates-from-december-15) | Press |
| ECHS bills submitted after 60 days reportedly lose 30% | [gconnect](https://www.gconnect.in/defence-services/echs/echs-advisory-processing-pending-claims-delay-submission.html) | Secondary; MoA not read |

We found **no published breakdown of PMJAY rejection reasons** and no national rejection rate.

### 1.3 Charges never captured

| Figure | Source | Strength |
|---|---|---|
| About 1% of net charges lost to charge-integrity leakage | [HFMA charge capture page](https://www.hfma.org/revenue-cycle/charge-capture/55358/) | US association, undated |
| Missing charges and charge lag are the top charge-capture problems; OR supply charges run late | [HFMA 2019](https://www.hfma.org/topics/news/2019/01/62829.html) | US association survey |
| Point-of-service capture raised charge summaries with no missed charge from about 65% to over 98% | [AMIA 2002](https://pmc.ncbi.nlm.nih.gov/articles/PMC2244278) | Peer-reviewed |
| A vendor reports $1.1M average unbilled revenue found per client per year | [Optum RCM page](https://business.optum.com/en/operations-technology/revenue-cycle-management.html) | Vendor, no method (page fetched) |

We found **no credible India-specific study** of missed-charge leakage as a share of revenue.
Figures of 12–20% appear only on vendor blogs with no method, so we do not use them.

### 1.4 Purchase, stores and vendors

| Figure | Source | Strength |
|---|---|---|
| Duplicate or wrong payments: median 1.5% of payment count (top 0.8%, bottom 2.0%) | [APQC measure](https://www.apqc.org/resources/benchmarking/open-standards-benchmarking/measures/percentage-total-annual-number), [CFO.com](https://cfo.com/news/metric-of-the-month-detect-and-prevent-duplicate-or-erroneous-payments/656852/) | Association |
| Billing schemes are 22% of occupational fraud cases, median loss $100,000; payroll schemes about 10%, median $50,000 | [ACFE Report to the Nations 2024](https://www.ivey.uwo.ca/media/kjljj5cy/2024-report-to-the-nations.pdf) | Association; read via secondary summary |
| Contracts lose about 9% of value on average (best 3%, worst 15%+) | [WorldCC 2025](https://info.worldcc.com/contract-management-aug-2025) | Association |
| Unused OR supplies averaged $653 a case, about 13% of supply cost | [J Neurosurg 2017, PubMed 27153160](https://pubmed.ncbi.nlm.nih.gov/27153160/) | Peer-reviewed |
| Oversized single-dose cancer vials waste about $1.8bn a year in the US | BMJ 2016;352:i788, via [AJMC](https://www.ajmc.com/view/size-matters-when-it-comes-to-cancer-drug-vials-and-healthcare-waste-says-bmj-study) | Peer-reviewed, via press |
| Hospital plate waste median 30% (range 6–65%) across 32 studies | [IJERPH 2019](https://mdpi-res.com/d_attachment/ijerph/ijerph-16-04330/article_deploy/ijerph-16-04330.pdf) | Peer-reviewed review |
| Linen loss: about 11–16% a year across four NZ health boards | [ODT news](https://odt.co.nz/node/129122) | News |

We found **no Indian study** of pharmacy expiry loss as a share of stock, of vial waste, of
linen loss, of reagent waste, or of patients sent to outside pharmacies by stock-outs.

### 1.5 What the competitors offer

| Vendor | Claim (vendor page) | What we found |
|---|---|---|
| MocDoc | "150+ customizable reports"; MIS; "advanced algorithms to forecast patient needs" ([page, fetched](https://www.mocdoc.com/healthcare-data-reporting-analytics)) | The "about 1,000 reports" figure is **not** on MocDoc's site. A search found nothing ([search results](https://mocdoc.com/healthcare-data-reporting-analytics)). We treat it as unverified. |
| Insta by Practo | "3000+ reports possible"; report builders per module; daily insight emails; "0% revenue leakage and stock pilferage" ([page, fetched](https://www.practo.com/providers/hospitals/insta)) | No method is given for the leakage claim. |
| KareXpert | A BI data lake, "AI-ready"; "Advance BI" and "AI Engine" products ([site](https://karexpert.com)) | No named reports. The BI page did not load. |
| Caresoft (Digital IPD) | BI for trends and KPIs; pre-configured government reporting ([site](https://caresoft.co.in)) | Lab dashboard and government reporting only. |
| Optum (global benchmark) | See §11 | US only. Optum India runs operations for the US business. |

**The gap.** No Indian vendor page shows a ranked list of leaks with a ₹ value, a recommendation
with a one-click action, or comparison against the hospital's usual day. That is where we go.

---

## 2. Principles

1. **One inbox.** Every detection is a row in one queue, ranked by ₹. No second queue (§6).
2. **Rules first.** A deterministic rule wherever one works. ML only where a rule cannot see the
   pattern, and only once there is enough history (§8).
3. **A person decides.** Nothing posts a charge, denies a claim or moves stock on its own.
4. **Unknown is not zero.** A rule that could not run shows "could not check", never "no leak"
   (authz law rule 6, applied to money).
5. **Every number drills to its rows.** A number we cannot open to its bills, batches or invoices
   is not shown.
6. **Measure the money.** Each leak point reports ₹ found, ₹ recovered and ₹ dismissed per month.
7. **Shadow first.** A new rule runs in shadow mode for a set period. It shows the ₹ it would have
   found before anyone is asked to act on it.

---

## 3. The leakage register

**Columns.**
- **Detect:** **R** = deterministic rule. **ML** = a statistical model, with the reason a rule is
  not enough. **LLM** = a language model reading free text.
- **Data source:** the code that holds the data today.
- **Effort:** S (days), M (one to three weeks), L (more).
- **₹:** expected impact, H/M/L, with the reason. This is our judgement.
- **State:** Built / Partial / Missing / Stub.

### 3.1 Front office and OPD

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| FO1 | Consult fee not posted after a visit | R: visit with no fee line | `medbrains-opd/src/lib.rs` via `charge_or_queue` (`medbrains-server-services/src/charge_queue.rs`) | S | M: every OPD visit | **Built** (#5246) |
| FO2 | Visit closed with nothing billed | R: closed visit, no invoice line | KPI `opd_unbilled_pct` (`medbrains-dashboard/src/management_kpis/catalog.rs`) | S | M: daily volume | Partial: a KPI, no row in an inbox |
| FO3 | Insured patient billed as cash, or scheme patient billed as cash then refunded | R: payer at registration vs eligibility answer | `medbrains-facilities/src/nhcx_eligibility.rs` | S | M | Partial |
| FO4 | Registration or card fee waived without approval | R: concession on fee lines vs policy | `medbrains-billing/src/concessions.rs` | S | L: small amounts | Partial |
| FO5 | Follow-up window misused (paid visit booked as free follow-up) | R: follow-up flag vs days since last paid visit | OPD visits | S | L | Missing (not found by grep) |
| FO6 | No-show slots left empty | ML later (§8). Rules first: overbook by the hospital's own no-show rate per slot | `medbrains-scheduling/src/scheduling.rs` | M | M | **Stub**: `predicted_noshow_probability` is a hash of the appointment id, not a model. It must be labelled or removed. |
| FO7 | Medical-record copy and certificate fees not charged | R: release logged, no fee line | MRD (`medbrains-mrd`) | S | L | Missing |

### 3.2 Clinical to charge (IPD, OT, ER, lab, radiology)

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| CC1 | Bed days not billed | R: occupied bed-day with no room-rent line | `medbrains-server/src/services/room_rent.rs` (hourly, idempotent) | S | H | **Built** |
| CC2 | Orders done but not billed (lab, radiology, procedures) | R: resulted order with no charge | `medbrains-billing/src/final_bill.rs` (`unbilled_orders`) | S | H: highest-volume clinical leak | Partial: checked only at final bill |
| CC3 | Ward stock used on a patient, not charged | R: `consume_ward_stock` with no charge | `medbrains-ward-stock/src/lib.rs` (consumption has no charge line) | S | H: dressings, cannulas, IV sets every shift | **Missing** |
| CC4 | Consignment implant used, not billed, or not reported to the vendor | R: usage with no patient; usage with no vendor report | `medbrains-indent/src/lib.rs` (consignment usage bills on use, but `patient_id` is optional and calls `auto_charge` directly, not `charge_or_queue`) | S | H: one implant can cost lakhs | Partial |
| CC5 | OT consumables and completion lines | R | `medbrains-ot/src/billing.rs` via `charge_or_queue` | S | H | **Built** (#5246) |
| CC6 | ER registration, diet, ambulance, CSSD auto charges | R | `charge_or_queue` call sites (#5246) | S | M | **Built** |
| CC7 | Procedure written in notes but never ordered or billed | LLM: the procedure is only in free text; no rule can read it | `medbrains-clinical-notes` | L | H | Missing |
| CC8 | Visiting consultant visits in IPD not charged | R: round note by a consultant vs visit charges | Clinical notes; `medbrains-doctor-payouts` accrual | M | M | Partial |
| CC9 | Oxygen given but not billed | R: oxygen orders or flow charting vs oxygen charges | `medbrains-facilities/src/facilities.rs` (gas readings); IPD | M | M | Missing link |
| CC10 | Blood components issued not billed; units discarded | R: issue with no charge; discard rate vs usual | `medbrains-blood-bank/src/lib.rs` (`discard_reason`) | S | M | Partial |
| CC11 | Dialysis consumables and dialyser reuse | R: session vs consumables vs charge | `medbrains-specialty-other/src/dialysis_dialyzers.rs` | S | L | Partial |
| CC12 | Bedside consumables not recorded at all | Idea (§10, bedside capture) | MAR in `medbrains-ipd/src/lib.rs` | M | M | Missing |

### 3.3 Insurance, step by step

| ID | Step | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|---|
| IN1 | Eligibility | Policy not checked; exclusion or waiting period found after treatment | R | `medbrains-facilities/src/nhcx_eligibility.rs` | S | M | Built for NHCX; manual for portal-only TPAs |
| IN2 | Pre-auth | Not raised, or raised for the wrong package or amount | R: admission with payer and no pre-auth | `medbrains-facilities/src/nhcx_preauth.rs` | S | H | Partial |
| IN3 | Enhancement | Running bill passes the approved amount with no enhancement request | R: running bill vs approved amount | `nhcx_preauth.rs`; `medbrains-core/src/nhcx_wire.rs` (enhancement type) | S | H: the excess is often written off | **Missing** |
| IN4 | Room eligibility | Room above the policy limit causes a proportionate cut of the whole bill | R: room rate vs policy limit at admission and transfer | Bed types; policy data | S | H: one cut touches every line | **Missing** (only a mention in `medbrains-nabh/src/norms.rs`) |
| IN5 | Non-payables | Non-payable items billed to the insurer, then disallowed | R | `medbrains-billing/src/payer_split.rs` (non-payables list) | S | M | **Built** |
| IN6 | Discharge approval | Final approval later than 3 hours | R: clock from request | `medbrains-facilities/src/nhcx_sla.rs` | S | M | Built (clock); no inbox row |
| IN7 | Claim documents | A required document missing at submission | R: per-payer checklist vs attached | `medbrains-facilities/src/nhcx_claim_documents.rs` | M | H | Partial: no per-payer checklist |
| IN8 | Queries | Query answered late or not at all | R: clock per query | `medbrains-facilities/src/nhcx_queries.rs` | S | H | Partial: no deadline clock |
| IN9 | Submission | Claim filed after the payer's window (for example the reported ECHS 60-day rule) | R: discharge date vs window | Claims | S | M | **Missing** |
| IN10 | Package and rate card | Billed amount does not match the PMJAY package, CGHS/ECHS rate (NABH or not) or TPA tariff | R: bill vs rate card | None: payers are seeded in `medbrains-seed/src/insurance_providers.rs`, no rate cards | L | H | **Missing** |
| IN11 | Settlement | Payment received but not posted, or posted twice | R: UTR match | `medbrains-billing/src/nhcx_recon.rs`, `claim_settlements.rs` (maker-checker) | S | M | **Built** |
| IN12 | Short payment | Disallowance not reconciled by reason, not appealed, written off silently | R: settled vs claimed, by reason | `medbrains-billing/src/claim_settlement_post.rs` (write-off) | M | H | Partial |
| IN13 | TDS | TDS deducted by payer not matched to Form 26AS credit | R | `medbrains-nhcx-callback/src/payments.rs` (parses TDS) | M | M | Partial |
| IN14 | Denial pattern | The same payer cuts the same item every month | R first (counts by payer and reason); ML later | `medbrains-facilities/src/insurance.rs` | M | H | Missing |

**The lifecycle rules behind these rows.**
- IRDAI master circular, 29 May 2024: cashless decision within 1 hour; final discharge approval
  within 3 hours of the hospital's request ([ThePrint 2024](https://theprint.in/economy/cashless-claims-within-an-hour-and-discharge-from-hospital-in-3-hours-says-irdais-master-circular/2107998),
  [The Week 2024](https://www.theweek.in/news/india/2024/05/30/irdai-issues-new-master-circular-to-make-health-insurance-claims-process-more-seamless.html)).
  Press reports only; circular text not read. The rule against rejecting for documents the
  insurer already holds is widely reported but **not confirmed**.
- TDS on TPA payments to hospitals falls under section 194J ([CBDT Circular 8/2009](https://www.incometaxindia.gov.in/w/8/2009-circular-no.-8/2009-dated-24-11-2009);
  upheld by the [Karnataka High Court, 2020](https://itatonline.org/digest/ttk-healthcare-tpa-pvt-ltd-no-1-v-dy-cittds-2020-195-dtr-209-317-ctr-684-2021-430-itr-134-karn-hc/)).
  From 1 April 2026, section 393 of the Income-tax Act 2025 replaces the 194 series; rates are
  reported as carried over ([India Briefing](https://www.india-briefing.com/news/section-393-income-tax-act-2025-tds-rules-rates-compliance-guide-44450.html)). Not checked on incometaxindia.gov.in.
- ECHS bills go through an online Bill Processing Agency ([ECHS SOP](https://www.echs.gov.in/assets/General%20SOP/SOP%20Online%20Bill%20Processing.pdf)).
- PMJAY interest on late payment (1% a week) comes from older guidelines and varies by state
  ([summary](https://www.taxheal.com/ayushman-bharat-yojana-claim-settlement-process-pm-jay.html)). Not confirmed in the current NHA manual.
- NHCX: FHIR R4 implementation guide by NRCeS ([profiles](https://www.nrces.in/ndhm/fhir/r4/hcx-profile.html),
  [adoption guide](https://www.nrces.in/download/files/pdf/Implementation_Guide_for_Adoption_of_FHIR_in_ABDM_and_NHCX.pdf)).
  Use cases: eligibility, pre-auth, claim, communication (query), payment notice, status search
  ([HCX specs](https://github.com/hcx-project/hcx-specs/blob/v0.8/hcx-domain-specifications/README.md)).
  IRDAI asked insurers to onboard in June 2023 ([PIB](https://pib.gov.in/PressReleasePage.aspx?PRID=1948522));
  34 insurers and TPAs were live by July 2024 ([MoHFW](https://mohfw.gov.in/press-info/7558)).
- **Not found:** PMJAY HBP package rules (implants, stratification), TPA/PPN tariff rules, and
  IRDAI query deadlines. These need the NHA HBP manual and payer contracts. Open question Q3.

### 3.4 Counter and finance

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| CT1 | Discount above policy, or by someone who should not give it | R: discount vs policy band and approver | `medbrains-billing/src/concessions.rs`; `medbrains-approvals-core/src/controls.rs` | S | M | Partial: approvals exist; no exception list |
| CT2 | Refund spikes; one approver approving most refunds | R: refunds vs usual day; approver concentration | `medbrains-payment-gateway/src/refund.rs`; `medbrains-pharmacy/src/pos_returns.rs` | S | M | Partial |
| CT3 | Invoice cancelled after payment was taken | R: cancel after receipt | `medbrains-billing` | S | M | Partial: not listed as an exception |
| CT4 | Cash short or over at shift close | R | `medbrains-billing/src/cash_closing.rs`; `medbrains-pharmacy-cash-drawer/src/day_close.rs` | S | M | **Built** (count) |
| CT5 | UPI soundbox, card terminal and payment-gateway settlements differ from receipts | R: three-way tender match | `medbrains-payment-gateway/src/settle.rs` | M | M | Partial |
| CT6 | Credit beyond limit; aged credit written off | R | `medbrains-billing/src/credit.rs` | S | M | Partial |
| CT7 | Patient advance never adjusted or refunded | R: advance with closed admission | `medbrains-billing/src/advances.rs` | S | L | Partial |
| CT8 | Day revenue far below the usual day | R: against the usual-day baseline | `medbrains-billing/src/daily_revenue.rs`; `management_kpis.rs` baselines | S | M | Partial |

### 3.5 Pharmacy and stores: wastage, inventory, alternatives

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| PH1 | Expired stock | R | `medbrains-pharmacy/src/expired.rs`, `quarantine.rs` (BMW and NDPS rules) | S | M | **Built** (record and destroy) |
| PH2 | Near-expiry stock with no plan: not first out, not moved to a store that uses it, not returned inside the vendor's return window | R: days to expiry vs usage rate per store vs vendor window | FEFO in `medbrains-db/src/stock.rs`, `medbrains-pharmacy/src/lib.rs`; returns in `medbrains-materials/src/procurement.rs`, `medbrains-pharmacy-finance` | S | H: money still recoverable | Partial |
| PH3 | Selling above the NPPA ceiling; margin change after a revision | R: sale price vs ceiling | `medbrains-pharmacy/src/nppa.rs` (DPCO 2013 paras 13–14; values typed in or imported) | S | M, plus legal risk | Partial: no inbox row on breach or revision |
| PH4 | NSQ or spurious batch in stock (CDSCO monthly alert) | R: batch and manufacturer match | `medbrains-pharmacy-safety/src/lib.rs` (recalls) | M: a PDF parser | M ₹, H safety | Partial: recall flow, no feed |
| PH5 | Banned FDC still in the catalogue | R | Pharmacy catalogue | S | L | Missing |
| PH6 | Dead and slow stock; over-stock against real use | R: min, max and reorder from 90-day use | `medbrains-indent/src/lib.rs`, `medbrains-pharmacy/src/lib.rs` (`reorder_level`, static) | M | M | Partial |
| PH7 | Stock-out: prescription sent to an outside pharmacy | R: lines sent outside, by drug | `medbrains-pharmacy/src/storefront/outside.rs` (records the choice) | S | M | Partial: recorded, not measured |
| PH8 | Prescription leakage: OPD or discharge Rx never filled here | R: Rx-to-dispense capture rate per doctor and drug | OPD Rx; dispensing; `medbrains-pharmacy-repeats` (refills), `medbrains-pharmacy-delivery` | S | H: the largest pharmacy leak | Missing (rate); recovery paths built (#4745–#4749) |
| PH9 | Lab test ordered here, done outside | R: order with no sample by end of visit | `medbrains-lab/src/lib.rs` | S | M | Missing |
| PH10 | Shrinkage: issued and not consumed; consumed and not billed | R: issue vs consumption vs charge | `medbrains-indent`, `medbrains-ward-stock` | M | H | Missing |
| PH11 | Purchase price above the rate contract | R: GRN rate vs contract | `medbrains-materials/src/procurement.rs` (`rate_contract_id`), `grn.rs` | S | M | Partial |
| PH12 | Free or bonus quantity missed at receipt | R: invoice free qty vs scheme vs received | `medbrains-materials/src/grn_scan_contract.rs` (`free_qty`) | S | M | Partial |
| PH13 | Vendor rebates and credit notes not claimed | R: agreed rebate vs credit notes received | `medbrains-pharmacy-finance` (credit notes) | M | M | Missing (no rebate model) |
| PH14 | ABC/VED/FSN not used to set stock policy | R | `medbrains-indent/src/lib.rs` (classes exist) | S | L | Partial |
| PH15 | A cheaper equivalent exists (same INN, strength, form; formulary-preferred) | R + approval (§3.5a) | Formulary and `inn_name` in `medbrains-pharmacy/src/lib.rs`, `rx_safety.rs`; `medbrains-core/src/pharmacy_substitution.rs` | M | H | Missing (recommender) |
| PH16 | Generic or formulary-preferred share below target, per department | R | Same | S | M | Missing |
| PH17 | Opened multi-dose vials discarded early; IV bags wasted | R: opened-at log vs stability | Pharmacy, MAR | M | M | Missing |
| PH18 | Lab reagent lots expired; kits with short open stability | R: lot expiry and opened date vs tests run | `medbrains-lab/src/lib.rs` (`LabReagentLot`) | S | M | Partial |
| PH19 | OT trays opened but not used | R: trays released vs used per case | `medbrains-cssd/src/release.rs` | M | M | Missing |
| PH20 | Kitchen raw material vs meals served; plate waste | R | `medbrains-diet/src/lib.rs` | M | L | Missing |
| PH21 | Pharmacy POS discounts and returns | R | `medbrains-pharmacy/src/pos_returns.rs`, `return_rules.rs` | S | M | **Built** (rules) |

### 3.5a Alternatives: the safety and legal rules

- A recommendation is the same INN, strength and dosage form. It shows the margin effect for the
  hospital and the cost effect for the patient.
- **Never** for narrow-therapeutic-index drugs, biologics or LASA pairs without a pharmacist and
  the prescriber both approving. The existing `pharmacy_substitution.rs` already excludes NTI and
  biologics on online orders.
- **The law today.** The NMC 2023 conduct regulations (generic prescribing) were held in
  abeyance on 23 Aug 2023; the MCI 2002 regulations apply ([BW Healthcare 2023](https://bwhealthcareworld.com/article/nmc-puts-new-regulations-on-docs-in-abeyance-directs-to-follow-old-guidelines-from-2002-488890),
  [Tribune 2023](https://www.tribuneindia.com/news/nation/nmc-puts-generic-drugs-order-on-hold-538003)).
  MCI 2002 reg 1.5 asks doctors to prescribe by generic name "as far as possible" ([SpicyIP 2016](https://spicyip.com/2016/10/mci-gives-generic-prescription-a-shot-in-the-arm.html)).
  A pharmacist may not swap a prescribed brand without the prescriber; a 2016 proposal to amend
  D&C Rule 65 was rejected by DTAB ([Medical Dialogues](https://business.medicaldialogues.in/coming-soon-pharmacists-may-be-allowed-to-substitute-branded-drugs-with-generics)).
  So the recommender goes to the **prescriber and the DTC**, never straight to the counter.
- **Purchase cost.** Switching the brand the hospital stocks is a DTC formulary decision. The
  recommender drafts the proposal with its ₹ value; the DTC approves.
- **Not researched yet:** CDSCO biosimilar guidance and the NABH MOM chapter on DTC and LASA.
  Cite them before building PH15.

### 3.6 Regulator watch

Official sources only. Each row keeps the source link.

| Source | What it publishes | Format seen | Machine-readable | Inbox action |
|---|---|---|---|---|
| NPPA ceiling and retail price notifications, annual WPI revision | Gazette orders under DPCO 2013 | PDF (not fetched; [DPCO text](https://www.pharma-dept.gov.in/sites/default/files/notification%20dpco.pdf)) | No feed found | Reprice; flag stock above ceiling |
| NPPA Pharma Sahi Daam | Consumer price lookup | App ([report](https://medicaldialogues.in/amp/news/industry/pharma/nppa-uses-pharma-sahi-daam-app-to-track-drug-price-violations-parliament-informed-160780)) | No public API found | None |
| CDSCO NSQ and spurious alerts | Monthly table: product, batch, dates, manufacturer, reason | One PDF a month ([Mar 2025](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf)); columns changed Dec 2025; free-form batch numbers | No: PDF parser | Quarantine batch; return to vendor |
| CDSCO banned FDCs, recalls | Lists | Probably PDF (not confirmed) | Not confirmed | Block catalogue item |
| CGHS rate revisions | Office memoranda | PDF | No | Update tariff |
| ECHS rate adoption | Circulars ([report](https://www.staffnews.in/?p=164174)) | PDF | No | Update tariff |
| PMJAY HBP revisions | Package masters | Not confirmed | Not confirmed | Update packages |
| IRDAI circulars | Circulars | HTML list and PDF (not confirmed) | Not confirmed | Rule review by a person |
| CBIC GST rate notifications | Notifications | Not confirmed | Not confirmed | Update tax master |
| Drug shortages | — | No official Indian list found | — | — |

**Design.** A parser per source, run on a schedule, fetching only from the official domain. A
parsed row is matched to our stock, prescriptions and tariff. A match becomes an inbox row. A
parse that fails says so on the screen; it does not look like "no alerts this month".

**NPPA builds on what exists.** `medbrains-pharmacy/src/nppa.rs` already holds ceiling prices,
each with the notification it came from, typed in or imported from a sheet, because NPPA has no
machine-readable feed. The watcher adds to that table: a parsed notification becomes a draft
ceiling row that a pharmacist confirms, and only then do the breach and margin rows appear. No
new pricing module. CDSCO NSQ rows feed the existing recall flow in `medbrains-pharmacy-safety`
the same way.

### 3.7 Assets and facilities

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| AS1 | Linen lost or damaged, per ward and per laundry vendor | R: counts out vs back | `medbrains-materials/src/housekeeping.rs` (linen items and movements) | S | M | Partial: movements, no reconciliation |
| AS2 | Linen counts by RFID | Idea (§10) | — | L | M | Missing |
| AS3 | AMC/CMC paid but uptime not delivered | R: contract uptime vs downtime logged | `medbrains-bme/src/lib.rs` (`BmeContract`, breakdowns) | S | M | Partial |
| AS4 | Idle or under-used equipment | R: use per day vs usual | BME, OT utilisation (`medbrains-reports/src/analytics.rs`) | M | L | Partial |
| AS5 | Contracts roll over without review; auto-renewals | R: end date vs review | BME contracts; procurement | S | M | Missing (register) |
| AS6 | BMW weight handed over vs CBWTF invoice | R | BMW records (`medbrains-print-data/src/regulatory.rs`) | S | M | Partial |

### 3.8 Vendors and purchase

A generic vendor control that every department reuses: **contract → rate → proof of service →
invoice match → payment**. Each row below is that control applied to one kind of vendor.

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| VN1 | Duplicate supplier invoice | R | `medbrains-materials/src/grn.rs` (`reject_duplicate_invoice`, by invoice number or IRN) | S | M | **Built** |
| VN2 | PO, goods receipt and invoice do not match | R: three-way match | `procurement.rs`, `grn.rs` | M | H | Partial |
| VN3 | Outside lab or imaging: vendor invoice vs what we billed the patient; tests done but not billed; vendor billing more than done | R | `medbrains-lab/src/lib.rs` (`LabOutsourcedOrder`) | M | M | Partial |
| VN4 | Contract staff (housekeeping, security) billed above attendance | R: invoice heads vs attendance | `medbrains-hr` (staff attendance only) | M | M | Missing (contract staff) |
| VN5 | SLA penalties not deducted | R: SLA breach vs invoice deductions | Contracts | M | M | Missing |
| VN6 | Early-payment discounts missed; vendor advances not adjusted | R | Payables | S | L | Missing |
| VN7 | GST credit lost on vendor mismatch (GSTR-2B) | R | `medbrains-billing/src/accounting.rs` | M | L: most hospital services are exempt, so this matters mainly for taxable lines like pharmacy and canteen | Missing |
| VN8 | TDS on vendor payments wrong or missed | R | Payables | S | L: interest and penalty risk | Missing |
| VN9 | One vendor holds too much; related-party vendor; blacklisted vendor | R | `medbrains-core/src/procurement.rs` (`Blacklisted`); `approvals-core/src/controls.rs` | S | M | Partial |
| VN10 | Vendor performance | R | `procurement.rs` (`vendor_performance`) | S | L | **Built** |
| VN11 | Vendor proof of service missing (signed counts, photos) | R: invoice with no proof | Vendor apps (`medbrains-connected-apps`, #5182) | M | H | Missing (platform built) |
| VN12 | Canteen, parking, leased pharmacy: revenue share not received | R: agreed share vs received | Contracts; receipts | S | M | Missing |

Rules behind these rows:
- ITC only for invoices in GSTR-2B: CGST Act s.16(2)(aa), from 1 Jan 2022 ([TaxGuru](https://taxguru.in/goods-and-service-tax/claim-itc-gstr-2b-mandatory-w-e-f-01-01-2022.html)).
  Healthcare by a clinical establishment is exempt (Notification 12/2017 Sl. 74); credit on
  common inputs is reversed under Rules 42/43 ([explainer](https://www.terra-insight.com/insights/section-17-5-blocked-itc-hospitals-healthcare-services-india)).
- TDS rates (explainer, not checked on the tax site): 194C 1%/2%, 194J 10% (professional) or 2%
  (technical), 194Q 0.1% above ₹50 lakh, 194I 2%/10% ([chart](https://studycafe.in/tds-rate-chart-for-fy-2026-2027-under-income-tax-act-2025-420727.html)).
- BMW bar-coding for handover to CBWTFs: [CPCB 2018](https://dste.py.gov.in/ppcc/pdf/Guidelines/Guidelines_for_Bar_Code_System_for_HCFs_and_CBWTFs.pdf); Form IV annual report ([template](https://ppcb.punjab.gov.in/media/documents/Form_IV_BMW.pdf)).
- Related-party transactions need board approval: Companies Act s.188 ([explainer](https://treelife.in/compliance/related-party-transactions-section-188/)).
- GeM suspended sellers are published as a PDF only ([list](https://assets-bg.gem.gov.in/resources/pdf/Sellers_Suspended_Archive_List.pdf)). No API found.

### 3.9 People

| ID | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|
| PE1 | Doctor payout on a bill later refunded or cancelled | R: payout source bill state | `medbrains-doctor-payouts` (accrual from bills) | S | H | Partial: claw-back on refund not verified |
| PE2 | Referral payouts | R: flag every referral payout for compliance review | `medbrains-doctor-payouts/src/referral.rs` | S | H legal | Built (payout); **legal risk**: MCI 2002 cl. 6.4.1 bars commission for referring a patient ([text](https://www.rfhha.org/images/law/2.2%20Indian%20medical%20council%20(professional%20conduct,%20etiquette%20and%20ethics)%20regulations%202002.pdf)); referral fees are not tax-deductible ([Taxmann](https://www.taxmann.com/post/blog/referral-fee-paid-to-doctors-for-referring-patients-not-deductible-hc-follows-apex-lab-ruling/)) |
| PE3 | Overtime paid without attendance | R | `medbrains-hr/src/lib.rs` (overtime, attendance) | S | M | Partial |
| PE4 | Ghost employees: paid, no attendance, no login | R | `medbrains-payroll`, `medbrains-hr` | S | M | Missing |
| PE5 | PF/ESI paid late: damages 5–25% plus 12% interest | R: due date clock | `medbrains-payroll` | S | M | Missing. EPF damages and 7Q interest ([CGIT order 2025](https://cgit.labour.gov.in/sites/default/files/Cgit%202%20Delhi%20order%20dated%2018.11.2025%20Brij%20Laxmi%20vs.%20Faridabad.pdf)); ESI 12% interest ([case](https://future.indiankanoon.org/doc/515903/)) |

### 3.10 Other departments

| ID | Dept | Leak | Detect | Data source | Eff | ₹ | State |
|---|---|---|---|---|---|---|---|
| OD1 | Civil and engineering | Contractor bill vs measured work; material issued vs work done; renovation over budget | R | Facilities maintenance work orders | M | M | Missing. CPWD Works Manual 2022 is the measurement-book reference ([PDF](https://www.ndmc.gov.in/departments/Departments/Finance/nodal_cell/CPWD%20Works%20Manual%202022.pdf)); clauses not read |
| OD2 | Utilities | DG diesel vs run hours (0.24–0.36 L/kWh, vendor figures) | R | `medbrains-facilities/src/facilities.rs` | M | M | Partial. Vendor norms ([depco](https://www.depco.com/faq/diesel-generator-efficiency/)); no Indian official norm found |
| OD3 | Utilities | Power per department vs usual; water vs 340–450 L/bed/day | R | Facilities readings | M | M | Partial. NBC water norm via [NCRPB](https://www.ncrpb.nic.in/NCRBP%20ADB-TA%207055/repository/pdf/clause/clause2.2.8.3c.pdf); BEE hospital star rating is kWh/m² ([BEE](https://beeindia.gov.in/sites/default/files/Scheme%20for%20Hospital%20Building%20Star%20Rating.pdf)) |
| OD4 | Utilities | Oxygen (cylinders, LMO) vs patient-days and vs oxygen billed | R | Gas readings (`facilities.rs`); IPD | M | M | Partial. NHM 2020 planning rates 7.14 L/min ward, 11.90 L/min ICU ([NHM](https://www.nhm.gov.in/New_Updates_2018/Om_and_orders/covid19/DO_AS%26MD_18_APR.pdf)) |
| OD5 | Housekeeping | Chemicals vs area cleaned; pest-control visits vs invoice | R | `medbrains-materials/src/housekeeping.rs` | S | L | Missing |
| OD6 | Stationery and printing | Forms, wristbands, labels, toner per department | R: print counts | `medbrains-printing`, `medbrains-print` | S | L | Missing. A vendor-quoted US figure is about $2,500 printing per bed a year ([Becker's](https://www.beckershospitalreview.com/finance/the-average-1-500-bed-hospital-prints-96m-pages-each-year-at-a-cost-of-3-8m)); a 25-bed digital-forms study saved $1,706 a year ([PMC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11180717/)). No Indian figure found |
| OD7 | IT | Licences paid but unused; devices; telecom bills | R | Device registry (`medbrains-devices`) | S | L | Missing. Vendor surveys: 36% of SaaS licences unused (Zylo, via secondary); [Flexera 2025](https://www.flexera.com/blog/it-asset-management/the-importance-of-it-asset-management-flexera-state-of-itam-report/) |
| OD8 | Transport | Ambulance fuel and km vs trips billed; maintenance | R | `medbrains-ambulance/src/lib.rs` | S | L | Partial. A CAG Kerala finding on 108 payments cost ₹5.35 cr ([report](https://english.madhyamam.com/kerala/2015/mar/23/cag-finds-loopholes-running-108-ambulance-services)) |
| OD9 | Security | Guard attendance vs invoice; visitor and parking fees | R | VN4; parking receipts | S | L | Missing. A CAG audit found 267 billed hospital service staff could not be verified ([CAG Puducherry 2017](https://saiindia.gov.in/uploads/download_audit_report/2017/Chapter_3_COMPLIANCE_AUDIT_of_Puducherry_Report_No_1_of_2017_on_Union_Territory.pdf)) |
| OD10 | Kitchen and diet | Raw material vs meals; patient diet billed; staff canteen subsidy | R | `medbrains-diet/src/lib.rs` (diet charges built via `charge_or_queue`) | M | L | Partial |
| OD11 | Mortuary | Cold-chamber days not billed | R | Not found | S | L | Missing. Fees are set by states, for example ₹300 a day in one state's 2020 notice ([report](https://www.pressreader.com/india/hindustan-times-jalandhar/20200523/281792811228138)) |
| OD12 | Medical records | Copy and certificate fees (see FO7); records due within 72 hours (MCI 2002 cl. 1.3.2) | R | `medbrains-mrd` | S | L | Missing |
| OD13 | Call centre and marketing | Enquiries not converted; campaign cost per admitted patient | R | `medbrains-marketing/src/funnel.rs` | S | M | Partial |

---

## 4. Priority and waves

**Scoring.** Impact H=3, M=2, L=1. Effort S=1, M=2, L=3. Score = impact ÷ effort. Ties go to the
item with an existing data source and to safety. Waves mix departments; they are ordered by score,
not by department. Each wave is 3–5 items.

### Wave 1: plumbing plus the quickest money (score 3)

| # | Item | Register | Effort | ₹ | Why first |
|---|---|---|---|---|---|
| 1.1 | **Leakage inbox** on the existing charge attention queue, with ₹, evidence, owner, action and the money-recovered counter | §6 | S–M | Enabler | Every later rule writes here |
| 1.2 | **Stock used on a patient, not charged**: ward-stock consumption and consignment implants go through `charge_or_queue`; implant use with no patient becomes a row; vendor usage report | CC3, CC4 | S | H | Data exists; one call site each |
| 1.3 | **Pre-auth used-up alert**: running bill reaches 80% of the approved amount → enhancement row | IN3 | S | H | Running bill and approval both exist |
| 1.4 | **Room eligibility check** at admission and transfer: room rate above the policy limit → row before the cut happens | IN4 | S | H | One check, touches the whole bill |
| 1.5 | **Near-expiry plan**: batches that will not sell before expiry at the current use rate → transfer, return inside the vendor window, or first-out | PH2 | S | H | Money still recoverable |

### Wave 2 (score 2–3)

| # | Item | Register | Effort | ₹ |
|---|---|---|---|---|
| 2.1 | **Bill-ready check before discharge**: unbilled orders, open queue rows, missing claim documents, shown while the patient is still in the ward | CC2, IN7 | S | H |
| 2.2 | **Payout claw-back and referral flag**: payout on a refunded bill; every referral payout to compliance review | PE1, PE2 | S | H |
| 2.3 | **Prescription and lab capture rate**: Rx-to-dispense and order-to-sample per doctor and drug; refill and delivery offers as the action | PH7, PH8, PH9 | S | H |
| 2.4 | **NPPA ceiling breach and revision rows** | PH3 | S | M |
| 2.5 | **Counter exceptions**: discount above band, refund concentration, cancel after receipt, credit over limit | CT1–CT3, CT6 | S | M |

### Wave 3 (score 2)

| # | Item | Register | Effort | ₹ |
|---|---|---|---|---|
| 3.1 | **Query and submission clocks**: payer query deadline, claim filing window | IN8, IN9 | S | H/M |
| 3.2 | **GRN checks**: price above rate contract, free quantity missed | PH11, PH12 | S | M |
| 3.3 | **Laundry count reconciliation** per ward and vendor | AS1 | S | M |
| 3.4 | **BMW weight against the CBWTF invoice**; AMC uptime against what was paid | AS6, AS3 | S | M |
| 3.5 | **CDSCO NSQ batch match** (monthly PDF parser) | PH4 | M | M ₹, H safety |

### Wave 4 (score 1.5)

| # | Item | Register | Effort | ₹ |
|---|---|---|---|---|
| 4.1 | **Short-payment reconciliation** by payer and reason, with appeal action; TDS vs 26AS | IN12, IN13 | M | H |
| 4.2 | **Three-way match** PO, goods receipt, invoice | VN2 | M | H |
| 4.3 | **Shrinkage**: issued vs consumed vs billed, per ward | PH10 | M | H |
| 4.4 | **Per-payer document checklist** | IN7 | M | H |
| 4.5 | **Tender match**: UPI, card, gateway against receipts | CT5 | M | M |

### Wave 5 (score 1.5)

| # | Item | Register | Effort | ₹ |
|---|---|---|---|---|
| 5.1 | **Cheaper-equivalent recommender** to prescriber and DTC; generic share target per department | PH15, PH16 | M | H |
| 5.2 | **Vendor proof of service** in the vendor app, matched to the invoice | VN11 | M | H |
| 5.3 | **Contract staff attendance vs invoice**; SLA penalties | VN4, VN5, OD9 | M | M |
| 5.4 | **Contract register**: renewals, auto-renewals, revenue shares received | AS5, VN12 | S | M |

### Wave 6 (score 1)

| # | Item | Register | Effort | ₹ |
|---|---|---|---|---|
| 6.1 | **Rate-card and package engine**: PMJAY HBP, CGHS/ECHS (NABH differential), TPA tariffs; bill vs package | IN10 | L | H |
| 6.2 | **Regulator watch** for rate cards, IRDAI and GST | §3.6 | M | M |
| 6.3 | **Stock policy from real use**: min/max/reorder, dead stock, ABC/VED/FSN | PH6, PH14 | M | M |
| 6.4 | **Utilities**: DG diesel, oxygen, power and water per department | OD2–OD4, CC9 | M | M |

### Wave 7: models, once there is history (§8)

Denial prediction per payer; "patients like this are usually billed X"; anomaly detection on
discounts, refunds, stock, invoices, payouts and utilities; occupancy, cash and stock forecasts.

### Wave 8: large or hardware items

Notes to suggested charges (CC7, LLM); bedside barcode capture (CC12); RFID linen (AS2); smart
cabinets; per-department meters; the opt-in network benchmarks (§10). Remaining S/L items
(FO4, FO5, FO7, OD5–OD13, PE3–PE5, VN6–VN8) are folded into waves 3–6 as capacity allows; each is
a single rule over existing data.

---

## 5. The analytics model

### 5.1 Types of analytics

| Type | What it answers | Example | Built on |
|---|---|---|---|
| Operational list | What is in front of me now | Today's discharges with open bills | Existing module lists |
| Diagnostic drill-down | Why did this number move | Pharmacy margin fell: by drug, store, payer | Metrics catalogue dimensions |
| Exception / leakage list | What is wrong, ranked by ₹ | The leakage inbox | §6 |
| Predictive | What will happen | Occupancy next 7 days; expiry risk per batch | §8 |
| Prescriptive | What to do, worth how much | "Return 14 batches to vendor X before 30 Nov: ₹1.8 lakh" with one click | Inbox actions |
| Benchmark | Is this normal for us | Against the same weekday over four weeks, yesterday and last seven days | `medbrains-dashboard/src/management_kpis.rs` (built) |
| Regulatory / statutory | What must be filed | NABH indicators, BMW Form IV, NDPS registers, MLC, birth and death | `medbrains-reports/src/nabh_indicators.rs`, `medbrains-regulatory`, `medbrains-print-data` |

### 5.2 What exists today

- `medbrains-dashboard/src/management_kpis.rs`: 18 KPIs, each with three usual-day baselines
  (same weekday over four weeks, yesterday, previous seven days).
- `medbrains-reports/src/reports.rs`: 79 report definitions: 25 live, 44 query-buildable,
  5 predictive, 5 needing data capture. `analytics.rs` has 23 aggregate handlers.
- `apps/web/src/pages/reports/report-catalog.ts`: a static fallback catalogue in the web app. This
  is a **second copy** of report definitions. It goes when the server catalogue is complete.
- `medbrains-reports/src/report_widget.rs` and `medbrains-dashboard/src/my_widgets.rs`: put a
  report on a reader's own dashboard; the server owns the data source and permission.
- `medbrains-analytics`: command centre, utilisation review, care view, retrospective.
- `medbrains-ai/src/query.rs`: AI question box, `SET LOCAL statement_timeout = '3s'` and
  `lock_timeout = '1s'`; `revenue.rs` answers revenue questions from invoices exactly.
- Not built: report schedules, report runs, shares (planned in `RFC-MODULE-reports-center.md`),
  a read-only reporting copy, DuckDB.

### 5.3 One metrics catalogue

Every number is defined once and reused by tiles, reports, the AI and the board pack.

| Field | Meaning |
|---|---|
| `code` | Stable id, for example `ipd.arpob` |
| `formula` | The definition in words and as a query |
| `source` | Tables and crate |
| `owner` | The role that answers for it |
| `refresh` | Live, hourly, daily |
| `permission` | The code a reader needs |
| `dimensions` | Department, payer, doctor, ward, drug, vendor |
| `baseline` | Usual-day rule (the existing three baselines) |
| `target` | Set by the hospital |
| `unknown_rule` | When the number is shown as unknown |

**Build it from what exists.** The KPI catalogue in `management_kpis/catalog.rs` becomes the
metrics catalogue. Report definitions in `reports.rs` reference metric codes instead of carrying
their own SQL. Shown on hover in every tile.

**Standard KPI definitions (sources).**

| KPI | Formula | Source |
|---|---|---|
| ARPOB | Inpatient revenue ÷ occupied bed-days, per day | Analyst summary of listed-chain disclosures ([Sahukar](https://abhaysahukar.substack.com/p/understanding-the-hospital-sector-3bb)). Chains differ on what revenue is included; we show our definition |
| Bed occupancy | Inpatient bed-days ÷ (beds × days) × 100; IPHS norm at least 80% | [CAG 2021 citing IPHS](https://cag.gov.in/uploads/download_audit_report/2021/performance%20Audit%20District%20Hospital-15-07-2021%20with%20signature%20-%20Chapter%20VII-0627a35a102be52.60337829.pdf) |
| ALOS | Inpatient bed-days ÷ (discharges + deaths) | [IJCMPH](https://www.ijcmph.com/index.php/ijcmph/article/download/751/637/2514) |
| Bed turnover | (Discharges + deaths) ÷ beds, for the period | CAG 2021 (above) |
| Net AR days | Net receivables ÷ average daily net patient revenue | [HFMA MAP Keys](https://www.hfma.org/revenue-cycle/map/map-keys/) (PDF not readable here) |
| Cash collection % | Cash collected ÷ net patient revenue | HFMA MAP Keys |
| Denial rate | Denied claims ÷ claims submitted; also by value | HFMA MAP Keys; [HFMA article](https://www.hfma.org/revenue-cycle/the-kpis-that-define-revenue-cycle-excellence/) |
| NABH utilisation indicators | Each with definition, formula and frequency in the KPI annexure | [NABH 6th edition, Jan 2025](https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf) (not fetched) |
| OPD-to-IPD conversion, pharmacy margin, inventory turns, cost per patient-day | Our definitions | **No source confirmed**; marked as hospital-defined |

### 5.4 Report builder

A report is a **template over metrics**: pick metrics, dimensions, filters and a chart type from
the catalogue. A reader never writes SQL and never names a table. The builder can only offer
metrics the reader may see. Saved reports are rows in `report_definitions` (reports-center RFC).

### 5.5 AI question box

Over the catalogue, not over raw tables. The model picks metrics and filters; the server runs the
query under the existing 3-second statement timeout; the answer is a chart plus the rows, with
each number linked to the metric. If the catalogue has no metric for the question, it says so.

### 5.6 Scheduled reports and board pack

Schedules, runs and shares as in the reports-center RFC. The board pack is generated from
layer 1 (§5.8) with its sentences, weekly and monthly, as PDF and PPTX, emailed on a schedule.

### 5.7 Reports never slow the wards

- Every report query runs on a **read-only reporting role** with `statement_timeout` and
  `lock_timeout` set per transaction, as the AI path already does.
- When the hospital has a replica, reports go there. `medbrains-db-topology` already routes per
  tenant; a reporting pool is added beside it.
- Heavy history (more than 90 days, cross-year trends) goes to a columnar store (DuckDB),
  refreshed nightly from the reporting copy. It holds aggregates and pseudonymous keys, never
  names.
- A report that times out shows "could not load in time", with a link to run it on the history
  store. It never shows a blank or zero.

### 5.8 Presenting to management: three layers

**Layer 1: one screen for the owner.** Eight numbers, each against the usual level and a target.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Hospital this week                       Week ▾   All departments ▾   Export │
├──────────────────────────────────────────────────────────────────────────────┤
│ Revenue          ₹4.82 cr   usual ₹4.60 cr  ▲ 4.8%   target ₹4.75 cr        │
│ Leakage found    ₹11.4 L    usual ₹9.8 L    ▲ 16%    214 open items         │
│ Leakage recovered ₹6.9 L    61% of found    ▲ 8 pts                         │
│ Collection days  38 days    usual 41        ▼ 3                             │
│ Claim denial %   7.2%       usual 6.1%      ▲ 1.1 pts   unusual             │
│ Cost/patient-day ₹—         could not load (stores feed failed 09:12)       │
│ Occupancy        81%        usual 78%       ▲ 3 pts                         │
│ ARPOB            ₹41,200    usual ₹39,900   ▲ 3.3%                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ What changed: Claim denials rose 1.1 points, mostly one payer cutting        │
│ room-rent on 9 claims (₹2.3 L). Suggested: check room eligibility at         │
│ admission (wave 1.4).                               [Open the 9 claims]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Layer 2: one department.** Trend, cause breakdown, ranking.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Pharmacy                                  Last 8 weeks ▾   Store ▾   Payer ▾ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Leakage rose ₹2.1 L this week, mostly near-expiry stock in one store         │
│ (₹1.4 L), Rx filled outside (₹0.5 L) and ceiling-price breaches (₹0.2 L).    │
│ Suggested: return 14 batches inside the vendor window: ₹1.4 L [Review]       │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Leakage by week (bar, zero    │ By cause (stacked bar)                       │
│ baseline, usual band shaded)  │ near-expiry ████████ 1.4 L                   │
│ ▁▂▂▃▂▃▅█                      │ Rx outside  ███ 0.5 L                        │
│                               │ ceiling     █ 0.2 L                          │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ Ranking: store · ₹ found · ₹ recovered · open · oldest                       │
│ Table view ⇄ (every chart has one)                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Layer 3: the rows.** Every bill, batch or invoice behind a number, with its evidence, and the
inbox action. A number that cannot be drilled is not shown.

**Each number explains itself.**
- A sentence: what changed, by how much, why, with the top three drivers.
- The recommended action, its ₹ value, and one click to the inbox rows.
- The sentence is written from the numbers on screen only, and each figure in it links to its
  metric. A sentence that names a figure the data does not hold fails a check and is not shown.

**Honest charts.** Per `medbrains/docs/CARBON-DATAVIZ-RULES.md`: zero baselines, no 3D, no pie
above five slices, a table for every chart, colour never alone. A failed number is "could not
load", never zero.

**Meeting mode.** Full screen, steps through layer 1 one number at a time with its sentence and
its layer 2 page. Keyboard and clicker driven.

**Benchmarks.** Own usual day first, target second, the network median third (opt-in, §10).
The NHS "Making Data Count" work found that red-amber-green snapshots hide trends, and boards
moved to charts against a process's own baseline ([BMJ Leader 2021](https://bmjleader.bmj.com/content/5/4/252)).
Boards using dashboards with internal data and benchmarks had better process-of-care results,
an association only ([AHRQ summary of J Healthc Manag 2009](https://webarchive.library.unt.edu/web/20121007054717/http:/www.ahrq.gov/research/jul09/0709RA35.htm)).

**Per-department cost and leakage.** Each department page carries: cost, leakage found,
leakage recovered, and **cost per patient-day** (department cost ÷ patient-days it served).
Cost per patient-day needs cost allocation; until stores, payroll and utilities feed it, it shows
"partial" with what is missing.

---

## 6. The leakage inbox

**Reuse, not a second queue.** The charge attention queue from #5246
(`charge_attention_items`, migration 1411; `medbrains-billing/src/charge_attention.rs`;
Billing → Charges needing attention) becomes the inbox. Its rows already carry the source,
patient, charge, reason, status, who resolved it and when, and an audit trigger.

**What is added** (a later migration, not this RFC):

| Field | Meaning |
|---|---|
| `kind` | `charge_not_posted` (today's rows), `preauth_used_up`, `room_over_limit`, `near_expiry`, `ceiling_breach`, `nsq_batch`, `invoice_mismatch`, … |
| `rule_code`, `rule_version` | Which rule found it, and which version |
| `amount` | ₹ at stake, and how it was computed |
| `evidence` | Links to the rows (bill, batch, invoice), never copied patient text |
| `owner_role` | Billing desk, insurance desk, pharmacy, stores, procurement, HR, engineering |
| `action` | Post the charge / raise a query / request enhancement / move or return stock / approve / dismiss with a reason |
| `recovered_amount`, `recovered_at` | Filled when the money actually arrives (§6.2) |
| `subject` | Patient, bill, batch, invoice or vendor id; non-patient rows have no patient |

Today's rows need a `patient_id`; a stock or vendor row has none. That column becomes nullable
for non-charge kinds, with a check that charge kinds still carry one.

**Ranking.** Open rows sorted by ₹, then age. Each owner sees only their kinds (§9).

**Actions.** One click opens the action with the row pre-filled. Posting a charge uses the same
`post_charge` path the queue uses today. Dismissing needs a reason from a list plus free text.

### 6.1 Money recovered

Per rule, per month: ₹ found, ₹ actioned, ₹ recovered, ₹ dismissed, and median days to recover.

| Kind | Recovered means |
|---|---|
| Charge not posted | The posted charge was later paid or settled |
| Pre-auth used up | Enhancement approved amount |
| Room over limit | Cut avoided: patient moved or consented to pay the difference before discharge |
| Near expiry | Credit note received, or stock sold before expiry |
| Short payment | Appeal amount received |
| Vendor mismatch | Credit note or deduction made |

The counter on the inbox shows this month's recovered ₹. It is the number that proves the value
to the owner. It counts only money that arrived, never money "found".

### 6.2 Shadow mode

A rule is created in shadow. It writes rows marked `shadow` that nobody is asked to act on. After
the shadow period the hospital sees what it would have found, the false-positive rate from a
sample review, and then switches it on.

---

## 7. AI rules

1. **A person approves every action.** No charge is posted, no claim sent, no stock moved, no
   staff record changed by a model.
2. **Every suggestion is logged** with the model, version, inputs (by reference), the score and
   its top factors, and what the person did: accepted, edited, dismissed, with reason. This is
   the training label for §8 and the audit trail.
3. **Pseudonymise before anything leaves.** Every model call goes through
   `medbrains-core/src/ai_redact` (`Redactor::redact`, fail closed) and
   `medbrains-ai/src/redaction.rs` (per-turn session). A tool result that cannot be made safe is
   withheld.
4. **Local model option.** `medbrains-server-services/src/llm.rs` resolves the provider per tenant;
   `AI_PROVIDER=ollama` runs locally. Revenue models (§8) are small and run in-house by default.
5. **No auto-posting of charges.** A suggested charge lands in the inbox as a row. The existing
   queue's post path is the only way onto a bill.
6. **Golden cases.** Every LLM use gets cases in `medbrains-ai-eval` (exact, grounded,
   operational) before it ships.

---

## 8. ML and AI: where a model beats a rule

**Honest stance.** Most of the register is rules. A model earns its place only where the pattern
is too wide for a person to write, and only after the hospital has enough history. A new hospital
starts on rules, shadows the model, and switches once it beats the rule on the same rows.
Pre-trained models across hospitals are an opt-in option only (§10, legal limits).

| Use | Why a rule is not enough | Simplest model | Data and history needed | Shows it works | Effort | Wave |
|---|---|---|---|---|---|---|
| Claim denial before submission, naming the missing document or code | Denials depend on payer, package, diagnosis, documents and history together | Gradient-boosted trees per payer, with top factors | Own claims with outcomes; about 12 months and a few thousand claims per payer (our estimate) | Precision and recall on held-out months; ₹ saved per flag | M | 7 |
| "Patients like this are usually billed X" | Thousands of procedure–consumable pairs | Association rules / frequency per procedure and ward, then trees | Bills and orders; 6+ months | Share of flags a biller accepts; ₹ per accepted flag | M | 7 |
| Anomalies: discounts, refunds, stock movement, vendor invoices, payouts, utilities | Rules catch known shapes only | Isolation forest or robust z-score against the usual day | 3+ months per series | Alerts reviewed vs confirmed; ₹ per confirmed alert | M | 7 |
| Forecasts: occupancy, cash, stock, staff | Seasonality and trend | Seasonal time series (ETS) before anything else | 1+ year for seasonality | Error vs the naive "same week last year" | M | 7 |
| Expiry risk per batch | Use rate varies by store and season | Use-rate forecast × days to expiry; trees later | Dispensing history | ₹ of expiry avoided vs before | S | 1 (rule), 7 (model) |
| Vendor price outliers | Many items, many vendors | Robust percentile per item | Own GRNs; network data opt-in | Savings negotiated per flag | S | 3 (rule) |
| Length of stay vs package norm | Package norms vary | Rule against the package norm | Packages (IN10) | Flags accepted by case manager | S | 6 |
| No-show prediction for overbooking | Depends on patient, slot, weather, lead time | Logistic regression or trees | Appointments; 6+ months | Calibration; slots filled | M | 7 (replaces the hash stub) |
| Notes to suggested charges and codes | Free text | LLM with the charge master as the only allowed output | Notes; golden cases | Biller acceptance; zero unsupported charges | L | 8 |
| Draft answers to insurer queries | Free text | LLM drafting from the attached record only | Query and record | Acceptance; turnaround | M | 7 |
| The sentence on each number | Language | LLM over the numbers shown only | Metrics | Zero figures not in the data (checked) | S | 2 |
| Plain-language questions | Language | LLM picking catalogue metrics | Catalogue | Golden questions answered exactly | S | 2 (exists, extend) |

**Published evidence (weak, labelled).**
- A boosting model predicted claim-line denials with AUC 0.80–0.82 (conference paper, 2022,
  [record](https://search.bvsalud.org/global-literature-on-novel-coronavirus-2019-ncov/resource/en/covidwho-2013950)).
- A deep model on 2.9 million US claims improved recall at 95% precision ([arXiv 2020](https://arxiv.org/abs/2007.06229)).
- Vendors sell payer-specific denial prediction trained on own history ([Experian](https://www.experian.com/blogs/healthcare/2023/05/ai-advantage-transforming-claim-denials-management/),
  [Waystar](https://investors.waystar.com/news-releases/news-release-details/waystar-advances-ai-leadership-next-generation-denial-prevention)). Vendor claims.
- None of this is Indian data.

**Rules for every model.**
- Top factors shown with every score.
- Drift watched monthly (input mix, acceptance rate, calibration); retrain or roll back.
- **Bias check** on any scorecard that names staff: compare flag rates across shifts, wards and
  staff groups; a scorecard that flags one group more for the same behaviour is not shipped.
- Never auto-post, never auto-deny.

**What we reuse.** `medbrains-ai` (query, redaction, revenue tool), `medbrains-ai-eval` (golden
cases), `ai_redact`, the LLM provider resolver with Ollama. The `predicted_noshow_probability`
column (`noshow_prediction_scores`) is written today by a **hash stub** in
`medbrains-scheduling/src/scheduling.rs`, not a model. It must be labelled "not a prediction" or
removed until wave 7. `predicted_mortality` in ICU is clinical and out of scope here.

**Regulatory.**
- Revenue and operations models are not clinical decision support. They never suggest a
  diagnosis, a drug or a dose.
- CDSCO issued draft guidance on medical device software under the MDR 2017 on 21 Oct 2025
  ([India Briefing](https://india-briefing.com/news/cdsco-draft-guidance-medical-software-40691.html));
  a final version is reported for July 2026 ([Emergo](https://www.emergobyul.com/news/india-cdsco-finalizes-guidance-medical-device-software?linkId=987899634)),
  **not confirmed** on the CDSCO site. Classification follows the software's medical purpose.
  Billing, stock and claim models have no medical purpose; we read them as outside SaMD. Two
  uses sit near the line: suggested charges from notes (reads clinical text but outputs a charge)
  and LOS vs package norm (must never advise discharge). Both stay billing-only in output.
- Clinical prediction (deterioration, readmission) is out of scope and would need a separate
  SaMD assessment.
- DPDP: scorecards that profile staff, and capture-rate offers to patients, are processing of
  personal data. Purpose, notice and consent for marketing apply. The DPDP Rules 2025 were
  notified on 13 Nov 2025 ([SCC Online](https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/));
  the Act has no explicit anonymisation exemption ([Vidhi](https://vidhilegalpolicy.in/wp-content/uploads/2025/04/Vidhi-DPDP-Rules-Submission-to-MeitY-1.pdf)).

---

## 9. Permissions

Names only. Each will be defined in `crates/medbrains-core/src/permissions.rs` with a `///` doc
comment, generated to TypeScript, granted in `access/roles.rs`, guarded on the server and gated
in the UI, per Permissions First. Existing codes are reused where they fit exactly.

| Code | Gates | Notes |
|---|---|---|
| `billing.charge_attention.view` / `.resolve` | Charge kinds in the inbox | **Exists** (#5246) |
| `revenue_integrity.inbox.view` | The inbox, rows of kinds the reader owns | Kind-to-permission map, not one code for all |
| `revenue_integrity.inbox.resolve` | Approve or dismiss a non-charge row | The action itself still needs its own module permission |
| `revenue_integrity.rules.manage` | Turn rules on, set thresholds, leave shadow | Admin |
| `revenue_integrity.recovery.view` | Money-recovered figures | Management |
| `revenue_integrity.scorecards.view` | Per-doctor and per-ward scorecards | Names staff; management and quality only |
| `insurance.enhancement.request` | Raise an enhancement from a used-up row | |
| `insurance.claim_readiness.view` | Bill-ready and document check at discharge | |
| `pharmacy.stock_plan.manage` | Transfer, return or first-out a near-expiry batch | |
| `pharmacy.price_compliance.manage` | NPPA ceiling rows; reprice | |
| `pharmacy.alternatives.recommend` | See and send a cheaper-equivalent proposal | Pharmacist |
| `pharmacy.alternatives.approve` | DTC approval of a formulary switch | DTC |
| `regulatory_watch.view` / `.manage` | Regulator feed rows; parser settings | |
| `procurement.invoice_match.resolve` | Three-way match and price rows | |
| `vendors.proof_of_service.submit` | Vendor app scope for proof upload | OAuth scope on connected apps |
| `vendors.proof_of_service.review` | Review vendor proof | |
| `analytics.board_pack.view` / `.schedule` | Board pack and its schedule | |
| `reports.builder.create` | Save a report built from the catalogue | |
| `reports.schedule.manage` | Schedules and recipients | |
| `reports.share` | Secure share links | |
| `analytics.benchmarks.network.opt_in` | Join the anonymised network | Hospital admin; separate legal sign-off |
| `ai.suggestions.audit.view` | The suggestion log | Audit officer |

Every report and inbox kind is permission-gated like the bricks: a role sees only what its data
permits, **hidden, not greyed**. Patient-level rows follow field classes and masking.

---

## 10. New ideas

**These are ideas, not evidence.** Prior art was searched on 2026-11-08; "none found" means our
search found nothing, not that nothing exists.

| # | Idea | How it stops leakage | Data source | Eff | ₹ | Risk | Prior art |
|---|---|---|---|---|---|---|---|
| N1 | **Bill-ready score before discharge** | Missing charges and documents found while the patient is still there | `final_bill.rs`, inbox, `nhcx_claim_documents.rs` | S | H | Low | No billing readiness score found; only clinical discharge scores ([example](https://ausdoc.com.au/news/doctor-duos-ai-that-uses-vital-signs-and-ward-notes-to-accelerate-discharge-rolled-out-in-hospitals)). **Wave 2.1** |
| N2 | **Pre-auth used-up alert** | Enhancement asked before the bill passes the approval | `nhcx_preauth.rs` | S | H | Low | Manual practice only; no Indian HMS feature page found. **Wave 1.3** |
| N3 | **Money-recovered counter** | Proves value; keeps the desk working the inbox | Inbox | S | — | Low | None found in Indian vendors. **Wave 1.1** |
| N4 | **Record-against-bill diff** | Every event with no charge, and every charge with no event (also catches over-billing) | Orders, MAR, notes vs invoice lines | M | H | Over-billing found must be reversed, not hidden | Epic charge reconciliation workqueues ([HFMA deck 2026](https://www.hfma.org/wp-content/uploads/2026/01/gapstogains-jan2026-revcyclefinanceconference-mari.pdf)). Wave 4 |
| N5 | **Rule shadow mode** | Shows ₹ a rule would find before anyone acts | Inbox | S | — | Low | None found. **Wave 1.1** |
| N6 | **Regulator watch matched to stock, Rx and tariff** | Recall, ceiling and rate changes act on our data the day they publish | §3.6 | M | M | Parser errors; official sources only | None found in Indian HMS. Waves 3 and 6 |
| N7 | **Vendor proof of service in the vendor app** | Invoice matched to signed counts and photos | `medbrains-connected-apps` | M | H | Vendor data quality | None found for hospital facility vendors. Wave 5.2 |
| N8 | **Claim pre-check learned from own denials per payer** | Fix before sending | Claims history | M | H | Needs history | [Experian](https://www.experian.com/blogs/healthcare/2023/05/ai-advantage-transforming-claim-denials-management/), [Waystar](https://investors.waystar.com/news-releases/news-release-details/waystar-advances-ai-leadership-next-generation-denial-prevention) (US). None in India. Wave 7 |
| N9 | **Shift-close cash match** across cash, UPI soundbox, card terminal | Tender differences found per shift | `settle.rs`, `cash_closing.rs` | M | M | Low | Common in retail POS; none found as a hospital feature. Wave 4.5 |
| N10 | **Per-doctor and per-ward leakage scorecards** (nudges) | Shows where charges drop | Inbox | S | M | Staff profiling: DPDP, bias check, management only | None found. After wave 2 |
| N11 | **Process mining on the audit log** | Finds the step where charges drop out | `audit_log` (#4859 planned) | M | M | Aggregate only | [Celonis](https://celonis.com/solutions/industries/healthcare-providers); [IJPMB 2023](https://ideas.repec.org/a/ids/ijpmbe/v13y2023i2p212-232.html). None in India. Wave 8 |
| N12 | **Bedside barcode capture** in nursing and MAR | Use and charge recorded in one scan | MAR in `medbrains-ipd` | M | M | Nurse time | US point-of-use systems ([Infor](https://docs.infor.com/mscm/2025.x/en-us/mscmolh/pouug/xyi1537941729925.html), [Tecsys](https://www.tecsys.com/solutions/healthcare-point-of-use)). None found in India. Wave 8 |
| N13 | **Smart cabinets tied to a patient** | Items out are charged to that patient | Device bridge | L | M | Hardware cost | [BD Pyxis](https://www.bd.com/en-uk/products-and-solutions/products/product-families/bd-pyxis-medstation-es-system); no named Indian deployment. Wave 8 |
| N14 | **RFID linen per ward and laundry vendor** | Missing items flagged per ward and vendor | `housekeeping.rs` | L | M | Tag cost | Tags sold in India ([vendor](https://www.indianbarcodecorporation.com/rfid-laundry-tags)); no named Indian hospital. Wave 8 (count-based AS1 first) |
| N15 | **Notes and voice to suggested charges** | Procedures in text get billed after a doctor approves | Clinical notes | L | H | Over-billing if unchecked; never auto-post | Computer-assisted coding exists ([Optum Integrity One](https://business.optum.com/en/operations-technology/revenue-cycle-management.html)); an India-founded coding start-up ([report](https://indianstartupnews.com/funding/genai-native-autonomous-medical-coding-platform-arintra-raises-21-million-in-funding-9655647)). Wave 8 |
| N16 | **Patient wallet across the hospital's pharmacy, lab and OPD**, with refill reminders | Brings back Rx and tests that leave | Pharmacy repeats, delivery, OPD | M | M | **Legal**: inducement rules, Schedule H discounts not researched, DPDP marketing consent | Retail pharmacy loyalty exists (§11.2). Held for legal review (Q9) |
| N17 | **Network benchmarks and near-expiry exchange** (opt-in, anonymised) | "You pay 18% above the median for this drug"; sell near-expiry stock to another hospital | Network aggregates | L | H | **Competition law**: the 2023 hub-and-spoke proviso makes sharing current prices risky ([AZB](https://www.azbpartners.com/bank/hub-and-spokes-cartels-codification-and-challenges/)); use aggregated, lagged, anonymised data only. DPDP has no clear anonymisation standard | [ECRI PriceGuide](https://prnewswire.com/news-releases/ecri-institute-releases-priceguide-50-to-drive-greater-supply-cost-savings-for-hospitals-and-health-systems-300211463.html), [short-dated drug marketplace](https://www.businesswire.com/news/home/20181203005092/en/). None in India. Wave 8, after legal opinion |
| N18 | **Per-department meters** (power, oxygen, water) on the OS hardware | Utility use per department vs usual | `medbrains-facilities`, device bridge | L | M | Hardware | Cylinder IoT research in India ([archive](https://archives.christuniversity.in/items/show/10547)). Wave 8 |

**Cut from the list:** none outright. N16 and N17 are held behind legal review. N13 and N18
need hardware and come last.

---

## 11. Benchmarks beyond Indian HMS vendors

### 11.1 Optum (global revenue-integrity benchmark)

| Capability | What we verified | Fits India? | Our register / wave |
|---|---|---|---|
| **Integrity One**: middle revenue cycle platform for coding, documentation integrity, revenue integrity; autonomous or partly autonomous coding with a human for complex cases | Optum RCM page (fetched) lists it; launch report ([Becker's](https://www.beckershospitalreview.com/finance/optum-launches-ai-powered-rcm-platform-for-hospitals)) | Partly. India bills packages and ICD, not CPT. We never code autonomously | CC7, N15; wave 8 |
| **Acuity** revenue-cycle analytics: denial analytics, standard and custom reports | [Product page](https://business.optum.com/en/operations-technology/revenue-cycle-management/analytics/acuity-revenue-cycle-analytics.html) (search result). Cash forecasting **not verified** | Yes | §5, IN14; waves 4 and 7 |
| **Denial-prevention edits** | Optum RCM page (fetched): "$4.3M average cost avoidance based on denial prevention edits"; "$1.1M average unbilled revenue identified per client, per year"; "~$75B net patient revenue managed". The "$70B cost avoided" figure is **not** on the page | Yes, as PMJAY/CGHS/ECHS/TPA rules instead of US payer edits | IN4, IN5, IN7, IN10; waves 1–6 |
| **Relay Assurance**: automated claim edits plus payer-specific modifiers | Vendor case study ([casestudies.com](https://www.casestudies.com/company/optum/case-study/clean-claims-insight-into-denial-sources-spur-billing-efficiency-for-a-central-california-hospital)) | Yes, as per-payer document and package checks | IN7, IN10 |
| **Optum Real**: real-time payer–provider APIs (eligibility, claim pre-check, prior auth, document search) | [Sell sheet](https://marketplace.optum.com/content/dam/change-healthcare/marketplace-assets/optum-real/optum-real-apis-for-medical-providers-sell-sheet.pdf) (search result) | **NHCX is the Indian analogue** and is built in `medbrains-facilities/src/nhcx_*` | IN1–IN13 |
| Payment integrity on the payer side (contract errors, overpayments) | **Not verified**; our search found nothing | Payer side, not ours. The hospital-side mirror is short-payment reconciliation | IN12 |
| Optum India | A capability centre supporting the US business; its brochure lists claims among service areas ([search](https://www.optum.in/content/dam/optum3/optum/india/resources/Optum%20overview%20in%20India_final%20Aug%202023_digital.pdf)). The overview PDF given did not load | No Indian hospital or TPA product found | — |

**Where we go beyond Optum.** Optum works from claims and documentation. The OS also sees the
bedside, the stores, the vendors, linen, utilities and staff. Leaks such as ward stock used and
not charged (CC3), near-expiry stock (PH2), laundry counts (AS1), BMW weight (AS6), contract staff
(VN4) and DG diesel (OD2) are invisible to a claims-only system.

### 11.2 Retail pharmacy benchmark (Apollo Pharmacy / Apollo HealthCo)

Named at the owner's request as a business benchmark for pharmacy, not as a client.

| Claim | What we verified |
|---|---|
| Private label and generics share of pharmacy revenue | 15.6% (Q4 FY25), 16.7% (Q2 FY25), 14.6% (Q1 FY26), from earnings-call transcripts found by search ([Q4 FY25](https://mediacdn.apollohospitals.com/sites/default/files/2025-06/transcript-of-apollo-hospitals---q4-fy25-earnings-call---1-.pdf), [Q2 FY25](https://mediacdn.apollohospitals.com/sites/default/files/2025-02/transcript-of-apollo-hospitals-q2-fy25.pdf)). The March 2024 investor deck returned 403; the 16.1% figure is **not verified** |
| Keimed merger for supply chain | HealthCo to merge with Keimed to strengthen supply-chain reach; listing planned by Q4 FY27; about ₹25,000 cr revenue target ([Digital Health News, Aug 2025](https://www.digitalhealthnews.com/apollo-healthco-keimed-merger-targets-inr-25-000-cr-revenue-by-fy27), fetched). Procurement as a purpose is **not stated** in that article |
| Technology-led delivery and procurement savings | The cited article returned 403. **Not verified** |
| CIRCLE membership | Prices conflict: ₹199 for 12 months in one article, ₹199 for 6 months and ₹299 for 12 in an FAQ (search results; the given blog URL returned 404). Cashback as Health Credits; free delivery; consultation discounts; a co-branded SBI card credits cashback as Health Credits ([card page](https://www.apollo247.com/apollo-sbi-credit-card)) |
| AI demand forecasting | No public evidence. A 2014 case study reports that forecasting did not factor in the SCM process at the time ([JSCMS 2014](https://publishingindia.com/archive/jscms/demand-forecasting-for-the-indian-pharmaceutical-retail-a-case-study), fetched) |

**Lessons for a hospital.** Measure prescription capture (PH8) and lab capture (PH9). Set a
generic and formulary-preferred share per department (PH16). Price benchmarks across purchasers
(N17). A wallet (N16) only after legal review.

---

## 12. Report centre

Builds on `medbrains-reports`, `medbrains-analytics`, `management_kpis` and the widget picker.
No second catalogue, no second engine.

### 12.1 Breadth: templates over one catalogue

A report is a metric viewed one way: **list, trend, breakdown, ranking, exception, forecast**.
So the count is metrics × views, not hand-built screens.

| Area | Metrics planned | Views each | Report views | Built today (definitions in `reports.rs` / KPIs) |
|---|---|---|---|---|
| OPD and front office | 14 | 6 | 84 | footfall, queue wait, no-show, unbilled %, wait/consult minutes |
| IPD, bed, nursing | 14 | 6 | 84 | census, occupancy, ALOS, discharge TAT, bed turnaround |
| ER | 6 | 6 | 36 | volume |
| OT | 8 | 6 | 48 | utilisation, cancellations |
| ICU | 6 | 6 | 36 | — |
| Lab | 10 | 6 | 60 | TAT, critical values, sample rejections |
| Radiology | 6 | 6 | 36 | TAT |
| Pharmacy | 14 | 6 | 84 | sales, stock at risk |
| Blood bank | 6 | 6 | 36 | — |
| Billing and counter | 12 | 6 | 72 | department revenue, doctor revenue |
| Insurance and claims | 14 | 6 | 84 | NHCX SLA (`nhcx_sla.rs`) |
| Finance | 8 | 6 | 48 | daily revenue |
| Stores and purchase | 12 | 6 | 72 | vendor performance |
| HR and payroll | 8 | 6 | 48 | credential expiry |
| Quality and NABH | 12 | 6 | 72 | NABH indicators, CAPA ageing, HAI, hand hygiene |
| Infection control | 6 | 6 | 36 | HAI rate |
| Statutory registers | 10 | 2 (list, export) | 20 | NDPS/H1 registers, BMW, MLC (print-data) |
| Engineering and utilities | 8 | 6 | 48 | BME uptime |
| Housekeeping, laundry, diet, CSSD | 8 | 6 | 48 | — |
| Vendors | 8 | 6 | 48 | vendor performance |
| Marketing and referrals | 6 | 6 | 36 | acquisition (`acquisition.rs`) |
| Patient experience | 6 | 6 | 36 | — |
| Doctors' own performance | 8 | 6 | 48 | management doctors (`management_doctors.rs`) |
| **Total** | **220** | | **about 1,240** | **79 definitions (25 live) + 18 KPIs** |

The 220 metric count is a plan, not a build. It is the number to track.

**Coverage against competitor categories** (from the vendor pages in §1.5):

| Category | MocDoc | Insta | KareXpert | Caresoft | MedBrains plan |
|---|---|---|---|---|---|
| Front office / registration | ✓ | | | | ✓ |
| OPD, waiting, appointments | | ✓ | | | ✓ (partly built) |
| IPD, bed, discharge | | ✓ | | ✓ | ✓ (partly built) |
| Billing and collections | ✓ | ✓ | | | ✓ |
| Insurance / TPA, dues ageing | | ✓ | | | ✓ plus lifecycle leaks |
| Pharmacy | | ✓ | | | ✓ plus capture and expiry |
| Stores / inventory | ✓ | ✓ | | | ✓ |
| Lab / radiology | ✓ | ✓ | | ✓ | ✓ (built) |
| OT | | | | | ✓ (built) |
| MIS / BI | ✓ | | ✓ | ✓ | ✓ layers 1–3 |
| Doctor revenue share / payouts | | | | | ✓ |
| HR / payroll | | | | | ✓ |
| Statutory / regulatory | | ✓ (waiting time) | | ✓ (general) | ✓ NABH, BMW, NDPS, MLC |
| Finance / accounting | ✓ | | | | ✓ |
| CRM / patient experience | | ✓ | | | ✓ |
| Support services (maintenance, linen, diet, ambulance) | | ✓ | | | ✓ |
| Ranked leakage with ₹ and action | | | | | ✓ (§6) |
| Usual-day comparison | | | | | ✓ (built for 18 KPIs) |

### 12.2 Fresh ideas beyond static reports

| Idea | What it does | Builds on |
|---|---|---|
| What changed since yesterday | The system finds the biggest moves itself | Usual-day baselines |
| Anomaly alert on any metric | Flags a departure from the usual day | Baselines; §8 |
| "Why" drill-down | Breaks a change into its top dimensions automatically | Catalogue dimensions |
| Cohort and funnel | Enquiry → OPD → admission → discharge → paid, with drop-off | Marketing funnel; billing |
| Patient-flow and bottleneck map | Wait time per step | Flow (`medbrains-flow`), queues |
| Doctor and department scorecards | Nudges, with a bias check | Management doctors |
| Forecasts | Occupancy, cash, stock | §8 |
| Ask a question | Answers with a chart and its rows | `medbrains-ai/src/query.rs` |
| Saved views and subscriptions | Per user | Report schedules |
| Threshold alerts | Per user, per metric | Notifications |
| Favourites per role | 6–8 tiles per role | Widget picker |
| Reports you never open | Suggests removing unused subscriptions | Report-open log |

### 12.3 A clean screen

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Reports   [ Find a report or ask a question ...                         ]    │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ For you       │  Billing desk home                                           │
│ Favourites    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ OPD           │  │ Open leaks   │ │ Unbilled     │ │ Pre-auth     │         │
│ IPD           │  │ ₹3.2 L  48   │ │ orders  17   │ │ used up  6   │         │
│ Pharmacy      │  └──────────────┘ └──────────────┘ └──────────────┘         │
│ Insurance     │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ Stores        │  │ Discharges   │ │ Refunds vs   │ │ Cash diff    │         │
│ Quality/NABH  │  │ not bill-    │ │ usual  ▲12%  │ │ today ₹0     │         │
│ Statutory     │  │ ready  4     │ │              │ │              │         │
│ Engineering   │  └──────────────┘ └──────────────┘ └──────────────┘         │
│ Vendors       │                                                              │
│ …             │  Subscriptions · Scheduled · Never opened (3)                │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

One report page: headline sentence, then chart, then table.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Insurance  ·  Claim denials by payer          Date ▾  Dept ▾  Payer ▾  ⋯   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Denials rose to 7.2% from a usual 6.1%. One payer's room-rent cuts explain   │
│ ₹2.3 L of the ₹3.1 L rise.          [Open 9 claims]  [Check room rule]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bar chart: denial % by week, zero baseline, usual band shaded, labelled      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Payer · claims · denied · ₹ denied · top reason · vs usual                   │
│ Metric: insurance.denial_rate · owner: insurance desk · refreshed 10:05      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules: one search box; 6–8 role tiles; a quiet side list; the same filters everywhere (date,
department, payer); Carbon layout and dataviz rules; WCAG 2.2 AA (keyboard, focus, table
alternatives, colour never alone). Built from the `@/components/ui` seam and `@mantine/charts`.

### 12.4 Permissions

Every report is gated like a brick. A role sees only reports over data it may see, hidden not
greyed. A report's query is not issued without the permission (authz law rule 8). Patient-level
rows follow field classes and masking. An outage shows as unknown, never as an empty list.

---

## 13. Scenarios for wave 1

**1.1 Leakage inbox**
- Given an OT completion whose charge failed, When it is queued, Then it appears in the inbox as
  `charge_not_posted` with the amount, the OT record as evidence, owner "billing desk", and the
  action "post charge".
- Given a billing clerk without `revenue_integrity.inbox.view`, When they open Billing, Then they
  see the charge kinds they already see under `billing.charge_attention.view`, and no stock or
  vendor kinds, and the stock kinds are not fetched.
- Given a row posted from the inbox, When the invoice is later settled, Then `recovered_amount`
  is filled and the month's recovered counter rises by that amount; it does not rise when the row
  is only posted.
- Given a rule whose query fails, When the inbox loads, Then the rule's count shows "could not
  check" with the time, not zero.

**1.2 Stock used on a patient, not charged**
- Given a nurse records two IV sets from ward stock for an admitted patient, When the consumption
  is saved, Then a charge is posted through `charge_or_queue`, and if the charge cannot post, a
  row is queued in the same transaction and the clinical record still saves.
- Given a consignment implant recorded as used with no patient, When it is saved, Then an inbox
  row "implant used, no patient" is created for stores with the vendor and batch.
- Given a consignment implant used on a patient, When the month closes, Then the vendor usage
  report lists it with the patient pseudonymised, and any used implant missing from the vendor's
  invoice becomes a row.
- Given auto-billing for ward stock is off for the hospital, When stock is consumed, Then no
  charge and no row are created.

**1.3 Pre-auth used up**
- Given an approved pre-auth of ₹1,00,000 and a running bill that reaches ₹80,000, When the
  next charge posts, Then one row "pre-auth 80% used" goes to the insurance desk with the
  approved amount, running bill and a one-click enhancement request.
- Given the row is already open, When more charges post, Then the row's amount updates; no second
  row is created.
- Given an enhancement is approved, When the callback arrives, Then the row closes and the
  approved increase is recorded as recovered.
- Given the payer's approval cannot be read, When the check runs, Then the row says "approval
  unknown", not "within limit".

**1.4 Room eligibility**
- Given a policy room limit of ₹5,000 a day and an admission to a ₹8,000 room, When the bed is
  assigned, Then the desk sees a warning before saving, and an inbox row records the expected
  proportionate cut on the estimated bill.
- Given the patient signs consent to pay the difference, When it is recorded, Then the row closes
  with that evidence.
- Given a cash patient, When the bed is assigned, Then no check runs.

**1.5 Near-expiry plan**
- Given a batch with 60 days to expiry, 400 units in stock and a use rate of 3 a day in its store,
  When the nightly check runs, Then a row offers: move 120 units to a store using 5 a day, and
  return the rest inside the vendor's return window, with the ₹ value of each.
- Given the vendor's window has passed, When the row is built, Then "return" is not offered.
- Given an NDPS batch, When a return is chosen, Then the NDPS register and second-witness rules
  apply as they do today.
- Given a batch already expired, When the check runs, Then it goes to the existing expired list,
  not to this plan.

---

## 14. Open questions for the owner

| # | Question | Why it matters |
|---|---|---|
| Q1 | Rename `charge_attention_items` to a general name, or keep the name and add `kind`? | Keeping avoids churn; renaming reads better |
| Q2 | The pre-auth alert threshold: 80% of the approved amount, or set per payer? | Too early is noise; too late is a write-off |
| Q3 | Can we get the PMJAY HBP manual, CGHS/ECHS rate files and TPA tariffs in a form we may load? | IN10 (wave 6) depends on it |
| Q4 | Shadow period per rule: 14 or 30 days? | Proof vs speed |
| Q5 | The bedside consumables: does the hospital want auto-billing of ward stock on by default? | CC3 bills the patient for items they used |
| Q6 | Referral payouts (PE2): flag only, or block until a compliance officer approves? | MCI 2002 cl. 6.4.1 |
| Q7 | Network benchmarks (N17): seek a legal opinion on competition law and DPDP before any design? | Hub-and-spoke risk |
| Q8 | The no-show stub: label it "not a prediction" now, or remove the field until wave 7? | It shows a number that is not a model |
| Q9 | Patient wallet (N16): seek legal review on inducements, Schedule H discounts and DPDP first? | Not researched |
| Q10 | DuckDB for history: ship it inside the OS image, or only on larger installs? | Size budget |
| Q11 | Who owns cost allocation for cost per patient-day: finance or each department? | It needs a method before the number shows |

---

## 15. Sources

All accessed 2026-11-08. "Fetched" means the page itself was read. Others were read from search
results or a secondary report and are labelled where used.

**Insurance and schemes**
- https://moneylife.in/article/health-insurance-claims-worth-rs2603765-crore-rejected-by-insurers-in-fy2324-govt/76282.html
- https://medicaldialogues.in/news/health/129-per-cent-of-claims-rejected-by-health-insurance-companies-during-fy24-140774
- https://business-standard.com/industry/news/health-insurers-disallowed-claims-worth-rs-15-100-cr-during-fy24-irdai-124123000562_1.html
- https://www.businesstoday.in/personal-finance/insurance/story/health-insurance-claim-rejections-by-insurance-companies-went-up-by-1910-in-fy24-458593-2024-12-26
- https://www.businesstoday.in/amp/personal-finance/insurance/story/insurance-claims-over-50-health-cover-claims-faced-rejection-or-partial-approval-says-survey-459394-2025-01-02
- https://zendy.io/title/10.25259/ijms_13_2019
- https://cafemutual.com/news/press-news/14189-irdai-reviews-list-of-non-payable-items-under-health-insurance
- https://theprint.in/economy/cashless-claims-within-an-hour-and-discharge-from-hospital-in-3-hours-says-irdais-master-circular/2107998
- https://www.theweek.in/news/india/2024/05/30/irdai-issues-new-master-circular-to-make-health-insurance-claims-process-more-seamless.html
- https://rsdebate.nic.in/bitstream/123456789/759227/1/PQ_267_18032025_U2041_p393_p395.pdf
- https://www.businesstoday.in/personal-finance/insurance/story/centre-rejects-356-lakh-fraudulent-claims-under-ayushman-bharat-scheme-check-details-467748-2025-03-12
- https://medicaldialogues.in/news/health/hospital-diagnostics/rs-121-lakh-crore-claims-pending-under-ayushman-bharat-reveals-rti-144237
- https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-021-07448-3/tables/2
- https://cag.gov.in/uploads/download_audit_report/2023/09_Chapter-V-064d22bab412c53.02505839.pdf
- https://www.taxheal.com/ayushman-bharat-yojana-claim-settlement-process-pm-jay.html
- https://www.gconnect.in/cghs-apps/treatment-rates/guidelines/overview
- https://www.gconnect.in/defence-services/echs/echs-advisory-processing-pending-claims-delay-submission.html
- https://www.outlookmoney.com/personal-finance/cghs-rates-revised-for-echs-beneficiaries-healthcare-treatment-at-new-rates-from-december-15
- https://www.staffnews.in/?p=164174
- https://www.echs.gov.in/assets/General%20SOP/SOP%20Online%20Bill%20Processing.pdf
- https://www.incometaxindia.gov.in/w/8/2009-circular-no.-8/2009-dated-24-11-2009
- https://itatonline.org/digest/ttk-healthcare-tpa-pvt-ltd-no-1-v-dy-cittds-2020-195-dtr-209-317-ctr-684-2021-430-itr-134-karn-hc/
- https://www.india-briefing.com/news/section-393-income-tax-act-2025-tds-rules-rates-compliance-guide-44450.html
- https://www.nrces.in/ndhm/fhir/r4/hcx-profile.html
- https://www.nrces.in/download/files/pdf/Implementation_Guide_for_Adoption_of_FHIR_in_ABDM_and_NHCX.pdf
- https://github.com/hcx-project/hcx-specs/blob/v0.8/hcx-domain-specifications/README.md
- https://pib.gov.in/PressReleasePage.aspx?PRID=1948522
- https://mohfw.gov.in/press-info/7558

**Charge capture and benchmarks**
- https://www.hfma.org/revenue-cycle/charge-capture/55358/
- https://www.hfma.org/topics/news/2019/01/62829.html
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2244278
- https://www.hfma.org/revenue-cycle/map/map-keys/
- https://www.hfma.org/revenue-cycle/the-kpis-that-define-revenue-cycle-excellence/
- https://www.hfma.org/wp-content/uploads/2026/01/gapstogains-jan2026-revcyclefinanceconference-mari.pdf
- https://bmjleader.bmj.com/content/5/4/252
- https://webarchive.library.unt.edu/web/20121007054717/http:/www.ahrq.gov/research/jul09/0709RA35.htm
- https://abhaysahukar.substack.com/p/understanding-the-hospital-sector-3bb
- https://cag.gov.in/uploads/download_audit_report/2021/performance%20Audit%20District%20Hospital-15-07-2021%20with%20signature%20-%20Chapter%20VII-0627a35a102be52.60337829.pdf
- https://www.ijcmph.com/index.php/ijcmph/article/download/751/637/2514
- https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf

**Competitors and benchmarks**
- https://www.mocdoc.com/healthcare-data-reporting-analytics (fetched)
- https://www.practo.com/providers/hospitals/insta (fetched)
- https://karexpert.com
- https://caresoft.co.in
- https://business.optum.com/en/operations-technology/revenue-cycle-management.html (fetched)
- https://business.optum.com/en/insights/smarter-revenue-cycle-starts-connected-intelligence.html (fetched; names none of the products)
- https://business.optum.com/en/operations-technology/revenue-cycle-management/analytics/acuity-revenue-cycle-analytics.html
- https://www.casestudies.com/company/optum/case-study/clean-claims-insight-into-denial-sources-spur-billing-efficiency-for-a-central-california-hospital
- https://marketplace.optum.com/content/dam/change-healthcare/marketplace-assets/optum-real/optum-real-apis-for-medical-providers-sell-sheet.pdf
- https://www.beckershospitalreview.com/finance/optum-launches-ai-powered-rcm-platform-for-hospitals
- https://www.optum.in/content/dam/optum3/optum/india/resources/Optum%20overview%20in%20India_final%20Aug%202023_digital.pdf
- https://cdn-aem.optum.com/content/dam/optum3/optum360/resources/PDFs/Optum360_AdvancingTheRevenueCycleTowardADenialFreeFuture_eBook.pdf (fetched; binary, unreadable)
- https://mediacdn.apollohospitals.com/sites/default/files/2025-06/transcript-of-apollo-hospitals---q4-fy25-earnings-call---1-.pdf
- https://mediacdn.apollohospitals.com/sites/default/files/2025-02/transcript-of-apollo-hospitals-q2-fy25.pdf
- https://apollohospitals.com/apollo_pdf/AHEL-Investor-Presentation-March24-INR.pdf (403)
- https://www.digitalhealthnews.com/apollo-healthco-keimed-merger-targets-inr-25-000-cr-revenue-by-fy27 (fetched)
- https://yourstory.com/2025/08/apollos-digital-retail-health-units-post-strong-q1 (403)
- https://www.apollopharmacy.in/blog/article/apollo-247-circle-membership-benefits (404)
- https://www.apollo247.com/apollo-sbi-credit-card
- https://publishingindia.com/archive/jscms/demand-forecasting-for-the-indian-pharmaceutical-retail-a-case-study (fetched)

**Pharmacy, regulators, substitution**
- https://www.pharma-dept.gov.in/sites/default/files/notification%20dpco.pdf
- https://medicaldialogues.in/amp/news/industry/pharma/nppa-uses-pharma-sahi-daam-app-to-track-drug-price-violations-parliament-informed-160780
- https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadAlertsFiles/NSQ%20Alert%20For%20The%20Month%20of%20March-2025.pdf
- https://bwhealthcareworld.com/article/nmc-puts-new-regulations-on-docs-in-abeyance-directs-to-follow-old-guidelines-from-2002-488890
- https://www.tribuneindia.com/news/nation/nmc-puts-generic-drugs-order-on-hold-538003
- https://spicyip.com/2016/10/mci-gives-generic-prescription-a-shot-in-the-arm.html
- https://business.medicaldialogues.in/coming-soon-pharmacists-may-be-allowed-to-substitute-branded-drugs-with-generics
- https://india-briefing.com/news/cdsco-draft-guidance-medical-software-40691.html
- https://www.emergobyul.com/news/india-cdsco-finalizes-guidance-medical-device-software?linkId=987899634

**Wastage, vendors, departments**
- https://pubmed.ncbi.nlm.nih.gov/27153160/
- https://www.ajmc.com/view/size-matters-when-it-comes-to-cancer-drug-vials-and-healthcare-waste-says-bmj-study
- https://mdpi-res.com/d_attachment/ijerph/ijerph-16-04330/article_deploy/ijerph-16-04330.pdf
- https://odt.co.nz/node/129122
- https://www.apqc.org/resources/benchmarking/open-standards-benchmarking/measures/percentage-total-annual-number
- https://cfo.com/news/metric-of-the-month-detect-and-prevent-duplicate-or-erroneous-payments/656852/
- https://www.ivey.uwo.ca/media/kjljj5cy/2024-report-to-the-nations.pdf
- https://info.worldcc.com/contract-management-aug-2025
- https://taxguru.in/goods-and-service-tax/claim-itc-gstr-2b-mandatory-w-e-f-01-01-2022.html
- https://www.terra-insight.com/insights/section-17-5-blocked-itc-hospitals-healthcare-services-india
- https://studycafe.in/tds-rate-chart-for-fy-2026-2027-under-income-tax-act-2025-420727.html
- https://dste.py.gov.in/ppcc/pdf/Guidelines/Guidelines_for_Bar_Code_System_for_HCFs_and_CBWTFs.pdf
- https://ppcb.punjab.gov.in/media/documents/Form_IV_BMW.pdf
- https://treelife.in/compliance/related-party-transactions-section-188/
- https://assets-bg.gem.gov.in/resources/pdf/Sellers_Suspended_Archive_List.pdf
- https://www.rfhha.org/images/law/2.2%20Indian%20medical%20council%20(professional%20conduct,%20etiquette%20and%20ethics)%20regulations%202002.pdf (text read)
- https://www.taxmann.com/post/blog/referral-fee-paid-to-doctors-for-referring-patients-not-deductible-hc-follows-apex-lab-ruling/
- https://cgit.labour.gov.in/sites/default/files/Cgit%202%20Delhi%20order%20dated%2018.11.2025%20Brij%20Laxmi%20vs.%20Faridabad.pdf
- https://future.indiankanoon.org/doc/515903/
- https://www.ndmc.gov.in/departments/Departments/Finance/nodal_cell/CPWD%20Works%20Manual%202022.pdf
- https://www.depco.com/faq/diesel-generator-efficiency/
- https://www.ncrpb.nic.in/NCRBP%20ADB-TA%207055/repository/pdf/clause/clause2.2.8.3c.pdf
- https://beeindia.gov.in/sites/default/files/Scheme%20for%20Hospital%20Building%20Star%20Rating.pdf
- https://www.nhm.gov.in/New_Updates_2018/Om_and_orders/covid19/DO_AS%26MD_18_APR.pdf
- https://www.beckershospitalreview.com/finance/the-average-1-500-bed-hospital-prints-96m-pages-each-year-at-a-cost-of-3-8m
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11180717/
- https://www.flexera.com/blog/it-asset-management/the-importance-of-it-asset-management-flexera-state-of-itam-report/
- https://english.madhyamam.com/kerala/2015/mar/23/cag-finds-loopholes-running-108-ambulance-services
- https://saiindia.gov.in/uploads/download_audit_report/2017/Chapter_3_COMPLIANCE_AUDIT_of_Puducherry_Report_No_1_of_2017_on_Union_Territory.pdf
- https://www.pressreader.com/india/hindustan-times-jalandhar/20200523/281792811228138

**ML, prior art, law**
- https://search.bvsalud.org/global-literature-on-novel-coronavirus-2019-ncov/resource/en/covidwho-2013950
- https://arxiv.org/abs/2007.06229
- https://www.experian.com/blogs/healthcare/2023/05/ai-advantage-transforming-claim-denials-management/
- https://investors.waystar.com/news-releases/news-release-details/waystar-advances-ai-leadership-next-generation-denial-prevention
- https://ausdoc.com.au/news/doctor-duos-ai-that-uses-vital-signs-and-ward-notes-to-accelerate-discharge-rolled-out-in-hospitals
- https://celonis.com/solutions/industries/healthcare-providers
- https://ideas.repec.org/a/ids/ijpmbe/v13y2023i2p212-232.html
- https://docs.infor.com/mscm/2025.x/en-us/mscmolh/pouug/xyi1537941729925.html
- https://www.tecsys.com/solutions/healthcare-point-of-use
- https://www.bd.com/en-uk/products-and-solutions/products/product-families/bd-pyxis-medstation-es-system
- https://www.indianbarcodecorporation.com/rfid-laundry-tags
- https://indianstartupnews.com/funding/genai-native-autonomous-medical-coding-platform-arintra-raises-21-million-in-funding-9655647
- https://prnewswire.com/news-releases/ecri-institute-releases-priceguide-50-to-drive-greater-supply-cost-savings-for-hospitals-and-health-systems-300211463.html
- https://www.businesswire.com/news/home/20181203005092/en/
- https://archives.christuniversity.in/items/show/10547
- https://www.azbpartners.com/bank/hub-and-spokes-cartels-codification-and-challenges/
- https://www.scconline.com/blog/post/2025/11/14/meity-notified-digital-personal-data-protection-rules-2025/
- https://vidhilegalpolicy.in/wp-content/uploads/2025/04/Vidhi-DPDP-Rules-Submission-to-MeitY-1.pdf
