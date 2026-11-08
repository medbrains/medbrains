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
| Off by default | A MedBrains account is refused on every request without a live grant: 403, audited as `vendor_access_refused`. Its role does not matter: `super_admin` and `hospital_admin` lose their bypass, because the account's role is replaced for the request by `vendor_support`, which no check treats as a bypass | `medbrains-server-core/src/middleware/vendor_access.rs` |
| Which accounts are MedBrains accounts | `users.is_vendor_staff`, set by the first grant and never cleared (a trigger refuses it), or any address on a MedBrains domain (`MEDBRAINS_VENDOR_EMAIL_DOMAINS`, default `medbrains.in`) | migration 1420, `auth.rs` |
| Explicit | Only the hospital creates a grant, on Security → MedBrains access, with a step-up (password again) | `medbrains-it-security/src/vendor_access.rs` |
| Named person | The grant names the account by email; it must already exist at this hospital | same |
| Purpose | A reason of at least 10 characters is required and kept on the grant | same, and a table check |
| Scoped | A list of permission modules, or "configuration only". The grant carries exactly those modules' codes, minus codes that would let it widen or outlive itself (accounts, roles, API keys, access requests, connected apps, sharing, backups, break-glass, the audit log, device enrolment, VPN, and granting vendor access) | `permissions_for_scope` |
| Time-limited | 4 hours by default, 72 at most (also a database check) | migration 1420 |
| Masked by default | Masked unless the hospital chooses otherwise. Masking is done on the server, before the answer leaves: restricted clinical records (HIV, mental health, medico-legal and others) are withheld whole, then every identity field the AI redactor knows, every field class above routine, and free-text clinical fields read `[MASKED]`. A download, image or stream cannot be masked, so it is refused | `mask_value`, `ai_redact`, `field_class` |
| Separation of duty | Unmasked access opens only when a **different** person with `security.vendor_access.approve_unmasked` approves it, with a step-up. The database refuses an approver who asked for it or who is the MedBrains account | migration 1420 check, `approve_grant` |
| Audit | Every request under a grant writes a `vendor_access_events` row **before** the handler runs; if the row cannot be written the request is refused (503). The row is never deleted and takes its status once. Grant changes are on the audit chain by trigger | migration 1420 |
| Visibility | Security → MedBrains access lists every grant, active and past, who gave, approved and ended it, and every request made under it | `apps/web/src/pages/security/medbrains-access/` |
| Stop at once | "End access" revokes the grant; the grant is read on every request, so the next one is refused | `revoke_grant` |
| Isolation | A grant opens one hospital. Its rows are visible only to that hospital, even inside a hospital group | RLS on `app_current_tenant()` |
| Never fail open | If the grant cannot be checked, the answer is 503, never allow and never a 404 that reads as "no such record" | `live_grant` |
| Live streams | The notification socket refuses MedBrains accounts outright: a stream cannot be masked or recorded per request | `medbrains-notifications` |

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
   unknown account, one's own account, and a second live grant for the same person are all
   refused; the default is masked.

## What was found before this was built

- **The seeded first administrator is a `super_admin`** (`medbrains-seed`, `admin@medbrains.localhost`;
  `medbrains-onboarding` also makes the first sign-up on an empty server a `super_admin`). On an
  installation MedBrains runs, whoever holds that login had full, unrecorded-as-vendor access to the
  hospital's records. It is not gated by this change, because on a hospital's own installation it is
  the hospital's administrator and gating it would lock every new installation out. **Owner
  decision needed:** on MedBrains-hosted tenants, give that account a `medbrains.in` address (it is
  then gated) or hand it to the hospital and use named, granted accounts for support.
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
- Masking is by field name. A new identifying field must be added to `field_class.rs` or the AI
  redactor's identity keys; `name` alone is not masked because it names departments and drugs far
  more often than people (patient names have their own keys).
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
