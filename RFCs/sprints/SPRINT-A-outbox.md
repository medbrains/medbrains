# Plan — Sprint A: Offline-First Outbox Pattern (Real-World Hospital Use Cases)

## Context

After merging `feature/nuke-builders` (PR #1) we shipped RFC-INFRA-2026-002-Offline-First — an architectural blueprint for hospital downtime survival. **Sprint A is Phase 1, Step 1 of that RFC**.

The driving real-world problem: **MedBrains today has at least one synchronous external HTTP call inside a request transaction (Razorpay, payment_gateway.rs:175,657) that, when the gateway is slow or down, causes:**
- Cashier UI freezes for 10+ seconds
- 502s rolling back already-completed local work
- Double-charges on retry (no idempotency)
- Patient registration blocking on ABHA verify (stub today, but planned)

A hospital must continue operating when the network drops or external services degrade. That requires three things:
1. **Durable outbox** — every external call queued in a transactional table; survives crashes; retries with backoff; promotes to DLQ after exhaustion.
2. **System state middleware** — admin can flip the system into `read_only` or `degraded` mode; UI shows banner; non-critical writes 503.
3. **Hospital-staff-trained operational mode** — patient-care workflows continue on local data even when SMS/payment/ABDM/TPA are unreachable.

This plan grounds those mechanics in concrete real-world hospital scenarios, then specifies the implementation.

---

## 1. Real-world hospital scenarios driving the design

| # | Scenario | Today | After Sprint A | event_type | Tolerance |
|---|----------|-------|----------------|------------|-----------|
| 1.1 | OPD reg, ABHA gateway 504 | Patient created; obligation lost | Patient created + queued; ABHA populated minutes later | `abdm.verify_abha` | Days |
| 1.2 | Appointment booked, Twilio 429 | Booking 500s or rolls back | Booking commits; SMS retried | `sms.appointment_confirmation` | Hours |
| 1.3 | Pharmacy ₹3,840 sale, Razorpay 502 | UI freezes, double-charge risk | `pending` returned in <100ms; retried + idempotent | `payment.create_order` | **Minutes** (cash flow) |
| 1.4 | 02:30 IPD admission, Razorpay flaky | Admission desk paralyzed | Admission proceeds; deposit `pending_capture` | `payment.create_order` (deposit) | Minutes |
| 1.5 | Discharge SMS + email to referrer, SMTP timeout | Stubbed today | Two outbox rows; one DLQs, other succeeds, independent | `sms.discharge_summary`, `email.discharge_summary` | Hours |
| 1.6 | Lab K+ = 6.8 mmol/L critical | No HL7 outbound | Phase-1 routes to in-app + SMS to doctor; HL7 wire format Phase 2 | `lab.critical_value_notify` | **Minutes** clinically |
| 1.7 | Death state-portal report | Manual export | Reserved + stub handler + DLQ | `regulatory.death_report_state` | Hours (24h legal) |
| 1.8 | TPA cashless preauth | Action stub at events.rs:342 | Reserved + durable + stub handler | `tpa.preauth_submit` | Hours |
| 1.9 | Razorpay webhook delivered twice | Mutates state twice | `processed_webhooks` PK on `(provider, event_id)` dedupes | (incoming) | Seconds |
| 1.10 | Daily P&L MIS email to accountant | Not implemented | Cron queues `email.mis_daily_export`, durable across restarts | `email.mis_daily_export` | Days |
| 1.11 | Vaccination reminder T-7d | Not implemented | Cron queues with `next_retry_at = scheduled_send_time` | `sms.vaccination_reminder` | Days |
| 1.12 | Appointment reminder T-24h, T-2h | Not implemented | Two rows queued at booking with future `next_retry_at` | `sms.appointment_reminder_*` | Hours |
| 1.13 | Refund via Razorpay | Sync, same risks as 1.3 | `pending` refund + outbox + webhook → `processed` | `payment.refund` | Minutes-hours |
| 1.14 | CDS critical drug interaction → SMS doctor | Not implemented | Durable; reaches doctor across SMS provider failures | `sms.cds_critical_interaction` | **Minutes** |
| 1.15 | ABDM HIE bundle push on discharge | Not implemented | Reserved + stub handler; wire format Phase 2 | `abdm.hie_bundle_push` | Days |

These 15 scenarios cover the user-facing hospital workflows that depend on external integrations. **Sprint A guarantees durability and retry for ALL of them**, even though the wire-format implementations of ABDM/TPA/HL7-outbound stay as stubs (the queue rows are real and survive; handlers are added Phase 2).

---

## 2. Migration order — Razorpay first

| # | Integration | Source | Why this order | Risk if late |
|---|-------------|--------|----------------|---------------|
| 1 | `medbrains-outbox` infra | new crate | Foundation; everything depends on it | All downstream blocked |
| 2 | Razorpay create_order | `payment_gateway.rs:166-220` | **Real money + sync-blocking = highest blast radius** | Continued double-charge + UI freeze |
| 3 | Razorpay verify + webhook + `processed_webhooks` | `payment_gateway.rs:610-702` + new route | Closes the loop on step 2 | Stale `pending` txns |
| 4 | Twilio SMS (use cases 1.2, 1.5, 1.11–1.14) | `connectors.rs:228-239` | Existing pipeline already routes here; switch dispatcher to outbox-driven | Lost SMS on server crash |
| 5 | Custom HTTP connector | `connectors.rs:243-278` | Trivial after step 4 | None |
| 6 | SMTP / ABDM / TPA / HL7 stub handlers | `connectors.rs:282`, `:301`, `events.rs:342` | Reserve event_types so when wire format lands Phase 2, no route handler changes | None |
| 7 | system_state middleware + admin endpoint | new `middleware/system_state.rs` | Independent of outbox; can land last in sprint | Read-only mode unavailable |

**Explicitly NOT this sprint:** ABDM real wire format, TPA real impl, HL7 outbound real impl. Reserve event types only.

---

## 3. Schema additions — `crates/medbrains-db/src/migrations/130_outbox_and_system_state.sql`

Concrete DDL outline (RLS uses the exact codebase shape `current_setting('app.tenant_id', true)` confirmed in `migrations/060_hr.sql:66-68`):

### Tables

- `system_state` — per-tenant singleton. Columns: `id`, `tenant_id` UNIQUE, `mode TEXT CHECK IN ('normal','degraded','read_only')`, `since`, `reason`, `set_by`, `updated_at`. Trigger `update_updated_at()` (from `001_initial.sql:367`).
- `outbox_events` — durable queue. Columns: `id`, `tenant_id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload JSONB`, `status TEXT CHECK IN ('pending','retrying','sent','failed','dlq')`, `attempts INT`, `next_retry_at`, `created_at`, `sent_at`, `last_error`, `dlq_at`, `idempotency_key`, `claimed_at`, `claimed_by`.
- `outbox_dlq` — terminal failures. Columns: `id`, `original_event_id`, `tenant_id`, `event_type`, `payload`, `attempts`, `last_error`, `moved_at`.
- `processed_webhooks` — incoming idempotency. Columns: `provider`, `event_id`, `received_at`, `tenant_id`, `payload`. **PK `(provider, event_id)`**.

### Indexes

- `outbox_events_drain` ON `(tenant_id, next_retry_at)` WHERE `status IN ('pending','retrying')`
- `outbox_events_aggregate` ON `(tenant_id, aggregate_type, aggregate_id)`
- `outbox_events_idemp` UNIQUE ON `(tenant_id, event_type, idempotency_key)` WHERE `idempotency_key IS NOT NULL`
- `idx_system_state_tenant`, `idx_outbox_dlq_tenant_moved`

### RLS (exact codebase shape)

For every tenant-scoped table:
```sql
ALTER TABLE <tbl> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tbl> FORCE ROW LEVEL SECURITY;  -- catch superuser leaks
CREATE POLICY <tbl>_tenant ON <tbl>
    USING (tenant_id::text = current_setting('app.tenant_id', true));
```

### Worker DB role

`CREATE ROLE medbrains_outbox_worker BYPASSRLS LOGIN PASSWORD '...';` — worker drains across all tenants; sets `app.tenant_id` explicitly per-event before dispatching handler. **This is the right pattern for cross-tenant background workers** (Postgres native, no extension needed).

---

## 4. New crate — `crates/medbrains-outbox/`

Layout:
```
src/
  lib.rs            # public API: queue_in_tx(), queue(), Handler trait, Registry, Worker
  queue.rs          # write-only API for callers
  worker.rs         # tokio task lifecycle, drain loop, FOR UPDATE SKIP LOCKED
  handler.rs        # Handler trait + Registry
  handlers/
    razorpay.rs     # CreateOrderHandler, RefundHandler (typed, real)
    twilio.rs       # SmsSendHandler (typed, real)
    email_stub.rs   # SmtpSendHandler (logs only Phase 1)
    abdm_stub.rs    # VerifyAbhaHandler (logs only Phase 1)
    tpa_stub.rs     # PreauthSubmitHandler (logs only Phase 1)
    hl7_stub.rs     # CriticalValueHandler (logs + falls back to in-app)
    pipeline_fallback.rs  # delegates to events::dispatch_to_pipelines for unregistered event_types
  backoff.rs        # 1s → 5s → 30s → 5m → 30m → 2h → 6h → DLQ at 10 attempts (with ±20% jitter)
  metrics.rs        # pending_age, dlq_size, handler_durations
```

### Public API for callers

```rust
// Inside an existing route handler's tx
outbox::queue_in_tx(
    tx,
    tenant_id,
    OutboxRow {
        aggregate_type: "payment_gateway_transaction",
        aggregate_id: txn.id,
        event_type: "payment.create_order",
        payload: json!({ "txn_id": txn.id, "amount": amount, "currency": "INR" }),
        idempotency_key: Some(txn.id.to_string()),
    },
).await?;
```

### Handler trait

```rust
#[async_trait]
pub trait Handler: Send + Sync {
    fn event_type(&self) -> &'static str;
    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError>;
}
pub enum HandlerError {
    Transient(String),  // retry per backoff
    Permanent(String),  // straight to DLQ (Razorpay 4xx validation, etc.)
}
```

### Worker lifecycle

- `Worker::spawn(pool, registry)` invoked from `main.rs` after `AppState` construction
- Connects with the `medbrains_outbox_worker` `BYPASSRLS` role
- Loop body, every `poll_interval` (default 2s):
  1. `BEGIN; SELECT … FOR UPDATE SKIP LOCKED LIMIT 32 WHERE status IN ('pending','retrying') AND next_retry_at <= now() ORDER BY next_retry_at` (per-tenant fairness via window over `tenant_id`)
  2. For each row: `set_config('app.tenant_id', $1, false)` to scope downstream queries → `UPDATE … SET status='retrying', attempts=attempts+1, claimed_at=now(), claimed_by=$worker_id` → COMMIT
  3. Outside lock: `registry.dispatch(event_type, payload)` → typed handler OR fall back to `events::dispatch_to_pipelines()` (extracted from `events.rs:21`)
  4. On `Ok` → `UPDATE … status='sent', sent_at=now()`. On `Transient` → `UPDATE … next_retry_at = now() + backoff(attempts), last_error=...`. On `Permanent` OR `attempts >= 10` → INSERT into `outbox_dlq`, `UPDATE … status='dlq'`
- **Stale claim reaper**: separate task every 5 min resets rows where `claimed_at < now() - 10 min` AND `status='retrying'` back to `pending` (worker crash recovery)
- Graceful shutdown via `tokio::sync::watch` from `main.rs`

### AppState change

`crates/medbrains-server/src/state.rs:19` — add `pub outbox: Arc<medbrains_outbox::Registry>`. Pool stays on `state.db`.

---

## 5. Integration with existing pipeline framework

The codebase already has `crates/medbrains-server/src/events.rs::emit_event()` (line 21-64) → looks up `integration_pipelines` → executes via `execute_pipeline_safe()` (line 75-141) → walks nodes (`walk_pipeline`) → invokes connectors (`execute_connector_call` at `connectors.rs`).

**Today**: this all happens synchronously inside the caller's request transaction. A Twilio 502 propagates as a 500 to the user.

**Sprint A change** (events.rs:21):
1. Keep `emit_event` signature unchanged.
2. Replace body so the **first** action is `outbox::queue_in_tx(...)` — durable buffer.
3. Move pipeline lookup + execution into a new internal `dispatch_to_pipelines(pool, tenant_id, user_id, event_type, payload)` that the **outbox worker invokes**, not the request handler.
4. Net effect: zero call-site changes; events get crash-survival for free.

**Backwards compat**: pipeline definitions in `integration_pipelines` table untouched. `walk_pipeline`, `execute_node`, `execute_connector_call` reused verbatim.

**Razorpay does NOT go through pipelines** — it has a typed Rust handler (`handlers/razorpay.rs`) because real-money code shouldn't depend on user-defined pipeline JSON.

---

## 6. Razorpay-specific migration

### Current sync-blocking flow (`payment_gateway.rs:166-220`)
- Handler opens tx → calls `https://api.razorpay.com/v1/orders` synchronously inside tx → 5xx returns 500 → txn never written
- If Razorpay returns 200 but our `tx.commit()` fails → **money charged, no record**

### New flow

1. `POST /api/payments/create_order { invoice_id, amount, currency }`
2. Inside one tx:
   - `INSERT INTO payment_gateway_transactions (..., status='pending_gateway', gateway_order_id=NULL, idempotency_key=internal_payment_id)`
   - `outbox::queue_in_tx(event_type='payment.create_order', idempotency_key=internal_payment_id, payload={txn_id, amount, currency})`
   - COMMIT
3. Return `{txn_id, status:'pending'}` to client immediately (<100ms)
4. **Worker drains**. `RazorpayCreateOrderHandler` POSTs Razorpay with `receipt = internal_payment_id` (Razorpay deduplicates on receipt). On success: `UPDATE payment_gateway_transactions SET gateway_order_id=$1, status='created'`. On 4xx: `Permanent` → DLQ + admin alert.
5. **Frontend**: client polls `GET /api/payments/{txn_id}/status` every 2s for ≤30s, then "we'll email you" fallback.
6. **New webhook route** `POST /api/webhooks/razorpay`:
   - Verify HMAC signature (`webhook_secret`)
   - `INSERT INTO processed_webhooks (provider, event_id) VALUES ('razorpay', $event_id) ON CONFLICT DO NOTHING RETURNING id` — if 0 rows returned → 200-OK no-op (duplicate)
   - On `payment.captured` → `UPDATE payment_gateway_transactions SET status='captured'`
   - On `payment.failed` → `UPDATE … status='failed'`, mark linked invoice unpaid, queue `sms.payment_failed`

### Failure mode coverage

| Mode | Mitigation |
|------|-----------|
| Gateway down | Outbox retries; client polls; eventually succeeds or DLQs |
| Webhook lost | Reconciliation cron polls Razorpay `Orders/{id}` for txns `status='created'` older than 5 min |
| Duplicate webhook | `processed_webhooks` PK on `(provider, event_id)` |
| Partial capture | Webhook gives canonical state — our row mirrors |
| Double-create at gateway | `receipt = internal_payment_id` makes Razorpay dedupe |

---

## 7. SystemState middleware

- `system_state` per-tenant singleton (mode `normal | degraded | read_only`).
- Middleware at `crates/medbrains-server/src/middleware/system_state.rs`. Wraps non-GET routes. Reads cached state (`Arc<RwLock<HashMap<TenantId, (Mode, Instant)>>>`, refresh every 30s).
- Behavior:
  - `normal` → pass
  - `read_only` → 503 with body `{error:"system_read_only", since, reason}`
  - `degraded` → check route path against allowlist (registration, drug admin MAR, vitals POST). Everything else → 503.
- Admin endpoint `POST /api/admin/system_state { mode, reason }` requires `admin.system_state.manage`. Cache invalidation broadcast via existing `state.queue_broadcaster` so all in-flight middleware refreshes within 1s.

### Permission additions (`crates/medbrains-core/src/permissions.rs`)

```rust
pub mod admin {
    // ...existing...
    pub mod system_state { pub const MANAGE: &str = "admin.system_state.manage"; }
    pub mod outbox {
        pub const VIEW: &str = "admin.outbox.view";
        pub const RETRY: &str = "admin.outbox.retry";
        pub mod dlq { pub const MANAGE: &str = "admin.outbox.dlq.manage"; }
    }
}
```

Mirror in `packages/types/src/permissions.ts` under `P.ADMIN.SYSTEM_STATE.*` and `P.ADMIN.OUTBOX.*`.

---

## 8. RLS hardening — what extensions/options apply

| Mechanism | Pick? | Reason |
|-----------|------|--------|
| `BYPASSRLS` role attribute | **Yes** — for `medbrains_outbox_worker` | Worker drains across tenants; native PG, no extension |
| `FORCE ROW LEVEL SECURITY` | **Yes** — on all new tables | Catches owner/superuser leaks during dev |
| PG 17 RLS planner improvements | **Yes** (when we bump to PG 17) | Free upgrade, faster RLS qual evaluation |
| `SECURITY DEFINER` cached helpers | Defer | Useful only when policies hit complex joins; ours are simple `tenant_id=…` |
| `pg_tle` (AWS Trusted Language Extensions) | **No** | Our policies are simple; no DSL needed |
| `pgsodium` (column-level encrypt + RLS) | Phase 2 | PHI encryption already on Phase 2 list (Aadhaar, ABHA, MLC) |
| `pgaudit` | **Phase 1.5** | Compliance audit log; cheap to enable |
| OPA / Cedar (external policy engines) | **No** | Overkill for our policy shape |
| Materialized authorization views | **No** | Our RLS is `tenant_id` only — already index-friendly |

**Concrete additions to Sprint A:** Add `BYPASSRLS` role for the worker. Add `FORCE ROW LEVEL SECURITY` to every new table in migration 130. PG 17 upgrade is a separate commit on a different branch.

### 8.1 Department-based RLS (compiled, not dynamic SQL)

For workflows where users see data only for their assigned departments (nurse in Ward 5 sees only Ward-5 patients; pharmacy tech sees only their dispensing location's orders), use **session variables + compiled policies** — not app-level dynamic SQL.

**Per-request session vars** — extend existing `medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)` to also set:

```rust
sqlx::query("SELECT set_config('app.department_ids', $1, false)")
    .bind(claims.department_ids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(","))
    .execute(&mut **tx).await?;

sqlx::query("SELECT set_config('app.bypass_dept_rls', $1, false)")
    .bind(if BYPASS_ROLES.contains(&claims.role.as_str()) { "true" } else { "false" })
    .execute(&mut **tx).await?;
```

`claims.department_ids` already in JWT per memory note (access_matrix). Bypass roles: super_admin, hospital_admin.

**Policy template** for dept-scoped tables (e.g., `ipd_admissions`, `pharmacy_orders`, `lab_orders`, `opd_visits`):

```sql
CREATE POLICY <tbl>_tenant_dept ON <tbl> USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    current_setting('app.bypass_dept_rls', true) = 'true'
    OR department_id::text = ANY(
         string_to_array(current_setting('app.department_ids', true), ',')
       )
  )
);
```

**Helper function** (optional, for cleanliness on tables with many policies):

```sql
CREATE FUNCTION current_user_dept_ids() RETURNS text[]
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT string_to_array(NULLIF(current_setting('app.department_ids', true), ''), ',');
$$;

-- usage
USING (
  current_setting('app.bypass_dept_rls', true) = 'true'
  OR department_id::text = ANY(current_user_dept_ids())
);
```

`STABLE PARALLEL SAFE` lets PG memoize per-query and parallelize.

**Indexes** — every dept-scoped table needs `(tenant_id, department_id)` btree to make `ANY(array)` cheap:

```sql
CREATE INDEX <tbl>_tenant_dept_idx ON <tbl> (tenant_id, department_id);
```

**Multi-policy stack** for cross-dept-view permission (e.g., medical superintendent can see all wards):

```sql
-- Always: tenant gate (RESTRICTIVE = AND)
CREATE POLICY <tbl>_tenant ON <tbl> AS RESTRICTIVE
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Visible if: own dept (PERMISSIVE = OR)
CREATE POLICY <tbl>_own_dept ON <tbl> AS PERMISSIVE
  USING (department_id::text = ANY(current_user_dept_ids()));

-- OR has explicit cross-dept permission
CREATE POLICY <tbl>_cross_dept ON <tbl> AS PERMISSIVE
  USING (current_setting('app.has_cross_dept_view', true) = 'true');

-- OR is bypass role
CREATE POLICY <tbl>_bypass ON <tbl> AS PERMISSIVE
  USING (current_setting('app.bypass_dept_rls', true) = 'true');
```

PG ORs PERMISSIVE policies, ANDs RESTRICTIVE. Result: row visible iff `tenant_match AND (own_dept OR cross_perm OR bypass)`.

**Outbox worker pattern** — worker uses `BYPASSRLS` role so it sees all rows. When dispatching a handler that might trigger downstream writes, the worker explicitly sets BOTH `app.tenant_id` AND `app.department_ids` from the event's payload context (the original user's claims captured at queue time, stored in `outbox_events.payload.actor_context`).

**What NOT to do:**

- ❌ Build dynamic `WHERE` clauses in Rust code based on user's departments (fragile, leak-prone)
- ❌ Bypass RLS in app and filter results post-fetch (catastrophic if dev forgets one query)
- ❌ Per-tenant policy variants (`CREATE POLICY foo_tenant_xyz`) — explosion of policies
- ❌ Application-managed materialized "user-can-see" tables — sync drift hell

The compiled policy + session-var pattern is **the** Postgres way. It's already what we do for tenant; extending to department is one extra `set_config` call per request.

**Where to add this in Sprint A:** out of scope for the outbox tables themselves (those are tenant-scoped only). But landing the `set_config('app.department_ids', ...)` call in `set_tenant_context()` is **prerequisite** work — call it Sprint A.5, single small commit, behind a feature flag if needed for rollout.

---

## 9. Frontend touchpoints

- TanStack hook `useSystemHealth()` — polls `/api/health` every 30s; surface `system_state.mode` if backend includes it.
- New `<SystemBanner />` mounted in `AppLayout`. Yellow band for `degraded`, red for `read_only`. Shows `since` and `reason`.
- TanStack mutation global `onError` — catches 503 with `error:'system_read_only'` → toast "System is in read-only mode. Try again shortly."
- Admin DLQ view at `/admin/system` (new tab "Outbox & DLQ"). Two tables: pending events (with attempt counts and ETA) and DLQ (with "Retry" and "Delete" actions). Permission-gated by `P.ADMIN.OUTBOX.*`.

### New backend endpoints (admin-only)

- `GET /api/admin/outbox?status=…&limit=…`
- `POST /api/admin/outbox/{id}/retry` — moves event back to `pending`, resets `attempts=0`, `next_retry_at=now()`
- `DELETE /api/admin/outbox/dlq/{id}`
- `GET /api/admin/system_state` and `POST /api/admin/system_state`

---

## 10. Tests — by use case

| Use case | Test name | Setup | Assertion |
|----------|-----------|-------|-----------|
| 1.3 Razorpay sale | `razorpay_create_order_succeeds_async` | Mock Razorpay 200 after 500ms | Client gets `pending` <100ms; outbox row exists; after worker, `payment_gateway_transactions.status='created'` |
| 1.3 gateway down | `razorpay_gateway_down_retries` | Mock 502 three times then 200 | After 4th tick, status='created'; attempts=4; `last_error` populated for first 3 |
| 1.3 permanent fail | `razorpay_validation_error_dlqs` | Mock 400 amount_too_small | After 1 attempt, row in `outbox_dlq`, status='dlq'; no retry storm |
| 1.9 dup webhook | `razorpay_webhook_idempotent` | Send same `event_id` twice 100ms apart | First updates txn; second 200-OK no-op; txn mutated exactly once |
| 1.9 webhook signature | `razorpay_webhook_rejects_bad_sig` | HMAC mismatch | 401; no row in `processed_webhooks`; no txn mutation |
| 1.2 SMS confirm | `appointment_booking_queues_sms` | Twilio mock 200 | Booking persisted; outbox row `event_type='sms.appointment_confirmation'`; worker drains; status='sent' |
| 1.2 SMS retry | `sms_provider_429_backoff` | Twilio mock 429 twice | attempts=3; backoff visible in `next_retry_at` |
| 1.5 multi-channel independent | `discharge_summary_two_channels_independent` | SMTP mock fails, Twilio mock OK | One row 'sent', other DLQs; **discharge tx itself committed** |
| 1.1 ABHA stub | `patient_registration_queues_abha` | ABDM stub returns deferred | Patient row exists; outbox `event_type='abdm.verify_abha'` pending |
| §7 read_only | `read_only_mode_blocks_writes` | mode='read_only' | `POST /api/patients` 503; GET still 200 |
| §7 degraded | `degraded_mode_allows_registration` | mode='degraded' | `POST /api/patients` 200; `POST /api/billing/invoice` 503 |
| Crash recovery | `outbox_survives_server_restart` | Queue 5 events; SIGKILL before drain; restart | All 5 eventually 'sent' |
| Stale claim | `stale_claim_reaper_resets` | Insert event with `claimed_at = now()-15min`, `status='retrying'` | Reaper resets to `pending` within 5 min |

Tests live in `crates/medbrains-server/tests/integration/outbox/` (new dir). Use existing test harness (cargo test + Postgres testcontainer).

---

## 11. Acceptance criteria

1. **Razorpay no-double-charge**: Cashier completes ₹3,840 sale even when Razorpay returns 502 for 90s; never charged twice; cashier sees `pending → captured` transition without re-clicking.
2. **Patient registration during ABHA outage**: Front desk registers a patient when ABDM is unreachable for 2h; user sees no error; ABHA `verified_at` populates within 5 min of recovery.
3. **Crash safety**: Server SIGKILLed mid-burst loses zero queued events; on restart all `pending`/`retrying` rows drain to completion or DLQ.
4. **DLQ after 10 attempts**: Persistently failing Twilio account moves event to `outbox_dlq` after 10 attempts (~3h elapsed). Admin sees it in UI.
5. **Webhook idempotency**: Duplicate Razorpay webhook in 200ms → no-op via `processed_webhooks` PK.
6. **Read-only mode**: Admin flips `system_state` → banner appears for all logged-in users within 30s; non-GET 503; GETs continue.
7. **No regressions**: Existing `events::emit_event` callers (`routes/patients.rs`, `routes/appointments/*`, `routes/discharge.rs`, `routes/billing.rs`) continue working; user-defined pipelines still fire.
8. **Worker uses BYPASSRLS role**: `medbrains_outbox_worker` connects with `BYPASSRLS`; sets `app.tenant_id` per event; cross-tenant leaks prevented by `FORCE ROW LEVEL SECURITY` on all new tables.
9. **`cargo clippy --all-targets -- -D warnings` clean**, `pnpm typecheck` clean, `pnpm build` clean.

---

## 12. Effort estimate

| Task | Hours |
|------|-------|
| Migration 130 + tests | 4 |
| `medbrains-outbox` crate scaffold + Handler trait + Registry | 8 |
| Worker loop (FOR UPDATE SKIP LOCKED, backoff, DLQ, shutdown, stale-claim reaper) | 12 |
| Integration with `events::emit_event` (extract `dispatch_to_pipelines`) | 4 |
| Razorpay create_order migration | 8 |
| Razorpay verify + webhook + `processed_webhooks` | 10 |
| Twilio handler migration | 4 |
| SMTP / ABDM / TPA / HL7 stub handlers | 4 |
| `system_state` middleware + admin endpoint + permissions | 8 |
| Frontend: SystemBanner + DLQ admin page + 503 onError | 12 |
| Tests (integration suite §10) | 16 |
| Observability: metrics + Grafana panel for DLQ size + oldest-pending age | 4 |
| **Total** | **~94h ≈ 2.5 dev-weeks** |

---

## 13. Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Worker double-dispatches across multi-process Axum | `FOR UPDATE SKIP LOCKED` + `attempts` increment in lock tx + `claimed_by` worker ID |
| Razorpay charges but `gateway_order_id` lost | `receipt = internal_payment_id` lets us reconcile via `GET /orders?receipt=…` |
| Pipeline framework interaction breaks | Keep `dispatch_to_pipelines` semantics identical to today's `emit_event`; covered by existing pipeline tests |
| Outbox table unbounded growth | Separate cron prunes `sent` rows after 90 days (out-of-scope for this sprint, comment in migration) |
| SystemState cache stale after admin flip | 30s refresh window acceptable; explicit cache-bust via `queue_broadcaster` on admin update |
| Migration 130 conflicts at merge | Coordinate at merge; rename if a parallel branch lands a migration first |
| Worker connects without `BYPASSRLS` and silently filters rows | Worker startup asserts `current_user` has `BYPASSRLS` via `pg_roles` query; bail if not |

---

## 14. Out of scope (this sprint)

- ABDM real wire format (Phase 2)
- TPA preauth real wire format (Phase 2)
- HL7 outbound real wire format (Phase 2)
- Patroni HA cluster (separate Sprint B)
- Ward-level downtime PDF snapshots (separate Sprint C)
- Pre-printed downtime forms + back-entry UI (Sprint C)
- Mobile/WatermelonDB offline (Phase 2)
- DR site failover (Phase 4)
- NATS JetStream transport (Phase 3)
- pg_cron-based dispatcher (we use Tokio worker; pg_cron is a Phase-3 alternative)
- CRDT collaborative editing (RFC-INFRA-2026-001)
- PG 17 upgrade (separate branch)
- `pgsodium` PHI column encryption (Phase 2)
- `pgaudit` enable (Phase 1.5 — separate small branch)

---

## 15. Critical files to modify / create

### New files

- `medbrains/crates/medbrains-db/src/migrations/130_outbox_and_system_state.sql`
- `medbrains/crates/medbrains-outbox/Cargo.toml`
- `medbrains/crates/medbrains-outbox/src/lib.rs`
- `medbrains/crates/medbrains-outbox/src/queue.rs`
- `medbrains/crates/medbrains-outbox/src/worker.rs`
- `medbrains/crates/medbrains-outbox/src/handler.rs`
- `medbrains/crates/medbrains-outbox/src/backoff.rs`
- `medbrains/crates/medbrains-outbox/src/metrics.rs`
- `medbrains/crates/medbrains-outbox/src/handlers/{razorpay,twilio,email_stub,abdm_stub,tpa_stub,hl7_stub,pipeline_fallback}.rs`
- `medbrains/crates/medbrains-server/src/middleware/system_state.rs`
- `medbrains/crates/medbrains-server/src/routes/admin_system_state.rs`
- `medbrains/crates/medbrains-server/src/routes/admin_outbox.rs`
- `medbrains/crates/medbrains-server/src/routes/webhooks_razorpay.rs`
- `medbrains/crates/medbrains-server/src/routes/payment_status.rs`
- `medbrains/crates/medbrains-server/tests/integration/outbox/` (test dir)
- `medbrains/apps/web/src/components/SystemBanner.tsx`
- `medbrains/apps/web/src/hooks/useSystemHealth.ts`
- `medbrains/apps/web/src/pages/admin/system.tsx`
- `RFCs/sprints/SPRINT-A-outbox.md` (sprint doc)

### Modified files

- `medbrains/Cargo.toml` (workspace adds `medbrains-outbox`)
- `medbrains/crates/medbrains-server/Cargo.toml` (depends on `medbrains-outbox`)
- `medbrains/crates/medbrains-server/src/state.rs` (add `outbox: Arc<Registry>`)
- `medbrains/crates/medbrains-server/src/main.rs` (spawn worker after AppState)
- `medbrains/crates/medbrains-server/src/events.rs` (refactor `emit_event` to write outbox first; extract `dispatch_to_pipelines`)
- `medbrains/crates/medbrains-server/src/routes/payment_gateway.rs` (replace sync Razorpay calls with outbox queue)
- `medbrains/crates/medbrains-server/src/routes/mod.rs` (register new routes)
- `medbrains/crates/medbrains-server/src/routes/health.rs` (extend response with outbox metrics + system_state)
- `medbrains/crates/medbrains-core/src/permissions.rs` (add system_state + outbox permissions)
- `medbrains/packages/types/src/permissions.ts` (mirror in TS)
- `medbrains/apps/web/src/components/AppLayout.tsx` (mount SystemBanner)
- `medbrains/apps/web/src/lib/api.ts` (add 503 global onError)

### Existing functions/utilities to reuse (no rebuild)

- `medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id)` — used in every write handler today
- `update_updated_at()` trigger from `001_initial.sql:367`
- `events::execute_pipeline_safe()` (`events.rs:75-141`) — outbox dispatcher invokes it for unregistered event_types
- `events::walk_pipeline`, `execute_node`, `execute_connector_call` (`events.rs`, `connectors.rs`) — reused verbatim
- `state.queue_broadcaster` (existing WebSocket broadcaster) — reused for cache invalidation on admin system_state flip
- `AppError` (`error.rs`) — outbox helper returns this
- `Claims` (`middleware/auth.rs`) — handlers extract tenant_id + user_id from this

---

## 16. Verification — end-to-end

Manual + automated:

1. **Start dev stack**: `cd medbrains && make dev` (Postgres + backend + frontend)
2. **Apply migration 130**: backend startup auto-runs SQLx migrations; verify `\dt` shows `outbox_events`, `outbox_dlq`, `system_state`, `processed_webhooks`
3. **Verify BYPASSRLS role**: `\du medbrains_outbox_worker` — confirm `Bypass RLS` attribute
4. **Razorpay happy path**: open `/pharmacy` → POS sale ₹100 → verify response <200ms with `{status:'pending'}` → wait 2-3s → poll `/api/payments/{txn_id}/status` returns `created`
5. **Razorpay 502 simulation**: stub network with `tc qdisc` or wiremock to return 502 → verify pharmacy sale completes in <200ms with `pending` → after backoff retries, eventually transitions
6. **Razorpay webhook idempotency**: replay same webhook curl twice → verify only first mutates txn
7. **Read-only mode**: `POST /api/admin/system_state {mode:'read_only'}` → verify red banner appears in browser within 30s → verify `POST /api/patients` returns 503
8. **Crash recovery**: queue 10 events with mock Twilio offline → SIGKILL backend → bring backend back → verify all 10 eventually `sent`
9. **Run integration suite**: `cargo test -p medbrains-server --test integration outbox`
10. **Run frontend tests**: `pnpm test`
11. **Observability**: open Grafana / `GET /api/health` → verify outbox pending count, DLQ count, oldest-pending age fields are present and updating

### CI gates (must pass before merge)

- `cargo clippy --all-targets -- -D warnings`
- `cargo test --workspace`
- `pnpm typecheck`
- `pnpm build`
- `make check-api` (frontend↔backend route contract)
- `make check-types` (TS interfaces match Rust structs)
- All 13 tests in §10 green

---

## 17. Branch + PR plan

- Branch: `feature/sprint-a-outbox` (off `master` after `feature/nuke-builders` is merged)
- Single PR — too coupled to split (worker + helper + first handler must land together to be testable)
- PR title: *Sprint A: outbox + system_state — Razorpay + SMS migrated, hospital survives external outages*
- PR body cites this plan + acceptance criteria
- Reviewer focus areas in PR description: (a) worker concurrency safety, (b) Razorpay idempotency, (c) RLS BYPASSRLS+FORCE combo, (d) `events::emit_event` refactor backwards compat
