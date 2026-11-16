# RFC-MODULE: Quality indicators and benchmark network

| | |
|---|---|
| Status | **Draft, design only.** No product code in this PR |
| Date | 2026-11-16 |
| Owner decision | Approved as MedBrains' lead data idea on 2026-11-16 |
| Brick | `quality` (base plate, `medbrains-core/src/bricks.rs` `BASE_PLATE`) |
| Related | `docs/architecture/MODULE-BRICKS.md`, `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md`, `docs/OS-PRINCIPLES.md` |

**This is not a medical device.** Every figure is a hospital-level count, rate or time. Nothing here
gives advice about an individual patient, ranks patients or predicts an outcome for one. Drill-down
lists the source records behind a figure so a quality manager can check it. It does not interpret
those records.

---

## 1. The problem and who has it

A NABH-accredited hospital reports 32 organisation-wide KPIs every month, plus the department KPIs
for each specialty it runs (NABH 6th edition, KPI annexure, from page 202). In most hospitals a
quality manager builds them by hand from registers, spreadsheets and ward diaries. That takes days.
The figures cannot be traced back to records, and a register nobody filled in reads as a perfect
month.

MedBrains already holds most of the timestamps, coded events and registers these indicators need
(section 5). The hospital should get the figures without assembling them by hand. They should be
traceable to their source records, and they should say honestly when the data is not there.

| User | What they need |
|---|---|
| **Quality manager** (PSQ / quality-cell lead) | The monthly figures without collating them by hand; to know which figures rest on thin or missing data; to fix the source records, not the figure; to sign off and print the monthly report |
| **Medical superintendent / management** | One screen showing the month, the trend and what is off target; comparison with similar hospitals, if the hospital opts in |
| **NABH assessor** (during an assessment) | To see how each figure is defined, the numerator and denominator, the source records behind a figure (read-only, on site), and evidence that the method stayed the same month to month |
| **Department heads** | Their department's slice of each figure |
| Later: **insurer / TPA / government scheme** | A hospital-level quality report, released by the hospital with its consent (phase 4, out of scope now) |

## 2. Scope and non-goals

**In scope:**
- An indicator catalogue mapped to NABH 6th edition. Indicators are versioned, and each has an
  exact definition.
- Computation on the hospital's own box: scheduled, incremental, idempotent and reproducible.
- A dashboard, an indicator detail page with drill-down, and the monthly report as print and PDF.
- **Opt-in** benchmarking. Only anonymous, hospital-level aggregates leave the box, with
  suppression rules applied, and only after the hospital approves each send.

**Non-goals:**
- Any patient-level output, prediction, risk score or alert. Alerts on individual events stay in
  their own modules.
- Sending anything patient-level off the box, ever, for this feature.
- The insurer, TPA and scheme reports (phase 4). These get their own RFC and consent design.
- NABL, AERB and other non-NABH programmes beyond the JCI/IPSG extras listed in section 5.3.
- Ranking named hospitals publicly. The benchmark shows peer distributions, never another
  hospital's value.

## 3. Regulatory frame

| Norm | What it requires here | Design response |
|---|---|---|
| **NABH 6th edition, PSQ 3a–3d + KPI annexure** (official PDF, portal.nabh.co, effective for new applications from 1 Jan 2025) | 32 organisation-wide KPIs, monthly. Department KPIs are mandatory when the specialty is in scope. HIS/EMR must at least allow manual numerator and denominator entry. Department KPIs count inpatients unless stated | The catalogue mirrors the annexure numbering. A **manual-entry fallback** exists for every indicator. Department KPIs are `not_applicable` when the specialty brick is off |
| **NABH 5th edition** (2020) | Widely cited as 33 core KPIs. **UNCONFIRMED**: the annexure was not readable today | Hospitals still on 5th-edition cycles get a mapping table in slice 7, once the 5th-edition text is read |
| **JCI QPS / IPSG** | JCI has no fixed mandatory list. Hospitals choose their QPS measures; IPSG measures are expected. **UNCONFIRMED**: no JCI source was fetched today | Optional catalogue entries (section 5.3) |
| **DPDP Act 2023 + Rules 2025** | Personal data needs a purpose and a legal basis. Anonymised data is outside the Act, but only if it truly cannot identify anyone. The Fourth Schedule exemption for clinical establishments covers **care only**. Full duties apply from 13/14 May 2027 | On-box computation is the hospital's own quality work (care operations, done by MedBrains as processor). **Benchmarking** makes MedBrains a likely data fiduciary for the aggregate channel (legal landscape, part 7 and Q1). Only aggregates of counts, with no patient attributes, are sent (section 9) |
| **ABDM Health Data Management Policy, draft v2 cl. 29** | Anonymised or aggregated sharing may need an NHA request procedure (draft, not final) | Open question 4 for counsel |
| **Special categories** (MHA 2017, HIV Act 2017, PC-PNDT, MTP Act s.5A, ART Act) | Strict confidentiality | No indicator is stratified by these. Benchmark payloads never carry a diagnosis dimension |
| **Hospital opt-in agreement** | The owner drafts it (legal, not code) | The product records which agreement version was accepted, by whom and when, and refuses to send without a current one |

The legal landscape note (2026-11-16) rates part 7, benchmarking of aggregates, **G** (allowed with
standard compliance) in India, the EU, the UK, the US and Singapore. It rates it **A** (heavy
requirements) in the UAE, Saudi Arabia and Indonesia, where aggregates should stay in-country until
counsel rules. Its design checklist asks for:
- measured, not assumed, anonymity;
- small-cell suppression (it suggests cells below 11);
- per-hospital approval;
- an audit record both sides can see;
- special categories excluded by default.

This RFC adopts all five.

## 4. What exists today (reuse, and what must change)

| Asset | Where | Use | Problem to fix |
|---|---|---|---|
| NABH 6th edition catalogue (50 entries, 32 org + 18 dept) plus about 20 live queries | `crates/medbrains-reports/src/nabh_indicators.rs`, `GET /api/nabh/indicators` | **Starting catalogue.** Its codes match the official annexure, which I checked against the PDF text | (a) `scalar_f64` turns a **query error into `None`**, so a database fault shows as "pending data". That breaks the three-outcome rule (`check-authz-collapse` spirit). (b) Runtime string SQL, not `sqlx::query!`. (c) Current month only; nothing is stored or reproducible. (d) The pressure-ulcer value is "% of assessments", but NABH defines it per 1000 patient-days. (e) It reads other bricks' tables directly |
| Manual indicators and values | `quality_indicators`, `quality_indicator_values` (`0340_quality.sql`), `medbrains-quality`, `/quality` Indicators tab | Manual-entry fallback, kept | `quality_indicators.calculation_query` stores SQL text in a table: an injection surface; retire it. The "auto-calculate" handler counts existing value rows, so it computes nothing; delete it |
| Monthly report print | `medbrains-print-data/src/regulatory.rs` `get_nabh_quality_report_print_data`, print key `nabh-quality-report` | The report's print-data route and template | Its "met" rule is `value >= target` for every indicator, which is **wrong for lower-is-better** indicators (falls, infections) |
| NABH register mirrors | `medbrains-nabh` `mirror_fall_incident`, `mirror_sentinel_incident`, `mirror_transfusion_reaction`, `mirror_pressure_ulcer_from_ipd_assessment`, … | Source registers for falls, sentinel events, transfusion reactions, pressure ulcers, code blue, drills, BMW | — |
| Management KPIs | `medbrains-dashboard/src/management_kpis.rs`, `as_of.rs` | Reuse the **"null, never 0"** rule and the hospital-local day windows | — |
| Two indicator screens | `/admin/nabh-indicators` (live rollup) and `/quality` Indicators tab (manual) | — | Merge into one (section 11) |
| Outbox | `medbrains-outbox` | Durable outbound queue with backoff and a DLQ for benchmark sends | — |
| Print pipeline | `medbrains-documents-render` (Gotenberg on cloud), rustenberg on the OS | Report PDF | — |

## 5. Indicator catalogue

**Status key:**
- **R**: ready. The data is captured today and the formula is computable.
- **S**: needs a small capture change. The screen that would capture it is named.
- **M**: missing. No capture today.

All indicators are monthly. Sources are named as `table.column`; "pd" means patient-days.

Patient-days come from `admissions`: for each admission, its overlap with the month,
`[admitted_at, coalesce(discharged_at, month_end))`.

### 5.1 NABH 6th edition, organisation-wide KPIs (32)

| Id | Name | Formula (num / den) | Data source | Status | Slice |
|---|---|---|---|---|---|
| NABH-01 | Time for initial assessment of indoor patients | Σ minutes from arrival at the ward bed to the doctor's initial assessment / admissions (excl. day care) | `admissions.admitted_at` (proxy for arrival); first `ipd_progress_notes` by the admitting doctor | **S**: add an "arrived on ward" time to the IPD bed-allocation screen, and an `initial_assessment` note type on the IPD case sheet | 3 |
| NABH-02 | Reporting errors per 1000 investigations | amended signed reports / tests reported ×1000 | `lab_result_amendments` / lab results; radiology addenda | **R** for lab; **S** for radiology (a "correction" reason on the radiology addendum screen) | 2 |
| NABH-03 | Diagnostic staff adhering to safety precautions | adherent / audited ×100 | `quality_audits` (generic) | **S**: an audit template "Diagnostic safety" on Quality → Audits | 4 |
| NABH-04 | Medication errors (NCC-MERP) | errors / medication opportunities ×100 | `quality_incidents` where `incident_type='medication_error'`; `ipd_medication_administration` doses as opportunities | **R** (count). **S** for the NCC-MERP category (a field on the incident form) | 2 |
| NABH-05 | Inpatients with an adverse drug reaction | inpatients with an ADR / inpatients ×100 | `adr_reports.patient_id, reaction_date` joined to `admissions` | **R** | 2 |
| NABH-06 | Unplanned return to OT | unplanned returns / patients operated ×100 (30-day lag) | `ot_bookings` (a second booking in the same admission is only a candidate) | **S**: an "unplanned return" flag and reason on the OT booking screen | 3 |
| NABH-07 | WHO safe surgery checklist adherence | bookings with all three phases complete / completed surgeries ×100 | `ot_surgical_safety_checklists.phase, completed`; `ot_bookings.status` | **R** | 2 |
| NABH-08 | Transfusion reactions | reactions / units issued ×100 | `nabh_blood_transfusion_reactions`; `component_issues` | **R** | 2 |
| NABH-09 | ICU standardised mortality ratio | ICU deaths / Σ predicted mortality | `icu_scores.predicted_mortality`; `admissions.discharge_type` | **S**: make an APACHE/SOFA score required at ICU admission (ICU flowsheet) | 4 |
| NABH-10 | Return to ICU within 48 h | ICU readmissions ≤48 h / ICU discharges and transfers out ×100 | `ipd_transfer_logs.from_ward_id, to_ward_id, transferred_at`; `wards.ward_type` | **R**, valid only where wards are typed `icu` (HDU excluded). Otherwise shows "insufficient data" | 2 |
| NABH-11 | Return to emergency within 72 h | returns with a similar complaint / ED visits ×100 | `er_visits.patient_id, arrival_time` | **S**: a "return for the same problem" check on ER registration. Without it only all-cause returns can be computed, shown as a labelled proxy | 3 |
| NABH-12 | Hospital-acquired pressure ulcers | new or worsened ulcers / pd ×1000 | `nabh_pressure_ulcer_assessments.injury_acquired, injury_stage`; pd | **R**. The existing query's denominator must be fixed | 2 |
| NABH-13 | CAUTI | CAUTIs / urinary catheter days ×1000 | `infection_surveillance_events.hai_type='cauti'`, confirmed; `infection_device_days.urinary_catheter_days` | **R** | **1** |
| NABH-14 | VAP | VAPs / ventilator days ×1000 | same tables, `vap`, `ventilator_days` | **R** | **1** |
| NABH-15 | CLABSI | CLABSIs / central line days ×1000 | same tables, `clabsi`, `central_line_days` | **R** | **1** |
| NABH-16 | Surgical site infection rate | SSIs / procedures ×100 (30/90-day window, so revised later) | `ot_case_records.surgical_site_infection, ssi_detected_at`, or `infection_surveillance_events.hai_type='ssi'` | **R** (provisional until the window closes) | 2 |
| NABH-17 | Hand hygiene compliance | compliant / opportunities ×100 | `hand_hygiene_audits.compliant, non_compliant` | **R** | **1** |
| NABH-18 | Prophylactic antibiotic in the right window | correct timing / surgeries ×100 | `ot_case_records.incision_time`; antibiotic time is free JSON in `ot_anesthesia_records.drugs_administered` | **S**: a structured "prophylactic antibiotic given at" field on the anaesthesia record | 3 |
| NABH-19 | Surgeries rescheduled more than 4 h | postponed, cancelled or started >4 h late / planned ×100 | `ot_bookings.status, scheduled_start, actual_start, postpone_reason` | **R** | 2 |
| NABH-20 | Blood and component issue TAT | Σ minutes from request to issue / units cross-matched | `crossmatch_requests.created_at` → `component_issues.issued_at` | **S**: the request→issue link (`component_issues.request_id`) must be confirmed and kept on the blood bank issue screen | 4 |
| NABH-21 | Nurse:patient ratio per shift | nurses on shift / occupied beds | `nurse_shift_assignments`; occupancy (`beds.is_occupied` is current only) | **S**: a per-shift occupied-bed snapshot (backend job, read on the Nursing roster screen) | 4 |
| NABH-22 | OPD waiting time to consultant | Σ minutes from check-in to call / outpatients | `opd_queues.created_at, called_at` (live today) | **R**. Caveat: consultant vs resident is not distinguished | 2 |
| NABH-23 | Waiting time for diagnostics | Σ minutes from arrival to sample or scan / outpatients tested | lab and radiology order timestamps | **S**: agree start and stop events, and show them on the sample-collection and RIS worklist screens | 4 |
| NABH-24 | Time taken for discharge | Σ minutes from consultant approval to leaving / discharges | `ipd_discharge_tat_log.doctor_cleared_at, discharge_completed_at` | **R** | 2 |
| NABH-25 | Incomplete or improper consent | defective records / discharges and deaths ×100 | `procedure_consents.status, signed_at` | **S**: a consent-audit checklist on the MRD review screen | 4 |
| NABH-26 | Emergency medication stock-outs | count of instances | none: there is no emergency-drug list or stock-out event | **M**: an "emergency medication" flag on the formulary screen, plus a stock-out event when ward or crash-cart stock reaches zero | 5 |
| NABH-27 | Variations observed in mock drills | count | `nabh_fire_safety_drills`, `compliance_drills` (variations not structured) | **S**: a variations list on the drill record screen | 4 |
| NABH-28 | Patient falls | falls / pd ×1000 | `nabh_falls_register.fall_at`; pd | **R** | **1** |
| NABH-29 | Near misses as share of incidents | near misses / incidents reported ×100 | `quality_incidents.severity='near_miss'` | **R** | **1** |
| NABH-30 | Needlestick injuries | injuries / average occupied beds ×1000 | `needle_stick_incidents`; pd / days in month | **R** | 2 |
| NABH-31 | Appropriate handovers (doctors and nurses separately) | appropriate / audited ×100 | `ipd_handover_reports` (nurse SBAR); no doctor handover record | **S** for nurses (a handover audit on Quality → Audits). **M** for doctors | 5 |
| NABH-32 | Safe and rational prescriptions | rational / audited ×100 | none | **M**: a prescription audit form (sample, criteria) on Quality → Audits | 5 |

### 5.2 NABH 6th edition, department KPIs (18; mandatory only if the specialty is in scope)

Each one is `not_applicable` when its brick is off. Status here was checked at table level only.

| Id | Name | Source brick / table | Status |
|---|---|---|---|
| DEPT-01 | CHF with reduced EF on beta-blocker at discharge | ipd discharge medicines; no EF field | M |
| DEPT-02 | STEMI door-to-balloon ≤90 min | `cath_lab` / `cath_stemi_timeline` | R |
| DEPT-03 | Hypoglycaemia below 54 mg/dl | `hypoglycemia_events` | S |
| DEPT-04 | Spontaneous perineal tear | `maternity` / `labor_records` | S |
| DEPT-05 | Post-operative endophthalmitis | `ophthalmology` | S |
| DEPT-06 | Colonoscopy with sedation | `endoscopy` / `endoscopy_procedures` | S |
| DEPT-07 | Unintentional intra-operative injury requiring intervention | `ot`, no field | M |
| DEPT-08 | POCT results leading to intervention | none | M |
| DEPT-09 | Functional gain after rehabilitation | `pmr` | S |
| DEPT-10 | Sepsis Hour-1 bundle compliance | `sepsis_hour1_bundles.bundle_compliant` | R |
| DEPT-11 | COPD action plan at discharge | none | M |
| DEPT-12 | Stroke door-to-needle ≤60 min | emergency + neurology timestamps | S |
| DEPT-13 | Bronchiolitis inappropriate treatment | none | M |
| DEPT-14 | Oncology treatment after tumour board | none | M |
| DEPT-15 | Radiopharmaceutical adverse reaction | none | M |
| DEPT-16 | IV contrast extravasation | radiology adverse event (unstructured) | S |
| DEPT-17 | Emergency triage time | `er_visits.arrival_time` → `er_triage_assessments.assessed_at` | R |
| DEPT-18 | Dialysis patients at target haemoglobin | `dialysis_sessions` + lab results | S |

### 5.3 JCI / IPSG and supplementary (optional; JCI definitions UNCONFIRMED)

| Id | Name | Source | Status |
|---|---|---|---|
| IPSG-1 | Two-identifier check at medication administration (barcode verified) | `ipd_medication_administration.barcode_verified` | R |
| IPSG-2 | Critical results communicated within the policy time | `lab_critical_alerts`, `radiology_critical_alerts` | R |
| IPSG-3 | High-alert doses double-checked | `ipd_medication_administration.is_high_alert, double_checked_by` | R |
| IPSG-6 | Fall-risk screen within 24 h of admission | `fall_risk_assessments`; `admissions` | R |
| SUP-01 | LAMA/DAMA rate | `admissions.discharge_type in (lama, dama)`; `ipd_dama_records` | R |
| SUP-02 | Inpatient mortality rate | `admissions.discharge_type` | R |
| SUP-03 | 30-day readmission | `admissions`, same patient within 30 days (derived, not the follow-up table) | R |
| SUP-04 | Restraint episodes per 1000 pd | `restraint_documentation` | R |

### 5.4 Counts

| Set | Ready | Small change | Missing | Total |
|---|---|---|---|---|
| NABH organisation-wide | 18 | 12 | 2 | 32 |
| NABH department | 3 | 8 | 7 | 18 |
| JCI/IPSG + supplementary | 8 | 0 | 0 | 8 |
| **All** | **29** | **20** | **9** | **58** |

"Ready" means the columns exist. It does not mean hospitals fill them in. The engine reports
`insufficient_data` until they do (section 6.3).

## 6. Computation design

### 6.1 Where and when

- **On the hospital's box only**, inside its tenant and its RLS.
- A **scheduled job** runs nightly, and also on demand from the screen. It recomputes the open
  months: the current month, plus any month still inside an indicator's **revision window** (SSI
  30/90 days, unplanned OT return 30 days, readmission 30 days).
- A month is `provisional` until its last indicator's window closes. Then it is `final`. A final
  month changes only if a source record is corrected; the change is logged and shown (section 7.3).
- **Incremental:** each source exposes a cheap `max(updated_at)` and row count per month. A month
  whose fingerprint did not change is skipped. Bounded: at most 60 indicators × 4 open months × the
  departments in use per run; every query has a month window and a `LIMIT` on drill-down.
- **Idempotent:** results are upserted on `(tenant_id, indicator_code, definition_version, period,
  department_id)`. Running the job twice gives the same rows.

### 6.2 Sources belong to their bricks

`MODULE-BRICKS.md` says a brick reads another brick's data only through its API or events, never
its tables.

- The engine (in `quality`) defines one small trait in the base plate:
  ```rust
  /// One indicator's numerator, denominator and source record ids for a period.
  trait IndicatorSource { fn code(&self) -> &'static str; async fn compute(&self, tx, period, dept) -> Outcome<Measure>; }
  ```
- **Each source brick implements it in its own crate**, with compile-time `sqlx::query!`. The
  server's composition root registers only the sources of bricks that are on (`with_dependencies`).
- Slice 1 needs no cross-brick read. Falls, incidents, hand hygiene and infection surveillance are
  all base-plate groups (`quality`, `infection_control`).
- The existing `nabh_indicators.rs` queries move into their owning bricks over slices 2–5. The file
  then becomes the catalogue only.

### 6.3 Never 0 when the data is missing

Every computed cell carries one status from a closed set. The UI renders each one differently and
never as a number it does not have.

| Status | Meaning | Shown as |
|---|---|---|
| `computed` | Denominator > 0 and the source is in use | the value |
| `zero_attested` | Numerator 0, denominator > 0, and the register owner recorded a **nil return** for the month ("no falls this month, register reviewed") | `0`, with "nil return by …" |
| `unattested_zero` | Numerator 0, but nobody attested the register | "0 recorded, not attested" (amber), never a green 0 |
| `insufficient_data` | Denominator 0, or the source has no rows at all for the month (e.g. no device-days entered) | "Insufficient data", plus what is missing and the screen that captures it |
| `not_applicable` | The source brick is off, or the specialty is not in scope | "Not applicable", plus the reason |
| `source_error` | The query failed | "Could not compute" and a retry. **Never** shown as pending or empty (three outcomes, `check-authz-collapse`) |
| `manual` | Entered by hand (the NABH-required fallback), with who entered it | the value, with a "manual" badge |

The nil-return attestation is what NABH reviewers actually ask for. Without it, zero falls from a
register nobody uses looks like excellent care.

### 6.4 Storage (one new table; the existing manual tables are kept)

- **`quality_indicator_results`:**
  - `tenant_id`, `indicator_code`, `definition_version`, `period` (month), `department_id` (null =
    hospital);
  - `numerator`, `denominator`, `value`, `status`, `finality` (`provisional` / `final`);
  - `source_fingerprint` (hash of the sorted source ids and their `updated_at`), `source_count`,
    `computed_at`, `engine_version`;
  - RLS.
- **`quality_nil_returns`:** `tenant_id`, `register` (falls, needlestick, …), `period`,
  `attested_by`, `attested_at`.
- Definitions live **in code**, not in a table: code, version, formula text, units, direction,
  target, revision window. A changed definition is a new version, never an edit. The old version's
  results stay, so a past report reprints exactly.

### 6.5 Reproducible

The same `(code, version, period)` over the same source rows gives the same numbers. The
fingerprint proves the inputs did not change. Re-running a final month and getting a different
fingerprint is a logged event ("source corrected after close").

## 7. Drill-down and audit trail

1. **Figure → records.** Clicking a value lists the numerator records and the denominator basis
   (e.g. the 3 falls and the 2,410 pd). Each row opens in its own module's screen through the shell
   ("opening another brick by id"). Lists are paged, 50 rows per page, with a hard cap.
2. **Drill-down is PHI.** It needs `quality.indicators.drilldown`, separate from viewing figures.
   The aggregate view needs no patient access. Records are re-checked per row by the source
   brick's own access check; denied rows are counted but not listed ("4 records you cannot open").
3. **Audit:**
   - each computation run, each manual entry, each nil return, each report sign-off and each
     benchmark send writes an audit row;
   - corrections after a month is final show on the indicator page as a change log (old value, new
     value, which source rows changed).
4. **Assessor mode.** A read-only view of the definition, the method, the version history and the
   drill-down. It is meant for on-site use under a time-limited role grant; there is no external
   link.

## 8. Monthly NABH quality report

- **Reuse** print key `nabh-quality-report` and `/api/print-data/nabh-quality-report/{period}`.
  Re-point it from `quality_indicator_values` to `quality_indicator_results`, falling back to the
  manual entry. **Fix the met rule** so it reads each indicator's direction.
- **Content:**
  - each indicator: value, target, previous 3 months, status (section 6.3), and finality;
  - a coverage summary (n computed, n insufficient, n not applicable);
  - the CAPA references raised against off-target indicators (`quality_capa`).
- **Sign-off:** the quality manager publishes the month (`quality.report.publish`). This freezes a
  snapshot (result ids + fingerprints). A later correction makes a new revision; it never silently
  changes the signed one.
- **PDF:** the existing pipeline (`medbrains-documents-render` in the cloud, rustenberg on the OS).
  Print goes through the shared print template and fonts.

## 9. Benchmark sharing (opt-in)

### 9.1 What is sent: the aggregate schema

One message per hospital per final month:

```json
{
  "schema": "mb.quality.benchmark/1",
  "contributor": "<random 128-bit id generated on the box; not the tenant id>",
  "period": "2026-10",
  "peer": { "beds_band": "100-199", "type": "multi_specialty", "ownership": "private", "region": "IN-South", "nabh_status": "accredited" },
  "engine_version": "…",
  "cells": [
    { "code": "NABH-28", "version": 1, "num": 7, "den": 3120, "status": "computed" },
    { "code": "NABH-13", "version": 1, "num": null, "den": null, "status": "suppressed" }
  ],
  "signature": "<Ed25519 over the canonical body, box key>"
}
```

Only hospital-level totals are sent: no department, no ward, no daily series. `status` uses
section 6.3, collapsed to `computed`, `suppressed`, `insufficient_data` or `not_applicable`; manual
values are flagged.

### 9.2 Suppression and k-anonymity

| Rule | Threshold (proposed; owner and counsel to confirm) | Why |
|---|---|---|
| Small numerator | `1 ≤ num ≤ 10` is sent as `num_band: "1-10"`, not the count | The legal note's "cells below 11". A small count in a small hospital can point to a known event |
| Small denominator | `den` below an indicator-specific floor (e.g. <100 pd, <20 procedures, <20 device-days) → `suppressed` | A rate on a tiny base is noise and can identify |
| Peer k | The service publishes a peer distribution only when **k ≥ 5 distinct contributors** report the cell for that period; otherwise the peer group is widened one level (region → national, bed band → merged bands) and labelled | No hospital can read off one other hospital's value |
| Output | The service publishes only percentiles (p25, p50, p75) and the hospital's own position. It shows no min or max, and never another hospital's value | Min and max reveal single contributors |
| Differencing | Peer groups are fixed per quarter, so repeated slicing cannot isolate one hospital | Differencing attack |

The thresholds are applied **on the box, before sending**. The service checks them again and
rejects a message that breaks them.

### 9.3 Peer grouping

- **Bed band:** <50, 50–99, 100–199, 200–499, 500+.
- **Type:** the edition / `hospital_type`.
- **Ownership:** private, trust, government.
- **Region:** a zone, not a state, where a state would have fewer than 5 contributors.
- **NABH status:** accredited, entry-level or none.

All are coarse, chosen by the hospital at opt-in and shown in the send preview.

### 9.4 Transport

- **Outbound only.** The box sends through `medbrains-outbox` over HTTPS to the benchmark endpoint.
  The service never connects to the box and holds no credential for it.
- Each message is **signed** with the box's key (Ed25519). The service checks the signature and
  `contributor` and rejects replays (`period` + `contributor` is unique; a resend replaces).
- **Hospital-approved each time:**
  1. the job prepares the month's message;
  2. a person with `quality.benchmark.manage` sees the exact JSON in plain language and approves it;
  3. only then is it queued.

  An optional standing approval for later months can be set, but the preview is always shown in the
  monthly report.
- Market gate: off by default in markets the legal note rates **A** (the UAE, Saudi Arabia,
  Indonesia) until counsel clears it.

### 9.5 What never leaves the box

- Patient identifiers, names, UHIDs, ABHA, dates of birth, addresses.
- Any record-level row, including the drill-down lists.
- Department, ward or doctor breakdowns.
- Free text: incident descriptions, reasons, notes.
- Daily or weekly series, and exact timestamps.
- The hospital's name, tenant id, IP-derived location or staff identities. The service sees only
  `contributor` and the coarse peer attributes.
- Any special-category dimension (mental health, HIV, PNDT, MTP, ART).

### 9.6 Opt-in and opt-out

1. **Off by default.**
2. A user with `quality.benchmark.manage` opens Benchmark settings, reads the plain-language "what
   is shared" page, and accepts the **hospital agreement** (the version is recorded). They pick the
   peer attributes, and the first preview is shown.
3. **Opt-out takes effect at once:**
   - the next send is cancelled and nothing more is queued;
   - a signed **withdraw** message asks the service to delete every cell from this `contributor`,
     and the service confirms;
   - the box keeps an audit record of both.

   Re-joining generates a **new** `contributor` id, so old and new contributions cannot be linked.
4. Viewing peer comparisons requires being a contributor (give to get). Hospitals that are not
   contributors see their own indicators only.

## 10. Permissions first

Define these in `crates/medbrains-core/src/permissions.rs` with `///` docs, then:
1. generate the catalogue with `python3 scripts/generate_permissions_ts.py`;
2. grant them in `access/roles.rs`;
3. guard with `require_permission` and gate the screens with `useRequirePermission` /
   `useHasPermission`;
4. pass `make check-permissions check-role-templates`.

| Permission | Meaning | Status | Granted to (proposal) |
|---|---|---|---|
| `quality.indicators.list` | View indicator figures, trends and status | **exists**; reused as the "view" permission | quality manager, medical superintendent, department heads |
| `quality.indicators.manage` | Enter manual values, set targets, record nil returns | **exists** | quality manager |
| `quality.indicators.drilldown` | Open the source records behind a figure (PHI) | **new** | quality manager, infection-control nurse (HAI only, by data class) |
| `quality.report.publish` | Sign off and freeze a month's report | **new** | quality manager |
| `quality.benchmark.view` | See peer comparisons | **new** | quality manager, medical superintendent |
| `quality.benchmark.manage` | Opt in or out, accept the agreement, approve each send | **new** | hospital admin / medical director only (separation of privilege from `publish`) |

The bypass roles see the screens, but approving a send also requires a named individual on
record. The agreement acceptance is never carried out by a bypass role silently.

## 11. Screens (UI plan)

All screens are built from the `@/components/ui` seam, with one `Modal`, no drawers, tokens only,
WCAG 2.2 AA, and light and dark themes. **One home:** the `/quality` Indicators tab becomes the
dashboard; `/admin/nabh-indicators` redirects there and is deleted.

### 11.1 Indicators dashboard (`/quality?tab=indicators`)

- **Gate:** `quality.indicators.list`.
- **Header:**
  - month picker;
  - finality badge (provisional / final);
  - coverage line ("29 computed · 12 insufficient data · 9 not applicable");
  - Publish button (gated `quality.report.publish`) and Print.
- **Body:** a dense table grouped by PSQ 3a–3d. Columns:
  - code, name;
  - value with unit;
  - target and direction;
  - a 6-month sparkline (`@mantine/charts`);
  - status chip, as text plus an icon, never colour alone.
- **States:**
  - loading: the ECG loader;
  - `source_error` rows: a "Could not compute" inline alert with retry;
  - whole-page fault: an error alert, never an empty table;
  - empty tenant: an explanation plus links to the capture screens.

### 11.2 Indicator detail (`/quality/indicators/:code?period=`)

- **Gate:** `quality.indicators.list`.
- **Sections:**
  - definition (formula, version, source, revision window);
  - a 12-month trend with target line and zero baseline;
  - department split;
  - change log;
  - nil-return control (gated `.manage`);
  - manual-entry fallback (gated `.manage`).
- **Drill-down panel:** gated `quality.indicators.drilldown`, and the **query is not issued without
  it**. It is a paged table of numerator records, each opening its source screen. Rows the user
  cannot open are counted, not listed.
- **Insufficient data:** says what is missing and links to the capture screen, e.g. "No device-days
  entered for October: Infection control → Device days".

### 11.3 Monthly report (print preview, `nabh-quality-report`)

- **Gate:** `quality.indicators.list`; Publish is gated `quality.report.publish`.
- **Layout:** a preview in the full-screen `Modal`. Publish shows a confirmation dialog listing the
  insufficient and unattested indicators first.

### 11.4 Benchmark settings and consent (`/quality?tab=benchmark`)

- **Gate:** the tab is visible with `quality.benchmark.view`; the controls need
  `quality.benchmark.manage`.
- **Not joined:** a plain-language "what is shared / what never leaves" panel (section 9.5 in
  words), the agreement text, the peer-attribute form, and a "Preview first send" action.
- **Joined:**
  - the next send, with its preview and an Approve button;
  - a sent history (period, time, approver, service receipt);
  - peer comparison (p25/p50/p75 bands with the hospital's marker; cells below k say
    "not enough peers");
  - Opt out (a `sm` Modal confirmation that states the deletion request).
- **States:** service unreachable means "Last sent …, waiting to retry"; it never claims a send
  happened.

## 12. Bricks

- The engine, screens and report belong to the **`quality`** permission group, which is in the
  **base plate**, so every hospital has them.
- Each indicator declares its **source brick**. When that brick (or a brick it depends on) is off
  for the tenant (`module_config`, `with_dependencies`), the indicator's status is
  **`not_applicable`**: the source is not registered, so nothing is computed from stale or partial
  tables. When a brick is switched off mid-month, the results computed earlier stay with their
  status. New months are `not_applicable`.
- A Pharmacy+EMR-only hospital (the 4-week focus) therefore sees the base-plate indicators (falls,
  incidents, hand hygiene, HAI) and pharmacy-sourced ones, with IPD, OT and ICU indicators marked
  "not applicable (IPD not in use)". None of them shows as zero or as missing.
- A department KPI is `not_applicable` unless its specialty brick is on. NABH marks these mandatory
  only when the specialty is in scope, so this matches the standard.

## 13. Slices (about 400 lines each; each ends on the screen)

| # | Slice | Contents | Screen proof |
|---|---|---|---|
| **1** | Engine + 6 ready indicators | `quality_indicator_results` + `quality_nil_returns` migration (RLS); the `IndicatorSource` trait; the nightly and on-demand job; NABH-13/14/15 (HAI), NABH-17 (hand hygiene), NABH-28 (falls), NABH-29 (near misses); the status rules of 6.3; dashboard rows read from results; `quality.indicators.drilldown` | The quality manager sees October's six figures, one "insufficient data" with its capture link, and drills into falls |
| 2 | 12 more ready indicators | NABH-02 (lab), 04, 05, 07, 08, 10, 12 (fixed denominator), 16, 19, 22, 24, 30; move their queries into their bricks; `not_applicable` when a brick is off | The same dashboard, with an IPD-off tenant showing "not applicable" |
| 3 | Small captures A | The ward-arrival time (01), unplanned OT return flag (06), ER same-problem return (11), antibiotic time (18) | Each capture screen, then the indicator |
| 4 | Small captures B + report | 03, 09, 20, 21, 23, 25, 27; the report re-pointed, met-rule fix, `quality.report.publish` snapshot | Printed October report |
| 5 | Missing captures | 26 (emergency drug list), 31, 32 (audits) | Formulary flag, audit forms |
| 6 | Benchmark, box side | Opt-in screen, agreement record, payload builder with suppression, preview and approval, outbox send, opt-out and withdraw; `quality.benchmark.*` | Preview shows the exact JSON; approve; opt out |
| 7 | Benchmark service + peer view | Receiver (signature, replay, k check), percentile publication, peer tab; department KPIs as bricks allow; 5th-edition mapping | Peer bands on the dashboard |

Retiring old code goes with the slice that replaces it:
- slice 1: the `nabh_indicators.rs` error-to-`None` collapse;
- slice 2: `calculation_query` and the fake auto-calculate handler;
- slice 4: `/admin/nabh-indicators`.

## 14. Scenario acceptance criteria

1. **Happy path.** Given October has 7 falls in `nabh_falls_register` and 3,120 pd, When the
   nightly job runs, Then NABH-28 shows 2.24 per 1000 pd, status `computed`, and drill-down lists
   exactly those 7 falls.
2. **Missing data source.** Given no `infection_device_days` rows for October, When the job runs,
   Then NABH-13/14/15 show "Insufficient data: no device-days entered for October", link to the
   device-days screen, and the report prints them as insufficient, not 0.
3. **Zero vs nil return.** Given 0 falls in October and no nil return, Then NABH-28 shows
   "0 recorded, not attested". When the quality manager records a nil return, Then it shows `0`,
   with who attested it and when.
4. **Query fault.** Given the falls query errors, Then NABH-28 shows "Could not compute" with retry.
   It never shows "pending", empty or 0, and the fault is logged.
5. **Switched-off brick.** Given the OT brick is off, Then NABH-06/07/16/18/19 show
   "Not applicable: Operation Theatre not in use", nothing queries OT tables, and the benchmark
   payload marks them `not_applicable`.
6. **Brick switched off mid-month.** Given OT was on until 15 October, Then September's OT results
   stay as computed, October's are `not_applicable`, and the report notes the change.
7. **Permission denied, drill-down.** Given a user with `quality.indicators.list` but not
   `.drilldown`, When they open NABH-28, Then they see the figure and trend, the drill-down panel is
   absent, and no drill-down request is sent. A direct API call returns 403.
8. **Late revision.** Given an SSI is confirmed on 20 November for an October surgery, When the job
   runs, Then October NABH-16 changes, stays `provisional` until its window closes, and the change
   log shows the old and new value.
9. **Published report is frozen.** Given October was published, When a source fall is corrected,
   Then the published PDF is unchanged, the dashboard shows the new value with "differs from
   published report", and publishing again makes revision 2.
10. **Tiny hospital, suppressed cells.** Given a 30-bed hospital with 2 falls in 640 pd, When the
    benchmark payload is built, Then NABH-28 is sent as `num_band "1-10"` (no exact count) and
    NABH-13 (40 catheter-days, below the floor) as `suppressed`. The preview shows both reasons.
11. **Too few peers.** Given only 3 contributors in "<50 beds, IN-South" for NABH-28, Then the
    service publishes no distribution for that group, widens to "<50 beds, national" if k ≥ 5, and
    the screen labels the comparison group used.
12. **Send needs approval.** Given a joined hospital and October final, When nobody has approved,
    Then nothing is sent, and the Benchmark tab shows the pending preview.
13. **Opting out.** Given a contributor opts out, Then the queued send is cancelled, a signed
    withdraw is sent, the service deletes the contributor's cells and confirms, and the box audit
    shows both. Re-joining uses a new contributor id.
14. **Nothing patient-level leaves.** Given any payload, Then a test checks the schema contains only
    the fields of section 9.1, and fails on any other field, any string longer than 64 characters,
    or any department, ward or date finer than a month.
15. **Not a medical device.** Given any screen of this module, Then no element names an individual
    patient's risk or suggests a clinical action. Drill-down lists records only.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Hospitals do not fill the registers, so the figures look good | Nil-return attestation and the `unattested_zero` state; coverage line on the dashboard and the report |
| Proxies (admission time for ward arrival, all-cause ER return) are taken as the NABH definition | Labelled "proxy" in the UI and the report until the capture lands |
| Re-identifying a hospital from peer attributes plus a rare event | Banding, k ≥ 5, percentiles only, fixed peer groups, coarse region |
| MedBrains becomes a data fiduciary for the benchmark channel | Counsel (open question 1); the agreement; the minimum data in 9.1 |
| Benchmark figures used to rank or market hospitals | No named values; the agreement forbids publication of named rankings |
| Source corrections change a figure an assessor already saw | Frozen published revisions plus a change log |
| Moving queries into bricks breaks today's rollup | Slice by slice; the old rollup stays until slice 2 replaces each code |

## 16. Open questions for the owner

1. **Thresholds:** are numerator band 1–10, k ≥ 5 and the per-indicator denominator floors right,
   or should counsel set them? (The legal note suggests cells below 11.)
2. **Who runs the benchmark service:** MedBrains, or a separate entity? Which country does it run
   in? (This affects UAE, Saudi Arabia and Indonesia, and the fiduciary role.)
3. **Give to get:** must a hospital contribute to see peers?
4. **ABDM:** for ABDM-participant hospitals, does sharing anonymised aggregates need NHA sign-off
   under draft HDM v2 cl. 29? (Counsel.)
5. **Children:** DPDP benchmarking on children's data needs parental consent if the data is
   personal. Do hospital-level counts that include children count as anonymised, and so fall
   outside that rule? (Counsel.)
6. **Pricing and packaging:** is benchmarking free, part of the quality brick, or a paid add-on?
7. **The 5th edition:** which hospitals are still on 5th-edition cycles? The 5th-edition annexure
   needs reading before slice 7's mapping.
8. **JCI:** should the JCI/IPSG extras be shown by default, or only to hospitals that pick JCI?
9. **Phase 4** (insurer, TPA and scheme reports): which first buyer? It needs its own consent RFC.

## Sources

- NABH Hospital Accreditation Standard, 6th edition, January 2025, KPI annexure from page 202:
  `https://portal.nabh.co/images/Standards/NABH%20Hospital%20Accreditation%20Standard%206th%20Edition%20January%202025.pdf`
  (read 2026-11-16).
- NABH implementation plan for the 6th edition (released 17 Sep 2024; new applications from 1 Jan
  2025): `https://portal.nabh.co/Announcement/Notification%20%E2%80%93%20Implementation%20Plan%20of%206th%20Edition%20Standards.pdf`.
- NABH KPI training page (no list): `https://nabh.co/training/key-performance-indicators-kpi-training-6th-edition-hospital-standards/`.
- **NABH 5th edition** (2020): mirrors only (Scribd, SlideShare), not read, so **UNCONFIRMED**.
- **JCI QPS / IPSG:** no source fetched, so **UNCONFIRMED**.
- Legal landscape for the data idea (2026-11-16, internal research note, not legal advice): part 7
  row and design checklist §3.3–3.5.
- Codebase, at `origin/release/3.35.0`:
  - `crates/medbrains-reports/src/nabh_indicators.rs`
  - `crates/medbrains-quality/src/lib.rs`
  - `crates/medbrains-nabh/src/lib.rs`
  - `crates/medbrains-print-data/src/regulatory.rs`
  - `crates/medbrains-db-migrations/src/migrations/{0340_quality,0220_ipd,0410_theatre,0150_emergency,0060_blood_bank,0360_regulatory}.sql`
  - `crates/medbrains-core/src/bricks.rs`
  - `crates/medbrains-server-core/src/middleware/entitlement.rs`
