# Epic: Backend hardening

Fix cross-tenant bridge bug, unbounded queries, unchecked setup handlers, and resilience/audit gaps (graceful shutdown, rate limits, PHI read auditing, retention enforcement, public-booking identity). Audit refs: P0 #9-#11, P1 Backend.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:backend · Milestone: M1 — Week 1: Critical security & infra

## Scope bridge heartbeat UPDATE by tenant

> As a **security officer**, I want the device-bridge heartbeat UPDATE to include WHERE tenant_id = $2, so that an agent from one hospital cannot hijack another tenant's bridge row.

**Acceptance criteria**
- [ ] UPDATE filtered by tenant_id; regression test with two tenants

**Audit ref:** P0 #9 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/devices.rs:585-600`
**Effort:** S (<1 day)

Labels: P0-critical, area:backend · Milestone: M1 — Week 1: Critical security & infra

## Default pagination + LIMIT on all list endpoints

> As a **developer**, I want every fetch_all list endpoint to enforce default page size and max LIMIT, so that large tenants cannot OOM the server or stall the UI (~40+ unbounded endpoints).

**Acceptance criteria**
- [ ] Shared pagination extractor (page/per_page, max cap)
- [ ] Worst offenders first: pharmacy_dispense_ops, ambulance, bedside_portal, analytics
- [ ] Frontend list calls pass pagination; responses include meta.total

**Audit ref:** P0 #10 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes (systemic, ~1,180 fetch_all calls)`
**Effort:** L (1-2 weeks)

Labels: P0-critical, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Add permission checks to unchecked setup handlers

> As a **hospital admin**, I want require_permission on update_tenant/get_tenant and the ~30 unchecked setup.rs handlers, so that tenant configuration cannot be read or changed by unauthorized staff.

**Acceptance criteria**
- [ ] All setup.rs handlers call require_permission
- [ ] RBAC matrix test covers setup routes

**Audit ref:** P0 #11 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/setup.rs:72-180`
**Effort:** M (1-3 days)

Labels: P0-critical, area:backend · Milestone: M1 — Week 1: Critical security & infra

## Implement graceful shutdown on SIGTERM

> As a **devops engineer**, I want the server to drain in-flight requests and close pools on SIGTERM, so that deploys/restarts do not abort mid-transaction.

**Acceptance criteria**
- [ ] axum graceful shutdown wired; in-flight transactions complete or roll back cleanly
- [ ] systemd stop within timeout

**Audit ref:** P1 Backend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/main.rs:432`
**Effort:** S (<1 day)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Extend rate limiting beyond login

> As a **sysadmin**, I want rate limits on analytics, exports, and list endpoints, so that a single client cannot saturate the server.

**Acceptance criteria**
- [ ] Tiered limits (auth, read, export); 429 with Retry-After
- [ ] Config per tenant

**Audit ref:** P1 Backend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/middleware/rate_limit.rs:20-26`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Audit PHI list/read endpoints

> As a **compliance officer**, I want list endpoints (GET /patients etc.) recorded in the audit log, so that mass PHI exports are traceable (HIPAA read-tracking).

**Acceptance criteria**
- [ ] Read-audit middleware for PHI-bearing list endpoints with actor, filter, count
- [ ] No material latency regression

**Audit ref:** P1 Backend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/middleware/audit.rs:51-52`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Enforce data retention with a purge job

> As a **compliance officer**, I want the configured retention policies actually executed by a scheduled purge/anonymize job, so that stored data matches declared retention commitments.

**Acceptance criteria**
- [ ] Scheduled job reads retention config and purges/archives eligible rows
- [ ] Dry-run mode + audit entry per purge batch

**Audit ref:** P1 Backend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/security.rs`, `crates/medbrains-server/src/routes/mrd.rs`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Verify public booking identity with OTP

> As a **patient**, I want phone OTP verification before a public booking attaches to my patient record, so that a name+phone collision cannot book into someone else's medical record.

**Acceptance criteria**
- [ ] OTP send/verify step in public booking flow
- [ ] Unverified bookings create provisional records only

**Audit ref:** P1 Backend (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/appointments/public.rs:31`
**Effort:** M (1-3 days)

Labels: P1-high, area:backend · Milestone: M2 — Weeks 2-4: Reliability & revenue
