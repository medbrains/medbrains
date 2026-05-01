# `modules/dns` — multi-provider DNS for tenant zones

Each MedBrains tenant brings its own apex domain (e.g.
`hospitals.acmehealthcare.com`) or uses a subdomain we issue under
`medbrains.in` / `medbrains.cloud`. This module manages the records
across the seven DNS backends our tenants actually use.

## Provider matrix

| Provider | Recommended for | Risks |
|---|---|---|
| **Cloudflare** | **Default for everyone.** Free tier covers all DNS needs; full API; no restrictions | Provider v4→v5 renamed `cloudflare_record` → `cloudflare_dns_record` and `value` → `content`; we pin v5 here |
| **AWS Route53** | Tenants already on AWS; consolidates billing | Alias records use a different schema (out of scope for v1 — use CNAME) |
| **Azure DNS** | Azure-native tenants | Per-record-type resources (`azurerm_dns_a_record`, `_cname_record`, …) — sub-module dispatches internally on `record.type` |
| **Google Cloud DNS** | GCP-native tenants | `google_dns_record_set` is authoritative for the `(name, type)` pair — only one resource per pair |
| **DigitalOcean** | Cheap-hosting tenants, small clinics | Domain name doubles as ID; ensure `digitalocean_domain` exists first |
| **Namecheap** | Tenants who registered with Namecheap | API requires IP allowlisting at Namecheap; whole-zone semantics (`OVERWRITE` vs `MERGE`) |
| **GoDaddy** | Indian-popular registrar | **API access restricted since May 2024** — needs 10+ domains in the account or a Discount Domain Club Premier / Domain Pro plan. Active dev paused (still works) |

## Indian registrars without a Terraform provider

**BigRock / ResellerClub / Hostinger / Hover** have no production-grade
Terraform provider. Practical pattern:

1. Tenant keeps the registration with the registrar.
2. Tenant **delegates the apex's `NS` records** to Cloudflare (free) or
   Route53.
3. This module manages records on the authoritative provider —
   the original registrar only holds four `NS` records at the
   registrar level.

This is the same pattern Cloudflare itself recommends for migrating
domains. **No clinical-data path depends on the registrar's API.**

## Usage

```hcl
module "tenant_dns" {
  source = "../../modules/dns"

  providers = {
    cloudflare   = cloudflare.tenant
    aws.dns      = aws.dns
    azurerm.dns  = azurerm.dns
    google.dns   = google.dns
    digitalocean = digitalocean.tenant
    namecheap    = namecheap.tenant
    godaddy-dns  = godaddy-dns.tenant
  }

  provider_kind = "cloudflare"  # or route53 | azure | google | digitalocean | namecheap | godaddy
  zone_name     = "acmehealthcare.com"
  tenant_id     = var.tenant_id

  records = [
    { name = "headscale", type = "CNAME", value = module.headscale.alb_dns_name,        ttl = 300 },
    { name = "bridge",    type = "CNAME", value = module.bridge_ingress.alb_dns_name,   ttl = 300 },
    { name = "api",       type = "CNAME", value = module.aurora.endpoint,                ttl = 300 },
  ]

  # Provider-specific extras (ignored unless their provider is selected)
  azure_resource_group_name = ""    # required when provider_kind = azure
  google_project            = ""    # required when provider_kind = google
  google_managed_zone       = ""    # required when provider_kind = google
}
```

## Records every tenant needs

| Record | Purpose |
|---|---|
| `headscale.<zone>` CNAME → ALB | Headscale tunnel coordinator |
| `bridge-<tenant>.<zone>` CNAME → ALB | Tenant's bridge agent ingress |
| `api.<zone>` CNAME → ALB / RDS Proxy | Cloud API entrypoint |
| `edge.<zone>` A | mTLS edge ingress (short TTL so failover is fast) |
| `_acme-challenge.<zone>` TXT | Let's Encrypt DNS-01 (cert-manager writes — separate module) |

## Credentials

Each provider reads credentials from environment variables — never
committed to state or to the repo.

| Provider | Env vars |
|---|---|
| Cloudflare | `CLOUDFLARE_API_TOKEN` (preferred) or `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` |
| AWS Route53 | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or instance role / SSO) |
| Azure DNS | `ARM_CLIENT_ID` / `ARM_CLIENT_SECRET` / `ARM_TENANT_ID` / `ARM_SUBSCRIPTION_ID` |
| Google Cloud DNS | `GOOGLE_APPLICATION_CREDENTIALS` |
| DigitalOcean | `DIGITALOCEAN_TOKEN` |
| Namecheap | `NAMECHEAP_USER_NAME` / `NAMECHEAP_API_USER` / `NAMECHEAP_API_KEY` / `NAMECHEAP_CLIENT_IP` |
| GoDaddy | `GODADDY_API_KEY` / `GODADDY_API_SECRET` |

## GoDaddy API pre-flight

Before any apply against the GoDaddy provider, verify the account
qualifies for API access:

```sh
curl -H "Authorization: sso-key $GODADDY_API_KEY:$GODADDY_API_SECRET" \
     https://api.godaddy.com/v1/domains
```

`200` with the domain list = OK. `403` = the account doesn't qualify;
take the Cloudflare-delegation fallback above instead.

## Cert-manager interplay (future)

When we deploy cert-manager for Let's Encrypt issuance, it needs DNS-01
challenge records written into the same provider. cert-manager reads
its own credentials from a Kubernetes secret — operationally we mirror
the same env-var values into that secret. Wiring is in a separate
phase; this module just creates the static records.
