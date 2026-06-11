# Epic: Notifications & connector delivery

Backbone (outbox, job queue, scheduler) works; delivery doesn't: SMTP and WhatsApp are stubs, 8 of 9 notification events have no channel, no on-call lookup. Audit refs: P1/P2 Notifications, Part 2 Connectors.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:integration · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Implement real SMTP email delivery

> As a **patient**, I want the SMTP connector to actually send (receipts, discharge docs) instead of returning 'queued', so that emails the system claims to send actually arrive.

**Acceptance criteria**
- [ ] lettre-based SMTP send with per-tenant config
- [ ] Outbox handler delivers; failures retry via DLQ; delivery status stored

**Audit ref:** Part 2 Connectors (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/connectors`
**Effort:** M (1-3 days)

Labels: P1-high, area:integration · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Implement WhatsApp connector delivery

> As a **patient**, I want invoice/appointment WhatsApp messages sent via Business API, so that patients get documents on the channel they actually read.

**Acceptance criteria**
- [ ] WhatsApp Business API (or BSP) integration with template messages
- [ ] Opt-in tracking; failures fall back to SMS

**Audit ref:** Part 2 Connectors (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/connectors`
**Effort:** M (1-3 days)

Labels: P1-high, area:integration · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Wire the 8 missing notification events

> As a **pharmacist**, I want low-stock, lab-report-ready, invoice-issued, claim-approved, prescription-expiry, incident-escalation, token-call SMS, report-ready fan-out delivered, so that the events the system already detects reach the people who must act.

**Acceptance criteria**
- [ ] Each event mapped to channel + recipient rule via outbox
- [ ] Per-tenant enable/disable config

**Audit ref:** P2 Notifications (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/orchestration/default_pipelines.rs`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform

## Add on-call roster lookup for alert routing

> As a **doctor**, I want critical alerts routed to the on-call doctor from the duty roster when the ordering doctor is off, so that alerts always reach someone who can act.

**Acceptance criteria**
- [ ] Roster query resolves current on-call per department
- [ ] Used by critical-value SMS escalation

**Audit ref:** P1 (supports P0 #16) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/hr.rs`, `crates/medbrains-server/src/routes/lab.rs`
**Effort:** M (1-3 days)

Labels: P1-high, area:integration · Milestone: M2 — Weeks 2-4: Reliability & revenue
