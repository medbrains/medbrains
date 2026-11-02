# RFC: MedBrains, the open hospital OS

Status: APPROVED in principle by the owner (2026-11-01: "let's build hospital OS"); phases
need their own go · Owner: Domnic Amalan S

## 0. North star

**A world-class, AI-native hospital operating system that costs almost nothing to run.** Free and open
(Apache-2.0), runs on any chip down to a Raspberry Pi, needs no paid licence, built on standards,
safe by construction. The way macOS builds on an open foundation and adds what people love, MedBrains
builds on Debian and adds the hospital layer: the kernel, signature features and flagship apps.

### Focus: big hospitals first (owner decision, 2026-11-02)

The first customer is a large hospital or group, because growing regulation forces it to prove control:
who saw what, on which machine, under which policy. That sets the order of work.

**Small clinics use the application layer only,** on hardware or hosting they already have. They do not need the
OS, and clinic needs do not set this plan's order. The Raspberry Pi and clinic profile work stays in this RFC as
proof of how small the system can run, not as a product line for now.

**The moat is the OS on cheap hardware (owner decision, 2026-11-02).** A big hospital should get what today takes
expensive servers, storage arrays and licences, without them. **The shape (owner, 2026-11-02): one server manages
everything; everything else is an edge or node, on the smallest hardware that does its job.** Even an i3 is more
than most nodes need. A node holds no system of record, so it can be replaced in minutes. A standby server and
offline edges cover a server failure, since one server alone is a single point of failure. This is only true once
measured, so every claim needs a published test on named hardware, and the cost comparison must include failures
and support.

**Security and control out of the box.** A hospital gets them by installing, with nothing to configure. Anything
that weakens a default is an explicit, audited choice. On first boot, already on:
encrypted data disk, verified read-only system, default-deny firewall, signed updates, sandboxed services, TLS with
a local certificate authority, per-role permissions, hash-chained audit, automatic encrypted backups with restore
tests, continuous security checks, and every machine visible in one console once it joins.

Only what no default can decide is asked: where off-site backups go, who the administrators are, and safe keeping
of the recovery key. **The proof is an automated out-of-the-box test:** boot a fresh image, change nothing, and
scan it from outside and inside (open ports, encryption, unsigned code, default passwords, service limits). It runs
in CI for every release, the report is published, and any failure blocks the release.

**The OS hosts many applications (owner, 2026-11-02).** MedBrains is not the one app the OS exists to run. It is an
application on the OS, alongside others: PACS, lab, vendor and hospital-built apps, installed and managed through
the OS. Nodes open a home screen showing the apps this person may use, so `cage`'s single full-screen kiosk is only
the first step (D1), not the design. Proposed path, to be measured on small nodes: **first**, a web-based shell where
each app is a signed package with a manifest, in its own origin and sandbox; **later, if real need appears**, a full
Wayland compositor with native apps in sandboxes. All apps still reach data only through the core's permissions.

**Hospitals build their own apps, and the kernel handles them like any other.** Any app, whether ours, a vendor's or
one the hospital wrote, gets the same treatment, so the kernel has no favourites: an identity, an install and approval
step, granted permissions, a sandbox and resource limits, audit of what it did, events, storage, and clean removal.
This stays technical, so it does not break the no-domain rule. A hospital's private app is signed with the hospital's
own key and needs no review or store listing from MedBrains. Today only the connected-apps part exists (C1); install,
home-screen entry, sandbox and limits are not built. The hospital owns the clinical and regulatory responsibility for
what its own app does.

**PACS is the proof.** Imaging is a hospital's heaviest load in storage and network. If PACS runs fast and safely
on cheap disks and ordinary machines, the claim holds for everything else. Today `medbrains-radiology` drives
Orthanc as a separate service. Evaluate whether a Rust DICOM store with tiered storage should replace it, measured
against Orthanc on the same hardware. A viewer used for diagnosis may be regulated as a medical device, so check
that with a regulatory expert before any such claim.

**A big hospital will ask for, in rough order:**
1. **No single point of failure:** replicas, automatic failover, tested recovery, and running through a network
   or server loss during a shift.
2. **Proof for regulators and auditors:** evidence on demand from the audit trail, mapped to the rules that apply
   to them, with independent security testing and recognised certifications.
3. **Central control:** one console for machines, policies, updates, access and security (§8r), tied to their
   directory (§9).
4. **Fits what they own:** runs on their virtual machines and servers as well as our image, and connects to their
   PACS, LIS, ERP, SIEM and identity systems through open standards.
5. **Scale and groups:** proven load at their size, and many campuses under one policy.
6. **A contract they can sign:** response times, a named support organisation, data export, and a reference site.

**What this changes.** Failover moves earlier, the separate core layer and fleet work matter sooner, and a
compliance evidence screen is added. Their IT team may refuse an unfamiliar OS on day one, so MedBrains must also
install cleanly on a standard Linux server (D0). The OS image is an option they grow into, not a condition of buying.

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
| Kernel | identity, authorisation, tenancy, audit, events, config, sequences, storage | `medbrains-kernel`, a facade over `medbrains-core`, `server-core`, `db`, `authz`, `outbox`, `platform` |
| Health services | patient identity, consent for a purpose; clinical gates next | `medbrains-health-services` (§3a) |
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
4. ~~Patient spine~~ moves to health services (§3a): the kernel stays technical.
5. **Audit**: one append-only, hash-chained log; every state change and PHI read goes through it.
6. ~~Consent~~ moves to health services (§3a).
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
kernel::events::before(&tx, event) / after(&tx, event)
kernel::config::get(&tx, "discharge/tpa_required")   // path-resolved setting
kernel::seq::next(&tx, "uhid")
kernel::store::put/get(&tx, key, bytes)
```

Phase K1 builds this as a **facade over the code that already exists**, not a rewrite. Patient
identity and consent were here in K1 and moved up in K3a: `medbrains_health_services::patient::resolve`
and `::consent::check`, which still answer `Outcome` (§3a).

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

## 3a. Amendment (2026-11-01): the kernel is technical, and everything is small

**Owner decisions:** "the kernel should handle technicals instead of hospital-focused" and "the OS
should be very small".

### The kernel holds only technical mechanisms
Like Linux (processes, memory, files, security) and unlike an application, the kernel knows nothing
about hospitals. Mechanism in the kernel; policy and domain above it.

| Kernel (technical) | Moves up to **health services** (a layer above the kernel) |
|---|---|
| identity and sessions (users, devices, apps, jobs) | patient identity, UHID, merge/unmerge (the patient spine) |
| authorisation: three outcomes, scoped to any resource | consent for a purpose (DPDP, clinical) |
| tenancy: isolated units of work | clinical gates (Rx safety, NDPS, MLC), flows' clinical blocks |
| audit: append-only, hash-chained | health intelligence, terminology |
| events and jobs: before-gates, transactional after-events, scheduling | |
| settings tree by path | |
| sequences, time | |
| storage (objects, keys scoped to the unit of work) | |
| crypto, secrets, signing | |
| resource limits and plugin sandbox (WASM) | |
| health of the system itself (RLS mode, watchdog, heartbeats) | |

Health services use the kernel exactly like any app does. **Done in K3a:** `kernel::patient` and
`kernel::consent` moved to the `medbrains-health-services` crate, with no re-export from the kernel,
and `check` keeps its three outcomes (a fault is `Unknown`, never a refusal). So did
`require_patient_access`: the kernel no longer depends on `medbrains-authz-gate`, which is clinical
policy (it names encounters, admissions, billing), and health services re-exports the check.

`make check-kernel-no-domain` (`scripts/check_kernel_no_domain.py`, in CI) holds the line: every
`medbrains-*` crate the kernel runs on, all the way down, is on a technical allowlist, and no domain
word appears anywhere in its non-test source, comments included.

**How the boundary ratchet treats the new crate:** as an ordinary app, not a building block, because
that is what this section says it is. It records `partial 1 medbrains-authz-gate`, the honest answer
until the patient gate's logic moves up into it, and can only improve. A crate reaching the kernel
through it (`medbrains-patients`) still counts as on the kernel.

**Known limit:** the allowlist means "not a clinical module", not "free of domain words". Its crates
still know about patients in places: `medbrains-core` holds domain types the kernel does not use
(`medbrains_core::billing`, say), and the `medbrains-authz` registry names entity types. This cannot
go away without splitting out their technical part, which is separate work.

### Light as well as short (K3b, 2026-11-02)
The kernel could pull in 509 of 1,320 packages with 356 code lines. Measured by walking `Cargo.lock`,
the edges were `server-core` (496 alone: axum, the AWS SDK, reqwest, lettre, openssl) and `workflow`
(mlua), then `authz` (tonic, hyper, h2, prost; 45 more packages than `db`). So:

- **The kernel is now below `server-core`.** It owns `Claims`, `KernelError`, the permission checks,
  `outcome_of`, the setting query and the before-event gate. `server-core` maps `KernelError` to
  `AppError` one to one, and a test pins that every status and body is byte-identical.
- **Apps take `AppError` from `server-core`.** It is an HTTP type, so the kernel cannot offer it.
  `kernel::work` is generic over the error, so an app's closure keeps `AppError`.
- **SpiceDB moved to `medbrains-authz-spicedb`,** because it was the only part of the authorisation
  engine that needs gRPC. A Cargo feature would not have helped: the lock records optional packages.
- **Admin → Kernel reads `boundary.txt` through `medbrains-admin`,** which embeds it, and the kernel's
  build script is gone. The kernel is now under about 100 crates, and a baseline edit must not rebuild them.

Where it stopped, and what is left: the closure is 272 by `Cargo.lock` (163 by `cargo tree -e normal`,
which knows the features and platforms), against 229 for the kernel's third-party dependencies alone.
The other 43 are four MedBrains crates (the kernel, `authz`, `core`, `db`) and what they bring: crypto,
which §3a allows, plus `regex` and `flate2`. Taking those out means splitting `medbrains-core`, a
46,000-line crate of domain types with most of the workspace above it. That gains at most 40 packages
for a change far larger than this one, so it waits. It would also shorten the kernel's compile, since
those 46,000 lines still compile under it. The 229 is the SQL driver with the features the workspace
enables, TLS included, and §3a allows it.

### Small by design, with budgets the build enforces
Numbers measured 2026-11-02 and enforced by `scripts/check_size_budgets.py` (baseline `scripts/size_budgets.json`) unless the row says otherwise.

| Budget | Target | Today |
|---|---|---|
| Kernel code | ≤ 2,000 lines, no domain dependencies | 873 code lines without comments, blanks and tests; it took in the code that made it heavy (K3b); hard limit enforced |
| Kernel dependencies | only std, async runtime, SQL driver, crypto, serde | **Close, not met:** 10 direct on an enforced allowlist, including 3 MedBrains crates (`core`, `db`, `authz`). Closure 272 of 1,321 packages (upper bound from `Cargo.lock`, ratchet enforced; 163 by `cargo tree -e normal`, was 509 and 376). No web framework, AWS SDK or gRPC. `medbrains-core` is what remains, see K3b above |
| Clinic build (server binary for a Pi) | only the modules a clinic needs, compiled in by profile | one binary with all 150 modules |
| Release binary size | published per profile; must not grow without a reason | not measured: compile profiles arrive with SM2, so there is nothing per profile to measure yet |
| Workspace dependencies | ratchet down from 1,319 packages | 1,321, ratchet enforced |
| Workspace crates | ratchet down | 162, ratchet enforced |
| OS image | Debian minimal + PostgreSQL + one binary + static web; target ≤ 1 GB | not built |
| Idle memory (clinic profile, Pi 5) | published; target ≤ 512 MB for the whole appliance | not measured: needs the SM2 clinic profile running on a Pi 5; not enforced |
| Web app first load | budgeted per screen | 1,060,297 bytes gzip for the JS `index.html` loads up front, one entry rather than per screen; ceiling 10% above it, checked after the CI web build |

### How we get small
1. **Profiles at compile time:** modules become Cargo features grouped into profiles (`clinic`,
   `hospital`, `full`); the Pi image builds `clinic` (patients, OPD, billing, pharmacy, lab basics),
   so specialties, marketing, research and similar are not even in the binary. Runtime module
   enablement (existing entitlement gate) stays for hospitals that want to switch modules on later.
2. **Dependency diet:** remove unused dependencies (the audit found e.g. `mlua` and the AWS S3 SDK
   unused in the server), dead crates (stub CMS, unused SNOMED client), and duplicates; a CI ratchet
   on the package count.
3. **Release profile tuned for size where it costs no speed:** thin LTO, one codegen unit, stripped
   symbols (already on); measure `panic = "abort"` and per-profile `opt-level`.
4. **Nothing optional on by default:** imaging (Orthanc), SpiceDB, PDF engine, mail server all
   optional in the clinic profile (RFC §8a).

Phases: **K3a** move patient/consent out of the kernel + the no-domain CI rule (done); **K3b** cut the kernel's dependency closure, ratchet it (done); **SM1** size budgets
measured and enforced in CI (kernel lines, kernel dependencies, package and crate counts, web first load; binary size per profile waits for SM2); **SM2** compile
profiles (`clinic` first) with the Pi image; **SM3** dependency diet ratchet.

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
- **D0–D4 OS images** (§8b): D0 signed `.deb` and apt repository; D1 Raspberry Pi image + first-boot
  wizard; D2 offline x86 USB installer (at most four questions); D3 VM images (OVA/qcow2/VHDX) +
  Windows installer; D4 A/B updates with automatic rollback, a database restore point before
  migrations, and the settings-survive-updates test.
- **FS1 Snapshot test** (§8b): measure candidate filesystems on real NVMe; adopt only through the gate.
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
  PostgreSQL, Orthanc, rustenberg (PDF and label printing), Stalwart (mail), SpiceDB (optional) are open source.
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
  instead, already supported), rustenberg (PDF; an 8 MB binary, but it needs a Chromium on the machine, so see §8n),
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

**No Docker (owner decision, 2026-11-02).** The OS, its installer and its services never use Docker. Everything
runs directly on Linux under systemd. Images are built on a Linux machine or CI runner with `mkosi` directly.
Container images remain only as an unadvertised option for hospitals that already run containers; no OS
feature may depend on them. A Mac cannot run `mkosi` natively, so building on one needs a Linux VM; the
normal path is CI.

**Base: existing Linux, not our own.** Every image is built on **Debian stable** (free, long-term
supported, official ports for amd64, arm64, armhf and riscv64; Raspberry Pi OS is Debian-based).
We use Debian's kernel and packages, PostgreSQL included, and add MedBrains on top. We never
maintain our own kernel. An immutable base (e.g. Debian with A/B partitions) is how D4 updates work.

**What every image includes:** first-boot web setup wizard; automatic updates with an A/B partition
(or snapshot) scheme so a failed update rolls back by itself; nightly backups to USB disk, network
share or cloud; a local health screen (disk, memory, backups, update status); offline operation with
cloud sync when the internet returns (the edge appliance's job today); signed images and checksums.

### Delivery rules (lessons from Omarchy, 2026-11-02)

Omarchy is an opinionated Arch-based desktop. We keep Debian as the base and take five delivery
ideas from it. Its speed and size figures are not ours; ours get measured on our own builds.

**1. One install path, in stages.** Omarchy began as a script on an existing system and became an
ISO later. Our order is the same, and every stage reuses the one before it, so there is one way
MedBrains gets installed rather than one per image:

| Stage | What | Status |
|---|---|---|
| D0 | `apt install medbrains` on existing Debian or Ubuntu LTS: a signed `.deb` with the server, the web UI, hardened systemd units and a PostgreSQL dependency | no packaging exists yet |
| D1 | OS image: Debian base plus the D0 package (D1's first build copies binaries in; it moves to the package once D0 lands) | building |
| D2 | Offline USB installer | planned |
| D3 / D4 | VM images and Windows; A/B updates | planned |

**2. An installer that asks almost nothing, and needs no network.**
- At most four questions: which disk (with a plain warning that it will be erased), how to unlock
  it (TPM, or passphrase where there is no TPM), the network (DHCP is the default), and a final
  confirmation. Hospital, admin and backups stay in the web setup wizard (§8k).
- The ISO holds everything the profile needs. A hospital with no internet can install and go live.
  Optional large downloads, such as AI models, stay optional.
- The hardware profile is detected, not asked. Hardware below the minimum is refused with a reason.
- A disk that already holds MedBrains data is never erased without typing the hospital's name, and
  the installer offers Recovery mode first.
- The recovery key is shown once and must be confirmed as saved before the install finishes.
- Install time is a budget measured in CI on a reference VM, starting from the first D2 build.

**3. Updates never touch settings.** Three places, with one owner each:

| Where | Holds | Written by |
|---|---|---|
| `/usr` (read-only, verified, replaced by updates) | code and shipped defaults | the update only |
| Data partition, config | what this hospital chose | the wizard and change sets only |
| Data partition, state | PostgreSQL, files, logs, backups | the running system |

Updates never merge into a hospital's config. Defaults change underneath it, and the hospital's
choices still win. D4 is not done until a test customises a device, updates it, rolls it back, and
proves the config is byte-identical each time.

**4. Our own signed channel.** MedBrains controls what reaches a device and when: a signed apt
repository for D0 and signed system images for D4, on the same release channels (canary, beta,
stable). A hospital picks its channel and maintenance window. Security fixes follow
`docs/SECURITY-RELEASE-PROCESS.md`. Hospitals without internet get the same signed bundle on a USB
stick. Publishing stays with the owner's release key.

**5. One beautiful, opinionated look.** The appliance console, boot screen and web shell are one
design with nothing to theme: status, the address to open, a QR code, and health in plain words. The
design system stays the single source of colour and type (WCAG 2.2 AA in light and dark). Emergency
codes stay fixed. No desktop environment is installed.

### Snapshots: measure before adopting

Filesystem snapshots could give a cheap Time Machine and a restore point before each update. They
are not adopted yet. D1 stays on **ext4**, the baseline every result is compared with.

**The problem they would solve.** A/B slots roll back the system, but not the database. If an update
has run a migration and the old system boots, the old code meets a newer schema. D4 therefore needs
a database restore point before any migration, whichever way this test ends. Without snapshots, that
restore point is a PITR marker, which is slower to restore.

**Rules that hold whatever the result:**
- A snapshot is not a backup: it dies with the disk. PITR, off-site backups and the monthly restore
  test (§8k) stay.
- Automatic restore is allowed only if no clinical data has been written since the snapshot, meaning
  the update failed before services accepted writes. After that, going back would silently lose
  patient records, so it needs a named person's decision and is recorded in the audit log.
- The data directory and WAL must be in one atomic snapshot. Restoring one is a crash recovery, so
  the test must prove PostgreSQL recovers from it.
- `fsync` and `full_page_writes` stay on.

**The test,** on real NVMe (Raspberry Pi 5 and one x86 SSD box), with `pgbench` plus a replay of
MedBrains' own write-heavy paths:

| Candidate | Note to test |
|---|---|
| ext4 (baseline) | no snapshots; PITR marker only |
| ext4 on LVM thin | snapshots without changing the filesystem; check slowdown while one exists |
| btrfs, copy-on-write on | keeps checksums; expect the worst write amplification and fragmentation |
| btrfs, `nodatacow` on the database | loses data checksums and compression, and snapshots still force copies on first write |
| OpenZFS | strongest snapshots, but an out-of-tree CDDL module; check Secure Boot signing, the verified-root design and Debian `contrib` packaging against §8 and §8j |

**Measure:** throughput and p99 latency, with and without a live snapshot; write amplification (it
wears cheap SSDs and SD cards); time to snapshot and restore; memory use on an 8 GB Pi; and power
cuts during writes, with `pg_amcheck` and `pg_checksums` run after each recovery.

**Adopt only if:** every power-cut run recovers cleanly, and p99 write latency on the Pi profile is
no more than 10% worse than ext4. Otherwise ext4 stays. The result goes in this section either way.

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

**Added 2026-11-02 (owner: "how does macOS protect their OS" → yes):**

1. **Verified, read-only system partition** (Apple's Signed System Volume). The OS root in every image
   is read-only and protected by a hash tree (Linux **dm-verity**) whose root hash is signed and
   checked at boot. Any change to a system file breaks verification and the slot will not boot; the
   other A/B slot boots instead and the health screen reports why. Writable state (database, files,
   logs, settings) lives only on the encrypted data partition.
2. **Service hardening** (Apple's System Integrity Protection + hardened runtime). Every MedBrains
   service runs as its own unprivileged user under systemd with: `ProtectSystem=strict`,
   `ProtectHome=true`, `NoNewPrivileges=true`, `PrivateTmp=true`, `PrivateDevices=true` (except the
   device bridge, which gets only its devices), `ProtectKernelTunables/Modules/Logs=true`,
   `RestrictAddressFamilies` to what it needs, `MemoryDenyWriteExecute=true`, `LockPersonality=true`,
   `CapabilityBoundingSet=` empty, and a **seccomp** allow-list (`SystemCallFilter=@system-service`
   minus anything unused). `systemd-analyze security` scores are part of the release checks: no
   service ships above "OK".
3. **Lockdown mode** (Apple's Lockdown Mode) for hospitals at high risk (targeted attacks, VIP
   patients, conflict areas). One switch, through a change set with two approvals: third-party
   extensions and plugins off except certified ones the hospital pins, all outside lookups off
   (advisory fetch, weather, feeds, AI hosted models), shorter sessions with MFA on every
   privilege use, new device logins need admin approval, exports and bulk reads need a second
   person, and the security runner moves to its strictest cadence. Lockdown is visible in the
   header to every user so nobody is surprised by refusals.

**Also:** supply-chain safety (`cargo-deny` today; add an SBOM, signed releases and reproducible
builds), a public security policy and bug bounty, independent penetration tests before each major
release, and ISO 27001 for MedBrains-hosted installs.

**Rules:** security features are never paid extras; no telemetry or data leaves an install unless
the hospital turns it on; every security claim on the website links to its evidence.

Phases: **SEC1** signed releases + SBOM + reproducible builds; **SEC2** privacy labels in the
manifest and the hospital approval screen; **SEC3** secure boot, TPM, disk encryption and the
**dm-verity read-only root** in OS images; **SEC4** bug bounty + external penetration test + ISO
27001 for hosting; **SEC5** systemd hardening + seccomp for every service (gated by
`systemd-analyze security`); **SEC6** lockdown mode.

## 8k. Bare-metal installation and recovery

**Bare metal (from the ISO or Pi image, §8b):**
- Boots a text + browser installer on any supported machine; detects disks, CPU and RAM and refuses
  hardware below the profile's minimum with a plain reason.
- Disk layout: EFI, two root slots (A/B) for safe updates, a recovery partition, and an encrypted
  (LUKS) data partition for PostgreSQL, files and backups, on ext4 unless the snapshot test (§8b)
  says otherwise. Optional mirrored disks (RAID-1).
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

## 8m. The best idea from every OS

| OS | Its best idea | How MedBrains takes it |
|---|---|---|
| **Linux / Debian** | runs on everything; open; huge driver base | our foundation (§8b) |
| **Unix / BSD** | small composable parts, clean interfaces; ZFS snapshots | crate design, kernel interface; snapshots for Time Machine if they pass the test (§8b) |
| **macOS / iOS** | polish, privacy labels, sandboxing, Handoff, signed apps | signature features (§8d), security layers (§8j) |
| **Android** | runs on cheap hardware; permissions per app; Play Store reach | Raspberry Pi profile (§8a), per-extension grants, the store |
| **ChromeOS** | verified boot, automatic updates, nothing to maintain | signed images, A/B updates with rollback, appliance model |
| **Windows** | works with the hardware and software hospitals already own | Hyper-V/MSI path (§8l), directory (AD/Entra) connectors |
| **QNX** | microkernel trusted in medical devices and cars; real-time | tiny kernel, critical-alert latency budget (§8i) |
| **seL4** | a kernel proven correct; capability-based security | capability-style grants (extensions hold only what they're given); formally checked rules where feasible (flow invariants, authz) |
| **Fuchsia** | capabilities instead of ambient authority | no ambient access: every call carries the actor and its grants through the kernel |
| **Plan 9** | everything reachable through one namespace | the path tree for settings and data (MUMPS-style), §3.1 item 8 |
| **NixOS** | the whole system declared in one file, reproducible, roll back any time | declarative hospital setup (switches, flows, settings) as versioned change sets; reproducible builds |
| **Erlang/OTP** | "let it crash": supervisors restart failed parts; nine-nines uptime | crash-only services, supervised background workers, idempotent retries (OS-PRINCIPLES §4) |
| **VMS / mainframes** | decades of uptime, clustering, audit everything | hash-chained audit, replicas, careful upgrades |
| **Omarchy** | a tiny offline installer, settings that survive updates, one opinionated look | delivery rules (§8b) |

**Rule:** we borrow ideas, not code that would bring a licence or a proprietary dependency (§8).

**Languages (2026-11-02).** All new MedBrains server and OS code is Rust. We build on proven C
foundations (Linux, PostgreSQL, systemd) and replace one only when the Rust version is mature and
clearly lowers risk. Linux itself has not moved to Rust: it is permanent there, but still a small
share of the kernel. Do not describe MedBrains as "100% Rust".

**pgrust: watch, do not adopt.** pgrust is a Rust rewrite of PostgreSQL 18 that matches PostgreSQL's
regression output. Its own README says it is not production-ready. It is also AGPL-3.0, which is
stricter than the Apache-2.0 terms partners build on here, and regression tests do not prove crash
recovery or correctness under concurrency, which is what patient records depend on. Review it again
only when it has real production use, independent crash and corruption testing, and a licence
compatible with §8. The SQL and migrations stay plain PostgreSQL, so a later move stays possible.

## 8n. The interface stack (as good as the kernel)

Every great OS pairs its kernel with one consistent interface stack. MedBrains' stack:

| Layer | macOS | Linux | MedBrains |
|---|---|---|---|
| Display / compositor | Quartz | Wayland (Mutter, KWin) | the browser on staff devices; on the appliance's own screen, a Wayland kiosk compositor (`cage`) running a minimal browser engine (WPE WebKit or Chromium) |
| UI toolkit | AppKit / SwiftUI | GTK / Qt | the `@/components/ui` seam on Mantine (web); SwiftUI (iOS), Compose / Material 3 (Android), Compose for TV |
| Design language | Aqua / Liquid Glass | Adwaita, Breeze | Carbon-based tokens in `@medbrains/design-system`, light and dark |
| Interface guidelines | Apple HIG | GNOME HIG | **MedBrains HIG**: `UI_GUIDELINES.md` + the Carbon rule docs + device-surface rules, consolidated into one book |
| Shell | Finder, Dock, menu bar | GNOME Shell, KDE Plasma | the app shell (`AppLayout`), TV and kiosk shells, the appliance console |

**System-level shell features** (every screen gets them free, like an OS):
- **Spotlight** (exists: `SpotlightProvider`): one command palette for search, actions and
  navigation, permission-checked, keyboard first (⌘K / Ctrl K).
- **Notification Center** (exists: `NotificationCenter`) + **Focus** modes (on duty, on call,
  off duty / critical only).
- **Patient tabs:** several patients open side by side like browser tabs, with Handoff to the phone.
- **One status bar:** network/offline state, sync, the clinician's shift, unread critical alerts.
- **Consistent app chrome:** every flagship app shares header, breadcrumbs, empty/error/loading
  states and keyboard shortcuts from the seam, so learning one teaches all.

**The appliance's own screen:** a box with a monitor boots straight into `cage` + browser engine
showing the local console: setup wizard, health, backups, updates, recovery. No desktop
environment, nothing to maintain, the same web UI as everywhere else.

**One browser engine if we can.** rustenberg prints through Chromium, while the appliance screen uses WPE
WebKit. A machine that prints would carry both. Measure size, memory and how the real app runs on each
(WPE only, Chromium only, or both by profile), and prefer one engine unless the numbers say otherwise.

**Quality bar (measured, like speed):** 60 fps scrolling and animation on mid-range hardware and a
Raspberry Pi 5 browser; interactions acknowledged within 100 ms; motion per the Carbon motion rules
with reduced-motion fallbacks; WCAG 2.2 AA in both themes (already enforced by
`theme-contrast.spec.ts` and Biome a11y rules); type and spacing only from tokens.

Phases: **UI1** shell features made system-level (Spotlight actions registry, Focus, status bar,
patient tabs); **UI2** the MedBrains HIG book; **UI3** appliance console on `cage` + WPE; **UI4**
frame-rate and responsiveness budgets in CI (Playwright traces).

## 8o. Hardware safety (why our code can't burn a chip, and what can actually hurt hardware)

MedBrains runs in **userspace** on Debian's Linux kernel. It writes no drivers or firmware and never
controls voltage, clocks or fans. CPU firmware and the kernel throttle and shut down on overheating;
safe Rust plus kernel memory protection mean a bug crashes a process, not the machine; WASM blocks
are sandboxed and time-boxed (fuel/epoch limits) so a bad plugin can't spin forever.

Real risks for an appliance, and the defences every image and profile must ship:

| Risk | Defence |
|---|---|
| **Flash / SD wear** (most common failure of small boards) | NVMe/SSD required in the clinic profile, never SD for data; quiet logging at normal levels; PostgreSQL + WAL tuned for flash; SMART / wear shown on the health screen with an early warning |
| **Heat / throttling** | active cooling required on Pi-class boards; temperature and throttle state on the health screen; alert before limits |
| **Power loss mid-write** | PostgreSQL crash-safe settings never disabled for speed (`fsync`, `full_page_writes` on); UPS support with clean shutdown (NUT); A/B system slots |
| **Runaway CPU/memory** | systemd `CPUQuota`/`MemoryMax` per service; bounded loops, queues and caches (DSA law); hardware watchdog reboots a frozen box |
| **Firmware updates** | never auto-flashed; only vendor-tested firmware, applied by a person with a rollback path |

These are checks in the continuous runner (RFC-OSINT §3a): disk health, temperature, throttling,
memory pressure, UPS state, watchdog status.

## 8p. Accelerators: GPUs, NPUs and modern CPUs (any vendor, never required)

Owner direction: use the graphics and AI-chip era (NVIDIA GPUs, NPUs in Snapdragon, Intel, AMD and
Apple chips, ARM everywhere) for advanced features, across chip architectures.

**Rule:** acceleration is an optimisation, never a requirement. Every feature has a CPU path, so the
zero-licence and any-chip promises (§8, §8c) still hold. Vendor runtimes that are free but not open
(e.g. CUDA) are optional add-ons, detected at run time.

### One portable AI runtime, many chips
The kernel AI service (§8h) runs models through portable runtimes that pick the best device present:
| Runtime | Accelerates on |
|---|---|
| **ONNX Runtime** execution providers | NVIDIA (CUDA/TensorRT) · Snapdragon NPU (QNN) · Intel CPU/GPU/NPU (OpenVINO) · AMD (ROCm / Ryzen AI) · Apple Neural Engine (Core ML) · Windows any GPU (DirectML) · CPU everywhere |
| **llama.cpp / Ollama** (local language models, GGUF) | NVIDIA (CUDA) · Apple (Metal) · AMD/Intel/ARM GPUs (Vulkan) · CPU (NEON / AVX) |
| **WebGPU / WebNN in the browser** | the staff device's own GPU/NPU, for client-side work (viewer rendering, small models) |

A device-capability probe at start-up records what the box has (CPU features, GPU, NPU, memory) on
the Kernel page; models are packaged once (ONNX/GGUF) and the runtime chooses the device.

### Features this unlocks
| Feature | What the chip does | Minimum hardware |
|---|---|---|
| **Scribe on the box** | speech-to-text (Whisper-class) and note drafting with a local model; no audio leaves the hospital | NPU laptop / mini PC, or GPU; CPU works, slower |
| **Case-sheet and document OCR** | read scanned forms and old records into structured data | Pi 5 + AI accelerator HAT, NPU or GPU |
| **Imaging AI, assistive** | triage hints on X-ray/CT (e.g. "possible fracture, review first"), always labelled, a radiologist decides | NVIDIA GPU or Jetson-class edge box |
| **Built-in imaging viewer** | GPU-rendered DICOM, smooth window/level, 3D | any device with WebGPU |
| **Command Centre at 60 fps** | big-screen live boards rendered on the GPU | any modern GPU / TV box |
| **Camp screening** | camera-based screening (e.g. eye-scan partners) at the edge, offline | NPU / GPU edge box |
| **Faster core** | hardware SHA-256 (audit chain), AES (encryption), SIMD for analytics and compression | every modern x86 / ARM CPU (SHA-NI, ARMv8 crypto, AVX2, NEON) |

### Hardware kit tiers (fits the hardware moat)
| Kit | Chips | For |
|---|---|---|
| **Clinic** | Raspberry Pi 5 + optional AI HAT (Hailo-class NPU) | single clinic, OCR, small models |
| **Hospital edge** | mini PC with Snapdragon X / Intel Core Ultra / AMD Ryzen AI (NPU built in) | Scribe, OCR, local assistant, offline operation |
| **Imaging & AI** | NVIDIA RTX workstation or Jetson Orin-class box | imaging AI, larger local models |

Each kit certified (lesson 4 of OS-PLATFORM-LESSONS), with measured performance per model published.

### Safety and law
- Anything that suggests a diagnosis (imaging triage, screening) is **Software as a Medical
  Device**: it needs clinical validation and regulatory approval (CDSCO in India; FDA/CE elsewhere)
  before clinical use. Until then it runs only as clearly labelled research/assistive output, off by
  default, and never decides.
- Every model passes the `medbrains-ai-eval` suite for its task before release, through a change set.
- Heat and power: inference jobs respect the hardware-safety limits (§8o): thermal and power caps,
  throttling, and a queue so clinical requests always come first.

Phases: **HW1** device-capability probe + Kernel page + hardware crypto/SIMD audit; **HW2** ONNX
Runtime in the AI service with CPU + one accelerator path, OCR as the first workload; **HW3** local
Scribe (speech-to-text) on NPU/GPU kits; **HW4** WebGPU imaging viewer; **HW5** imaging AI
(assistive, research-labelled) on the imaging kit, pending validation.

## 8q. Best in class: network, security, speed, small size (owner goal, 2026-11-02)

"Best in class" is a claim we earn with numbers anyone can reproduce. Nothing is called best in
class publicly until it has a published test and a named comparison. The rivals are other hospital
systems on the same hardware, and appliance systems for install and update experience.

### The scoreboard

Published with every release. Targets below that have no figure yet get one when their phase starts;
§3a and §8i hold the existing budgets.

| Axis | What we measure | Today (2026-11-02) | Honest gap |
|---|---|---|---|
| **Small** | kernel lines, kernel dependency closure, packages, image size, idle memory, install time | kernel 873 code lines; closure 272 of 1,321 packages (163 resolved); 162 crates; image and memory not yet published | The kernel no longer sits on the web stack (K3b, §3a). The workspace is still large, and nothing about the running system is published yet |
| **Fast** | §8i budgets, on x86 and a Pi 5 | transaction setup fixed from 15.7 ms to about 0.1 ms; harness (S1) not built | No published numbers, and no comparison |
| **Secure** | open advisories, boot-to-login verified chain, external penetration test, patch time against `SECURITY-RELEASE-PROCESS.md` | RLS, three-outcome authorisation and audit exist; CI shows open dependency advisories; verified boot planned; no external test | Advisories first, then an independent test. Our own opinion of our security proves nothing |
| **Network** | below | nothing measured | This section is the plan |

### Networking: the hospital keeps working

**The test every design must pass: pull the internet cable during a busy shift.** Care continues.

- **LAN first.** Everything clinical runs on the hospital's own network. Losing the internet costs
  only cloud sync and optional services.
- **Server loss is planned for.** Devices fall back to offline mode and sync with each other over the
  LAN (iroh peer sync), then reconcile. A hospital that wants it runs a replica with automatic
  failover and a second network link.
- **Bad networks are the normal case.** CI replays critical journeys over a simulated poor link
  (`tc netem`: loss, latency, drops) and holds them to budgets, including the 2-second critical alert.
- **Plain-language network health.** An Admin screen and the appliance console show which devices,
  analysers and links are down and what to do, so a ward does not need a network engineer.

### Networking: secure by default

- **Default deny, both directions.** `nftables` allows only the documented ports; each service is
  limited to the addresses it needs through systemd; outbound is an allowlist (the egress check exists).
- **Separate networks.** Staff, clinical devices and guests are apart. Older analysers often speak
  plain HL7 or DICOM, so that traffic stays on the device network and passes through a gateway on the
  appliance. It never crosses the staff network unencrypted.
- **Encryption everywhere it can reach.** TLS 1.3 through `rustls` on our own services, with a local
  certificate authority set up at install. Devices and vendor apps get their own identities (mutual
  TLS or scoped tokens), so being on the network grants nothing.
- **No open inbound for remote access.** Site links and remote support use WireGuard, which is in the
  Linux kernel. Support access is off by default, time-limited, approved by the hospital and audited.
  There is no vendor backdoor.
- **Authenticated time.** Clinical records depend on the clock: move from `systemd-timesyncd` to
  `chrony` with NTS, and warn when the clock drifts. The appliance keeps serving the LAN its time when
  the internet is gone.
- **Hostile traffic.** Rate limits, connection limits and slow-client protection at the proxy. Heavy
  intrusion detection (Suricata) is optional and never in the clinic profile.

### Networking: fast and small

- **One proxy.** The D1 image uses Caddy, and we already own `medbrains-proxy` (Rust, Pingora). Measure
  size, memory, throughput and certificate handling, then keep exactly one.
- **Only what measures faster.** BBR congestion control, HTTP/3 for phones on poor links, kernel TLS,
  `io_uring` and eBPF are each tested against the §8i budgets and adopted only if they pay.
- **Fewer TLS stacks.** `Cargo.lock` carries OpenSSL, `ring` and `aws-lc-rs`. Find what pulls each in,
  and reach one for what we ship.

### Rules

- A new appliance package needs a line in the size budget saying why.
- Security wins over speed, and speed wins over size, when they conflict. A clinical safety rule beats
  all three.
- We do not modify Linux and do not ship kernel modules (§8o). Everything above uses what Linux has.

**Phases:** **N1** default-deny firewall and service limits in the image, with `chrony`; **N2** one proxy
and one TLS stack, by measurement; **N3** the poor-network test in CI and the Network health screen
(permission defined in Rust first); **N4** device network gateway, local certificate authority and
device identities; **N5** WireGuard site links and audited remote support; **N6** replica failover, and
the public scoreboard with a reproducible comparison.

## 8r. Fleet management and built-in protection (owner goal, 2026-11-02)

The owner wants what corporate IT has, built in: machines managed and controlled remotely, and
endpoint security in the OS itself, in the manner of a product like Trellix. A hospital should not
need to buy either to be safe. No licence, no vendor code: we take the idea and build on open parts.

**A device fleet.** A hospital's IT team manages every appliance, workstation, display, kiosk and phone
from one screen.

| Capability | What it does | Today |
|---|---|---|
| Enrol | one QR code or signed token; the device gets its own identity | device pairing, `paired_devices` and `vpn_devices` exist |
| Inventory | model, OS version, disk and health, last seen, location | partly, split across those tables |
| Policies | lock timeout, USB rules, allowed apps and updates, by group or ward | not built |
| Updates | signed updates by ring and maintenance window, per §8b | planned (D4) |
| Remote support | see or control a screen, or run approved actions, with the rules below | not built |
| Lock and wipe | lock a lost device; wipe with two people's approval | not built |
| Remote access path | no open inbound ports | WireGuard and Headscale exist as an opt-in (`RFC-VPN-PLATFORM`) |

**Protection.** One security screen alongside the fleet.

| Area | How | Today |
|---|---|---|
| Only trusted code runs | verified read-only system (§8j), stronger than scanning | planned |
| Watch for intrusion | system and process events (`osquery`, `Falco`), within the size budgets; the Pi clinic build may get less | not built |
| Respond | isolate a device from the network in one action, leaving the path IT needs | not built |
| Scan uploads | malware scan of files people upload (ClamAV) | not built |
| Data leaving | export limits, watermarks, record-read audit, USB control | app side exists; USB not built |
| Hospital-aware alerts | signals only we can see, such as one login opening hundreds of records at night | the kernel sees the access; rule not built |
| Send onward | connector to a hospital's SIEM | not built |

**Remote control is the most dangerous feature in this RFC.** One compromised management tool can reach
every machine at once, as the 2021 Kaseya attack did. So these rules bind it:

1. **The hospital holds the keys.** Each hospital's fleet has its own keys and console. MedBrains and
   partners have no master key and no standing access to any hospital. There is no global off switch
   or backdoor.
2. **Off until asked.** A session needs a named person, a reason and an approval, runs for a set time,
   and ends by itself. Vendor access stays off by default (§8q).
3. **Visible and refusable.** The screen shows when someone is watching. At a clinical workstation the
   person using it can see who, and end it.
4. **Patient data rules still apply.** A remote viewer sees patient data, so it is audited like any read.
   Sessions are logged, and the screen is recorded only where the hospital's policy says so and the
   recording is itself treated as patient data.
5. **Do no harm.** No restart, update or lock on a device in clinical use without warning and a
   maintenance window. An emergency override is logged and reviewed.
6. **Regulated devices stay out.** Ventilators, monitors, infusion pumps and analysers are never remotely
   controlled by this system. It reads from them through their interfaces only.
7. **Signed commands, least privilege.** Each command is signed and checked on the device, and each
   action has its own permission, defined in Rust first: viewing the fleet, remote control, isolating
   and wiping are separate grants. Wipe needs two people.

**Limits we state plainly.** We will not match a large vendor's threat research, so we use public feeds
and open rules. Some auditors and insurers require a named, certified product; hospitals in that position
can still run one. We do not claim to replace any product until an outside party has tested this.

**Build on, do not reinvent.** Candidates to evaluate for licence, size and fit (§8): `wayvnc` for the
appliance's screen, Apache Guacamole or MeshCentral for browser-based sessions, osquery for inventory,
Android Enterprise and Apple device management for phones. A remote session must work with the `cage`
kiosk, which needs testing.

**Phases:** **M1** one fleet screen over the existing device tables, with permissions; **M2** policies and
update rings; **M3** remote support on a test device, under all seven rules, then an outside security
review before it reaches a hospital; **M4** lock, wipe and isolate; **M5** intrusion watching and the
security screen; **M6** phone management and the SIEM connector.

## 8s. First-boot setup and nodes (owner goal, 2026-11-02)

The app runs on the machine's own screen; a browser elsewhere is an option, not the main path. A new
machine asks a few plain questions, then gets out of the way. Every step works with no internet.

**The flow on every new machine:**

1. **Network.** Connected by cable through DHCP: show the address and move on without asking. Otherwise
   offer Wi-Fi, or a fixed address, gateway and DNS. Proxy and VLAN sit under "More". The screen tests the
   local network, then the internet, and says in plain words what works. No internet is a valid answer,
   not an error.
2. **Time.** Set from the network; ask only when the clock cannot be trusted, because clinical records
   depend on it.
3. **Updates.** With internet, check the signed release channel, show what is available, and offer
   "Update now" or "Later". Security fixes are marked. With no internet, say so, and offer the signed USB
   bundle (§8b). Setup is never blocked by this, and the check never installs anything unsigned.
4. **What is this machine?** Administrator machine, or sub node. If an administrator machine is found on
   the network, the screen says so and recommends joining it, so nobody creates a second by accident.

**Administrator machine:** create the admin, run the existing hospital setup wizard (`pages/onboarding`),
and end on the Nodes screen.

**Sub node:** find the hospital (local discovery, address or QR code), choose a type, and show a code for
the administrator to approve. Reuses device pairing (`medbrains-device-pairing`).

| Type | What it does | Patient data stored on it |
|---|---|---|
| Workstation | staff sign in and work | none, or only what offline mode needs |
| Display | queue board or TV | none |
| Ward backup | keeps a ward running if the main machine or network fails | yes, encrypted |

**Nodes screen** (administrator machine): machines waiting to join; every node with its name, type,
location, status and version; rename, move, update and remove. It grows into the fleet console (§8r).

**Rules:**
- No machine joins without an approval, which is audited. The sub node also verifies the administrator
  machine's identity, since a code alone does not prove it found the real one.
- The role is set at first boot. Changing it is a deliberate reset, never silent for a machine holding data.
- Removing a node ends its access immediately on the server. A machine that is offline learns this only
  when it reconnects, so ward backups need a stated limit on how long they keep working unconnected.
- Permissions are defined in Rust first. An existing pairing permission is reused only where it truly fits.
- Network settings live on the data partition and survive updates (§8b). A change that cuts the network
  rolls back by itself unless confirmed, so a remote admin cannot lock themselves out.

**Real updates depend on D4.** Until A/B updates exist, step 3 can only check and report; it must say that
rather than pretend to install.

**Phases:** **B1** network, time and role screens with administrator setup; **B2** join as a workstation,
and the Nodes screen; **B3** update check against the signed channel, then installing it once D4 lands;
**B4** display; **B5** ward backup, last, because sync and failover are the hardest and riskiest part.

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
