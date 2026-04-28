# S3 module — 4 buckets per region:
#   1. medbrains-audit-archive-<region>  : Object Lock COMPLIANCE 7y (HIPAA/DPDP)
#   2. medbrains-static-<region>         : CloudFront origin for /apps/web/dist
#   3. medbrains-uploads-<region>        : patient uploads (PHI), Glacier after 90d
#   4. medbrains-tf-state-<region>       : managed by bootstrap module

variable "region"      { type = string }
variable "environment" { type = string }
variable "kms_key_arns" {
  type = object({
    app     = string
    db      = string
    audit   = string
    secrets = string
  })
}
variable "account_id" {
  type        = string
  description = "AWS account ID for bucket policy principals"
}

# 1. Audit archive — Object Lock compliance, 7-year retention
resource "aws_s3_bucket" "audit_archive" {
  bucket              = "medbrains-${var.environment}-audit-archive-${var.region}"
  force_destroy       = false
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "audit_archive" {
  bucket = aws_s3_bucket.audit_archive.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_archive" {
  bucket = aws_s3_bucket.audit_archive.id
  rule {
    default_retention {
      mode  = "COMPLIANCE" # cannot be shortened even by root account
      years = 7
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_archive" {
  bucket = aws_s3_bucket.audit_archive.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arns.audit
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "audit_archive" {
  bucket                  = aws_s3_bucket.audit_archive.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. Static assets — CloudFront origin
resource "aws_s3_bucket" "static" {
  bucket = "medbrains-${var.environment}-static-${var.region}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket                  = aws_s3_bucket.static.id
  block_public_acls       = true
  block_public_policy     = false # CloudFront OAC needs to read; policy added via cloudfront module
  ignore_public_acls      = true
  restrict_public_buckets = false
}

# 3. Patient uploads — PHI, KMS, lifecycle to Glacier
resource "aws_s3_bucket" "uploads" {
  bucket = "medbrains-${var.environment}-uploads-${var.region}"
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arns.app
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs

output "audit_archive_bucket" {
  value = aws_s3_bucket.audit_archive.id
}

output "audit_archive_arn" {
  value = aws_s3_bucket.audit_archive.arn
}

output "static_bucket" {
  value = aws_s3_bucket.static.id
}

output "static_bucket_arn" {
  value = aws_s3_bucket.static.arn
}

output "static_bucket_domain" {
  value = aws_s3_bucket.static.bucket_regional_domain_name
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}
