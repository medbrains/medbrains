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

resource "aws_security_group" "patroni" {
  name_prefix = "${var.environment}-patroni-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
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

resource "aws_instance" "patroni" {
  count         = 2
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = var.subnet_ids[count.index % length(var.subnet_ids)]

  vpc_security_group_ids = [aws_security_group.patroni.id]

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
