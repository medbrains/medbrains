# Changelog

All notable changes to MedBrains are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); what each part of the version
promises is in [`medbrains/docs/COMPATIBILITY.md`](medbrains/docs/COMPATIBILITY.md).
Security fixes follow [`medbrains/docs/SECURITY-RELEASE-PROCESS.md`](medbrains/docs/SECURITY-RELEASE-PROCESS.md).

The release workflow publishes the section for the tagged version as the
GitHub release notes, so write each section for a hospital IT team.

## [Unreleased]

## [3.33.0] - 2026-11-13

The first versioned release of MedBrains, an open-source hospital OS built for hospitals anywhere.

Everything before it was built on `main` without version numbers; this
section summarises what 3.33.0 contains.

### Since the summary below was written

PRs still open when this release was cut are not included.

#### Licence

- MedBrains is now dual-licensed: GNU AGPL-3.0-only, free for everyone, or a
  commercial licence for vendors who sell, host or embed it without sharing
  their changes. Versions released before 2026-11-12 stay under Apache 2.0.
  The client SDKs (TypeScript and Python) stay under Apache 2.0 (#5480).

#### Security

- A damaged, cut or mismatched key is refused when it is loaded instead of
  being used, and the development sealing key is never used outside
  development (#5479).
- Dependency updates for seven open security alerts (#5461), and every other
  dependency and code-scanning alert that had a fix (#5288, #5296, #5408, #5409).
- A hospital decides when MedBrains staff may reach its data: access is
  explicit, scoped, time-limited and audited (#5260).
- A manager cannot grant a permission they do not hold (#5302), and
  administrator roles and row actions are hidden from non-administrators (#5314).
- The clinical-trial sponsor export is pseudonymised and has its own
  permission (#5298).
- Hospitals choose who may edit payment settings, management is told of every
  change, and payment-provider credentials are kept out of generic settings
  (#5286, #5267).
- The first administrator enrols an authenticator app at setup (#5316).

- Signing a clinical document needs a fresh step-up, and anyone holding a
  signed print can check it by its QR code (#5241).
- Board updates reach only the sockets of the hospital they belong to, and a
  deactivated account or revoked device loses its live notification stream (#5261).
- Secret references in a hospital's settings are restricted to that
  hospital's own namespace; affected settings are flagged for an
  administrator to re-enter (#5264).
- npm audit high findings in the web app's build tools cleared (#5256), and
  web server dependency updates for four security advisories (#5240).
- SSO sign-ins link to a local account only by a verified email (#5225).

#### Clinical

- Every clinical record type can be signed, by its registered author (#5259).
- The lab receives its order, not the patient's whole visit (#5252).
- A code-blue page is delivered, or the screen says plainly that it was not (#5245).
- The next shift can find a returning patient and reprint the card (#5237).
- The pharmacy journey checks Schedule X records, allergies, look-alike
  sound-alike drugs and doses end to end (#5244).
- The doctor can dictate the consultation; it is transcribed and drafted on
  the hospital's own machine, and the doctor accepts, edits or rejects each
  section before anything is saved (#5258).
- Creating an OPD visit asks for the paper file, and the doctor can start
  without it (#5255).
- Prescriptions and other printed documents use MedBrains Sans, an easy-read
  typeface, as does every screen (#5423, #5448, #5455).

#### Billing and revenue

- Orders done but never billed are found daily and queued for the billing desk (#5251).
- Automatic charges a clinical action cannot post are queued for attention
  instead of being lost (#5246).
- Stock used on a patient is charged, and implants used on no one are queued
  for review (#5265).
- Staff are warned before a pre-authorisation is used up or a room charge
  takes the whole bill (#5270).
- Billing, ward stock and TPA screens show a fault when loading fails, not an
  empty list (#5307).

#### Operations

- Switching off a core module also switches off its API, not only its menu (#5243).
- The OS screen uses less memory: smaller WebKit cache and idle app views closed (#5247).
- The OS data disk is encrypted, with every key accounted for (#5230), and
  extra machines join the main one by approval (#5226).
- Faster web loading: charts, the rich-text editor and language packs load
  only when needed (#5229, #5231), and half as much JavaScript at startup (#5311).
- Every report read is bounded, so a heavy report cannot slow the wards (#5271).
- A paperless meter shows how paperless the hospital is, by department and
  day, inside the reports module (#5269, #5321).
- The desktop app is the MedBrains client for any hospital, with signed
  updates (#5305).
- The OS: Kanidm is its identity provider (#5242, #5317), updates are signed
  A/B images with trial boots and rollback (#5279), host logs can be archived
  and NIC/NPL time sources are used (#5280), io_uring is limited to one group
  (#5281), and its shell uses the MedBrains design system (#5422).
- The retired r8r automation engine and its tables are removed (#5415, #5417).
- The attach deploy fails if install.sh fails, and says how to finish (#5454).

### Upgrade notes

- New database migrations apply automatically when the server starts; take a
  backup first.
- After upgrading, check notifications: a hospital whose email or AI settings
  name a secret in an old format is asked to re-enter it (#5264).
- Hospitals that bill a module at the counter can leave its automatic charges
  off; the unbilled-orders check skips those modules (#5251).
- Migration 1455 drops the seven `automation_*` tables of the retired r8r
  engine. Nothing reads them; export them first if you want a copy (#5417).
- Production must set its own sealing key; the server no longer falls back
  to the development key outside development (#5479).

### The hospital system

- Clinical, administrative and financial modules for a multi-tenant hospital:
  registration and UHID, OPD with token queues, IPD and discharge, laboratory,
  radiology with PACS worklists, pharmacy with NDPS and schedule controls,
  billing with online, UPI QR and card-machine payments behind one
  provider-neutral layer, HR, and many more (see `FEATURES.md`).
- One case sheet per patient, signed clinical documents, and printing with
  signatures and DRAFT marks.
- India integrations: ABDM M1–M3 (ABHA, linking, consented record exchange),
  Scan & Share, NHCX eligibility, pre-auth and claims, UHI. FHIR bundles are
  checked against the official HL7 validator before they are sent.
- Web app, native iOS and Android staff and patient apps, and TV boards.

### The hospital OS foundations

- **Kernel** (`medbrains-kernel`): one facade for tenant-scoped work,
  three-outcome authorisation, the hash-chained audit log, events,
  configuration, sequences and storage, with an Admin → Kernel health page.
  App crates are held to the kernel boundary by a CI check.
- **Health services** (`medbrains-health-services`): patient identity and
  consent for a purpose, above the kernel, which is now technical only. If you
  used `kernel::patient`, `kernel::consent` or
  `kernel::authz::require_patient_access`, import them from here.
- **SOP flows**: discharge runs as a configurable track that hospital flow
  designers can change, with safety signals that cannot be switched off.
- **Knowledge change sets**: drug interactions and critical values change
  through preview, apply, roll back and proof, with two-person approval.
- **Connected apps and the extension protocol v1**: hospitals register and
  approve vendor apps that sign in with OAuth client credentials, read FHIR
  under exactly the permissions granted, receive signed webhooks, and are cut
  off on revocation. Published protocol, manifest schema, TypeScript SDK with
  the `medbrains ext` CLI and conformance suite, and a Python SDK.

### Security and operations

- Row-level security on every table holding hospital data; the app connects
  as a non-owner database role.
- Append-only audit of every change, refusal, failed sign-in and PHI read,
  partitioned by month.
- Security and health intelligence: the install is watched continuously
  (host checks, advisories) and notifiable counts are shown against the
  hospital's usual.
- Backups can be sealed to an offline key; restore drills prove them.
  Sealing must be configured per install.
- Crash reports to a self-hosted Rustrak with patient data scrubbed out.
- Dependency audits (`cargo audit`, `cargo deny`, `pnpm audit`) as CI gates,
  with every accepted risk carrying a reason and an expiry.
- Release artefacts are signed (cosign, keyless) and ship with SBOMs,
  SHA-256 checksums and build provenance.
- The standalone installer turns on automatic Debian/Ubuntu security updates
  for the host.

### Licence

- GNU AGPL-3.0-only, or a commercial licence (see `COMMERCIAL-LICENSE.md`).
  Versions released before 2026-11-12 were Apache 2.0. The client SDKs are
  Apache 2.0.
