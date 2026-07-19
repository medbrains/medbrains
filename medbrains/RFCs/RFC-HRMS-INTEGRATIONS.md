# RFC-HRMS-INTEGRATIONS — External HRMS linkage seam

**Status:** DRAFT · **Owner:** Platform/HR · **Created:** 2026-07-19

## 1. Goal

Let a MedBrains tenant link its in-app HR module (`medbrains-hr`) to an external
HRMS as the system-of-record for employee master, org structure, payroll, leave,
attendance, and shifts — **without forking per vendor**. One provider-adapter
seam (mirroring the proven `medbrains-payment-gateway` multi-provider pattern),
many pluggable HRMS backends, selected per tenant.

Decision from product (2026-07-19): **start basic with one open-source + one
enterprise adapter, capture the full target catalogue here, add the rest later.**

## 2. Why a seam (not a point integration)

The payment layer already demonstrates the shape: `resolve_active_provider` picks
the tenant's provider from `tenant_settings`, each provider is an adapter behind a
common request/response contract, webhooks land on a shared handler, and an
outbox/exception log makes delivery reliable. HRMS is the same problem class
(per-tenant vendor, pull/push sync, webhooks, reliability) so it reuses the same
architecture rather than inventing a second one. See
`crates/medbrains-payment-gateway/src/lib.rs` (`resolve_active_provider`,
`PaymentProvidersResponse`, `*_webhook`, `PaymentWebhookException`).

## 3. Phase 1 — the two starter adapters

| Slot | Pick | Why | Licence | API |
|------|------|-----|---------|-----|
| **Open source** | **Frappe HR (ERPNext HR)** | Literally "the Frappe kind"; self-hostable; native India payroll (PF/ESI/PT), leave, attendance, shift; the reference adapter to build the contract against at zero licence cost. | GPLv3 | Frappe REST (`/api/resource/*`), webhooks, token auth |
| **Enterprise** | **Darwinbox** (default) | India enterprise-HRMS leader, modern documented REST + webhooks, strong footprint in large Indian hospital/enterprise groups. | Commercial | REST + webhooks, OAuth2 |

Enterprise slot is **configurable** — Darwinbox is the recommended default, but the
adapter contract is identical for SuccessFactors/Zoho/Keka (§5), so the choice can
change per deployment without touching core.

## 4. Full target catalogue (later phases)

Build order is demand-driven; the seam makes each a self-contained adapter crate/module.

**Open source:** Frappe HR / ERPNext (P1) · OrangeHRM · Sentrifugo · Horilla.
**Enterprise (India-first):** Darwinbox (P1) · Zoho People · Keka · greytHR · Kredily.
**Enterprise (global):** SAP SuccessFactors (OData v2/v4) · Workday (REST/RaaS) · Oracle HCM Cloud · Bamboo HR · Personio.

## 5. Architecture

### 5.1 Provider contract (Rust trait, new crate `medbrains-hrms-gateway`)

```rust
#[async_trait]
pub trait HrmsProvider: Send + Sync {
    fn code(&self) -> HrmsProviderCode;            // frappe_hr | darwinbox | zoho_people | ...
    // Pull: external -> MedBrains
    async fn list_employees(&self, cfg: &HrmsConfig, since: Option<DateTime<Utc>>) -> Result<Vec<ExternalEmployee>>;
    async fn list_org_units(&self, cfg: &HrmsConfig) -> Result<Vec<ExternalOrgUnit>>;
    async fn list_attendance(&self, cfg: &HrmsConfig, range: DateRange) -> Result<Vec<ExternalAttendance>>;
    async fn list_leave(&self, cfg: &HrmsConfig, range: DateRange) -> Result<Vec<ExternalLeave>>;
    async fn list_payroll(&self, cfg: &HrmsConfig, period: PayPeriod) -> Result<Vec<ExternalPayslip>>;
    // Push: MedBrains -> external (opt-in per entity per tenant)
    async fn push_attendance(&self, cfg: &HrmsConfig, rows: &[AttendanceUpsert]) -> Result<PushReceipt>;
    async fn push_shift_roster(&self, cfg: &HrmsConfig, rows: &[ShiftUpsert]) -> Result<PushReceipt>;
    // Inbound webhook (vendor -> us), verified + normalised to an event
    async fn parse_webhook(&self, cfg: &HrmsConfig, headers: &HeaderMap, body: &[u8]) -> Result<HrmsEvent>;
}
```

Common DTOs (`ExternalEmployee`, `ExternalOrgUnit`, …) are the neutral shape; each
adapter maps its vendor payload into them. Direction of truth is **per entity, per
tenant** (e.g. employee master = external pull; shift roster = MedBrains push).

### 5.2 Config & resolution

- Per-tenant config in `tenant_settings` under `hrms.*` (provider code, base URL,
  auth secret ref, enabled entities, sync cadence, direction map), resolved exactly
  like `resolve_active_provider`. Secrets go through the existing secret/KMS path,
  never plaintext.
- `GET /api/hrms/providers` lists available adapters + which is active (mirror of
  `list_payment_providers`).

### 5.3 Data-model linkage (migration)

- Add nullable `external_source` + `external_ref` + `external_synced_at` to
  `employees`, `designations`/org units, `hr_attendance`, `hr_leave_requests`,
  `hr_shifts`, `payroll_runs`/payslips.
- `hrms_sync_mappings(tenant_id, entity, internal_id, provider, external_ref, hash, updated_at)`
  — idempotent upsert key; `hash` skips no-op writes (DP: don't re-write unchanged rows).
- `hrms_sync_runs` + `hrms_sync_exceptions` (mirror `PaymentWebhookException`) for
  observability and replay.

### 5.4 Reliability

- **Pull:** scheduled per-tenant sync (cursor = `external_synced_at`, bounded page
  size, capped retry + backoff) — reuse the shift-scheduler cadence pattern.
- **Push/webhook:** outbox + idempotency key; verify webhook signature per adapter
  (as `verify_webhook_signature` does for payments); dead-letter to
  `hrms_sync_exceptions` with replay.
- Every loop/list/batch bounded; N external rows reconciled via one `ANY($1)` batch
  against `hrms_sync_mappings`, not N round-trips.

### 5.5 API surface (Phase 1)

```
GET  /api/hrms/providers                 list adapters + active
PUT  /api/hrms/config                    set tenant provider + entity/direction map (admin perm)
POST /api/hrms/sync/{entity}             trigger a pull now (employees|org|attendance|leave|payroll)
GET  /api/hrms/sync/runs                 sync history + exceptions
POST /api/hrms/webhook/{provider}        inbound vendor webhook (signature-verified)
```

Frontend: an **HRMS Integrations** admin tab (provider picker + entity/direction
toggles + last-sync status + exception list), gated by an `admin.hrms.manage`
permission. Built from the `@/components/ui` seam; no new page monster (extract as
`pages/admin/hrms/*` from the start).

## 6. Phased rollout

1. **P1a — contract + Frappe HR adapter (open source):** trait + DTOs + config +
   mappings migration + employee/org pull, dry-run against a local Frappe HR. Proves
   the seam end-to-end at zero licence cost.
2. **P1b — Darwinbox adapter (enterprise):** same contract, second adapter; validates
   the abstraction with a real enterprise API + webhook signature path.
3. **P1c — attendance/leave pull + shift push;** exceptions UI + replay.
4. **P2+ — add catalogue adapters on demand** (Zoho People / SuccessFactors / Keka …),
   each a self-contained adapter behind the same trait. Payroll write-back last
   (highest blast radius, statutory review required).

## 7. Compliance & safety notes

- Employee PII/payroll crosses a trust boundary → encrypt in transit, secret-ref
  auth, per-tenant isolation (RLS on all `hrms_*` tables), audit every sync
  who/what/when. IT Act privacy + EHR staff-data norms apply.
- Payroll figures are statutory — payroll write-back is opt-in, reconciled, and
  never auto-finalised from an external push without a MedBrains-side review step
  (reuse `finalizePayrollRun` gate).

## 8. Open questions (decide before P1b)

- Enterprise default confirmed = Darwinbox? (product may pin per target customer).
- Which entity is source-of-truth by default (external employee master vs MedBrains)?
- Sync cadence (realtime webhook vs nightly batch) for attendance at hospital scale.
