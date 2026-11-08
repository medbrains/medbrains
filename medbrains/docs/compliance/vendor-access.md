# MedBrains access to a hospital's data

**Status:** built (migration 1420). The DPA schedule at the end is a **draft for the owner's
lawyer**; nothing here is legal advice, and every legal citation below must be checked by counsel
before it is relied on.

## Roles

Under the Digital Personal Data Protection Act 2023 the hospital decides why and how patient data
is processed, so it is the **Data Fiduciary**. MedBrains, when it hosts, supports or maintains the
system, processes that data on the hospital's behalf, so it is a **Data Processor**. The fiduciary
stays responsible for what its processor does (s.8(1)), may use a processor only under a valid
contract (s.8(2)), and must keep reasonable security safeguards (s.8(5)).

The rule that follows, set by the owner: **MedBrains staff touch a hospital's data only with that
hospital's explicit, scoped, time-limited and audited permission.**

## What the system does

| Duty | How it is met | Where |
|---|---|---|
| Off by default | A MedBrains account is refused on every request without a live grant: 403, audited as `vendor_access_refused` (one row per account per minute, carrying how many refusals it stands for). Its role does not matter: `super_admin` and `hospital_admin` lose their bypass, because the account's role is replaced for the request by `vendor_support`, which no check treats as a bypass | `medbrains-server-core/src/middleware/vendor_access/` |
| Which accounts are MedBrains accounts | `users.is_vendor_staff` (never cleared; a trigger refuses it), or an address whose host — the part after the last `@`, trimmed, without a trailing dot — is a MedBrains domain or a subdomain of one (`MEDBRAINS_VENDOR_EMAIL_DOMAINS`, default `medbrains.in`). One SQL definition, `app_email_is_vendor` | migration 1420 |
| Explicit | Only the hospital creates a grant, on Security → MedBrains access, with a step-up (password again) | `medbrains-it-security/src/vendor_access.rs` |
| Named person | The grant names the account by email; it must already exist at this hospital **and already be a MedBrains account**. A grant never turns a hospital colleague into one | same |
| Purpose | A reason of at least 10 characters is required and kept on the grant | same, and a table check |
| Scoped | An **allowlist**. A module scope carries only that module's read codes (`list`, `view`, `read`, `search`). Configuration only adds a named list of master-data edits (departments, locations, facilities, services, clinical masters, bed types, tax, branding). No grant carries a code that makes a credential, opens an outbound channel (webhooks, integrations, messages, campaigns) or sets up something the system runs later (automations, flows, pipelines, retries, restores, system state), nor reads keys, endpoints, raw payloads or the audit log. A new code is excluded until it is added on purpose | `vendor_access/scope.rs` |
| Time-limited | 4 hours by default, 72 at most (also a database check) | migration 1420 |
| Masked by default | Masked unless the hospital chooses otherwise. Keys that are data rather than field names (a map keyed by a name or phone) are renamed `masked_n`; `error` keeps only the server's own error codes. Masking is done on the server by **allowlist**, error bodies included: restricted clinical records are withheld whole, then a value survives only if its key and shape are both safe — a UUID id, a parsable timestamp, a count, an `is_`/`has_` flag, a short enum status or type that the AI redactor's value scan leaves alone. Everything else, under any key (`name`, `patient_label`, camelCase, free text, an age), reads `[MASKED]` | `vendor_access/mask.rs` |
| Files and streams | Refused under **every** grant, masked or not: a file or stream cannot be masked or described by the event row. Streams are refused from their headers, never buffered | same |
| Separation of duty | Unmasked access opens only when a **different** person with `security.vendor_access.approve_unmasked` approves it, with a step-up. The database refuses an approver who asked for it or who is the MedBrains account | migration 1420 check, `approve_grant` |
| Audit | Every request under a grant writes a `vendor_access_events` row **before** the handler runs; if the row cannot be written the request is refused (503). The row is never deleted and takes its status once. Grant changes are on the audit chain by trigger | migration 1420 |
| Visibility | Security → MedBrains access lists every grant, active and past, who gave, approved and ended it, and every request made under it | `apps/web/src/pages/security/medbrains-access/` |
| Stop at once | "End access" revokes the grant; the grant is read on every request, so the next one is refused | `revoke_grant` |
| Isolation | A grant opens one hospital. Its rows are visible only to that hospital, even inside a hospital group | RLS on `app_current_tenant()` |
| Never fail open | If the grant cannot be checked, the answer is 503, never allow and never a 404 that reads as "no such record" | `live_grant` |
| Live streams | The notification socket refuses MedBrains accounts outright: a stream cannot be masked or recorded per request | `medbrains-notifications` |
| Nothing outlives the grant | When an account becomes a MedBrains account, everything it set up is switched off — never deleted — and each is a `vendor_credential_revocations` row on its hospital's audit chain: API keys, connected apps it registered or approved (and their tokens), devices issued to it, webhooks, integration pipelines (paused), connectors (inactive), automation workflows it made or that run as it (off, which silences their inbound webhooks) and its end-of-day digest subscriptions. Migration 1420 does this for existing `medbrains.in` accounts; every server start repeats it for the live domain list (`app_flag_vendor_accounts`, idempotent). At request and delivery time the creator is checked again, by flag or by the live domain rule: a key, connected-app token or device of a MedBrains account is refused, a webhook it set up is not delivered, a pipeline it set up does not run, a connector it set up is not called | migration 1420, `main.rs`, `api_key.rs`, `auth.rs`, `outbox/handlers/webhook.rs`, `kernel/events/gate.rs`, `workflow/orchestration/connectors.rs` |
| A wrong domain list cannot do lasting harm | Flagging is permanent and revokes what an account set up, so the list is checked before anything is flagged. Only a mistake in the list itself stops the boot: a single label or public suffix (`in`, `com`, `co.in`, `gov.in`, `nic.in`, `ac.in`, `edu`, `io`, …), an entry that is, contains or sits under a hospital's own domain (its verified `custom_domain`, or a verified site domain that is not equal to or under a platform domain — `medbrains.in`, `medbrains.localhost` — so MedBrains' own site and the `hospital-x.medbrains.in` sites it issues never count), or a list that would flag more than `MEDBRAINS_VENDOR_BACKFILL_MAX` accounts (default 20). Nothing about one account stops the boot: an account whose flag would leave its hospital with no active administrator of its own is skipped and logged as an error (raised to platform operators through error tracking), and is still refused at request time by the domain rule. `MEDBRAINS_HOSTED=true` only ever adds `medbrains.localhost` | `medbrains_core::vendor`, `app_flag_vendor_accounts`, `main.rs` |
| Flagged when written | The boot stores the live list (`vendor_email_domains`); a trigger flags an account the moment it is created on a vendor domain, so a later onboarding engineer or demo admin is gated and revoked at once, not at the next boot. Moving an existing account's address onto a vendor domain is refused from the application (an administrator renaming a colleague, or anyone renaming themselves), because the flag is permanent; only the platform path (a member of the table owner: migrations, seed, boot) may do it | migration 1420 |
| Not told hospital business | "Tell every holder of a permission", break-glass alerts and push notifications leave MedBrains accounts out | `holders.rs`, `break_glass_notify.rs`, `notification_listener.rs` |
| Fixed once approved | An approved grant's person, scope, masking and expiry cannot change; it can only be ended | migration 1420 trigger |

Permissions: `security.vendor_access.view`, `.grant`, `.approve_unmasked`, `.revoke`. Hospital
admins hold all four through their bypass; the IT security officer holds all four; the medical
superintendent may view and approve unmasked access; the audit officer may view.

## Scenarios (tested in `crates/medbrains-server/tests/vendor_access_test.rs`)

1. **No grant.** Given a MedBrains account with the `hospital_admin` role and no grant, when it
   asks for patients or configuration, then it gets 403, sees itself as `vendor_support` with no
   permissions, and each refusal is on the audit chain.
2. **Masked.** Given a masked grant for `patients`, when the MedBrains person lists patients, then
   the record ids come back and the name and phone read `[MASKED]`, the request is an event under
   the grant, and the person cannot create a grant themselves (403).
3. **Unmasked needs a second approver.** Given an unmasked grant, it opens nothing while waiting;
   the person who asked cannot approve it (403); a different IT security officer can, after which
   the data comes back unmasked.
4. **Expired.** Given a grant past its expiry, the next request is refused and the grant reads as
   expired.
5. **Revoked mid-session.** Given an open session, when the hospital ends access, the very next
   request from that signed-in session is refused.
6. **Other hospital.** Given a grant at hospital A, the same person signed in at hospital B has no
   access there.
7. **Outage.** Given the grant check cannot be answered, the request is 503.
8. **Well-formed.** A short reason, an unknown or ungrantable module, more than 72 hours, an
   unknown account, one's own account, a hospital colleague's (non-MedBrains) account, and a second
   live grant for the same person are all refused; the default is masked.
9. **A key a MedBrains account made** is refused at request time.
10. **Flagging an account** revokes its API key (the row is kept), puts the revocation on the audit
    chain, and the flag cannot be cleared.
11. **An approved grant** cannot have its scope, masking or expiry changed; it can still be ended.
12. **Notifying permission holders** never reaches a MedBrains account, even one with a bypass role.
13. **A webhook** set up by an account on a configured non-default vendor domain is not delivered;
    **a pipeline** a vendor account made does not run while the hospital's own does; **a connector**
    it made is not called; the **start-up back-fill** pauses its pipeline and stops its end-of-day
    digest, audited, and a second run changes nothing (`vendor_channels_test.rs`). There is no
    end-of-day digest sender in the code today; switching the subscription off is what stops it
    once one exists.

Unit tests (`vendor_access/tests.rs`) pin the allowlist per class (credentials, outbound channels,
scheduled and system actions, secret-bearing reads) and the masking of the three handlers the
review named: the immunisation due list, the early-warning context and PCPNDT Form F, plus error
bodies.

## What was found before this was built

- **The seeded first administrator is a `super_admin`** (`medbrains-seed`, `admin@medbrains.localhost`;
  `medbrains-onboarding` also makes the first sign-up on an empty server a `super_admin`). On an
  installation MedBrains runs, whoever holds that login had full, unrecorded-as-vendor access to the
  hospital's records. **Proposed, for the owner to confirm:** `MEDBRAINS_HOSTED=true` on every
  installation MedBrains runs for a hospital adds `medbrains.localhost` to the vendor domains, so
  that login is a MedBrains account and gated like any other. On a hospital's own server the setting
  is unset and the login stays the hospital's.
- **`super_admin` bypasses every permission check** (`kernel::authz::BYPASS_ROLES`) and the field
  hiding in `field_access.rs`. A MedBrains account can no longer use it: its role is replaced per
  request. A hospital's own `super_admin` keeps it.
- **`super_admin` reaches across hospitals in the multi-hospital screens**
  (`medbrains-admin/src/multi_hospital.rs`): it lists every hospital group and every hospital
  (`tenants` and `hospital_groups` have no row security), and the staff-assignment queries skip their
  tenant filter for it. Row security still confines staff rows to the caller's own group, so no
  patient data crosses, but group and hospital names do. A MedBrains account is gated before it
  gets there; a hospital's own `super_admin` still sees every group's name. Reported, not changed.
- **The notification socket skipped the auth middleware** and took the bypass from the token's role,
  so a MedBrains `super_admin` token would have received every board's live stream. It now refuses
  MedBrains accounts.
- **No support, impersonation or vendor-session code existed.** Break-glass exists, but for
  clinicians, inside one hospital.
- Database owners and anyone with shell access to a server bypass all of this. That is an
  operational control (keys held by the hospital, RFC-HOSPITAL-OS §8r rule 1), not an application
  one.

## Limits

- Per-record checks still apply. A grant gives module permissions; patient records that need a care
  relation (lists filtered by ReBAC, a chart) are not opened by the grant alone. Support on a
  specific chart needs the hospital to add the person to that patient's care team, which is itself
  audited. A `vendor_grant` relation is the upgrade if that proves too narrow.
- Masking is by allowlist, so it over-masks: department names, drug names and other harmless
  labels read `[MASKED]` too. That is the safe direction; a masked session is for configuration
  and flow problems, not reading records. A key is kept only by adding its shape to `mask.rs`.
- The domain rule treats any `medbrains.in` address as MedBrains staff. On a tenant MedBrains runs
  for itself, set `MEDBRAINS_VENDOR_EMAIL_DOMAINS` to an empty string.

---

## Draft technical schedule for the data processing agreement

**DRAFT — for the owner's lawyer. Not reviewed. Wording, numbering and citations to be confirmed.**

**Schedule T: Technical and organisational measures for access by the Processor's personnel**

T1. *No standing access.* The Processor's personnel have no access to the Fiduciary's personal data
except under an Access Grant issued by the Fiduciary through the system.

T2. *Access Grant.* Each Access Grant names one individual, states the purpose, lists the functional
areas reachable, states whether personal data is shown masked, and ends no later than 72 hours
after issue. Unmasked access requires approval by a second authorised person of the Fiduciary,
other than the requester.

T3. *Minimum necessary.* Masked access is the default. Under no Access Grant may the Processor's
personnel create or change user accounts, roles, keys, devices, data-sharing settings or access
grants, take backups, or use emergency (break-glass) access.

T4. *Records.* Every request made under an Access Grant is recorded with the grant, the time, the
action and the outcome. The records are available to the Fiduciary at all times on its own system,
cannot be altered or deleted through the application, and are retained for [period — counsel to
align with the DPDP Rules and the Fiduciary's retention policy].

T5. *Revocation.* The Fiduciary may end any Access Grant at any time; it takes effect on the next
request.

T6. *Personnel.* Only named personnel of the Processor, bound by confidentiality, may request
access. The Processor keeps a list of them and gives it to the Fiduciary on request.

T7. *Breach.* The Processor notifies the Fiduciary without delay, and in any case within [hours —
counsel], of any personal data breach involving its personnel or systems, so the Fiduciary can meet
its own duties to the Data Protection Board and to Data Principals.

T8. *Infrastructure access.* Access to servers or databases outside the application (for hosting or
recovery) is covered by [separate clause — counsel], and is logged and notified to the Fiduciary.

## Hand-over on a hosted installation (`MEDBRAINS_HOSTED=true`)

1. Before go-live, MedBrains creates the hospital's own administrator (a `hospital_admin` on the
   hospital's address) from the seeded login, and hands the credentials over in person or through
   the hospital's chosen channel.
2. The hospital's administrator signs in, changes the password, and enrols MFA.
3. Set `MEDBRAINS_HOSTED=true` and restart. If the hospital's only administrator is still the
   seeded login, it is left unflagged and the boot logs an error naming it: hand over an
   administrator, then restart. Until then the seeded login is still refused without a grant. From then on `admin@medbrains.localhost` is a MedBrains
   account: refused without a grant, its credentials refused.
4. Rotate the seeded login's password anyway, and record the hand-over (date, who, how) in the
   hospital's onboarding record.
5. Support from then on uses named `@medbrains.in` accounts the hospital creates, each opened by a
   grant on Security → MedBrains access.
