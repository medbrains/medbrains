variable "domain" {
  type        = string
  description = "Public hostname for the deployment."
  default     = "hims.alagappahospital.com"
}

variable "zone_name" {
  type        = string
  description = "Apex zone at GoDaddy."
  default     = "alagappahospital.com"
}

variable "admin_email" {
  type        = string
  description = "Email passed to Let's Encrypt + included in admin role on first boot."
}

variable "do_ssh_key_name" {
  type        = string
  description = "Name of the SSH key already added to the DigitalOcean account."
}

variable "ssh_private_key_path" {
  type        = string
  description = "Path on the operator's machine for the matching private key."
  default     = "~/.ssh/medbrains-deploy"
}

variable "binaries_dir" {
  type        = string
  description = "Local path containing pre-built medbrains-server + medbrains-archive (cargo build --release)."
}

variable "spa_dist_dir" {
  type        = string
  description = "Local path containing the SPA build output (apps/web/dist)."
}

variable "deploy_kit_dir" {
  type        = string
  description = "Local path to deploy/standalone/."
}
