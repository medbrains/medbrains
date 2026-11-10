# Customer-managed KMS key for an encrypted SNS topic.
#
# Why not alias/aws/sns: CloudWatch alarms (and SES, EventBridge) cannot
# publish to a topic encrypted with the AWS-managed key, because its key
# policy cannot be edited to admit them. An alarm topic on that key fails
# silently - the exact failure these alarms exist to report. This key
# names the publishing services in its policy; IAM principals in the
# account (a host that publishes its own failures) still need
# kms:GenerateDataKey + kms:Decrypt in their IAM policy.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "name" {
  type        = string
  description = "Topic name this key protects; used in the description."
}

variable "service_principals" {
  type        = list(string)
  default     = ["cloudwatch.amazonaws.com"]
  description = "AWS services that publish to the topic."
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

resource "aws_kms_key" "this" {
  description             = "SNS topic ${var.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = var.tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Same as the default key policy: IAM in this account decides.
        Sid       = "AccountAdmin"
        Effect    = "Allow"
        Principal = { AWS = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "PublishingServices"
        Effect    = "Allow"
        Principal = { Service = var.service_principals }
        Action    = ["kms:Decrypt", "kms:GenerateDataKey*"]
        Resource  = "*"
      },
    ]
  })
}

output "key_arn" {
  value = aws_kms_key.this.arn
}
