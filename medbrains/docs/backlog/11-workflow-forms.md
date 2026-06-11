# Epic: Workflow engine & forms/printing runtime

Workflow engine tables exist but are dormant (0 templates vs RFC-002's 120+); form builder has schema but no routes/UI/runtime; print queue has no daemon; thermal formats unimplemented. Audit refs: P2 Workflow, Part 2 Forms & Printables.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Decide: activate or remove the workflow engine

> As a **product owner**, I want an explicit decision with implementation plan — either seed templates + rules engine + UI, or delete the dormant tables in favour of hardcoded pipelines, so that we stop carrying dead schema while RFC-002 promises stay unresolved.

**Acceptance criteria**
- [ ] Decision doc comparing both paths with effort
- [ ] Chosen path gets follow-up stories; dead code removed if dropped

**Audit ref:** P2 Workflow (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db migrations 0001 (workflow_*)`, `crates/medbrains-server/src/orchestration`
**Effort:** M (1-3 days)

Labels: P2-medium, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build form-builder routes and runtime renderer

> As a **hospital admin**, I want CRUD routes for form_masters/form_fields plus a runtime renderer so hospitals customize clinical forms, so that the 30+ hardcoded TSX forms become per-hospital configurable.

**Acceptance criteria**
- [ ] Form template CRUD + versioning routes
- [ ] Runtime form renderer component; one pilot form (consent) migrated

**Audit ref:** Part 2 Forms (builder 15%) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-core/src/form.rs`, `0007_forms.sql`, `apps/web/src/components`
**Effort:** XL (>2 weeks)

Labels: P1-high, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build print-job daemon and thermal ZPL/ESC-POS output

> As a **ward clerk**, I want the print_jobs queue actually delivered to printers, including label/wristband thermal formats, so that wristbands and labels print on real hardware instead of browser-print only.

**Acceptance criteria**
- [ ] Bridge-side print worker polls print_jobs
- [ ] ZPL/ESC-POS generation for wristband + label templates

**Audit ref:** Part 2 Forms (print infra) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-bridge`, `print_jobs schema`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform

## Add pharmacy dispensing-label endpoint

> As a **pharmacist**, I want a label print endpoint for dispensed items (struct exists, no endpoint), so that dispensed medication carries patient/dose/expiry labels.

**Acceptance criteria**
- [ ] Endpoint renders label from dispense record
- [ ] Wired into pharmacy dispense flow UI

**Audit ref:** Part 2 Forms (HIGH) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/pharmacy_dispense_ops.rs`, `print templates`
**Effort:** S (<1 day)

Labels: P1-high, area:backend · Milestone: M4 — Weeks 9-12: Compliance & platform
