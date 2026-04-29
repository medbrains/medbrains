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
      identifiers = ["arn:aws:iam::aws:oidc-provider/headscale.medbrains.cloud"]
    }
    condition {
      test     = "StringEquals"
      variable = "headscale.medbrains.cloud:sub"
      values   = ["tag:hospital-${var.tenant_id}"]
    }
  }
}

data "aws_iam_policy_document" "bridge" {
  statement {
    sid    = "AuditArchive"
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
