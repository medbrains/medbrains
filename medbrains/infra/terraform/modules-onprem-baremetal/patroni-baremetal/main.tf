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
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
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

# ── etcd TLS ──────────────────────────────────────────────────────────
# etcd is Patroni's source of truth for who is primary. On plain HTTP anyone on the hospital
# LAN could read it or write a new leader key and split the cluster. Every member and Patroni
# get a certificate from a CA made here; etcd requires client certificates on both ports.
# The keys live in Terraform state, which already holds this cluster's secrets.

locals {
  etcd_pki_dir = "${abspath(path.module)}/ansible/pki-${var.tenant_id}"
  # A member is named by IP or by DNS name; its certificate has to say which.
  etcd_host_is_ip = [for h in var.etcd_hosts : can(regex("^[0-9.]+$|:", h))]
}

resource "tls_private_key" "etcd_ca" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_self_signed_cert" "etcd_ca" {
  private_key_pem       = tls_private_key.etcd_ca.private_key_pem
  is_ca_certificate     = true
  validity_period_hours = 87600 # 10 years: rotating the CA means re-issuing every member
  allowed_uses          = ["cert_signing", "crl_signing"]
  subject {
    common_name = "${local.cluster_id}-etcd-ca"
  }
}

resource "tls_private_key" "etcd_member" {
  count       = length(var.etcd_hosts)
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "etcd_member" {
  count           = length(var.etcd_hosts)
  private_key_pem = tls_private_key.etcd_member[count.index].private_key_pem
  ip_addresses    = local.etcd_host_is_ip[count.index] ? [var.etcd_hosts[count.index], "127.0.0.1"] : ["127.0.0.1"]
  dns_names       = local.etcd_host_is_ip[count.index] ? ["localhost"] : [var.etcd_hosts[count.index], "localhost"]
  subject {
    common_name = "etcd-${count.index + 1}"
  }
}

resource "tls_locally_signed_cert" "etcd_member" {
  count                 = length(var.etcd_hosts)
  cert_request_pem      = tls_cert_request.etcd_member[count.index].cert_request_pem
  ca_private_key_pem    = tls_private_key.etcd_ca.private_key_pem
  ca_cert_pem           = tls_self_signed_cert.etcd_ca.cert_pem
  validity_period_hours = 43800 # 5 years
  # Members are servers to clients and both ends of peer links.
  allowed_uses = ["digital_signature", "key_encipherment", "server_auth", "client_auth"]
}

resource "tls_private_key" "patroni_etcd" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "patroni_etcd" {
  private_key_pem = tls_private_key.patroni_etcd.private_key_pem
  subject {
    common_name = "patroni"
  }
}

resource "tls_locally_signed_cert" "patroni_etcd" {
  cert_request_pem      = tls_cert_request.patroni_etcd.cert_request_pem
  ca_private_key_pem    = tls_private_key.etcd_ca.private_key_pem
  ca_cert_pem           = tls_self_signed_cert.etcd_ca.cert_pem
  validity_period_hours = 43800
  allowed_uses          = ["digital_signature", "key_encipherment", "client_auth"]
}

# Handed to Ansible as files on the operator's machine, readable by the operator only;
# ansible/pki-*/ is git-ignored.
resource "local_file" "etcd_ca_cert" {
  filename        = "${local.etcd_pki_dir}/ca.crt"
  content         = tls_self_signed_cert.etcd_ca.cert_pem
  file_permission = "0644"
}

resource "local_file" "etcd_member_cert" {
  count           = length(var.etcd_hosts)
  filename        = "${local.etcd_pki_dir}/etcd-${count.index + 1}.crt"
  content         = tls_locally_signed_cert.etcd_member[count.index].cert_pem
  file_permission = "0644"
}

resource "local_sensitive_file" "etcd_member_key" {
  count           = length(var.etcd_hosts)
  filename        = "${local.etcd_pki_dir}/etcd-${count.index + 1}.key"
  content         = tls_private_key.etcd_member[count.index].private_key_pem
  file_permission = "0600"
}

resource "local_file" "patroni_etcd_cert" {
  filename        = "${local.etcd_pki_dir}/patroni.crt"
  content         = tls_locally_signed_cert.patroni_etcd.cert_pem
  file_permission = "0644"
}

resource "local_sensitive_file" "patroni_etcd_key" {
  filename        = "${local.etcd_pki_dir}/patroni.key"
  content         = tls_private_key.patroni_etcd.private_key_pem
  file_permission = "0600"
}

resource "null_resource" "etcd" {
  triggers = {
    etcd_hosts   = join(",", var.etcd_hosts)
    etcd_version = var.etcd_version
    etcd_ca      = sha256(tls_self_signed_cert.etcd_ca.cert_pem)
  }

  provisioner "local-exec" {
    command = <<-EOT
      ANSIBLE_HOST_KEY_CHECKING=False \
      ansible-playbook \
        -i ${local_file.inventory.filename} \
        --private-key=${var.ssh_private_key_path} \
        --extra-vars 'cluster_id=${local.cluster_id} etcd_version=${var.etcd_version} etcd_hosts_csv=${join(",", var.etcd_hosts)} etcd_pki_dir=${local.etcd_pki_dir}' \
        ${path.module}/ansible/etcd.yml
    EOT
  }
  depends_on = [local_file.etcd_ca_cert, local_file.etcd_member_cert, local_sensitive_file.etcd_member_key]
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
        --extra-vars 'cluster_id=${local.cluster_id} pg_version=${var.pg_version} patroni_version=${var.patroni_version} etcd_hosts_csv=${join(",", var.etcd_hosts)} pg_data_block_device=${var.pg_data_block_device} synchronous_replication=${var.synchronous_replication} etcd_pki_dir=${local.etcd_pki_dir}' \
        ${path.module}/ansible/patroni.yml
    EOT
  }

  depends_on = [null_resource.etcd, local_file.patroni_etcd_cert, local_sensitive_file.patroni_etcd_key]
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
