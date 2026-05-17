terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "hostname" { type = string }
variable "domain" { type = string }
variable "admin_email" { type = string }
variable "edge_proxy" {
  type    = string
  default = "pingora"
  validation {
    condition     = var.edge_proxy == "pingora"
    error_message = "edge_proxy must be pingora."
  }
}
variable "instance_type" { type = string }
variable "ami" { type = string }
variable "ssh_key_name" { type = string }
variable "ssh_user" { type = string }
variable "ssh_private_key" {
  type      = string
  sensitive = true
}
variable "ssh_private_key_path" {
  type    = string
  default = ""
}
variable "binaries_dir" { type = string }
variable "spa_dist_dir" { type = string }
variable "deploy_kit_dir" { type = string }
variable "kms_key_arns" {
  description = "Optional hospital-scoped KMS CMKs by purpose: app, db, audit, secrets."
  type        = map(string)
  default     = {}
}

variable "reset_pgdata" {
  description = "Set to true to wipe the postgres named volume on next apply. Use only when migrations are incompatible with existing data (e.g. major sqlx bump on a fresh deploy). Never with real prod data."
  type        = bool
  default     = false
}

# Use the default VPC + a default subnet in this region — keeps the
# kit minimal. If the account doesn't have a default VPC (e.g. a
# managed enterprise account), pre-create one and pass it via a
# follow-up `vpc_id` var.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Architecture inference from instance-type family. Anything ending
# in "g.*" (or "gd", "gn", etc.) is Graviton ARM (t4g, m6g, c7g…).
# Everything else is x86_64.
locals {
  is_arm             = can(regex("^[a-z][0-9]+g[a-z]*\\.", var.instance_type))
  arch               = local.is_arm ? "arm64" : "amd64"
  app_kms_key_arn    = lookup(var.kms_key_arns, "app", null)
  audit_kms_key_arn  = lookup(var.kms_key_arns, "audit", null)
  backup_kms_key_arn = local.audit_kms_key_arn != null ? local.audit_kms_key_arn : local.app_kms_key_arn
}

# Auto-resolve latest Canonical Ubuntu 24.04 AMI matching the arch
# unless the operator pinned one via var.ami.
data "aws_ami" "ubuntu" {
  count       = var.ami == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-${local.arch}-server-*"]
  }
  filter {
    name   = "architecture"
    values = [local.arch == "arm64" ? "arm64" : "x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "this" {
  name        = "${var.hostname}-sg"
  description = "MedBrains standalone - 22/80/443 inbound"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP - ACME challenge + redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "${var.hostname}-sg"
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "aws_instance" "this" {
  ami                    = var.ami != "" ? var.ami : data.aws_ami.ubuntu[0].id
  instance_type          = var.instance_type
  key_name               = var.ssh_key_name
  vpc_security_group_ids = [aws_security_group.this.id]
  subnet_id              = data.aws_subnets.default.ids[0]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  root_block_device {
    volume_size = 40
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = local.app_kms_key_arn
    tags = {
      Name           = "${var.hostname}-root"
      Project        = "medbrains"
      ManagedBy      = "terraform"
      SnapshotPolicy = "daily"
    }
  }

  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name      = var.hostname
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

# Elastic IP so DNS doesn't break on stop/start.
resource "aws_eip" "this" {
  instance = aws_instance.this.id
  domain   = "vpc"

  tags = {
    Name      = "${var.hostname}-eip"
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "null_resource" "wait_for_ssh" {
  triggers = {
    eip_id      = aws_eip.this.id
    instance_id = aws_instance.this.id
    public_ip   = aws_eip.this.public_ip
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<EOT
set -euo pipefail
for _ in $(seq 1 30); do
  if ssh -i '${var.ssh_private_key_path}' -o StrictHostKeyChecking=no -o ConnectTimeout=10 '${var.ssh_user}@${aws_eip.this.public_ip}' 'echo ssh up'; then
    exit 0
  fi
  sleep 10
done
echo "ERROR: SSH did not become ready on ${aws_eip.this.public_ip}" >&2
exit 1
EOT
  }

  depends_on = [aws_eip.this]
}

resource "null_resource" "bootstrap" {
  triggers = {
    eip_id             = aws_eip.this.id
    edge_proxy         = var.edge_proxy
    spa_hash           = sha256(join("", [for f in sort(fileset(var.spa_dist_dir, "**")) : "${f}:${filesha256("${var.spa_dist_dir}/${f}")}"]))
    binaries_hash      = filemd5("${var.binaries_dir}/medbrains-server")
    archive_hash       = filemd5("${var.binaries_dir}/medbrains-archive")
    proxy_hash         = filemd5("${var.binaries_dir}/medbrains-proxy")
    edge_hash          = filemd5("${var.binaries_dir}/medbrains-edge")
    install_hash       = filemd5("${var.deploy_kit_dir}/install.sh")
    compose_hash       = filemd5("${var.deploy_kit_dir}/docker-compose.prod.yml")
    pingora_toml_hash  = filemd5("${var.deploy_kit_dir}/PingoraProxy.toml.tmpl")
    env_example_hash   = filemd5("${var.deploy_kit_dir}/env.example")
    server_unit_hash   = filemd5("${var.deploy_kit_dir}/medbrains-server.service")
    proxy_unit_hash    = filemd5("${var.deploy_kit_dir}/medbrains-proxy.service")
    edge_unit_hash     = filemd5("${var.deploy_kit_dir}/medbrains-edge.service")
    edge_config_hash   = filemd5("${var.deploy_kit_dir}/medbrains-edge.toml.tmpl")
    archive_unit_hash  = filemd5("${var.deploy_kit_dir}/medbrains-archive.service")
    archive_timer_hash = filemd5("${var.deploy_kit_dir}/medbrains-archive.timer")
    backup_script_hash = filemd5("${var.deploy_kit_dir}/medbrains-pg-backup")
    backup_unit_hash   = filemd5("${var.deploy_kit_dir}/medbrains-pg-backup.service")
    backup_timer_hash  = filemd5("${var.deploy_kit_dir}/medbrains-pg-backup.timer")
    proxy_cert_hook    = filemd5("${var.deploy_kit_dir}/copy-medbrains-proxy-cert")
    proxy_stop_hook    = filemd5("${var.deploy_kit_dir}/stop-medbrains-proxy")
    proxy_start_hook   = filemd5("${var.deploy_kit_dir}/start-medbrains-proxy")
    backup_bucket      = aws_s3_bucket.backups.id
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<EOT
set -euo pipefail
KEY='${var.ssh_private_key_path}'
HOST='${var.ssh_user}@${aws_eip.this.public_ip}'

ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" 'sudo rm -rf /tmp/standalone /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/medbrains-edge /tmp/medbrains-web'
scp -i "$KEY" -o StrictHostKeyChecking=no '${var.binaries_dir}/medbrains-server' '${var.binaries_dir}/medbrains-archive' '${var.binaries_dir}/medbrains-proxy' '${var.binaries_dir}/medbrains-edge' "$HOST:/tmp/"
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=no" '${var.spa_dist_dir}/' "$HOST:/tmp/medbrains-web/"
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=no" '${var.deploy_kit_dir}/' "$HOST:/tmp/standalone/"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" "chmod +x /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/medbrains-edge /tmp/standalone/install.sh /tmp/standalone/medbrains-pg-backup && sudo bash -c 'export RESET_PGDATA=${var.reset_pgdata ? "1" : "0"}; bash /tmp/standalone/install.sh ${var.domain} ${var.admin_email} ${aws_s3_bucket.backups.id} ${var.edge_proxy}'"
EOT
  }

  depends_on = [null_resource.wait_for_ssh]
}

# ── Disaster recovery: S3 backup bucket + IAM + DLM snapshots ────────

# Versioned, Object-Locked backup bucket. The systemd timer on the
# host pg_dumps daily and uploads to this bucket. Object Lock with
# 5y COMPLIANCE retention satisfies NABH/DPDP requirements + makes
# the backups ransomware-proof.
resource "aws_s3_bucket" "backups" {
  bucket              = "${var.hostname}-backups"
  force_destroy       = false
  object_lock_enabled = true

  tags = {
    Name      = "${var.hostname}-backups"
    Project   = "medbrains"
    ManagedBy = "terraform"
    Purpose   = "pg-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    default_retention {
      mode  = "COMPLIANCE"
      years = 5
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = local.backup_kms_key_arn == null ? "AES256" : "aws:kms"
      kms_master_key_id = local.backup_kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "cold-tier-after-90d"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Object Lock still enforces 5y minimum retention; Glacier just
    # changes storage class, not deletion eligibility.
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }
  }
}

# IAM: EC2 instance profile that can PutObject + sync to the backup
# bucket. Read scoped tightly via aws_iam_policy below.
resource "aws_iam_role" "instance" {
  name = "${var.hostname}-instance"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_policy" "backup_writer" {
  name = "${var.hostname}-backup-writer"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*",
        ]
      }],
      local.backup_kms_key_arn == null ? [] : [{
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey",
        ]
        Resource = [local.backup_kms_key_arn]
      }]
    )
  })
}

resource "aws_iam_role_policy_attachment" "backup_writer" {
  role       = aws_iam_role.instance.name
  policy_arn = aws_iam_policy.backup_writer.arn
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.hostname}-instance"
  role = aws_iam_role.instance.name
}

# ── DLM: daily EBS snapshots, retained 30 days ────────────────────────

resource "aws_iam_role" "dlm" {
  name = "${var.hostname}-dlm"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "daily_snapshots" {
  description        = "${var.hostname} daily EBS snapshot 30d retention"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    target_tags = {
      SnapshotPolicy = "daily"
    }

    schedule {
      name = "daily-snap"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["02:30"] # 02:30 UTC = 08:00 IST
      }

      retain_rule {
        count = 30
      }

      copy_tags = true
      tags_to_add = {
        SnapshotCreator = "dlm"
        Project         = "medbrains"
      }
    }
  }
}

output "public_ip" {
  value = aws_eip.this.public_ip
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.id
}

output "ssh_endpoint" {
  value = "${var.ssh_user}@${aws_eip.this.public_ip}"
}
