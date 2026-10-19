# medbrains.in

The company's own domain: the marketing site, product mail and the public
addresses. Not a hospital — hospitals live under `envs/clients/` and `envs/tenants/`.

| What | Where |
|---|---|
| `medbrains.in`, `www` | `website/` on S3 + CloudFront (ACM certificate; DNS at GoDaddy) |
| `noreply@` | Amazon SES, Mumbai — DKIM-signed, bounces to `mail.medbrains.in` |
| mailboxes (`hello@` …) | the hospital's Microsoft 365 tenant (`m365.tf`) |
| `_dmarc` | GoDaddy's existing `p=quarantine` |
| `app.medbrains.in` | the hospital app — A record to the prod EC2 (`app.tf`) |

## Apply (operator)

1. Cloudflare API token (My Profile → API Tokens → Create) with
   **Zone · DNS · Edit**, **Zone · Email Routing Rules · Edit**,
   **Account · Email Routing Addresses · Edit**, scoped to `medbrains.in`.
2. `cp terraform.tfvars.example terraform.tfvars` and fill both values.
3. ```sh
   export CLOUDFLARE_API_TOKEN=…        # from your password manager
   export AWS_PROFILE=…                 # the account that will own the site + SES
   terraform init
   terraform plan -out plan.tfplan
   terraform apply plan.tfplan          # ~10 min: CloudFront is the slow part
   ```
4. Cloudflare emails `forward_to` a verification link — click it, or nothing forwards.
5. SES starts in the sandbox (sends only to verified addresses). In the AWS
   console, SES → Account dashboard → **Request production access**, use case
   "transactional: hospital receipts, invites, one-time codes".
6. Ship the site:
   ```sh
   WEBSITE_BUCKET=$(terraform output -raw website_bucket) \
   WEBSITE_DISTRIBUTION_ID=$(terraform output -raw website_distribution_id) \
   ../../../../../website/deploy.sh
   ```

## The app sending as noreply@

`terraform output smtp` gives host, port, username and from-address. The
password goes straight from state into the server's environment as
`SMTP_PASSWORD` — `terraform output -raw smtp_password` piped, never pasted.
That is a production change; it's made with a deploy, not from here.

State is local (`*.tfstate` is git-ignored) and holds the SMTP secret: keep
this directory's state file private.

## Moving the app from medbrains.amh.org.in (2026-10-12)

1. `medbrains.in` must resolve: clear GoDaddy's `clientHold` (verify the
   registrant email GoDaddy sent) and set its nameservers to Cloudflare's two.
   Check: `dig +short NS medbrains.in` shows `*.ns.cloudflare.com`.
2. Apply this env (above) — it creates `app.medbrains.in`. Check:
   `dig +short app.medbrains.in` shows the prod IP.
3. On the prod host (backups first, as for any prod change):
   ```sh
   sudo bash /tmp/move-host.sh app.medbrains.in medbrains.amh.org.in          # dry run
   sudo bash /tmp/move-host.sh app.medbrains.in medbrains.amh.org.in --apply
   ```
   (`deploy/standalone/move-host.sh`, copied up with scp.) It moves the env,
   renames the Caddy site, redirects the old name, updates the hospital's
   domain, restarts, and checks both names.
4. If SSO is configured, add `https://app.medbrains.in/api/auth/sso/callback`
   as a redirect URI at the identity provider.
5. Keep `TF_VAR_domain=medbrains.amh.org.in` in `infra/.env` for now: the prod
   env owns the old name's GoDaddy record, and the redirect needs it. Switch it
   when the old name is retired.

## Microsoft 365 mailboxes

1. M365 admin → Settings → Domains → **Add domain** `medbrains.in` → choose
   "add a TXT record" (not Domain Connect — terraform owns these records).
2. Copy the `MS=ms…` value, then
   `terraform apply -var m365_verification=MS=ms…` (plan first). If admin lists
   a different MX (`*.mx.microsoft`), pass `-var m365_mx=…` too.
3. Back in admin, **Verify**, then create the mailboxes / aliases
   (`hello@`, `support@`, `sales@`).
