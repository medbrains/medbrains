# RFC: MedBrains, the open hospital OS

Status: APPROVED in principle by the owner (2026-11-01: "let's build hospital OS"); phases
need their own go · Owner: Domnic Amalan S

## 1. Why an OS

MedBrains already runs a whole hospital. To let every hospital work its own way, and let partners
build on it safely, it needs the shape of an operating system: a **small trusted kernel** that
everything goes through, services on top, apps that only talk to the kernel, drivers for devices,
and a reviewed store for what partners build.

The value of an OS is its ecosystem, not its code. That is the moat (see the moat discussion and
the partner programme).

## 2. The layers

| OS | MedBrains | Today |
|---|---|---|
| Kernel | identity, authorisation, tenancy, patient spine, audit, consent, events, config, sequences, storage | spread across `medbrains-core`, `server-core`, `db`, `authz`, `consent`, `outbox`, `platform` |
| System services | SOP flows, knowledge change sets, notifications, jobs, printing, search | built, separate crates |
| Drivers | device adapters (WASM, `medbrains-adapter-sdk`), HL7 v2 bridge, PACS | built for devices |
| Apps | OPD, IPD, pharmacy, lab, billing, HR… (~100 crates) | built |
| Shell | web, iOS, Android, TV, kiosk, desktop | built |
| Settings | switchboard, track builder, form builder, dashboards | partly built |
| Store | reviewed marketplace of partner flows, blocks, forms, adapters | not started |

## 3. The kernel

### 3.1 What is in it (and nothing else)

1. **Identity and sessions**: who is acting (user, device, API key, job), on whose behalf.
2. **Authorisation**: one decision function, three outcomes (allow, deny, unknown), scoped to a
   resource (`update` on `patient:456`), never collapsed to a boolean.
3. **Tenancy**: every unit of work runs inside a tenant-scoped transaction with RLS context set.
4. **Patient spine**: one patient identity (UHID, merge/unmerge, identifiers) every app refers to.
5. **Audit**: one append-only, hash-chained log; every state change and PHI read goes through it.
6. **Consent**: one check for "may this purpose use this patient's data now".
7. **Events**: before-events (gates that can refuse) and after-events (reactions via the outbox).
8. **Configuration**: one resolver for settings by path, most specific first
   (`user › ward › department › campus › hospital › default`), the MUMPS-style tree.
9. **Sequences and time**: UHIDs, numbers, tokens; one clock.
10. **Storage**: object store (S3 or local disk) with tenant-scoped keys.

### 3.2 The kernel interface ("system calls")

Apps get these and only these, from one crate, `medbrains-kernel`:

```
kernel::work(tenant, actor, |tx| { ... })            // tenant tx + RLS context + actor
kernel::authorize(&tx, actor, action, resource)      // Outcome: Allow | Deny | Unknown
kernel::audit(&tx, event)                            // append-only, hash-chained
kernel::patient::resolve(&tx, identifier)            // the one patient identity
kernel::consent::check(&tx, patient, purpose)        // Outcome
kernel::events::before(&tx, event) / after(&tx, event)
kernel::config::get(&tx, "discharge/tpa_required")   // path-resolved setting
kernel::seq::next(&tx, "uhid")
kernel::store::put/get(&tx, key, bytes)
```

Phase K1 builds this as a **facade over the code that already exists**, not a rewrite.

### 3.3 Kernel rules

- **Apps never bypass the kernel.** No raw database pool, no unscoped reads, no own permission
  logic, no own audit table. The repo's checks already enforce parts of this (`check-pool-reads`,
  `check-rls-only-writes`, `check-tenant-registry-reads`, `check-authz-collapse`,
  `check-permission-enforcement`); K2 adds a dependency rule so app crates depend on
  `medbrains-kernel`, not on `db`/`authz` internals.
- **The kernel is small and boring.** New features go into services or apps, not the kernel.
  Kernel changes need two reviewers and a stated reason.
- **The kernel never trusts the caller.** Even a service or plugin gets an `Unknown` refusal if
  context is missing; faults never read as permission.
- **Safety-critical gates are kernel or service code, never configuration.** Flows and plugins can
  add checks, never remove them (RFC-SOP-FLOWS §3, §11).

## 4. Drivers and plugins (the "userland")

- **Drivers**: device adapters already compile to WebAssembly and load without changing the core.
- **Blocks**: extend the same SDK so certified Developer partners ship flow blocks (actions,
  tasks, signals, facts) as sandboxed WASM plugins with a declared permission and inputs. A block
  only reaches the kernel through the interface above; it cannot open the database.
- **Certification**: a block or adapter is reviewed, tested and signed by MedBrains before a
  hospital can install it. Signed by the partner certificate (partner programme).

## 5. The store

A library of flows, forms, blocks and adapters from MedBrains and certified partners: each with
what it does, who built it, its review status and the hospitals using it. Installing anything goes
through a change set (preview impact, approval, rollback). Free items and paid partner items can
both exist; the core stays free (Apache-2.0).

## 6. Phases (each ends on a screen or a check, per project law)

- **K1 Kernel facade**: `medbrains-kernel` crate exposing §3.2 over existing code; port two app
  crates to it as proof; a "Kernel" page under Admin showing kernel health (audit chain verified,
  RLS mode, authz backend, config resolver) for operators.
- **K2 Enforcement**: CI rule that app crates use the kernel facade; ratchet the remaining direct
  uses down to zero, crate by crate.
- **K3 Config tree**: the path-based resolver (most specific wins) with an Admin "Settings tree"
  screen; tenant_settings migrated behind it. This also unlocks per-ward/campus switchboards
  (RFC-SOP-FLOWS phase 5).
- **K4 Block plugins**: WASM block ABI over the kernel interface, sandboxing, signing, first
  partner block.
- **K5 Unified Build area**: switchboard, track builder, forms, dashboards, knowledge changes under
  one "Build" area with one check → preview → approve → publish model.
- **K6 Store**: catalogue, review workflow, install via change sets.

## 7. Not in scope

A separate process per app (MedBrains stays one deployable, a modular monolith), a new language,
rewriting existing modules. The kernel is a boundary, not a rewrite.
