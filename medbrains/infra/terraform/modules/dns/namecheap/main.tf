terraform {
  required_providers {
    namecheap = {
      source                = "namecheap/namecheap"
      version               = "~> 2.0"
      configuration_aliases = [namecheap]
    }
  }
}

variable "zone_name" {
  type = string
}

variable "records" {
  type = list(object({
    name     = string
    type     = string
    value    = string
    ttl      = optional(number, 300)
    priority = optional(number)
    proxied  = optional(bool, false)
  }))
}

variable "overwrite" {
  type    = bool
  default = false
}

# Namecheap exposes a single resource per zone (whole-zone semantics).
# `OVERWRITE` mode replaces every record at the zone with the list we
# provide; `MERGE` adds without deleting. Default to MERGE.

resource "namecheap_domain_records" "this" {
  domain = var.zone_name
  mode   = var.overwrite ? "OVERWRITE" : "MERGE"

  dynamic "record" {
    for_each = var.records
    content {
      hostname = record.value.name == "@" ? "@" : record.value.name
      type     = record.value.type
      address  = record.value.value
      ttl      = record.value.ttl
      mx_pref  = record.value.type == "MX" && record.value.priority != null ? record.value.priority : null
    }
  }
}
