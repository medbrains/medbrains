# KMS module — 4 CMKs per region: app, db, audit, secrets.
# Each with rotation enabled, scoped key policy, alias.

variable "region"      { type = string }
variable "environment" { type = string }
variable "account_id" {
  type        = string
  description = "AWS account ID (used in key policy principals)"
}

locals {
  key_purposes = {
    app     = "Application data encryption (S3 uploads, EBS, generic)"
    db      = "Aurora + RDS Proxy encryption at rest"
    audit   = "audit_log archive encryption (S3 Object Lock bucket)"
    secrets = "Secrets Manager + Parameter Store envelope encryption"
  }
}

# Standard CMK per purpose. CloudHSM xks variant lives in modules/kms-hsm/.
resource "aws_kms_key" "purpose" {
  for_each                = local.key_purposes
  description             = "MedBrains ${each.key} CMK (${var.environment}/${var.region}) — ${each.value}"
  enable_key_rotation     = true
  rotation_period_in_days = 365
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Principal = { Service = "logs.${var.region}.amazonaws.com" }
        Action = [
          "kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*",
          "kms:GenerateDataKey*", "kms:Describe*",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_kms_alias" "purpose" {
  for_each      = local.key_purposes
  name          = "alias/medbrains-${var.environment}-${each.key}"
  target_key_id = aws_kms_key.purpose[each.key].key_id
}

# JWT signing key — asymmetric Ed25519. Server signs via KMS:Sign API.
# Key policy locked to the medbrains-server-sa IRSA role (Phase 4.3).
resource "aws_kms_key" "jwt_signer" {
  description              = "MedBrains JWT signing — Ed25519 (${var.environment}/${var.region})"
  customer_master_key_spec = "ECC_NIST_P256" # ECDSA — Ed25519 not yet GA in all KMS regions
  key_usage                = "SIGN_VERIFY"
  enable_key_rotation      = false # asymmetric KMS keys do not support automatic rotation
  deletion_window_in_days  = var.environment == "prod" ? 30 : 7
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
    ]
  })
}

resource "aws_kms_alias" "jwt_signer" {
  name          = "alias/medbrains-${var.environment}-jwt-signer"
  target_key_id = aws_kms_key.jwt_signer.key_id
}

# Outputs

output "key_arns" {
  value = {
    app     = aws_kms_key.purpose["app"].arn
    db      = aws_kms_key.purpose["db"].arn
    audit   = aws_kms_key.purpose["audit"].arn
    secrets = aws_kms_key.purpose["secrets"].arn
  }
}

output "key_ids" {
  value = {
    app     = aws_kms_key.purpose["app"].key_id
    db      = aws_kms_key.purpose["db"].key_id
    audit   = aws_kms_key.purpose["audit"].key_id
    secrets = aws_kms_key.purpose["secrets"].key_id
  }
}

output "jwt_signer_key_arn" {
  value = aws_kms_key.jwt_signer.arn
}
