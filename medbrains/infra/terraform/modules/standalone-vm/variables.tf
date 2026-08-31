variable "provider_kind" {
  description = "Which VM/compute backend creates / talks to the host. See README provider matrix."
  type        = string
  validation {
    condition = contains(
      ["aws-ec2", "aws-fargate", "aws-k3s", "aws-eks", "digitalocean", "existing-host"],
      var.provider_kind,
    )
    error_message = "provider_kind must be one of: aws-ec2, aws-fargate, aws-k3s, aws-eks, digitalocean, existing-host."
  }
}

variable "hostname" {
  description = "Stable hostname (used for cloud tags + the OS hostname)."
  type        = string
}

variable "domain" {
  description = "Public domain to bind at the edge (e.g. hims.alagappahospital.com)."
  type        = string
}

variable "admin_email" {
  description = "Email passed to Let's Encrypt for cert issuance + recovery."
  type        = string
}

variable "edge_proxy" {
  description = "Standalone edge proxy. Pingora is the only supported target."
  type        = string
  default     = "pingora"
  validation {
    condition     = var.edge_proxy == "pingora"
    error_message = "edge_proxy must be pingora."
  }
}

# ── AWS EC2 / k3s shared (single-host tiers) ─────────────────────────

variable "aws_instance_type" {
  description = "AWS-only — EC2 instance type. t3.small (Starter), t4g.medium (Enterprise-k3s)."
  type        = string
  default     = "t3.small"
}

variable "aws_ami" {
  description = "AWS-only — AMI id override. Empty (default) auto-resolves the latest Canonical Ubuntu 24.04 AMI matching the instance arch (amd64 or arm64 inferred from instance_type prefix)."
  type        = string
  default     = ""
}

variable "aws_ssh_key_name" {
  description = "AWS-only — name of the EC2 keypair already registered in this AWS account / region."
  type        = string
  default     = ""
}

# ── Fargate / k3s / EKS shared (image-based tiers) ───────────────────

variable "image_uri" {
  description = "Container image reference for image-based tiers. Defaults to the GHCR image."
  type        = string
  default     = "ghcr.io/anthropics/medbrains-server:latest"
}

variable "fargate_task_cpu" {
  description = "Fargate-only — task vCPU units."
  type        = number
  default     = 512
}

variable "fargate_task_memory" {
  description = "Fargate-only — task memory in MiB."
  type        = number
  default     = 1024
}

variable "rds_instance_class" {
  description = "RDS instance class (Fargate / k3s tiers)."
  type        = string
  default     = "db.t4g.micro"
}

variable "scale_to_zero_at_night" {
  description = "Fargate-only — if true, EventBridge sets ECS desired_count=0 at 21:00 IST and =1 at 07:00 IST."
  type        = bool
  default     = false
}

variable "hot_to_cold_days" {
  description = "S3 lifecycle: days before objects move to STANDARD_IA / GLACIER."
  type        = number
  default     = 90
}

variable "helm_chart_dir" {
  description = "Path to deploy/helm/medbrains-server/. Required for k3s / EKS tiers — when empty, terraform skips the bootstrap and only provisions infra."
  type        = string
  default     = ""
}

variable "ghcr_pull_token" {
  description = "GHCR PAT for private packages. Empty = image is public."
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_username" {
  description = "GitHub username for GHCR pull (only used if ghcr_pull_token set)."
  type        = string
  default     = ""
}

# ── DigitalOcean-specific ─────────────────────────────────────────────

variable "region" {
  description = "DigitalOcean-only — droplet region. blr1 = Bangalore (recommended for India)."
  type        = string
  default     = "blr1"
}

variable "size" {
  description = "DigitalOcean-only — droplet size slug."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "image" {
  description = "DigitalOcean-only — base image slug."
  type        = string
  default     = "ubuntu-24-04-x64"
}

variable "ssh_public_keys" {
  description = "DigitalOcean-only — fingerprints of SSH keys registered in the DO account."
  type        = list(string)
  default     = []
}

# ── existing-host-specific ───────────────────────────────────────────

variable "existing_ipv4" {
  description = "existing-host-only — the IPv4 of the pre-provisioned host."
  type        = string
  default     = ""
}

variable "ssh_user" {
  description = "SSH user with sudo. Default `root` for fresh DO droplets, often `ubuntu` on existing VPS / bare metal."
  type        = string
  default     = "root"
}

variable "ssh_private_key" {
  description = "SSH private key contents. Required for tiers that connect over SSH (aws-ec2, aws-k3s, digitalocean, existing-host)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "ssh_private_key_path" {
  description = "SSH private key path on the operator machine. Used by aws-ec2 local OpenSSH deploys so passphrase-protected keys can use the local keychain/agent."
  type        = string
  default     = ""
}

# ── Bootstrap inputs (Starter only — image-based tiers ignore) ───────

variable "binaries_dir" {
  description = "Local path containing the pre-built `medbrains-server`, `medbrains-archive`, `medbrains-proxy`, and `medbrains-edge` binaries. Starter only."
  type        = string
  default     = ""
}

variable "spa_dist_dir" {
  description = "Local path containing the SPA build output. Starter only."
  type        = string
  default     = ""
}

variable "deploy_kit_dir" {
  description = "Local path to deploy/standalone/. Starter only."
  type        = string
  default     = ""
}

variable "reset_pgdata" {
  description = "Starter only — wipe the postgres named volume on next apply. Use only when migrations are incompatible with existing data."
  type        = bool
  default     = false
}

variable "kms_key_arns" {
  description = "Optional hospital-scoped KMS CMKs by purpose: app, db, audit, secrets. Empty map falls back to provider-managed encryption defaults."
  type        = map(string)
  default     = {}
}

variable "uploads_bucket_arn" {
  description = "ARN of the patient-uploads S3 bucket. When provided, attaches an IAM policy granting the EC2 instance role permission to generate presigned URLs on that bucket."
  type        = string
  default     = ""
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach SSH on the aws-ec2 kind. Empty = auto-detect the operator's current egress IP (never 0.0.0.0/0)."
  type        = list(string)
  default     = []
}

variable "alarm_email" {
  description = "Email for CloudWatch alarm notifications (aws-ec2 kind)."
  type        = string
  default     = ""
}

# ── Attach tier ─────────────────────────────────────────────────────
# Only meaningful with provider_kind = existing-host. The host already
# runs other applications, so the install may not take a port or stop a
# service that is already serving one of them.

variable "attach_mode" {
  description = "Host belongs to the hospital and already runs other things. Makes install.sh arbitrate ports instead of assuming it owns them."
  type        = bool
  default     = false
}

variable "attach_reuse_tls" {
  description = "Leave 80/443 and certificates to the proxy already on the host. Pingora is not installed; the host proxy forwards to the app port."
  type        = bool
  default     = true
}

variable "attach_reuse_postgres" {
  description = "Use the Postgres already on the host. Requires attach_database_url; without it a container is started on a free port instead."
  type        = bool
  default     = true
}

variable "attach_database_url" {
  description = "Connection string for the host's existing Postgres, with a database already created for MedBrains."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = !strcontains(var.attach_database_url, "'")
    error_message = "attach_database_url must not contain a single quote; it is passed through a shell-quoted env file."
  }
}
