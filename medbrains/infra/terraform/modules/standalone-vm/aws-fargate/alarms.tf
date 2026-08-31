# CloudWatch alarms for the Growth tier (Fargate + ALB + RDS).
#
# This shape runs desired_count = 1. There is no second task to absorb a
# crash, so the ALB pulling the only target IS the outage - the hospital
# goes dark and, until this file existed, nothing said so.
#
# Two alarms, deliberately. Everything else considered is listed at the
# bottom with the reason it was rejected; a tier whose whole infra bill
# is single-digit dollars cannot afford alarms that get muted.

resource "aws_sns_topic" "alerts" {
  name = "${var.hostname}-alerts"

  tags = {
    Project   = "medbrains"
    ManagedBy = "terraform"
  }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# The single task is gone and the ALB has nothing to route to.
#
#
# treat_missing_data = "breaching" because a deleted service publishes
# nothing at all: without it the alarm goes INSUFFICIENT_DATA and stays
# silent on the most total version of the failure.
resource "aws_cloudwatch_metric_alarm" "no_healthy_targets" {
  count               = var.scale_to_zero_at_night ? 0 : 1
  alarm_name          = "${var.hostname}-no-healthy-targets"
  alarm_description   = "ALB has zero healthy targets - the tier is down"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  period              = 60
  # 5, not 3: no datapoints exist until the first target registers, and a
  # cold start with an image pull can exceed three minutes - otherwise
  # every first apply opens with a false outage page.
  evaluation_periods = 5
  treat_missing_data = "breaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.this.arn_suffix
    LoadBalancer = aws_lb.this.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Storage autoscaling (max_allocated_storage on aws_db_instance.this)
# handles growth on its own. This alarm is for the state autoscaling
# cannot fix: the ceiling reached.
#
# The threshold is an absolute byte floor BELOW every autoscale trigger
# point, not a percentage of allocated_storage. RDS acts at 10% of the
# CURRENT allocation - 2 GiB at 20 GB, rising to 8 GiB at the 80 GB
# ceiling - so any threshold above 2 GiB fires and clears at each
# intermediate step while autoscaling is working correctly. Six pages
# during ordinary growth is how an alarm gets muted.
#
# A percentage would be worse still: once autoscaling fires,
# allocated_storage no longer describes the real disk.
resource "aws_cloudwatch_metric_alarm" "rds_storage_floor" {
  alarm_name          = "${var.hostname}-rds-storage-floor"
  alarm_description   = "RDS free storage below 2 GiB and autoscaling has not acted - writes will start failing"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  comparison_operator = "LessThanThreshold"
  threshold           = 2147483648
  period              = 300
  evaluation_periods  = 2

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Considered and rejected:
#
#   UnHealthyHostCount - inverts during the exact outage it should catch.
#     Once ECS deregisters a crash-looping task the metric reads 0 and the
#     alarm RESOLVES at the moment the hospital goes fully dark.
#
#   HTTPCode_ELB_5XX_Count - a second page for the same incident, plus
#     scanner noise on a public ALB.
#
#   AWS/ECS RunningTaskCount - does not exist in that namespace. It lives
#     in ECS/ContainerInsights, which this cluster does not enable, so the
#     alarm would sit in ALARM from apply-day.
#
#   RDS DatabaseConnections - not expressible. RDS Postgres defaults to
#     LEAST({DBInstanceClassMemory/9531392}, 5000), resolved at runtime
#     from instance memory, and rds_instance_class is a caller variable.
#     Any threshold here is a per-class constant that rots on resize.
#
#   RDS CPUUtilization / FreeableMemory - db.t4g.micro has a 10% CPU
#     baseline and Postgres deliberately fills memory with page cache.
#     Both are chronically "bad" by design; both get muted in a month.
