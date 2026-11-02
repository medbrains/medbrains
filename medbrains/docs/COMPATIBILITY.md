# The MedBrains compatibility promise

**We don't break extensions.** Hospitals, vendors and developers build on MedBrains. A change
that stops their work running is our bug, not their problem. This is Linux's one hard rule
("we don't break user space") applied to a hospital OS (OS-PLATFORM-LESSONS.md, lessons 1, 2
and 6; OS-PRINCIPLES.md §4, stable interfaces).

This document says what is promised, for how long, and what is not covered. It is project law
alongside ENGINEERING.md: a change that breaks it needs a new major version, as below.

## 1. Versions

MedBrains uses [Semantic Versioning 2.0](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Change | Version |
|---|---|
| Bug and security fixes, nothing else changes | PATCH (1.0.**1**) |
| Something added that cannot break anything built on a covered interface: a new endpoint, a new readable resource, a new event, a new optional manifest field, a new kernel function | MINOR (1.**1**.0) |
| Anything that can break something built on a covered interface | MAJOR (**2**.0.0) |

There is one product version. It lives in `medbrains/Cargo.toml` (`[workspace.package] version`)
and is repeated in `medbrains/package.json` and `medbrains/apps/web/package.json`;
`make release` refuses a release where they differ. Pre-releases are `1.1.0-rc.1`,
`-beta.N`, `-alpha.N` and carry no promise.

## 2. What is covered

| Interface | Where it is defined | Versioned by |
|---|---|---|
| **Extension protocol** | [`extensions/PROTOCOL.md`](extensions/PROTOCOL.md) — token endpoint, error codes, status meanings, webhook format and signature | the protocol version (`manifestVersion`), today **1** |
| **Manifest schema** | [`extensions/manifest.schema.json`](extensions/manifest.schema.json) and the registration rules in PROTOCOL.md §3 | the protocol version |
| **APIs extensions use** | the endpoints listed in PROTOCOL.md §4 ("Endpoints in v1"), FHIR R4 as published in `/api/fhir/metadata` | the protocol version; FHIR R4 itself is HL7's |
| **SDKs** | `@medbrains/sdk` (TypeScript, with the `medbrains ext` CLI) and `medbrains-sdk` (Python) | their own SemVer; the **major equals the protocol version** they speak (SDK 1.x speaks protocol v1) |
| **Kernel interface** | the public items of the `medbrains-kernel` crate: `work`, `begin`, `Tx`, `Actor`, `authorize`, `Outcome`, `require_permission`, `require_any_permission`, `audit`, `events`, `config`, `seq`, `store`, `health` (RFC-HOSPITAL-OS §3.2) | the product version |
| **Conformance suite** | `medbrains ext test` (§5) | the protocol version: a suite only gets stricter in a new major |

Two kernel modules are not covered: `kernel::patient` and `kernel::consent`. RFC-HOSPITAL-OS §3a
moves them out of the kernel into health services. They will move with a deprecation notice,
not a silent break, but code should not treat their kernel path as permanent.

The product and the protocol move separately on purpose. MedBrains 1.4 and 2.0 can both speak
protocol v1; a new protocol major is a much rarer event than a new product major.

## 3. How a breaking change happens

A breaking change to anything in §2 needs all three:

1. **A new major version** — of the product for the kernel interface; of the protocol (and the
   SDKs' major) for the protocol, manifest and extension APIs.
2. **A deprecation notice at least 6 months before** the old behaviour stops: in the CHANGELOG,
   in the release notes, in PROTOCOL.md, and — where it can be — in the running system
   (a `Deprecation`/`Sunset` header on the API, a warning from `medbrains ext validate`).
3. **The previous major kept working at least 12 months after the new one ships.** A new
   protocol major is served side by side with the old one for that window (PROTOCOL.md §2). A
   new product major keeps getting security fixes for that window (§4).

Never in a minor or patch: removing or renaming a field, endpoint, event or function; changing
what a status code or error means; making an optional field required; narrowing what a token or
permission allows in a way an extension relying on it would see. Security fixes are the one
exception, and only when there is no compatible fix: a hospital's safety comes before an
extension's convenience. Such a fix is called out in the release notes and the advisory.

## 4. End-of-support dates

Each major gets a published end-of-support date, so a hospital buying hardware or signing a
vendor contract can plan (OS-PLATFORM-LESSONS.md lesson 6). Until that date it gets security
fixes on the timelines in [`SECURITY-RELEASE-PROCESS.md`](SECURITY-RELEASE-PROCESS.md).

| Major | Released | Security fixes until | Status |
|---|---|---|---|
| **1.x** | on the v1.0.0 tag | **proposed:** 12 months after 2.0.0 ships, and never before **2029-12-31** | proposed — the owner confirms before v1.0.0 |
| **Protocol v1** | with MedBrains 1.0.0 | **proposed:** 12 months after protocol v2 ships, and never before **2029-12-31** | proposed — the owner confirms before v1.0.0 |

Only the latest minor of a supported major gets fixes: 1.3 is fixed by shipping 1.3.1 or 1.4.0,
not 1.2.5. Hospitals move within a major freely, because nothing in §2 breaks inside one.

## 5. The compatibility test suite

A promise only holds if a test enforces it (OS-PLATFORM-LESSONS.md lesson 2). The suite lives in
`medbrains/packages/sdk/src/conformance.ts` and runs through the CLI:

```sh
npm install -g @medbrains/sdk          # or: npx medbrains ext test
medbrains ext test                     # against the built-in mock
MEDBRAINS_CLIENT_ID=… MEDBRAINS_CLIENT_SECRET=… MEDBRAINS_PATIENT_ID=… \
  medbrains ext test --url https://sandbox.hospital.example
```

It runs in the directory holding your `medbrains.manifest.json` and checks:

| Check | Against |
|---|---|
| the manifest is valid, with the server's own rules | both |
| `/api/fhir/metadata` is public | both |
| an unsupported grant type is `400 unsupported_grant_type`, `Cache-Control: no-store` | both |
| a wrong secret is `401 invalid_client` | both |
| the client credentials get a token | both |
| a call without a token is `401` | both |
| a read the manifest was not granted is `403` (least privilege) | both |
| a Patient shared with the app reads | both, when a patient id is given |
| webhook signing matches the protocol test vector | mock |
| a delivered webhook verifies; a replayed one (outside 5 minutes) and a tampered one are refused | mock |
| revocation refuses the very next call | mock |

Against a hospital, the token endpoint allows 5 requests a minute per IP; the suite uses 3.

**Who runs it.** Vendors run it before shipping an extension and on every SDK upgrade. Anyone
building another implementation of the protocol — a fork, a hardware kit, a hosted MedBrains —
runs it against their server with `--url`. MedBrains runs it in CI against the mock; running it
against a release server on every tag is the next step.

**"MedBrains Compatible".** The intent is that an extension, server or device may be described as
*MedBrains Compatible* only if it passes the conformance suite for the protocol version it names,
with the results published. The exact wording, the trademark policy and any certification tier
(RFC-HOSPITAL-OS §8g, phase E3) are the owner's decision and are not set here.

## 6. What is not covered

- **The database schema.** Tables, columns, views, enums, migrations and RLS policies change in any
  release. Extensions must never connect to the database; PROTOCOL.md forbids it and the hospital
  never hands out credentials for it. Read through the API.
- **Internal crates and packages.** Every crate other than `medbrains-kernel`, every `@medbrains/*`
  package other than `@medbrains/sdk`, and every internal HTTP route the web and native apps use.
  Internal crates keep version `0.1.0` precisely because they promise nothing.
- **The web and native apps' screens**, URLs and copy.
- **Configuration file formats and environment variables** of the deploy kit: they change with a
  note in the release notes, not a major version.
- **Anything marked experimental, preview or "not in v1"** (PROTOCOL.md §7).
- **Behaviour that was a bug.** Fixing a bug that an extension relied on is not a break — unless
  the fix would harm hospitals running that extension, in which case we treat it as one.
