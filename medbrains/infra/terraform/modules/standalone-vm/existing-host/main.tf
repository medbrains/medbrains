terraform {
  required_version = ">= 1.7"
}

variable "hostname" { type = string }
variable "domain" { type = string }
variable "admin_email" { type = string }
variable "edge_proxy" {
  type    = string
  default = "pingora"
  validation {
    condition     = var.edge_proxy == "pingora"
    error_message = "edge_proxy must be pingora."
  }
}
variable "existing_ipv4" {
  type = string
  validation {
    condition     = length(var.existing_ipv4) > 0
    error_message = "existing_ipv4 is required when provider_kind = existing-host."
  }
}
variable "ssh_user" { type = string }
variable "ssh_private_key" {
  type      = string
  sensitive = true
}
variable "binaries_dir" { type = string }
variable "spa_dist_dir" { type = string }
variable "deploy_kit_dir" { type = string }

# No host creation — the operator already owns the box. Terraform
# only runs install.sh remotely + tracks bootstrap state.

resource "null_resource" "bootstrap" {
  triggers = {
    host_ip       = var.existing_ipv4
    binaries_hash = filemd5("${var.binaries_dir}/medbrains-server")
    archive_hash  = filemd5("${var.binaries_dir}/medbrains-archive")
    proxy_hash    = filemd5("${var.binaries_dir}/medbrains-proxy")
    edge_hash     = filemd5("${var.binaries_dir}/medbrains-edge")
    spa_hash      = sha256(join("", [for f in sort(fileset(var.spa_dist_dir, "**")) : "${f}:${filesha256("${var.spa_dist_dir}/${f}")}"]))
  }

  connection {
    type        = "ssh"
    host        = var.existing_ipv4
    user        = var.ssh_user
    private_key = var.ssh_private_key
    timeout     = "5m"
  }

  provisioner "file" {
    source      = "${var.binaries_dir}/medbrains-server"
    destination = "/tmp/medbrains-server"
  }
  provisioner "file" {
    source      = "${var.binaries_dir}/medbrains-archive"
    destination = "/tmp/medbrains-archive"
  }
  provisioner "file" {
    source      = "${var.binaries_dir}/medbrains-proxy"
    destination = "/tmp/medbrains-proxy"
  }
  provisioner "file" {
    source      = "${var.binaries_dir}/medbrains-edge"
    destination = "/tmp/medbrains-edge"
  }
  provisioner "file" {
    source      = var.spa_dist_dir
    destination = "/tmp/medbrains-web"
  }
  provisioner "file" {
    source      = var.deploy_kit_dir
    destination = "/tmp/standalone"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/medbrains-edge /tmp/standalone/install.sh",
      "sudo bash /tmp/standalone/install.sh ${var.domain} ${var.admin_email} '' ${var.edge_proxy}",
    ]
  }
}

output "public_ip" {
  value = var.existing_ipv4
}

output "ssh_endpoint" {
  value = "${var.ssh_user}@${var.existing_ipv4}"
}
