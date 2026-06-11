# Epic: Onboarding & ETL

Single-record CRUD makes hospital onboarding take 6-12 weeks of manual entry. Bulk import for catalogs is the single biggest onboarding lever. Audit refs: P1 Onboarding blocker, P2 Configuration.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:onboarding · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Bulk import lab catalog, formulary, tariffs, patients via CSV/Excel

> As a **hospital admin**, I want CSV/Excel import with validation, preview, and error report for the big masters, so that onboarding takes days, not 6-12 weeks (1000+ lab tests, 5000+ drugs).

**Acceptance criteria**
- [ ] Import endpoints + UI for lab catalog, pharmacy formulary, tariffs, patient masters, ICD mapping
- [ ] Row-level validation report; idempotent re-run; template downloads

**Audit ref:** P1 Onboarding (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `new: routes/import.rs`, `apps/web/src/pages/admin`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:onboarding · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Make operational settings configurable via UI

> As a **hospital admin**, I want working hours/holidays, queue rules, lab critical thresholds, shift definitions, auto-billing toggles, print/consent templates editable in admin UI, so that each hospital tunes behaviour without engineering involvement.

**Acceptance criteria**
- [ ] Settings surfaces grouped in admin; persisted to tenant_settings
- [ ] Backend reads config instead of hardcoded values

**Audit ref:** P2 Configuration (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages/admin/settings.tsx`, `crates/medbrains-server/src/routes/setup.rs`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:onboarding · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Export/import tenant configuration between environments

> As a **implementation engineer**, I want a config bundle export/import (settings, templates, masters), so that staging-validated config promotes to production exactly.

**Acceptance criteria**
- [ ] Versioned JSON bundle export + validated import
- [ ] Diff preview before apply

**Audit ref:** P2 Configuration (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/setup.rs`
**Effort:** M (1-3 days)

Labels: P2-medium, area:onboarding · Milestone: M3 — Weeks 5-8: Hardening & onboarding
