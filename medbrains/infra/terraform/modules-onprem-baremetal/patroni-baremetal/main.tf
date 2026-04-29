# Patroni HA on bare-metal Linux — Ansible-driven.
#
# Same Patroni 3.3 + etcd 3.5 + PG 16 stack as the Proxmox variant,
# but installs onto pre-existing Debian 12 / Ubuntu 24.04 hosts.
# Hospital admin provides the host IPs; Terraform runs Ansible.
#
# Disk layout assumption: /dev/sdb (or configurable) is a separate
# block device for /var/lib/medbrains/pg_data. If only one disk
# exists, set `pg_data_path_override` to a directory on the root FS
# (gives up the upgrade-safety property of dedicated data disk).

terraform {
  required_version = ">= 1.7"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

variable "tenant_id" {
  type = string
}

variable "pg_hosts" {
  type        = list(string)
  description = "3 host IPs/FQDNs for the Patroni PG nodes"
  validation {
    condition     = length(var.pg_hosts) == 3
    error_message = "Patroni HA requires exactly 3 PG hosts."
  }
}

variable "etcd_hosts" {
  type        = list(string)
  description = "3 host IPs/FQDNs for etcd members"
  validation {
    condition     = length(var.etcd_hosts) == 3
    error_message = "etcd quorum requires exactly 3 hosts."
  }
}

variable "ssh_user" {
  type    = string
  default = "medbrains"
}

variable "ssh_private_key_path" {
  type = string
}

variable "pg_version" {
  type    = string
  default = "16"
}

variable "patroni_version" {
  type    = string
  default = "3.3.2"
}

variable "etcd_version" {
  type    = string
  default = "3.5.17"
}

variable "pg_data_block_device" {
  type        = string
  default     = "/dev/sdb"
  description = "Dedicated data disk; set to empty string to use root FS"
}

variable "synchronous_replication" {
  type    = bool
  default = true
}

locals {
  cluster_id = "medbrains-${var.tenant_id}-baremetal-pg"
  inventory = templatefile("${path.module}/ansible/inventory.tmpl", {
    pg_hosts   = var.pg_hosts
    etcd_hosts = var.etcd_hosts
    ssh_user   = var.ssh_user
  })
}

resource "local_file" "inventory" {
  filename = "${path.module}/ansible/inventory-${var.tenant_id}.ini"
  content  = local.inventory
}

resource "null_resource" "etcd" {
  triggers = {
    etcd_hosts   = join(",", var.etcd_hosts)
    etcd_version = var.etcd_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      ANSIBLE_HOST_KEY_CHECKING=False \
      ansible-playbook \
        -i ${local_file.inventory.filename} \
        --private-key=${var.ssh_private_key_path} \
        --extra-vars 'cluster_id=${local.cluster_id} etcd_version=${var.etcd_version} etcd_hosts_csv=${join(",", var.etcd_hosts)}' \
        ${path.module}/ansible/etcd.yml
    EOT
  }
}

resource "null_resource" "patroni" {
  triggers = {
    pg_hosts        = join(",", var.pg_hosts)
    pg_version      = var.pg_version
    patroni_version = var.patroni_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      ANSIBLE_HOST_KEY_CHECKING=False \
      ansible-playbook \
        -i ${local_file.inventory.filename} \
        --private-key=${var.ssh_private_key_path} \
        --extra-vars 'cluster_id=${local.cluster_id} pg_version=${var.pg_version} patroni_version=${var.patroni_version} etcd_hosts_csv=${join(",", var.etcd_hosts)} pg_data_block_device=${var.pg_data_block_device} synchronous_replication=${var.synchronous_replication}' \
        ${path.module}/ansible/patroni.yml
    EOT
  }

  depends_on = [null_resource.etcd]
}

output "cluster_id" {
  value = local.cluster_id
}

output "pg_hosts" {
  value = var.pg_hosts
}

output "etcd_hosts" {
  value = var.etcd_hosts
}
