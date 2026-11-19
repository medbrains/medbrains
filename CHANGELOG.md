# Changelog

All notable changes to MedBrains are recorded here. Versions follow
[Semantic Versioning](https://semver.org/); what each part of the version
promises is in [`medbrains/docs/COMPATIBILITY.md`](medbrains/docs/COMPATIBILITY.md).
Security fixes follow [`medbrains/docs/SECURITY-RELEASE-PROCESS.md`](medbrains/docs/SECURITY-RELEASE-PROCESS.md).

The release workflow publishes the section for the tagged version as the
GitHub release notes, so write each section for a hospital IT team.

## [Unreleased]

## [3.33.2] - 2026-11-14

**This release contains everything in 3.33.1, plus the fixes below.** 3.33.1 was
tagged but never published: its desktop builds failed, so it was replaced by this
release rather than re-tagged. If you are updating from 3.33.0, also read the
[3.33.1 notes](https://github.com/medbrains/medbrains/blob/v3.33.2/CHANGELOG.md). They include a backup-key step that installs set up with a kit
older than 3.33.1 must do.

### Fixed
- **The desktop apps build again.** The desktop notification plugin's Rust and
  JavaScript parts had drifted to different versions, and the build refuses that.
  They now match (#5677).
- **The eye exam form checks the axis and cylinder together.** An axis without a
  cylinder, or a cylinder without an axis, is now marked on the form before saving,
  instead of being refused by the server after the doctor pressed Save (#5663).

### Added
- **Documentation home page.** docs.medbrains.in now opens on a page that starts
  from your role (front office, doctor, nurse, pharmacy, lab, billing, hospital IT,
  developer), with common tasks and every chapter one click away (#5675).
- **Acknowledgements.** `ACKNOWLEDGEMENTS.md` thanks the open-source projects
  MedBrains is built on and the standards and ideas that shaped it (#5666).

### Changed
- The docs site footer names the GNU AGPL-3.0 licence (it still said Apache 2.0) (#5679).
- The README shows the error-tracking badge (#5664).

## [3.33.1] - 2026-11-14 (tagged, not released; replaced by 3.33.2)

A security update to 3.33.0, released early under the 7-day rule for high-severity
fixes in [`SECURITY-RELEASE-PROCESS.md`](https://github.com/medbrains/medbrains/blob/v3.33.1/medbrains/docs/SECURITY-RELEASE-PROCESS.md).
Update every install. Installs set up with a kit older than 3.33.1 must also
rotate their backup key (below).

### Security

- **Backups are sealed to the hospital's own key.** Older deploy kits installed
  the MedBrains project's own public key on every host, so those backups were
  sealed to a key the hospital does not hold. The kit now ships no key: a first
  install makes a keypair for the hospital (move the private key offline, as
  the install banner says) or takes yours from `BACKUP_AGE_RECIPIENT`. Backups
  to a local directory are now sealed too; before, they were written
  unencrypted. The backup job refuses to run without a key. A host still on
  the old key keeps backing up, warns in `journalctl -u medbrains-pg-backup`
  and shows a warning on **Admin → Settings → System health** (#5597).
  **What to do on an existing install:** follow
  [Rotate the backup key](https://github.com/medbrains/medbrains/blob/v3.33.1/medbrains/deploy/standalone/README.md#rotate-the-backup-key):
  make a key offline, re-run `install.sh` with `BACKUP_AGE_RECIPIENT='age1…'`,
  start one backup, check System health no longer warns, and run the restore
  drill with the new key. Backups taken before the rotation stay sealed to the
  old key; keep them until the new ones have passed the drill.
- **Sign-in and one-time codes.** An authenticator code is accepted once only.
  Wrong codes when turning off two-factor sign-in count toward the account
  lockout. Codes are compared in constant time everywhere. A device pairing
  token can pair one device only, even when two use it at the same moment.
  First-admin setup no longer skips the authenticator step when it cannot
  check the disk's identity provider (#5591).
- **Limits on code requests.** Patient portal sign-in, public booking codes and
  password reset codes are limited per client address and per account or
  mobile; past the limit the answer is the same as before, so the limit reveals
  nothing. Wrong booking codes now count toward that code's attempt limit
  (#5587, #5588, #5589).
- **Signatures recorded as OTP are refused.** Consent and document signatures
  can no longer be stored with method `otp`, because no code is sent or
  checked for them; the consent screen no longer offers it. Existing records
  are unchanged (#5590).
- **Dependency fixes.** The Android app uses Bouncy Castle 1.86 (#5578). The
  Android build tools' own Bouncy Castle and Guava copies, which are not
  shipped in the app, are raised to fixed versions, clearing
  GHSA-9pwp-9qqc-pr26, GHSA-qp49-qgx5-5m26, GHSA-cj8j-37rh-8475 and
  GHSA-xxph-c9ww-hj94 (#5583). Rust dependencies take their patch and minor
  updates (#5577).

### Added

- **Container image.** `ghcr.io/medbrains/medbrains:3.33.1` for x86-64 and arm64, signed with cosign. The 3.33.0 image did not build because its Dockerfile used an outdated Rust toolchain. The Dockerfile now follows the pinned toolchain, and CI checks that the two match and builds the image whenever either changes (#5572).
- **`medbrains-proxy` in the server tarball.** The 3.33.0
  `medbrains-server-bins-linux-*.tar.gz` lacked it, so `install.sh` could not
  finish from the release. CI now checks the tarball holds every binary
  `install.sh` installs (#5598).
- **OS hardening.** OS services are confined with AppArmor. The image is scored against the CIS benchmark, and the console shows boot health (#5453).
- **Download page** on the website, listing every OS image, the desktop clients, the Android staff app and how to verify a download (#5570).

### Changed

- **The IT security officer role can view and manage backups.** It sees the backup card on **Admin → Settings → System health**, so it can check that backups run and are sealed to the hospital's key. Existing installs get this on the next server restart (#5656).
- **Release calendar.** A monthly patch day, quarterly feature releases and
  yearly majors; security fixes still ship on their own deadlines
  ([`COMPATIBILITY.md`](https://github.com/medbrains/medbrains/blob/v3.33.1/medbrains/docs/COMPATIBILITY.md), #5579).
- **Offline signing-key design** for OS updates. Every intermediate key, revocation list and root change needs two of three root keys, and no single stolen key can sign an update (#5511).
- Background file reads and writes no longer block the server (#5515).

### Fixed

- The app version check and the OPD vitals screen no longer trip reliability warnings (#5571).

### Already in 3.33.0, missing from its notes

- **Waiting-room screen pairing needs the code shown on that screen.** The admin types the 8-character code from the screen to approve it. Pending codes are never listed, and each request belongs to one hospital: open the screen at `/screen?hospital=<code>`, or scan the QR code on Admin → Paired devices. The flow pairs display screens only. Screens already paired keep working (#5560).
- **The old React Native TV app (`apps/tv`) cannot pair.** It is reference-only and unsupported. Open `/screen?hospital=<code>` in the TV's browser instead.

### Not in this release

- The patient app waits for run-time hospital configuration (#5569).
- Sealing the OS system partition (dm-verity) waits for its update-unlock fix.
- How invitation and verification links choose their address waits for a
  decision on hospitals with their own domains.
- A verified OTP flow for consent signatures; until then OTP is not offered.
- Installs through the terraform modules cannot pass `BACKUP_AGE_RECIPIENT`
  yet; they make the key on the server, so move it offline as the banner says.
- The larger dependency moves (Kotlin 2.4 with AGP 9.5 and Compose, and major
  Rust updates such as tower-http 0.7, jsonwebtoken 11 and totp-rs 6) each come
  in their own release.

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

#### Merged on 2026-11-12 and 2026-11-13

##### Licence

- Every page says AGPL-3.0-only, and hospitals on the free licence can buy
  support and service levels without a commercial licence (#5484).
- Contributions need a signed contributor licence agreement, and a trademark
  policy says how the MedBrains name and logo may be used (#5485).
- A written pledge: the source of every release stays public in this
  repository, never behind a login or customer portal (#5504).

##### Security

- The development database password is no longer written into three scripts
  (#5488), and the code analysis now reports on exactly the code it reads (#5489).
- A security fix for rustix, and four code-scanning findings closed (#5490).
- The k3s cluster join token and admin kubeconfig are no longer readable by
  every user on the server (#5492).
- Android release builds have no plain-HTTP default server (#5494).
- On bare-metal installs, the database cluster's etcd runs on TLS with client
  certificates (#5495).
- Offline sign-in fails safe: the offline permission and revocation caches
  move to the maintained redb store, and after the upgrade a device refuses
  offline sign-in until it has synced revocations once online (#5493).
- Supply chain: every build uses its lock file, every new package is
  reviewed, and a new dependency version must be a week old before it is
  taken, security fixes excepted (#5512).

##### Clinical and IPD

- A clinical list that fails to load says so, instead of looking empty (#5481).
- A high-alert dose (insulin, heparin, potassium) can be given only by someone
  holding `nurse.mar.administer_high_alert`, and its second check signed only
  by someone holding `nurse.mar.witness`. Before, any signed-in user could
  witness it and an administrator account could be recorded as the giver
  (#5528, #5540).
- A bed cannot be held for two patients, while occupied or until a time
  already past; restraint checks and birth records refuse impossible values
  (#5533).
- If the ward cannot be read when a patient is admitted, the care-team grant
  fails with an error instead of silently leaving the ward nurses without
  access to the admission (#5538).
- The access matrix and a patient's OPD history show a fault when loading
  fails, not an empty hospital or "no history" (#5542, #5543).

##### Billing and accounting

- A cashier cannot sign off their own day close, and a checked close cannot be
  checked again (#5523).
- Approving a write-off is checked against the patient whose bill it settles
  (#5522).
- A journal entry must move money: at least two lines, each with one positive
  side, debits equal to credits (#5527).
- A TDS deduction is filed in the quarter its date falls in, and needs a valid
  PAN (#5547).
- Each bank line is reconciled to one receipt: two equal credits on a day can
  no longer claim the same payment, and short credits are held for review
  (#5544).
- Patient deposits and concessions are tested end to end: a deposit pays only
  its patient's bill and the rest is refunded, and a concession is asked by one
  person and approved by another (#5518, #5521).

##### Reliability

- Text typed into forms is shaped without backtracking patterns, so a long
  input cannot freeze the screen (#5506).
- The web app's offline store reports an error, instead of "connecting"
  forever, when the browser refuses its database (#5514).
- Background navigation and refreshes in the web app are marked as deliberate,
  so real unhandled errors stand out (#5497), and the install and deploy
  scripts use safer shell tests (#5507, #5536).
- Lists are tested so that one cannot cost a database query per row (#5483).

##### Operations

- Readiness meters for OS strength, paperless working and AI clinical flows,
  measured from a checklist with evidence, on GitHub and the website (#5551).
- Built with Rust 1.99.1, which fixes a miscompile of FFI `bool` return values
  on x86_64.

#### Downloads

Every release file is listed in `SHA256SUMS`, signed with Sigstore; check a
file against it before you use it. The release page ends with a "Which file
for which device" table.

- **Android:** staff and patient apps, as an `.apk` to install directly and an
  `.aab` for Google Play (#5486).
- **iPhone and iPad:** staff and patient apps, as an `.ipa` for App Store
  Connect, or an unsigned Xcode archive (#5486).
- **Desktop client:** Mac (`.dmg`, Apple silicon and Intel), Windows (`.msi`,
  `.exe`) and Linux (`.AppImage`, `.deb`, `.rpm`) (#5486).
- **MedBrains OS images** (x86-64 and arm64, UEFI only; Intel and AMD both use
  x86-64), all built from the same system image (#5525):
  - a physical machine from a USB stick or DVD: the installer `.iso`;
  - a physical disk written from another computer: `.raw.zst`;
  - Proxmox, KVM, libvirt, OpenStack: `.qcow2`;
  - VMware ESXi, vSphere, Workstation, Fusion: `.ova` (x86-64);
  - Hyper-V generation 2: `.vhdx` (x86-64);
  - Azure: `-azure.vhd.zst`, unpacked first (x86-64);
  - AWS: import the `.vmdk` (x86-64) or the unpacked `.raw.zst` (arm64) as a
    snapshot, then register it with UEFI boot and TPM 2.0.

  Give a virtual machine a virtual TPM 2.0, or setup asks before it stores
  anything unencrypted. Steps for each are in `medbrains/os/README.md`.
- Server binaries for an existing Linux server, and the web app.

#### Known limits

- The MedBrains OS image is a preview. Do not use it for patient data yet.
- The OS image is not signed for Secure Boot yet.
- The iOS, macOS and Windows builds are unsigned until the signing
  certificates are added; files marked `-unsigned` will not install on iOS, and
  macOS and Windows warn before opening them.
- The OS images have not yet been tested on real VMware, Hyper-V, Proxmox,
  AWS or Azure.

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
- Custom roles whose staff give or witness high-alert doses need the new
  `nurse.mar.administer_high_alert` and `nurse.mar.witness` permissions. The
  built-in nurse role holds both; doctor and pharmacist hold the witness one
  (#5528, #5540).

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
