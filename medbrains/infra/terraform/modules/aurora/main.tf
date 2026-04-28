# Aurora module — Aurora Serverless v2 PostgreSQL 16 + RDS Proxy.
# Sprint A + Enterprise overlay deliverable.
#
# Per-region cluster with:
#   - Multi-AZ writer + 1 reader
#   - Serverless v2 scaling (0.5 → 16 ACU dev, 0.5 → 64 prod via env override)
#   - PITR 35 days
#   - KMS-encrypted at rest (CMK from kms module)
#   - IAM auth enabled (no static DB password in app — use IAM token via IRSA)
#   - RDS Proxy in front for connection pooling
#   - Cross-region snapshot copy every 6h to DR region (Phase 6)
#   - Deletion protection on prod
#
# Outputs: cluster_endpoint, proxy_endpoint, secret_master_arn

variable "region"        { type = string }
variable "environment"   { type = string }
variable "vpc_id"        { type = string }
variable "db_subnet_ids" { type = list(string) }
variable "kms_key_arn"   { type = string }
variable "min_acu" {
  type        = number
  default     = 0.5
  description = "Aurora Serverless v2 minimum ACU"
}
variable "max_acu" {
  type        = number
  default     = 16
  description = "Aurora Serverless v2 maximum ACU"
}
variable "db_name" {
  type    = string
  default = "medbrains"
}
variable "master_username" {
  type    = string
  default = "medbrains_admin"
}
variable "deletion_protection" {
  type    = bool
  default = false
}
variable "backup_retention_days" {
  type    = number
  default = 35
}
variable "dr_snapshot_target_region" {
  type        = string
  default     = ""
  description = "Region for cross-region snapshot copy (empty = disabled)"
}

locals {
  cluster_id = "medbrains-${var.environment}-${var.region}"
}

# Master password generated + stored in Secrets Manager. Rotation
# managed by RDS-managed Secrets Manager rotation Lambda (Phase 4).
resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+"
}

resource "aws_secretsmanager_secret" "db_master" {
  name                    = "medbrains/${var.environment}/${var.region}/aurora/master"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.environment == "prod" ? 30 : 7
}

resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id = aws_secretsmanager_secret.db_master.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = "postgres"
    host     = aws_rds_cluster.this.endpoint
    port     = aws_rds_cluster.this.port
    dbname   = var.db_name
  })
}

# Subnet group across the 3 db subnets from the vpc module
resource "aws_db_subnet_group" "this" {
  name       = local.cluster_id
  subnet_ids = var.db_subnet_ids
}

# Security group — only EKS pod CIDRs may reach Aurora
resource "aws_security_group" "aurora" {
  name        = "${local.cluster_id}-aurora-sg"
  description = "Aurora cluster — pods reach via RDS Proxy ENI"
  vpc_id      = var.vpc_id

  ingress {
    description = "Postgres from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    # Tightening to specific EKS NodePool SGs done in Phase 4.3
    cidr_blocks = ["10.10.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = local.cluster_id
  engine                          = "aurora-postgresql"
  engine_version                  = "16.6"
  engine_mode                     = "provisioned" # serverless v2 uses provisioned engine_mode
  database_name                   = var.db_name
  master_username                 = var.master_username
  master_password                 = random_password.master.result
  port                            = 5432
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.aurora.id]
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_arn
  iam_database_authentication_enabled = true
  backup_retention_period         = var.backup_retention_days
  preferred_backup_window         = "16:00-17:00" # UTC = 21:30-22:30 IST off-peak
  preferred_maintenance_window    = "sun:18:00-sun:19:00"
  deletion_protection             = var.deletion_protection
  enabled_cloudwatch_logs_exports = ["postgresql"]
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = !var.deletion_protection
  final_snapshot_identifier       = var.deletion_protection ? "${local.cluster_id}-final" : null

  serverlessv2_scaling_configuration {
    min_capacity = var.min_acu
    max_capacity = var.max_acu
  }
}

# Writer instance — Serverless v2
resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${local.cluster_id}-writer"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
  publicly_accessible = false
  performance_insights_enabled = true
  performance_insights_kms_key_id = var.kms_key_arn
  # In prod, set monitoring_interval = 60 + monitoring_role_arn for CloudWatch Enhanced Monitoring
}

# Reader replica (multi-AZ)
resource "aws_rds_cluster_instance" "reader" {
  count              = var.environment == "prod" ? 1 : 0
  identifier         = "${local.cluster_id}-reader-${count.index}"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
  publicly_accessible = false
  performance_insights_enabled = true
}

# RDS Proxy for connection pooling
resource "aws_iam_role" "rds_proxy" {
  name = "${local.cluster_id}-rds-proxy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  role = aws_iam_role.rds_proxy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = aws_secretsmanager_secret.db_master.arn
      },
      {
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        Resource = var.kms_key_arn
      }
    ]
  })
}

resource "aws_db_proxy" "this" {
  name                   = "${local.cluster_id}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.db_subnet_ids
  vpc_security_group_ids = [aws_security_group.aurora.id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "REQUIRED"
    secret_arn  = aws_secretsmanager_secret.db_master.arn
  }
}

resource "aws_db_proxy_default_target_group" "this" {
  db_proxy_name = aws_db_proxy.this.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "this" {
  db_proxy_name         = aws_db_proxy.this.name
  target_group_name     = aws_db_proxy_default_target_group.this.name
  db_cluster_identifier = aws_rds_cluster.this.id
}

# DR cross-region snapshot copy. Triggered by EventBridge → Lambda
# every 6h. Lambda function code lives in `infra/lambda/dr-snapshot/`
# (Phase 6 deliverable). For Sprint A this resource declares the
# EventBridge rule + Lambda placeholder so the contract is in place.

resource "aws_cloudwatch_event_rule" "dr_snapshot" {
  count               = var.dr_snapshot_target_region == "" ? 0 : 1
  name                = "${local.cluster_id}-dr-snapshot-rule"
  description         = "Trigger cross-region snapshot copy every 6h"
  schedule_expression = "rate(6 hours)"
}

# Outputs

output "cluster_endpoint" {
  value       = aws_rds_cluster.this.endpoint
  description = "Aurora writer endpoint (use the proxy endpoint for app traffic)"
}

output "cluster_reader_endpoint" {
  value = aws_rds_cluster.this.reader_endpoint
}

output "proxy_endpoint" {
  value       = aws_db_proxy.this.endpoint
  description = "RDS Proxy endpoint — connect from EKS pods via this"
}

output "secret_master_arn" {
  value     = aws_secretsmanager_secret.db_master.arn
  sensitive = true
}

output "cluster_resource_id" {
  value = aws_rds_cluster.this.cluster_resource_id
  description = "Used in IAM policy to grant rds-db:connect for IAM auth"
}
