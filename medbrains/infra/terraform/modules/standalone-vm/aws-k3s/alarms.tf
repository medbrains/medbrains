# CloudWatch alarms for the Enterprise-k3s tier.
#
# This shape boots a real EC2 node (aws_instance.node) carrying the
# whole k3s control plane and workload, and until this file existed it
# had strictly less detection than Starter - a cheaper tier watching a
# smaller blast radius.
#
# Mirrors modules/standalone-vm/aws-ec2/alarms.tf. The auto-recover and
# auto-reboot actions are the reason these live here rather than being
# replaced by an outside-in health check: Route53 can tell you the node
# is gone, but only CloudWatch can bring it back.

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

# Hardware/hypervisor failure -> AWS auto-recovers the instance
# (same instance ID, same EIP, same EBS).
resource "aws_cloudwatch_metric_alarm" "system_status" {
  alarm_name          = "${var.hostname}-system-status-failed"
  alarm_description   = "EC2 system status check failed - auto-recovering"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 2

  # A terminated or stopped node publishes no status metric at all.
  # Without this the alarm goes INSUFFICIENT_DATA and fires nothing.
  treat_missing_data = "breaching"

  dimensions = {
    InstanceId = aws_instance.node.id
  }

  alarm_actions = [
    "arn:aws:automate:${data.aws_region.current.name}:ec2:recover",
    aws_sns_topic.alerts.arn,
  ]
  ok_actions = [aws_sns_topic.alerts.arn]
}

# OS-level hang -> reboot.
resource "aws_cloudwatch_metric_alarm" "instance_status" {
  alarm_name          = "${var.hostname}-instance-status-failed"
  alarm_description   = "EC2 instance status check failed - rebooting"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 3

  treat_missing_data = "breaching"

  dimensions = {
    InstanceId = aws_instance.node.id
  }

  alarm_actions = [
    "arn:aws:automate:${data.aws_region.current.name}:ec2:reboot",
    aws_sns_topic.alerts.arn,
  ]
  ok_actions = [aws_sns_topic.alerts.arn]
}

# Burstable nodes grind to a halt when credits run out, long before
# CPUUtilization looks alarming - which is why there is no cpu_high
# alarm here. aws-ec2/alarms.tf documents the same choice.
resource "aws_cloudwatch_metric_alarm" "cpu_credits_low" {
  count               = local.is_burstable ? 1 : 0
  alarm_name          = "${var.hostname}-cpu-credits-low"
  alarm_description   = "CPU credit balance below 20 - throttling imminent"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 20
  period              = 300
  evaluation_periods  = 2

  dimensions = {
    InstanceId = aws_instance.node.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Autoscaling handles storage growth; this is for the ceiling reached.
# Absolute byte floor derived from max_allocated_storage, not a
# percentage of allocated_storage - see aws-fargate/alarms.tf.
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

data "aws_region" "current" {}
