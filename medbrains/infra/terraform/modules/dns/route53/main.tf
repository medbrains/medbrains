terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.50"
      configuration_aliases = [aws]
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

variable "tenant_id" {
  type    = string
  default = ""
}

data "aws_route53_zone" "this" {
  name = var.zone_name
}

resource "aws_route53_record" "this" {
  for_each = {
    for r in var.records :
    "${r.type}-${r.name}-${substr(sha256(r.value), 0, 8)}" => r
  }

  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name == "@" ? var.zone_name : "${each.value.name}.${var.zone_name}"
  type    = each.value.type
  ttl     = each.value.ttl
  records = [
    each.value.type == "MX" && each.value.priority != null
    ? "${each.value.priority} ${each.value.value}"
    : each.value.value
  ]
}

output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}
