# Sprint Plan — Pharmacy Flow Improvements

**Status:** Draft
**Date:** 2026-04-28
**Depends on:** Order Basket (shipped), Doctor Activities sub-A (signed_records — shipped), Outbox (shipped)
**Companion:** SPRINT-doctor-activities.md, SPRINT-order-basket.md

## Context

Pharmacy is operationally complete (Phase 2 — 34 backend handlers, 11-tab page including POS, Rx Queue, Orders, Catalog, Stock, NDPS, Batches, Stores, Analytics, Credit Notes, Store Requests). Sprint A wired Razorpay. Order Basket added cross-module Rx batching. Doctor Activities added digital signatures.

But the **operational flow** between OPD doctor → pharmacy queue → counter dispense → patient still has rough edges. This sprint addresses the day-to-day friction.

## 15 concrete improvement areas

### 1. Patient banner missing in pharmacy POS / Rx Queue
**Today**: pharmacy staff see drug list but not the patient's allergies, age, weight, renal function. Critical safety signal absent at point of dispense.
**Fix**: render a `<PatientSafetyBanner />` at the top of the POS workspace and Rx Queue detail view. Show: name, age, weight, allergies (red pills), pregnancy status, last creatinine + eGFR, current chronic meds, current admission status. Reuse same component on patient detail page (consistent UX).
**Effort**: 6h (component + 2 mounting points)

### 2. Drug-drug interaction warnings only on order creation, not at dispense
**Today**: `check_drug_interactions` route exists (`pharmacy.rs:2019`) but is only called when the basket is signed by the doctor. By the time pharmacy dispenses, the patient may have new prescriptions from other doctors that day. The dispenser misses cross-prescriber interactions.
**Fix**: re-run interaction check at dispense time — pull patient's active prescriptions across all encounters today + the basket being dispensed. Display non-blocking yellow banner; require pharmacist override + reason for severe interactions.
**Effort**: 8h (backend cross-Rx check + frontend banner)

### 3. Generic substitution suggestions
**Today**: doctor prescribes "Crocin 500mg"; pharmacy dispenses Crocin or out-of-stock → patient walks away. No prompt for generic equivalent.
**Fix**: at dispense, if branded drug is out-of-stock or below `reorder_level`, suggest the generic (matched by `inn_name` from `pharmacy_catalog`). Show price savings + Schedule equivalence. Pharmacist accepts/rejects with one click. Audit row in `pharmacy_substitutions`.
**Effort**: 12h (catalog query + UI + audit table migration)

### 4. Refill / repeat prescription
**Today**: patient comes back next month for blood-pressure med refill. Doctor must write a fresh Rx. Pharmacy can't legally refill on its own.
**Fix**: doctor marks Rx with `repeats_allowed: 3, repeat_interval_days: 30`. Pharmacy can dispense up to 3 times within window without doctor re-Rx. Each dispense logs a `pharmacy_repeats` row. Beyond 3 → requires doctor sign-off again.
**Effort**: 16h (migration + backend repeat enforcement + frontend repeat counter on Rx)

### 5. Patient counseling notes
**Today**: pharmacist explains "take with food, watch for dizziness" — verbally. No record.
**Fix**: at dispense success, optional textarea "counseling notes" + checkboxes (took with food explained, dose timing explained, side effects explained, missed-dose advice). Stores in `pharmacy_counseling` row, prints on the dispense slip.
**Effort**: 6h (small migration + small form + slip template)

### 6. Cold-chain / refrigeration alerts at issue
**Today**: insulin, vaccines need 2-8°C storage. If kept out >30 min on the counter, potency drops. No reminder.
**Fix**: drug catalog has `requires_refrigeration` flag (already exists per memory). At dispense, if flagged → show a yellow banner "DO NOT delay — refrigerated drug, hand to patient with ice pack". Add a 2-minute countdown after barcode scan; pharmacist must "Hand-off Confirmed" within window.
**Effort**: 4h

### 7. Insurance / package coverage check at counter
**Today**: pharmacist gives drug → patient pays cash → patient submits to TPA → TPA rejects because drug not in formulary. Refund headache.
**Fix**: at POS, query patient's active insurance/package subscriptions + check if drugs are covered. Show "Covered ₹X / Cash ₹Y / Total ₹Z" breakdown. If covered, auto-create claim line. If not, warn before tendering cash.
**Effort**: 14h (insurance formulary join + package consumption lookup + POS UI)

### 8. Schedule X paper Rx serial enforcement (already in basket — extend to POS / Rx queue)
**Today**: order basket blocks Schedule X without paper serial. POS counter sale doesn't enforce.
**Fix**: same `SCHEDULE_X_REQUIRES_PAPER` rule extended to `create_otc_sale` + `dispense_order` endpoints. Wristband scan + paper serial both required.
**Effort**: 4h

### 9. NDPS witness co-sign at dispense
**Today**: NDPS Schedule X dispense logs the dispenser. NDPS Act §42 requires a witness for narcotics. Memory mentions "ndps_register" but witness flow unclear.
**Fix**: at dispense of NDPS-classified drug, require second pharmacist's PIN + appears in `pharmacy_ndps_register.witness_user_id`. Sign with both Ed25519 sigs (primary dispenser + witness) — reuses doctor signing infrastructure.
**Effort**: 8h

### 10. Real-time stock display per dispensing
**Today**: stock view is a separate tab. POS doesn't show "12 left" next to drug name as you add to cart.
**Fix**: POS drug picker shows live qty next to each drug. Below `reorder_level` → yellow tag. Below 5 → red tag. Subtract from displayed qty as items added to cart.
**Effort**: 6h (server returns qty in catalog row, frontend live-update)

### 11. Pharmacy receipt with drug metadata
**Today**: receipt shows drug name + qty + price. Patient often loses the dose schedule paper.
**Fix**: receipt PDF includes per-drug: dose, frequency, route, duration, indication, "take after food/before food", warnings (drowsy, no driving), Hindi/Tamil translation if patient locale is non-English. Digitally signed by pharmacist using doctor signing infra (record_type="pharmacy_receipt").
**Effort**: 10h (receipt template + i18n + sig integration)

### 12. Returns + refund workflow
**Today**: `pharmacy_returns` table exists, `process_return` handler exists. UI is bare-bones.
**Fix**: dedicated Returns tab — list of dispensed orders, "Return" button, partial-quantity return, reason picker (wrong drug, patient deceased, allergy, switched brand), batch traceability so wrong-batch returns get flagged for QA. NDPS returns require both witnesses again.
**Effort**: 8h

### 13. Batch FEFO (First-Expiry First-Out) auto-pick
**Today**: dispenser picks any batch. Often picks newest first → older batches expire on shelf.
**Fix**: when dispensing, auto-select earliest-expiring non-expired batch with stock. Allow manual override with reason. Tracks "FEFO compliance %" in analytics.
**Effort**: 6h

### 14. Stock reorder auto-suggest
**Today**: "near expiry" + "dead stock" reports exist but no actionable workflow.
**Fix**: nightly job generates draft purchase orders from items below `reorder_level`. Shows in Procurement → Pending POs queue. Pharmacist reviews + sends. Reuses existing PO creation.
**Effort**: 8h (cron job + draft PO entity)

### 15. Discharge medication kit auto-print
**Today**: IPD discharge → doctor writes Rx → ward nurse manually walks to pharmacy → pharmacy dispenses → nurse walks back. 3-5 round trips per discharge.
**Fix**: on discharge, automatically queue the discharge medications in pharmacy with `dispensing_type='discharge'` (already supported by schema). Pharmacy prepares the kit; nurse fetches once. Status visible in IPD discharge workspace ("Pharmacy: 2 of 5 ready").
**Effort**: 10h (discharge → pharmacy queue auto-link + status websocket + ward UI panel)

## Schema additions (migration `135_pharmacy_improvements.sql`)

```sql
-- Repeat prescriptions
ALTER TABLE prescriptions
  ADD COLUMN repeats_allowed INT NOT NULL DEFAULT 0,
  ADD COLUMN repeat_interval_days INT,
  ADD COLUMN repeats_used INT NOT NULL DEFAULT 0;

CREATE TABLE pharmacy_repeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL,
  pharmacy_order_id UUID NOT NULL,
  repeat_index INT NOT NULL,
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispensed_by UUID NOT NULL REFERENCES users(id),
  notes TEXT
);

-- Substitution audit
CREATE TABLE pharmacy_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_order_item_id UUID NOT NULL,
  original_drug_id UUID NOT NULL,
  substituted_drug_id UUID NOT NULL,
  reason TEXT NOT NULL,
  inn_match BOOLEAN NOT NULL,
  patient_consent_obtained BOOLEAN NOT NULL DEFAULT FALSE,
  substituted_by UUID NOT NULL REFERENCES users(id),
  substituted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Counseling notes
CREATE TABLE pharmacy_counseling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_order_id UUID NOT NULL,
  food_timing_explained BOOLEAN NOT NULL DEFAULT FALSE,
  dose_timing_explained BOOLEAN NOT NULL DEFAULT FALSE,
  side_effects_explained BOOLEAN NOT NULL DEFAULT FALSE,
  missed_dose_explained BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  counselled_by UUID NOT NULL REFERENCES users(id),
  counselled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insurance coverage check at dispense (audit only — actual claim flow already exists)
CREATE TABLE pharmacy_coverage_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pharmacy_order_id UUID NOT NULL,
  insurance_subscription_id UUID,
  package_subscription_id UUID,
  covered_amount NUMERIC(12,2) NOT NULL,
  cash_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('covered','partial','not_covered','overridden')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- All tenant-scoped + RLS + FORCE
```

## Phasing — recommend split into 3 PRs

### PR-1 — Safety (highest clinical value, ~38h)
- #1 Patient safety banner
- #2 Cross-Rx interaction check at dispense
- #6 Cold-chain hand-off countdown
- #8 Schedule X enforcement parity
- #9 NDPS witness co-sign

### PR-2 — Operational efficiency (~46h)
- #4 Repeat prescriptions
- #5 Counseling notes
- #10 Live stock in POS
- #13 FEFO auto-pick
- #15 Discharge kit auto-link

### PR-3 — Financial + UX polish (~38h)
- #3 Generic substitution
- #7 Insurance coverage at counter
- #11 Receipt with drug metadata + i18n
- #12 Returns workflow polish
- #14 Auto-suggest reorder POs

**Total: ~122h ≈ 3 dev-weeks across 3 PRs.**

## Acceptance criteria per phase

PR-1: pharmacist sees allergies before dispense; severe drug-drug interaction across all today's Rx blocks dispense; cold-chain countdown surfaces; Schedule X paper serial required at all dispense paths; NDPS dispense requires two pharmacist signatures.

PR-2: doctor can mark Rx as repeatable up to 3x; pharmacy auto-picks oldest expiry batch; counseling notes printable on slip; live stock visible at picker; discharge kit appears in IPD discharge view as it's prepared.

PR-3: out-of-stock drug suggests generic; insurance coverage breakdown shown at POS; receipt PDF in patient's locale; returns track batch + reason; nightly cron drafts POs.

## What's NOT in this sprint

- Bedside MAR (drug administration record) — that's in **SPRINT-nurse-activities.md**
- HL7 lab analyzer integration / DICOM — separate Phase 2
- Actual pharmacy device integrations (barcode scanner hardware, label printer, refrigeration sensors) — hardware procurement
- Pharmacy app for delivery riders — Phase 3
- Inventory IoT cold-chain monitoring — Phase 3

## Critical files to touch

### New
- `crates/medbrains-db/src/migrations/135_pharmacy_improvements.sql`
- `crates/medbrains-server/src/routes/pharmacy_improvements.rs` (or extend existing pharmacy.rs)
- `apps/web/src/components/Patient/PatientSafetyBanner.tsx`
- `apps/web/src/components/Pharmacy/CounselingNotesModal.tsx`
- `apps/web/src/components/Pharmacy/RepeatTracker.tsx`
- `apps/web/src/components/Pharmacy/CoverageBreakdown.tsx`
- `apps/web/src/components/Pharmacy/SubstitutionPrompt.tsx`
- `apps/web/src/components/Pharmacy/ColdChainCountdown.tsx`

### Modified
- `crates/medbrains-server/src/routes/pharmacy.rs` (dispense_order, create_otc_sale, create_discharge_dispensing)
- `apps/web/src/pages/pharmacy.tsx` (POS tab, Rx Queue tab)
- `crates/medbrains-server/src/routes/print_data_billing.rs` (pharmacy receipt with drug metadata)

### Reused
- `signed_documents::fetch_all_signatures_for_print` — pharmacy receipt signed by pharmacist
- `useOrderBasketStore` — patient detail Order button already mounted
- `outbox::queue_in_tx` — auto-link discharge → pharmacy queue via outbox event
- `cds::*` — drug interaction rules already exist in events.rs

## Verification

1. Apply migration 135
2. Open POS → see patient safety banner
3. Add 2 conflicting drugs → block at dispense with override prompt
4. Mark a chronic-care Rx as repeatable 3x → patient comes back next month → dispense without doctor visit
5. Out-of-stock branded drug → see generic suggestion
6. Insurance patient → see covered/cash split
7. Receipt prints in Hindi for Hindi-locale patient
8. Discharge a patient → discharge kit auto-appears in pharmacy queue with `dispensing_type='discharge'`

## Branch + PR plan

- `feature/pharmacy-safety` (PR-1, ~1 week)
- `feature/pharmacy-operations` (PR-2, ~1 week)
- `feature/pharmacy-polish` (PR-3, ~1 week)

Reviewer focus: cross-Rx allergy/interaction correctness, NDPS legal compliance, Schedule X paper serial idempotency.
