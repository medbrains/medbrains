# medbrains-edge

Offline-first edge sync for hospital deployments. Apache-2.0 licensed.

## What this is

A Rust crate + companion binary (`apps/edge`) that lets hospital LANs
keep working when the WAN goes down. Devices on the LAN open
WebSockets to the edge node and exchange [Loro](https://loro.dev)
CRDT updates; merges are conflict-free. When the WAN heals, the edge
ships its updates upstream to MedBrains cloud.

## Why CRDT

A doctor's tablet should not freeze because the hospital ISP did. The
clinical data being captured (vitals, notes, observations) tolerates
last-write-wins or grow-only semantics for the duration of an outage,
as long as **no data is lost** and **no two devices see different
truth** when the network heals.

Loro gives us:
- Conflict-free merge (no write loses)
- Append-only event streams (T2)
- Editable text/JSON with deterministic merge (T3)
- Compact binary updates that fit a hospital's constrained uplink

What CRDTs are NOT for:
- Money. Billing invoices, prescription orders, pharmacy dispenses
  must be server-authoritative (T1) — last-write-wins on a price is
  a malpractice incident waiting to happen. During WAN outages,
  T1 writes get queued in an outbox with operator confirmation on
  reconnect, never applied locally.

See `lib.rs` doc comments for the tier classification.

## Modules

- `doc_store` — file-system Loro doc persistence
- `merkle` — append-only SHA-256 hash chain for tamper detection
- `sync` — `SyncServer` + JSON wire frames

## Run the appliance

```bash
cargo build --release --bin medbrains-edge
./target/release/medbrains-edge --config etc/medbrains-edge/config.toml
```

Example config:
```toml
listen        = "0.0.0.0:7811"
mdns_hostname = "medbrains-edge.local."
service_name  = "medbrains-edge"
docs_path     = "/var/lib/medbrains-edge/docs"
chain_path    = "/var/lib/medbrains-edge/chain"
```

Devices on the LAN discover via `_medbrains-sync._tcp.local.` mDNS.

## Wire protocol (JSON over WebSocket)

```jsonc
// 1. Client opens, says hello
{ "kind": "hello", "protocol": 1, "device_id": "<uuid>", "tenant_id": "<uuid>" }

// 2. Pull catch-up changes since `vv_b64` (their version vector)
{ "kind": "pull_since", "doc_id": "ptnotes/<patient_id>", "vv_b64": "..." }

// 3. Push local changes
{ "kind": "push", "doc_id": "ptnotes/<patient_id>", "update_b64": "..." }

// Server responses: pull_response | ack | error
```

`PROTOCOL_VERSION` is bumped on incompatible changes. Clients that
send a different protocol see an `Error` frame with the mismatch.

## Open source

Apache-2.0. PRs welcome. The wire format is documented; alternative
implementations (Swift for clinical tablets, Java for hospital-internal
desktop apps) are explicitly supported.
