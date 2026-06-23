# RFC — Onboarding & provisioning (two audiences: IT vs business)

**Status:** Accepted (direction) · **Date:** 2026-06-23 · **Relates to:** SSO RFCs, `project_sso_ad_groups`

## The core principle (user)

> "Only the IT team will do the technical part; business users should have it easy
> and simple." · "They are not technical users." · "Predefined." · "Excel and other
> data, first-user roles." · "Custom domains."

So **two completely different audiences**, two orchestration tiers:

| | **IT / Ops tier (technical)** | **Business tier (hospital admin — NON-technical)** |
|---|---|---|
| Who | The deploying IT team / vendor ops | A hospital administrator, no technical skill |
| Does | Stand up infra + the org | Fill in the hospital's actual setup |
| How | **Terraform** (infra) + bootstrap **seed** + **custom domain** | The **existing 16-step onboarding wizard**, kept dead-simple, with **predefined defaults** + **Excel/CSV import** |
| Mode | dev / demo / prod | same tenant, post-provision |

## How the big players do it (and what we borrow)

**AWS (cloud tenant/account provisioning):**
- **Organizations + OUs** — a hierarchy of accounts; isolation per customer.
- **Control Tower + Account Factory** — new accounts are minted from a **templated
  landing zone** (IaC: Service Catalog / Terraform), with **guardrails** + a baseline
  pre-applied. Provisioning = IaC-driven, *not* hand-clicked.
- **Self-serve front + IaC back** — a request form/wizard triggers the templated
  Terraform under the hood. Separation: platform team owns the factory; app teams
  consume it.
→ We borrow: **Terraform "account factory" for org/tenant infra** with a baseline
  seed + guardrails (our prod-strict mode). The business wizard is the self-serve
  front; Terraform is the back.

**Epic / Cerner (big-hospital EHR onboarding):**
- **Foundation / Model System** — Epic ships a **pre-built, best-practice configured
  "Foundation System"** the hospital **tailors**, instead of building from a blank
  slate. Cerner ships a "model" reference. This is *the* industry answer to "non-
  technical, predefined."
- **Build vs operational config split** — certified analysts/IT do the technical
  build; department leads supply operational content (order sets, services, tariffs).
- **Bulk data migration** — masters/patients loaded via ETL / spreadsheets / HL7,
  not typed.
- **Phased go-live** — build → validate → train → staged go-live; never big-bang.
→ We borrow: a **"Foundation System" = predefined templates** the admin tweaks;
  **IT-vs-business/clinical split**; **Excel/CSV bulk load**; **staged completion**.

The user's instincts (predefined, Excel-seeded, IT-vs-business-simple, staged)
*are* the industry pattern. This RFC encodes them for MedBrains.

## Tier 1 — IT/Ops (Terraform + seed + custom domain)

`terraform apply` produces a working end-state (the project's automation principle):
infra (DB, KMS, DNS/**custom domain**, networking) + an empty tenant + the first
admin, then triggers the app's **bootstrap seed** (built-in roles, base masters).
Modes:
- **dev** — local, fixtures, relaxed creds (single tenant).
- **demo** — a populated demo tenant (`seed/demo_patients`) for trials/sales.
- **prod** — clean + strict (`MEDBRAINS_ENV=production` already refuses default creds,
  forces password change).

**Custom domains:** per-tenant white-label hostname (e.g. `hms.hospital-x.org`).
IT-tier: DNS + TLS cert (proxy) + a `tenants.custom_domain` mapping for host→tenant
resolution (also unblocks pre-auth SSO tenant resolution + VPN-internal URLs). The
white-label hospital-name header already exists (#3327); this is the domain layer.

## Tier 2 — Business onboarding (ALREADY BUILT — enhance, don't rebuild)

Exists today: `apps/web/src/pages/onboarding/` (Welcome, Hospital, GeoRegulatory,
Branding, Facilities, Locations, Departments, Modules, Sequences, Services,
BillingTax, BedConfig, Users, Admin, Review) on a Mantine `Stepper`, backed by
`routes/onboarding.rs` (`/onboarding/status`, `/onboarding/init`) +
`onboarding_progress` table; `CsvImportModal` exists for bulk import.

**Enhancements for non-technical users (the gaps):**
1. **Predefined defaults everywhere** — every step pre-fills sensible, regulation-
   aware defaults (the 11 built-in roles already seed; extend to departments,
   services, sequences, bed types, tax). The admin *confirms/tweaks*, never starts
   blank. "Start from a template" per hospital type (general / specialty / clinic).
2. **Excel/CSV import per data-heavy step** — wire `CsvImportModal` into Departments,
   Locations, Services, Users (+ a downloadable template per entity). Hospitals
   already have this data in spreadsheets; typing it is a non-starter.
3. **Simplicity pass** — plain language, one decision per screen, progress + "you can
   finish this later", skip-and-complete-later (ties to staged settings below).
4. **First users & roles** — UsersStep/AdminStep assign the built-in roles by picking
   a person + a role from a friendly list (no permission matrices for business users;
   that's IT/advanced).

## Configuration scopes — route the right config to the right owner

Config isn't one bucket; it has scopes with **different owners** (maps to the
7-layer config Global→Tenant→…→User). The wizard/settings route each to the right
person so a non-technical admin never sees IT/clinical internals:

| Scope | Examples | Owner | Tier |
|---|---|---|---|
| **App / system** | env, KMS, custom domain, modules, integrations, edge | IT team | technical |
| **Business** | branding, billing/GST/TPA, **setup costs / tariffs / charge master**, payment methods, sequences | Hospital business admin | simple |
| **Clinical** | departments, services, bed types, drug formulary, lab catalog, protocols, critical-value rules | Clinical lead / pharmacist | guided |
| **User** | individual prefs (locale, units, theme) | each user | self-serve |

Onboarding presents only the **business + clinical essentials** to the admin;
app/system scope stays with IT; user scope is per-login.

## Excel template flow (download → fill → upload) — the non-technical data path

For every data-heavy entity the hospital already keeps in spreadsheets, the pattern is:

1. **Download a template** — a pre-formatted Excel/CSV with the exact columns + an
   example row + (where relevant) **predefined rows** to edit rather than start blank.
2. **Hospital fills it** offline (their existing data: departments, services, staff,
   **setup costs / tariffs**, drug list, lab tests).
3. **Upload** → `CsvImportModal` validates (clear per-row errors, downloadable
   error report) → preview → commit. Idempotent re-upload.

Entities with a template: departments, locations, services, **charge master / setup
costs & tariffs**, staff/users, drug formulary, lab catalogue. This is THE primary
data-entry path for non-technical onboarding — typing is the exception.

## Staged settings ("basic now, complete later")

Onboarding captures only the **essentials** to operate; the full settings hub (31
tabs) is for progressive completion, surfaced by a **readiness tracker**
(`onboarding_progress` + the existing `MasterDataStatusSettings` "readiness map").
A "Finish setup" checklist on the dashboard nudges remaining items.

## Immediate orphan fix

`/admin/sso` exists but isn't linked → add SSO to the admin nav (peer to Roles/Groups,
`admin-sso` SCREENS entry) and as an onboarding/settings item. Identity config is
business-tier-simple (pick IdP, paste discovery URL, map AD groups → roles).

## Concrete gaps to build (focused PRs)

1. **Link SSO** into admin nav + SCREENS + i18n. *(small, now)*
2. **Excel/CSV import** wired into Departments/Locations/Services/Users onboarding
   steps + downloadable templates.
3. **Predefined templates** — per-hospital-type seed presets the wizard pre-fills.
4. **Custom domains** — `tenants.custom_domain` + host→tenant resolution + proxy TLS.
5. **Staged "finish setup" checklist** on the dashboard (readiness).
6. **Terraform org module + dev/demo/prod** (IT tier) — separate ops PR.

## Out of scope

Operating the IT-tier infra (the deployment's Terraform/Keycloak), and the SAML
bridge (separate RFC).
