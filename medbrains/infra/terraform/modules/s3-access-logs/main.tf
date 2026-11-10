# Server access log target for a module's data buckets.
#
# One per stack, shared by every bucket in it. Answers "who read this
# object, when, from where" for PHI, backups and Terraform state, which
# CloudWatch metrics cannot. The log bucket itself is deliberately plain:
# S3 cannot deliver server access logs to an SSE-KMS bucket, logging the
# log bucket would loop, and the logs expire on their own.
#
# Callers attach a source bucket with:
#   resource "aws_s3_bucket_logging" "x" {
#     bucket        = aws_s3_bucket.x.id
#     target_bucket = module.access_logs.bucket_id
#     target_prefix = "x/"
#   }

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "bucket_name" {
  type        = string
  description = "Name of the log bucket (globally unique, <= 63 chars)."
}

variable "retention_days" {
  type        = number
  default     = 365
  description = "Days an access-log object is kept. One year covers a NABH/DPDP access review."
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow terraform destroy to empty the bucket. Keep false where the source bucket holds PHI."
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "this" { # NOSONAR(S6258): access-log target; logging it to itself would loop
  #checkov:skip=CKV_AWS_18: this is the access-log target; logging it to itself would loop
  #checkov:skip=CKV_AWS_144: access logs are an audit trail, not a dataset; a second-region copy doubles the cost for no recovery value
  #checkov:skip=CKV2_AWS_62: nothing consumes events from the log bucket
  #checkov:skip=CKV_AWS_145: S3 cannot deliver server access logs to an SSE-KMS bucket; SSE-S3 is the only supported default
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
  tags          = var.tags
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioned so a log line cannot be silently overwritten; old versions
# go after 30 days.
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "expire-access-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = var.retention_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# The S3 logging service writes here (only on behalf of this account);
# nothing is accepted over plain HTTP.
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "S3ServerAccessLogsDelivery"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.this.arn}/*"
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.this]
}

output "bucket_id" {
  value       = aws_s3_bucket.this.id
  description = "Pass as target_bucket to aws_s3_bucket_logging."
}
