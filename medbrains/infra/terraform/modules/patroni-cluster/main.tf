# Patroni HA Postgres cluster — 3 PG nodes + 3 etcd nodes + NLB.
# Sprint B per RFCs/sprints/SPRINT-B-patroni-ha.md §2.
#
# Bootstrap-class module: terraform validate ✓, real bodies filled in
# Phase B.2. Inputs + outputs are stable so consumers can wire against
# them now.

variable "region"             { type = string }
variable "environment"        { type = string }
variable "vpc_id"             { type = string }
variable "private_subnet_ids" {
  type        = list(string)
  description = "3 subnets, one per AZ"
  validation {
    condition     = length(var.private_subnet_ids) == 3
    error_message = "Patroni cluster requires exactly 3 subnets (one per AZ)."
  }
}
variable "kms_key_arn"          { type = string }
variable "wal_archive_bucket"   { type = string }
variable "instance_type" {
  type    = string
  default = "r7g.large"
}
variable "etcd_instance_type" {
  type    = string
  default = "t4g.small"
}
variable "pg_version" {
  type    = string
  default = "16"
}
variable "patroni_version" {
  type    = string
  default = "3.3"
}
variable "etcd_version" {
  type    = string
  default = "3.5"
}
variable "synchronous_replication" {
  type    = bool
  default = true
}

locals {
  cluster_id = "medbrains-${var.environment}-${var.region}-pg"
}

# Custom AMI — built by Packer in infra/packer/postgres-bottlerocket/.
# Filtered by tag so we always pick the latest validated AMI without
# requiring the consumer to bump an ID.
data "aws_ami" "postgres" {
  most_recent = true
  owners      = ["self"]
  filter {
    name   = "tag:medbrains-image"
    values = ["postgres-${var.pg_version}-patroni-${var.patroni_version}"]
  }
}

data "aws_ami" "etcd" {
  most_recent = true
  owners      = ["self"]
  filter {
    name   = "tag:medbrains-image"
    values = ["etcd-${var.etcd_version}"]
  }
}

# ── Security groups ────────────────────────────────────────────────

resource "aws_security_group" "pg" {
  name        = "${local.cluster_id}-pg-sg"
  description = "Patroni PG nodes — 5432 from HAProxy + 5432 peer-to-peer for replication"
  vpc_id      = var.vpc_id

  # PG protocol from HAProxy NLB targets (peer NLB SG)
  ingress {
    description     = "PG from HAProxy"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.haproxy.id]
  }
  # Streaming replication peer-to-peer
  ingress {
    description = "PG peer-to-peer"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    self        = true
  }
  # Patroni REST API on 8008 from HAProxy (health check)
  ingress {
    description     = "Patroni REST from HAProxy"
    from_port       = 8008
    to_port         = 8008
    protocol        = "tcp"
    security_groups = [aws_security_group.haproxy.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "etcd" {
  name        = "${local.cluster_id}-etcd-sg"
  description = "etcd quorum — 2379 from PG nodes + 2380 peer-to-peer"
  vpc_id      = var.vpc_id

  ingress {
    description     = "etcd client from PG"
    from_port       = 2379
    to_port         = 2379
    protocol        = "tcp"
    security_groups = [aws_security_group.pg.id]
  }
  ingress {
    description = "etcd peer-to-peer"
    from_port   = 2380
    to_port     = 2380
    protocol    = "tcp"
    self        = true
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "haproxy" {
  name        = "${local.cluster_id}-haproxy-sg"
  description = "HAProxy in front of Patroni leader"
  vpc_id      = var.vpc_id
  ingress {
    description = "PG protocol from EKS workload"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.10.0.0/16"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── IAM role for PG nodes — pgBackRest WAL archive ─────────────────

data "aws_iam_policy_document" "pg_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "pg" {
  name               = "${local.cluster_id}-pg-role"
  assume_role_policy = data.aws_iam_policy_document.pg_assume.json
}

data "aws_iam_policy_document" "pg_wal" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = [var.wal_archive_bucket, "${var.wal_archive_bucket}/*"]
  }
  statement {
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "pg_wal" {
  role   = aws_iam_role.pg.id
  policy = data.aws_iam_policy_document.pg_wal.json
}

resource "aws_iam_instance_profile" "pg" {
  name = "${local.cluster_id}-pg-profile"
  role = aws_iam_role.pg.name
}

# ── PG nodes — 3 instances across 3 AZs ────────────────────────────

resource "aws_instance" "pg" {
  count                  = 3
  ami                    = data.aws_ami.postgres.id
  instance_type          = var.instance_type
  subnet_id              = var.private_subnet_ids[count.index]
  vpc_security_group_ids = [aws_security_group.pg.id]
  iam_instance_profile   = aws_iam_instance_profile.pg.name

  # Cloud-init reads these tags + writes the patroni.yml + pgBackRest config
  tags = {
    Name                  = "${local.cluster_id}-pg-${count.index + 1}"
    medbrains-pg-role     = "leader-candidate"
    medbrains-pg-cluster  = local.cluster_id
    medbrains-pg-node-id  = "pg-${count.index + 1}"
    medbrains-etcd-peers  = join(",", aws_instance.etcd[*].private_ip)
    medbrains-wal-bucket  = var.wal_archive_bucket
    medbrains-sync-rep    = var.synchronous_replication ? "true" : "false"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 50
    encrypted   = true
    kms_key_id  = var.kms_key_arn
  }

  # PG data on a dedicated EBS volume so root upgrades don't touch data
  ebs_block_device {
    device_name = "/dev/xvdf"
    volume_type = "gp3"
    volume_size = 200
    iops        = 12000
    throughput  = 250
    encrypted   = true
    kms_key_id  = var.kms_key_arn
    delete_on_termination = false
  }

  lifecycle {
    ignore_changes = [ami] # AMI bumps go through rolling switchover, not Terraform
  }
}

# ── etcd nodes — 3 instances across 3 AZs ──────────────────────────

resource "aws_instance" "etcd" {
  count                  = 3
  ami                    = data.aws_ami.etcd.id
  instance_type          = var.etcd_instance_type
  subnet_id              = var.private_subnet_ids[count.index]
  vpc_security_group_ids = [aws_security_group.etcd.id]
  tags = {
    Name                 = "${local.cluster_id}-etcd-${count.index + 1}"
    medbrains-etcd-role  = "member"
    medbrains-pg-cluster = local.cluster_id
  }
}

# ── HAProxy NLB — points at the current Patroni leader ──────────────

resource "aws_lb" "haproxy" {
  name               = "${local.cluster_id}-haproxy"
  internal           = true
  load_balancer_type = "network"
  subnets            = var.private_subnet_ids
}

resource "aws_lb_target_group" "writer" {
  name        = "${local.cluster_id}-writer-tg"
  port        = 5432
  protocol    = "TCP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  # Patroni's REST /leader endpoint returns 200 only on the current leader.
  # All 3 nodes are registered; only the leader passes the health check.
  health_check {
    protocol            = "HTTP"
    port                = "8008"
    path                = "/leader"
    interval            = 10
    timeout             = 3
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }
}

resource "aws_lb_target_group_attachment" "writer" {
  count            = 3
  target_group_arn = aws_lb_target_group.writer.arn
  target_id        = aws_instance.pg[count.index].id
  port             = 5432
}

resource "aws_lb_listener" "writer" {
  load_balancer_arn = aws_lb.haproxy.arn
  port              = 5432
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.writer.arn
  }
}

# Reader endpoint — load-balances across replicas (Patroni /replica returns
# 200 only on replicas)
resource "aws_lb_target_group" "reader" {
  name        = "${local.cluster_id}-reader-tg"
  port        = 5432
  protocol    = "TCP"
  target_type = "instance"
  vpc_id      = var.vpc_id
  health_check {
    protocol            = "HTTP"
    port                = "8008"
    path                = "/replica"
    interval            = 10
    timeout             = 3
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }
}

resource "aws_lb_target_group_attachment" "reader" {
  count            = 3
  target_group_arn = aws_lb_target_group.reader.arn
  target_id        = aws_instance.pg[count.index].id
  port             = 5432
}

resource "aws_lb_listener" "reader" {
  load_balancer_arn = aws_lb.haproxy.arn
  port              = 5433 # different port to disambiguate writer vs reader
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.reader.arn
  }
}

# ── Outputs ─────────────────────────────────────────────────────────

output "writer_endpoint" {
  value       = "${aws_lb.haproxy.dns_name}:5432"
  description = "Patroni leader (writer). Failover automatic via Patroni + HAProxy /leader health check."
}

output "reader_endpoint" {
  value       = "${aws_lb.haproxy.dns_name}:5433"
  description = "Patroni replicas (reads). Load-balanced across healthy non-leader nodes."
}

output "etcd_endpoints" {
  value       = [for i in aws_instance.etcd : "${i.private_ip}:2379"]
  description = "etcd peer endpoints — for ops debugging only; app does NOT talk to etcd directly."
  sensitive   = false
}

output "wal_archive_bucket" {
  value = var.wal_archive_bucket
}
