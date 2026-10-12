# Quarterly access review — procedure

Draft 2026-10-12. **Not in force until the organisation fills the `[ORG: …]` fields and approves it.** Supports SOC 2
CC6.2/CC6.3 and ISO 27001:2022 A.5.15–5.18, A.8.2. Evidence is the completed sign-off record (§7) plus the exported
lists, kept for [ORG: retention, recommend ≥ 3 years].

| Field | Value |
|---|---|
| Owner | [ORG] |
| Cadence | quarterly (Jan/Apr/Jul/Oct), plus within 1 week of any SEV1 incident |
| Reviewers | each hospital's administrator for its own users; [ORG: MedBrains reviewer] for platform access; reviewer ≠ the person whose access is reviewed |

## 1. What is in scope

1. App users, roles and per-user overrides — per hospital (tenant).
2. App API keys (machine access).
3. AWS IAM (users, roles, access keys, root).
4. GitHub (repository collaborators, deploy keys, Actions secrets).
5. SSH to the production host (authorized keys, security-group /32 rules).
6. Other admin consoles: GoDaddy, Cloudflare, Microsoft 365, SES SMTP credential. [ORG: add any others.]

## 2. App users and roles

**State of the product:** there is **no user export or access-review screen**. `apps/web/src/pages/admin/users.tsx`
lists users but has no export; `users` has no last-login column. Until a screen exists, the export is a read-only SQL
query run by a platform operator on the prod database, and the CSV is sent to each hospital's reviewer.
**Needed in the product** (so hospitals can self-serve): an "Access review" view under Admin → Users with the columns
below, CSV export, a per-row keep/change/remove decision, and a stored sign-off — guarded by a new permission (e.g.
`admin.access_review.run`), defined in Rust first per the Permissions First rule.

Run on the host as the database owner (cross-tenant; RLS would hide other hospitals), read-only. Verified against the
current schema on 2026-10-12:

```sh
sudo -u postgres psql -d medbrains -v ON_ERROR_STOP=1 \
  -c "BEGIN READ ONLY" -c "\copy (<query>) TO STDOUT WITH CSV HEADER" > users-$(date +%F).csv
```

Users (one row per non-deleted user):

```sql
SELECT t.name AS hospital, u.username, u.full_name, u.email, u.role, u.is_active, u.is_service_account,
       u.mfa_enabled, u.idp_id IS NOT NULL AS sso,
       CASE jsonb_typeof(u.access_matrix->'extra') WHEN 'array' THEN jsonb_array_length(u.access_matrix->'extra') ELSE 0 END AS extra_perms,
       CASE jsonb_typeof(u.access_matrix->'denied') WHEN 'array' THEN jsonb_array_length(u.access_matrix->'denied') ELSE 0 END AS denied_perms,
       (SELECT max(r.created_at) FROM refresh_tokens r WHERE r.user_id = u.id) AS last_sign_in,
       u.created_at
  FROM users u JOIN tenants t ON t.id = u.tenant_id
 WHERE u.deleted_at IS NULL
 ORDER BY t.name, (u.role IN ('super_admin','hospital_admin')) DESC, u.username
```

`last_sign_in` is approximate: the newest refresh token issued to the user.

Roles (custom roles drift; system roles are seeded from `crates/medbrains-core/src/access/roles.rs`):

```sql
SELECT t.name AS hospital, r.code, r.name, r.is_system, r.is_active,
       CASE jsonb_typeof(r.permissions) WHEN 'array' THEN jsonb_array_length(r.permissions) ELSE 0 END AS permissions,
       (SELECT count(*) FROM users u WHERE u.tenant_id = r.tenant_id AND u.role::text = r.code
                                     AND u.deleted_at IS NULL AND u.is_active) AS active_users
  FROM roles r JOIN tenants t ON t.id = r.tenant_id WHERE r.deleted_at IS NULL ORDER BY 1, 2
```

API keys (unrevoked):

```sql
SELECT t.name AS hospital, k.name, k.key_prefix, k.created_at, k.expires_at, k.last_used_at, k.last_used_ip,
       CASE jsonb_typeof(k.permissions) WHEN 'array' THEN jsonb_array_length(k.permissions) ELSE 0 END AS permissions,
       cu.username AS created_by
  FROM api_keys k JOIN tenants t ON t.id = k.tenant_id LEFT JOIN users cu ON cu.id = k.created_by
 WHERE k.revoked_at IS NULL ORDER BY 1, k.last_used_at NULLS FIRST
```

**Reviewer checks** (each hospital, against its HR roster):

- Every active user is a current employee/contractor with a need; leavers → deactivate (Admin → Users).
- `super_admin` / `hospital_admin` (they bypass every permission check): named, minimal, MFA on.
- `extra_perms` > 0: each override still justified; `denied_perms` intentional.
- No sign-in for [ORG: 90] days → deactivate unless justified.
- `is_service_account` rows and API keys: an owner, still used (`last_used_at`), expiry set, permissions minimal.
- Custom roles with 0 active users → retire; roles whose permission count grew since last quarter → explain.
- Shared/generic accounts (`frontdesk1`, …) → replace with named accounts or document the compensating control.

Changes are made in the app (Admin → Users / Roles / API keys), never by SQL, so they are audited in `audit_log`.

## 3. AWS IAM

Read-only, operator credentials:

```sh
aws iam generate-credential-report && sleep 10
aws iam get-credential-report --query Content --output text | base64 --decode > aws-cred-report-$(date +%F).csv
aws iam list-roles --query 'Roles[].{name:RoleName,created:CreateDate,last:RoleLastUsed.LastUsedDate}' --output table
aws iam list-users --query 'Users[].UserName' --output text | xargs -n1 aws iam list-attached-user-policies --user-name
```

Check: root has MFA and no access keys; every IAM user is a person with MFA or a named machine identity; access keys
older than 90 days rotated (includes the SES SMTP user `medbrains-in-ses-smtp` and any key in `infra/.env`); unused
users/roles/keys removed; `AdministratorAccess` held by [ORG: named people only].

## 4. GitHub

```sh
gh api repos/DomnicAmalan/MedBrains/collaborators --paginate --jq '.[] | [.login, .role_name] | @tsv'
gh api repos/DomnicAmalan/MedBrains/keys --jq '.[] | [.title, .read_only, .created_at] | @tsv'
gh api repos/DomnicAmalan/MedBrains/actions/secrets --jq '.secrets[] | [.name, .updated_at] | @tsv'
gh api repos/DomnicAmalan/MedBrains/invitations --jq '.[] | .invitee.login'
```

Check: collaborators current, least role (write vs admin); deploy keys known and read-only where possible; secrets
still used and rotated; 2FA on every account [ORG: verify per person]; branch protection on `master` as intended.

## 5. SSH to production

On the host and in AWS:

```sh
sudo sh -c 'for h in /root /home/*; do [ -f "$h/.ssh/authorized_keys" ] && { echo "== $h"; ssh-keygen -lf "$h/.ssh/authorized_keys"; }; done'
aws ec2 describe-security-groups --group-ids sg-08b3b592a3c603029 --region ap-south-1 \
  --query 'SecurityGroups[].IpPermissions[?FromPort==`22`]'
```

Check: every key fingerprint maps to a named person [ORG: keep the mapping]; no temporary /32 rules left from a deploy
(they are added by hand and must be revoked after); EC2 key pair still needed.

## 6. Other consoles

GoDaddy, Cloudflare, Microsoft 365 admin roles, SES: list who has admin, confirm MFA, remove leavers. [ORG: how each
list is obtained.]

## 7. Sign-off record (copy per quarter)

```
Quarter:                      Review window:            Completed on:
Reviewer(s):                  Independent of reviewed access: yes / no
Exports attached (file, sha256):
  users-YYYY-MM-DD.csv        roles-…csv      api-keys-…csv     aws-cred-report-…csv
  github-…txt                 ssh-…txt        consoles-…txt

| System | Accounts reviewed | Removed | Changed | Exceptions (accepted, by whom, until) |
|--------|-------------------|---------|---------|---------------------------------------|
| App — <hospital>  |  |  |  |  |
| App API keys      |  |  |  |  |
| AWS IAM           |  |  |  |  |
| GitHub            |  |  |  |  |
| SSH / SG          |  |  |  |  |
| Other consoles    |  |  |  |  |

Changes applied and verified on (date):          by:
Reviewer signature / date:                        Approver signature / date:
```

Keep the record and exports in [ORG: evidence location]. The next review checks that this quarter's removals actually
took effect.
