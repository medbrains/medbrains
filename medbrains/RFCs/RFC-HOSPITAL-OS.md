# RFC: MedBrains, the open hospital OS

Status: APPROVED in principle by the owner (2026-11-01: "let's build hospital OS"); phases
need their own go · Owner: Domnic Amalan S

## 0. North star

**A world-class, AI-native hospital operating system that costs almost nothing to run.** Free and open
(Apache-2.0), runs on any chip down to a Raspberry Pi, needs no paid licence, built on standards,
safe by construction. The way macOS builds on an open foundation and adds what people love, MedBrains
builds on Debian and adds the hospital layer: the kernel, signature features and flagship apps.

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
- **C1–C5 Connect** (after K1): C1 vendor apps (SMART on FHIR OAuth clients, hospital approval
  screen; fills the missing API-key creation path); C2 signed webhooks; C3 FHIR write + search;
  C4 CDS Hooks; C5 sandbox hospital + vendor portal + "Works with MedBrains" certification.
- **I1–I3 Identity** (after K1): I1 SCIM provisioning; I2 directory group → access group mapping;
  I3 one-screen directory setup via change sets.
- **Z1 Zero-licence check**: CI rule over dependencies and deploy kits (§8).
- **R1 Bare metal + recovery** (§8k): installer disk layout, recovery mode, PITR restore wizard,
  monthly restore test, rescue USB. **W1 Windows** (§8l): Hyper-V VHDX + MSI installer with
  external switch and firewall setup.
- **D1–D4 OS images** (§8b): D1 Raspberry Pi image + first-boot wizard; D2 bootable x86 ISO;
  D3 VM images (OVA/qcow2/VHDX) + Windows installer; D4 A/B updates with automatic rollback.
- **A1 Any CPU** (§8c): CI build matrix for tiers 1–3, smoke tests under emulation, tier table
  published in the README.
- **P1 Raspberry Pi** (§8a): clinic profile, ARM64 binaries in releases, measured benchmarks on a
  Pi 5, low-memory database tuning, backup-to-USB, then a ready image.

## 7. Standards built into the kernel (adopt, never invent)

The kernel speaks the standards hospitals and vendors already use, so anything that works with a
major EHR can work with MedBrains.

| Need | Standard | Where |
|---|---|---|
| Data exchange | **HL7 FHIR R4** (read today; write + search to add) | kernel external data model |
| Apps inside MedBrains / backend apps | **SMART on FHIR** App Launch + Backend Services (OAuth 2.0) | kernel identity + authorisation |
| Advice at the right moment | **CDS Hooks** (patient-view, order-sign, …) | kernel before/after events |
| Lab, devices | **HL7 v2** over MLLP | driver |
| Imaging | **DICOM** (via Orthanc) | driver |
| Codes | ICD-10/11, LOINC, SNOMED CT (licence where required), WHO ATC/INN | kernel terminology service |
| National exchanges | ABDM (and other countries' exchanges as adapters) | driver/adapter layer |
| Sign-in | OpenID Connect, SAML; **SCIM 2.0** for user provisioning | kernel identity |
| Notifications out | signed **webhooks** | kernel events |

Vendor apps connect only through these, so they get the same permissions, data walls, audit and
consent checks as MedBrains' own code, and a hospital admin approves and can revoke each one.

## 8. Zero licence cost, end to end

**A hospital or clinic must be able to run MedBrains without paying for any licence**: not
Windows, not a database, not office software, not a directory.

- **Server:** Linux (Ubuntu/Debian) on any x86 or ARM machine, or the MedBrains edge box.
  PostgreSQL, Orthanc, Gotenberg (PDF), Stalwart (mail), SpiceDB (optional) are open source.
- **Staff devices:** any modern web browser on Linux, ChromeOS, Android, Windows or macOS.
  Windows and Apple devices are supported, never required. Native apps exist for Android and iOS;
  Android alone is enough.
- **Kiosks and TV boards:** Android / Android TV (AOSP-based devices) or Linux in kiosk mode.
- **Printing:** CUPS/IPP for label, wristband and A4 printers; no vendor driver suite required.
- **Directory and sign-in:** MedBrains' own accounts, or open directories (Keycloak, Authentik,
  OpenLDAP); Microsoft Entra/Active Directory and Google Workspace are optional connectors.
- **Optional paid services stay optional:** cloud hosting, SMS/WhatsApp, payment gateways, hosted
  AI (Ollama is the open alternative), SNOMED where a national licence isn't free.
- **Enforced:** a CI check fails if a required dependency or a deploy-kit step needs a proprietary
  licence; the DPG "platform independence" answer stays true by construction.

## 8a. Runs on a Raspberry Pi (owner goal)

A small clinic or nursing home must be able to run all of MedBrains on a Raspberry Pi-class
computer. Starting point: release images are already built for `linux/arm64`, and the standalone
installer is partly architecture-aware.

- **Target hardware:** Raspberry Pi 5 with 8 GB RAM and an NVMe SSD (not an SD card, which wears
  out under a database). Stretch: Pi 5 / 4 with 4 GB for a single-doctor clinic.
- **Clinic profile** (`install.sh --profile clinic`): PostgreSQL + MedBrains server + web app only.
  Optional services stay off unless needed: Orthanc (imaging), SpiceDB (authz uses PostgreSQL
  instead, already supported), Gotenberg (PDF; a lighter print path or a remote/shared Gotenberg),
  mail server (use an external SMTP or none).
- **Prebuilt ARM64 binaries** in each release (cross-compiled with cargo-zigbuild, never built on
  the Pi), plus a ready SD/NVMe image later.
- **Measured, never guessed:** publish idle memory, memory and response times at 5 / 10 / 20
  concurrent users, cold start, and nightly backup time on a Pi 5, from the repo's load tester.
  The website and README claim only what was measured.
- **Safe by default on small boxes:** automatic nightly backups to a USB disk or the cloud, the
  database tuned for low memory, and a health screen warning when disk or memory runs low.

## 8b. MedBrains OS images (install like an appliance)

MedBrains ships as ready images, the way Home Assistant OS, TrueNAS and pfSense do: a minimal Linux
base with MedBrains preinstalled. Boot it, open the address it shows in a browser, and a setup
wizard creates the hospital, the admin and backups. MedBrains does not replace the Linux kernel; it
is an appliance OS on top of it.

| Image | For | Built with |
|---|---|---|
| **Bootable ISO** (x86-64) | any PC or server: install to disk from a USB stick | Debian live-build or mkosi |
| **Raspberry Pi / ARM image** | Pi 5 / 4 and similar ARM boards, flashed to NVMe or SD | pi-gen (listed in Raspberry Pi Imager) |
| **Virtual machine images** | OVA (VirtualBox/VMware), qcow2 (Proxmox/KVM), Hyper-V VHDX | Packer / mkosi |
| **Cloud images** | AWS, other clouds | Packer |
| **Containers** | Docker / Kubernetes (exists: amd64 + arm64) | release workflow |
| **Windows** | hospitals that already run Windows: a one-click installer that runs the appliance inside WSL2 or Hyper-V; staff can also use the desktop app | MSI + the VM image |

Windows support is an option for hospitals that already have it, never a requirement (§8).

**Base: existing Linux, not our own.** Every image is built on **Debian stable** (free, long-term
supported, official ports for amd64, arm64, armhf and riscv64; Raspberry Pi OS is Debian-based).
We use Debian's kernel and packages, PostgreSQL included, and add MedBrains on top. We never
maintain our own kernel. An immutable base (e.g. Debian with A/B partitions) is how D4 updates work.

**What every image includes:** first-boot web setup wizard; automatic updates with an A/B partition
(or snapshot) scheme so a failed update rolls back by itself; nightly backups to USB disk, network
share or cloud; a local health screen (disk, memory, backups, update status); offline operation with
cloud sync when the internet returns (the edge appliance's job today); signed images and checksums.

## 8c. Any CPU (owner goal: "ARM or any kind")

MedBrains is Rust + PostgreSQL + a static web app, all of which build for most CPUs. Support is in
tiers so we only promise what is tested.

| Tier | CPUs | Promise |
|---|---|---|
| **1** | x86-64 (Intel/AMD), ARM64 (Raspberry Pi 4/5, Apple-silicon VMs, ARM servers, most ARM boards) | images for every format in §8b, full test suite in CI, supported |
| **2** | RISC-V 64 (riscv64) | release binaries built and smoke-tested in CI; images on request |
| **3** | 32-bit ARM (armv7: older Pi, cheap boards) | best effort: binaries built; WASM block plugins off (the WASM runtime has no 32-bit ARM backend); RAM ≤ 4 GB limits scale |

How: cross-compile with cargo-zigbuild for every target (the project's only cross path), PostgreSQL
from the distribution's own packages (available on all of these), the web app built once and served
as static files. A CI matrix job builds every tier and runs the smoke test under emulation for
tiers 2–3. No CPU-specific code is allowed in the kernel without a portable fallback.

## 8d. Signature features (the "macOS layer")

| Feature | What it does | Groundwork today |
|---|---|---|
| **Handoff** | open a patient on the workstation, continue on the phone, same screen | peer device sync, paired devices |
| **Nearby share** | send a record or order securely between paired devices, even offline | iroh peer sync |
| **Spotlight** | one permission-checked search across patients, orders, beds, staff, drugs | "search by" slices |
| **Time Machine** | any record as it was on any date; point-in-time restore of the hospital | hash-chained audit, WAL-G backups |
| **Focus** | shift modes: on duty, on call, off duty (critical only) | notification hub, shift sessions |
| **Continuity camera** | phone as scanner at the workstation (wristbands, documents, eye scans) | barcode/BCMA |
| **Settings tree** | every setting by path, most specific wins | K3 |
| **Store + Gatekeeper** | reviewed, signed partner blocks and adapters | K4, K6 |

## 8e. Flagship apps (free, like the OS)

| App | Purpose | Built on |
|---|---|---|
| **Studio** | build tracks, forms, switchboards, dashboards; test drive, what-if replay | track builder, forms |
| **Command Centre** | big-screen live hospital control room | control room, bed board, KPIs |
| **Rounds** | ward-round tablet app for doctors | IPD, case sheet, results inbox |
| **Theatre** | OT from booking to recovery | OT module |
| **Scribe** | AI note drafting, clinician signs; always labelled | AI assistant, case sheet |
| **Imaging Viewer** | built-in DICOM viewer | Orthanc, radiology |
| **Pharmacy Pro** | dispensing bench | pharmacy |
| **Clinic** | single-doctor app for a Pi or laptop | OPD, billing, clinic profile |
| **Camp** | offline health camps | camp module, edge box |
| **Insight** | management analytics | reports, KPIs |

Flagship apps are free, keeping the pricing promise ("every module, free"). Revenue stays with
optional hosting, setup, training, support, heavy-AI pass-through at cost, and **hardware kits**
that run them best (the moat). Order: Studio → Command Centre → Rounds.

## 8f. AI and plugins the MCP way

MCP (Model Context Protocol) is how AI assistants plug into tools and data: a server declares
**tools**, **resources** and **prompts** with JSON schemas; any AI client can discover and use
them. MedBrains adopts the same idea in three places, all through the kernel.

1. **MedBrains as an MCP server.** Hospital capabilities (find a patient, today's beds, a lab
   trend, draft a discharge summary, explain a flow's bottleneck) are exposed as MCP tools and
   resources, so any approved AI assistant can use them. Every call goes through the kernel:
   the user's own permissions, consent, PHI redaction (`medbrains-ai` redaction exists), audit,
   and an AI label on anything it produces. Reads are scoped to what that user may see; **writes
   are drafts a person must approve**, never direct changes. Clients sign in as approved vendor
   apps (SMART on FHIR / OAuth, phase C1), revocable by the hospital.
2. **MedBrains AI as an MCP client.** Scribe, Studio and the assistant can call external MCP
   servers a hospital approves (drug references, clinical guidelines, payer rules). Allow-listed
   per hospital; no patient data leaves unless consent and a data-processing agreement allow it;
   every call audited.
3. **One way to describe a capability.** WASM block plugins (K4) and MCP tools share one manifest:
   name, one-sentence purpose, input/output JSON schema, required permission, data class touched.
   A capability written once can be a flow block, an MCP tool, or both, and is reviewed and signed
   once.

Phases: **M1** MCP server over existing `medbrains-ai` tools (read-only first, then draft-writes);
**M2** hospital-approved MCP client connections; **M3** shared capability manifest for blocks and
tools.

## 8g. An open extension ecosystem (the way providers build around MCP)

MCP grew because anyone could build a server for it: an open, simple spec; SDKs in every popular
language; no permission needed to build or publish; one server works with every client. MedBrains
copies that so vendors and developers build **around** it without asking us.

- **Open extension protocol, published.** An extension is a separate service (any language, any
  host) that speaks MedBrains' documented protocol: JSON over HTTPS for calls, signed webhooks for
  events, and the standards in §7 (FHIR, SMART on FHIR, CDS Hooks) where they fit; MCP for AI
  tools (§8f). The spec, examples and a test suite live in the open repo.
- **SDKs in many languages:** TypeScript, Python, Go, Java, C#, Rust: sign-in, typed calls,
  webhook verification, a local mock MedBrains for testing.
- **Kinds of extension:** screens inside MedBrains (SMART app launch), background services
  (integrations, billing exports, analytics), clinical advice (CDS Hooks), flow blocks (call-out
  blocks for SOP flows, §4), device drivers, AI tools (MCP).
- **One manifest** for every kind (§8f item 3): what it does, which events and data it needs,
  which permissions, which data classes. Hospitals see exactly this before approving.
- **No gate to build or publish:** a developer CLI (`medbrains ext init`, `ext test`, `ext publish`)
  and a public registry where anyone lists an extension. Two tiers: **community** (listed,
  unreviewed, clearly marked) and **certified** (reviewed and signed by MedBrains, the partner
  programme). Hospitals choose; certified ones are recommended.
- **The kernel is still the gate to data:** an extension never touches the database; every call is
  checked against the permissions the hospital granted it, plus consent and audit. Revoking an
  extension cuts it off at once.
- **Free sandbox hospital** to build against, with synthetic data.

Phases: **E1** publish the extension protocol + manifest + TypeScript and Python SDKs + CLI;
**E2** public registry (community tier) + hospital install/approve screen; **E3** certification
tier + more SDKs; **E4** extension kinds beyond the first (CDS Hooks, flow call-out blocks).

## 8h. AI-native, safely

AI is an OS service, not a feature on a few screens. Groundwork exists: `medbrains-ai` (tools,
redaction, query checks), `medbrains-ai-eval` (evaluation), the `AiLabel` UI component, and the AI
copilot RFCs.

**Kernel AI service.** Apps and extensions ask the kernel, never a model directly:
`kernel::ai::draft / summarise / classify / answer(&tx, capability, input)`. The kernel applies the
same rules as every other call: the user's permissions, consent, data-class redaction, audit of the
prompt and the output, and an AI label on everything produced.

**Where AI shows up (everywhere, consistently):**
- **Every screen:** an assistant that answers from what *this user* may see ("which patients on
  my ward are waiting on a lab result?") and can act only by preparing drafts.
- **Studio:** describe a change or upload an SOP; AI drafts tracks, switch settings and forms;
  the builder's checks (RFC-SOP-FLOWS §11) and human approval still decide.
- **Scribe:** notes drafted from dictation or conversation; the clinician signs.
- **Command Centre:** "why is discharge slow today?" answered from live numbers, with sources.
- **Operations:** AI watches the system's own health (disk, backups, slow queries, failed jobs) and
  explains problems in plain words to the operator.
- **Agents (later):** multi-step helpers that work through the kernel's MCP tools (§8f), always
  stopping for a person before anything clinical or financial changes.

**Rules that never bend:**
1. **AI proposes; people decide.** No AI output changes a record, a flow, an order or money without
   a named person approving it.
2. **Always labelled, always traceable:** the model, the inputs used (redacted) and the person who
   approved are recorded.
3. **Evaluated before use:** a new model or prompt passes the `medbrains-ai-eval` suite for its task
   before it reaches users, and the change goes through a change set.
4. **Grounded, not invented:** answers cite the records or numbers they used; "not enough data" is
   a valid answer.
5. **Zero-licence by default:** open models run locally (Ollama on the server or edge box; small
   models on a Pi-class device or a Snapdragon/Apple NPU where available). Hosted models are an
   optional, hospital-approved choice, with no patient data leaving without consent and a
   data-processing agreement.

Phases: **AI1** kernel AI service over `medbrains-ai` + per-call audit + labels; **AI2** assistant on
every screen (read + drafts); **AI3** Studio drafting from SOPs; **AI4** local-model profiles for the
edge box and Pi; **AI5** agents through MCP tools.

## 8i. Speed as a moat (measured, budgeted, enforced)

Goal: **the fastest hospital system on the cheapest hardware, with published numbers.** Speed is
designed in at every layer and checked in CI, so it never decays.

**Budgets** (enforced by CI benchmarks; regressions fail the build):
| What | Budget (x86 server) | Budget (Raspberry Pi 5) |
|---|---|---|
| Kernel call overhead (authorize + audit + tenant tx setup) | < 0.2 ms | < 1 ms |
| API p95, typical screen read | < 50 ms | < 150 ms |
| One round trip per screen | always | always |
| Offline edge read (local-first) | < 5 ms | < 10 ms |
| Critical alert end-to-end (critical lab value → clinician device) | < 2 s | < 2 s |
| Cold start (server ready) | < 3 s | < 10 s |

**How, layer by layer:**
- **Kernel:** zero-cost wrappers (generics + inlining, no dynamic dispatch on hot paths); per-request
  memo of permission resolution (DSA law: resolve once per request, never per item); batched
  authorisation for lists (one query, `ANY($1)`); prepared, compile-time-checked SQL.
- **Database:** connection pooling sized to cores, partitioning and retention for high-volume tables,
  covering indexes found from real query plans, `pg_stat_statements` budgets, read replicas when a
  hospital outgrows one box.
- **Network and screens:** one round trip per screen, compressed responses, HTTP/2, static web
  assets cached forever with hashed names, lists virtualised and bounded.
- **Edge / offline:** local-first reads from the edge box's own database, CRDT sync in the
  background, so the ward is fast even when the internet is slow.
- **Linux foundation:** a tuned Debian (low-latency settings for alerts, filesystem and memory
  tuning for PostgreSQL), and later io_uring for high-throughput I/O and eBPF for zero-overhead
  production profiling.
- **Plugins:** WASM blocks run near-native and are time-boxed; out-of-process extensions are
  async and can never stall a clinical request.

**Proof:** a public performance page (per release: budgets, measured numbers on x86 and a Pi 5,
the load-test script to reproduce them). Claims come only from these measurements.

Phases: **S1** benchmark harness + budgets in CI (start with kernel call overhead and the top 20
screens); **S2** fix the slowest screens to budget; **S3** Pi 5 numbers + public performance page;
**S4** io_uring/eBPF where measurements show they pay.

## 8j. Security as a moat (the Apple way, in the open)

Apple's security story is layers a user never has to think about: a secure boot chain, sandboxed
apps, signed software, privacy labels, fast updates. MedBrains does the same for hospitals, and
because the code is open, anyone can verify it.

| Apple idea | MedBrains | Today |
|---|---|---|
| Secure boot chain | signed OS images, secure boot + TPM on the edge box, A/B updates that verify signatures and roll back | images planned (§8b) |
| Encrypted by default | disk encryption (LUKS) on images, TLS everywhere, encryption at rest checks | `check-encryption-at-rest`, backups sealed to an offline key (#5132) |
| App sandbox | WASM blocks sandboxed and time-boxed; extensions out of process, never touching the database | K4, §8g |
| Gatekeeper / notarisation | every certified block, adapter and extension reviewed and signed; unsigned ones marked | partner certificate, store |
| Privacy nutrition labels | each extension and AI tool shows, from its manifest, exactly which data classes it reads and sends where | manifest (§8f, §8g) |
| Memory-safe code | Rust with `unsafe` forbidden; strict lints deny panics | enforced today |
| Permission prompts | the kernel's three-outcome authorisation, per-record checks, consent; nothing reads PHI the user can't | enforced today |
| Fast security updates | signed updates pushed to every install; a security release within 72 h of a critical fix | release process to formalise |
| Transparency | hash-chained, append-only audit of every change and PHI read; tamper-evident | enforced today |

**Also:** supply-chain safety (`cargo-deny` today; add an SBOM, signed releases and reproducible
builds), a public security policy and bug bounty, independent penetration tests before each major
release, and ISO 27001 for MedBrains-hosted installs.

**Rules:** security features are never paid extras; no telemetry or data leaves an install unless
the hospital turns it on; every security claim on the website links to its evidence.

Phases: **SEC1** signed releases + SBOM + reproducible builds; **SEC2** privacy labels in the
manifest and the hospital approval screen; **SEC3** secure boot, TPM and disk encryption in OS
images; **SEC4** bug bounty + external penetration test + ISO 27001 for hosting.

## 8k. Bare-metal installation and recovery

**Bare metal (from the ISO or Pi image, §8b):**
- Boots a text + browser installer on any supported machine; detects disks, CPU and RAM and refuses
  hardware below the profile's minimum with a plain reason.
- Disk layout: EFI, two root slots (A/B) for safe updates, a recovery partition, and an encrypted
  (LUKS) data partition for PostgreSQL, files and backups. Optional mirrored disks (RAID-1) or
  OpenZFS for hospitals that want snapshots.
- Network: DHCP or static IP, hostname, NTP time (critical for clinical records), optional VLAN.
- First boot: web setup wizard (hospital, admin, backups, TLS), then the appliance is live.
- Unattended mode for partners: a signed answer file installs a fleet of boxes identically.

**Recovery (designed in, tested every release):**
| Situation | What happens |
|---|---|
| Failed update | the device boots the previous root slot automatically and reports why |
| Corrupted system | boot menu → **Recovery mode**: reinstall the system partitions, keep all data |
| Lost or broken disk | reinstall on new hardware → restore from the latest backup with the wizard |
| Data mistake or ransomware | **point-in-time restore** of the database to any minute in the retention window (WAL-G PITR); the hash-chained audit shows what changed |
| Whole site lost | restore from the off-site encrypted backup to a new box or the cloud |
| Forgotten admin password | recovery key printed at setup, plus the documented physical-console reset |

**Targets:** RPO ≤ 5 minutes with continuous WAL shipping; RTO ≤ 1 hour to a replacement box.
A monthly automatic **restore test** proves backups actually restore, and the health screen shows
the last successful test. A rescue USB image is published with every release.

## 8l. Windows, Hyper-V and networking

Windows is supported for hospitals that already run it, never required (§8).

- **Recommended: Hyper-V VM** (VHDX image) on Windows Server or Windows 11 Pro.
  - Networking: an **External virtual switch** bridged to the hospital LAN, so lab analysers,
    printers, TV boards and staff devices reach MedBrains on a normal LAN address. Internal/NAT
    switches only for testing. VLAN ID set on the VM's network adapter where the hospital segments
    clinical networks.
  - Integration services for clean shutdown with the host; checkpoints are not backups (use the
    appliance's own backups).
- **WSL2** for developer and small single-PC setups only: its default NAT networking hides the
  server from other devices; Windows 11's mirrored networking mode improves this, but a Hyper-V VM
  with an external switch is the supported path for real hospital use.
- **Windows installer (MSI):** checks Hyper-V is available, creates the VM, the external switch
  (asking which network card) and firewall rules, then opens the setup wizard.
- **Networking principles everywhere:** fixed IP or DHCP reservation for the server, local name via
  mDNS (`medbrains.local`) and DNS, TLS with a hospital or local CA certificate, firewall allowing
  only the needed ports, HL7/DICOM device traffic on the clinical VLAN, and documented ports for
  hospital IT.

## 9. Identity: groups and directories (built in)

Exists today: access groups with permissions (Admin → Groups), SSO with directory-group → role
mapping (`idp_group_mappings`), permission resolution = role ∪ groups ∪ extras − denials.

To build:
- **SCIM 2.0 provisioning:** staff added in the hospital directory appear in MedBrains; leavers are
  disabled at once.
- **Directory group → access group** mapping (not only roles), e.g. "ICU-Nurses → ICU access".
- **One-screen setup:** connect directory → map groups → preview who gets what → apply via a change
  set (reviewed, reversible).

## 10. Not in scope

A separate process per app (MedBrains stays one deployable, a modular monolith), a new language,
rewriting existing modules. The kernel is a boundary, not a rewrite.
