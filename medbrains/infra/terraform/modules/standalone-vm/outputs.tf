output "public_ip" {
  description = "Public IPv4 of the host. Plumb into the DNS module's records list."
  value = (
    var.provider_kind == "digitalocean" ? module.digitalocean[0].public_ip :
    var.provider_kind == "existing-host" ? module.existing_host[0].public_ip :
    ""
  )
}

output "ssh_endpoint" {
  description = "user@ip string suitable for ssh."
  value = (
    var.provider_kind == "digitalocean" ? module.digitalocean[0].ssh_endpoint :
    var.provider_kind == "existing-host" ? module.existing_host[0].ssh_endpoint :
    ""
  )
}

output "health_url" {
  description = "Probe to confirm the bootstrap succeeded."
  value       = "https://${var.domain}/api/health"
}
