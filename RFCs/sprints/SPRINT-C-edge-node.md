# Sprint C — Hospital Edge Node + CRDT (Offline Survival)

## Context

Sprint A: app survives external integration outages (Razorpay/Twilio/ABDM down).
Sprint B: app survives Postgres failure (cluster-side HA).

**Sprint C closes the failure mode neither addresses: hospital LAN ↔ cloud
partition.** When the WAN dies, today the hospital is paralyzed:
- Reception can't register patients (auth + tenants table in cloud)
- Nurses can't chart vitals (POST 5xx; user sees red banner)
- Pharmacy can't dispense (NDPS register in cloud)
- Billing freezes (Razorpay create_order needs cloud-side outbox)

The Sprint C deliverable is `apps/edge/` — a single Rust binary on a NUC
in the hospital's LAN that becomes the **local sync hub**. Web/mobile
clients in the hospital connect to the edge node first; the edge node
caches T1 reads, queues T1 writes, and merges T2 CRDT operations.
When the WAN returns, the edge syncs upstream cleanly with hash-chain
audit anchored to cloud.

This is RFC-INFRA-2026-001 Phase 2 + the "edge node" pieces of the
offline-first RFC, scoped to a single shippable PR.

---

## 1. Tier model — what stays local vs cloud

Patient-care continuity demands writes survive offline. The data model
has three tiers (already documented in RFC-INFRA-2026-001 §A.1):

| Tier | Examples | Offline behavior |
|---|---|---|
| **T1 server-authoritative** | Billing invoices, NDPS register, blood-bank issue, lab finalised results, prescriptions post-dispense | **Queue locally → replay when WAN returns**; cashier UX shows "queued" badge |
| **T2 CRDT append-only** | Vital signs, nursing notes, ward-round observations, internal chat, queue position | **Multi-writer offline OK**; Loro merges on reconnect |
| **T3 CRDT with commit-gate** | Provisional Rx draft, draft discharge summary | Drafted offline; **sign requires WAN** (atomic against cloud RDS) |

T1 + T3 commit are the hard constraints. Vitals charting (T2) is the
big UX win — offline ward rounds work normally.

---

## 2. medbrains-edge architecture

```
                ┌─────────────────────────────────────────┐
                │  Hospital LAN (private subnet)          │
                │                                         │
                │   ┌─────────────────────────────────┐   │
                │   │  Web/mobile/TV clients          │   │
                │   │  resolve via mDNS:              │   │
                │   │  _medbrains-edge._tcp.local     │   │
                │   └────────────────┬────────────────┘   │
                │                    │                    │
                │      ┌─────────────▼───────────┐        │
                │      │   medbrains-edge (Rust) │        │
                │      │   axum + sqlite + Loro  │        │
                │      │   tcp 8443 (mTLS)       │        │
                │      ├─────────────────────────┤        │
                │      │  + LAN sync hub (WS)    │        │
                │      │  + Outbox WAL queue     │        │
                │      │  + Read cache (Aurora)  │        │
                │      │  + Merkle audit chain   │        │
                │      └─────┬───────────────────┘        │
                │            │ WAN uplink                 │
                └────────────┼────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ medbrains cloud    │
                    │ (Aurora + EKS)     │
                    │ regional sync API  │
                    └────────────────────┘
```

Hardware target: x86_64 NUC, 8 GB RAM, 256 GB SSD, dual-NIC, UPS-backed.
Single Rust binary deployed via FluxCD on a single-node k3s on the same
NUC (so updates ship via `git push`).

---

## 3. New crate — `apps/edge/`

```
apps/edge/
├── Cargo.toml
└── src/
    ├── main.rs            # axum + signal handling + shutdown
    ├── config.rs          # tenant_id, edge_id, WAN endpoint, mTLS cert paths
    ├── lan_hub.rs         # WS hub for in-hospital clients (LAN-side ingress)
    ├── outbox.rs          # WAL queue for T1 writes during WAN outage
    ├── wan_link.rs        # uplink to regional cloud — bidirectional WS sync
    ├── read_cache.rs      # pinned subset of Aurora data (drug catalog, demographics, recent encounters)
    ├── crdt_store.rs      # Loro op log per encounter, persisted in SQLite
    ├── merkle.rs          # tenant audit chain, signed with edge's Ed25519 key
    ├── bootstrap.rs       # device pairing + per-tenant CA cert issue
    └── error.rs
```

### Cargo.toml deps
```toml
[dependencies]
medbrains-core = { path = "../../crates/medbrains-core" }
medbrains-crdt = { path = "../../crates/medbrains-crdt" }   # NEW (see §4)
axum = { workspace = true }
tokio = { workspace = true }
sqlx = { features = ["runtime-tokio", "tls-rustls", "sqlite", "macros"] }
loro = "1"
ed25519-dalek = "2"
sha2 = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
mdns-sd = "0.11"   # mDNS advertisement
rustls = "0.23"
tower-http = { workspace = true }
```

---

## 4. New crate — `crates/medbrains-crdt`

Wraps Loro for both edge node and clients. Compiles to:
- Native (apps/edge, apps/mobile via uniffi)
- WASM (apps/web via wasm-bindgen)

```
crates/medbrains-crdt/
├── Cargo.toml
└── src/
    ├── lib.rs              # AuthzBackend trait + check/write/expand
    ├── containers/
    │   ├── vitals.rs       # LoroList<{ts, hr, bp_sys, bp_dia, spo2, temp_c, actor_id}>
    │   ├── nursing_notes.rs # LoroList of immutable notes with soft-retract flag
    │   ├── care_plan.rs    # LoroMovableTree of tasks with assign/tick ops
    │   └── chat.rs         # LoroList per conversation
    ├── codec.rs            # protobuf wire format for sync (matches RFC-001 §A.4)
    ├── policy.rs           # per-entity merge policies (Owner/Editor/Viewer/...)
    └── version.rs          # schema_version + migrators (M_n→n+1)
```

Choice locked from RFC-INFRA-2026-001: **Loro**, not Automerge or Yjs.
Reasons: Rust-native, columnar wire format (3-4× smaller than Automerge),
typed containers map cleanly to vitals/notes/care-plans, BFT-causal
delivery is first-class.

---

## 5. SQLite schema on edge

```sql
-- Outbox for T1 writes during WAN outage
CREATE TABLE edge_outbox (
    id BLOB PRIMARY KEY,                    -- UUID v7 (time-sortable)
    tenant_id BLOB NOT NULL,
    aggregate_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,                  -- JSON
    idempotency_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
    attempts INT NOT NULL DEFAULT 0,
    next_retry_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    last_error TEXT
);

-- Loro op log per CRDT doc
CREATE TABLE crdt_ops (
    doc_id BLOB NOT NULL,
    op_seq INTEGER NOT NULL,                -- Lamport timestamp
    actor_id BLOB NOT NULL,                 -- (device_id, user_id) hash
    op_bytes BLOB NOT NULL,                 -- Loro-encoded
    PRIMARY KEY (doc_id, op_seq)
);

CREATE TABLE crdt_snapshots (
    doc_id BLOB PRIMARY KEY,
    snapshot_bytes BLOB NOT NULL,           -- Loro snapshot at last sync point
    schema_version INTEGER NOT NULL,
    last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit chain segment held locally during offline window
CREATE TABLE edge_audit_chain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id BLOB NOT NULL,
    event_payload TEXT NOT NULL,            -- JSON
    prev_hash BLOB,                          -- 32 bytes
    hash BLOB NOT NULL,                     -- 32 bytes
    signed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Read cache — pinned subset of Aurora tables
CREATE TABLE edge_read_cache (
    table_name TEXT NOT NULL,
    pk_value BLOB NOT NULL,
    row_json TEXT NOT NULL,                 -- full row as JSON
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (table_name, pk_value)
);

-- Cached: tenants, users, departments, drug_catalog, lab_test_catalog,
-- patients (recent), active encounters, allergies, current admissions
```

---

## 6. Sync protocol (LAN ↔ cloud)

WebSocket primary, HTTP long-poll fallback. mTLS with per-device certs.

```
Client (web/mobile/TV)
   ↓ WSS to edge LAN
edge LAN hub
   ├─→ if WAN up: forward T1 writes to cloud /api/* immediately
   │              + replicate Loro ops via wan_link.rs
   ├─→ if WAN down: queue T1 in edge_outbox + merge T2 locally
   └─→ on WAN recovery:
         1. Drain edge_outbox (in order)
         2. Push Loro op log delta upstream
         3. Pull cloud Loro deltas back
         4. Anchor Merkle chain head to cloud audit_log
```

### Wire format (matches RFC-INFRA-2026-001 §A.4)
```
SyncEnvelope {
    tenant_id: Uuid,
    doc_id: Uuid,
    schema_version: u32,
    since: VersionVector,
    ops: bytes (Loro-encoded delta),
    proof: MerkleProof
}
```

### Idempotency
T1 writes carry `idempotency_key = uuid_v7` generated at the client.
The cloud-side outbox `processed_webhooks` PK pattern (Sprint A) extends
to `processed_edge_writes (edge_id, idempotency_key)` to dedup replayed
writes after WAN flap.

---

## 7. Audit chain integrity

Each audit event on the edge appends to `edge_audit_chain` with
`hash = SHA256(event || prev_hash)`. Chain head signed with the edge's
Ed25519 key (provisioned during pairing).

On reconnect:
1. Edge sends chain segment + signed head
2. Cloud validates linkage against last anchored head for that edge
3. On valid: cloud appends to `audit_log` (T1) and updates anchor
4. On invalid (fork): cloud quarantines the edge, alerts SIEM, forces re-pair

This is the only way to be sure no audit event was dropped during the
offline window — a malicious or buggy edge can't silently omit events
without breaking the chain.

---

## 8. Discovery + pairing

LAN clients find the edge via mDNS:
```
_medbrains-edge._tcp.local
```
Falls back to `edge.<hospital>.medbrains.lan` DNS A record.

Pairing flow (one-time per device):
1. Device boots, no client cert → fetches `/pair-bootstrap` from edge
2. Edge generates per-device cert from per-tenant intermediate CA
3. Device stores cert in keychain (iOS/Android) or browser IndexedDB (web)
4. Subsequent connections use mTLS

---

## 9. Conflict resolution policies

Leaf rules per entity (matches RFC-INFRA-2026-001 §A.5):

| Entity | Policy |
|---|---|
| Vital signs | Append-only LoroList; no merge conflict possible |
| Nursing notes | Append + soft-retract; original preserved |
| Care plan tasks | LoroMovableTree; tick/un-tick via op timestamp |
| Provisional Rx (T3) | CRDT until sign; sign = atomic RDS insert + freeze() op |
| MAR (Medication Admin) | T1 outbox queue; idempotency-keyed replay |
| Chat | LoroList; LWW per message id |

Crucial: **no global LWW default.** Anything not explicitly assigned a
policy is rejected at compile time (Rust enum exhaustiveness in
`medbrains-crdt::policy`).

---

## 10. Tests

| # | Test | Setup | Assertion |
|---|---|---|---|
| 1 | `lan_hub_routes_to_cloud_when_wan_up` | mock WAN, mock client | T1 POST forwarded; status returned |
| 2 | `lan_hub_queues_when_wan_down` | block WAN | T1 POST → 200 with `{queued: true}`; outbox row present |
| 3 | `wan_recovery_drains_outbox_in_order` | queue 5 events offline; bring WAN up | All 5 sent in original order; idempotency keys preserved |
| 4 | `loro_vitals_merge_two_devices` | 2 nurses chart same patient offline | After sync: both nurses' entries present, ordered by Lamport |
| 5 | `audit_chain_anchor_on_reconnect` | offline writes → reconnect | Cloud audit_log has all events with chain linkage intact |
| 6 | `audit_chain_fork_quarantines_edge` | corrupt local chain → reconnect | Cloud rejects; edge enters quarantine state |
| 7 | `t3_sign_requires_wan` | offline sign attempt | 503 with `{error: "wan_required"}` |
| 8 | `read_cache_serves_offline` | WAN down + read drug_catalog | Cached row returned |
| 9 | `mdns_discovery_finds_edge` | start edge → run client | Client resolves via mDNS, mTLS handshake succeeds |
| 10 | `device_pairing_issues_cert` | unpaired device → /pair-bootstrap | Cert returned; subsequent calls authenticated |

Tests in `apps/edge/tests/` (integration) + `crates/medbrains-crdt/tests/`
(CRDT semantics).

---

## 11. Acceptance criteria

1. **8h LAN-only operation:** disconnect WAN, hospital staff register
   patients + chart vitals + chart nursing notes + view drug catalog
   for 8 hours. WAN restored — all events sync within 2 min.
2. **Multi-nurse vitals merge:** 2 nurses on same patient on different
   devices offline; after reconnect both entries visible without
   conflict.
3. **No audit loss:** 1000 audited events queued offline; all 1000 land
   in cloud `audit_log` with valid hash chain.
4. **T1 idempotency:** same outbox event replayed twice produces 1 row
   in cloud, not 2 (via processed_edge_writes PK).
5. **mTLS-only:** plain HTTP (no cert) requests rejected at edge.
6. **mDNS works:** fresh device on LAN discovers edge in <5s.
7. **Cargo clippy + tests green** for both `medbrains-crdt` and
   `apps/edge`.

---

## 12. Effort estimate

| Task | Hours |
|---|---|
| medbrains-crdt crate scaffold | 16 |
| Loro container schemas (vitals, notes, care_plan, chat) | 24 |
| medbrains-crdt sync protocol codec | 16 |
| apps/edge scaffold + axum + signal handling | 8 |
| edge LAN hub (WS + mDNS) | 16 |
| edge outbox WAL + replay | 12 |
| edge read cache (pinned subset) | 12 |
| edge wan_link (bidirectional sync) | 24 |
| Merkle chain + signing | 12 |
| Device pairing + per-tenant CA | 16 |
| Cloud-side `/api/edge-sync/*` endpoints | 16 |
| Schema migrations 134-138 (processed_edge_writes, edge_devices, etc.) | 8 |
| 10 integration tests | 32 |
| Hardware bring-up runbook | 4 |
| **Total** | **~216h ≈ 5.5 dev-weeks** |

---

## 13. Out of scope (this sprint)

- Mobile RN client integration (separate Sprint D)
- Web PWA service-worker + IndexedDB Loro store (separate Sprint E)
- TV display offline mode (TV is read-only; minor work in Sprint F)
- ABDM HIE bundle push from edge (cloud responsibility)
- Federated multi-edge deployments (one edge per hospital site for v1)
- CRDT schema migration tooling (basic version-tag check only; deep
  migrators in v2)
- Backup of edge SQLite to S3 (manual snapshot + Restic in v2)

---

## 14. Branch + PR plan

- Branch: `feature/sprint-c-edge-node` (off `master` after Sprint A
  merges)
- Single PR: `medbrains-crdt` + `apps/edge` are tightly coupled; split
  is forced rework
- Reviewer focus areas: (a) Loro merge semantics under partition,
  (b) Merkle chain integrity, (c) idempotency-key design,
  (d) mTLS cert rotation strategy

---

## 15. Hardware bring-up checklist (one per hospital site)

- [ ] NUC unboxed, plugged into hospital LAN + UPS
- [ ] Single-node k3s installed, FluxCD pointed at our git
- [ ] Per-tenant intermediate CA generated, root signed by tenant's
      KMS-backed CA
- [ ] mDNS advertisement verified from a test laptop on LAN
- [ ] WAN link tested (HTTPS to regional cloud + mTLS handshake)
- [ ] First device paired (web app from reception desk)
- [ ] Patient-care drill: register a synthetic patient + chart vitals
      + verify cloud sync after 2 min
- [ ] WAN-down drill: cut WAN for 1h, verify edge serves all flows
- [ ] Hospital IT signoff
