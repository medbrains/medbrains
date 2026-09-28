# RFC — MedBrains as a sold platform: binding, editions, 2-day go-live, fleet control

**Status:** Draft for decision · **Date:** 2026-09-28 · **Extends:** `RFC-MANAGED-SERVICE.md` (accepted
direction: control plane vs application plane, pool/silo tenancy, subscriptions, suspend gate),
`RFC-ONBOARDING-PROVISIONING.md`, `RFC-NATIVE-MOBILE.md`

## Why

The product owner's goal (2026-09-28): hospitals, clinics and labs buy MedBrains by **facility type and
modules**, are **live within two days** of signing, reach it from **one web address and one store app
per audience** by binding to *their* hospital and signing in with *their* login — securely — whether we
host them or they run it on **their own bare metal**; and **we** see and update every customer from one
**control panel**.

## What exists today (surveyed 2026-09-28)

| Need | Today | Gap |
|---|---|---|
| App/web → which hospital | Server URL compiled into the app (debug override only); web is one host per hospital | No directory, no QR binding, no pinning. Login looks up `username` across **all** tenants, while usernames are unique only per tenant |
| Device trust | `medbrains-device-pairing` (5-min token → keypair → 30-day JWT, admin revoke) | QR is unsigned and carries no server; native apps never call pairing |
| Editions / modules | `tenants.hospital_type` (8 types, no lab-only); `module_config` presets via `/api/setup/edition` | Fail-open; tenant admin can switch their own edition; no plans, prices or subscriptions |
| Licence (bare metal) | none | Nothing signed, no expiry, no limits |
| Provisioning | Hand-run per client (`envs/clients/alagappa`, `make ship-cold`), public sign-up (closed in #4671) | No pipeline, no vetted sign-up |
| Updates on customer boxes | Operator `make apply`; `.prev` binary + `medbrains-rollback`; backup timer | No OS patching, no release channel, no version report |
| Vendor view | none (`/api/health` = up/down, no version) | No fleet, no telemetry, no operator role (tenant `super_admin` is treated as operator in `multi_hospital.rs`) |
| Store apps | Bundle ids `com.medbrains.staff/.patient`; fastlane targets the **old RN** apps | Native lanes, privacy manifest, Data Safety, reviewer demo hospital |

## Architecture

Two planes (RFC-MANAGED-SERVICE §2). The **control plane** is ours, one global service
(`control.medbrains.…`):

- **Directory:** maps a hospital code to its deployment (API base URL, name, logo, certificate
  pin, allowed apps).
- **Licence issuer:** Ed25519 signing key held in KMS.
- **Release channel:** signed release manifests plus artefacts.
- **Fleet telemetry:** heartbeats from every deployment.
- **Plans and subscriptions.**
- **Provisioning pipeline.**
- **Operator console.**

The **application plane** is every deployment. Each one runs in one of three placements:

- **Pool:** our shared cloud, many tenants, RLS. The default for clinics and labs.
- **Silo:** our cloud, one hospital per stack.
- **On-prem:** the hospital's bare metal, with no inbound access needed.

Every deployment runs the same binary, holds a **licence**, and sends a **heartbeat**.

### 1. Binding — how staff reach *their* hospital, securely (app **and** web)

1. The hospital admin opens **Admin → Devices & apps** and gets the hospital's **binding QR / link**.
   The payload is signed by the **control plane's** key:

   ```
   {v, hospital_code, tenant_id, api_base_url, cert_spki_sha256, apps:[staff,patient], exp}
   ```

2. The **app** verifies the signature against the public key compiled into the app. A forged or edited
   QR, for example one pointing to a phishing server, is refused. The app then stores the binding
   (Keychain / Keystore), pins the server certificate, and shows the hospital's name and logo on the
   sign-in screen.
   - Without a QR, staff can type the **hospital code**. The app asks the control-plane directory,
     which returns the same signed binding.
   - For managed devices, the binding can come from MDM managed configuration.
3. **Web:** `<hospital-code>.medbrains.in` (pool/silo) or the hospital's own domain (on-prem). The
   host names the tenant. A generic `app.medbrains.in` asks for the hospital code first and forwards.
4. **Login is always tenant-scoped.** `LoginRequest` carries the tenant from the binding or host, and
   the server looks up `(tenant_id, username)`. This closes the cross-tenant username ambiguity.
5. **Optional device trust.** Shared ward and desk devices run the existing pairing (5-minute token to
   a keypair). A revoked device loses access on its next request (already true).
6. **Revocation.**
   - Bindings expire (`exp`) and are re-fetched from the directory.
   - A hospital that leaves or is suspended is removed from the directory, so new binds fail.
   - Existing sessions follow the subscription gate.

A stranger with the store app and no binding reaches nothing. A stranger who has the binding still needs
a hospital login.

### 2. Editions and modules — priced by facility structure

An **edition** is a facility type with a base module set. **Add-ons** are priced modules on top. The
module list comes from the existing module registry; `module_config` becomes *derived* from the
subscription, and a tenant admin can no longer grant themselves an edition.

| Edition | For | Base modules (initial proposal) | Price axis (to decide) |
|---|---|---|---|
| **Hospital** | IPD hospitals | Registration, OPD, IPD/ward/nursing, billing, pharmacy, lab, radiology orders, OT, emergency, MRD | per bed / month |
| **Clinic** | OPD-only practices, polyclinics | Registration, appointments, OPD/consult, prescriptions, billing, basic pharmacy | per doctor / month |
| **Lab / Diagnostics** | Standalone labs, collection centres | Registration, lab orders, samples, results, reports, billing, home collection | per month + test-volume band |
| **Camp / Outreach** | Camps, community programs | Camp route, registration, vitals, consult, dispensing, offline | per camp-day or per month |
| **Add-ons** | any edition | Blood bank, dialysis, ICU charting, psychiatry, telemedicine, HR, insurance/TPA, ABDM, analytics, AI copilot, patient app | per module / month |

We need a new `hospital_type` value `diagnostics_lab`. Prices live in the `subscription_plan` catalogue
(RFC-MANAGED-SERVICE §3). The operator console edits them; no price is in code.

### 3. Licence — for silos and bare metal

- A **licence file** is signed by the control plane:

  ```
  {licence_id, tenant_code, edition, add_ons[], limits:{beds, users, sites}, issued, not_after, grace_days, deployment_id}
  ```

- The server verifies it **offline** at start and daily, using the public key compiled in, so
  air-gapped sites work.
- It **drives `module_config`**: an add-on that isn't licensed is `disabled`.
- **Renewal:** a new file arrives automatically over the heartbeat, or by hand upload for air-gapped
  sites.
- **Expiry behaviour** is a product decision (see Decisions). The rule that stays regardless:
  **clinical care is never blocked** (registration, orders, MAR, results, code blue).
- The same check runs in pool and silo. There, the licence is simply the subscription.
- Note: the code is AGPL, so a licensee *may* strip the check. The commercial licence and contract are
  the enforcement; the check makes compliance the default and shows the terms to the admin.

### 4. Two-day go-live — the provisioning pipeline

The operator console runs one pipeline per new customer. Every step is idempotent, logged and
resumable. Day 1 is the first 5 steps; day 2 is the last 4.

1. **Contract → plan:** choose edition, add-ons, placement and region (India for ABDM).
2. **Provision:**
   - Pool: create a tenant row (minutes).
   - Silo: Terraform from `hospital-package` via a CI runner.
   - On-prem: generate an installer bundle and licence; `install.sh` on the box.
3. **Seed by edition:** roles, departments, services, sequences and module set from the edition
   template.
4. **Import masters:** Excel templates for staff, doctors, tariff and drug formulary (the onboarding
   wizard's existing import).
5. **Bind:** generate the binding QR, DNS/TLS and web subdomain; enable the store apps for the tenant.
6. **Automated acceptance:** run the journey suites (Playwright web + native staff smoke) against the
   new tenant with provisioned test identities. Go-live is blocked until they pass.
7. **Training sandbox:** a copy with synthetic patients.
8. **Go-live checklist:** backup verified, restore drill passed, uptime check live, licence valid,
   admin handed over.
9. **Hypercare:** 7 days of heightened alerts in the console.

### 5. Updates — OS and application on every placement

- **Release channel:**
  - Signed release manifests (version, artefacts and hashes, migrations, minimum version, notes).
  - Channels `stable` / `early`.
  - The server reports its version.
- **Update agent** (systemd service on silo and on-prem):
  1. Checks the channel.
  2. Downloads and verifies the signature.
  3. Takes a **pre-update backup**.
  4. Applies the update in the approved window.
  5. Runs migrations.
  6. Health-checks.
  7. **Rolls back automatically** on failure, using the existing `.prev` + `medbrains-rollback`.
  8. Reports the result.
- **Air-gapped sites:** the same bundle as a signed file for USB.
- **OS:** security-only unattended upgrades in the maintenance window, a reboot-required flag, and
  kernel/OpenSSL/Postgres versions all reported to the console.
- **Pool/silo:** we roll out ourselves, per tenant ring (internal → early → stable).

### 6. Control panel — ours

A separate operator web app. Only the new `platform_operator` role can use it, and it can't be granted
by a tenant.

- **Fleet:** every deployment with placement, version, last heartbeat, health, backup age, cert
  expiry, OS patch state, licence expiry and usage (beds, users, active patients). Heartbeats are
  counts only, never PHI.
- **Customers:** plans, add-ons, prices and subscriptions; issuing and renewing licences.
- **Onboarding:** the provisioning pipeline per customer with step status.
- **Releases:** publish, staged rollout, pause, and version drift.
- **Apps:** store app versions, which hospitals have apps enabled, and binding QR re-issue.
- **Alerts:** down, backup stale, cert near expiry, licence near expiry, update failed.

### 7. Terraform and cost hygiene

- **AWS spend:** $161 in Aug, about $54 in Sep, on one t4g.large with a Compute Savings Plan to
  2027-08-31.
- **Remove dead Terraform:**
  - `envs/dev` (EKS + Aurora + NAT, never applied, about $100+/month if applied by mistake).
  - Modules no env uses (`website`, `headscale`, `bridge-ingress`, `spicedb`, `observability`,
    `patroni-cluster`).
  - `.bak` and stale plan files; README references to non-existent envs.
- **Keep:** `hospital-package`, `standalone-vm` tiers, `envs/clients/*` and the on-prem tenant
  template. These become the silo and on-prem paths of the pipeline.
- This is a shared institutional account: never touch non-MedBrains resources.

## Phases (each a PR through the full gate; each ends on a screen)

| Phase | Delivers | Surface |
|---|---|---|
| **P0** ✅ | Close public registration (#4671) | Onboarding "registration closed" |
| **P1** | Tenant-scoped login + control-plane directory + signed binding QR/code; web by host | Admin → Devices & apps (QR); app & web "Choose your hospital" |
| **P2** | Editions + plans catalogue + subscription → `module_config` (fail-closed), `diagnostics_lab` type | Operator: plans; tenant: read-only "Your plan" |
| **P3** | Licence file: issue, verify offline, expiry behaviour | Admin → Licence; operator: licences |
| **P4** | Heartbeat + operator console (fleet, customers) + `platform_operator` role | Operator console |
| **P5** | Release channel + update agent + OS patching + rollback | Admin → Updates; operator: releases |
| **P6** | Provisioning pipeline + automated acceptance → 2-day go-live | Operator: onboarding pipeline |
| **P7** | Store readiness: native fastlane lanes, privacy manifest, Data Safety, reviewer demo hospital | Store listings |
| **Hygiene** | Terraform dead-code removal (anytime) | — |

## Decisions (product owner)

Decided 2026-09-28:
1. **Licence expiry:** grace, then an admin-only lock.
   - 30 days of warnings before expiry, then 30 days of grace.
   - After that, settings, new users and add-on modules stop.
   - **Clinical care never stops.**
2. **Updates on bare metal:** **pull**. The hospital's server checks our signed channel, their admin
   picks the maintenance window, OS security patches install automatically, and air-gapped sites get
   a USB bundle.
3. **Placement:** **both**, chosen per customer at contract. Shared cloud (pool) or a dedicated server
   (silo) for anyone; bare metal for hospitals that want it.

Still open:
4. **Price axis per edition** (table above), and the prices themselves. Needed before P2.
5. Delete the dead Terraform (§7). This was the user's original ask ("cost saving and deletion").
6. Deploying #4671 to production: **held by the user** (2026-09-28).
