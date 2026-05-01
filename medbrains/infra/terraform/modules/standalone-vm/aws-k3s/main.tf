# Enterprise-k3s tier — single ARM EC2 host running k3s + RDS + S3
# + cert-manager + ingress-nginx + medbrains-server Helm release.
#
# Apply order:
#   1. AWS resources (instance, EIP, RDS, S3) materialise.
#   2. cloud-init installs k3s, helm, kubectl on the node.
#   3. null_resource.bootstrap helm-installs cert-manager,
#      ingress-nginx, and the medbrains-server chart with the RDS
#      DATABASE_URL wired in.
#   4. ingress-nginx grabs the EIP via NodePort + iptables — no
#      AWS LoadBalancer needed.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "hostname" { type = string }
variable "domain" { type = string }
variable "admin_email" { type = string }
variable "instance_type" { type = string }
variable "ami" { type = string }
variable "ssh_key_name" { type = string }
variable "ssh_user" { type = string }
variable "ssh_private_key" {
  type      = string
  sensitive = true
}
variable "image_uri" { type = string }
variable "rds_instance_class" { type = string }
variable "hot_to_cold_days" { type = number }

variable "helm_chart_dir" {
  type        = string
  description = "Local path to deploy/helm/medbrains-server/. Uploaded to the node and helm-installed."
  default     = ""
}

variable "ghcr_pull_token" {
  type        = string
  description = "GHCR PAT for private packages. Empty = image is public."
  sensitive   = true
  default     = ""
}

variable "github_username" {
  type        = string
  description = "GitHub username for GHCR pull (only used if ghcr_pull_token set)."
  default     = ""
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  is_arm = can(regex("^[a-z][0-9]+g[a-z]*\\.", var.instance_type))
  arch   = local.is_arm ? "arm64" : "amd64"
}

data "aws_ami" "ubuntu" {
  count       = var.ami == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-${local.arch}-server-*"]
  }
  filter {
    name   = "architecture"
    values = [local.arch == "arm64" ? "arm64" : "x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── Networking ────────────────────────────────────────────────────────

resource "aws_security_group" "node" {
  name        = "${var.hostname}-k3s-sg"
  description = "k3s node - 22/80/443 + 6443 internal"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP - ACME + redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "k3s API - VPC internal only"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "db" {
  name        = "${var.hostname}-db-sg"
  description = "RDS ingress from k3s node"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres from node"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.node.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

# ── EC2 + cloud-init k3s install ──────────────────────────────────────

locals {
  user_data = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # ── k3s server (no Traefik — we install ingress-nginx instead) ──
    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.31.5+k3s1 sh -s - \
      --disable=traefik \
      --write-kubeconfig-mode=0644 \
      --tls-san=${var.domain}

    # ── kubectl + helm on the node so bootstrap can run there ──
    install -m 0755 /usr/local/bin/k3s /usr/local/bin/kubectl || true
    curl -fsSL https://get.helm.sh/helm-v3.16.2-linux-${local.arch}.tar.gz \
      | tar -xz -C /tmp linux-${local.arch}/helm
    install -m 0755 /tmp/linux-${local.arch}/helm /usr/local/bin/helm

    # Surface kubeconfig for the ssh user.
    mkdir -p /home/${var.ssh_user}/.kube
    cp /etc/rancher/k3s/k3s.yaml /home/${var.ssh_user}/.kube/config
    chown -R ${var.ssh_user}:${var.ssh_user} /home/${var.ssh_user}/.kube

    # Wait for the cluster to be ready.
    until kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get nodes 2>/dev/null | grep -q ' Ready '; do
      sleep 3
    done
  EOT
}

resource "aws_instance" "node" {
  ami                    = var.ami != "" ? var.ami : data.aws_ami.ubuntu[0].id
  instance_type          = var.instance_type
  key_name               = var.ssh_key_name
  vpc_security_group_ids = [aws_security_group.node.id]
  subnet_id              = data.aws_subnets.default.ids[0]
  user_data              = local.user_data

  root_block_device {
    volume_size = 60
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required"
  }

  tags = local.tags
}

resource "aws_eip" "node" {
  instance = aws_instance.node.id
  domain   = "vpc"
  tags     = local.tags
}

# ── RDS ──────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "this" {
  name       = "${var.hostname}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = local.tags
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "this" {
  identifier              = "${var.hostname}-pg"
  engine                  = "postgres"
  engine_version          = "17.2"
  instance_class          = var.rds_instance_class
  allocated_storage       = 20
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = "medbrains"
  username                = "medbrains_admin"
  password                = random_password.db.result
  multi_az                = true
  publicly_accessible     = false
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  backup_retention_period = 7
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = local.tags
}

# ── S3 bucket with lifecycle to STANDARD_IA + Glacier ────────────────

resource "aws_s3_bucket" "this" {
  bucket = "${var.hostname}-mrd"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "hot-to-cold-to-archive"
    status = "Enabled"

    filter {}

    transition {
      days          = var.hot_to_cold_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.hot_to_cold_days * 4
      storage_class = "GLACIER"
    }
  }
}

# ── Cluster bootstrap (cert-manager + ingress-nginx + chart) ──────────

resource "null_resource" "wait_for_ssh" {
  triggers = { eip_id = aws_eip.node.id }

  provisioner "remote-exec" {
    inline = ["cloud-init status --wait || true"]

    connection {
      type        = "ssh"
      host        = aws_eip.node.public_ip
      user        = var.ssh_user
      private_key = var.ssh_private_key
      timeout     = "10m"
    }
  }
}

resource "null_resource" "upload_chart" {
  count = var.helm_chart_dir != "" ? 1 : 0

  triggers = {
    eip_id     = aws_eip.node.id
    chart_hash = filemd5("${var.helm_chart_dir}/Chart.yaml")
  }

  connection {
    type        = "ssh"
    host        = aws_eip.node.public_ip
    user        = var.ssh_user
    private_key = var.ssh_private_key
    timeout     = "5m"
  }

  provisioner "file" {
    source      = var.helm_chart_dir
    destination = "/tmp/medbrains-server-chart"
  }

  depends_on = [null_resource.wait_for_ssh]
}

resource "null_resource" "bootstrap_cluster" {
  count = var.helm_chart_dir != "" ? 1 : 0

  triggers = {
    eip_id      = aws_eip.node.id
    chart_hash  = filemd5("${var.helm_chart_dir}/Chart.yaml")
    image_uri   = var.image_uri
    db_endpoint = aws_db_instance.this.endpoint
    domain      = var.domain
    admin_email = var.admin_email
  }

  connection {
    type        = "ssh"
    host        = aws_eip.node.public_ip
    user        = var.ssh_user
    private_key = var.ssh_private_key
    timeout     = "15m"
  }

  provisioner "remote-exec" {
    inline = [
      "set -euo pipefail",
      "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml",

      # cert-manager (CRDs + controller)
      "sudo helm repo add jetstack https://charts.jetstack.io --force-update",
      "sudo helm repo update",
      "sudo helm upgrade --install cert-manager jetstack/cert-manager \\",
      "  --namespace cert-manager --create-namespace \\",
      "  --version v1.16.2 \\",
      "  --set crds.enabled=true \\",
      "  --wait --timeout=10m",

      # Cluster issuer for Let's Encrypt prod (HTTP-01 via ingress-nginx)
      "cat <<EOF | sudo kubectl apply -f -",
      "apiVersion: cert-manager.io/v1",
      "kind: ClusterIssuer",
      "metadata:",
      "  name: letsencrypt-prod",
      "spec:",
      "  acme:",
      "    server: https://acme-v02.api.letsencrypt.org/directory",
      "    email: ${var.admin_email}",
      "    privateKeySecretRef:",
      "      name: letsencrypt-prod-account-key",
      "    solvers:",
      "      - http01:",
      "          ingress:",
      "            class: nginx",
      "EOF",

      # ingress-nginx (NodePort hostNetwork — single-node k3s)
      "sudo helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update",
      "sudo helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \\",
      "  --namespace ingress-nginx --create-namespace \\",
      "  --version 4.11.3 \\",
      "  --set controller.service.type=ClusterIP \\",
      "  --set controller.hostNetwork=true \\",
      "  --set controller.hostPort.enabled=true \\",
      "  --set controller.dnsPolicy=ClusterFirstWithHostNet \\",
      "  --wait --timeout=10m",

      # GHCR pull secret (only if PAT provided)
      var.ghcr_pull_token != "" ? "sudo kubectl create namespace medbrains --dry-run=client -o yaml | sudo kubectl apply -f -" : "true",
      var.ghcr_pull_token != "" ? "sudo kubectl -n medbrains create secret docker-registry ghcr-pull --docker-server=ghcr.io --docker-username='${var.github_username}' --docker-password='${var.ghcr_pull_token}' --dry-run=client -o yaml | sudo kubectl apply -f -" : "true",

      # medbrains-server Helm release
      "sudo helm upgrade --install medbrains /tmp/medbrains-server-chart \\",
      "  --namespace medbrains --create-namespace \\",
      "  --set image.repository='${split(":", var.image_uri)[0]}' \\",
      "  --set image.tag='${length(split(":", var.image_uri)) > 1 ? split(":", var.image_uri)[1] : "latest"}' \\",
      "  --set ingress.host='${var.domain}' \\",
      "  --set config.domain='${var.domain}' \\",
      "  --set config.adminEmail='${var.admin_email}' \\",
      "  --set database.url='postgres://medbrains_admin:${random_password.db.result}@${aws_db_instance.this.endpoint}/medbrains?sslmode=require' \\",
      var.ghcr_pull_token != "" ? "  --set image.pullSecretName=ghcr-pull \\" : "  \\",
      "  --wait --timeout=10m",
    ]
  }

  depends_on = [
    null_resource.upload_chart,
    aws_db_instance.this,
  ]
}

# ── Tags ──────────────────────────────────────────────────────────────

locals {
  tags = {
    Name      = var.hostname
    Project   = "medbrains"
    Tier      = "enterprise-k3s"
    ManagedBy = "terraform"
  }
}

# ── Outputs ───────────────────────────────────────────────────────────

output "public_ip" {
  value = aws_eip.node.public_ip
}

output "ssh_endpoint" {
  value = "${var.ssh_user}@${aws_eip.node.public_ip}"
}

output "db_endpoint" {
  value = aws_db_instance.this.endpoint
}

output "bucket_name" {
  value = aws_s3_bucket.this.id
}
