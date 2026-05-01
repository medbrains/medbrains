variable "tier" {
  type        = string
  description = "Buyer tier: starter | growth | enterprise | enterprise-k3s. Set TF_VAR_tier in medbrains/infra/.env."
  default     = "starter"
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

# ── AWS ──

variable "aws_ssh_key_name" {
  type        = string
  description = "Name of the EC2 keypair already registered in this AWS account / region."
  default     = ""
}

variable "aws_instance_type" {
  type        = string
  description = "EC2 instance type. t4g.small (ARM, 2 vCPU / 2 GB, ~₹1,200/mo) is the Starter default — fits docker postgres + medbrains-server binary + Caddy. Bump to t4g.medium for Enterprise-k3s."
  default     = "t4g.small"
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
