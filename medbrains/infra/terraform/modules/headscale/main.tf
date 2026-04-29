# Headscale — self-hosted Tailscale-protocol control plane.
#
# This module stands up the open-source `juanfont/headscale` Go binary
# on a single t4g.small EC2 instance behind an ALB. WireGuard data
# plane traffic between hospital clusters and cloud pods is peer-to-
# peer over the headscale-coordinated mesh; this module only runs the
# control plane (issues pre-auth keys, holds the ACL, runs DERP relay).
#
# Why not EKS? Headscale is a single binary with sqlite state — running
# it on its own EC2 is cheaper, has fewer moving parts, and its uptime
# is independent of the EKS cluster (which we may upgrade or replace).
# Existing peer-to-peer tunnels keep working when headscale is down;
# only NEW peer registration needs the control plane.
#
# Persistence: sqlite on encrypted EBS gp3, replicated to S3 every 60s
# via Litestream. Restart on a fresh instance pulls state from S3 in
# ~5 seconds; no manual recovery.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "environment" {
  type        = string
  description = "dev / staging / prod"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "ALB subnets (must be public — Headscale ALB is the entry point hospitals reach)"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "EC2 subnet (private with NAT egress for litestream/SSM)"
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key for EBS volume + Litestream S3 + Secrets Manager"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert for headscale.<your-domain>"
}

variable "headscale_dns_name" {
  type        = string
  description = "Public hostname Hospitals will use, e.g. headscale.medbrains.cloud"
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "headscale_version" {
  type    = string
  default = "0.23.0"
}

variable "litestream_s3_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for Litestream sqlite replication"
}

variable "allowed_egress_cidrs" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "Egress allowed from the headscale instance (NAT GW network)"
}

locals {
  name        = "medbrains-${var.environment}-headscale"
  derp_port   = 3478
  api_port    = 8080
  metrics_port = 9090
}

# ── ARM64 AL2023 AMI for the headscale instance ───────────────────────

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["137112412989"] # amazon
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# ── IAM ───────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "headscale" {
  name               = "${local.name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.headscale.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "headscale" {
  statement {
    sid       = "LitestreamS3"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = [var.litestream_s3_bucket_arn, "${var.litestream_s3_bucket_arn}/*"]
  }
  statement {
    sid       = "KmsForS3AndEbs"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "headscale" {
  role   = aws_iam_role.headscale.id
  policy = data.aws_iam_policy_document.headscale.json
}

resource "aws_iam_instance_profile" "headscale" {
  name = "${local.name}-profile"
  role = aws_iam_role.headscale.name
}

# ── Security groups ───────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Headscale ALB - 443 from internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from internet (hospital clusters reach control plane here)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = var.allowed_egress_cidrs
  }
}

resource "aws_security_group" "ec2" {
  name        = "${local.name}-ec2-sg"
  description = "Headscale EC2 - API from ALB + DERP UDP from internet (NAT-traversal)"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Headscale API from ALB"
    from_port       = local.api_port
    to_port         = local.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  ingress {
    description = "DERP STUN/relay UDP from internet"
    from_port   = local.derp_port
    to_port     = local.derp_port
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = var.allowed_egress_cidrs
  }
}

# ── Headscale config rendered + dropped via cloud-init ────────────────

locals {
  user_data = templatefile("${path.module}/files/cloud-init.yaml.tmpl", {
    headscale_version = var.headscale_version
    headscale_dns     = var.headscale_dns_name
    api_port          = local.api_port
    derp_port         = local.derp_port
    metrics_port      = local.metrics_port
    s3_bucket_path    = replace(var.litestream_s3_bucket_arn, "arn:aws:s3:::", "")
  })
}

resource "aws_instance" "headscale" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.headscale.name
  user_data              = local.user_data

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    kms_key_id            = var.kms_key_arn
    delete_on_termination = true
  }

  # sqlite state on dedicated EBS so root volume is replaceable
  ebs_block_device {
    device_name           = "/dev/xvdf"
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    kms_key_id            = var.kms_key_arn
    delete_on_termination = false # KEEP — sqlite state survives instance replacement
  }

  tags = {
    Name      = local.name
    Component = "headscale"
  }

  lifecycle {
    ignore_changes = [ami] # don't replace on AMI rev — let SSM patching handle the OS
  }

  depends_on = [aws_iam_role_policy_attachment.ssm, aws_iam_role_policy.headscale]
}

# ── ALB on 443 → headscale API ────────────────────────────────────────

resource "aws_lb" "headscale" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]

  enable_http2 = true
}

resource "aws_lb_target_group" "headscale" {
  name        = "${local.name}-tg"
  port        = local.api_port
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
}

resource "aws_lb_target_group_attachment" "headscale" {
  target_group_arn = aws_lb_target_group.headscale.arn
  target_id        = aws_instance.headscale.id
  port             = local.api_port
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.headscale.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.headscale.arn
  }
}

# ── Outputs ───────────────────────────────────────────────────────────

output "alb_dns_name" {
  value       = aws_lb.headscale.dns_name
  description = "Use this for Route53 ALIAS at headscale.<domain>"
}

output "instance_id" {
  value = aws_instance.headscale.id
}

output "headscale_url" {
  value       = "https://${var.headscale_dns_name}"
  description = "LOGIN_SERVER for tailscale clients"
}

output "ec2_security_group_id" {
  value = aws_security_group.ec2.id
}
