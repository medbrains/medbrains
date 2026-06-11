# Epic: Revenue & module linkages

Six revenue-leak linkage gaps: manual bed charges, manual discharge settlement, undelivered reminders, unenforced TPA pre-auth, manual queue entry, manual billing reversal. Audit ref: P1 Revenue leakage.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Auto-bill room rent daily on IPD admission

> As a **billing clerk**, I want daily bed/room charges auto-created from admission + bed assignment, so that no admitted day goes unbilled.

**Acceptance criteria**
- [ ] Scheduled job posts daily room-rent lines per occupied bed
- [ ] Bed transfers prorate correctly; uses auto_charge idempotency

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/ipd.rs`, `crates/medbrains-server/src/routes/billing.rs`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Finalize invoice on IPD discharge

> As a **billing clerk**, I want discharge checklist to trigger invoice finalization/settlement, so that patients cannot leave with unbilled services.

**Acceptance criteria**
- [ ] Discharge step aggregates pending charges into final invoice
- [ ] Discharge blocked (configurable) until settlement or credit approval

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/ipd_post_discharge.rs:69+`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Deliver appointment reminders via SMS/email job

> As a **receptionist**, I want stored reminders actually sent through a scheduled delivery job, so that no-shows drop (currently reminders are stored, never delivered).

**Acceptance criteria**
- [ ] Scheduled job sends due reminders via Twilio/SMTP
- [ ] Delivery status tracked; retries on failure

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/appointments/reminders.rs:24+`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Enforce TPA pre-authorization at billing

> As a **insurance desk officer**, I want charges above pre-auth limits flagged/blocked for insured patients, so that claim denials from unauthorized charges stop.

**Acceptance criteria**
- [ ] Billing checks active pre-auth before posting covered charges
- [ ] Override path with reason + audit

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/billing.rs:366+`, `crates/medbrains-server/src/routes/insurance.rs`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Create OPD queue entry on appointment check-in

> As a **receptionist**, I want check-in to automatically place the patient in the OPD queue, so that patients are not lost between front office and consultation.

**Acceptance criteria**
- [ ] Check-in creates queue token; TV board updates via WebSocket
- [ ] E2E: book → check-in → appears in doctor queue

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/front_office.rs`, `crates/medbrains-server/src/routes/opd.rs`
**Effort:** S (<1 day)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Auto-reverse billing lines on clinical cancellation

> As a **billing clerk**, I want cancelling an order/procedure to reverse its billing line automatically, so that patients are not charged for cancelled services (0112 backbone exists).

**Acceptance criteria**
- [ ] Cancellation events trigger reversal via existing 0112 backbone
- [ ] Reversal audit trail; partial-completion handling

**Audit ref:** P1 Revenue (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/billing.rs`, `crates/medbrains-server/src/orchestration`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue
