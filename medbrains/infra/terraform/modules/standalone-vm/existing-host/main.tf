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
# Where the SSH provisioners actually dial. Defaults to the host's own public
# IP, which is what every tier has always done.
#
# Set these to reach the host through an SSM port-forwarding tunnel instead.
# The tunnel terminates on the instance's own loopback, so the security group
# never sees the connection: the operator's address does not have to be in the
# inbound rules, and port 22 need not be open to the internet at all.
#
# `existing_ipv4` is deliberately not reused for this. It is also the address
# the DNS record points at, so overriding it would repoint the hospital's
# domain at localhost.
variable "ssh_connect_host" {
  type        = string
  default     = ""
  description = "Override the SSH target (127.0.0.1 for an SSM tunnel). Empty = use existing_ipv4."
}

variable "ssh_connect_port" {
  type        = number
  default     = 22
  description = "SSH port. Set to the tunnel's local port when ssh_connect_host is set."
}

variable "binaries_dir" { type = string }
variable "spa_dist_dir" { type = string }
variable "deploy_kit_dir" { type = string }

variable "attach_mode" {
  type    = bool
  default = false
}
variable "attach_reuse_tls" {
  type    = bool
  default = true
}
variable "attach_reuse_postgres" {
  type    = bool
  default = true
}
variable "attach_database_url" {
  type      = string
  default   = ""
  sensitive = true
}

# No host creation — the operator already owns the box. Terraform
# only runs install.sh remotely + tracks bootstrap state.

resource "null_resource" "bootstrap" {
  triggers = {
    host_ip       = var.existing_ipv4
    attach_shape  = "${var.attach_mode}/${var.attach_reuse_tls}/${var.attach_reuse_postgres}"
    binaries_hash = filemd5("${var.binaries_dir}/medbrains-server")
    archive_hash  = filemd5("${var.binaries_dir}/medbrains-archive")
    proxy_hash    = filemd5("${var.binaries_dir}/medbrains-proxy")
    # Optional. `medbrains-edge` is a library crate in this workspace - no
    # main.rs, no CLI, and git history has never held one - while the deploy
    # kit carries a systemd unit expecting the binary. Rather than ship a stub
    # that systemd would restart forever, the deploy proceeds without the edge
    # sync service. Drop the binary into binaries_dir and the next apply picks
    # it up and installs the unit.
    edge_hash = fileexists("${var.binaries_dir}/medbrains-edge") ? filemd5("${var.binaries_dir}/medbrains-edge") : "absent"
    spa_hash  = sha256(join("", [for f in sort(fileset(var.spa_dist_dir, "**")) : "${f}:${filesha256("${var.spa_dist_dir}/${f}")}"]))
  }

  connection {
    type        = "ssh"
    host        = var.ssh_connect_host != "" ? var.ssh_connect_host : var.existing_ipv4
    port        = var.ssh_connect_port
    user        = var.ssh_user
    private_key = var.ssh_private_key
    timeout     = "5m"
  }

  # Clear stale staging files before uploading over them.
  #
  # /tmp carries the sticky bit, so a file left by a deploy that ran as root
  # cannot be overwritten or removed by a later deploy logging in as a normal
  # user — scp fails with "Permission denied" on a directory that is nominally
  # world-writable, and it fails during upload, before any remote-exec below
  # could clean up. That is exactly how a root-owned medbrains-attach.env from
  # one deploy blocked every deploy after it.
  #
  # The cleanup at the end of this resource cannot cover this case: it runs
  # unprivileged, so it cannot remove a root-owned file, and it runs too late.
  provisioner "remote-exec" {
    inline = [
      "sudo rm -rf /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/medbrains-edge /tmp/medbrains-web /tmp/standalone /tmp/medbrains-attach.env",
    ]
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
  # One archive, not the directory. A file provisioner pointed at a directory
  # uploads every entry separately, and the SPA is over 1,500 files — each one
  # a round trip. Through an SSM tunnel that is slow enough to read as a hang.
  provisioner "file" {
    source      = "${var.spa_dist_dir}.tgz"
    destination = "/tmp/medbrains-web.tgz"
  }
  provisioner "file" {
    source      = var.deploy_kit_dir
    destination = "/tmp/standalone"
  }

  # Written as a file, not passed inline: the connection string is a
  # credential and remote-exec inline commands are echoed to the log.
  # It lands 0644 for the seconds before the chmod below — on a host
  # with other logins, create the MedBrains database role for this
  # deploy rather than reusing one that owns the other applications.
  provisioner "file" {
    content     = <<-ATTACHENV
      ATTACH_MODE='${var.attach_mode ? 1 : 0}'
      ATTACH_REUSE_TLS='${var.attach_reuse_tls ? 1 : 0}'
      ATTACH_REUSE_POSTGRES='${var.attach_reuse_postgres ? 1 : 0}'
      ATTACH_DATABASE_URL='${var.attach_database_url}'
    ATTACHENV
    destination = "/tmp/medbrains-attach.env"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod 600 /tmp/medbrains-attach.env",
      "chmod +x /tmp/medbrains-server /tmp/medbrains-archive /tmp/medbrains-proxy /tmp/standalone/install.sh",
      "[ -f /tmp/medbrains-edge ] && chmod +x /tmp/medbrains-edge || true",
      "sudo bash -c 'set -a; . /tmp/medbrains-attach.env; set +a; bash /tmp/standalone/install.sh ${var.domain} ${var.admin_email} \"\" ${var.edge_proxy}'",
      # sudo, because install.sh runs as root and may have replaced this file
      # with a root-owned copy. An unprivileged rm fails silently enough to
      # leave a database connection string in /tmp indefinitely.
      "sudo rm -f /tmp/medbrains-attach.env",
    ]
  }
}

output "public_ip" {
  value = var.existing_ipv4
}

output "ssh_endpoint" {
  value = "${var.ssh_user}@${var.existing_ipv4}"
}
