# CloudWatch alarms + auto-recovery for the single-host Starter tier
# (audit P0 #12/#14). Disk-usage alarms need the CloudWatch agent on
# the host — tracked separately; status/CPU/credit cover the
# instance-death and saturation failure modes.

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

# Hardware/hypervisor failure → AWS auto-recovers the instance
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

  dimensions = {
    InstanceId = aws_instance.this.id
  }

  alarm_actions = [
    "arn:aws:automate:${data.aws_region.current.name}:ec2:recover",
    aws_sns_topic.alerts.arn,
  ]
}

# OS-level hang → reboot.
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

  dimensions = {
    InstanceId = aws_instance.this.id
  }

  alarm_actions = [
    "arn:aws:automate:${data.aws_region.current.name}:ec2:reboot",
    aws_sns_topic.alerts.arn,
  ]
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.hostname}-cpu-high"
  alarm_description   = "CPU above 80% for 15 minutes"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  period              = 300
  evaluation_periods  = 3

  dimensions = {
    InstanceId = aws_instance.this.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Burstable (t-family) instances grind to a halt when credits run out
# long before CPUUtilization looks alarming.
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
    InstanceId = aws_instance.this.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

data "aws_region" "current" {}
