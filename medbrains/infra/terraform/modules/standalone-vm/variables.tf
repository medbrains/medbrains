variable "provider_kind" {
  description = "Which VM backend creates / talks to the host. See README provider matrix."
  type        = string
  validation {
    condition     = contains(["digitalocean", "existing-host"], var.provider_kind)
    error_message = "provider_kind must be one of: digitalocean, existing-host."
  }
}

variable "hostname" {
  description = "Stable hostname (used for cloud tags + the OS hostname)."
  type        = string
}

variable "domain" {
  description = "Public domain to bind via Caddy (e.g. hims.alagappahospital.com)."
  type        = string
}

variable "admin_email" {
  description = "Email passed to Let's Encrypt for cert issuance + recovery."
  type        = string
}

# ── DigitalOcean-specific ─────────────────────────────────────────────

variable "region" {
  description = "DigitalOcean-only — droplet region. blr1 = Bangalore (recommended for India)."
  type        = string
  default     = "blr1"
}

variable "size" {
  description = "DigitalOcean-only — droplet size slug. s-2vcpu-4gb is the recommended pilot size (~$24/mo)."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "image" {
  description = "DigitalOcean-only — base image slug. ubuntu-24-04-x64 is what install.sh targets."
  type        = string
  default     = "ubuntu-24-04-x64"
}

variable "ssh_public_keys" {
  description = "DigitalOcean-only — fingerprints of SSH keys registered in the DO account that should be authorised on the new droplet."
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
  description = "SSH private key contents (file(\"~/.ssh/...\")). Used by terraform's file + remote-exec provisioners."
  type        = string
  sensitive   = true
}

# ── Bootstrap inputs ─────────────────────────────────────────────────

variable "binaries_dir" {
  description = "Local path containing the pre-built `medbrains-server` and `medbrains-archive` binaries (cargo build --release output)."
  type        = string
}

variable "spa_dist_dir" {
  description = "Local path containing the SPA build output (pnpm build → apps/web/dist)."
  type        = string
}

variable "deploy_kit_dir" {
  description = "Local path to deploy/standalone/. Uploaded to the host so install.sh + the systemd units + Caddyfile.tmpl land in /tmp/standalone."
  type        = string
}
