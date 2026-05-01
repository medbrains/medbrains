# Per-tenant variables. Override in terraform.tfvars (untracked).

variable "tenant_id" {
  type        = string
  description = "Stable id used in resource names + tags. Lowercase, hyphenated."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,40}$", var.tenant_id))
    error_message = "tenant_id must be lowercase alphanumeric + hyphen, 3-40 chars."
  }
}

variable "hospital_name" {
  type        = string
  description = "Display name (logged + tagged for ops)"
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

# ── Cloud-side wiring ────────────────────────────────────────────────

variable "cloud_kms_key_arn" {
  type        = string
  description = "Tenant KMS key ARN (output of envs/cloud baseline)"
}

variable "cloud_audit_bucket_arn" {
  type        = string
  description = "S3 bucket for redacted audit archive (output of envs/cloud baseline)"
}

variable "headscale_url" {
  type        = string
  description = "https://headscale.<your-domain> (output of headscale module)"
}

variable "headscale_admin_api_key" {
  type        = string
  sensitive   = true
  description = "Headscale admin API key — used to mint the per-tenant pre-auth key. Stored in cloud Secrets Manager."
}

# ── On-prem topology ────────────────────────────────────────────────

variable "onprem_substrate" {
  type        = string
  description = "proxmox | baremetal — picks which on-prem TF modules to call"
  validation {
    condition     = contains(["proxmox", "baremetal"], var.onprem_substrate)
    error_message = "onprem_substrate must be 'proxmox' or 'baremetal'."
  }
}

# Proxmox-only (when onprem_substrate=proxmox)
variable "proxmox_endpoint" {
  type    = string
  default = ""
}

variable "proxmox_node" {
  type    = string
  default = ""
}

variable "proxmox_api_token_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "proxmox_api_token_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "proxmox_vm_template_id" {
  type    = string
  default = ""
}

# Bare-metal-only (when onprem_substrate=baremetal)
variable "baremetal_pg_hosts" {
  type    = list(string)
  default = []
}

variable "baremetal_etcd_hosts" {
  type    = list(string)
  default = []
}

variable "baremetal_k3s_server" {
  type    = string
  default = ""
}

variable "baremetal_k3s_agents" {
  type    = list(string)
  default = []
}

variable "baremetal_bridge_host" {
  type    = string
  default = ""
}

variable "ssh_public_key" {
  type        = string
  description = "Public key authorized on the medbrains user across all on-prem hosts"
}

variable "ssh_private_key_path" {
  type        = string
  description = "Path on the operator's machine for the corresponding private key"
  default     = "~/.ssh/id_ed25519"
}

# ── Cluster sizing ──────────────────────────────────────────────────

variable "cluster_topology" {
  type    = string
  default = "ha"
  validation {
    condition     = contains(["single", "ha"], var.cluster_topology)
    error_message = "cluster_topology must be 'single' (clinic) or 'ha'."
  }
}

# ── Bridge transport ────────────────────────────────────────────────

variable "tunnel_provider" {
  type    = string
  default = "headscale"
  validation {
    condition     = contains(["headscale", "wss", "none"], var.tunnel_provider)
    error_message = "tunnel_provider must be 'headscale', 'wss', or 'none' (air-gapped)."
  }
}

variable "bridge_artifact_url" {
  type        = string
  description = "Where the medbrains-bridge binary is hosted (S3 presigned or GitHub release URL)"
  default     = ""
}

# ── Shared cloud control-plane URLs ─────────────────────────────────
# Services that live in the shared cloud control plane (one set
# across all tenants). Variables so a group running an alternate
# cloud apex (e.g. medbrains.in) can override without forking the
# template.

variable "cloud_apex_domain" {
  type        = string
  description = "Apex domain hosting the shared cloud control plane (headscale, event bus, etc.)."
  default     = "medbrains.cloud"
}

variable "cloud_event_bus_url" {
  type        = string
  description = "Internal event bus URL the on-prem bridge publishes to. Defaults to https://api.<cloud_apex_domain>/internal/events when empty."
  default     = ""
}

# ── DNS (modules/dns) ───────────────────────────────────────────────

variable "provision_dns" {
  type        = bool
  description = "Whether terraform manages DNS records for this tenant. Set false if the tenant manages DNS out-of-band."
  default     = true
}

variable "dns_provider" {
  type        = string
  description = "DNS backend: cloudflare | route53 | azure | google | digitalocean | namecheap | godaddy. Default godaddy — only provider we currently have credentials for."
  default     = "godaddy"
  validation {
    condition = contains(
      ["cloudflare", "route53", "azure", "google", "digitalocean", "namecheap", "godaddy"],
      var.dns_provider
    )
    error_message = "dns_provider must be one of: cloudflare, route53, azure, google, digitalocean, namecheap, godaddy."
  }
}

variable "dns_zone_name" {
  type        = string
  description = "Apex zone the tenant brings (e.g. acmehealthcare.com). Required when provision_dns = true. No shared default — each tenant supplies their own."
  default     = ""
  validation {
    condition     = !var.provision_dns || length(var.dns_zone_name) > 0
    error_message = "dns_zone_name is required when provision_dns = true."
  }
}

variable "dns_record_subdomain" {
  type        = string
  description = "Subdomain prefix the tenant's records sit under (e.g. \"hospitals\" → headscale.hospitals.acmehealthcare.com). Empty = records at the apex."
  default     = ""
}

variable "dns_azure_resource_group" {
  type        = string
  description = "Azure-only — resource group hosting the DNS zone."
  default     = ""
}

variable "dns_google_project" {
  type        = string
  description = "Google-only — GCP project id hosting the managed zone."
  default     = ""
}

variable "dns_google_managed_zone" {
  type        = string
  description = "Google-only — managed zone resource name."
  default     = ""
}

variable "dns_namecheap_overwrite" {
  type        = bool
  description = "Namecheap-only — true = OVERWRITE mode (deletes existing records). Default false (MERGE)."
  default     = false
}
