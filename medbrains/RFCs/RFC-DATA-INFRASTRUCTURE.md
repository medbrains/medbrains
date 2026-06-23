# RFC — Data Infrastructure: partitioning, retention, analytics, observability & async

**Status:** Accepted (direction) · **Date:** 2026-06-23 · **Supersedes:** the YottaDB "Phase 2" plan (YottaDB removed in #3390)

## Context & decision

MedBrains is a multi-tenant HMS that a hospital may run for **decades**. The datastore decision is settled: **PostgreSQL is the single source of truth** (see `memory/project_oss_and_datastore_decisions.md`). The relational model fits the domain (patients, encounters, orders, billing) and Postgres scales to billions of rows with the right discipline. This RFC makes that discipline **canonical and adopted early**, because retrofitting partitioning onto a billion-row table is painful.

Scope: (1) partitioning, (2) indexing standards, (3) retention & archival, (4) horizontal sharding, (5) caching & real-time, (6) async/eventing, (7) analytics & research, (8) observability, (9) clinical observability, (10) security. Each section states the **standard**, the **now vs later** phase, and the **mechanism**.

## Principles

1. **Postgres is the source of truth.** One consistency model. Other stores (cache, search, analytics) are **derived** and rebuildable.
2. **Partition the firehose tables early**, even if each starts as a single partition — decide the partition key + retention before the table fills.
3. **Binaries never in the DB.** DICOM, scans, PDFs → object storage (already the case).
4. **Analytics off the OLTP path.** Long-range reporting and research run on replicas / a columnar store, never on the live transactional DB.
5. **`tenant_id` is the spine.** It's the RLS key today and the Citus shard key tomorrow — every tenant-scoped table already carries it.
6. **No silent unbounded growth.** Every high-volume table has a partitioning + retention plan or an explicit "unbounded, accepted" note.

---

## 1. Partitioning

### What gets partitioned (the firehose)
Append-mostly, time-ordered, grows without bound. Across the 776 tables, these **classes** qualify:

| Table / class | Partition key | Interval | Sub-partition |
|---|---|---|---|
| `audit_log` (+ every `*_log`, `*_register`) | `created_at` (range) | monthly | by `tenant_id` (hash) at large scale |
| Clinical observations / vitals | `recorded_at` | monthly | by `tenant_id` |
| eMAR / medication administrations | `administered_at` | monthly | — |
| Lab results | `resulted_at` | monthly | — |
| Notifications / messages | `created_at` | monthly | — |
| Queue tokens (`queue_tokens`) | `token_date` | monthly (short retention) | — |
| Encounters / visits | `created_at` | yearly | by `tenant_id` |
| Webhook/callback logs (`nhcx_callback_log`, …) | `created_at` | monthly | — |

**Standard:** PostgreSQL **declarative range partitioning** by a timestamp/date column. Add `tenant_id` hash sub-partitioning only when a single tenant's slice is itself large (multi-hospital chains) — this also pre-positions for Citus.

### Auto-partition creation (the "auto rules")
- **`pg_partman` + `pg_cron`** (best-in-class, de-facto standard). `pg_partman` pre-creates upcoming partitions and runs retention; `pg_cron` schedules `partman.run_maintenance()` in-database — no external scheduler.
- Both ship in the Postgres image / are available in managed PG (RDS, Aurora, CloudNativePG). Added to `docker-compose.yml` Postgres image + a bootstrap migration that `CREATE EXTENSION pg_partman, pg_cron` and registers each partition set.
- **Fallback if extensions are unavailable** (locked-down managed PG): a small `create_future_partitions()` SQL function called from the existing Rust worker (the `medbrains-outbox` worker already runs a loop) on a daily tick. Same effect, no extension dependency.

### Migration approach
- **New high-volume tables:** create them partitioned from day one (`PARTITION BY RANGE (...)`).
- **Existing tables with data:** convert via the partitioned-swap pattern — create `t_partitioned`, attach a DEFAULT partition, copy in batches, swap names in a transaction. Do this **before** production scale; in dev it's a clean migration. Track per-table in a follow-up migration series `02xx_partition_<table>.sql`.

---

## 2. Indexing standards

- **BRIN** indexes on the partition key of append-only time-series tables (tiny, ideal for naturally time-ordered data) — `USING brin (created_at)`.
- **Partial indexes** for hot predicates (e.g. `WHERE status IN ('pending','active')`, `WHERE deleted_at IS NULL`). No `NOW()` in index predicates (migration pitfall — use `IS NULL`).
- **Covering indexes** (`INCLUDE (...)`) for list endpoints to enable index-only scans — pairs with the field-projection work (`memory/project_list_field_projection.md`).
- **Per-partition indexes** are created automatically on partitioned parents (PG 11+).
- **Composite RLS-friendly indexes** lead with `tenant_id` so RLS-filtered queries prune fast.
- Avoid over-indexing write-heavy firehose tables — every index is write amplification; index only what queries need.

---

## 3. Retention & archival

- **Per-data-class retention policy**, defined against **regulatory minimums** (Indian medical-records norms: typically ≥3 yrs outpatient, longer for in-patient/medico-legal/minors; many hospitals keep far longer). Encode as a `data_retention_policy` table the operator can tune per tenant.
- **`pg_partman` retention** detaches/drops partitions past the window automatically.
- **Archival, not deletion**, for regulated data: **detach** old partitions → move to cheaper storage, or export to **Parquet** (columnar, cheap, queryable by DuckDB — see §7). Detached partitions stay attachable for legal hold.
- **Tenant offboarding:** because partitions can be sub-partitioned by `tenant_id`, a departing tenant's data can be dropped/exported as whole partitions.

---

## 4. Horizontal sharding (scale-out)

- **Trigger:** when one Postgres node can't hold the working set or sustain write throughput (multi-hospital national scale).
- **Mechanism:** the **Citus** extension — distribute tables by **`tenant_id`** (our RLS key). Postgres → distributed Postgres with the **same SQL + same relational model**; no app rewrite.
- Reference tables (ICD-10, LOINC, drug master) become Citus *reference tables* (replicated to every node). Tenant-scoped tables become *distributed tables*.
- This is a **later** phase — documented now so the schema stays shard-clean (every distributed table keyed on `tenant_id`, no cross-tenant joins without it).

---

## 5. Caching & real-time — Redis / Dragonfly

- **Role:** ephemeral, rebuildable. (a) hot read cache (config, permissions, reference lookups), (b) **real-time state** that's read-heavy and latency-sensitive — live **bed boards**, OPD **queue/token** displays pushed to TV surfaces, (c) rate-limiting / idempotency keys, (d) pub/sub fan-out to the WebSocket broadcaster.
- **Dragonfly** preferred (Redis-API-compatible, far better memory efficiency + multi-threaded) — drop-in for the Redis protocol.
- **Rule:** never the source of truth. Postgres remains authoritative; Redis is a cache/broadcast layer with TTLs. This is the correct home for the one real-time hotspot YottaDB was (wrongly) speced for.
- **Phase:** add when the bed/queue boards or permission checks show measurable DB pressure — not before.

---

## 6. Async & eventing — outbox + NATS

We already have the **transactional outbox** (`medbrains-outbox`): events written in the same Postgres transaction as the state change, a worker drains them. This gives **exactly-once-ish, durable, ordered** delivery with zero extra infra — correct for **indents, payments, notifications, ABDM/NHCX callbacks** where losing an event is unacceptable.

- **Keep the outbox** as the system of record for async work. It's the right default for indents (an indent state-change must never be lost).
- **Add NATS JetStream** when we need: (a) **fan-out** to many independent consumers, (b) **cross-service streaming** (analytics pipeline, search indexer, edge sync), (c) **high-throughput** event volume the single-DB outbox worker can't drain. NATS becomes a **transport downstream of the outbox** (outbox → NATS publisher), preserving the transactional guarantee while gaining fan-out/throughput. Do **not** replace the outbox with raw NATS publishing from handlers — that reintroduces dual-write inconsistency.
- **Indents specifically:** state machine in Postgres + outbox events (`indent.raised`, `indent.approved`, `indent.issued`); a NATS stream later lets pharmacy displays, notifications, and analytics consume the same events independently.
- **Phase:** outbox is live; NATS when fan-out/throughput demands it.

---

## 7. Analytics & research — DuckDB + columnar warehouse

OLTP Postgres must stay lean. Analytics, BI, and research run **off the transactional path**:

- **Read replica** for operational dashboards that need near-real-time relational queries (streaming replication; zero ETL).
- **DuckDB** as the analyst/research engine over **Parquet** exports of detached partitions (§3) and replica dumps. DuckDB is embedded, columnar, blazing on aggregates, and reads Parquet directly — ideal for ad-hoc analysis, cohort building, and research extracts **without touching production**. It can even query Postgres directly (`postgres_scanner`) against the replica.
- **Columnar warehouse** (ClickHouse / Postgres+Citus columnar / TimescaleDB compression) for standing large-scale aggregates when DuckDB-on-Parquet outgrows a single analyst box.
- **TimescaleDB** option for the time-series firehose (vitals, device data, audit): hypertables + **90%+ native compression** + continuous aggregates — evaluate vs plain partitioning when those tables dominate storage.
- **De-identification boundary (hard rule):** research/analytics datasets are **de-identified** at export (the project already enforces "de-identified knowledge only, never PHI" — see the Clinical Knowledge Base module). PHI never leaves the governed OLTP/replica boundary into research sandboxes without consent + de-identification.

---

## 8. Observability (systems)

Currently: `tracing` + `tracing-subscriber` (structured JSON). Make it a full pillar:

- **OpenTelemetry**: instrument the Axum server with `tracing-opentelemetry` → export **traces** (OTLP) to **Tempo/Jaeger**, **metrics** to **Prometheus**, **logs** (already structured) to **Loki**. One `opentelemetry` pipeline, vendor-neutral.
- **RED/USE metrics**: request rate/errors/duration per route; DB pool saturation, query latency, partition sizes, outbox lag, cache hit-rate.
- **Dashboards**: **Grafana** (Tempo + Prometheus + Loki) — the standard open stack, self-hostable (fits the DPG/on-prem story).
- **SLOs + alerting**: p99 latency, error budgets, XID-age (the Postgres wraparound watch), autovacuum lag, partition-creation success, outbox backlog.
- **Health**: `/api/health` already reports Postgres + authz backend; extend with readiness (migrations applied, pool healthy) for k8s probes.

---

## 9. Clinical observability

Distinct from systems observability — **observing care quality and patient safety**, a regulatory expectation (NABH/JCI). Built **on the analytics layer** (§7), surfaced as dashboards:

- **Clinical KPIs / quality indicators**: the existing `quality_indicators` module — auto-compute from clinical data (LAMA rate, infection rate, mortality, readmission, door-to-needle, OT utilisation, discharge TAT — `ipd_discharge_tat_logs` already exists).
- **Surveillance**: HAI (hospital-acquired infection) surveillance, AMS/antibiotic-stewardship (AWaRe), sepsis early-warning, **notifiable-disease (IDSP)** detection (already wired in the Clinical Knowledge Base module) — continuous queries/streams over clinical events.
- **Safety signals**: sentinel events (`nabh_sentinel_event_register`), incident/CAPA trends, near-miss rates, medication-error and LASA-event tracking.
- **Mechanism**: continuous aggregates (TimescaleDB) or scheduled materialized views over the replica; alerts via the notification system + NATS streams. **Pluggable AI conclusion layer** (already a seam in the CKB module) consumes these signals — kept auditable and off the PHI-export path.

---

## 10. Security across the data tiers

- **RLS holds across partitions** — policies on the partitioned parent apply to all partitions; verify after every partition migration.
- **Encryption at rest** for the DB volume + object storage; per-tenant crypto material via the existing `SecretResolver`.
- **Replica & analytics access** is least-privilege and de-identified for research; PHI stays inside the governed boundary.
- **Audit** (`audit_log`) is itself partitioned + retained, never truncated — it's the compliance record.
- **Cache** holds no PHI beyond short-TTL operational state; treat Redis as untrusted-at-rest (no long-lived secrets/PHI).

---

## Rollout phases

| Phase | Work |
|---|---|
| **Now** | Adopt the partitioning/index/retention **standards** in this RFC for all new high-volume tables. Add `pg_partman`+`pg_cron` to the Postgres image + a bootstrap migration. Define `data_retention_policy`. Pick BRIN/partial/covering indexes as tables are built. |
| **Near** | Convert existing firehose tables (`audit_log`, `*_log`, vitals, eMAR, lab results, notifications, queue tokens) to partitioned via the swap pattern. Stand up OpenTelemetry → Prometheus/Grafana/Loki/Tempo. |
| **When pressure shows** | Read replica + DuckDB/Parquet research path. Redis/Dragonfly for bed/queue real-time + cache. NATS JetStream downstream of the outbox for fan-out. TimescaleDB for the heaviest time-series. |
| **At national scale** | Citus sharding by `tenant_id`. Columnar warehouse for standing analytics. |

## Out of scope (this RFC)

Per-table migration SQL (follow-up `02xx_partition_*` series), the analytics ETL/de-id pipeline detail, and the AI clinical-conclusion model — each its own RFC. This document fixes the **direction and standards** so the codebase grows shard-clean and partition-ready from here.
