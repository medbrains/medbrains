# RFC-GRAND-HIS — The Patient Closed-Loop & the road from "CRUD" to a grand HIS

**Status:** Draft · **Date:** 2026-07-07 · **Scope:** OPD spine first (IPD/ER follow the same pattern)

## 0. Verdict (grounded in a full code trace, not a feeling)

We traced the OPD journey end-to-end in the actual code (5 segments, file:line). **It is not "basic CRUD."**
The spine is ~80% a *tight* closed loop with real safety gates, auto-charge, and critical-value alerting.
What's left is **6 concrete broken handoffs** — specific, fixable, and each a focused PR. This RFC is the map
+ the fix backlog + the edge-case scenarios, so "are we ready" becomes a checklist.

What already makes it *not* CRUD:
- Check-in **atomically** creates encounter + OPD queue + token + TV broadcast (one transaction).
- Consultation places lab/radiology orders **inline, atomically**; prescriptions **auto-forward** to the pharmacy queue.
- CDS at prescribe (allergy, major DDI, therapeutic duplication) **blocks unless an override reason is given**, and audits it.
- Lab auto-flags critical/high/low against age/sex reference bands, delta-checks, auto-validates, and **escalates critical values by SMS** up an on-call chain.
- Pharmacy **enforces** Schedule H/H1/X (dual-signature for X), dispenses **FEFO** by batch/expiry, and **auto-charges** the invoice.
- Every charge (consult, lab, radiology, drugs, consumables, IPD room, OT) **auto-posts to one draft invoice per encounter**.
- IPD discharge has a **configurable no-dues gate**.

## 1. The spine — tight vs broken (traced)

| # | Segment | State | Evidence |
|---|---------|-------|----------|
| 1 | Register → appointment → check-in → doctor's queue | **TIGHT** (appointments) / **broken (walk-in)** | check-in atomically creates encounter+queue+token (`appointments/bookings.rs:432`); walk-in needs a manual `create_encounter` (`opd.rs:553`) |
| 2 | Encounter → orders (lab/radiology/rx) + CDS | **TIGHT** | inline orders in `create_consultation` (`opd.rs:1600-1630`); rx auto-forwards (`opd.rs:2608`); CDS warn+override, audited (`opd.rs:2287-2555`, `cds.rs`) |
| 3 | Lab order → sample → result → **back to doctor** | **TIGHT in lab, BROKEN at OPD boundary** | auto-flag/delta/auto-validate + critical SMS escalation (`lab.rs:1082-1312`, `critical_alert_escalation.rs`); but routine results never notify the doctor and don't appear in the encounter view |
| 4 | Prescription → dispense (FEFO/NDPS) → charge | **TIGHT happy path, gaps on scarcity/NDPS** | Schedule H/H1/X enforced (`pharmacy.rs:3022`), FEFO (`2162`), auto-charge (`2929`); NDPS record-only not a gate; out-of-stock hard-blocks whole order |
| 5 | Charges → invoice → payment → **visit close** | **TIGHT (IPD), BROKEN (OPD)** | auto-charge → one draft invoice/encounter (`billing.rs:270-410`); IPD no-dues gate (`ipd.rs:1885`); **OPD close has no no-dues gate, consult fee charged *after* close, invoice left DRAFT** (`opd.rs:1183`) |

## 2. The broken-handoff backlog (the build plan, prioritized)

**P1 — OPD results-to-doctor loop (clinical safety).** Routine (non-critical) lab/radiology results never signal the
ordering doctor and don't render inside the OPD encounter — the doctor must remember to hunt the `/lab` page.
*Fix:* results-ready notification to the ordering doctor on verify; join lab/radiology results into the encounter
detail view; (optional) push new orders to the lab worklist over the existing SSE. This is the single biggest
"feels like a real HIS" upgrade.

**P2 — OPD visit-close no-dues gate (revenue integrity).** `complete_queue_entry` marks the encounter COMPLETED
with no billing gate, charges the consult fee *after* close, and leaves the invoice DRAFT. Port IPD's pattern:
charge consult fee *before* close, auto-issue the invoice, and add a configurable no-dues gate
(`billing.block_opd_close_unsettled`) — LAMA-style bypass not needed for OPD (walk-outs → outstanding, flagged).

**P3 — Walk-in one-step register→queue.** Collapse register + `create_encounter(visit_type=walk_in)` into one
front-office action so a walk-in reaches the doctor's queue without the manual seam.

**P4 — Out-of-stock partial dispense / backorder.** Today insufficient stock hard-blocks the *entire* order.
Allow partial fill (already modelled: `quantity_dispensed`) + a backorder/pending line, instead of failing everything.

**P5 — NDPS as a gate, not just a record.** Controlled-drug dispense records an NDPS entry *after the fact* but
doesn't validate register balance / dual-lock *before* dispensing. Make it a pre-dispense gate (parity with Schedule X).

**P6 — Small tighteners.** Sample-rejection → auto-recollect queue (order stalls in `ordered` today); uncollected-Rx
hold flag; surface NDPS/Schedule flags at *prescribe* time (today only at dispense); optional mandatory-diagnosis-before-order.

## 3. Edge-case scenarios (Given/When/Then — the acceptance tests)

- **Allergy block:** Given a patient with an active drug allergy, When the doctor prescribes the conflicting drug, Then save is blocked until an override reason is entered, and the override is audited. *(Works today.)*
- **Critical value:** Given a verified critical lab result, When it is saved, Then the ordering doctor is notified in-app immediately and by SMS up the on-call chain if unacknowledged in 15 min. *(Works today.)*
- **Routine result return (P1):** Given a verified *normal* result, When it is saved, Then it appears in the doctor's encounter view and the doctor is signalled results are ready. *(Broken today.)*
- **Schedule X:** Given a Schedule-X drug, When dispensed without a witness ≠ prescriber, Then the dispense is blocked. *(Works today.)*
- **NDPS gate (P5):** Given a controlled drug with an unbalanced/absent register, When dispense is attempted, Then it is blocked pending register reconciliation. *(Broken today — record-only.)*
- **Insufficient stock (P4):** Given an order line exceeding on-hand, When dispensed, Then that line is partially filled + backordered and the rest of the order still dispenses. *(Broken today — whole order fails.)*
- **OPD no-dues (P2):** Given an OPD visit with an unpaid balance, When the doctor completes the visit, Then the consult fee is already billed, the invoice is issued, and (if configured) close is blocked until settled or explicitly deferred. *(Broken today.)*
- **Walk-in (P3):** Given an unregistered walk-in, When the front office registers them, Then one action places them in the doctor's queue. *(One manual seam today.)*
- **Zero-amount/scheme patient:** Given a free/scheme patient, When the invoice is issued, Then it settles to PAID with no payment step. *(Works today.)*

## 4. The 5-pillar grand roadmap (this RFC is Pillar 1)

1. **Closed-loop clinical spine** — *this RFC.* Ship P1→P6, then replicate for IPD/ER.
2. **Device integration** — a `DeviceBridge` service: HL7 v2/ASTM from a lab analyzer (auto result entry — kills the manual step in §3), DICOM/PACS, vitals monitors, barcode/wristband, label printers.
3. **National interop** — auto-generate MoHFW **HMIS** monthly facility reports from transactional data; ABDM Health ID linkage (already captured); FHIR R4 export.
4. **AI-native + regulation-enforcing** — the on-prem copilot acting across the loop (ambient notes, agentic order/discharge); the moat no cloud/fork competitor can match.
5. **Multi-app fleet** — thin role/location apps (nurse/pharmacist/doctor mobile; ward/OT/pharmacy TV) over the one shared `@medbrains/*` core.

**Uniqueness / why "grand in the world":** sovereign, on-prem, **AI-native**, **regulation-as-code**, device-integrated, DPG-aligned — the combination Epic (cloud/US), Bahmni (fork-per-site, no AI), and cloud AI scribes (PHI leaves) structurally cannot be.

## 5. Build order

P1 (results loop) → P2 (OPD no-dues) → P3 (walk-in) → P4 (partial dispense) → P5 (NDPS gate) → P6 (tighteners).
Each is one gated PR against the existing handlers cited above. P1 and P2 deliver the most visible "this runs the hospital" and "no revenue leaks" wins.
