# Cloud-side per-tenant resources.
#
# - Tenant KMS data key (separate from the global cloud KMS root)
# - S3 prefix for tenant-scoped audit redacted archive
# - IAM role for the bridge agent's IRSA
# - Headscale pre-auth key minted via the headscale admin API
# - tenant_db_topology row (initially 'aurora'; flipped after on-prem
#   stack soaks)

provider "aws" {
  alias  = "cloud"
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "medbrains"
      Tenant    = var.tenant_id
      ManagedBy = "terraform-tenant-template"
    }
  }
}

# ── DNS provider aliases ──────────────────────────────────────────────
# Each provider reads its credentials from environment variables (see
# modules/dns/README.md). Aliases let multiple DNS backends coexist in
# one tenant env even though only one is selected at apply time.

provider "aws" {
  alias  = "dns"
  region = var.aws_region
}

provider "cloudflare" {
  alias = "tenant"
}

provider "azurerm" {
  alias = "dns"
  features {}
}

provider "google" {
  alias = "dns"
}

provider "digitalocean" {
  alias = "tenant"
}

provider "namecheap" {
  alias = "tenant"
}

provider "godaddy-dns" {
  alias = "tenant"
}

# A tenant-scoped IAM role the on-prem bridge agent assumes via OIDC
# federation (Headscale → STS, federated identity provider out-of-
# band). Lets the bridge call the cloud event bus + read its tenant's
# secrets without sharing credentials with other tenants.
resource "aws_iam_role" "bridge" {
  provider           = aws.cloud
  name               = "medbrains-${var.tenant_id}-bridge"
  assume_role_policy = data.aws_iam_policy_document.bridge_assume.json
}

data "aws_iam_policy_document" "bridge_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::aws:oidc-provider/${local.headscale_oidc_host}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.headscale_oidc_host}:sub"
      values   = ["tag:hospital-${var.tenant_id}"]
    }
  }
}

locals {
  # Host portion of the headscale URL — used as the OIDC issuer
  # identifier in IAM. Strip the scheme and any trailing slash.
  headscale_oidc_host = replace(replace(var.headscale_url, "https://", ""), "/", "")
}

data "aws_iam_policy_document" "bridge" {
  statement {
    sid     = "AuditArchive"
    actions = ["s3:PutObject", "s3:GetObject"]
    resources = [
      "${var.cloud_audit_bucket_arn}/${var.tenant_id}/*"
    ]
  }
  statement {
    sid       = "TenantKms"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
    resources = [var.cloud_kms_key_arn]
  }
  statement {
    sid       = "TenantSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:medbrains/*/${var.tenant_id}/*"]
  }
}

resource "aws_iam_role_policy" "bridge" {
  provider = aws.cloud
  role     = aws_iam_role.bridge.id
  policy   = data.aws_iam_policy_document.bridge.json
}

# tenant_db_topology row inserted out-of-band by the cloud admin via
# psql / admin endpoint. Documenting the SQL here for the runbook:
#
#   INSERT INTO tenant_db_topology (
#       tenant_id, topology, deploy_mode,
#       patroni_writer_url, patroni_reader_url,
#       tunnel_provider, onprem_cluster_id
#   ) VALUES (
#       '<tenant_uuid>',
#       'aurora',           -- flipped to 'patroni_with_cloud_analytics' after soak
#       'hybrid',
#       'postgres://app@<bridge-fqdn-via-tailnet>:5432/medbrains?sslmode=require',
#       'postgres://app@<bridge-fqdn-via-tailnet>:5433/medbrains?sslmode=require',
#       '${var.tunnel_provider}',
#       'medbrains-${var.tenant_id}-onprem-pg'
#   );

# Headscale pre-auth key — minted via curl to the headscale admin API.
# Generated as part of `make hybrid-up`. The key is single-use + 24h
# expiry; rotation policy in runbooks/headscale-ops.md.
resource "null_resource" "headscale_preauth_key" {
  triggers = {
    tenant_id = var.tenant_id
  }

  provisioner "local-exec" {
    command = <<-EOT
      curl -sfH "Authorization: Bearer ${var.headscale_admin_api_key}" \
        ${var.headscale_url}/api/v1/preauthkey \
        -d '{
          "user": "tenant-${var.tenant_id}",
          "reusable": false,
          "ephemeral": false,
          "expiration": "24h",
          "aclTags": ["tag:hospital-${var.tenant_id}"]
        }' > /tmp/medbrains-${var.tenant_id}-preauth.json
    EOT
  }
}

# A small admin-side log line so the operator can find the file later.
output "preauth_key_path" {
  value       = "/tmp/medbrains-${var.tenant_id}-preauth.json"
  description = "Path on the operator's machine where the single-use pre-auth key was written. Inject into onprem.tf via terraform.tfvars."
  depends_on  = [null_resource.headscale_preauth_key]
}

output "bridge_iam_role_arn" {
  value = aws_iam_role.bridge.arn
}

# ── Tenant DNS records (modules/dns) ──────────────────────────────────
# Three records for every tenant — headscale ALB, bridge ALB, api.
# Wired here so they share the cloud.tf provider context. Toggle off
# with `provision_dns = false` if the tenant manages DNS out-of-band.

locals {
  dns_record_prefix = var.dns_record_subdomain == "" ? "" : "${var.dns_record_subdomain}."
}

module "tenant_dns" {
  count  = var.provision_dns ? 1 : 0
  source = "../../../modules/dns"

  providers = {
    cloudflare   = cloudflare.tenant
    aws.dns      = aws.dns
    azurerm.dns  = azurerm.dns
    google.dns   = google.dns
    digitalocean = digitalocean.tenant
    namecheap    = namecheap.tenant
    godaddy-dns  = godaddy-dns.tenant
  }

  provider_kind             = var.dns_provider
  zone_name                 = var.dns_zone_name
  tenant_id                 = var.tenant_id
  azure_resource_group_name = var.dns_azure_resource_group
  google_project            = var.dns_google_project
  google_managed_zone       = var.dns_google_managed_zone
  namecheap_overwrite       = var.dns_namecheap_overwrite

  records = [
    {
      name = "${local.dns_record_prefix}headscale"
      type = "CNAME"
      # GoDaddy / similar registrars want a min TTL of 600s. Other
      # providers downgrade transparently.
      value = replace(var.headscale_url, "https://", "")
      ttl   = 600
    },
    {
      name  = "${local.dns_record_prefix}bridge-${var.tenant_id}"
      type  = "CNAME"
      value = "bridge.${var.dns_zone_name}"
      ttl   = 600
    },
    {
      name  = "${local.dns_record_prefix}api"
      type  = "CNAME"
      value = "api.${var.dns_zone_name}"
      ttl   = 600
    },
  ]
}

output "tenant_dns_records_managed" {
  description = "Number of DNS records managed by terraform for this tenant."
  value       = var.provision_dns ? module.tenant_dns[0].managed_record_count : 0
}
