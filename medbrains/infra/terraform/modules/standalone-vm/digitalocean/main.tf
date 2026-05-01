terraform {
  required_providers {
    digitalocean = {
      source                = "digitalocean/digitalocean"
      version               = "~> 2.0"
      configuration_aliases = [digitalocean]
    }
  }
}

variable "hostname" { type = string }
variable "domain" { type = string }
variable "admin_email" { type = string }
variable "region" { type = string }
variable "size" { type = string }
variable "image" { type = string }
variable "ssh_public_keys" { type = list(string) }
variable "ssh_user" { type = string }
variable "ssh_private_key" {
  type      = string
  sensitive = true
}
variable "binaries_dir" { type = string }
variable "spa_dist_dir" { type = string }
variable "deploy_kit_dir" { type = string }

resource "digitalocean_droplet" "this" {
  name     = var.hostname
  region   = var.region
  size     = var.size
  image    = var.image
  ssh_keys = var.ssh_public_keys

  monitoring = true
  ipv6       = true
  tags       = ["medbrains", "medbrains-${var.hostname}"]
}

# Open the three ports MedBrains needs at the cloud-firewall layer.
# Caddy + UFW on the host can tighten further if desired.
resource "digitalocean_firewall" "this" {
  name        = "${var.hostname}-fw"
  droplet_ids = [digitalocean_droplet.this.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
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
      "chmod +x /tmp/medbrains-server /tmp/medbrains-archive /tmp/standalone/install.sh",
      "sudo bash /tmp/standalone/install.sh ${var.domain} ${var.admin_email}",
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
