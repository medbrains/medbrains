# Patroni HA Postgres — on-prem variant (Proxmox).
#
# Mirrors infra/terraform/modules/patroni-cluster/ (the AWS-EC2
# variant) but provisions VMs on Proxmox. Same Patroni 3.3 + etcd 3.5
# + PostgreSQL 16 stack; different IaaS, different package manager
# (apt instead of dnf), different bootstrap path (no IMDS, no Secrets
# Manager — values come from cloud-init user-data env file and sops-
# encrypted secrets dropped into /etc/medbrains/secrets/).
#
# Defaults: 3 PG VMs + 3 etcd VMs on a single Proxmox node. For
# multi-node Proxmox clusters, override `proxmox_node_per_vm` to
# spread across hosts.
#
# WAL archive: default is local /var/lib/medbrains/wal-archive (no
# cloud egress required). Hybrid tenants can add an rsync to
# cloud S3 over the Headscale tailnet via Flux; out of scope for
# this module so the on-prem-only deploy mode works without any
# cloud dependency.

terraform {
  required_version = ">= 1.7"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.101"
    }
  }
}

variable "tenant_id" {
  type = string
}

variable "proxmox_node" {
  type        = string
  description = "Default Proxmox node for all VMs (single-host clusters)"
}

variable "vm_template_id" {
  type        = string
  description = "Cloud-init Debian 12 template id"
}

variable "ssh_public_key" {
  type = string
}

variable "network_bridge" {
  type    = string
  default = "vmbr0"
}

variable "vlan_tag" {
  type    = number
  default = null
}

variable "storage_pool" {
  type    = string
  default = "local-lvm"
}

variable "pg_vcpus" {
  type    = number
  default = 4
}

variable "pg_memory_mb" {
  type    = number
  default = 8192
}

variable "pg_data_disk_gb" {
  type    = number
  default = 200
}

variable "etcd_vcpus" {
  type    = number
  default = 1
}

variable "etcd_memory_mb" {
  type    = number
  default = 1024
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

variable "synchronous_replication" {
  type    = bool
  default = true
}

locals {
  cluster_id   = "medbrains-${var.tenant_id}-onprem-pg"
  pg_indexes   = [1, 2, 3]
  etcd_indexes = [1, 2, 3]
}

# ── Cloud-init snippets ───────────────────────────────────────────────

resource "proxmox_virtual_environment_file" "pg_userdata" {
  for_each     = toset([for i in local.pg_indexes : tostring(i)])
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${local.cluster_id}-pg-${each.value}.yaml"
    data = templatefile("${path.module}/cloud-init-pg.yaml.tmpl", {
      cluster_id              = local.cluster_id
      node_id                 = "pg-${each.value}"
      pg_version              = var.pg_version
      patroni_version         = var.patroni_version
      etcd_peers_csv          = join(",", [for v in proxmox_virtual_environment_vm.etcd : v.ipv4_addresses[1][0]])
      synchronous_replication = var.synchronous_replication ? "true" : "false"
    })
  }

  depends_on = [proxmox_virtual_environment_vm.etcd]
}

resource "proxmox_virtual_environment_file" "etcd_userdata" {
  for_each     = toset([for i in local.etcd_indexes : tostring(i)])
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${local.cluster_id}-etcd-${each.value}.yaml"
    data = templatefile("${path.module}/cloud-init-etcd.yaml.tmpl", {
      cluster_id   = local.cluster_id
      node_id      = "etcd-${each.value}"
      node_index   = each.value
      etcd_version = var.etcd_version
    })
  }
}

# ── etcd VMs (provisioned first; PG VMs depend on their IPs) ──────────

resource "proxmox_virtual_environment_vm" "etcd" {
  for_each  = toset([for i in local.etcd_indexes : tostring(i)])
  name      = "${local.cluster_id}-etcd-${each.value}"
  node_name = var.proxmox_node
  tags      = ["medbrains", "onprem", "etcd", var.tenant_id]

  clone {
    vm_id = tonumber(var.vm_template_id)
  }

  cpu {
    cores = var.etcd_vcpus
    type  = "host"
  }

  memory {
    dedicated = var.etcd_memory_mb
  }

  network_device {
    bridge  = var.network_bridge
    model   = "virtio"
    vlan_id = var.vlan_tag
  }

  disk {
    interface    = "scsi0"
    datastore_id = var.storage_pool
    size         = 20
    file_format  = "raw"
  }

  initialization {
    user_account {
      username = "medbrains"
      keys     = [var.ssh_public_key]
    }
    user_data_file_id = proxmox_virtual_environment_file.etcd_userdata[each.value].id
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }

  agent {
    enabled = true
    timeout = "5m"
  }
}

# ── Patroni PG VMs ────────────────────────────────────────────────────

resource "proxmox_virtual_environment_vm" "pg" {
  for_each  = toset([for i in local.pg_indexes : tostring(i)])
  name      = "${local.cluster_id}-pg-${each.value}"
  node_name = var.proxmox_node
  tags      = ["medbrains", "onprem", "patroni", "pg-${each.value}", var.tenant_id]

  clone {
    vm_id = tonumber(var.vm_template_id)
  }

  cpu {
    cores = var.pg_vcpus
    type  = "host"
  }

  memory {
    dedicated = var.pg_memory_mb
  }

  network_device {
    bridge  = var.network_bridge
    model   = "virtio"
    vlan_id = var.vlan_tag
  }

  # Boot disk (root)
  disk {
    interface    = "scsi0"
    datastore_id = var.storage_pool
    size         = 30
    file_format  = "raw"
  }
  # Dedicated PG data disk — separate from root so root upgrades
  # don't touch /var/lib/medbrains/pg_data
  disk {
    interface    = "scsi1"
    datastore_id = var.storage_pool
    size         = var.pg_data_disk_gb
    file_format  = "raw"
  }

  initialization {
    user_account {
      username = "medbrains"
      keys     = [var.ssh_public_key]
    }
    user_data_file_id = proxmox_virtual_environment_file.pg_userdata[each.value].id
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }

  agent {
    enabled = true
    timeout = "5m"
  }

  depends_on = [proxmox_virtual_environment_vm.etcd]
}

# ── Outputs ───────────────────────────────────────────────────────────

output "pg_ips" {
  value = [for v in proxmox_virtual_environment_vm.pg : v.ipv4_addresses[1][0]]
}

output "etcd_ips" {
  value = [for v in proxmox_virtual_environment_vm.etcd : v.ipv4_addresses[1][0]]
}

output "writer_endpoint_hint" {
  value       = "On-prem has no NLB. Cluster app uses Patroni REST `/leader` discovery; or run HAProxy as a sidecar on the K3s cluster pointed at these PG IPs. Connect string: postgres://app@<leader-ip>:5432/medbrains"
  description = "Operational guidance"
}

output "cluster_id" {
  value = local.cluster_id
}
