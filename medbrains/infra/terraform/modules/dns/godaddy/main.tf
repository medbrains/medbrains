terraform {
  required_providers {
    godaddy-dns = {
      source                = "veksh/godaddy-dns"
      version               = "~> 0.3"
      configuration_aliases = [godaddy-dns]
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

  # GoDaddy enforces a 600s minimum TTL.
  validation {
    condition     = alltrue([for r in var.records : r.ttl >= 600])
    error_message = "GoDaddy enforces a minimum TTL of 600 seconds. Bump every record's ttl to at least 600."
  }
}

resource "godaddy-dns_record" "this" {
  for_each = {
    for r in var.records :
    "${r.type}-${r.name}-${substr(sha256(r.value), 0, 8)}" => r
  }

  domain   = var.zone_name
  type     = each.value.type
  name     = each.value.name
  data     = each.value.value
  ttl      = each.value.ttl
  priority = each.value.type == "MX" || each.value.type == "SRV" ? each.value.priority : null
}
