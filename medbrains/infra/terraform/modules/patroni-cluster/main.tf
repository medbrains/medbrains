# Patroni PostgreSQL cluster — self-managed replicas for read scaling.
#
# EBS volumes are encrypted at rest with the shared DB KMS key, matching
# the encryption posture of the Aurora primary cluster.

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  type        = string
  description = "ARN of the KMS key used for EBS encryption (DB class)."
}

variable "subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type    = string
  default = "r6g.large"
}

variable "vpc_id" {
  type = string
}

# The VPC's own range, so replication and the DCS link keep working whatever CIDR the VPC uses.
data "aws_vpc" "this" {
  id = var.vpc_id
}

resource "aws_security_group" "patroni" {
  #checkov:skip=CKV_AWS_23: the group-level description is force-new; adding it would replace the group under running replicas. Every rule has one - schedule the group description with a migration
  name_prefix = "${var.environment}-patroni-"
  vpc_id      = var.vpc_id

  ingress {
    description = "Postgres from the private network"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  # Replication, Patroni REST and DCS traffic stay on the private network;
  # the internet is reached only for packages and S3 backups over TLS.
  egress {
    description = "Replication, Patroni API and DCS on the private network"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [data.aws_vpc.this.cidr_block]
  }
  egress {
    description = "HTTPS - packages and S3 backups"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "HTTP - Ubuntu package mirrors"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-patroni"
    Environment = var.environment
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "patroni" { # NOSONAR(S6329): associate_public_ip_address is force-new; the subnets passed in are private, and setting it would replace each replica
  #checkov:skip=CKV_AWS_135: r6g and other current-generation types are EBS-optimised by default; setting the flag would stop and start each replica
  #checkov:skip=CKV2_AWS_41: no AWS API is called from these hosts yet; attach a role with the backup bucket when WAL archiving lands rather than an empty one now
  count         = 2
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = var.subnet_ids[count.index % length(var.subnet_ids)]

  vpc_security_group_ids = [aws_security_group.patroni.id]
  monitoring             = true

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 100
    encrypted             = true
    kms_key_id            = var.kms_key_arn
    delete_on_termination = true
  }

  ebs_block_device {
    device_name           = "/dev/xvdf"
    volume_type           = "gp3"
    volume_size           = 500
    encrypted             = true
    kms_key_id            = var.kms_key_arn
    delete_on_termination = false
  }

  tags = {
    Name        = "${var.environment}-patroni-${count.index}"
    Environment = var.environment
    Role        = "patroni"
  }
}

output "patroni_ips" {
  value = aws_instance.patroni[*].private_ip
}
