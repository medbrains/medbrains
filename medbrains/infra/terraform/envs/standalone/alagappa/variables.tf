variable "tier" {
  type        = string
  description = "Buyer tier: test | demo | starter | attach | growth | enterprise | enterprise-k3s. Set TF_VAR_tier in medbrains/infra/.env."
  default     = "starter"
  validation {
    condition     = contains(["test", "demo", "starter", "attach", "growth", "enterprise", "enterprise-k3s"], var.tier)
    error_message = "tier must be one of: test, demo, starter, attach, growth, enterprise, enterprise-k3s."
  }
}

variable "domain" {
  type        = string
  description = "Public hostname for the deployment."
  default     = "hims.amh.org.in"
}

variable "zone_name" {
  type        = string
  description = "Apex zone at GoDaddy."
  default     = "amh.org.in"
}

variable "admin_email" {
  type        = string
  description = "Email passed to Let's Encrypt + included in admin role on first boot."
  default     = ""
}

variable "edge_proxy" {
  type        = string
  description = "Standalone edge proxy. Pingora is the only supported target."
  default     = "pingora"
  validation {
    condition     = var.edge_proxy == "pingora"
    error_message = "edge_proxy must be pingora."
  }
}

# ── AWS ──

variable "aws_ssh_key_name" {
  type        = string
  description = "Name of the EC2 keypair already registered in this AWS account / region."
  default     = ""
}

variable "aws_instance_type" {
  type        = string
  description = "Optional EC2 instance type override. Empty uses the cost package default: test=t4g.small, demo/starter=t4g.medium, enterprise-k3s=t4g.medium."
  default     = ""
}

variable "ssh_private_key_path" {
  type        = string
  description = "Path on the operator's machine for the matching private key."
  default     = "~/.ssh/id_ed25519"
}

# ── Build artefacts (local repo paths) ──

variable "binaries_dir" {
  type        = string
  description = "Local path containing pre-built medbrains-server + medbrains-archive. Default targets aarch64-unknown-linux-gnu since the Starter tier defaults to ARM (t4g.small). Override if you switch to x86_64 instance."
  default     = "../../../../../target/aarch64-unknown-linux-gnu/release"
}

variable "spa_dist_dir" {
  type        = string
  description = "Local path containing the SPA build output (apps/web/dist)."
  default     = "../../../../../apps/web/dist"
}

variable "deploy_kit_dir" {
  type        = string
  description = "Local path to deploy/standalone/."
  default     = "../../../../../deploy/standalone"
}

# ── K8s tiers (growth, enterprise, enterprise-k3s) ────────────────────

variable "image_uri" {
  type        = string
  description = "Container image. Default = GHCR :latest from master push."
  default     = "ghcr.io/domnicamalan/medbrains:latest"
}

variable "helm_chart_dir" {
  type        = string
  description = "Local path to deploy/helm/medbrains-server/."
  default     = "../../../../../deploy/helm/medbrains-server"
}

variable "ghcr_pull_token" {
  type        = string
  description = "GHCR PAT — only needed if the GHCR package is private."
  default     = ""
  sensitive   = true
}

variable "github_username" {
  type        = string
  description = "GitHub username for GHCR pull (only if ghcr_pull_token set)."
  default     = ""
}

variable "reset_pgdata" {
  type        = bool
  description = "One-shot: wipe postgres named volume on next apply. Use when migrations are incompatible with existing data."
  default     = false
}

# ── attach tier ───────────────────────────────────────────────────────
#
# The module has supported attach since 2026-08-31; this env never passed
# the variables through, so `tier = attach` reached the module with an
# empty existing_ipv4 and failed. These are the pass-through.

variable "existing_ipv4" {
  description = "Public address of the host to attach to. Required for tier = attach."
  type        = string
  default     = ""
}

variable "ssh_user_attach" {
  description = "Login user on the existing host. Ubuntu images use ubuntu."
  type        = string
  default     = "ubuntu"
}

variable "attach_reuse_tls" {
  description = <<-EOT
    Leave 80/443 to whatever already terminates TLS on the host and expect it
    to proxy `domain` to medbrains-server. True here: the box runs Caddy for
    roughly thirty-five hostnames, and an installer that claims those ports is
    an outage, not an install.
  EOT
  type        = bool
  default     = true
}

variable "attach_reuse_postgres" {
  description = <<-EOT
    Use the Postgres already on the host rather than starting one in Docker.
    True here: the box runs native PostgreSQL 17.11 and has no Docker at all.
  EOT
  type        = bool
  default     = true
}

variable "attach_database_url" {
  description = "Connection string for the dedicated medbrains role. Never the account that owns the other applications."
  type        = string
  default     = ""
  sensitive   = true
}
