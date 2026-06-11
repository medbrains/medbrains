# Epic: Clinical safety & compliance

Critical lab values must reach a doctor reliably; NABH/JCI checklist machinery (34 departments, 700+ criteria) is unbuilt; QC and specialty compliance gaps. Audit refs: P0 #16-#17, Part 2 specialty findings.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:clinical-safety · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Deliver critical lab values via SMS with acknowledgment

> As a **doctor**, I want critical results pushed over SMS (not just WebSocket) with delivery retry and an ack workflow, so that a panic value is never missed because a browser tab was closed.

**Acceptance criteria**
- [ ] SMS via existing Twilio connector to ordering doctor
- [ ] Escalation if unacknowledged within configurable window
- [ ] Ack recorded with timestamp + user (NABH critical-value reporting)

**Audit ref:** P0 #16 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/lab.rs:1115-1140`
**Effort:** L (1-2 weeks)

Labels: P0-critical, area:clinical-safety · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Build NABH/JCI checklist engine

> As a **quality manager**, I want a checklist schema + templates covering the 34 department checklists (700+ criteria), so that accreditation compliance is tracked in-system instead of on paper.

**Acceptance criteria**
- [ ] Checklist template/instance/response schema with scoring
- [ ] Seed from ACMSRC evaluation checklists; department dashboards

**Audit ref:** P0 #17 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `new module`
**Effort:** XL (>2 weeks)

Labels: P0-critical, area:clinical-safety · Milestone: M4 — Weeks 9-12: Compliance & platform

## Enforce WHO surgical safety checklist in OT flow

> As a **OT nurse**, I want sign-in/time-out/sign-out gates enforced before case milestones, so that IPSG surgical-safety compliance is guaranteed per case.

**Acceptance criteria**
- [ ] Checklist completion blocks stage transitions
- [ ] Printable record per surgery

**Audit ref:** P0 #17 / IPSG (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/ot.rs`
**Effort:** M (1-3 days)

Labels: P0-critical, area:clinical-safety · Milestone: M4 — Weeks 9-12: Compliance & platform

## Add lab QC hold/recheck/supervisor-approval workflow

> As a **lab supervisor**, I want analyzer results held for QC review with recheck + approval before release, so that NABL-compliant result verification instead of auto-posting.

**Acceptance criteria**
- [ ] QC hold state on bridge-ingested results
- [ ] Supervisor approve/reject with audit; release gates report print

**Audit ref:** Part 2 Devices (lab) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-bridge`, `crates/medbrains-server/src/routes/lab.rs`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:clinical-safety · Milestone: M4 — Weeks 9-12: Compliance & platform

## Track dialyzer reuse and machine scheduling

> As a **dialysis in-charge**, I want dialyzer reuse counts and machine slot scheduling on dialysis sessions, so that reuse limits are enforced (compliance) and machines are utilized safely.

**Acceptance criteria**
- [ ] Dialyzer reuse counter with max-reuse enforcement
- [ ] Machine master + session slot allocation

**Audit ref:** Part 2 Specialized (nephrology) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/dialysis.rs`
**Effort:** M (1-3 days)

Labels: P1-high, area:clinical-safety · Milestone: M4 — Weeks 9-12: Compliance & platform

## Generate PCPNDT statutory form for maternity scans

> As a **radiologist**, I want the mandatory PCPNDT Form F auto-generated from ultrasound orders on pregnant patients, so that statutory PCPNDT compliance is automatic, not manual paperwork.

**Acceptance criteria**
- [ ] Form F data capture + print template
- [ ] Register report for PCPNDT authority

**Audit ref:** Part 2 Specialized (maternity) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/maternity.rs`, `print templates`
**Effort:** M (1-3 days)

Labels: P1-high, area:clinical-safety · Milestone: M4 — Weeks 9-12: Compliance & platform
