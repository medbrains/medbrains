# RFC: the developer platform — docs, sandbox, vendor sign-in, governed MCP, directory

**Status:** Proposed, for the owner to read and decide. Documents only; nothing here is built by this RFC.
**Date:** 2026-11-21. **Decided so far:** the developer platform is the top ecosystem priority
(owner, 2026-11-21: "ecosystem plan is most needed"). Everything else below is a proposal.
**Parent:** `RFC-OS-ECOSYSTEM.md` (draft PR #6085: drivers, connectors, apps, payments, commerce).
**Binds:** `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md` (every call, every axis),
`docs/OS-PRINCIPLES.md`, `docs/extensions/PROTOCOL.md` (the wire contract we already promise),
ENGINEERING.md (Permissions First, Every Change Ships Its UI, plan UI before build).

**Why a separate file, not an edit to #6085.** #6085 is a 900-line design of all three extension
types, still unmerged and based on `main`. This RFC is the one slice the owner has now ranked first:
what an outside company touches in its first week. It cites #6085 by section instead of repeating it,
and changes none of #6085's decisions. If #6085 merges first, this file becomes its §8 detail.

---

## 0. Summary

Today a hospital can let a vendor's service in through the kernel (#5182, `PROTOCOL.md` v1): the
vendor pastes a manifest, the hospital approves it, the service signs in with client credentials,
reads three FHIR resources and gets signed webhooks. That path is real and well guarded. What a
vendor **cannot** do today is find out about it, try it without a hospital, act as a signed-in
clinician, connect an AI assistant, or show a hospital that its connection works.

This RFC fills those four gaps, in order:

| # | Gap | Proposal | First slice |
|---|---|---|---|
| 1 | No public developer docs, no place to try | **Public API docs** generated from the router, and a **sandbox hospital** any developer can create, with synthetic patients, reset nightly | Docs + sandbox on the existing trial server |
| 2 | Apps act only as themselves | **Vendor sign-in v2**: register once, install per hospital, user-context sign-in (SMART-style authorization code + PKCE), scopes = Rust permissions, a consent screen, revocation, audit | Permission-code check against the generated catalogue; separate approve permission |
| 3 | No way for outside AI to connect | A **governed MCP gateway** over the kernel's typed actions (`kernel::action::act`), read-only, acting as the signed-in person | Three read actions that already exist |
| 4 | Nobody can see what connects | A **public directory** of connections with a live-connection rule and no endorsement wording | First-party India-pack connections (ABDM, NHCX, payments) |

**The smallest slice an outside vendor can actually use** (§6, slice A, ~3 engineer-weeks): public
docs for protocol v1 plus a self-serve sandbox hospital. With only that, a vendor builds a working
connected service against synthetic data, runs `medbrains ext test --url <sandbox>` green, and
brings the same manifest to a real hospital. Every later slice adds reach, not the first success.

**Why this matters (claim, evidence, strength).** The brief records that Epic announced on
2026-11-18 it will open its EHR to outside AI agents over MCP by Q1 2027, and that its Connection
Hub lists 2,200+ (reportedly ~3,700) vendor apps with live connections. *Not verified by me; from
the owner's brief.* The lock-in argument is strong regardless of the exact number: hospitals stay on
an EHR because their other software is already wired to it. MedBrains' answer is speed: **an outside
company connects in days, not months**, and the hospital still decides every grant.

---

## 1. What exists today

Read in `release/3.35.3` on 2026-11-21. **Exists** = merged and reachable; **partial** = built but
missing a piece this RFC needs; **missing** = not started. "Verified" means I read the code;
"assumed" means I did not.

### 1.1 Docs and sandbox

| Piece | State | Evidence (verified unless marked) |
|---|---|---|
| OpenAPI document | **Partial** | `docs/openapi.json`, 2,213 paths, generated from the router by `scripts/generate_openapi.py`, with required permissions per operation. Its own description says **request and response schemas are not described** (bodies are untyped objects) |
| Rendered API reference | **Missing** | no Redoc/Swagger/Scalar in `apps/docs`; `apps/docs/docs/developer/` covers contributing, running locally, permissions and ratchets, not integrating |
| Protocol v1 spec | **Exists** | `docs/extensions/PROTOCOL.md`, `manifest.schema.json`, fixtures; not published in `apps/docs` |
| SDKs and conformance | **Exists** | `packages/sdk` (`medbrains ext init/validate/test`, `--url` runs the suite against a live hospital), `sdks/python` |
| Self-serve hospital creation | **Exists (trial server)** | `crates/medbrains-onboarding/src/trial.rs`: a server started with `TRIAL_SIGNUP=open` takes sign-ups from anyone, 30 days, no card, at most 3 sign-ups per address per day |
| Synthetic seed data | **Partial** | `crates/medbrains-seed`: demo patients, OPD visits, device, radiology and camp fixtures — but gated by an environment-wide flag and **never in a production environment** (`lib.rs`), so a trial tenant on a production server gets none |
| Sandbox flag on a tenant | **Missing** | no `is_sandbox`/tenant-kind column; nothing stops a sandbox being used with real patients |
| Reset | **Missing** | no per-tenant wipe-and-reseed |
| Rate limits | **Exists** | `middleware/rate_limit.rs` tiered API limiter (600/min tier); protocol v1 per-token 600/min; token endpoint 5/min/IP |
| Role-based test logins | **Partial** | issue #4800 (open): per-role test accounts, training tenant |

### 1.2 Vendor sign-in (#5182)

| Piece | State | Evidence |
|---|---|---|
| Register, approve, revoke, rotate | **Exists** | `crates/medbrains-connected-apps` (`lib.rs` routes under `/api/admin/connected-apps`), `apps/web/src/pages/admin/connected-apps/` (`RegisterAppModal`, `AppReviewModal`, `CredentialsModal`) |
| Scopes = permission codes | **Exists** | manifest `permissions` are MedBrains codes, 1–50, no wildcards; `scope` can narrow, never widen (`PROTOCOL.md` §4) |
| Scope codes checked against the real catalogue | **Missing** | `manifest.rs::is_permission_code` checks the **shape** only. `refuse_escalation_now` returns early for bypass roles, so a hospital admin can approve a code that does not exist, and the privacy label shows it. Harmless to access (it grants nothing), misleading on the consent screen |
| Codes an app may never hold | **Missing** | no list; an app may ask for `admin.*` codes |
| Separate register and approve | **Missing** | both need `admin.connected_apps.manage` (`permissions.rs`) |
| Per-record checks | **Exists** | every call runs permission, then per-record access: a patient must be shared with the app's service identity (Patient → Share access) |
| User-context sign-in (act as a clinician) | **Missing** | client credentials only; `redirectUris` reserved, "later phase" (`PROTOCOL.md` §7) |
| One registration, many hospitals | **Missing** | each hospital pastes the manifest; there is no publisher identity or signed manifest |
| Audit | **Exists** | token issue, approval, revocation, rotation in the hash-chained audit log; every call in the usage log |
| Webhooks | **Exists** | outbox, HMAC-SHA256, 5-min replay window, idempotent ids, 10 retries; 60 typed events (`clinical_events.rs`). **No appointment/scheduling events** |
| FHIR surface | **Partial** | `medbrains-fhir-api`: read Patient, `$everything`, Encounter, DiagnosticReport, Observation; v1 exposes three; no search, no write |
| Machine identity | **Exists** | API keys as shadow service accounts (`0970`–`0973`), `/admin/api-keys` page, `refuse_escalation` |
| Staff access to a hospital | **Exists** | `vendor_access_grants`, `docs/compliance/vendor-access.md` (no grant = 403 even for bypass roles) |

### 1.3 AI and MCP (#5620)

| Piece | State | Evidence |
|---|---|---|
| Typed action broker | **Exists** | `medbrains-kernel/src/action.rs`: `EffectClass` (Read, Draft, Write, Money, Critical, Device, …), `Invoker::{Person, Assistant{on_behalf_of}}`, three outcomes, one audit row per decision (#6087) |
| Actions | **Exists, 3** | `medbrains-health-services/src/actions.rs`: `patients.find`, `patients.summary` (masked as the chart masks), `opd.queue.today`; `scripts/check_actions.py` |
| Acting-for claim | **Exists** | `ActingAgent` in `kernel/src/claims.rs`, written to `audit_log.acting_agent` |
| Field-class masking | **Exists** | `DataClass` (`medbrains-authz/src/classification.rs`), `field_class::class_of` |
| Redaction before any model | **Exists** | `medbrains_core::ai_redact`, `make check-llm-redaction` |
| Manifest kind `mcp-tool` | **Partial** | `manifest.rs` knows it; nothing serves it |
| MCP server | **Missing** | none in the workspace |
| Plan conflict | **Open** | `RFC-AI-NATIVE.md` Layer 3 says generate one MCP tool per OpenAPI operation (2,909 ops). The owner rejected MCP as the core on 2026-11-18, and draft #6086 proposes curated typed actions with MCP only through a hardened gateway. **This RFC follows #6086**: the gateway serves curated actions, never the OpenAPI list |

### 1.4 Directory

| Piece | State | Evidence |
|---|---|---|
| ABDM M1–M4, scan-and-share, UHI | **Built, not all certified** | `medbrains-abdm`; memory notes say not on every production install and sandbox path checks remain (assumed) |
| NHCX claims | **Built** | `outbox/handlers/nhcx`, `medbrains-nhcx-callback` |
| Payment providers | **Built, compiled in** | `payment-gateway/src/online/mod.rs` (`PROVIDERS`, four online), two cloud POS providers, `GET /api/payments/capabilities` |
| Lab analysers | **Catalogue only** | `device_adapter_catalog`: 31 seeded rows, **all `is_verified = true` with empty field mappings** (#6085 §2.1). Not a live connection |
| Public listing | **Missing** | no directory page on the website (`website/`, Astro) or in the product |
| Install telemetry | **None, by decision** | DECISIONS 2026-11-01: passive markers only, no covert phone-home. So we cannot *measure* "live" ourselves |

**Reading of the tables.** The guarded core (protocol, manifest, approval, three outcomes, audit,
masking, the action broker) exists. What is missing is everything around the edges a stranger meets
first: a page to read, a place to try, a way to act as a person, and a list to be found on.

---

## 2. Public API docs and the sandbox hospital

### 2.1 Docs

| Proposal | Why | Size |
|---|---|---|
| Publish `PROTOCOL.md`, the manifest schema and the event catalogue as a **"Build on MedBrains"** section of `apps/docs` (generated from the same files, so they cannot drift) | the contract exists; nobody outside can find it | S |
| **Rendered API reference** from `openapi.json`, filtered to the operations an extension can actually call (protocol v1 endpoints plus FHIR), not all 2,213 paths | showing internal routes invites calls that will be refused and implies a promise we do not make (`COMPATIBILITY.md`) | S |
| Response schemas for the published operations only (FHIR is already a schema; the rest from the Rust types, generated) | the generator's own caveat says bodies are untyped | M |
| A **"first hour"** tutorial: sandbox → register → token → read a Patient → receive `patient.created` → `ext test --url` green | the frictionless test from #6085 §1 | S |
| Permission reference generated from `permissions.rs` doc comments, with "extension may request: yes/no" | scopes must never be a parallel list | S |

Rule: **every published page is generated or tested**. A docs page that shows a request runs it in
CI against the mock (`packages/sdk/src/conformance.ts`), so a stale example fails the build.

### 2.2 The sandbox hospital

**Proposal: a sandbox server, not a sandbox feature inside real servers.** It is the trial server
code with `SANDBOX=1`, on its own host and database. A real hospital's server never creates sandbox
tenants (same reasoning as `trial.rs`: "an open door there would let a stranger create an
organisation beside that hospital's patients").

| Question | Proposal |
|---|---|
| Who can sign up | anyone with a verified email (existing `email_verification.rs`); 3 per address per day (exists); one live sandbox per email |
| What they get | a tenant marked `kind = 'sandbox'` (new column, set only by the sandbox server, CHECK that a sandbox tenant cannot become live), the developer as hospital admin, plus one test account per built-in role (#4800) so they can try user-context sign-in as a doctor or nurse |
| Data | **synthetic only**: the existing `medbrains-seed` demo fixtures, made per tenant instead of per environment; later a larger generator (Synthea is the obvious candidate, Apache-2.0; owner question). Names, numbers and dates are visibly fake |
| "Data never real" — how we enforce it, not just ask | (1) shell banner on every screen: "Sandbox — synthetic data only"; (2) registration refuses identity numbers that pass real check digits (Aadhaar Verhoeff and similar country checks) and phone numbers outside a reserved test range; (3) file and photo upload off; (4) every outbound adapter forced to its test endpoint (ABDM sandbox gateway, payments test mode, SMS/email to a captured outbox shown on screen) and the egress allowlist limited to those; (5) terms of use forbid real data; (6) data purged at reset. None of these is perfect; together they make real data an act of effort, not an accident |
| Reset | nightly at a fixed hour, the tenant is wiped and reseeded to the same canonical state (canonical UUIDs exist in `canonical_fixtures.rs`, so tests can rely on ids). A **Reset now** button for the developer. Connected apps registered in it survive the reset (only their tokens are revoked), so the developer does not re-paste the manifest daily |
| Expiry | 30 days idle (the trial length), with an email warning at 25 |
| Rate limits | lower than production: 120 calls/min per token, 10,000 per day per tenant, 20 webhook deliveries/min; 429 with `Retry-After`. Production limits stay as in `PROTOCOL.md` |
| Size bounds | 5 connected apps, 50 patients created beyond the seed, 100 MB per tenant (OS-PRINCIPLES: bound everything) |
| Downloadable sandbox | the OS VM image with the same seed (#6085 §8) for vendors who must test offline or with a device; same reset command |

### 2.3 Screens (UI plan)

| Screen | Placement | Layout and primitives | States | Permission |
|---|---|---|---|---|
| **Developer sign-up** | website `/developers` → sandbox server sign-up (trial page variant) | one column form: name, company, email, country, purpose; seam `Input`, `Checkbox` for terms, `Button tone="primary"` | idle, sending, email sent, link expired, limit reached ("3 a day from this address"), sandbox server down (says so, no blank) | public; server must run with `SANDBOX=1` |
| **Sandbox banner** | app shell, top, every screen, not dismissable | seam `Alert` with `tone="accent"` and a plain line + "Reset now" link | normal, reset running, reset failed (shows when it last succeeded) | visible to all on a sandbox tenant |
| **Developer home** (Admin → Developer) | new tab in the admin area, sandbox tenants only | `Stack` of `Card`s: credentials checklist, "first hour" steps with done marks, test-role logins, captured outbound messages, reset | each step: not started, done, failing with the error the API returned | `admin.sandbox.manage` (new, §5) |
| **Reset confirm** | `Modal` size `sm` | says what is wiped and what is kept | confirming, resetting, done, failed | `admin.sandbox.manage` |

### 2.4 Threats

| Threat | Mitigation |
|---|---|
| Real patient data typed into a sandbox | §2.2 enforcement list; sandbox host holds no production keys; DPO-visible report of refused identifiers |
| Sandbox used as free hosting or for spam (SMS/email) | no real outbound messages; size and rate caps; idle expiry |
| Sign-up abuse | per-address limit (exists), email verification (exists), sandbox server isolated from every hospital |
| Sandbox credentials reused in production | sandbox tokens carry a distinct prefix (`mb_test_…` vs `mb_live_…`); production refuses `mb_test_` outright |
| Seed drift breaks vendor tests | canonical UUIDs fixed; seed changes listed in release notes |

### 2.5 Regulatory notes

- With synthetic data only, the sandbox processes **no personal health data** of patients, so DPDP
  obligations reduce to the developers' own account data (name, email): privacy notice, purpose,
  deletion on request. *Assumed; confirm with counsel.*
- The ABDM sandbox is NHA's, with its own terms; a vendor using it through our sandbox still needs
  their own NHA sandbox registration for anything beyond our stubs (open question 3).

---

## 3. Vendor sign-in v2 (builds on #5182)

### 3.1 Design

| Topic | Today | Proposal |
|---|---|---|
| **Registration** | per hospital, paste manifest | **Register once, install per hospital.** A publisher signs their manifest with their own Ed25519 key (key registered on the sandbox server, verified email + company). A hospital admin installs by pasting a manifest URL or picking it from the directory; the server checks the publisher signature. **Credentials are still minted per hospital** and never by us, so a self-hosted, offline hospital works the same way and a breach of our registry leaks no hospital credentials |
| **Scopes** | permission codes, shape-checked | scope = a MedBrains permission code that **exists in the generated catalogue** and is marked **extension-grantable** in its Rust definition (a new doc-comment tag or attribute read by `generate_permissions_ts.py`). Never a second list. Codes under `admin.*`, `security.*` and anything that changes access are never grantable |
| **Two sign-in modes** | client credentials (app acts as itself) | keep it, and add **user-context sign-in**: OAuth 2.0 authorization code + PKCE (the SMART App Launch shape). The token acts **for a named person**: effective permissions = app's approved grant **∩** that person's permissions; per-record checks are that person's; audit shows both (`ActingAgent` with a new kind `app`) |
| **Where the person signs in** | — | the hospital's own sign-in (password today, Kanidm OIDC where configured). MedBrains is the authorization server for its own API; Kanidm proves who the person is. *Assumed workable; open question 6* |
| **Consent** | hospital admin approves the app | two layers: (1) **hospital approval** as today, now by a separate permission; (2) **person consent** the first time a person connects the app, listing what it may do *as them*, remembered per person per app, revocable by them |
| **Per-record** | share patient with the service identity | unchanged for service mode; user-context mode inherits the person's care relationships, so a doctor's app sees that doctor's patients and nothing more |
| **Tokens** | 15 min access, client secret | user-context: 15-min access token, 8-hour refresh token bound to the client, rotated on use, revoked with the person's session; optional DPoP later (#6086) |
| **Revocation** | admin revokes app; next call fails | plus: person revokes their own consent; admin revokes one person's link; staff leaving revokes every link (hooked to deactivation) |
| **Audit** | tokens, approvals, usage log | plus a per-app **activity view** (calls, refusals, unknowns, records touched, by person) |
| **Webhooks** | signed, 60 events | add scheduling events (`appointment.booked`, `.cancelled`, `.checked_in`); publish the event catalogue as a versioned schema (#6085 §7) |

### 3.2 Screens (UI plan)

| Screen | Placement | Layout and primitives | States | Permission |
|---|---|---|---|---|
| **Connected apps list** (exists) | Admin → Connected apps | seam `Table`; add columns publisher (signature verified / unsigned), mode (service / acts for staff), last call | loading, empty ("No apps yet — browse the directory"), error, unknown-authz (never shown as empty) | `admin.connected_apps.view` |
| **Install from directory / URL** | button on the list → `Modal` `fullScreen` | step 1 fetch + verify signature; step 2 privacy label; step 3 confirm | signature valid, unsigned (warning, allowed only if the hospital allows unsigned apps), invalid (refused), manifest asks for a non-grantable code (refused, names it) | `admin.connected_apps.manage` |
| **Approve** (exists as `AppReviewModal`) | `Modal` `md` | privacy label: each permission in plain words (the first sentence of its Rust doc comment), data classes, where data goes and which country | pending, approved, refused, approver lacks a code (that code is shown disabled with why) | **`admin.connected_apps.approve`** (new) |
| **Person consent** | full page at `/oauth/authorize` (its own route, not a modal: it is a sign-in step) | app name, publisher, verified mark; "This app will be able to, as you:" list; data classes; Allow / Deny | first time, already consented (skips), app revoked by hospital (refuses with reason), person lacks every requested code (refuses), authz unknown (says "could not check, try again", never allows) | signed-in person; app must be approved |
| **My connected apps** | user menu → Settings → Connected apps | seam `Table`: app, what it may do, last used, Revoke | none, list, revoke confirm (`Modal sm`) | any signed-in person (own links only) |
| **App activity** | Connected apps → row → Activity tab | `Table` of calls with outcome chips (allowed / refused / unknown, text not colour alone) | loading, empty, error | `admin.connected_apps.view` |

### 3.3 Threats

| Threat | Mitigation |
|---|---|
| Over-broad scopes accepted by a bypass-role admin | grantable list + catalogue check at register **and** approve; non-grantable codes refused for everyone, bypass roles included |
| Consent phishing (lookalike app name) | publisher signature + verified mark; app name unique per publisher key; hospital approval required before any person sees the consent screen |
| Authorization code interception | PKCE required (S256), exact redirect URI match, HTTPS only, single-use codes, 60-s lifetime |
| Stolen refresh token | bound to client; rotation with reuse detection (reuse revokes the chain); revoked on person deactivation |
| App sees more patients than its user | effective = grant ∩ person; per-record check is the person's; 404 for not-yours (existence oracle rule) |
| Confused deputy (service mode + user mode mixed) | a token is one mode; audit records the mode; service tokens cannot be exchanged for user tokens |
| Fault read as refusal or as empty | 503 `temporarily_unavailable` for unknown, as v1 already does; conformance suite asserts it |
| Webhook to internal network | `is_allowed_target` (exists) plus resolve-then-check on every delivery (DNS rebinding) |

### 3.4 Regulatory notes

- **DPDP Act 2023:** the hospital is the data fiduciary; a vendor app is usually its **processor**
  and needs a contract with the hospital before approval. The approval screen should require the
  admin to tick "a data-processing agreement is in place" for any app with `identifying` or higher
  data classes, and record who ticked it. Where the vendor uses data for its own purposes it becomes
  a fiduciary in its own right; we do not adjudicate that, we show `sendsDataTo` and its country.
  The DPDP Rules phase in obligations over the months after notification (my understanding: most
  within about 18 months of November 2025) — *verify dates with counsel*.
- **IT Act 2000 / CERT-In directions (2022):** keep app audit and usage logs at least 180 days and
  be able to report an incident within 6 hours; the activity view and audit chain serve both.
- **ABDM:** records fetched through ABDM consent artefacts are bound to that artefact's purpose and
  expiry. A connected app must not read them beyond it. *Assumed:* such records are tagged with their
  artefact today — if not, they are excluded from app reads until they are (open question 4).
- Other countries: the same screens carry GDPR (processor agreement, transfer basis) and other packs
  through the existing `sendsDataTo` country field.

---

## 4. A governed MCP gateway (#5620)

### 4.1 Position

**Claim:** MCP is worth supporting at the edge, never as the core. **Evidence:** the owner rejected
MCP as the core on 2026-11-18; the typed action broker now exists and already does what an MCP tool
call needs (permission, module switch, effect class, three outcomes, audit). **Strength:** strong for
"edge only"; the protocol choice itself is cheap to revisit because the gateway is thin.

So the MCP server is a **gateway that translates MCP tool calls into kernel actions**. It holds no
data access of its own and no tool that is not an `ActionDef`.

### 4.2 Rules

| Rule | How |
|---|---|
| **Read-only first** | the gateway lists only actions with `EffectClass::Read`. Draft comes later with per-item accept (AI UI rules); Write, Money, Critical, Device never |
| **Acts as the signed-in person** | MCP's own authorization (OAuth 2.1 with PKCE) = the user-context sign-in of §3. The gateway calls `act` with a new `Invoker::App { app, on_behalf_of: person }`. Permissions, per-record access and masking are the person's ∩ the app's grant |
| **Every tool call is an authz check** | `act` already runs module-on → effect policy → three-outcome permission → handler; no shortcut path |
| **Field-class masking** | done by the action's handler (e.g. `patients.summary` masks as the chart does); `restricted`/`sealed` classes never leave through MCP in phase 1, whatever the person may see on screen |
| **Audit row per call** | `act` writes one row per decision with both actors; the gateway adds the MCP client id and session id |
| **Bounds** | per person per app: 60 calls/min, 1,000/day; at most 25 distinct patients per hour (bulk-exfiltration guard); results capped (50 rows, 32 KB); over a bound = refusal with the reason, logged |
| **AI never decides access** | the gateway has no policy of its own and never asks a model whether a call is allowed. The model chooses which tool to call; the kernel decides whether it may |
| **Unknown is not empty** | an `Unknown` outcome returns an MCP tool error "could not check access, try again"; never an empty list |
| **Hospital switch** | off by default; Admin turns it on and picks which actions are exposed; one switch turns every outside assistant off (RFC-AI-NATIVE kill switch) |

### 4.3 Prompt injection in tool outputs

Tool results contain text other people wrote (a complaint typed by a receptionist, a patient's
portal message). An outside model may obey instructions hidden in it.

| Mitigation | Effect |
|---|---|
| No write tools | the worst injected instruction can do is make the model read more, within the person's access and the bounds above |
| Free text marked as data | every free-text field goes out inside a structured result with a `provenance` field (who wrote it, where) and a fixed note that it is record content, not instructions; structured fields stay typed |
| Tool definitions pinned | tool names, descriptions and schemas are generated from `ActionDef` and versioned; their hash is published so a client can detect changes (tool-poisoning defence) |
| No links or images rendered by us | the gateway returns no URLs that carry data (blocks exfiltration through a fetched image) |
| One patient context optional | a hospital may require a session to be pinned to one patient chosen on screen |

These reduce, not remove, the risk; the outside model and its provider remain outside our control,
which is why the hospital decides per app and the person sees what the app may do.

### 4.4 First tools

| Order | Action | State | Data classes |
|---|---|---|---|
| 1 | `patients.find` | exists | identifying |
| 2 | `patients.summary` | exists | identifying |
| 3 | `opd.queue.today` | exists | identifying, routine |
| 4 | `appointments.for_patient` / `appointments.today` | new action | identifying, routine |
| 5 | `lab.results.for_patient` (verified results only) | new action | sensitive |
| 6 | `medications.active`, `allergies.for_patient` | new actions | sensitive |

Excluded in phase 1 whatever the demand: psychiatry, HIV/STI, reproductive, MLC, genetic and any
`restricted`/`sealed` class.

### 4.5 Screens (UI plan)

| Screen | Placement | Layout and primitives | States | Permission |
|---|---|---|---|---|
| **Outside assistants** | Admin → AI → Outside assistants | `Switch` hospital-wide on/off; `Table` of exposed actions with a `Checkbox` each and their data classes; bounds shown read-only (phase 1) | off (default), on, unknown (cannot read the setting — shows that, keeps gateway off) | `admin.ai.outside_assistants.manage` (new) |
| **Assistant consent** | the §3 person-consent page, with an AI notice: "An AI assistant will read records as you. It cannot change anything." | `AiLabel` on the page | as §3 | signed-in person holding `ai.outside_assistants.use` (new) |
| **Assistant activity** | same page, Activity tab | `Table`: time, person, tool, patient (masked), outcome text | loading, empty, error | `admin.ai.outside_assistants.manage` |
| **My connected apps** | §3 screen; AI clients carry `AiLabel` | — | — | own links |

### 4.6 Threats

| Threat | Mitigation |
|---|---|
| Bulk exfiltration through a chatty agent | patient-per-hour and row caps; anomalies flagged on the activity view |
| Injection leads to unintended reads | §4.3; read-only; person-scoped |
| PHI sent to a model provider abroad | the app's `sendsDataTo` must name the model provider and country; hospital approval records it; restricted classes excluded |
| Tool list drift exposes a new action silently | exposed actions are an explicit per-hospital list; new actions start unexposed |
| Model output treated as a record | nothing returns into MedBrains in phase 1 (read-only); drafts later go through per-item accept |

### 4.7 Regulatory notes

- **DPDP:** reading patient data through an outside AI is processing for the hospital's purpose
  (care). Whether the patient must be told, or consent, for each such use is a **counsel question**
  (open question 5). Until settled, phase 1 is staff-facing only, never patient-facing.
- **ABDM:** ABDM-fetched records excluded from MCP results until artefact tagging is confirmed (§3.4).
- **Medical device software:** read-only retrieval for a clinician is unlikely to be a device
  function, but a vendor's assistant that then suggests diagnoses may be; that is the vendor's
  regulatory duty, and our listing must not imply otherwise (#6085 §9.3).

---

## 5. Permissions to define (Permissions First)

All are proposals until the owner agrees; each is defined in `crates/medbrains-core/src/permissions.rs`
with a `///` doc comment, generated outward, granted in `access/roles.rs`.

| Code | What it gates | Granted to (proposal) |
|---|---|---|
| `admin.connected_apps.approve` | approving an app (split from `manage`: separation of privilege) | hospital admin |
| `admin.sandbox.manage` | the developer home and reset, sandbox tenants only | sandbox hospital admin |
| `admin.ai.outside_assistants.manage` | turning the MCP gateway on, choosing exposed actions, viewing activity | hospital admin |
| `ai.outside_assistants.use` | a person connecting an outside AI assistant to act for them | doctor, nurse (hospital may change) |
| `admin.directory.view` | the in-product directory tab | anyone with `admin.connected_apps.view` (may simply reuse it; owner call) |

Plus one **property** on existing permissions: `extension_grantable` (default false), set
deliberately per code in Rust and emitted into `permissions.ts`, the manifest validator and the docs.
New action ids (`appointments.today`, …) each reuse the permission their screen already checks.
`make check-permissions` and `check-role-templates` must pass; a key lacking each code must get 403.

---

## 6. A public directory of connections

### 6.1 What it lists

| Kind | India pack first (examples, from code) | Global next |
|---|---|---|
| Country exchanges | ABDM (health ID, records, scan-and-share), NHCX claims | other national exchanges as their adapters land (built-for until certified) |
| Payments | the online and POS providers in `payment-gateway` | per country pack |
| Lab analysers | none until a driver has run at a site (#6085 phase 1.10) | — |
| Vendor apps | none until a vendor is live (§6.2) | — |

### 6.2 Listing rules (proposal)

1. **A live connection is required.** A listing needs either (a) a production hospital that attests
   it uses the connection (a signed statement from that hospital's admin, from a button in its
   Connected apps screen) or (b) for first-party connections, our own production evidence. Because
   we do not phone home (DECISIONS 2026-11-01), "live" is **attested, not measured**; the listing
   shows "live at N hospitals, attested" and the date of the last attestation. Lapses after 12 months.
2. **Conformance passed:** `medbrains ext test` green against the sandbox for the listed version.
3. **No endorsement wording.** Listings say "Connects with MedBrains" and state facts (version,
   data classes, countries data goes to, live count). No "certified", "recommended", "partner",
   "approved" or rankings unless a certification level exists (#6085 §9.2, DECIDE 4).
4. **Same rules for us.** First-party connections list under the same rules (#6085 goal 2).
5. **Honest state.** "Built, not yet certified by the exchange" is shown when true (e.g. an ABDM
   milestone without NHA sign-off). The 31 "verified" catalogue rows are **not** listed until fixed
   (#6085 step 1.1).
6. **Delisting:** a revoked publisher key, a failed conformance run on a new release, or a
   substantiated hospital complaint delists within one release; the reason is shown.

### 6.3 Where it lives

A **signed JSON index in this repository** (simple, auditable, matches #6085 DECIDE 6's first
option), rendered as a page on the website and bundled into each release so the in-product tab works
offline. Listing requests arrive as pull requests with the evidence attached.

### 6.4 Whether to charge

**Recommendation: listing is free.** Evidence: DECISIONS 2026-11-01 "earn through a partner
programme and certification", with selling licences rejected; #6085 §8.4 "builders own their business
model". A listing fee taxes exactly the small vendors that make an ecosystem large, and Epic's
ecosystem fees are a known complaint (*general knowledge, not verified here*). Charging for optional
certification review and support fits the existing decision. **This is the owner's call** (#6085
DECIDE 11).

### 6.5 Screens (UI plan)

| Screen | Placement | Layout | States | Permission |
|---|---|---|---|---|
| **Public directory** | website `/connections` | `SimpleGrid` of cards with filters (kind, country, data class); each card: facts only | loaded from bundled index; no results for filter | public |
| **Directory tab** | Admin → Connected apps → Directory | same cards; "Install" opens §3 install flow | offline (bundled index, shows its date), online newer index available | `admin.connected_apps.view` |
| **Attest live use** | Connected apps → app row → "We use this" | `Modal sm`: what is shared (hospital name optional, count only by default) | attest, withdraw | `admin.connected_apps.manage` |

### 6.6 Threats and regulatory notes

| Threat | Mitigation |
|---|---|
| Fake attestations to look popular | attestation signed by a hospital's server key, one per hospital per listing, revocable; random checks |
| Listing implies we vouch for clinical safety | no endorsement wording; every card links to the publisher's own regulatory statement |
| Index tampering | signed index, verified by the product before display |
| Naming a hospital publicly | count only by default; a hospital opts in to being named (and never patient data) |

Consumer Protection Act 2019 and its e-commerce rules may apply if the directory shows prices or
takes orders; phase 1 shows no prices (*counsel question if commerce from #6085 §10 joins later*).

---

## 7. Phased roadmap

Sizes in engineer-weeks, one engineer with review, rough. Each slice ends on a screen, used as the
role that would use it (ENGINEERING.md: Every Change Ships Its UI).

| Slice | What | Ends on | Size |
|---|---|---|---|
| **A. First outside vendor** | "Build on MedBrains" docs section from `PROTOCOL.md` + filtered API reference + first-hour tutorial; sandbox server mode (`SANDBOX=1`), tenant `kind`, per-tenant synthetic seed, banner, test-endpoint lock, nightly reset, developer home; manifest codes checked against the catalogue; `extension_grantable` property | a person outside the team signs up, builds a service from the docs alone, and runs `ext test --url` green, **timed, in under a day** | **3** |
| **B. Directory v0** | signed index in repo, website page, in-product tab, listing rules page; first-party India-pack entries with honest state | the page lists ABDM, NHCX and payments with facts only; the product shows it offline | 1.5 |
| **C. Vendor sign-in v2** | publisher keys + signed manifests; install by URL; `approve` split; user-context sign-in (auth code + PKCE); person consent; my connected apps; activity view; scheduling events | a sandbox doctor connects a test app that sees only that doctor's patients; revoking consent stops the next call | 5–6 |
| **D. MCP gateway, read-only** | gateway over `act` with `Invoker::App`; 3 existing actions; bounds; provenance wrapping; admin screen; then actions 4–6 | an off-the-shelf MCP client, signed in as a sandbox nurse, lists today's queue; a refused patient comes back as refused, an outage as "could not check" | 3–4 |
| **E. Breadth** | FHIR search + more resources; response schemas; attestation button; first real vendor listed | first outside vendor listed with an attested live hospital | 4 |

Order rationale: **A before C** because a vendor cannot use sign-in it cannot try; **C before D**
because MCP's authorization is the user-context sign-in; **B early** because it is cheap and makes
the platform visible while C and D are built.

---

## 8. Risks

1. **Sandbox becomes the place real data leaks.** The enforcement list in §2.2 is defence in depth,
   not proof. Mitigation: no production keys on the sandbox host, purge at reset, a DPO report.
2. **User-context sign-in on Kanidm** may need work we have not sized (open question 6).
3. **Attested "live" can be gamed.** Mitigation in §6.6; the alternative (telemetry) contradicts a decision.
4. **MCP spec churn.** The gateway is thin by design; the actions underneath are ours and stable.
5. **Two plans for MCP.** `RFC-AI-NATIVE.md` Layer 3 (OpenAPI-generated tools) conflicts with
   #6086 and this RFC. If accepted, Layer 3 gets a superseded note in the PR that builds slice D.
6. **Vendors expect writes.** Epic-style apps write back. Writes come only as drafts a person
   accepts, after slice D; say so plainly in the docs so nobody builds on a promise.

---

## 9. Open questions for the owner

1. **Agree the order** A → B → C → D → E, with slice A as the first build?
2. **Sandbox host:** run it as a separate hosted server (proposal), and in which region? Who pays for it?
3. **ABDM sandbox:** stub ABDM in our sandbox only, or pass developers through to NHA's sandbox with their own credentials?
4. **ABDM-fetched records:** confirm whether they carry their consent artefact today; if not, exclude them from app and MCP reads (proposal) until they do.
5. **DPDP for AI reads:** is staff use of an outside AI over patient records covered by the hospital's care purpose, or does it need patient notice/consent? (Counsel.) Phase 1 stays staff-only until answered.
6. **Sign-in:** may MedBrains be the OAuth authorization server for its API with Kanidm as the identity provider behind it, or should Kanidm issue the app tokens?
7. **Synthetic data:** extend our seed only, or add Synthea for volume?
8. **Directory charging:** free listing, paid optional certification (proposal) — yes or no? (#6085 DECIDE 11.)
9. **Naming hospitals** in the directory: count only by default (proposal), or names with opt-in?
10. **Grantable codes:** agree that `admin.*`, `security.*` and access-changing codes are never grantable to an app, even with a hospital admin's approval.
11. **MCP bounds:** are 25 patients per hour and 1,000 calls a day per person sensible first limits, or should each hospital set them from day one?
12. **First outside vendor:** is there one the owner wants to time slice A with?

---

## 10. Not in this RFC

Drivers, on-box connectors, WebAssembly, the marketplace, payments, licences and certification
(all #6085); the internal assistant and typed-action planner (#6086); write or draft tools; any price.
