terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }
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
variable "region" { type = string }
variable "size" { type = string }
variable "image" { type = string }
variable "ssh_public_keys" {
  type        = list(string)
  description = "Fingerprints of SSH keys registered in the DO account."
  # A droplet created without a key gets a root password by email, and the
  # provisioners below could not log in anyway.
  validation {
    condition     = length(var.ssh_public_keys) > 0
    error_message = "ssh_public_keys must name at least one key registered in the DigitalOcean account."
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

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach SSH. Empty = auto-detect the operator's current egress IP at plan time (never 0.0.0.0/0), as aws-ec2 does."
  type        = list(string)
  default     = []
}

locals {
  ssh_cidrs = length(var.ssh_allowed_cidrs) > 0 ? var.ssh_allowed_cidrs : [
    "${trimspace(data.http.operator_ip[0].response_body)}/32"
  ]
}

# The provisioners SSH in from wherever `terraform apply` runs.
data "http" "operator_ip" {
  count = length(var.ssh_allowed_cidrs) == 0 ? 1 : 0
  url   = "https://checkip.amazonaws.com"
}

resource "digitalocean_droplet" "this" {
  #checkov:skip=CKV_DIO_2: ssh_keys comes from the caller (whose default is an empty list for non-DO shapes); the ssh_public_keys validation above refuses to plan without one
  name     = var.hostname
  region   = var.region
  size     = var.size
  image    = var.image
  ssh_keys = var.ssh_public_keys

  monitoring = true
  # Weekly droplet backups (+20% of the droplet price): this shape has no
  # off-host backup bucket, so this is its only copy off the disk.
  backups = true
  ipv6    = true
  tags    = ["medbrains", "medbrains-${var.hostname}"]
}

# Open the three ports MedBrains needs at the cloud-firewall layer.
# Pingora owns 80/443 on the host.
resource "digitalocean_firewall" "this" {
  #checkov:skip=CKV_DIO_4: 80/443 are the public web entry (Pingora, ACME HTTP-01); SSH is limited to the operator CIDRs
  name        = "${var.hostname}-fw"
  droplet_ids = [digitalocean_droplet.this.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = local.ssh_cidrs
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Wait for SSH to be reachable before pushing files.
resource "null_resource" "wait_for_ssh" {
  triggers = {
    droplet_id = digitalocean_droplet.this.id
  }

  provisioner "remote-exec" {
    inline = ["echo 'ssh up'"]

    connection {
      type        = "ssh"
      host        = digitalocean_droplet.this.ipv4_address
      user        = var.ssh_user
      private_key = var.ssh_private_key
      timeout     = "5m"
    }
  }

  depends_on = [digitalocean_firewall.this]
}

resource "null_resource" "bootstrap" {
  triggers = {
    droplet_id = digitalocean_droplet.this.id
    # Re-run when binaries / SPA / kit change — match the contents
    # by hashing each input directory.
    binaries_hash = filemd5("${var.binaries_dir}/medbrains-server")
    archive_hash  = filemd5("${var.binaries_dir}/medbrains-archive")
    proxy_hash    = filemd5("${var.binaries_dir}/medbrains-proxy")
    edge_hash     = filemd5("${var.binaries_dir}/medbrains-edge")
    spa_hash      = sha256(join("", [for f in sort(fileset(var.spa_dist_dir, "**")) : "${f}:${filesha256("${var.spa_dist_dir}/${f}")}"]))
  }

  connection {
    type        = "ssh"
    host        = digitalocean_droplet.this.ipv4_address
    user        = var.ssh_user
    private_key = var.ssh_private_key
    timeout     = "5m"
  }

  # Upload binaries.
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

  # Upload the SPA dist + the deploy kit.
  provisioner "file" {
    source      = var.spa_dist_dir
    destination = "/tmp/medbrains-web"
  }
  provisioner "file" {
    source      = var.deploy_kit_dir
    destination = "/tmp/standalone"
  }

  # Run the installer.
  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/medbrains-edge /tmp/standalone/install.sh",
      "sudo bash /tmp/standalone/install.sh ${var.domain} ${var.admin_email} '' ${var.edge_proxy}",
    ]
  }

  depends_on = [null_resource.wait_for_ssh]
}

output "public_ip" {
  value = digitalocean_droplet.this.ipv4_address
}

output "ssh_endpoint" {
  value = "${var.ssh_user}@${digitalocean_droplet.this.ipv4_address}"
}
