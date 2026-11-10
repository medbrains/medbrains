# SSO setup — Microsoft Entra ID (Azure AD)

Federate MedBrains login to Microsoft Entra ID (included with M365 Education A1/A3).
Result: staff click **"Sign in with Entra"**, authenticate at Microsoft, and land in
MedBrains with the role/access-groups their **Entra groups** map to. The SSO code
is shipped (#3400–3404, #3589–3592); this is pure configuration.

## A. Register the app in Entra (Azure portal — one-time)
1. **Entra ID → App registrations → New registration.**
   - Name: `MedBrains HMS`.
   - Supported account types: **Single tenant** (this org only).
   - **Redirect URI**: platform **Web**, value =
     `https://<your-medbrains-host>/api/auth/sso/callback`
     (dev: `https://127.0.0.1:8443/api/auth/sso/callback`). Must match **exactly** — https, host, path.
2. On the Overview page, copy **Application (client) ID** and **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret** → copy the **Value** immediately
   (shown once — this is the client secret, not the secret ID).
4. **Token configuration → Add groups claim** → choose **Security groups** →
   for the **ID token**, emit **Group ID**. This puts the user's group **Object IDs**
   into the `groups` claim of the id_token (what MedBrains reads).
   - Note: Entra emits group **Object IDs (GUIDs)**, not names — so the mappings in step C use GUIDs.
   - Overage: a user in >200 groups gets no `groups` claim (a Graph pointer instead) — rare; assign the
     app to specific groups if you hit it.
5. (API permissions default to Microsoft Graph `openid`/`profile`/`email` — fine; grant admin consent if prompted.)

## B. Add the provider in MedBrains (`/admin/sso`)
Adding, deleting or switching a provider on or off, and changing whom it trusts (URLs, client, group
claim, JIT), needs a hospital administrator (`super_admin` or `hospital_admin`); other holders of
`admin.settings.general.manage` see the list and can edit a provider's name, default role and group
mappings only. The sign-in policy (`auth` settings: switching password sign-in off, the break-glass
account) is likewise an administrator's change.

Create an OIDC provider:
- **Protocol**: `oidc`
- **Discovery URL**: `https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration`
- **Client ID**: the Application (client) ID from A2
- **Client secret**: the Value from A3 (stored AEAD-encrypted; never returned)
- **group_claim**: `groups`
- **default_role**: optional — the role for users whose groups match nothing (leave blank to deny)
- **JIT enabled**: on (first login auto-creates the user)

## C. Map Entra groups → MedBrains roles / access-groups
In Entra, copy each group's **Object ID** (Entra ID → Groups → the group → Object Id).
In `/admin/sso` → the provider's **Group mappings**, add one per group:
- `idp_group` = the Entra group **Object ID** (GUID)
- `role_code` = a MedBrains role (e.g. `doctor`, `nurse`) — first matching group wins the single role
- and/or `access_group_id` = a MedBrains access-group — all matching are collected
Re-synced on every login (source='sso'); manual admin grants are never touched.

## C2. Moving an administrator onto SSO
An SSO sign-in that matches an existing account by verified email adopts that account, **except** an
account holding an administrator role: it is never adopted by email, so whoever can assert that address
at the directory cannot sign in as the administrator. Their first SSO sign-in creates a separate,
ordinary account instead. To move an administrator who is not yet federated, **before** their first SSO
sign-in:
1. Another administrator demotes them to an ordinary role on the Users screen.
2. They sign in once with SSO; the email link adopts their existing account.
3. The other administrator promotes them back.

If they already signed in by SSO and got a separate ordinary account, that account now holds their
directory identity, and deleting it does not release it (deletion keeps the row). A bypass
administrator has to resolve it; do not repeat the steps above until they have.

## D. Deployment env
- `MEDBRAINS_PUBLIC_BASE_URL` = your MedBrains host (the redirect base) — must match the URI in A1.
- `MEDBRAINS_OAUTH_TOKEN_KEY` = the AEAD key for the client secret (prod: KMS/secret resolver).

## E. Test
1. Log out. The login page shows **"Sign in with <provider name>"** (via `/api/auth/sso/providers`).
   - If it doesn't appear: the provider must be **active**, and pre-auth resolution is by host — set the
     tenant's `custom_domain` to your host, or it falls back to the global active list.
2. Click it → Microsoft login → consent → back to MedBrains, signed in.
3. First login **JIT-creates** the user; their Entra groups set the role + access-groups.
4. Verify the audit: an `sso_login` row (provider, subject, groups, role, outcome=provisioned/linked/returning);
   a refused login (no group maps + no default_role) logs `sso_login_denied`.

## Gotchas
- Redirect URI mismatch is the #1 failure — copy it verbatim, https, no trailing slash.
- Groups are **Object IDs**, not display names — map by GUID.
- Client **secret Value** (not ID); it expires — set a calendar reminder to rotate.
- Multi-tenant MedBrains: use a `custom_domain` per hospital so the login page resolves the right provider.
