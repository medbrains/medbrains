# Changelog

All notable changes to MedBrains are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); what each part of the version
promises is in [`medbrains/docs/COMPATIBILITY.md`](medbrains/docs/COMPATIBILITY.md).
Security fixes follow [`medbrains/docs/SECURITY-RELEASE-PROCESS.md`](medbrains/docs/SECURITY-RELEASE-PROCESS.md).

The release workflow publishes the section for the tagged version as the
GitHub release notes, so write each section for a hospital IT team.

## [Unreleased]

### Licence

- MedBrains is now dual-licensed: GNU AGPL-3.0, free for everyone, or a commercial licence for vendors who sell, host or embed it without sharing their changes. Versions released before 2026-11-12 stay under Apache 2.0. The client SDKs stay under Apache 2.0.

## [1.0.0]

The first versioned release. Everything before it was built on `main`
without version numbers; this section summarises what 1.0.0 contains.

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
- Backups sealed to an offline key, with restore drills that prove them.
- Crash reports to a self-hosted Rustrak with patient data scrubbed out.
- Dependency audits (`cargo audit`, `cargo deny`, `pnpm audit`) as CI gates,
  with every accepted risk carrying a reason and an expiry.
- Release artefacts are signed (cosign, keyless) and ship with SBOMs,
  SHA-256 checksums and build provenance.
- The standalone installer turns on automatic Debian/Ubuntu security updates
  for the host.

### Licence

- Apache License 2.0.
