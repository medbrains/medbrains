# Bridge Ingress — TLS-terminating ALB for the WSS fallback transport.
#
# Used when a hospital firewall blocks ALL outbound UDP/TCP except 443
# to specific hostnames, and even DERP can't form a tunnel. The bridge
# agent then opens a WebSocket-over-TLS to this ALB and tunnels its
# control + data through that one connection.
#
# Targets: medbrains-server pods listening on the WSS endpoint (port
# 8081 by default — separate from the public API on 443 to avoid mixing
# bridge protocol with regular API traffic). The pod selector lives in
# the EKS module / Flux manifests; this module just creates the LB.
#
# mTLS: v1 ships with TLS only. v2 will require client certs issued by
# the per-tenant intermediate CA (RFC-INFRA-2026-001). Add a
# certificate validation action via Lambda authorizer when needed.

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
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert for bridge.<your-domain>"
}

variable "target_pod_port" {
  type        = number
  default     = 8081
  description = "medbrains-server WSS endpoint port"
}

variable "allowed_cidrs" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "Restrict to known hospital WAN egress IPs once they sign on"
}

variable "deletion_protection" {
  type    = bool
  default = false
}

locals {
  name = "medbrains-${var.environment}-bridge"
}

# ── ALB security group ────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Bridge fallback ALB - 443 inbound from hospital WAN"
  vpc_id      = var.vpc_id

  ingress {
    description = "WSS from hospital WAN"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }
  egress {
    description = "To medbrains-server pod targets"
    from_port   = var.target_pod_port
    to_port     = var.target_pod_port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
}

resource "aws_lb" "bridge" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]

  enable_http2               = true
  idle_timeout               = 4000 # WSS connections may stay open hours
  drop_invalid_header_fields = true

  enable_deletion_protection = var.deletion_protection
}

resource "aws_lb_target_group" "bridge_wss" {
  name        = "${local.name}-tg"
  port        = var.target_pod_port
  protocol    = "HTTP" # WS upgrade happens at app layer; ALB sees HTTP/1.1
  target_type = "ip"   # EKS pod IPs (Cilium / VPC CNI)
  vpc_id      = var.vpc_id

  health_check {
    path                = "/bridge/health"
    protocol            = "HTTP"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  stickiness {
    enabled = true
    type    = "lb_cookie"
    # Long stickiness because WSS is long-lived
    cookie_duration = 86400
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.bridge.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bridge_wss.arn
  }
}

# ── Outputs ───────────────────────────────────────────────────────────

output "alb_dns_name" {
  value = aws_lb.bridge.dns_name
}

output "target_group_arn" {
  value       = aws_lb_target_group.bridge_wss.arn
  description = "Pass to EKS / Flux to register medbrains-server pods"
}

output "alb_arn" {
  value = aws_lb.bridge.arn
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
