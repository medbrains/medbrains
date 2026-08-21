# Growth tier — ECS Fargate + RDS + S3 + ALB.
#
# Phase 1 scaffold. Resources below are intentionally minimal and
# declared with placeholder defaults that may need adjustment for
# a real hospital deploy. End-to-end apply tests ship in a follow-up
# PR alongside the Helm chart + ECR push work.

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
variable "image_uri" { type = string }
variable "fargate_task_cpu" { type = number }
variable "fargate_task_memory" { type = number }
variable "rds_instance_class" { type = string }
variable "scale_to_zero_at_night" { type = bool }
variable "hot_to_cold_days" { type = number }
variable "kms_key_arns" {
  description = "Optional hospital-scoped KMS CMKs by purpose: app, db, audit, secrets."
  type        = map(string)
  default     = {}
}

variable "container_port" {
  type    = number
  default = 3000
}

# Use the default VPC for now. Real Growth deploys typically want a
# dedicated VPC — that lands in Phase 2 along with VPC endpoints for
# RDS / S3 / ECR.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── Networking ────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${var.hostname}-alb-sg"
  description = "ALB ingress 80/443"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP - ACME + redirect"
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

  tags = local.tags
}

resource "aws_security_group" "service" {
  name        = "${var.hostname}-svc-sg"
  description = "Fargate task ingress from ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "App port from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "db" {
  name        = "${var.hostname}-db-sg"
  description = "RDS ingress from Fargate task"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres from service"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

# ── ALB ───────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${var.hostname}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
  tags               = local.tags
}

resource "aws_lb_target_group" "this" {
  name        = "${var.hostname}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# ── ECS cluster + task + service ──────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${var.hostname}-cluster"
  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

resource "aws_iam_role" "task_execution" {
  name = "${var.hostname}-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${var.hostname}-task-execution-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = [aws_secretsmanager_secret.db_url.arn]
      }],
      local.secrets_kms_key_arn == null ? [] : [{
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
        ]
        Resource = [local.secrets_kms_key_arn]
      }]
    )
  })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.hostname}"
  retention_in_days = 30
  kms_key_id        = local.audit_kms_key_arn
  tags              = local.tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.hostname
  cpu                      = var.fargate_task_cpu
  memory                   = var.fargate_task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([{
    name      = "medbrains-server"
    image     = var.image_uri
    essential = true
    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]
    environment = [
      { name = "MEDBRAINS_DOMAIN", value = var.domain },
      { name = "MEDBRAINS_ADMIN_EMAIL", value = var.admin_email },
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.this.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "ecs"
      }
    }
  }])

  depends_on = [aws_secretsmanager_secret_version.db_url]
  tags       = local.tags
}

data "aws_region" "current" {}

resource "aws_ecs_service" "this" {
  name             = var.hostname
  cluster          = aws_ecs_cluster.this.id
  task_definition  = aws_ecs_task_definition.this.arn
  desired_count    = 1
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = "medbrains-server"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
  tags       = local.tags
}

# ── Autoscaling ───────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "this" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.hostname}-cpu-tt"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 60
  }
}

# Scale-to-zero overnight (opt-in via var.scale_to_zero_at_night).
# 21:00 IST = 15:30 UTC; 07:00 IST = 01:30 UTC.

resource "aws_iam_role" "scheduler" {
  count = var.scale_to_zero_at_night ? 1 : 0
  name  = "${var.hostname}-scheduler"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler" {
  count = var.scale_to_zero_at_night ? 1 : 0
  role  = aws_iam_role.scheduler[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["application-autoscaling:RegisterScalableTarget"]
      Resource = "*"
    }]
  })
}

resource "aws_scheduler_schedule" "scale_down" {
  count = var.scale_to_zero_at_night ? 1 : 0
  name  = "${var.hostname}-scale-down"

  flexible_time_window { mode = "OFF" }
  schedule_expression = "cron(30 15 * * ? *)"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:applicationautoscaling:registerScalableTarget"
    role_arn = aws_iam_role.scheduler[0].arn
    input = jsonencode({
      ServiceNamespace  = "ecs"
      ResourceId        = aws_appautoscaling_target.this.resource_id
      ScalableDimension = aws_appautoscaling_target.this.scalable_dimension
      MinCapacity       = 0
      MaxCapacity       = 0
    })
  }
}

resource "aws_scheduler_schedule" "scale_up" {
  count = var.scale_to_zero_at_night ? 1 : 0
  name  = "${var.hostname}-scale-up"

  flexible_time_window { mode = "OFF" }
  schedule_expression = "cron(30 1 * * ? *)"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:applicationautoscaling:registerScalableTarget"
    role_arn = aws_iam_role.scheduler[0].arn
    input = jsonencode({
      ServiceNamespace  = "ecs"
      ResourceId        = aws_appautoscaling_target.this.resource_id
      ScalableDimension = aws_appautoscaling_target.this.scalable_dimension
      MinCapacity       = 1
      MaxCapacity       = 4
    })
  }
}

# ── RDS ──────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name       = "${var.hostname}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = local.tags
}

resource "random_password" "db" {
  length  = 32
  special = false
}

# DB HA + teardown knobs — default prod-safe; non-prod (test/demo) sets both
# false to halve RDS cost and allow `terraform destroy`.
variable "multi_az" {
  type        = bool
  default     = true
  description = "Multi-AZ standby. Set false in non-prod to halve RDS cost."
}
variable "deletion_protection" {
  type        = bool
  default     = true
  description = "true also forces a final snapshot on destroy. Set false in non-prod so teardown succeeds."
}

resource "aws_db_instance" "this" {
  identifier                = "${var.hostname}-pg"
  engine                    = "postgres"
  engine_version            = "17.2"
  instance_class            = var.rds_instance_class
  allocated_storage         = 20
  storage_type              = "gp3"
  storage_encrypted         = true
  kms_key_id                = local.db_kms_key_arn
  db_name                   = "medbrains"
  username                  = "medbrains_admin"
  password                  = random_password.db.result
  multi_az                  = var.multi_az
  publicly_accessible       = false
  db_subnet_group_name      = aws_db_subnet_group.this.name
  vpc_security_group_ids    = [aws_security_group.db.id]
  backup_retention_period   = 7
  final_snapshot_identifier = "${var.hostname}-pg-final-snapshot"
  skip_final_snapshot       = !var.deletion_protection
  deletion_protection       = var.deletion_protection

  tags = local.tags
}

resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.hostname}/database-url"
  kms_key_id              = local.secrets_kms_key_arn
  recovery_window_in_days = 30
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "postgres://medbrains_admin:${random_password.db.result}@${aws_db_instance.this.endpoint}/medbrains?sslmode=require"
}

# ── S3 hot bucket with lifecycle to STANDARD_IA ──────────────────────

resource "aws_s3_bucket" "this" {
  bucket = "${var.hostname}-mrd"
  tags   = local.tags
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
      sse_algorithm     = local.app_kms_key_arn == null ? "AES256" : "aws:kms"
      kms_master_key_id = local.app_kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "hot-to-cold"
    status = "Enabled"

    filter {}

    transition {
      days          = var.hot_to_cold_days
      storage_class = "STANDARD_IA"
    }
  }
}

# ── Tags ──────────────────────────────────────────────────────────────

locals {
  app_kms_key_arn     = lookup(var.kms_key_arns, "app", null)
  db_kms_key_arn      = lookup(var.kms_key_arns, "db", null)
  audit_kms_key_arn   = lookup(var.kms_key_arns, "audit", null)
  secrets_kms_key_arn = lookup(var.kms_key_arns, "secrets", null)

  tags = {
    Name      = var.hostname
    Project   = "medbrains"
    Tier      = "growth"
    ManagedBy = "terraform"
  }
}

# ── Outputs ───────────────────────────────────────────────────────────

output "public_endpoint" {
  value = aws_lb.this.dns_name
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_name" {
  value = aws_ecs_service.this.name
}

output "db_endpoint" {
  value = aws_db_instance.this.endpoint
}

output "bucket_name" {
  value = aws_s3_bucket.this.id
}
