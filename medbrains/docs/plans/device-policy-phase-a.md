# Device policy, Phase A: plan

Issue #5569, Phase A. This is a plan only. No code is written until the owner approves it.

A hospital admin sets app settings for the hospital, and optionally for a device group. Every
phone or tablet bound by the hospital QR fetches those settings, checks that the hospital signed
them, enforces them, and locks the values in its own settings screen. This needs no MDM, so it
works on personal phones too. Phases B and C (managed configuration from Intune, Google or Jamf,
and a full EMM) are out of scope.

## Who and when

- **The IT or security officer** sets the hospital default once. Example: SSO and passkey only,
  12-hour sessions, biometric unlock, 3 days of offline data, minimum app version 3.34.0.
- **The officer** adds a group for shared ward tablets, with 8-hour sessions and no offline data,
  and moves those tablets into it.
- **A nurse** reports a lost phone. The officer signs that phone out from Paired devices. The phone
  stays bound, but nobody can use it until someone signs in again.
- **A doctor** opens the app on a personal phone. The app shows only the sign-in methods the
  hospital allows and asks for a biometric after idle time. Settings the hospital controls are shown
  read-only, with "Set by <hospital>".

## What is reused, and what is new

| Need | Reused | New |
|---|---|---|
| Device identity | `paired_devices`. The device's P-256 key was made at binding (Secure Enclave or Android Keystore), and its public half is in `paired_devices.cert_pem`. | nothing |
| The key the device trusts | The hospital binding key (`MEDBRAINS_BINDING_SIGNING_KEY`, Ed25519). The device stored its public half (`ik`) at binding and already pins it (`HospitalBinding.ik`, `StoredBinding.ik`). | nothing |
| Signing format | The compact-JWS code in `medbrains-device-pairing/src/binding_token.rs` | one new `typ`, plus a payload struct |
| Policy version (to stop replays) | The `sequences` table (`UPDATE … RETURNING`), `seq_type = 'device_policy'` | one row per tenant |
| History of changes | `audit_log` through `AuditLogger::log`, storing old and new values | nothing; there is no history table |
| Admin UI | The `@/components/ui` seam, plus the existing Paired devices and Hospital binding pages | one page and one row-actions component |
| Native transport | The pinned client and `SecretStore` in each kit | one verifier and one fetch client per kit |
| ECDSA P-256 verify on the server | `ring`, which is already in `Cargo.lock` through rustls | a direct dependency in `medbrains-device-pairing`; nothing new is downloaded |

**Not used:** `medbrains-signing` is for clinical documents and a doctor's own key, and
`medbrains-crypto` is for NHCX and ABDM. A hospital-to-device statement is what the binding key
already signs. It is pinned in every bound app, and it rotates on its own schedule
(`binding_token.rs` explains why). A second hospital key would mean a second pin to distribute, so
the plan uses the binding key.

## 1. Permissions (Rust first)

In `crates/medbrains-core/src/permissions.rs`, under `devices`:

```rust
/// Settings that a hospital pushes to its bound staff and patient apps.
pub mod policy {
    /// See device policies.
    ///
    /// Shows the hospital default, each group override, which devices are in
    /// each group, and the current policy version.
    pub const VIEW: &str = "devices.policy.view";
    /// Change device policies and device groups.
    ///
    /// Sets the server address, sign-in methods, session length, screen lock,
    /// offline data limit and minimum app version that bound apps enforce.
    /// Every change is audited.
    pub const MANAGE: &str = "devices.policy.manage";
    /// Sign a paired device out remotely.
    ///
    /// Ends every session on one device without unbinding it. This duty is
    /// separate from editing policy, so the help desk can act on a lost phone.
    pub const SIGN_OUT: &str = "devices.policy.sign_out";
}
```

- **Role grants** (`access/roles.rs`):
  - `it_security_officer` gets VIEW, MANAGE and SIGN_OUT.
  - `biomed_engineer` already holds `devices.binding.*`, so it gets VIEW and SIGN_OUT.
  - `audit_officer` gets VIEW.
  - `hospital_admin` and `super_admin` bypass the checks.
- **Next steps:** run `python3 scripts/generate_permissions_ts.py`, then `make check-permissions`
  and `make check-role-templates`.
- **Remote sign-out is not `PAIRED_REVOKE`.** Revoking a device unbinds it, and it has to scan a QR
  again. Signing out ends the sessions on the device but keeps it bound. These are two different
  decisions, so they need two different permissions.

## 2. Schema (one migration, `1458_device_policy.sql`)

```sql
-- Hospital default (group_name IS NULL) and per-group overrides.
CREATE TABLE public.device_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    group_name text CHECK (group_name IS NULL OR length(btrim(group_name)) BETWEEN 1 AND 60),
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,   -- validated in Rust (deny_unknown_fields)
    updated_by uuid REFERENCES public.users(id),
    created_at/updated_at/deleted_at/deleted_by/delete_reason  -- the usual columns
);
CREATE UNIQUE INDEX uq_device_policies_group ON public.device_policies
    (tenant_id, COALESCE(group_name, '')) WHERE deleted_at IS NULL;
-- + RLS (tenant_isolation), FORCE RLS, updated_at trigger, soft-delete guardrail

ALTER TABLE public.paired_devices
    ADD COLUMN policy_group text,          -- NULL = hospital default
    ADD COLUMN signed_out_at timestamptz;  -- last remote sign-out
ALTER TABLE public.refresh_tokens
    ADD COLUMN paired_device_id uuid REFERENCES public.paired_devices(id);
CREATE INDEX idx_refresh_tokens_paired_device ON public.refresh_tokens (paired_device_id)
    WHERE paired_device_id IS NOT NULL AND revoked = false;
```

- **No group table.** A group is a name that `device_policies` and `paired_devices.policy_group`
  share. Deleting a group's policy sets the devices in it back to NULL, in the same transaction.
- **No history table.** `audit_log` keeps the old and new settings.

### Settings (Rust struct, `#[serde(deny_unknown_fields)]`, every key optional in a group row)

| Key | Type and bounds | Default |
|---|---|---|
| `server_url` + `spki` | `https://` only, with the TLS pin as in binding. An http URL, or an https URL without a pin, is refused. | unset (keep the bound server) |
| `sign_in_methods` | non-empty subset of `password`, `otp`, `passkey`, `sso` | all of them |
| `session_hours` | 1–720, and never longer than the server's refresh lifetime | the server's refresh lifetime |
| `screen_lock` | `none`, `device` (a phone passcode is required) or `biometric` | `device` |
| `idle_lock_minutes` | 1–60 | 5 |
| `offline_days` | 0–30, where 0 means no patient data is kept on the device | 3 |
| `min_app_version` | `MAJOR.MINOR.PATCH` | unset |

**How a device's policy is worked out:** start from the server defaults, apply the hospital row
on top, then the group row. Each key is applied separately. This is one query with two rows at most.

## 3. Endpoints

**For admins** (JWT, in `admin_router()` of `medbrains-device-pairing`, each with its own
`require_permission`):

| Method and path | Permission | What it does |
|---|---|---|
| `GET /api/admin/device-policies` | VIEW | Returns the hospital row, the group rows, the device count per group, the current version, and whether the binding key is configured. |
| `PUT /api/admin/device-policies` | MANAGE | Body: `{ group_name: string or null, settings, expected_version }`. Creates or updates the row, bumps the version, and writes the audit entry, all in one transaction. A stale `expected_version` gets a 409. |
| `DELETE /api/admin/device-policies/{id}` | MANAGE | Removes a group override, moves that group's devices back to the default, bumps the version and audits it. The hospital row cannot be deleted. |
| `PUT /api/admin/paired-devices/{id}/policy-group` | MANAGE | Body: `{ group_name: string or null }`. Bumps the version and audits it. |
| `POST /api/admin/paired-devices/{id}/sign-out` | SIGN_OUT | Body: `{ reason }`. Sets `signed_out_at`, revokes every `refresh_tokens` row with that `paired_device_id`, bumps the version and audits it. |

**For devices** (no JWT; in the public `router()` next to `/api/device-binding/redeem`, and added
to the same allowlist in `check-permission-enforcement`):

| Method and path | Proof | What it does |
|---|---|---|
| `POST /api/device-policy/fetch` | Body: `{ paired_device_id, nonce, ts, sig }`, where `sig` is the device key's ECDSA P-256 signature (DER) over `mb-policy-fetch:v1\|{device_id}\|{nonce}\|{ts}` | Checks that the device exists, is not revoked and is not vendor-issued (the same rule as `verify_device_not_revoked`), and that `ts` is within ±5 minutes. Verifies `sig` against `cert_pem` with `ring`. Updates `last_seen_at`. Returns `{ policy: "<JWS>" }`. A device that does not exist or is revoked gets 401, and so does a bad signature, so the endpoint never confirms whether a device exists. A database fault returns 503, never 401. |

**Sessions tied to a device.** The native login and refresh calls send
`X-MedBrains-Device: <device_id>.<nonce>.<ts>.<sig>`, which is the same proof as above. A single
helper, `device_session(&state, &headers)`, in `medbrains-device-pairing`:

- records `refresh_tokens.paired_device_id`;
- caps the refresh expiry at `session_hours`;
- refuses a sign-in method the policy does not allow, with a 403 that says which methods are
  allowed.

`medbrains-auth` and `medbrains-sso-login` call this helper. Without the header, a login works as it
does today (the web, and older app builds). The policy is a lock on the device, not the hospital's
authentication policy.

### The signed policy (a compact JWS: EdDSA, `typ: mb-device-policy+jws`, binding key)

```json
{ "v": 1, "iss": "...", "aud": "medbrains-app", "tenant": "<id>", "sub": "<paired_device_id>",
  "ver": 42, "nonce": "<echoed>", "iat": 1763100000, "exp": 1763704800,
  "policy": { "...the effective settings" : "" }, "sign_out_before": 1763099000 }
```

- `ver` is the tenant's `device_policy` sequence value. Any change to the policy, to a group or to
  a sign-out moves it forward.
- A device stores the highest `ver` it has accepted.
- `exp` is set to `iat` plus 7 days.
- The separate `typ` means a binding token can never be accepted as a policy, and a policy can
  never be accepted as a binding token. Both verifiers check `typ` first.

## 4. Admin screen (web)

- **Where it goes:** a new page, `apps/web/src/pages/admin/device-policy.tsx`, at
  `/admin/device-policy`. It sits in the admin Devices group of the menu, next to Paired devices
  and Hospital binding.
- **Page guard:** `useRequirePermission(P.DEVICES.POLICY.VIEW)`. The query runs only when that
  permission is held.

**Layout:**

- **Header:** a `PageHeader` with the title "Device policy" and the subtitle "Settings your bound
  apps enforce. Devices pick up changes the next time they check in." On the right: the version
  `Badge` and "Last changed by X, time", which links to the audit log filtered to
  `device_policy.*`.
- **Applies to:** a `Select` with "Hospital default" and each group, and a "New group" `Button`
  that only users with MANAGE see. Below it is a seam `Table` of the groups: name, number of
  devices, keys overridden, and a Remove action (MANAGE).
- **Settings form** (React Hook Form + Zod, the Zod schema mirroring the Rust bounds). It has one
  `Card` per section:
  - **Server:** `Input` for the server URL and `Input` for the TLS pin.
  - **Sign-in:** a `Checkbox` group for the four methods.
  - **Session and lock:** `NumberField` for session hours, `Select` for screen lock, and
    `NumberField` for idle minutes.
  - **Offline data:** `NumberField` for days, with the helper text "0 keeps no patient data on the
    device".
  - **App version:** `Input` for the minimum version.
- **Group rows:** every field on a group row has an "Inherit from hospital" `Switch`. When it is
  on, the field shows the inherited value read-only.
- **Save:** `Button tone="primary"` (MANAGE only). It opens a `Modal` of size `sm` that shows the
  diff, for example "3 settings change for 42 devices". Changing the server URL or removing a
  sign-in method shows an extra `Alert` in that modal.
- **Paired devices page:** a new component, `components/Devices/DevicePolicyActions.tsx`, adds two
  row actions. It is a separate component because `paired-devices.tsx` is already 626 lines.
  - "Move to group", a `Modal` of size `sm` with a `Select`, gated on MANAGE.
  - "Sign out", a `Modal` of size `sm` with a required reason, gated on SIGN_OUT. Once a device is
    signed out, its row shows a "Signed out <time>" `Badge`.

**States:**

| State | What the screen shows |
|---|---|
| Loading | The ECG loader |
| The fetch failed or authorization is unknown | An `Alert` reading "Couldn't load device policy", with a retry button. It is never an empty form, because defaults on screen would look like the real policy. |
| No groups yet | "Every device uses the hospital default", and a New group button |
| Binding key not configured | An `Alert` reading "Devices can't check this policy until `MEDBRAINS_BINDING_SIGNING_KEY` is set"; Save is disabled |
| User has VIEW but not MANAGE | The form is read-only, with the note "You can view these settings but not change them"; no Save, New group or Remove |
| Validation error | An inline error that says how to fix it, such as "Use an https address" or "Keep at least one sign-in method" |
| 409 conflict | "Someone changed this policy since you opened it", with a Reload button that keeps nothing stale |

Accessibility: every field has a real label and a wired error, icon-only actions have an
`aria-label`, the lock state is shown in text and not only in colour, and targets are at least
24px.

## 5. What each app does

### Web

The web app is the console only. A browser session is not a paired device, so Phase A enforces
nothing on the web. Web sign-in still follows the hospital's authentication settings.

### Native staff apps, iOS and Android in lockstep

The shared code lives in the kits: `MedBrainsKit/DevicePolicy.swift` and
`kit/.../DevicePolicy.kt`. It follows the native standards (named constants, a separate API
layer, no per-screen copies) and the constrained-device rules (bounded retries, no leaks).

1. **Verifier.** This is pure code, run in unit tests against a known-answer fixture that the Rust
   test writes, so all three implementations have to agree. It checks, in order:
   - `typ`;
   - the Ed25519 signature under the stored `ik`;
   - `tenant` matches the binding;
   - `sub` matches `pairedDeviceId`;
   - `nonce` matches the one sent;
   - `ver` is at least the stored `ver`.

   Any failure is refused, and the last good policy stays in force.
2. **Fetch client.**
   - **Request:** it signs the fetch proof with the device key (Secure Enclave or Keystore) and
     sends it over the existing pinned client, with a 10-second timeout and at most 3 retries with
     backoff.
   - **When:** right after binding, at launch, when the app comes to the foreground (at most once
     every 15 minutes), and before showing sign-in.
   - **Storage:** it stores the verified JWS and `ver` in `SecretStore` (Keychain or
     EncryptedSharedPreferences).
3. **Enforcement:**
   - **Sign-in screen:** shows only the allowed methods. Login and refresh send `X-MedBrains-Device`.
   - **Session length:** the app signs the user out locally after `session_hours`, and the server
     caps the refresh token as well.
   - **Screen lock `device`:** if the phone has no passcode, a blocking screen asks for one
     (checked with `LAContext` `.deviceOwnerAuthentication` on iOS and
     `KeyguardManager.isDeviceSecure` on Android).
   - **Screen lock `biometric`:** on resume after `idle_lock_minutes`, the app asks with
     `LAContext` or `BiometricPrompt`.
   - **`offline_days`:** SwiftData or Room rows older than the limit are purged each time the
     policy is applied, and once a day. With 0, patient data is never written to disk.
   - **`min_app_version`:** below it, a full-screen "Update required" with a store link, and
     sign-in is blocked.
   - **`server_url`:** the app moves its stored `apiBase` and `spki` only after a policy fetched
     from the new address verifies under the same `ik`. Otherwise it stays where it is and shows
     why.
   - **`sign_out_before`:** if the current session started earlier, the app clears its tokens and
     local patient data and returns to sign-in.
4. **Locks.** In Settings, each value the policy sets is read-only, with a lock icon and the text
   "Set by <tenantName>". The text matters because colour alone cannot carry the meaning. Targets
   are at least 44pt.

## 6. Offline and failure rules (fail safe)

- **No policy yet.** The first policy is fetched as part of binding, and the redeem step is online
  anyway. Until a policy is held, sign-in is blocked with "Couldn't load your hospital's settings.
  Retry". The server always answers with a policy, using the defaults when nobody has set one, so
  this state is only a network failure.
- **Offline, or the policy has expired.** The app keeps enforcing the last verified policy and
  never falls back to looser defaults. When `exp` has passed, a banner says "Hospital settings last
  checked <date>".
- **Server URL.** A device never accepts a server URL that is not https.

## 7. Audit

All audit entries are written inside the same transaction as the change, with `old_values` and
`new_values`:

- `device_policy.update`
- `device_policy.group_delete`
- `paired_device.policy_group_set`
- `paired_device.sign_out` (with the reason)

Policy fetches only update `last_seen_at`. Fetches are frequent and change nothing, so they are not
written to the audit log.

## 8. Acceptance scenarios

1. **Happy path.** Given a staff phone bound by QR, and an officer with MANAGE, when the officer sets
   `sign_in_methods = [sso, passkey]` and `screen_lock = biometric` and saves, then:
   - `ver` goes up by 1;
   - `audit_log` has a `device_policy.update` row with the old and new settings;
   - the next time the phone comes to the foreground, it verifies the policy, shows only SSO and
     passkey on its sign-in screen, and asks for a biometric after the idle time;
   - its Settings show "Screen lock: Biometric (Set by <hospital>)" as read-only.
2. **Group override.** Given the ward-tablet group with `offline_days = 0`, when a tablet is moved
   into it, then on its next check-in the tablet purges its cached patient rows and stops writing
   new ones, and phones in the hospital default keep 3 days.
3. **Bad signature.** Given a policy whose signature does not verify under the pinned `ik` (it was
   tampered with, or signed by another hospital's key), when the app receives it, then the app
   refuses it, keeps enforcing the last good policy, and records a local diagnostic. The locked
   values do not change.
4. **Wrong token type or wrong device.** Given a valid binding QR token, or a policy whose `sub` is
   another device, when it is presented to the policy verifier, then it is refused.
5. **Replay of an old policy.** Given a phone holding `ver = 42`, when a captured response with
   `ver = 40` is sent back to it (looser settings, before a sign-out), then the app refuses it
   and stays on 42. A fetch whose `nonce` is not the one the app sent is also refused.
6. **Remote sign-out.** Given a signed-in phone, when an officer with SIGN_OUT signs it out with the
   reason "Lost phone", then:
   - all of that device's refresh tokens are revoked at once;
   - the access token runs out within its 15-minute life;
   - on its next check-in the app clears its tokens and local patient data;
   - the device stays bound, and the next user can sign in without a new QR;
   - the audit log records `paired_device.sign_out` with the reason.
7. **Permission denied.**
   - A user without VIEW who opens `/admin/device-policy` is redirected, and the page never fetches.
   - A user with VIEW but not MANAGE sees a read-only form, and a direct `PUT` with their key gets a
     403.
   - A user with VIEW but not SIGN_OUT sees no Sign out action, and a direct `POST` gets a 403.
8. **Device proof refused.** Given a fetch with a bad device signature, a `ts` 10 minutes old, or a
   revoked device, then the answer is 401 and nothing reveals whether the device exists. A database
   outage answers 503, and the app keeps its last policy.
9. **Offline.** Given a phone that last fetched `ver = 42` eight days ago and is offline now, when
   it opens, then it enforces 42 (biometric, 3 offline days), shows "Hospital settings last
   checked <date>", and never relaxes to the defaults.
10. **Server move.** Given a policy that sets `server_url = https://new.example.org` with its pin,
    when the app fetches the policy from the new address and it verifies under the same `ik`, then
    the binding moves there. If the new address serves a policy signed by another key, or the
    connection fails the pin, the app stays on the old server and says why. An `http://` URL is
    refused when the admin saves it.
11. **Lock-out guard.** Given an officer who clears every sign-in method, or sets a session of 0
    hours, then Save is refused inline, and the server refuses the same body with a 400.
12. **Version floor.** Given `min_app_version = 3.34.0` and an app at 3.33.2, when it opens, then
    "Update required" blocks sign-in and offers the store link.

## 9. Tests and checks (each surface)

- **Rust:**
  - JWS sign and verify round trip;
  - the known-answer fixture shared with both kits;
  - fetch with a bad, stale or revoked proof gets a 401;
  - admin routes get a 403 without the permission;
  - a stale `expected_version` gets a 409;
  - sign-out revokes the right tokens;
  - an audit row is written in the same transaction.
- **Web:** a Playwright journey in which an officer sets a policy, the version goes up, and the
  audit entry is visible; a view-only user sees a read-only form; a user without VIEW is
  redirected. Plus axe checks.
- **iOS and Android:**
  - verifier unit tests: bad signature, wrong `typ`, wrong `sub`, replay, nonce mismatch, expired
    policy;
  - one long-session journey per platform: sign in, the admin changes the policy, Back and switch
    tabs, return to the foreground, and the locked value appears; then a remote sign-out lands the
    app on sign-in.
- **Gates:**
  - `make check-permissions`, `check-role-templates`, `check-api` and `check-ui-api`;
  - `check-permission-enforcement`, with the fetch route allowlisted next to redeem;
  - `make check-docs`;
  - a `docs/DECISIONS.md` row in the implementation PR.

## 10. Decisions for the owner

1. **One hospital key.** The binding key also signs policy, with a separate `typ`, and no new key is
   added. Rejected: a second, dedicated policy key, which would need a second pin in every app.
2. **Sessions tied to the device on the server.** The `X-MedBrains-Device` header and
   `refresh_tokens.paired_device_id` make remote sign-out and the session cap real on the server.
   Rejected: enforcing them only in the app, which a stolen or modified phone could ignore. This is
   the largest part of the change, and it can be cut back to app-only if the owner wants it smaller.
3. **Groups are a name, not a table.** The plan adds `paired_devices.policy_group` and does not add
   a `device_groups` table. Rejected for now: grouping by `department_id` or `app_variant`, which
   ties policy to the org chart.
4. **Out of Phase A:** remote wipe beyond the sign-out data clear, which modules are shown, the SSO
   issuer, binding-key rotation, and the patient app. The patient app joins once the staff apps
   pass the scenarios above.
