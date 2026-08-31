# External uptime synthetics for a single public endpoint (audit P1).
#
# Route53 health checkers probe /api/health from multiple AWS regions
# ($0.50 base + $1.00 HTTPS = ~$1.50/mo) — true outside-in monitoring, unlike instance
# alarms which can't see a hung-but-running server. Route53 publishes
# the HealthCheckStatus metric ONLY in us-east-1, so the alarm + SNS
# topic live there via the aws.us_east_1 provider alias. Wire this
# module from the ENV (which defines the us-east-1 provider) — not
# through the tier router, so non-AWS tiers stay alias-free.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.50"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "name" {
  description = "Resource name prefix (e.g. the hostname)."
  type        = string
}

variable "domain" {
  description = "Public FQDN to probe over HTTPS."
  type        = string
}

variable "resource_path" {
  description = "HTTP path probed by the health checkers."
  type        = string
  default     = "/api/health"
}

variable "alarm_email" {
  description = "Email for down notifications. Empty = topic without subscription."
  type        = string
  default     = ""
}

resource "aws_route53_health_check" "api" {
  # Several attributes here (measure_latency among them) force
  # replacement. Without this, Terraform destroys the check before
  # creating its replacement - and the alarm below treats missing data as
  # breaching, so the gap pages as a site outage that never happened.
  lifecycle {
    create_before_destroy = true
  }

  fqdn              = var.domain
  type              = "HTTPS"
  port              = 443
  resource_path     = var.resource_path
  request_interval  = 30
  failure_threshold = 3
  # Latency measurement is a $2.00/mo option and no alarm reads it.
  measure_latency = false

  tags = {
    Name      = "${var.name}-uptime"
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "aws_sns_topic" "uptime" {
  provider = aws.us_east_1
  name     = "${var.name}-uptime-alerts"

  tags = {
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "aws_sns_topic_subscription" "uptime_email" {
  count     = var.alarm_email == "" ? 0 : 1
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.uptime.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "endpoint_down" {
  provider            = aws.us_east_1
  alarm_name          = "${var.name}-endpoint-down"
  alarm_description   = "HTTPS /api/health failing from Route53 health checkers"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  statistic           = "Minimum"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 3
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.api.id
  }

  alarm_actions = [aws_sns_topic.uptime.arn]
  ok_actions    = [aws_sns_topic.uptime.arn]
}

output "health_check_id" {
  value = aws_route53_health_check.api.id
}
