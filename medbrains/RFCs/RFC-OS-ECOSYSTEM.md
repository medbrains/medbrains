# RFC: MedBrains OS ecosystem: drivers, connectors and apps

**Status:** Proposed, for the owner to decide. Design only; nothing here is built by this RFC.
**Date:** 2026-11-18. **Parent:** `RFC-HOSPITAL-OS.md` (§4 drivers, §5 store, §8f, §8g, §8j).
**Binds:** `docs/OS-PRINCIPLES.md` (all of it, every extension is class A code), `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md`
(the four axes apply to every extension), `docs/COMPATIBILITY.md` (the version promise).

## 0. Summary

MedBrains OS should be a platform that many outside builders can build on without asking us.
The owner names three kinds of builder, and this RFC gives each one a contract:

| Type | Built by | What it does | Runs where |
|---|---|---|---|
| **Driver** | machine vendors | talks to a device and turns its output into MedBrains results, images or events | inside the device host on the OS box or a node, as a sandboxed WebAssembly component |
| **Connector** | data vendors | exchanges data with an outside system under the hospital's consent | as an outside service (OAuth + signed webhooks, exists today), or on the box as a WebAssembly component when it must work offline |
| **App** | any business | adds a brick: screens and workflows | as an outside web app launched from the shell (SMART on FHIR), using MedBrains sign-in, permissions, design system and data classes |

All three share **one manifest** (an extension of the one that ships today), **one approval
screen**, **one revoke button**, **one signing scheme** and **one audit trail**. Nothing an
extension does skips the kernel's checks.

Two headline services sit on top of the three types:

- **Payments are a built-in OS service** (§4). Every app calls one "collect this amount for this
  bill" service; payment providers are connectors and card terminals, soundboxes, QR displays,
  receipt printers and cash drawers are drivers. Much of it is built today, compiled in (epic #4875).
- **Commerce is built in** (§10). The platform sells and delivers vendor extensions, our own brick
  plans, preloaded OS boxes, vendor certification and support plans, with **signed licences checked
  offline** that never lock a hospital out of its patients' records.

The wedge is the **lab-analyser driver kit** (phase 1): it is the type with the most built pieces,
the clearest standard (ASTM E1394 / CLSI LIS2-A2, HL7 v2 ORU), and the largest daily pain in a
hospital lab. A **payments kit** runs beside it as phase 1b, and phase 1 includes the minimum
commerce needed to sell that first driver.

The most important finding is about the claim we already make. `RFC-HOSPITAL-OS.md` §4 says device
adapters "already compile to WebAssembly and load without changing the core". The SDK compiles to
WebAssembly, but **nothing in the workspace loads WebAssembly**: no runtime is a dependency, and
`crates/medbrains-workflow/src/orchestration/code_executor.rs` refuses WASM execution ("disabled
until an MSRV-compatible patched runtime is available"). Today every protocol is compiled into
`medbrains-bridge`. This PR adds a correction note to that section.

## 1. Goals and non-goals

### Goals

1. **The frictionless test.** A competent vendor builds, tests and self-certifies a driver,
   connector or app **in days, without talking to us**, using only the public docs, the SDK, the
   CLI, the simulator and the sandbox hospital. A hospital installs it in **one click after reading
   one plain-language screen**, and can revoke it in one click. We measure this: phase 1 ends with
   someone outside the team building a driver from the docs alone, timed.
2. **Same gate for everyone** (OS-PRINCIPLES §8.1). Our own drivers and connectors use the same
   contract. No privileged path for partners, and none for us.
3. **Grants, not trust** (OS-PRINCIPLES §8.2). An extension gets what its manifest declares and a person approved,
   nothing else. Refusals are audited.
4. **Bounded and safe on small boxes** (OS-PRINCIPLES §8.3). Every extension has a memory, CPU, queue and egress
   limit. One bad extension cannot stop care, take another's data, or lose a result.
5. **Global by design.** The contracts are FHIR R4 and the device standards, not India-only shapes.
   India (ABDM, NHCX, NABL, CDSCO, DPDP) is the first country pack, delivered as connectors and
   rules, not special cases in the core.

### Non-goals

- **No kernel-mode drivers, ever.** "Driver" means a userspace program that speaks a device
  protocol (DECISIONS 2026-11-01, "Kernel means a small MedBrains layer in userspace").
- **No database access for any extension.** Not read-only, not "trusted partners".
- **No controlling regulated devices** (no sending settings to a ventilator or infusion pump). Drivers
  read results and, where the protocol defines it, send orders and worklists. Same line as `RFC-HOSPITAL-OS` §8r.
- **No business terms in this RFC.** Prices, shares, fees and the legal entity are owner decisions (§10).
- **No legal conclusions.** Sections 4.5, 9.3 and 10.7 mark questions for the owner and counsel.
- **No Docker or containers** as the isolation tool (DECISIONS 2026-11-02, "No Docker in the OS").

## 2. What exists today

Evidence is file paths in this repository, read on 2026-11-18. "Exists" means merged and reachable;
"partial" means built but missing a piece the ecosystem needs; "missing" means not started.

### 2.1 Drivers

| Piece | State | Evidence |
|---|---|---|
| Device protocol host on site | **Exists**, compiled in | `crates/medbrains-bridge`: HL7 v2 MLLP listener (`hl7_listener.rs`), ASTM E1381/E1394 over TCP (`astm.rs`), analyser orders out as HL7 ORM (`orders.rs`), print delivery to network/USB printers (`printer.rs`), card machines (`card_terminal.rs`, simulator only), SQLite buffer for offline (`buffer.rs`), heartbeat, Headscale or WSS transport |
| Result ingest with safety holds | **Exists** | `POST /api/device-ingest/{module}` (`crates/medbrains-devices/src/lib.rs:1111`), guarded by `devices.ingest`, tenant from the caller. Results match by sample barcode only, corrections replace, anything uncertain is held as `NeedsReview` (`crates/medbrains-server/tests/analyser_results_test.rs`); expired calibration locks the analyser out (`calibration_lock_test.rs`) |
| Adapter SDK | **Partial** | `crates/medbrains-adapter-sdk` (928 lines): `AdapterManifest`, `FieldMapping`, quirks, HL7 ORU parser. A library the bridge links, not a plugin ABI |
| WebAssembly runtime | **Missing** | no `wasmtime`/`wasmi`/`extism` in any `Cargo.toml`; `code_executor.rs` refuses WASM; `compile_rust_to_wasm` always fails |
| Device catalogue | **Partial, and misleading** | `device_adapter_catalog`, 31 seeded rows (`migrations/0950_reference_data.sql`): 21 ASTM, 10 HL7 v2; 16 of them serial. **All 31 have `is_verified = true`, empty field mappings and no `wasm_hash`.** "Verified" means nothing today |
| Serial ports | **Missing** | the bridge's ASTM is TCP only; `bridge.example.toml` says serial analysers need a serial-to-TCP converter, which covers 16 of 31 catalogue rows |
| Admin screens | **Exists** | `apps/web/src/pages/admin/devices.tsx`, `DeviceMessagesDrawer.tsx`, bed assignment, message log, config history, routing rules |
| Imaging | **Exists, not a driver** | DICOM goes modality → Orthanc; MedBrains reads Orthanc and DICOMweb (`crates/medbrains-radiology/src/pacs.rs`, `pacs_config.rs`, `dose_capture.rs`), worklists via the outbox (`handlers/pacs_worklist.rs`) |
| Bridge on the OS image | **Missing** | `os/README.md`: "`medbrains-bridge`, separate worker process: none … arrives with its first device"; no unit in `os/mkosi.extra/usr/lib/systemd/system/` |
| Kernel boundary | **Not yet** | `boundary.txt`: `medbrains-devices not_yet 46 medbrains-db`; it keeps its own `require_permission` with the bypass roles (`devices/src/lib.rs`) |
| Simulator for vendors | **Missing** | bridge tests build real-shaped ORU messages; there is no analyser simulator a vendor can run |

### 2.2 Connectors

| Piece | State | Evidence |
|---|---|---|
| Out-of-process extension protocol v1 | **Exists** | `docs/extensions/PROTOCOL.md`: OAuth 2.0 client credentials, 15-minute tokens, signed webhooks (HMAC-SHA256, replay window, idempotent ids), three outcomes on the wire (`503` is "could not decide", never "no data") |
| Manifest + privacy label + approval + revoke | **Exists** | `crates/medbrains-connected-apps/src/manifest.rs`, `lifecycle.rs`, `token.rs`; `docs/extensions/manifest.schema.json` with shared fixtures; `apps/web/src/pages/admin/connected-apps/`. Nobody can approve permissions they do not hold |
| Webhook egress guard | **Partial** | `medbrains_outbox::handlers::webhook::is_allowed_target` refuses localhost and private addresses. It checks the address, not what is sent |
| Durable delivery | **Exists** | `crates/medbrains-outbox`: transactional outbox, jittered backoff, dead-letter after 10 attempts |
| FHIR R4 surface | **Partial** | `crates/medbrains-fhir-api/src/lib.rs`: read `Patient`, `Patient/$everything`, `Encounter`, `DiagnosticReport`, `Observation`. Protocol v1 exposes three (`READS` in `manifest.rs`). No search, no write (C3 in `RFC-HOSPITAL-OS` §6) |
| Events | **Partial** | 60 typed events (`ClinicalEventName`, `crates/medbrains-core/src/clinical_events.rs`; envelope in `docs/architecture/cross-module-events.md`), delivered as webhooks. No NATS (listed as "future" in ENGINEERING.md) |
| Provider-neutral layers | **Exists, compiled in** | payments: `OnlineProvider` trait with capabilities (`payment-gateway/src/online/mod.rs:317`, four providers in `PROVIDERS`, `GET /api/payments/capabilities`), `PosProvider`; `crates/medbrains-integration-hub` (routing modes, used only by `hrms-gateway`); `RFC-INTEGRATION-WRAPPER.md` |
| Country exchanges | **Partial** | ABDM and NHCX built (`medbrains-abdm`, `outbox/handlers/nhcx`, `medbrains-nhcx-callback`); NABIDH, Malaffi, NPHIES exist only as backlog stories (`docs/backlog/stories/11-regulatory-compliance.md`) |
| Third-party connector inside MedBrains | **Missing** | every provider is our code, compiled in. A vendor cannot add a TPA or a lab chain without a PR to us |

### 2.3 Apps

| Piece | State | Evidence |
|---|---|---|
| Brick registry | **Exists, compiled in** | `crates/medbrains-core/src/bricks.rs` (one row per module, dependencies, permission prefixes, editions), `module_config`, whole-router gating (#5243), `scripts/check_bricks.py`, `docs/architecture/MODULE-BRICKS.md` |
| Screens and permissions | **Exists, compiled in** | `crates/medbrains-core/src/access/screens.rs`, permissions generated from Rust (`scripts/generate_permissions_ts.py`) |
| Data classes and denial modes | **Exists** | `DataClass` in `crates/medbrains-authz/src/classification.rs`, `field_class::class_of` (`field_class.rs`), RFC-AUTHZ §3 |
| SDKs and CLI | **Partial** | TypeScript `@medbrains/sdk` (`packages/sdk`: `ext init`, `ext validate`, `ext test` conformance against a mock) and Python `medbrains-sdk` (`sdks/python`), both Apache-2.0 |
| SMART app launch | **Missing** | `redirectUris` is reserved in the manifest, "later phase" (`PROTOCOL.md` §3) |
| Third-party brick in the launcher | **Missing** | bricks are a Rust `const`; there is no row type for a brick we did not compile |
| Marketplace | **Missing** | `apps/web/src/pages/store/` is the pharmacy storefront, not an extension store; K6 not started |

### 2.4 Shared foundations

| Piece | State | Evidence |
|---|---|---|
| Kernel facade and checks | **Exists** | `crates/medbrains-kernel` (three outcomes, audit, events, config, seq, store); `make check-kernel-boundary`, `check-kernel-no-domain`; 12 crates on the facade, 18 partial, 124 not yet (`boundary.txt`) |
| Signing infrastructure | **Exists for OS updates** | Ed25519 roots, 2-of-3 hardware tokens, 30-day intermediates, rising revocation list (`docs/architecture/OS-SIGNING-KEYS.md`, `crates/medbrains-os-update/src/manifest.rs`). No `extension` purpose yet |
| Service sandboxing | **Partial** | OS units use systemd hardening (`os/mkosi.extra/usr/lib/systemd/system/*.service`); `docs/architecture/OS-PROTECTION.md` plans Landlock and seccomp; `RFC-HOSPITAL-OS` §8j SEC5 gates it on `systemd-analyze security` |
| Sandbox hospital image | **Partial** | the OS release builds `.qcow2`, `.ova`, `.vmdk`, `.vhdx` (`os/formats.sh`); downloads wait on phase 0. No seeded demo tenant ships in it |
| Docs portal | **Exists** | `apps/docs` (Docusaurus, style guide `apps/docs/STYLE.md`) |
| Compatibility promise | **Exists** | `docs/COMPATIBILITY.md`, `PROTOCOL.md` §2 |

**Reading of the tables.** The out-of-process path (connectors and apps as outside services) is
real and well guarded. The in-process path (drivers and on-box connectors as plugins) is a design
with an SDK and no host. The marketplace and certification do not exist. This RFC builds on the
first, builds the second, and starts the third.

Payments have their own exists/missing table in §4.1, and commerce in §10.1.

## 3. The three extension types

### 3.1 Common rules for all three

- **The host owns the outside world.** Ports, sockets, files, network, secrets and the clock belong
  to the host. An extension asks the host through an interface; it has no ambient authority.
- **Output is canonical.** Results land as MedBrains internal types that map one to one onto FHIR R4
  resources (`Observation`, `DiagnosticReport`, `ImagingStudy`, `ServiceRequest`, `Specimen`,
  `Coverage`, `Claim`, `Consent`), using the existing mappers in `crates/medbrains-fhir`.
- **Three outcomes, never two.** Every call an extension makes or answers is `ok`, `refused` or
  `unknown`. A crash, timeout or parse failure is `unknown` and is **held for a person**, never
  dropped and never read as "no result" (OS-PRINCIPLES §7, "Beyond the code" 2).
- **Crash-only and bounded.** The host restarts a dead extension with backoff; queues have a fixed
  size; a full queue pushes back on the device or is buffered to disk (the bridge's SQLite buffer
  does this today), never silently drops. Memory and CPU are capped per extension.
- **Everything is audited** with the extension's own service identity as the actor (RFC-AUTHZ §1,
  "Service" subjects).

### 3.2 Drivers

**Contract.** The host opens the transport the manifest declares (serial, USB, TCP, MLLP) and owns
framing for standard link layers (MLLP, ASTM E1381 ENQ/ACK/checksums), because getting framing
wrong loses results and it is the same for every vendor. The driver gets **records** (an HL7 v2
message, ASTM E1394 H/P/O/R/L records) or, for vendor protocols, a raw byte stream. It returns:

| Driver output | Internal type | FHIR R4 |
|---|---|---|
| lab result per analyte | lab result row via `/api/device-ingest/lab` | `Observation` in a `DiagnosticReport` |
| vital sign reading | vitals row via `/api/device-ingest/vitals` | `Observation` (vital-signs profile) |
| ECG trace and measurements | document + numeric observations | `Observation` + `Media`/`DocumentReference` |
| query for orders (host query) | order lookup, answered by the host | `ServiceRequest` read |
| order to the device | analyser order, sent by the host | from `ServiceRequest` |
| print job acknowledgement | print job status | none (internal) |
| device status, QC, calibration | device message / QC record | `Device`, `Observation` (QC) |

Imaging stays on DICOM: modalities talk to Orthanc, and MedBrains already reads it. A "driver" for
imaging is a worklist and status mapping, not pixel handling. The driver does **not** choose the
LOINC code: the analyte-to-test mapping is a per-instance table the lab manager confirms on screen
(the catalogue's `field_mappings` and `supported_tests` columns exist and are empty), because the
same analyser code means different tests in different labs.

**Lifecycle.** Install (signed package + manifest) → configure (port, baud, device instance,
mapping table, on the existing Admin → Devices screen) → **verify** (the lab runs known samples and
signs off; until then results are held for review) → run → update (a new version runs beside the
old one in shadow mode on the same traffic, then switches; never mid-message) → revoke (stops at
once; buffered messages stay and are shown for review).

**Where it runs.** In the device host (`medbrains-bridge`, which becomes the driver host) on the
OS main machine or on a node next to the device (`medbrains-agent`, `docs/architecture/OS-EDGE-NODES.md`).

**Failure behaviour.**

| Failure | What happens |
|---|---|
| driver traps or exceeds its time or memory budget | message stored raw, marked `unknown`, shown on the analyser review tab; driver restarted with backoff; after N failures, the device instance shows "driver failing" on screen |
| server unreachable | buffer to disk (exists); device keeps sending; drain on reconnect |
| buffer full | stop acknowledging the device (ASTM NAK, HL7 no ACK) so the analyser keeps its own copy; alarm on screen |
| result cannot be matched to one order | `NeedsReview` (exists) |
| driver returns a value the mapping table does not know | held for review, never guessed |

### 3.3 Connectors

**Contract.** A connector implements a **capability**: a named, versioned set of verbs with neutral
request and response types. The shape already exists twice (`OnlineProvider` with `capabilities()`,
and `Connector` in `RFC-INTEGRATION-WRAPPER.md` §3.1). Phase 2 turns it into a published interface,
starting with three capabilities: `claims` (pre-auth, claim, status: NHCX, TPAs), `lab-orders-out`
(send to an outside lab, receive results) and `exchange` (push and pull documents with an HIE such as
ABDM, NABIDH or Malaffi).

**Two ways to run, one manifest.**

| | Outside service (exists) | On-box component (new) |
|---|---|---|
| Talks to MedBrains | protocol v1: OAuth, REST/FHIR, signed webhooks | host interface, same calls |
| Network | its own | **only through the host**, only to the manifest's destinations |
| Works offline | no | yes, queues through the outbox |
| Good for | cloud services, analytics, AI, anything in any language | payment terminals, an HIE gateway in a clinic, a TPA portal adapter |

**Consent.** Every call that moves patient data names a purpose. The host checks
`medbrains_health_services::consent::check` (three outcomes) before handing data to the connector,
and the egress guard (§6.5) checks it again on the way out.

**Failure behaviour.** Outbound sends go through the outbox (retry, dead-letter, shown on screen). An
inbound message that fails validation is stored and held, never applied in part. A connector that
times out answers `unknown`, which the caller shows as "could not reach the insurer", never as a
rejection.

### 3.4 Apps

**Contract.** An app is a web app on its own origin, launched from the MedBrains shell by **SMART
on FHIR app launch** (OAuth authorization code with PKCE, launch context: patient, encounter, user).
It calls the API as the **user**, narrowed to the app's manifest permissions, so it can never do
more than both the user and the grant allow. It gets:

- sign-in: MedBrains as the OAuth server (`medbrains-oauth`, `connected-apps/token.rs` extended);
- permissions: the user's, intersected with the manifest;
- data classes: the server redacts by class (RFC-AUTHZ §3), so an app cannot see a field the user
  could not;
- design system: `@medbrains/design-system` tokens and the `@/components/ui` seam published as a
  package, so an app looks native in both themes and meets WCAG 2.2 AA;
- a brick row: a new **dynamic brick** record (code, name, dependencies, permission prefix
  `ext.<publisher>.<app>`), so the launcher, Modules screen and entitlement switch (#5243) treat
  it like ours. Its permissions are registered from the manifest under that prefix, so the admin UI
  can grant them like any other. This changes "Permissions First" (ENGINEERING.md: Rust is the one
  source of permission codes): our codes stay in Rust; extension codes become a namespaced data
  family the kernel validates, that can never shadow or widen a core code (**DECIDE 18**).

**Lifecycle.** Install → approve (consent screen) → the brick appears in the launcher for roles that
hold its permissions (hidden, not greyed) → update (new version needs new approval only if it asks
for more) → revoke (brick disappears; tokens die in the same transaction, as today).

**Failure behaviour.** An app that is down shows "this app is not answering" inside the shell frame,
never a blank. The shell never depends on an app to load.

## 4. Payments: a built-in OS service

The owner's goal (2026-11-18): "payment providers built in our OS, like real hardware." Payments
become a **system service** of the OS, like printing: not kernel (the kernel stays technical,
`RFC-HOSPITAL-OS` §3a), but shipped, set up at first boot and called by every app the same way.
Providers are **connectors**; payment hardware is **drivers**; the service in between owns the money
rules, so no vendor code ever decides whether a bill is paid.

### 4.1 What exists and what does not

A large part is built (epic #4875, `crates/medbrains-payment-gateway`, research in
`docs/research-pos-payments-2026-10.md`).

| Piece | State | Evidence |
|---|---|---|
| Provider-neutral online layer | **Exists, compiled in** | `OnlineProvider` trait with `capabilities()`, `key_fields()`, checkout, fetch, dynamic QR, refund (`online/mod.rs:317`); four providers in `PROVIDERS`: Razorpay, Cashfree, PhonePe, PayU; `GET /api/payments/capabilities` (#4884) |
| Card terminals | **Exists, compiled in** | `PosProvider` trait (`pos/mod.rs:158`): start, status, cancel, refund, ping; cloud push to Pine Labs Plutus Cloud and Razorpay POS (Ezetap); a simulator (#4877) |
| Wired terminals | **Partial** | `pos/bridge.rs`: a sale waits as a row, the site bridge claims and drives it; `medbrains-bridge` has a `CardMachine` trait, but `BRIDGE_ADAPTERS` lists only the simulator: no real ECR protocol |
| Exactly-once money | **Exists** | `settle.rs`: one conditional `UPDATE … RETURNING` decides; money that cannot be posted honestly goes to `payment_webhook_exceptions`, never dropped; `refund.rs`: refund keys derived from intent, so a retry cannot refund twice |
| Counter collection everywhere | **Exists** | collect drawer and due chip (#4888, #4890), payment links with part payment (#4871), dynamic UPI QR (`upi_qr.rs`, #4872), terminal registry bound to stations (`terminals.rs`, `medbrains_core::payment`) |
| Customer display | **Exists** | `crates/medbrains-device-pairing/src/counter_display.rs` and `apps/web/src/components/counter-display/` (#4883): amount, masked name, QR, result; privacy enforced server-side |
| UPI soundbox | **Missing, partly not buildable** | research §7: no major soundbox lets a third party push an announcement; Cashfree binds a VPA to a device by API; Razorpay's dynamic soundbox API is private. Our display with audio replaces it |
| Receipt and thermal printers | **Exists** | `medbrains-bridge/src/printer.rs`, `medbrains-printing` |
| Cash drawer hardware | **Missing** | `medbrains-pharmacy-cash-drawer` is the shift ledger (open, close, variance), not a device |
| Paytm, Mswipe | **Named, not built** | listed as provider choices in `payment-gateway/src/lib.rs`, no implementation |
| Settlement import and reconciliation, chargebacks | **Partial / missing** | reverse-reconciliation exceptions and `billing.payments.reconcile` exist (`lib.rs`); no settlement-report import, no chargeback record |
| Payments in first-boot setup | **Missing** | setup has payment-method masters only (`medbrains-setup/src/lib.rs`, "Payment Methods CRUD") |
| Card data hygiene | **Gap found** | research §5.1: stored terminal payloads must drop `Expiry Date` and `Card Holder Name` |

### 4.2 The payment service

Every app, ours or a vendor's, makes one call and never learns the provider or device:

```
payments.collect { invoice_ref, amount, currency, counter, methods?, idempotency_key }
  → intent_id
payments.status(intent_id) → pending | paid{method, reference} | declined{reason}
                           | cancelled | unknown{why}
payments.refund { intent_id, amount, reason, idempotency_key }
```

- **It picks** the provider and device from the hospital's configuration: the counter's station,
  its terminals (`payment_terminals`), the methods the provider's capabilities allow, and the
  hospital's order of preference (the existing `resolve` code).
- **It owns the money rules:** idempotency by key, exactly-once settle, refunds to source only,
  amount checks, exceptions for anything that does not match. These stay our code in every
  configuration; a connector or driver reports what happened, the service decides what it means.
- **Four outcomes on the wire,** with `unknown` kept separate: a terminal that stopped answering
  mid-sale is `unknown`, the counter says "check the machine's slip", and reconciliation settles it.
  It is never shown as declined, and never posted without evidence.
- **Vendor apps** call it with a new `payments.collect` permission (defined in Rust first) and get
  the outcome, never keys, card data or provider names.

### 4.3 Providers as connectors

The two traits become one published capability, `medbrains:connector-payments@1`: capabilities,
key fields, checkout, dynamic QR, payment link, fetch payment, refund, verify and read a webhook,
cloud-push terminal sale. The four built-in providers stay first-party code on the same contract;
new ones arrive as connectors: in India Paytm, Mswipe, or an orchestration layer such as Juspay
Hyperswitch (research §10); elsewhere the providers each country uses. The same contract carries
**cloud-push terminals** (Pine Labs Plutus Cloud, Razorpay POS): a terminal the provider's cloud
drives is a **connector**; a terminal wired to a counter PC is a **driver**.

### 4.4 Payment hardware as drivers

| Device | How it is reached | Driver does | Today |
|---|---|---|---|
| Card POS / EDC terminal, wired | USB, serial, Bluetooth, LAN through the bridge | the brand's ECR protocol: send amount and reference, read approved / declined / timeout, cancel | simulator only |
| Card terminal, cloud | provider API | connector, not driver (§4.3) | Pine Labs, Razorpay POS |
| UPI soundbox | provider-side binding | where an API exists (Cashfree), bind the device to the counter's VPA; otherwise none. Never closes a bill on an announcement (research §7 item 3) | missing |
| Customer QR display | WebSocket page on a second screen or tablet | none needed; audio announcement on the display | exists |
| Receipt / thermal printer | network, USB | ESC/POS rendering | exists |
| Cash drawer | kick pulse through the receipt printer, or USB | open on a cash payment, report open/closed where the drawer can | missing |

**Pairing and status.** A device is registered under Settings → Payment terminals, bound to a
station (exists), and paired to the bridge on that counter's PC or node. The driver reports
heartbeat and status; the counter shows "card machine not answering" before the cashier tries.

**Timeouts and idempotency.** The existing step machine (`pos/step.rs`, `sale.rs`) applies: each
sale is a row with a reference, every answer goes through one transition function, and a second
answer for the same sale posts nothing. The driver gets a deadline per step; past it, the sale is
`unknown`, not failed.

**Offline.** Card and UPI need the acquirer's network, not ours. If the box cannot reach the
provider, card sales on a terminal with its own SIM or line still complete on the device and are
reconciled when the box is back; UPI QR waits for the provider's webhook; cash always works and is
recorded locally. Nothing is posted as paid on a guess.

### 4.5 Out of the box, and compliance

**Set up at first boot.** A "Payments" step in setup (`RFC-HOSPITAL-OS` §8s, `medbrains-os-setup`): choose provider
or providers, enter test keys, register terminals per counter, run a test sale on the simulator or a
₹1 real one, then go live with two approvals (a change set). Merchant onboarding with the provider
(KYC, merchant account) happens with the provider; the step links to it and records the result.

**Compliance design rules, from the research (no legal conclusions):**

| Rule | Design |
|---|---|
| Card number and PIN never touch MedBrains | semi-integrated terminals and provider-hosted checkout only; the OS sends an amount and receives a masked result (research §4 item 3); a test fails if a stored payload holds an expiry date or a full card number |
| PCI-DSS scope | kept out of the cardholder-data environment by the rule above; the exact self-assessment type is for the acquirer or a QSA |
| Card tokenisation | keep only last four digits, network, issuer, RRN, auth code, TID/MID (research §4 item 2) |
| Payment aggregator licence | none needed while each hospital uses its own merchant account (research §4 item 1, inferred); changes if money pools (§10.5) |
| Refunds | to the same instrument; to another mode only with the customer's consent (research §4 item 1) |
| Failed transactions | auto-reversal timelines tracked (research §4 item 9) |
| Settlement and GST | settlement reports imported and matched to bank UTRs; GST on fees tagged per merchant account and business line (research §4 items 7 and 8) |
| Cash limits | the s.269ST cash-receipt limit warned at the counter (research §4 item 12) |

Questions for legal review (**DECIDE 15**): RBI rules on storing payment data in India for boxes and
cloud regions outside India; whether a hospital's use of our service changes any party's PCI-DSS
obligations; chargeback handling duties; how other countries' payment rules map onto the same layer.

## 5. The manifest

**Extend the manifest that ships, do not start a new one.** `manifestVersion: 2` adds three kinds
(`driver`, `connector`, `app`) to the four that exist (`service`, `smart-app`, `mcp-tool`,
`wasm-block`). v1 manifests keep working (COMPATIBILITY.md). One JSON Schema, one Rust validator
(`connected-apps/src/manifest.rs`), shared fixtures, so the CLI and the server cannot drift.

| Field | Driver | Connector | App | Meaning |
|---|---|---|---|---|
| `id`, `name`, `purpose`, `version`, `publisher` | yes | yes | yes | reverse-DNS id; one-sentence purpose; semver |
| `signingKey` | yes | yes | yes | publisher's Ed25519 public key id (§6.3) |
| `requires.medbrains` | yes | yes | yes | protocol and interface versions, e.g. `driver@1` |
| `devices` | yes | no | no | transports and ports: `serial`, `usb:<vid>:<pid>`, `tcp:<port>`, `mllp:<port>`; device categories and models it supports |
| `produces` | yes | yes | no | canonical outputs (`Observation`, `DiagnosticReport`, …) |
| `reads`, `writes` | no | yes | yes | FHIR resources, each backed by a permission (as v1) |
| `events` | no | yes | yes | events it wants |
| `permissions` | yes | yes | yes | permission codes, 1–50, no wildcards (as v1) |
| `dataClasses` | yes | yes | yes | highest class it touches (as v1) |
| `egress` | no (always empty) | yes | yes | `[{ host, port, purpose, country }]`; nothing else is reachable |
| `limits` | yes | yes | n/a | memory, CPU time per message, queue size; the host enforces the smaller of this and the hospital's ceiling |
| `schedules` | no | yes | no | cron-like jobs (e.g. nightly claim status) |
| `certification` | filled by review | | | level and evidence links (§9.2) |

**Enforcement.** The host enforces each field, not the extension: it opens only the declared ports,
grants only the declared permissions (the token is an `api_keys` row with exactly those, as today),
routes only to declared egress, and refuses outputs not in `produces`. Complete mediation: every
call is checked, none is cached past a revocation.

**Consent screen.** Generated from the manifest, in plain words, in the hospital's language:

> **Sysmex XN driver**, by Example Diagnostics Pvt Ltd. Certified by MedBrains.
> Reads results from analysers on **serial port 1**. Writes **lab results**, which are held for
> review until your lab verifies the analyser. Sends **no data** outside this machine.
> [Install] [Cancel]

For a connector, the screen lists each destination with its country and purpose, and the data
classes that may go there. The approver must hold every permission requested (exists). A change in a
new version that asks for more shows the difference and needs approval again.

**Revoke and audit.** Revoke is one button on the extension's page and a CLI command for operators.
It is a kernel audit event; so are install, approve, each update, each refusal and, for connectors,
each egress (§6.5). Admin → Extensions shows, per extension, its activity over time.

## 6. Isolation and security

### 6.1 Options compared

| Option | Memory per extension | Any CPU, one artefact | Offline | Isolation strength | Fit |
|---|---|---|---|---|---|
| **A. WebAssembly components** in one host process | small (a linear memory with a hard cap; instances share the host) | yes: one `.wasm` runs on ARM and x86 (`RFC-HOSPITAL-OS` §8c) | yes | strong by construction: no I/O except what the host gives (capability-based) | drivers, on-box connectors |
| **B. Native process** per extension under systemd (own user, `ProtectSystem=strict`, seccomp, namespaces, Landlock, cgroup limits) | a process each, plus its runtime | no: a build per CPU and libc | yes | strong, but depends on getting each profile right | vendor code that needs a native library |
| **C. Outside service** (exists) | none on the box | n/a | no | strongest: never on the box | apps, cloud connectors |
| D. Containers | larger | per-arch images | yes | depends on config | rejected: no Docker in the OS |
| E. Embedded scripting (Lua, as in `code_executor.rs`) | small | yes | yes | weak: hard to bound and to mediate I/O | rejected for third-party code |

### 6.2 Recommendation

1. **Drivers and on-box connectors are WebAssembly components** (the component model with
   interfaces written in WIT), hosted by **one host process per role** (the device host for
   drivers, the connector host for connectors), and that host process is itself a hardened systemd
   service. Two walls, not one: if the WebAssembly runtime has a bug, the process sandbox still
   holds.
   - **Small boxes:** device traffic is tiny (a full blood count is a few kilobytes,
     `astm.rs`), so an instance needs a few megabytes, against tens for a process. The appliance
     target is 512 MB idle for everything on a Pi 5 (`RFC-HOSPITAL-OS` §3a budgets).
   - **Any CPU:** a vendor ships one file, not one per CPU and libc, which is what makes "days, not
     weeks" possible for a vendor that has never heard of our tier table.
   - **Least privilege by construction:** a component cannot open a socket or a file unless the host
     hands it one. That is complete mediation without writing a seccomp profile per vendor.
   - **Any language:** Rust first-class; C, Go and others through their component toolchains (their
     maturity varies and the SDK must say so honestly).
   - **Hard limits:** the host meters CPU (fuel or epoch interruption) and caps memory per instance,
     so a looping driver is stopped and its message held.
2. **Native drivers are an exception tier**, only for a vendor whose device needs a native library
   it cannot rebuild. Option B, certified tier only, one process per driver, with the profile
   generated from the manifest and `systemd-analyze security` in the certification check (SEC5).
3. **Apps and cloud connectors stay outside services** (option C, built today).

**What must be measured before this is final** (OS-PRINCIPLES §7.7, "algorithms need proof"): the
runtime. Two candidates: **wasmtime** (component model, fast, larger; the code executor says the
earlier attempt hit an MSRV problem) and **wasmi** (an interpreter, much smaller, slower; its
component-model support must be checked). The phase 1 spike measures, on a Pi 5 and an x86 box:
binary size added, dependency closure added (the workspace ratchet counts packages), memory per
instance, and time per ASTM message. Either is fast enough for device traffic; the likely decision
is size. **DECIDE 1** covers the choice of approach; the runtime follows from the numbers.

### 6.3 Signed packages

- **Format:** a package is a tar of the manifest, the component (or app URL), the mapping templates
  and a SHA-256 list, with a detached **Ed25519** signature. Ed25519 because the OS already uses it
  (`OS-SIGNING-KEYS.md`, `os-update/src/manifest.rs`), it verifies offline, and the key is small.
  The file format can be minisign-compatible so vendors can sign with a tool they already know.
- **Sigstore:** useful for public transparency, but its usual flow needs an online log and an
  identity provider, which a hospital offline for a week cannot check. Proposal: offline Ed25519 is
  the check the box does; a Sigstore (Rekor) entry is an optional extra for public listings.
- **Three signers:** the **publisher** signs every package; **MedBrains certification** adds a
  countersignature with a new `extension` purpose under the existing 2-of-3 roots; a **hospital's
  own key** signs its private apps (DECISIONS 2026-11-02, "signed with the hospital's own key").
  The box refuses unsigned packages; it accepts a publisher-only signature only if the hospital has
  turned on community extensions.
- **Revocation list:** a signed, rising-sequence list of revoked package hashes and publisher keys,
  the same mechanism as OS updates, delivered on the update channel and on USB for offline sites.

### 6.4 Supply chain, updates, kill switch

- **Review for certification:** an SBOM per package; for Rust components, `cargo-deny` and
  `cargo-vet` style review of dependencies (`supply-chain/` exists); reproducible build of the
  component from tagged source where the publisher shares it.
- **Update channels:** `stable` and `pinned`. Certified extensions may auto-update minor and patch
  versions in a quiet window if the hospital allows it (the OS update quiet window exists); a major
  version or wider permissions always waits for a person. Rollback keeps the previous version.
- **Kill switch, three levels:** the hospital revokes one extension (exists for connected apps);
  MedBrains or the publisher revokes a version for everyone through the revocation list; lockdown
  mode (`RFC-HOSPITAL-OS` §8j) turns off everything except pinned certified extensions.

### 6.5 Data-egress guard

A connector may send only what the manifest declared and the hospital approved:

1. **Network:** on-box connectors have no sockets; the host makes the HTTP call, only to a declared
   `egress` host, over TLS. Outside services are already separate.
2. **Content:** the host knows the data class of every field it handed the connector
   (`field_class::class_of`). An outbound payload is accepted only if its source fields' classes are
   within the manifest's `dataClasses` for that destination, and consent for the purpose is `Allow`.
   `Unknown` blocks and holds, it never sends.
3. **Record:** every egress is audited: destination, purpose, data classes, byte count, consent
   reference, the patient ids involved. The hospital's DPO can list "everything that left, and why".

**Honest limit:** the guard cannot read the meaning of free text a connector builds from fields it
was legitimately given. It bounds what a connector *receives*; certification review covers the rest.

### 6.6 Mapping to the principles

| Principle | How this design meets it |
|---|---|
| Economy of mechanism | one manifest, one host per role, one signing scheme, one approval screen |
| Fail-safe defaults | unsigned refused; community off by default; egress empty by default; `unknown` holds |
| Complete mediation | every port, call, egress through the host; checked each time, not cached past revocation |
| Open design | protocol, WIT interfaces, schema and test suite are public |
| Separation of privilege | certification countersignature + hospital approval; approver must hold the permissions |
| Least privilege | exact permissions, declared ports and destinations, per-extension limits |
| Least common mechanism | one instance per device instance; no shared memory between extensions |
| Psychological acceptability | one plain-language screen; one revoke button |
| Class A rules | the hosts are class A: failure tables, fault injection (kill a driver mid-message), bounded queues, three outcomes |

## 7. Stable public contracts

- **Versioning.** Protocol and interfaces are semver: `medbrains:driver@1`, `medbrains:connector-claims@1`,
  protocol `v1`/`v2`. Additive changes stay in the major; anything else is a new major, served beside
  the old one for the deprecation window in `docs/COMPATIBILITY.md`. An older host meeting an
  interface it does not know **refuses to load** the package, never skips (RFC-AUTHZ §2C.3).
- **Event bus.** Today: the transactional outbox and signed webhooks over the 60 typed events
  (`ClinicalEventName`). That is enough for phases 1 and 2. Proposal: publish the event catalogue
  as a versioned schema, and add new events only through `ClinicalEventName` so they are typed.
  NATS stays future; if it comes, it carries the same envelope.
- **FHIR R4 profile.** One published profile set: base R4, with country profiles layered (NRCeS /
  ABDM for India first; `crates/medbrains-fhir/src/nrces`). The surface grows with the phases:
  phase 1 needs internal `Observation`/`DiagnosticReport`/`ServiceRequest`/`Specimen` mappings;
  phase 2 adds search and `Coverage`/`Claim`/`Consent`; phase 3 adds write with drafts a person
  approves (same rule as `RFC-HOSPITAL-OS` §8f for AI writes).
- **Compatibility suite vendors run locally.** `medbrains ext test` exists (conformance against a
  mock, `packages/sdk/src/conformance.ts`). Extend it with: golden-file driver tests (input
  messages, expected canonical output, including corrupted frames, wrong checksums, unknown codes,
  a driver crash), connector contract tests per capability, and an app launch test. The same suite
  is the first gate of certification, so passing locally means passing there.

## 8. Developer experience

| Need | Proposal | Builds on |
|---|---|---|
| Driver SDK | `medbrains-driver-sdk` (Rust): WIT bindings, record types for ASTM and HL7, test helpers. Other languages through the WIT file | `medbrains-adapter-sdk` (rename or wrap), bridge parsers |
| Connector SDK | WIT bindings per capability; for outside services, the TypeScript and Python SDKs | `packages/sdk`, `sdks/python` |
| App SDK | thin TypeScript: SMART launch, typed API client, design-system package, `<Can>`-style tri-state gate | `@medbrains/sdk`, `@medbrains/design-system` |
| CLI | `medbrains ext new driver|connector|app`, `validate`, `test`, `simulate`, `package`, `sign`, `submit` | `ext init/validate/test` exist |
| Sandbox hospital | the OS VM image (`.qcow2`/`.ova` for UTM, VirtualBox, VMware) plus a seeded synthetic tenant with lab orders waiting | `os/formats.sh`, seed crate |
| Device simulators | `medbrains ext simulate astm|hl7`: plays an analyser (ENQ/ACK, frames, checksums, host query) from fixture files, including faults, over TCP or a virtual serial pair | bridge test fixtures |
| Docs portal | "Build on MedBrains" section of `apps/docs`: one tutorial per type, ending with a working package | `apps/docs`, `STYLE.md` |

**The vendor's first week, as the target:** day 1, download the sandbox image and the CLI,
`ext new driver`; day 2, map their analyser's records using the simulator with their own captured
traces; day 3, pass `ext test`; day 4, run against their real analyser on the sandbox; day 5,
`package`, `sign`, `submit` for community listing.

## 9. Marketplace and certification

### 9.1 Listing and discovery

- **Index:** a signed index of packages (id, versions, publisher key, certification level, hashes).
  Each hospital's box syncs it when online, or loads it from USB. Hospitals browse it under
  **Admin → Extensions**, filtered to what fits their devices and bricks.
- **Install:** one click opens the consent screen (§5); install goes through a change set
  (preview, approve, roll back, `RFC-HOSPITAL-OS` §5).

### 9.2 Certification levels (names are **DECIDE 4**)

| Level | Who checks | What it means | Shown as |
|---|---|---|---|
| **Community** | the publisher | signed by the publisher, passed the automated suite; not reviewed | "Not reviewed by MedBrains"; off unless the hospital allows community extensions |
| **MedBrains certified** | MedBrains | code and dependency review, suite plus fault tests, manifest least privilege, sandbox profile checked | countersigned badge |
| **Clinically validated** | publisher + a named site | evidence that results match on real samples at a named lab (method comparison) | badge with the site's report linked |

Clinically validated does not replace each lab's own verification before patient use; the driver
lifecycle (§3.2) keeps results held until the lab signs off.

### 9.3 Regulatory duty: questions for the owner (no conclusions)

1. **Medical device software.** A driver that moves clinical results may be medical device software
   in some markets (India's Medical Devices Rules 2017 under CDSCO, the EU MDR, US FDA). Who is the
   manufacturer: the driver's publisher, MedBrains for the host, or the hospital? Does MedBrains
   certification make us part of that chain? **DECIDE 8.**
2. **IEC 62304.** We already map our class A to IEC 62304 class C (DECISIONS 2026-11-15). Should
   certification require the publisher to show 62304 process evidence for drivers, and at what level?
3. **Lab accreditation.** NABL (ISO 15189) expects each lab to verify its interfaces. The design
   holds results until the lab signs off; is that sufficient, and do we require LOINC mapping for
   certified lab drivers?
4. **DPDP and cross-border data.** A connector that sends personal data out of India is a transfer
   under the DPDP Act; similar rules exist elsewhere (GDPR, UAE, Saudi). Does the hospital remain the
   data fiduciary with the publisher as processor, and do we require a data-processing agreement
   before a connector with identifying data can be approved?
5. **Liability** for a certified extension that causes harm.

## 10. Commerce: selling on the platform

The owner's goal (2026-11-18): "we should be able to sell these things." The platform has to sell
and deliver five kinds of product, with one catalogue, one licence format, one checkout and one
ledger.

### 10.1 What exists and what does not

| Piece | State | Evidence |
|---|---|---|
| Bricks that can be switched per tenant | **Exists** | `crates/medbrains-core/src/bricks.rs` (including a `licensed` add-on flag: off until an operator enables it), `module_config`, whole-router gating (#5243), fail-closed module gate with three outcomes (#4907) |
| Editions | **Partial** | `tenants.hospital_type` presets (`RFC-PLATFORM-COMMERCIAL.md` §2); a tenant admin can still change their own edition |
| Signed licence file, verified offline | **Missing** | designed in `RFC-PLATFORM-COMMERCIAL.md` §3 (`{licence_id, tenant_code, edition, add_ons, limits, not_after, grace_days, deployment_id}`), not built; its survey says "Licence (bare metal): none" |
| Plan catalogue, subscriptions | **Missing** | `subscription_plan` / `tenant_subscription` designed in `RFC-MANAGED-SERVICE.md` §3 and P2; no migration |
| Subscription business model | **Decided** | "the Red Hat way" (`RFC-PLATFORM-COMMERCIAL.md`, DECISIONS 2026-11-12): sell the signed update feed, support, warranty, certification, training; **never** lock clinical features, data export or a running hospital |
| Expiry behaviour | **Decided** | 30 days of warnings, 30 days of grace, then settings, new users and add-ons stop; clinical care never stops (`RFC-PLATFORM-COMMERCIAL.md`, decision 1) |
| Taking money | **Exists for hospitals' patients** | the payments layer (§4), payment links and partial payment (#4871), exactly-once settle and refund |
| Payouts | **Exists for doctors** | `crates/medbrains-doctor-payouts` (#4889): agreements, basis, posting; a pattern for vendor payouts |
| Fleet and box identity | **Partial** | node pairing and agent (`medbrains-agent`, `OS-SETUP-AND-TRUST.md`), first-boot setup (`RFC-HOSPITAL-OS` §8s), heartbeat and operator console designed (P4), not built |
| Our own tax invoices, vendor ledger, marketplace checkout | **Missing** | the billing crates bill patients, not hospitals |

A lesson to build in: #4656 found a licence dashboard that showed every expired licence as valid,
because the screen read `days_until_expiry` and the server sent `days_to_expiry`; the mock had the
wrong contract too. A licence check is an authorisation decision and gets the same rules: three
outcomes (valid, expired, **unknown**), compile-time checked contracts, and a test that feeds it an
expired, a corrupt and a future-dated licence.

### 10.2 The five products

| Product | Who sells | Delivered as | Bound to |
|---|---|---|---|
| Vendor drivers, connectors, apps | vendors, through the marketplace | signed package (§6.3) + entitlement | a deployment, and for drivers optionally a device count |
| MedBrains bricks and plans | MedBrains | entitlement that turns on `licensed` bricks and edition sets | a tenant |
| Preloaded MedBrains OS boxes | MedBrains or certified resellers | hardware with the OS, a box serial, a factory key, a warranty record | a box serial, activated to a hospital |
| Vendor certification | MedBrains, to vendors | a countersignature and a listing badge, valid for a major version | a package id and version range |
| Support and update plans | MedBrains and certified partners | entitlement `updates`, `support`, with an SLA level | a deployment or box |

### 10.3 The tension the owner must settle first

Paid bricks sit awkwardly with two things already decided:

1. **The code is AGPL-3.0.** Anyone may remove a licence check from a rebuild
   (`RFC-PLATFORM-COMMERCIAL.md` §3 says so). A check only makes paying the default and the terms
   visible; the trademark and the contract do the real enforcing.
2. **The 2026-11-12 model rejected "locking features after expiry"**, because it contradicts the
   free licence for hospitals and risks care.

So "sell our bricks" can mean either (a) a brick is free to run, and what is sold for it is the
signed updates, support, certification and warranty **for that brick** (fits the decided model), or
(b) a brick is off unless licensed (reverses part of the 2026-11-12 decision; workable only for
non-clinical add-ons, and strippable from source). The design below supports both, because the
entitlement file is the same; which one ships is **DECIDE 12**. Vendor products are different: a
vendor may sell a closed driver, and the entitlement then genuinely controls it (subject to DECIDE 3).

### 10.4 Signed entitlements, verified offline

One file format for every product, extending `RFC-PLATFORM-COMMERCIAL.md` §3:

```
{ licence_id, issued_at, issuer_key_id,
  holder: { tenant_code | deployment_id | box_serial },
  items: [ { product, kind, version_range, limits, not_before, not_after,
             grace_days, on_expiry } ],
  sequence }                       // Ed25519 signature over the exact bytes
```

- **Signed** under the existing 2-of-3 roots with a new `licence` purpose and a short-lived issuing
  intermediate, the same way as OS updates (`OS-SIGNING-KEYS.md`). A vendor's product is signed by
  the marketplace on the vendor's instruction, so the box checks one trust chain.
- **Verified offline** at start, daily and on install. The box stores the highest time and highest
  `sequence` it has seen, so a clock set backwards or an old file replayed reads as **unknown**,
  never as valid.
- **Arrives** over the heartbeat when online, or as a file on USB for air-gapped sites (the same
  path as update bundles).
- **Unknown is not expired.** A corrupt file, an unknown key or a clock problem starts the grace
  period and tells the admin why; it never switches anything off at once and never reads as valid.

**Expiry behaviour, per item** (`on_expiry`), with one rule above all of them: **a hospital is never
locked out of its patients' records.** Reading, printing, exporting and handing over clinical data
always work.

| Item kind | After grace |
|---|---|
| Updates and support | no new signed updates for that item; everything installed keeps running (decided model) |
| Clinical driver or connector (results, orders, claims in flight) | keeps running; updates stop; admin banner. A result path never stops for a billing reason |
| Non-clinical app or add-on | becomes read-only: its data stays visible and exportable, new work stops |
| MedBrains brick under option (b) | non-clinical: read-only; clinical: never stopped (decision 1) |
| Trial | as its kind, with the trial end shown from day one |

### 10.5 Buying, delivering and accounting

1. **Listing with price.** A catalogue row per product and plan; prices are data in the control
   plane, never in code (`RFC-PLATFORM-COMMERCIAL.md` §2). Prices can differ by country and currency.
2. **Per-hospital purchase.** Admin → Extensions (or Admin → Plan) shows the price, tax and what the
   hospital gets. Buying needs a new permission (for example `admin.purchases.create`, defined in
   Rust first, granted to the hospital admin), and above a hospital-set amount, a second approver.
3. **Paying.** MedBrains is a merchant of the same payments layer (§4): a payment link or checkout
   for online sites; a quote with bank transfer for hospitals that pay by purchase order. Exactly-once
   settle and refund come for free.
4. **Invoice.** A GST tax invoice (for India) from MedBrains' selling entity, numbered by
   `kernel::seq`, with the buyer's GSTIN; other countries' tax rules come as country packs.
5. **Licence issued** on settlement, delivered as in §10.4. Install of a paid package checks it.
6. **Trials, renewals, upgrades.** One trial per tenant per product; renewal extends `not_after`;
   an upgrade issues a new licence with a higher `sequence` and a prorated charge (pricing rules are
   owner decisions).
7. **Refunds.** Through the existing refund path; the licence is superseded by a new one without
   the item, under the expiry rules above (so a refunded clinical driver is not cut off mid-run).
8. **Vendor revenue share and payouts.** A ledger per sale: gross, tax, payment fees, vendor share,
   MedBrains share, refund reversals, payout batch, tax deducted. The doctor-payouts crate (#4889) is
   the pattern. Payouts start manual (a monthly statement and bank transfer) and automate later.
9. **Audit.** Every catalogue change, purchase, licence issue, install, refund and payout is an
   audit event in the control plane's hash-chained log; installs are also in the box's kernel audit.

**Where the money flows matters legally.** The 2026-10 payments research found that MedBrains needs
no payment aggregator licence while each hospital uses its own merchant account, and that **the
question returns if we pool funds, deduct our fee from settlements, or run a marketplace merchant
account** (`docs/research-pos-payments-2026-10.md` §4.1, marked inferred). A marketplace that
collects for vendors does exactly that. Three shapes, for **DECIDE 14** with counsel: (a) reseller
(we sell the vendor's product as our own supply and pay the vendor as a supplier); (b) split
settlement through a licensed aggregator's marketplace product, so the aggregator, not us, holds and
splits funds; (c) agency (the hospital pays the vendor's own merchant account; we invoice the vendor
our share).

### 10.6 Preloaded OS boxes

- **At the factory:** the OS image, a box serial, a device key generated on the box (sealed to the
  TPM where present) whose public half is registered with the serial, and a warranty record.
- **At first boot:** the setup (`RFC-HOSPITAL-OS` §8s) asks for an activation code or scans a QR, binding the serial to
  the hospital's licence; offline, a signed activation file on USB does the same.
- **Never a brick.** A box that is not activated still runs the free OS; activation brings updates,
  support and warranty. A returned or resold box is re-activated, never remotely disabled.
- **Fleet:** activated boxes report version and health in the operator console (P4) and the
  hospital's own fleet view (`RFC-HOSPITAL-OS` §8r). The hospital holds its own keys (decided 2026-11-02).

### 10.7 Legal and tax questions (for counsel; no conclusions)

1. GST on software and SaaS sales, place of supply for foreign buyers, and whether MedBrains is an
   "e-commerce operator" for vendor sales (tax collected at source under GST, TDS under the Income
   Tax Act) in the marketplace shapes of §10.5.
2. The payment aggregator question in §10.5, and RBI rules on marketplaces.
3. Warranty, consumer and product-liability terms for preloaded hardware, and e-waste rules.
4. Export of the licence and signing scheme (encryption export rules) for boxes shipped abroad.

## 11. Phased plan

Sizes are rough, for one engineer full time with review, and will be re-estimated after the spike.
Phases 1 and 1b can run in parallel with two engineers.

| Phase | What | Ends on (success criteria) | Size |
|---|---|---|---|
| **0** | The OS image is downloadable again (Kanidm build fix, in progress elsewhere) | a signed image boots in UTM and VirtualBox with setup completing | not counted here |
| **1** | **Lab-analyser driver kit** (§11.1) plus the **minimum commerce to sell the first driver** (§11.3) | an outside developer builds a driver from the docs in ≤ 5 working days, timed; one real analyser runs two weeks at a site with zero lost results; one hospital buys a driver licence, pays, gets an invoice, and the licence installs offline | 12–17 weeks |
| **1b** | **Payments kit** (§11.2): payment service API, one wired card-terminal driver, one provider connector on the published contract, receipt printer and cash drawer, payments in first-boot setup | a counter on the OS box takes card, UPI QR and cash for one bill; the receipt prints and the drawer opens; day close matches the provider's settlement report with every difference explained; killing the bridge mid-sale gives "unknown", never a double post | 8–11 weeks |
| **2** | **Connector SDK**: capability interfaces, connector host, egress guard, one real connector (one TPA via NHCX or ABDM health records, **DECIDE 9**); entitlements for connectors | a connector built only with the SDK moves real claims or records under consent; the DPO screen lists every egress | 8–10 weeks |
| **3** | **Apps and marketplace**: SMART launch, dynamic bricks, design-system package, index, Admin → Extensions, certification workflow, paid listings with vendor payouts, brick plans, box activation | a third-party app appears in the launcher for the right roles only, bought and installed from the index, revoked in one click; a vendor receives a correct statement and payout | 14–18 weeks |

### 11.1 Phase 1 in detail

| Step | Work | Proof it is done |
|---|---|---|
| 1.1 | Fix the catalogue's `is_verified` (false until a real check); remove the correction note in `RFC-HOSPITAL-OS` §4 once drivers load | the catalogue shows "not verified" for all 31 rows |
| 1.2 | Runtime spike: wasmtime vs wasmi, measured on Pi 5 and x86 | numbers in DECISIONS; choice made |
| 1.3 | WIT `medbrains:driver@1` and manifest v2 (driver kind), schema, validator, fixtures | `ext validate` and the server agree on every fixture |
| 1.4 | Driver host inside `medbrains-bridge`: load, limit, restart, hold on failure; hardened systemd unit on the OS image | fault injection: kill a driver mid-run, fill the buffer, corrupt frames; nothing lost, all held |
| 1.5 | Serial transport in the host | a serial analyser works without a converter |
| 1.6 | Port the bridge's built-in ASTM and HL7 parsing into two reference drivers on the new ABI | the existing analyser tests pass through the reference drivers |
| 1.7 | Simulator and CLI: `ext new driver`, `simulate`, `test`, `package`, `sign` | the vendor-week tutorial works end to end on the sandbox image |
| 1.8 | Admin → Devices: install a package, consent screen, mapping table, verify step, revoke | done as the lab manager role on screen |
| 1.9 | Move `medbrains-devices` onto the kernel facade (drop its own bypass check) | `boundary.txt` shows `on_facade` |
| 1.10 | One real analyser at one site, with the lab's verification | two weeks, zero lost or unmatched-and-unflagged results |

### 11.2 Phase 1b in detail (payments)

| Step | Work | Proof it is done |
|---|---|---|
| 1b.1 | The payment service interface (§4.2) published and versioned; collect drawer and apps call it | an app extension collects through it in the sandbox without seeing a key |
| 1b.2 | `connector-payments@1` from the two traits; one provider named but not built (Paytm or Mswipe, **DECIDE 16**) implemented on it | the provider passes the payments contract suite, including duplicate and late webhooks |
| 1b.3 | One wired card-terminal ECR driver on the driver ABI (brand **DECIDE 16**) | real sales, declines, timeouts and cancels on the device; card data never in our logs (a test greps every stored payload) |
| 1b.4 | Receipt printer (ESC/POS) and cash-drawer kick | prints and opens on a real thermal printer |
| 1b.5 | Strip expiry date and cardholder name from stored terminal payloads (research §5.1) | test over stored payloads |
| 1b.6 | Settlement report import and day-close reconciliation; chargeback record | every difference lands in exceptions with a reason |
| 1b.7 | "Payments" step in first-boot setup: provider, test mode, terminals per counter, a test sale, go-live with two approvals | done as the hospital admin on a fresh image |
| 1b.8 | UPI soundbox: the route chosen in **DECIDE 16** (bind a provider's soundbox to the counter's VPA by its API, or our counter display's own audio); a bill closes only on the provider's webhook or status, never on the announcement | a test payment is announced at the counter and the bill closes once, from the webhook |

### 11.3 Minimum commerce in phase 1 (to sell the first lab driver)

| Step | Work | Proof it is done |
|---|---|---|
| C.1 | Entitlement file format, `licence` signing purpose, offline verifier with three outcomes and clock and replay checks | tests: valid, expired, corrupt, future-dated, replayed, clock set back |
| C.2 | Admin → Licences screen: what is licensed, until when, grace, why "unknown" | done as the hospital admin, online and offline |
| C.3 | Catalogue row and price for one driver; purchase permission; quote and payment link from our own merchant account | one real purchase in test mode, then live |
| C.4 | Tax invoice from our entity (**DECIDE 13**), numbered by `kernel::seq` | invoice checked by an accountant |
| C.5 | Vendor ledger row and a manual monthly statement | statement matches the ledger to the paisa |

## 12. Risks and open questions

### Risks

1. **The runtime adds weight.** A WebAssembly runtime may add many packages and megabytes, against
   the size budgets. Mitigation: measure in 1.2; wasmi is the small fallback; the kernel never
   depends on it (it lives in the host).
2. **Vendors may not come.** Analyser vendors in many markets ship closed middleware and may prefer
   it. Mitigation: we write the first drivers ourselves on the same ABI, so hospitals get value
   either way; the kit lowers cost for integrators and labs, not only vendors.
3. **Toolchain maturity outside Rust.** Component tooling for some languages is young. Mitigation:
   say so in the docs; Rust and C are the supported paths at first.
4. **Certification becomes a bottleneck** if review is manual. Mitigation: the automated suite does
   most of it; reviewers only read diffs and manifests.
5. **Regulatory exposure** from certifying clinical drivers (§9.3).
6. **Two paths to maintain** (built-in providers and extension providers). Mitigation: port our own
   providers to the extension contract over time, one per release, as with the kernel ratchet.
7. **Licence friction.** The workspace is AGPL-3.0 (`LICENSE`, `COMMERCIAL-LICENSE.md`); the
   TypeScript and Python SDKs are Apache-2.0; `medbrains-adapter-sdk` inherits the workspace licence.
   A vendor may not link an AGPL SDK into a closed driver. See **DECIDE 3**.
8. **Paid bricks versus the open model** (§10.3): selling feature locks in AGPL code invites forks
   and contradicts the 2026-11-12 decision. Mitigation: decide (a) or (b) before building C.3.
9. **Money handling for others** can need a licence (§10.5). Mitigation: no vendor money flows until
   DECIDE 14 is settled with counsel; phase 1 sells our own and first-party-resold products only.
10. **Payment hardware access.** ECR protocols and soundbox APIs are partner-only for several brands
    (research §2, §7). Mitigation: pick the first brand by what is documented and testable.

### Decisions for the owner

1. **DECIDE:** WebAssembly components for drivers and on-box connectors, with native processes only
   as a certified exception, and the runtime chosen by the 1.2 measurement. (Alternative: native
   processes only, simpler to start, heavier on small boxes and per-CPU for vendors.)
2. **DECIDE:** the lab-analyser driver kit is the phase 1 wedge, with payments as phase 1b in
   parallel. (Alternatives: printers and label printers, simpler but less valuable; a TPA connector.)
3. **DECIDE:** the driver SDK, WIT interfaces and simulator are licensed Apache-2.0 (or AGPL with a
   linking exception) so closed-source drivers are allowed. Needs counsel.
4. **DECIDE:** the names and meaning of the three certification levels, and whether community
   extensions are off by default in every hospital.
5. **DECIDE:** offline Ed25519 signatures with a MedBrains countersignature under the existing roots
   (new `extension` and `licence` purposes), Sigstore optional for public listings.
6. **DECIDE:** where the index lives: a signed file in this repository (simple, auditable) or a hosted
   registry service (search, statistics, more to run).
7. **DECIDE:** whether phase 1 drivers may send orders to analysers (bidirectional, as the bridge does
   today with ORM) or results only at first.
8. **DECIDE:** the regulatory questions in §9.3, with counsel, before any "certified" badge is shown
   on a clinical driver.
9. **DECIDE:** the first real analyser and site for 1.10, and the first real connector for phase 2.
10. **DECIDE:** whether the first-party providers we have (four online payment providers, two cloud
    POS providers, ABDM, NHCX, HRMS) are ported to the extension contract, and when.
11. **DECIDE:** prices, revenue-share percentage, listing fee (if any), certification fees, whether
    open-source extensions list and certify free, trial length, and whether community extensions
    cost hospitals anything (the RFC assumes not).
12. **DECIDE:** paid bricks as (a) paid updates, support and certification per brick, or (b) a
    licence lock on non-clinical add-ons (§10.3).
13. **DECIDE:** the legal entity that sells, invoices and holds GST registration, and the countries
    it sells into first.
14. **DECIDE:** the marketplace money shape: reseller, split settlement through a licensed
    aggregator, or agency (§10.5), with counsel.
15. **DECIDE:** the payment compliance questions in §4.5, with legal review.
16. **DECIDE:** the first card-terminal brand for the wired driver and the first new provider
    connector (Paytm, Mswipe or another) in phase 1b, and which UPI soundbox route to try (Cashfree's
    VPA binding, or our own counter-display audio only).
17. **DECIDE:** preloaded boxes: whether we sell hardware directly or only through certified
    resellers, and the warranty terms.
18. **DECIDE:** extension permission codes as a namespaced data family (`ext.<publisher>.<app>.*`)
    beside the Rust-defined core codes (§3.4), an amendment to the Permissions First rule.
