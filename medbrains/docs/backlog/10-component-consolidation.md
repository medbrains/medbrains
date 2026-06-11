# Epic: Component library consolidation

Shared library is good but under-adopted: 45 pages duplicate status maps, 48 pages use raw tables, 748 inline notification calls, 26 duplicate formatters, StatCard used in 2 of 132 candidate pages. Audit ref: Part 5.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P2-medium · Area: area:ux · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Consolidate status→color maps into StatusBadge

> As a **developer**, I want all 45 inline status-color maps replaced by an extended shared StatusBadge, so that status colors are consistent across every module.

**Acceptance criteria**
- [ ] StatusBadge statusMap extended per domain (pharmacy, ambulance, comms, indent…)
- [ ] 45 pages migrated; inline maps deleted

**Audit ref:** Part 5 #1 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/components/StatusBadge.tsx`
**Effort:** M (1-3 days)

Labels: P2-medium, area:ux · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Migrate raw Mantine tables to shared DataTable

> As a **developer**, I want the 48 pages on raw <Table> moved to DataTable, so that pagination/sorting/error/empty behaviour is uniform (194 duplicated column defs today).

**Acceptance criteria**
- [ ] 48 pages migrated incl. lab.tsx, mrd.tsx, blood-bank.tsx modals
- [ ] No raw <thead> rendering left in pages

**Audit ref:** Part 5 #2 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/components/DataTable.tsx`, `apps/web/src/pages/lab.tsx`, `apps/web/src/pages/mrd.tsx`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:ux · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Extract FormModal scaffold for RHF+Zod forms

> As a **developer**, I want a shared FormModal/useFormModal wrapping the repeated modal+form+submit pattern (286 zodResolver sites), so that mega-files shrink 15-20% and form UX is uniform.

**Acceptance criteria**
- [ ] FormModal component with submit state, error display, close handling
- [ ] Adopted in billing.tsx, pharmacy.tsx, emergency.tsx, ipd.tsx

**Audit ref:** Part 5 #3 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/components`, `apps/web/src/pages/billing.tsx`
**Effort:** M (1-3 days)

Labels: P2-medium, area:ux · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Centralize formatters (money, percent, bytes)

> As a **developer**, I want formatMoney/formatPercent/formatBytes added to lib and the 26 local copies replaced, so that currency and dates render identically everywhere.

**Acceptance criteria**
- [ ] lib/date-utils.ts (+number-utils.ts) extended
- [ ] 26 pages import shared formatters; local copies deleted

**Audit ref:** Part 5 #5 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/lib/date-utils.ts`
**Effort:** S (<1 day)

Labels: P2-medium, area:ux · Milestone: M4 — Weeks 9-12: Compliance & platform

## Add showNotification helper and migrate inline calls

> As a **developer**, I want a typed showNotification(type, title, message) helper replacing 748 inline notifications.show calls, so that toasts are consistent and i18n-enforced in one place.

**Acceptance criteria**
- [ ] Helper in lib/ with success/error/warning variants
- [ ] Mega-pages migrated first; Biome rule or grep check

**Audit ref:** Part 5 #4 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/lib`
**Effort:** M (1-3 days)

Labels: P2-medium, area:ux · Milestone: M4 — Weeks 9-12: Compliance & platform

## Promote StatCard and add useCRUDMutation hook

> As a **developer**, I want StatCard adopted on dashboard/report pages and a shared useCRUDMutation(queryKey) hook, so that stat cards stop being hand-rolled (132 pages) and invalidation boilerplate (448 calls) shrinks.

**Acceptance criteria**
- [ ] StatCard used in top dashboard/report pages
- [ ] hooks/useCRUDMutation.ts adopted in 10+ pages

**Audit ref:** Part 5 #6, #7 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/components/StatCard.tsx`, `apps/web/src/hooks`
**Effort:** M (1-3 days)

Labels: P2-medium, area:ux · Milestone: M4 — Weeks 9-12: Compliance & platform
