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

resource "aws_s3_bucket" "tf_state" {
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
      sse_algorithm = "AES256"
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

resource "aws_dynamodb_table" "tf_locks" {
  name         = "medbrains-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}

output "state_bucket_name" {
  value = aws_s3_bucket.tf_state.id
}

output "lock_table_name" {
  value = aws_dynamodb_table.tf_locks.name
}
