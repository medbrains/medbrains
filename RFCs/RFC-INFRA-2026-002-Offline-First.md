# RFC-INFRA-2026-002 — Offline-First, Business Continuity, and Disaster Recovery

**Status:** Draft (architecture)
**Author:** MedBrains Infrastructure
**Date:** 2026-04-28
**Supersedes:** none
**Depends on:** RFC-HMS-2026-003 (TechStack APPROVED), RFC-INFRA-2026-001 (CRDT/EKS/Terraform), RFC-HMS-2026-001 (Core)

## Executive Summary

- **Hospital must remain operational when the network drops.** A tertiary-care HMS that pauses on internet outage is unacceptable — clinically, legally, and reputationally.
- **Enterprise consensus is multi-tier read fallback**: live primary → sync replica → async downtime snapshot → printed packet → paper form → back-entry. Every reviewed vendor (Epic BCA, Cerner 724Access, MEDITECH Downtime Defender) implements the same pattern. Pure-cloud no-fallback (athenahealth) is unsuitable for inpatient hospitals.
- **All chosen tooling is open-source.** Patroni for PG HA, pg_cron for outbox dispatch (Phase 1) → NATS JetStream (Phase 3), WatermelonDB for mobile, IHE XDR for cross-site doc exchange, YottaDB Bourne replication for hierarchical DR. No Oracle, no proprietary DB.
- **Phase plan: 18 months across 4 phases.** Phase 1 (months 1–3) gets us NABH/JCI MOI.14 compliance for a single hospital. Phases 2–4 layer mobile, multi-site, full DR without re-architecture.
- **Compliance posture aligns to NABH 5th ed Ch. 10 (IMS), JCI MOI.14, HIPAA §164.308(a)(7), and HITRUST CSF Cat. 12 (BCM).** Annual full DR drill + quarterly tabletop is the de facto industry cadence.

This RFC is the **server-side BCP** complement to RFC-INFRA-2026-001. RFC-INFRA-001 covers CRDT-based multi-writer offline (mobile + multi-master). This RFC covers **single-site downtime survival**, **outbox-driven external integration resilience**, and **DR site failover** — orthogonal concerns that share schema and tooling but are not in the CRDT path.

---

## Part A — Vendor / Industry Survey

### A.1 — Downtime mechanisms across major HMS vendors

| Vendor | Mechanism | Architecture | Lag / RPO | Source |
|--------|-----------|--------------|-----------|--------|
| **Epic (Hyperdrive)** | BCA Web (read-only via web), BCA PC (cached PDFs on local PC), Shadow Read-Only (SRO) | Periodic snapshot to read replica + pre-cached PDF packets per ward | 15–60 min (implementer-configured) | sphp.com, healthcareitleaders.com, uiowa.edu |
| **Cerner Millennium / Oracle Health** | 724Access Downtime Viewer + Oracle GoldenGate | Continuous logical replication → standby + local 724 cache appliance | <2 min; 48-hour to 7-day window | wiki.cerner.com, oit.va.gov; UPMC reports 12-min RTO |
| **MEDITECH Expanse** | Downtime Defender (Acmeware, 3rd-party) | Periodic batch PDF export to local + cloud | hours | acmeware.com |
| **Allscripts/Veradigm Sunrise** | None native; 3rd-party appliances (CareFinity, NetSafe) | Vendor-agnostic downtime cache | varies | vendor docs |
| **athenahealth (athenaOne)** | None — pure cloud | Customer's own internet redundancy + paper procedures | N/A — site dies if WAN dies | status.athenahealth.com |
| **InterSystems IRIS / Caché** (Epic engine) | ECP (distributed cache), Mirroring (sync HA), Shadowing (async DR) | App servers cache globals; mirror failover redirects ECP transparently | Sync = 0 data loss; async = secs–mins | docs.intersystems.com |
| **VistA (US VA)** | Per-site MUMPS instance, federation | Each site runs its own VistA; cross-site sync via Health Data Repository | site-local | en.wikipedia.org/wiki/VistA |
| **Bahmni (OpenMRS)** | Bahmni Connect — single-user offline app + nightly batch sync | Per-location nightly zip + concept-tagged offline data | up to 24h | talk.openmrs.org |

**Takeaway.** Epic Chronicles' resilience is overwhelmingly **InterSystems IRIS engineering, not Epic-specific code.** This means we can buy 80% of Epic-grade resilience with off-the-shelf Postgres tooling (Patroni gives us mirroring, streaming replication gives us shadowing, our own snapshot service gives us BCA).

### A.2 — Integration-layer reliability patterns

| Pattern | Mechanism | MedBrains application |
|---------|-----------|----------------------|
| **HL7 v2 store-and-forward** | Sender holds messages until ACK; bounded exponential backoff; on-disk durable queue (Mirth Connect persistent queueing) | Lab analyzer ingestion gateway must have on-disk queue |
| **DICOM C-STORE retry** | DICOM does not mandate retry semantics; modalities buffer 24–72h on console; PACS-side responsibility for cache | Radiology gateway implements local DICOM cache + retry |
| **FHIR Subscriptions (R5 backport)** | `rest-hook` POST notifications; `timeout` extension; **no built-in guaranteed delivery** | Wrap with our outbox — never rely on FHIR retry alone |
| **IHE XDS vs XDR** | XDS = stateful Repository+Registry; XDR = stateless point-to-point Provide-and-Register, idempotent on receiver | XDR pattern preferred for cross-site clinical doc exchange — no registry SPOF |
| **Transactional Outbox** | Same-transaction insert into `outbox_events`; CDC tail or polling worker drains | Phase 1 = pg_cron polling Rust worker; Phase 3 = NATS JetStream |

**Pick.** Outbox via pg_cron polling worker is the right Phase-1 default. Skip Debezium/Kafka — operational burden disproportionate to single-hospital scale.

---

## Part B — Regulatory Baseline

| Standard | Requirement | RTO/RPO guidance |
|----------|-------------|------------------|
| **HIPAA §164.308(a)(7)** | Contingency Plan = Data Backup + DR Plan + Emergency Mode Operation Plan + Testing + Applications/Data Criticality Analysis | Not numerically mandated; industry practice **RPO 1–4h, RTO ≤24h** for EHR; near-zero RPO for active records is best practice |
| **JCI MOI.14** (6th ed.) | "Develop, maintain, and **test** a program for response to planned and unplanned downtime of data systems," including patient-care procedures during downtime and **data recovery** post-downtime | Annual test minimum (frequency not numerically specified in public excerpt — interpreted as annual full + quarterly tabletop) |
| **NABH 5th ed Ch. 10 (IMS)** | Hospital information management plan must include data backup, security, and contingency for downtime | Hospital-defined; aligned with JCI |
| **HITRUST CSF Control Cat. 12 (BCM)** | **Annual** business continuity assessment; documented contingency policy; tested recovery plans; alternate processing arrangements | Implementer-defined; tested annually |
| **ABDM / DPDPA 2023** | No explicit downtime RTO/RPO mandate; consent + data-residency focus | Defer to NABH for downtime BCP |

**Caveats.** Exact JCI/NABH drill frequency is not in public excerpts; the standards say "test" without a number. ABDM is silent on downtime. The **annual full DR drill + quarterly tabletop** cadence is industry-standard, not contractual.

---

## Part C — MedBrains Stack Decisions

### C.1 — Component picks

| Layer | Pick | Rejected | Reason |
|-------|------|----------|--------|
| **PG HA** | **Patroni + etcd** (3-node, sync replication) | pg_auto_failover | Patroni is quorum-safe; pg_auto_failover has SPOF on monitor |
| **YottaDB DR** | Bourne replication (native) | (none — only one option) | Same async-shadow pattern as InterSystems |
| **Outbox transport** | pg_cron polling Rust worker (Phase 1) → NATS JetStream (Phase 3) | Debezium / Kafka | Skip CDC infra at single-hospital scale; NATS JetStream is already in our roadmap |
| **Mobile offline** | **WatermelonDB** | ElectricSQL, Couchbase Mobile | WatermelonDB is RN-native, server-authoritative; ElectricSQL leaks PG schema to device; Couchbase Mobile adds non-PG source of truth |
| **Web read cache** | Service worker + WebSocket reconnect with exponential backoff | localStorage hand-rolled | SW is browser-native, cache-first strategy with stale-banner |
| **Lab/PACS gateway** | On-disk durable queue (per gateway) | In-memory queue | Mandate persistence to survive gateway crash |
| **Cross-site doc exchange** | IHE XDR (point-to-point, idempotent) | IHE XDS (stateful registry) | XDR is stateless — no registry SPOF |
| **Snapshot generator** | Rust cron job → PDF per ward + on-prem print queue | Acmeware / commercial | We control the format; matches Epic BCA-PC pattern |

### C.2 — Schema additions (Phase 1)

```sql
-- System operational mode (drives middleware short-circuit)
CREATE TABLE system_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'normal',        -- normal | degraded | read_only
  since TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  set_by UUID REFERENCES users(id),
  CHECK (mode IN ('normal', 'degraded', 'read_only'))
);

-- Outbox for external integrations (HL7, ABDM, SMS, payment, TPA)
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,                    -- abdm.verify, sms.send, tpa.preauth, ...
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | sent | failed | retrying | dlq
  attempts INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  dlq_at TIMESTAMPTZ
);
CREATE INDEX ON outbox_events (tenant_id, status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

CREATE TABLE outbox_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  last_error TEXT,
  attempts INT,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Periodic ward-level snapshots (Epic BCA-PC equivalent)
CREATE TABLE downtime_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ward_id UUID NOT NULL,
  snapshot_type TEXT NOT NULL,                 -- census, mar, vitals, ot_schedule, lab_pending
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_path TEXT NOT NULL,                     -- on-prem file share path
  sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL
);
CREATE INDEX ON downtime_snapshots (tenant_id, ward_id, snapshot_type, generated_at DESC);

-- Pre-printed paper form templates
CREATE TABLE downtime_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,                          -- admission, mar, vitals, ot_consent, discharge, rx
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  pdf_template_path TEXT NOT NULL,
  fields JSONB NOT NULL,                       -- structured field definitions for back-entry
  UNIQUE (tenant_id, code, version)
);

-- Back-entry of paper forms after recovery
CREATE TABLE downtime_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES downtime_form_templates(id),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID,
  paper_captured_at TIMESTAMPTZ NOT NULL,      -- when clinician wrote on paper
  back_entered_at TIMESTAMPTZ NOT NULL,        -- when ward clerk re-keyed
  back_entered_by UUID NOT NULL REFERENCES users(id),
  scan_attachment_id UUID,                     -- scanned PDF of original
  structured JSONB NOT NULL                    -- back-entered field values
);

-- Mobile/offline write audit (complements WatermelonDB sync)
CREATE TABLE offline_writes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  device_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('insert','update','delete')),
  local_ts TIMESTAMPTZ NOT NULL,               -- client's local timestamp
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conflict_resolution TEXT,                    -- server_wins, last_write_wins, manual
  original_payload JSONB
);

-- DR drill execution log (NABH/JCI evidence)
CREATE TABLE dr_drill_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  drill_type TEXT NOT NULL,                    -- tabletop | partial_failover | full_failover
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  rto_target INTERVAL,
  rto_actual INTERVAL,
  rpo_target INTERVAL,
  rpo_actual INTERVAL,
  issues TEXT,
  signed_off_by UUID REFERENCES users(id),
  signed_off_at TIMESTAMPTZ
);
```

**RLS.** All tables above carry `tenant_id` and use the standard `medbrains_tenant_isolation` RLS policy. `system_state` is admin-only.

### C.3 — Backend service additions

| Component | Crate / location | Responsibility |
|-----------|------------------|---------------|
| **Outbox dispatcher** | `crates/medbrains-outbox/` | Tokio task; polls `outbox_events` where `status IN ('pending','retrying')`; per-event-type handler dispatches to ABDM/SMS/TPA/payment/HL7; exponential backoff (1s → 5s → 30s → 5m → 30m → 2h → DLQ at 10 attempts) |
| **Snapshot generator** | `crates/medbrains-snapshots/` | Cron-driven (every 15 min); emits per-ward PDFs (census, MAR, vitals, OT schedule, pending labs) to on-prem file share + spools to ward printer |
| **System state middleware** | `crates/medbrains-server/src/middleware/system_state.rs` | Reads `system_state.mode`; in `read_only`: blocks writes with 503 + UI banner; in `degraded`: allows critical writes only (registration, drug admin, vitals) and queues non-critical to outbox |
| **DR drill runbook** | `RFCs/runbooks/dr-drill.md` | Quarterly tabletop checklist + annual full-failover steps |

---

## Part D — Phased Blueprint

### Phase 1 — Single-hospital network/server outage survival (months 1–3)

**Goal:** hospital LAN keeps operating when WAN dies or primary PG fails.

- Patroni 3-node cluster (1 primary + 2 sync replicas) on hospital LAN; HAProxy/PgBouncer in front for connection routing
- `system_state` table + middleware short-circuit; UI banner "System in degraded mode"
- `outbox_events` + `medbrains-outbox` worker; audit every `routes/*.rs` handler that calls external HTTP and move behind outbox writes
- `medbrains-snapshots` cron service; emits ward PDFs every 15 min to local file share + on-prem print queue
- `downtime_form_templates` + `downtime_form_submissions` schema + back-entry UI
- Pre-printed PDF templates for top-20 forms (admission, MAR, vitals, OT consent, discharge summary, lab/radiology requisition, prescription, ICU flow sheet, etc.) checked into `RFCs/forms/downtime/`
- Service worker in React: caches GET responses for 30 min; "showing data from HH:MM" banner when stale
- DR drill runbook v1; first quarterly tabletop executed
- **Compliance milestone:** JCI MOI.14 / NABH IMS pass for single-hospital deployment

### Phase 2 — Mobile and bedside offline (months 3–6)

- `apps/mobile` adopts WatermelonDB with per-user sync window (assigned patients, last 30 days)
- Sync adapter in Axum: `pull_changes(since)` + `push_changes(localChanges)` endpoints
- Conflict policy: server-wins for clinical writes, last-write-wins for non-clinical metadata, every override logged in `offline_writes`
- SQLCipher encryption at rest on device; auto-purge on logout or after 7 days inactive
- Bedside tablet app (`apps/tv` companion) caches read-only patient summary + drug round; participates in WatermelonDB sync
- **Cross-reference:** RFC-INFRA-2026-001 covers the CRDT layer for collaborative clinical notes (Loro). T2/T3 CRDT data flows through WatermelonDB sync as opaque payload

### Phase 3 — Multi-site / federation (months 6–12)

- Per-hospital site-local Postgres (already aligned with multi-tenant)
- Logical replication of reference data (formulary, ICD, LOINC, masters) from central → sites
- NATS JetStream for cross-site events (patient transfer, central lab results, claims) — replaces pg_cron outbox dispatcher for cross-site events
- YottaDB Bourne replication for hierarchical config trees + UHID counters
- IHE XDR-style point-to-point document exchange between sites for clinical docs (CCDA/FHIR Bundle), idempotent on receiver

### Phase 4 — Full DR (months 12–18)

- DR site (different region/DC): async streaming replication target, RPO ≤ 5 min for clinical, ≤ 1 h for analytics
- Cyber-recovery vault: immutable WORM backups (S3 Object Lock or equivalent), 30-day retention — addresses ransomware scenario
- Tested failover runbook: quarterly tabletop, **annual** full failover drill (cadence per JCI / NABH / HITRUST)
- Runbook RTO target: ≤ 4h; RPO target: ≤ 5min (clinical), ≤ 1h (analytics/reports)
- **Compliance milestone:** HITRUST CSF Cat. 12 (BCM) full pass; JCI MOI.14 multi-site pass

---

## Part E — Operational Practices

### E.1 — Drill cadence

| Cadence | Type | Scope | Evidence |
|---------|------|-------|----------|
| **Annual** | Full failover | Promote DR replica, run hospital workflow against it for 1 hour, measure RTO/RPO | `dr_drill_log` row signed by Hospital Administrator + IT Head |
| **Quarterly** | Tabletop | Walk through scenarios (WAN outage, primary PG dies, ransomware, lab gateway crash, ABDM down for 8h) — no actual failover | `dr_drill_log` row, scenario notes |
| **Monthly** | Backup integrity check | Restore last incremental backup to scratch instance, run `pg_dump --schema-only` diff against primary | Restore log + diff report |
| **Continuous** | Outbox health dashboard | DLQ size, oldest pending event age, attempt distribution — alert if DLQ > 0 or pending age > 5 min | Grafana panel |

### E.2 — Per-ward physical artifacts (mandatory)

- **Downtime binder** in every ward containing pre-printed top-20 form templates, latest BCA snapshot PDF, contact tree
- **Direct-attached printer** at every nursing station (independent of network — USB or local LAN-only)
- **Read-only kiosk** with cached BCA web available for clinicians during outage
- **Posted SOP card** per ward — "What to do if the system is down" (read snapshot → write on paper → back-enter within 24h of recovery)

### E.3 — Back-entry SLA

- Paper documentation must be back-entered to `downtime_form_submissions` within **24 hours** of system recovery
- Back-entry preserves the `paper_captured_at` timestamp for clinical audit (do not stamp `now()`)
- Audit log entries marked `source = 'downtime_paper'` for downstream filtering and audit chain integrity
- Scanned PDF of original paper form attached as `scan_attachment_id` — original paper retained per local retention policy (typically 7 years for clinical)

---

## Part F — Open Questions

1. **WAN failover for ABDM** — when ABDM API is unreachable for >2h, do we allow patient registration to proceed with `abha_pending = true`, or block? (Recommendation: allow; reconcile via outbox on recovery.)
2. **Snapshot retention** — how many days of `downtime_snapshots` PDFs do we keep on the file share? (Recommendation: 30 days rolling.)
3. **Paper form retention** — paper originals stored for 7 years per Indian clinical record norms? Confirm with Hospital Administrator + Legal.
4. **DR site location** — same region different AZ (Phase 4) sufficient, or cross-region (e.g., ap-south-1 → ap-southeast-1) needed? Cost vs latency tradeoff.
5. **Pharmacy NDPS register during outage** — NDPS Act §42 mandates real-time entry. If primary down, can pharmacist write to local replica that auto-promotes? Need legal opinion before allowing.

---

## Part G — Non-Goals

- This RFC does **not** cover application-level CRDT semantics for collaborative editing — see RFC-INFRA-2026-001.
- Does **not** cover DDoS mitigation, WAF, or perimeter security — separate security RFC.
- Does **not** cover capacity planning or autoscaling — Terraform/EKS in RFC-INFRA-2026-001.

---

## References

- [Epic BCA — St. Peter's overview](https://www.sphp.com/downtime/accessing-info-via-bca)
- [Epic BCA Web — University of Iowa](https://epicsupport.sites.uiowa.edu/epic-resources/bca-web)
- [Cerner 724Access — Cerner Wiki](https://wiki.cerner.com/display/public/1101724accessHP/About+724Access+Downtime+Viewer)
- [VA TRM — 724Access](https://www.oit.va.gov/Services/TRM/ToolPage.aspx?tid=14376)
- [UPMC GoldenGate / 724Access case study](http://www.edocscan.com/upmc-emr-Cerner-724access-oracle-goldengate-software)
- [MEDITECH Downtime Defender — Acmeware](https://acmeware.com/meditech-downtime-solution)
- [InterSystems IRIS ECP](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=AFL_ecp)
- [InterSystems IRIS Mirroring](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=GHA_mirror)
- [NetApp Epic architecture](https://docs.netapp.com/us-en/ontap-apps-dbs/epic/epic-arch-overview.html)
- [VistA — Wikipedia](https://en.wikipedia.org/wiki/VistA)
- [Bahmni Connect offline sync](https://talk.openmrs.org/t/bahmni-connect-new-offline-sync-strategy/15129)
- [HL7 v2 ACK / retry / idempotency](https://healthcareintegrations.com/hl7-integration-acks-retries-idempotency/)
- [Mirth Connect persistent queueing](https://github.com/nextgenhealthcare/connect/issues/734)
- [DICOM C-STORE protocol — NEMA](https://dicom.nema.org/dicom/2013/output/chtml/part07/sect_9.3.html)
- [FHIR Subscriptions R5 Backport IG](https://build.fhir.org/ig/HL7/fhir-subscription-backport-ig/)
- [IHE XDS Implementation Notes](https://wiki.ihe.net/index.php/XDS_Implementation_Notes)
- [IHE XDR Implementation](https://wiki.ihe.net/index.php/Cross-enterprise_Document_Reliable_Interchange_Implementation)
- [Debezium Outbox Pattern](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/)
- [HIPAA DR Requirements — Atlantic.net](https://www.atlantic.net/disaster-recovery/what-are-the-hipaa-disaster-recovery-and-business-continuity-requirements/)
- [JCI MOI.14 Insight](https://store.jointcommissioninternational.org/assets/3/7/January_JCInsight_2018.pdf)
- [JCI Downtime Pt. 2 — Data Recovery Tactics](https://www.jointcommissioninternational.org/standards/hospital-standards-communication-center/planned-and-unplanned-downtime-part-2-data-recovery-tactics/)
- [NABH 5th edition standards](https://healthcarearchitecture.in/wp-content/uploads/2022/01/NABH-5-STD-April-2020.pdf)
- [HITRUST BCM — Bryghtpath](https://bryghtpath.com/business-continuity-and-hitrust-certification/)
- [Patroni — Zalando](https://patroni.readthedocs.io/)
- [WatermelonDB sync](https://watermelondb.dev/docs/Sync/Intro)
