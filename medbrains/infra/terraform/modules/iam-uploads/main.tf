# IAM resources for MedBrains application server to generate S3 presigned URLs
# and perform direct object operations on the uploads bucket.
#
# Two modes:
#   ec2_instance_role_name != "" → attach policy to existing EC2 instance role
#   create_iam_user = true       → create a standalone IAM user + access key
#                                  (for on-prem / bare-metal deployments)

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "environment" { type = string }
variable "uploads_bucket_arn" { type = string }

variable "kms_key_arn" {
  type        = string
  description = "ARN of the KMS CMK used for SSE on the uploads bucket. Empty string = AES256 bucket (no KMS grant needed)."
  default     = ""
}

variable "ec2_instance_role_name" {
  type        = string
  description = "Existing EC2 IAM role name to attach the uploads policy to. Set to '' to skip."
  default     = ""
}

variable "create_iam_user" {
  type        = bool
  description = "Create an IAM user with access key for non-EC2 deployments."
  default     = false
}

# ── IAM policy: presigned upload (PUT) + download (GET) + delete ─────────

locals {
  kms_statement = var.kms_key_arn != "" ? [
    {
      Sid    = "KmsForSseKms"
      Effect = "Allow"
      Action = [
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:DescribeKey",
      ]
      Resource = [var.kms_key_arn]
    }
  ] : []
}

resource "aws_iam_policy" "uploads_rw" {
  name        = "medbrains-${var.environment}-uploads-rw"
  description = "MedBrains app server: generate presigned URLs + manage objects in uploads bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "S3ObjectOps"
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:GetObjectAttributes",
          ]
          Resource = ["${var.uploads_bucket_arn}/*"]
        },
        {
          Sid    = "S3BucketOps"
          Effect = "Allow"
          Action = [
            "s3:ListBucket",
            "s3:GetBucketLocation",
          ]
          Resource = [var.uploads_bucket_arn]
        },
      ],
      local.kms_statement,
    )
  })

  tags = {
    Project     = "medbrains"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Attach to existing EC2 instance role (aws-ec2 / standalone-vm) ───────

resource "aws_iam_role_policy_attachment" "uploads_rw" {
  count      = var.ec2_instance_role_name != "" ? 1 : 0
  role       = var.ec2_instance_role_name
  policy_arn = aws_iam_policy.uploads_rw.arn
}

# ── IAM user for non-EC2 (on-prem / bare-metal) ──────────────────────────

resource "aws_iam_user" "app_uploads" {
  count = var.create_iam_user ? 1 : 0
  name  = "medbrains-${var.environment}-app-uploads"
  path  = "/medbrains/"
  tags = {
    Project     = "medbrains"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_user_policy_attachment" "app_uploads" {
  count      = var.create_iam_user ? 1 : 0
  user       = aws_iam_user.app_uploads[0].name
  policy_arn = aws_iam_policy.uploads_rw.arn
}

resource "aws_iam_access_key" "app_uploads" {
  count = var.create_iam_user ? 1 : 0
  user  = aws_iam_user.app_uploads[0].name
}

# Store credentials in Secrets Manager so they can be injected into the server env
resource "aws_secretsmanager_secret" "app_uploads_creds" {
  count                   = var.create_iam_user ? 1 : 0
  name                    = "medbrains/${var.environment}/app-uploads-credentials"
  description             = "S3 access key for MedBrains app server presigned uploads"
  recovery_window_in_days = 7

  tags = {
    Project     = "medbrains"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "app_uploads_creds" {
  count     = var.create_iam_user ? 1 : 0
  secret_id = aws_secretsmanager_secret.app_uploads_creds[0].id
  secret_string = jsonencode({
    aws_access_key_id     = aws_iam_access_key.app_uploads[0].id
    aws_secret_access_key = aws_iam_access_key.app_uploads[0].secret
  })
}

# ── Outputs ───────────────────────────────────────────────────────────────

output "policy_arn" {
  value       = aws_iam_policy.uploads_rw.arn
  description = "ARN of the uploads IAM policy."
}

output "iam_user_name" {
  value       = var.create_iam_user ? aws_iam_user.app_uploads[0].name : null
  description = "IAM user name (non-EC2 mode only)."
}

output "credentials_secret_arn" {
  value       = var.create_iam_user ? aws_secretsmanager_secret.app_uploads_creds[0].arn : null
  description = "Secrets Manager ARN containing the IAM access key/secret (non-EC2 mode only)."
}
