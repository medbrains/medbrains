# Runbook — Offline-Mode End-to-End in Dev

**Owner:** Platform Engineering
**When to read this:** you want to verify the CRDT-backed offline path works in your local browser, OR you're onboarding a hospital pilot and need to demonstrate the fail-tolerance behavior.

## What "offline mode" means

When `tenant_settings.clinical.offline_mode = true` and
`tenant_settings.clinical.edge_url` points at a reachable WebSocket
URL, the [`TenantConfigProvider`](../apps/web/src/providers/TenantConfigProvider.tsx)
flips its mode to `crdt`. Per-domain hooks (`useVitalsSource`,
`useNotesSource`, `useHandoffSource`, `useTriageSource`,
`useNursingNotesSource`) then route reads/writes through
[`@medbrains/crdt`](../packages/crdt/src/) — Loro CRDTs persisted in
IndexedDB and synced to the [`medbrains-edge`](../crates/medbrains-edge/)
appliance over WebSocket. Concurrent edits from different tabs/devices
merge automatically; pages keep working through WAN outages.

Other pages (billing, prescriptions, admin) stay on cloud REST
regardless. Only T2 (vitals/handoff/triage) + T3 (notes/nursing-notes)
are offline-tolerant in this iteration.

## Local end-to-end smoke

### Prerequisites

- Postgres running (`make db`)
- Migrations applied (`make dev-backend` does this automatically on first run)

### Three terminals

**Terminal 1 — backend + frontend:**
```bash
make dev
```

**Terminal 2 — medbrains-edge appliance:**
```bash
make dev-edge
```

You should see:
```
INFO medbrains_edge_app: WSS sync server listening listen=0.0.0.0:7811
INFO medbrains_edge_app: mDNS service announced ...
```

State directories live under `./var/medbrains-edge/` (gitignored). To
reset, just delete them.

**Terminal 3 (optional) — tail the edge log:**
```bash
RUST_LOG=medbrains_edge=debug,medbrains_edge_app=debug make dev-edge
```

### Flip the toggle

1. Open http://localhost:5173, login as `admin / admin123`
2. Admin → Settings → **Offline Mode**
3. Toggle "Enable offline-tolerant mode" ON
4. Edge appliance URL: `ws://localhost:7811`
5. Click **Save**
6. Hard reload (Cmd-R / Ctrl-Shift-R) — picks up the new mode immediately
   (the provider's tenant-settings query has a 5-min staleTime; reload
   short-circuits)

### Two-tab convergence test

1. In tab A, navigate to OPD → pick any encounter → Vitals tab
2. In tab B, open the SAME encounter URL
3. In tab A, click **Record Vitals**, enter HR=80, save
4. In tab B (within ~2s), the reading appears at the top of the
   timeline
5. In tab B, **Record Vitals**, HR=90
6. In tab A, the second reading shows up

**Sync badge** in both tabs should cycle Connecting → Online →
**Synced** (the `CrdtSyncBadge` component renders this; visible inside
the VitalsTab once we wire it into the existing component — for now
inspect via React DevTools).

### Offline-survival test

1. Tab A: open DevTools → Network → **Offline**
2. Record HR=100 in tab A
3. Sync badge shows "Offline · 1 queued"
4. Tab A → DevTools → Network → **Online**
5. Sync badge transitions Syncing → Synced within ~2s
6. Tab B (which stayed online the whole time) now shows HR=100

If queued operations don't drain, check:
- DevTools → Application → IndexedDB → `medbrains-crdt` → `outbox`
  store should empty
- The medbrains-edge log should show new push frames arriving

### Inspecting CRDT state

DevTools → Application → IndexedDB → `medbrains-crdt`:
- `snapshots` — full Loro doc snapshots per (tenant_id, doc_id). Bytes
  are Loro's binary format; not human-readable.
- `outbox` — writes that haven't synced yet. Empty in steady state.

Server side:
- `var/medbrains-edge/docs/<tenant_uuid>/<doc_id_safe>.loro` — same
  binary format, atomic-write guaranteed.
- `var/medbrains-edge/chain/<tenant_uuid>.chain.log` — append-only
  SHA-256 chain. Each line is one entry; verify via the
  `MerkleAudit::verify` API or eyeball the JSON structure.

## Reverting

To go back to cloud REST:
1. Settings → Offline Mode → toggle OFF → Save → reload
2. Stop `make dev-edge` (Ctrl-C)
3. Optionally `rm -rf var/medbrains-edge` to wipe local CRDT state

The web app picks up the REST path on the next render. No data loss —
records that were captured offline survive in cloud REST too if they
were written while online (TanStack Query mutations went through). If
they only existed in CRDT, they live on the edge appliance and on
IndexedDB until you migrate them out (separate runbook for the
hospital cutover).

## Common issues

- **"WebSocket connection failed"** — `make dev-edge` not running, or
  port 7811 already in use. Check with `lsof -i :7811`.
- **Sync badge stuck at "Connecting"** — likely the edge_url scheme is
  wrong (`http://` not `ws://`). Settings page warns about this but
  doesn't block save.
- **Two tabs don't converge** — DevTools → Application → Service Workers
  may be holding a stale connection; clear it. Otherwise check that
  both tabs hit the same edge appliance (different `tenant_id` /
  `device_id` values won't share docs).

## Production analog

In production hospitals, the edge appliance is a single `medbrains-edge`
binary running on a NUC / Proxmox VM (see
[infra/terraform/modules-onprem/bridge-agent/](../infra/terraform/modules-onprem/bridge-agent/)).
The hospital admin sets `tenant_settings.clinical.edge_url` to the LAN
hostname Headscale resolves it as. Browsers connect over the LAN; the
appliance bridges to cloud over Headscale outbound-only WireGuard. Same
URL shape, same behavior — the only difference is `localhost` becomes
`medbrains-edge.<hospital-domain>.local`.
