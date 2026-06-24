# RFC-MAIL-STALWART — Self-hosted mail with Stalwart

**Status:** Accepted · **Scope:** outbound transactional email (verification, invites, notifications)

## Why Stalwart

MedBrains is open-source, self-hostable, Rust. Its mail story should match.
[Stalwart](https://stalw.art) is an open-source mail server written in Rust
(SMTP + IMAP + JMAP, DKIM/SPF/DMARC/ARC, TLS, spam filtering) under AGPL/commercial
— the same dual-license posture as MedBrains. Running it gives a hospital a fully
**self-hosted, data-resident** mail path with no third-party SaaS (SendGrid/SES)
seeing patient-adjacent email, which matters for NABH/ABDM/DPDP deployments.

MedBrains only needs to **send** transactional mail (no inbound parsing), so Stalwart
acts as the SMTP submission server / relay that MedBrains authenticates to. A hospital
can also host its real `noreply@` / `it@` mailboxes on the same Stalwart instance.

## How MedBrains uses it

The outbox email handler (`crates/medbrains-outbox/src/handlers/email_stub.rs`) already
speaks SMTP via `lettre`. Stalwart is a standard SMTP server, so it is wired as a
first-class provider — set `EMAIL_PROVIDER=stalwart` (an alias of the `smtp` path):

```
EMAIL_PROVIDER=stalwart
SMTP_HOST=mail.hospital.example          # the Stalwart host
SMTP_PORT=587                            # submission (STARTTLS); 465 for implicit TLS
SMTP_TLS=starttls                        # starttls | implicit | none
SMTP_USERNAME=noreply@hospital.example   # a Stalwart account/credential
SMTP_PASSWORD=<app-password>
EMAIL_FROM_ADDRESS=noreply@hospital.example
EMAIL_FROM_NAME=Apollo Hospital
```

Credentials resolve per-tenant through the configured `SecretResolver`
(env / file / AWS Secrets Manager — see RFC-DATA-INFRASTRUCTURE), so the SMTP
password is never in the database. Missing creds → the handler degrades to stub mode
(logs, no send), so dev/test never blocks on mail.

## Deploy (Docker)

```yaml
# deploy/mail/docker-compose.yml — minimal Stalwart for outbound submission
services:
  stalwart:
    image: stalwartlabs/mail-server:latest
    container_name: medbrains-mail
    restart: unless-stopped
    ports:
      - "25:25"     # MX (inbound + relay)
      - "587:587"   # submission (STARTTLS) — MedBrains connects here
      - "465:465"   # submission (implicit TLS)
      - "443:443"   # admin web UI + JMAP
    volumes:
      - ./stalwart-data:/opt/stalwart-mail
    environment:
      # First-boot admin password; rotate in the web UI afterwards.
      - STALWART_ADMIN_SECRET=${STALWART_ADMIN_SECRET}
```

First boot → open `https://mail.hospital.example` → create the domain
`hospital.example` and a `noreply@hospital.example` account → generate an
app-password for MedBrains. Full config (storage backend, queues, TLS via ACME)
follows Stalwart's docs; the defaults are production-sane for a single node.

## DNS (deliverability — required)

Hospital email lands in spam without these. For domain `hospital.example`:

| Record | Host | Value |
|---|---|---|
| **A** | `mail` | `<server-ip>` |
| **MX** | `@` | `10 mail.hospital.example` |
| **SPF** (TXT) | `@` | `v=spf1 mx -all` |
| **DKIM** (TXT) | `<selector>._domainkey` | public key Stalwart generates (copy from its UI) |
| **DMARC** (TXT) | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@hospital.example` |
| **PTR** (reverse) | server IP | `mail.hospital.example` (set at the host/cloud provider) |

TLS is via ACME/Let's Encrypt (Stalwart built-in) or the same cert the Pingora edge
uses for the hospital's custom domain (see RFC-ONBOARDING-PROVISIONING).

## Operational notes

- **Outbound-only is fine.** MedBrains never reads mail; you only need submission (587/465)
  reachable from the app + port 25 outbound from Stalwart to the internet.
- **Cloud port-25 blocks.** Many providers block outbound 25 by default — request an
  unblock or use a smarthost relay; submission (587) to Stalwart is unaffected.
- **Per-tenant.** Each hospital can point at its own Stalwart (true data residency) or a
  shared one; the per-tenant SecretResolver keys keep them isolated.
- **Fallback.** SendGrid (`EMAIL_PROVIDER=sendgrid`) remains for hospitals that prefer a
  managed sender; SES is pending SigV4.

## Decision

Stalwart is the **recommended self-hosted mail server** for MedBrains deployments that
want data-resident, no-SaaS email. It is wired as the `stalwart` email provider (SMTP).
No app code beyond the provider alias is required — deployment + DNS is an operator step,
documented above.
