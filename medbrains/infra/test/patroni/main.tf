# Sprint B.7 — ephemeral Patroni test harness.
#
# Provisions JUST what's needed to validate the patroni-cluster module
# end-to-end: small KMS key, S3 WAL bucket with force_destroy, the
# Patroni cluster itself. Uses the default VPC's subnets so we don't
# stand up a whole VPC for a 1-hour test.
#
# Usage:
#   cd infra/test/patroni
#   terraform init
#   terraform apply        # ~$2-5/hour while running
#   # ... smoke test ...
#   terraform destroy      # cleans EVERYTHING
#
# Apply uses a local backend (no S3 state) so the destroy is self-contained.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = "ap-south-1"
  default_tags {
    tags = {
      Project          = "medbrains"
      Environment      = "test-ephemeral"
      ManagedBy        = "terraform"
      Sprint           = "B.7"
      DestroyAfterHours = "2"
      CostCode         = "engineering-test"
    }
  }
}

resource "random_id" "suffix" {
  byte_length = 3
}

locals {
  test_id = "patroni-test-${random_id.suffix.hex}"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── Default VPC + subnets ─────────────────────────────────────────────

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# ── KMS key for WAL archive encryption ────────────────────────────────

resource "aws_kms_key" "wal" {
  description             = "${local.test_id} WAL archive — ephemeral test"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_kms_alias" "wal" {
  name          = "alias/${local.test_id}"
  target_key_id = aws_kms_key.wal.key_id
}

# ── S3 bucket for pgBackRest WAL archive ──────────────────────────────

resource "aws_s3_bucket" "wal" {
  bucket        = "${local.test_id}-wal"
  force_destroy = true # ephemeral — wipe contents on destroy
}

resource "aws_s3_bucket_versioning" "wal" {
  bucket = aws_s3_bucket.wal.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "wal" {
  bucket = aws_s3_bucket.wal.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.wal.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "wal" {
  bucket                  = aws_s3_bucket.wal.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Patroni cluster — 3 PG nodes + 3 etcd nodes + NLB ────────────────

module "patroni" {
  source = "../../terraform/modules/patroni-cluster"

  region              = data.aws_region.current.name
  environment         = "test"
  vpc_id              = data.aws_vpc.default.id
  private_subnet_ids  = slice(data.aws_subnets.default.ids, 0, 3)
  kms_key_arn         = aws_kms_key.wal.arn
  wal_archive_bucket  = aws_s3_bucket.wal.arn
  instance_type       = "r7g.large"
  etcd_instance_type  = "t4g.small"
  pg_version          = "16"
  patroni_version     = "3.3"
  etcd_version        = "3.5"
  synchronous_replication = true
}

# ── Outputs ───────────────────────────────────────────────────────────

output "writer_endpoint" {
  value = module.patroni.writer_endpoint
}

output "reader_endpoint" {
  value = module.patroni.reader_endpoint
}

output "wal_bucket" {
  value = aws_s3_bucket.wal.id
}

output "test_id" {
  value = local.test_id
}

output "ssh_smoke_test_command" {
  value = <<-EOT
    # Connect via Session Manager (no SSH keys needed):
    aws ssm start-session --region ${data.aws_region.current.name} \
      --target $(aws ec2 describe-instances --region ${data.aws_region.current.name} \
        --filters "Name=tag:medbrains-pg-cluster,Values=medbrains-test-${data.aws_region.current.name}-pg" \
                  "Name=tag:medbrains-pg-node-id,Values=pg-1" \
        --query 'Reservations[0].Instances[0].InstanceId' --output text)

    # Once in:
    sudo -u postgres patronictl -c /etc/medbrains/patroni.yml list
    sudo -u postgres psql -h localhost -c "SELECT pg_is_in_recovery();"
  EOT
}

output "destroy_command" {
  value = "terraform destroy -auto-approve"
}
