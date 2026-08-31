# Epic: Multi-tenancy & database integrity

Close cross-tenant leak risk (44 tables without RLS) and structural DB debt: missing indexes (~1,600 FK columns, 58 zero-index tables, 286 JSONB no GIN), unconstrained status columns, unpartitioned log tables. Audit refs: P0 #8, P1 Database.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:database · Milestone: M1 — Week 1: Critical security & infra

## Enable RLS on the 44 tenant tables missing it

> As a **hospital admin**, I want every tenant-scoped table protected by RLS tenant policy, so that no query path can leak another hospital's data.

**Acceptance criteria**
- [ ] RLS + tenant policy on backup_history, cross_hospital_appointments, inter_hospital_stock_transfers, 6 camp tables, iam_access_requests, lab_sample_routes, patient_transfers, 32 relation_tuples_p* partitions
- [ ] Migration applies cleanly; RLS coverage check = 100% of tenant tables

**Audit ref:** P0 #8 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db-migrations/src/migrations (0001, 0003, 0011, 0028, 0053, 0117, 0120)`
**Effort:** M (1-3 days)

Labels: P0-critical, area:database · Milestone: M1 — Week 1: Critical security & infra

## Backfill FK and (tenant_id, status) composite indexes

> As a **developer**, I want indexes on hot FK columns and tenant+status composites, so that joins, cascades, and filtered lists stop full-scanning as data grows.

**Acceptance criteria**
- [ ] Audit-driven index list; prioritize high-traffic tables (patients, orders, invoices, encounters)
- [ ] CONCURRENTLY migrations; before/after query plans on top 10 endpoints

**Audit ref:** P1 Database (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db-migrations/src/migrations`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:database · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Add GIN indexes on queried JSONB columns

> As a **developer**, I want GIN indexes on JSONB columns used in WHERE/contains queries, so that JSON filtering does not full-scan (286 JSONB columns, 0 GIN today).

**Acceptance criteria**
- [ ] Identify JSONB columns referenced in queries; add GIN selectively
- [ ] No index bloat on write-heavy tables without query need

**Audit ref:** P1 Database (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db-migrations/src/migrations`
**Effort:** M (1-3 days)

Labels: P1-high, area:database · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Add CHECK constraints to free-text status columns

> As a **developer**, I want CHECK constraints (or enums) on the ~36 status TEXT columns, so that invalid states cannot be inserted and state machines stay trustworthy.

**Acceptance criteria**
- [ ] Inventory of status columns + allowed values
- [ ] Constraints added with data cleanup for existing violations

**Audit ref:** P1 Database (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db-migrations/src/migrations`
**Effort:** M (1-3 days)

Labels: P1-high, area:database · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Partition and archive log/event tables

> As a **sysadmin**, I want time-based partitioning + archival policy for the 50+ unbounded log/event tables, so that audit/event growth cannot fill the disk or slow queries.

**Acceptance criteria**
- [ ] Partition strategy (monthly) for audit_log, outbox, job_queue history, ws events
- [ ] Archival/retention job; payments + billing_audit_log gain updated_at

**Audit ref:** P1 Database (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-db-migrations/src/migrations`
**Effort:** L (1-2 weeks)

Labels: P1-high, area:database · Milestone: M3 — Weeks 5-8: Hardening & onboarding
