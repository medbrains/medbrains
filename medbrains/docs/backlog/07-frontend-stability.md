# Epic: Frontend stability & UX safety

Silent mutation failures, unconfirmed destructive actions, blank tables on API errors, unvalidated responses, missing skeletons/empty states, i18n bypasses. Also supersedes the 112 auto-filed client-error issues closed in favour of this epic. Audit refs: P0 #18-#19, P1/P2 Frontend, Part 3.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:frontend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Add onError handling to all mutations

> As a **nurse**, I want every mutation to surface failures as a toast instead of failing silently, so that I know when a save did not happen (25+ silent mutations in OPD/pharmacy/emergency).

**Acceptance criteria**
- [ ] All useMutation calls have onError → notification
- [ ] Shared mutation-error helper; i18n'd messages, no raw backend strings

**Audit ref:** P0 #18 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages/opd.tsx:1083-1199`, `apps/web/src/pages/pharmacy.tsx`, `apps/web/src/pages/emergency.tsx`
**Effort:** M (1-3 days)

Labels: P0-critical, area:frontend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Wrap destructive actions in confirmation dialogs

> As a **billing clerk**, I want delete/void/cancel actions to require modals.openConfirmModal, so that accidental clicks cannot permanently destroy records (15+ unguarded actions).

**Acceptance criteria**
- [ ] All destructive actions confirmed with consequence text
- [ ] Shared confirmDestructive helper

**Audit ref:** P0 #19 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages/billing.tsx:2554`, `apps/web/src/pages/ipd.tsx:3006`, `apps/web/src/pages/pharmacy.tsx`
**Effort:** S (<1 day)

Labels: P0-critical, area:frontend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Render query error states on all pages

> As a **staff user**, I want tables/pages to show an error + retry UI when a query fails, so that an API failure looks like a failure, not an empty list (~100 of 142 pages blank).

**Acceptance criteria**
- [ ] Shared QueryError component with retry
- [ ] Rolled out via DataTable/page wrapper so coverage is systematic

**Audit ref:** P1 Frontend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages (systemic)`, `apps/web/src/components/DataTable.tsx`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:frontend · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Validate API responses with Zod at runtime

> As a **developer**, I want API responses parsed through Zod schemas (1 safeParse in 142 pages today), so that backend shape drift fails loudly instead of rendering wrong data.

**Acceptance criteria**
- [ ] Schemas in packages/schemas for high-risk modules first (billing, pharmacy, lab)
- [ ] Client wrapper validates; dev-mode throws, prod logs

**Audit ref:** P1 Frontend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `packages/schemas/src`, `packages/api/src/client.ts`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:frontend · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Add skeletons and empty states

> As a **staff user**, I want loading skeletons (60+ tables) and explicit empty-state UI (110+ pages), so that blank screens are unambiguous: loading vs empty vs error.

**Acceptance criteria**
- [ ] Shared EmptyState component; PageSkeleton reuse
- [ ] Top-20 traffic pages first

**Audit ref:** P2 Frontend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages (systemic)`
**Effort:** M (1-3 days)

Labels: P2-medium, area:frontend · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Move hardcoded notification strings into i18n

> As a **non-English staff user**, I want the ~40 hardcoded English strings (pharmacy 25+, opd 15+) translated via i18n namespaces, so that critical flows speak my language.

**Acceptance criteria**
- [ ] Strings moved to locale JSON; no literal English in notifications.show
- [ ] Biome/grep check to prevent regressions

**Audit ref:** P2 Frontend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `apps/web/src/pages/pharmacy.tsx`, `apps/web/src/pages/opd.tsx`, `apps/web/public/locales`
**Effort:** S (<1 day)

Labels: P2-medium, area:frontend · Milestone: M3 — Weeks 5-8: Hardening & onboarding
