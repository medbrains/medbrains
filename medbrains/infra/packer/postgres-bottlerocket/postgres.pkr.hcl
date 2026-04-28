# Packer template — postgres-bottlerocket AMI
# Sprint B.2 per RFCs/sprints/SPRINT-B-patroni-ha.md §3.
#
# Build: packer build -var pg_version=16 -var patroni_version=3.3 postgres.pkr.hcl
# Output: AMI tagged `medbrains-image=postgres-{pg_version}-patroni-{patroni_version}`,
# `medbrains-built-at={timestamp}`. Terraform `data "aws_ami"` filter
# in modules/patroni-cluster/main.tf picks the most_recent matching AMI.
#
# Note: this targets Amazon Linux 2023 (not Bottlerocket) because Postgres
# requires a writable rootfs for pg_wal + pg_data — Bottlerocket's
# read-only root makes that awkward without ostree-style customization.
# AL2023 with strict CIS-benchmark hardening is the practical pick for
# stateful workloads in 2026.

packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = "~> 1.3"
    }
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "pg_version" {
  type    = string
  default = "16"
}

variable "patroni_version" {
  type    = string
  default = "3.3"
}

variable "pgbackrest_version" {
  type    = string
  default = "2.54"
}

variable "instance_type" {
  type    = string
  default = "t4g.medium"
}

# Source: AL2023 ARM64 from Amazon
data "amazon-ami" "al2023" {
  filters = {
    name                = "al2023-ami-2023.*-arm64"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
    architecture        = "arm64"
  }
  owners      = ["137112412989"] # amazon
  most_recent = true
  region      = var.region
}

source "amazon-ebs" "postgres" {
  region        = var.region
  ami_name      = "medbrains-postgres-${var.pg_version}-patroni-${var.patroni_version}-{{timestamp}}"
  instance_type = var.instance_type
  source_ami    = data.amazon-ami.al2023.id
  ssh_username  = "ec2-user"

  # Enforce IMDSv2 — CIS benchmark
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  ebs_optimized = true
  encrypt_boot  = true

  launch_block_device_mappings {
    device_name           = "/dev/xvda"
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  tags = {
    Name             = "medbrains-postgres-${var.pg_version}-patroni-${var.patroni_version}"
    medbrains-image  = "postgres-${var.pg_version}-patroni-${var.patroni_version}"
    medbrains-built-at = "{{timestamp}}"
    medbrains-base-ami = data.amazon-ami.al2023.id
    Project          = "medbrains"
    ManagedBy        = "packer"
  }
}

build {
  sources = ["source.amazon-ebs.postgres"]

  # Step 1: install Postgres, Patroni, pgBackRest
  provisioner "shell" {
    inline = [
      "set -euxo pipefail",
      "sudo dnf update -y",
      "sudo dnf install -y python3 python3-pip postgresql${var.pg_version} postgresql${var.pg_version}-server postgresql${var.pg_version}-contrib pgbackrest etcd",
      "sudo python3 -m pip install --upgrade pip",
      "sudo python3 -m pip install patroni[etcd3]==${var.patroni_version} psycopg[binary,pool]",
      "sudo systemctl disable postgresql etcd", # Patroni manages PG; etcd starts on etcd nodes only
      "sudo mkdir -p /var/lib/medbrains/{patroni,pg_data,pg_wal}",
      "sudo chown -R postgres:postgres /var/lib/medbrains",
    ]
  }

  # Step 2: install patroni systemd unit + cloud-init bootstrap script
  provisioner "file" {
    source      = "files/patroni.service"
    destination = "/tmp/patroni.service"
  }
  provisioner "file" {
    source      = "files/medbrains-bootstrap.sh"
    destination = "/tmp/medbrains-bootstrap.sh"
  }
  provisioner "file" {
    source      = "files/pgbackrest.conf.tmpl"
    destination = "/tmp/pgbackrest.conf.tmpl"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /tmp/patroni.service /etc/systemd/system/patroni.service",
      "sudo mv /tmp/medbrains-bootstrap.sh /usr/local/sbin/medbrains-bootstrap.sh",
      "sudo mv /tmp/pgbackrest.conf.tmpl /etc/medbrains/pgbackrest.conf.tmpl",
      "sudo chmod 755 /usr/local/sbin/medbrains-bootstrap.sh",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable medbrains-bootstrap.service", # runs on first boot to render configs from instance tags
    ]
  }

  # Step 3: enable softdog kernel module for Patroni watchdog
  provisioner "shell" {
    inline = [
      "echo softdog | sudo tee -a /etc/modules-load.d/softdog.conf",
      "echo 'KERNEL==\"watchdog\", OWNER=\"postgres\", GROUP=\"postgres\", MODE=\"0660\"' | sudo tee /etc/udev/rules.d/61-watchdog.rules",
    ]
  }

  # Step 4: CIS-benchmark hardening (a few highlights — full list in dr/)
  provisioner "shell" {
    inline = [
      "sudo passwd -l root",                                         # disable root login
      "echo 'PermitRootLogin no' | sudo tee -a /etc/ssh/sshd_config",
      "echo 'PasswordAuthentication no' | sudo tee -a /etc/ssh/sshd_config",
      "sudo systemctl mask telnet.socket || true",
      "sudo dnf remove -y telnet || true",
    ]
  }
}
