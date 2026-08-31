# Buyer-facing knobs. The onboarding flow writes these into
# medbrains/infra/.env (as TF_VAR_*); operator never edits .tfvars.

variable "tier" {
  description = "Subscription tier. Picks compute + DB + storage shape."
  type        = string
  default     = "starter"
  validation {
    condition     = contains(["test", "demo", "starter", "attach", "growth", "enterprise", "enterprise-k3s"], var.tier)
    error_message = "tier must be one of: test, demo, starter, attach, growth, enterprise, enterprise-k3s."
  }
}

variable "hospital_id" {
  description = "Stable slug for the hospital. Used in resource names + tags. Lowercase, no spaces."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,30}$", var.hospital_id))
    error_message = "hospital_id must be 2-31 chars, lowercase alphanumerics + hyphens, starting with a letter."
  }
}

variable "domain" {
  description = "Public hostname the deployment serves (e.g. hims.amh.org.in)."
  type        = string
}

variable "zone_name" {
  description = "Apex DNS zone (e.g. amh.org.in). Used by the env to write the A record."
  type        = string
}

variable "admin_email" {
  description = "Email passed to Let's Encrypt + included in admin role on first boot."
  type        = string
}

variable "edge_proxy" {
  description = "Standalone edge proxy for test/demo/starter. Pingora is the only supported target."
  type        = string
  default     = "pingora"
  validation {
    condition     = var.edge_proxy == "pingora"
    error_message = "edge_proxy must be pingora."
  }
}

# ── Starter / Enterprise-k3s shared knobs ─────────────────────────────

variable "aws_ssh_key_name" {
  description = "Name of an EC2 keypair already registered in this AWS region. Required for tiers that provision an EC2 host (starter, enterprise-k3s)."
  type        = string
  default     = ""
}

variable "ssh_private_key_path" {
  description = "Operator-side path of the matching private key. file()'d by the env."
  type        = string
  default     = "~/.ssh/id_ed25519"
}

variable "aws_instance_type" {
  description = "Optional EC2 instance type override for tiers that boot a single host. Empty uses the package default for test/demo/starter/enterprise-k3s."
  type        = string
  default     = ""
}

# ── Starter-tier build artefact paths (cargo + pnpm output) ───────────

variable "binaries_dir" {
  description = "Local path containing pre-built medbrains-server + medbrains-archive (cargo build --release output). Starter only — image-based tiers ignore."
  type        = string
  default     = ""
}

variable "spa_dist_dir" {
  description = "Local path containing apps/web/dist. Starter only."
  type        = string
  default     = ""
}

variable "deploy_kit_dir" {
  description = "Local path to deploy/standalone/. Starter only."
  type        = string
  default     = ""
}

# ── Image-based tier knobs (growth, enterprise, enterprise-k3s) ───────

variable "image_uri" {
  description = "Container image reference for image-based tiers. Defaults to the GHCR image published by release.yml."
  type        = string
  default     = "ghcr.io/anthropics/medbrains-server:latest"
}

# ── Growth-tier knobs ─────────────────────────────────────────────────

variable "fargate_task_cpu" {
  description = "Growth-only — Fargate task vCPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "fargate_task_memory" {
  description = "Growth-only — Fargate task memory in MiB. Must be valid for the chosen cpu setting."
  type        = number
  default     = 1024
}

variable "rds_instance_class" {
  description = "RDS instance class for tiers that use RDS (growth, enterprise-k3s)."
  type        = string
  default     = "db.t4g.micro"
}

variable "scale_to_zero_at_night" {
  description = "Growth-only — if true, an EventBridge schedule sets ECS desired_count=0 at 21:00 IST and =1 at 07:00 IST. Saves ~70%% on Fargate spend."
  type        = bool
  default     = false
}

# ── Storage lifecycle ────────────────────────────────────────────────

variable "hot_to_cold_days" {
  description = "S3 lifecycle: days before objects move from STANDARD to STANDARD_IA / GLACIER (cold tier). Matches deploy/standalone install.sh defaults."
  type        = number
  default     = 90
}

# ── Helm chart + GHCR pull (k3s / EKS tiers) ──────────────────────────

variable "helm_chart_dir" {
  description = "Path to deploy/helm/medbrains-server/. The k3s / EKS tiers helm-install this at apply time. Empty = skip the cluster bootstrap (infra-only apply)."
  type        = string
  default     = ""
}

variable "ghcr_pull_token" {
  description = "GHCR Personal Access Token. Required only if the GHCR image is private."
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_username" {
  description = "GitHub username paired with ghcr_pull_token."
  type        = string
  default     = ""
}

variable "reset_pgdata" {
  description = "Starter tier only — wipe postgres named volume on next apply. One-shot for incompatible migrations."
  type        = bool
  default     = false
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach SSH on EC2-backed tiers. Empty = auto-detect the operator's current egress IP (never 0.0.0.0/0)."
  type        = list(string)
  default     = []
}

variable "alarm_email" {
  description = "Email for CloudWatch alarm notifications on EC2-backed tiers. Defaults to admin_email when unset."
  type        = string
  default     = ""
}

# ── Attach tier ───────────────────────────────────────────────────────
# The hospital already owns a host. Everything else about the deployment is
# identical to starter - same binary, same SPA, same 67 modules - but no EC2
# instance, security group or DNS record is created, because the buyer already
# has all three.

variable "existing_ipv4" {
  description = "Public address of the host to deploy onto. Required for tier = attach."
  type        = string
  default     = ""

  validation {
    condition     = var.tier != "attach" || var.existing_ipv4 != ""
    error_message = "tier = attach requires existing_ipv4."
  }
}

variable "attach_reuse_postgres" {
  description = <<-EOT
    Use a Postgres already running on the host instead of starting one in
    Docker. The starter shape assumes it owns the box and can bind 5432; a host
    that is already serving other applications usually cannot give that up, and
    a second Postgres on a different port is one more thing to patch, back up
    and forget about.
  EOT
  type        = bool
  default     = true
}

variable "attach_reuse_tls" {
  description = <<-EOT
    Leave TLS and port 80/443 to whatever already terminates them on the host,
    and expect it to proxy `domain` to medbrains-server.

    This matters more than it looks. The standalone install stops and disables
    Caddy and runs `certbot --standalone`, both of which assume nothing else
    serves HTTP on the box. On a host already terminating TLS for other names,
    that takes every one of them down and cannot renew afterwards.
  EOT
  type        = bool
  default     = true
}

variable "ssh_user_attach" {
  description = "Login user on the existing host. Ubuntu images use ubuntu; Amazon Linux uses ec2-user."
  type        = string
  default     = "ubuntu"
}
