variable "provider_kind" {
  description = "Which DNS backend manages the zone. See README provider matrix."
  type        = string
  validation {
    condition = contains(
      ["cloudflare", "route53", "azure", "google", "digitalocean", "namecheap", "godaddy"],
      var.provider_kind
    )
    error_message = "provider_kind must be one of: cloudflare, route53, azure, google, digitalocean, namecheap, godaddy."
  }
}

variable "zone_name" {
  description = "Apex zone (e.g. acmehealthcare.com). Records are created relative to this."
  type        = string
}

variable "records" {
  description = "DNS records to manage (provider-agnostic shape)."
  type = list(object({
    name     = string
    type     = string
    value    = string
    ttl      = optional(number, 300)
    priority = optional(number)
    proxied  = optional(bool, false)
  }))
}

variable "tenant_id" {
  description = "Tenant id, embedded in record comments / tags where the provider supports it."
  type        = string
  default     = ""
}

variable "azure_resource_group_name" {
  description = "Azure-only — resource group hosting the DNS zone."
  type        = string
  default     = ""
}

variable "google_project" {
  description = "Google-only — GCP project id hosting the managed zone."
  type        = string
  default     = ""
}

variable "google_managed_zone" {
  description = "Google-only — managed zone resource name (often differs from zone_name)."
  type        = string
  default     = ""
}

variable "namecheap_overwrite" {
  description = "Namecheap-only — set true for OVERWRITE mode (deletes existing records). Default MERGE."
  type        = bool
  default     = false
}
