# Epic: Missing modules — build or decide

Zero-implementation areas that need a build or an explicit defer decision: telemedicine, dental, ophthalmology, CMS handlers (501s), marketing/CRM. Audit refs: Part 2 scorecard 0-5% rows.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build telemedicine module

> As a **doctor**, I want video consult scheduling, virtual OPD encounters, and e-prescription per Telemedicine Practice Guidelines 2020, so that remote patients can be seen (regulatory + market expectation, currently 0%).

**Acceptance criteria**
- [ ] Consult scheduling + video provider integration
- [ ] Virtual encounter type flows into normal OPD/billing/prescription

**Audit ref:** Part 2 (0%) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `new module`
**Effort:** XL (>2 weeks)

Labels: P1-high, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build dental charting backend and UI

> As a **dentist**, I want odontogram charting, treatment plans, and dental consent backed by real endpoints, so that a common OP revenue line works (today: print template only).

**Acceptance criteria**
- [ ] Tooth-chart schema + CRUD
- [ ] Odontogram UI; treatment plan → billing linkage

**Audit ref:** Part 2 Specialized (stub) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `new routes/dental.rs`, `apps/web/src/pages/dental.tsx`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build ophthalmology module

> As a **ophthalmologist**, I want vision/refraction workup, spectacle prescription, and exam records, so that eye OPD is supported (currently missing entirely).

**Acceptance criteria**
- [ ] Refraction + visual-acuity capture
- [ ] Spectacle Rx print; links to OPD encounter

**Audit ref:** Part 2 Specialized (missing) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `new routes/ophthalmology.rs`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Implement CMS content handlers (replace 501s)

> As a **communications officer**, I want the CMS CRUD routes implemented over the existing 11-table schema, so that the hospital website/content workflow works (all routes return 501 today).

**Acceptance criteria**
- [ ] Posts/pages CRUD with medical-review workflow states
- [ ] Public rendering already works — wire authoring end

**Audit ref:** Part 2 CMS (5%) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/cms.rs`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Decide marketing/CRM scope

> As a **product owner**, I want an explicit build/defer/integrate decision for leads, campaigns, recalls, loyalty (currently 0%), so that we either plan the stack or consciously defer instead of leaving a silent gap.

**Acceptance criteria**
- [ ] Decision doc: build vs integrate (e.g. external CRM) vs defer
- [ ] If build: follow-up epic with scoped stories

**Audit ref:** Part 2 Marketing (0%) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `decision doc`
**Effort:** S (<1 day)

Labels: P2-medium, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform
