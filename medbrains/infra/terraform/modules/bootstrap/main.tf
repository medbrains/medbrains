# Bootstrap module — creates the per-region state bucket and DynamoDB
# lock table that all other Terraform stacks depend on.
#
# Run ONCE per region with local state. After successful apply, migrate
# state into the bucket via `terraform init -migrate-state`.
#
# Inputs: region.
# Outputs: state_bucket_name, lock_table_name.

variable "region" { type = string }
variable "environment" {
  type    = string
  default = "shared"
}

module "access_logs" {
  source      = "../s3-access-logs"
  bucket_name = "medbrains-tf-state-logs-${var.region}"
}

resource "aws_s3_bucket" "tf_state" {
  #checkov:skip=CKV_AWS_144: state is versioned and rebuildable from the stacks; a replica would need a second-region bootstrap that itself needs state
  #checkov:skip=CKV2_AWS_62: nothing consumes object events from the state bucket
  bucket        = "medbrains-tf-state-${var.region}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      # State holds generated passwords and keys: SSE-KMS (aws/s3 key),
      # so reading an object also needs kms:Decrypt and leaves a
      # CloudTrail record. Existing objects keep SSE-S3 until rewritten.
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Old state versions are the rollback path for a bad apply; a year of them.
resource "aws_s3_bucket_lifecycle_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    id     = "state-history"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "tf_state" {
  bucket        = aws_s3_bucket.tf_state.id
  target_bucket = module.access_logs.bucket_id
  target_prefix = "tf-state/"
}

# Refuse plain HTTP: every client (SDK, CLI, presigned URL) already uses TLS.
resource "aws_s3_bucket_policy" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.tf_state.arn, "${aws_s3_bucket.tf_state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.tf_state]
}

resource "aws_dynamodb_table" "tf_locks" {
  #checkov:skip=CKV_AWS_119: the table holds only lock IDs and state digests; the AWS-owned key is enough and a CMK would add a key policy every operator needs
  name         = "medbrains-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "state_bucket_name" {
  value = aws_s3_bucket.tf_state.id
}

output "lock_table_name" {
  value = aws_dynamodb_table.tf_locks.name
}
