# VPC module — 3 AZs × (public + private + db) subnets,
# NAT GW per AZ, VPC endpoints for S3, ECR, STS, KMS,
# Secrets Manager, CloudWatch Logs.

variable "region"      { type = string }
variable "environment" { type = string }
variable "cidr_block" {
  type    = string
  default = "10.10.0.0/16"
}
variable "azs" {
  type    = list(string)
  default = ["a", "b", "c"]
}

locals {
  full_azs = [for az in var.azs : "${var.region}${az}"]
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "medbrains-${var.environment}-${var.region}" }
}

# Subnets — 3 AZs × {public, private, db}
# Public: 10.10.0.0/20 → /24 per AZ
# Private (workloads): 10.10.16.0/20 → /22 per AZ
# DB: 10.10.32.0/24 → /26 per AZ

resource "aws_subnet" "public" {
  for_each                = toset(local.full_azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, index(local.full_azs, each.value))
  availability_zone       = each.value
  map_public_ip_on_launch = true
  tags = {
    Name                     = "public-${each.value}"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_subnet" "private" {
  for_each          = toset(local.full_azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 6, 1 + index(local.full_azs, each.value)) # /22
  availability_zone = each.value
  tags = {
    Name                              = "private-${each.value}"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

resource "aws_subnet" "db" {
  for_each          = toset(local.full_azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, 32 + index(local.full_azs, each.value))
  availability_zone = each.value
  tags = { Name = "db-${each.value}" }
}

# Internet GW + NAT GW per AZ

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
}

resource "aws_eip" "nat" {
  for_each = toset(local.full_azs)
  domain   = "vpc"
}

resource "aws_nat_gateway" "this" {
  for_each      = toset(local.full_azs)
  allocation_id = aws_eip.nat[each.value].id
  subnet_id     = aws_subnet.public[each.value].id
  tags          = { Name = "nat-${each.value}" }
}

# Route tables

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}

resource "aws_route_table_association" "public" {
  for_each       = toset(local.full_azs)
  subnet_id      = aws_subnet.public[each.value].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  for_each = toset(local.full_azs)
  vpc_id   = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.value].id
  }
}

resource "aws_route_table_association" "private" {
  for_each       = toset(local.full_azs)
  subnet_id      = aws_subnet.private[each.value].id
  route_table_id = aws_route_table.private[each.value].id
}

# DB subnets — no internet route; reachable only from private subnets
resource "aws_route_table" "db" {
  vpc_id = aws_vpc.this.id
}

resource "aws_route_table_association" "db" {
  for_each       = toset(local.full_azs)
  subnet_id      = aws_subnet.db[each.value].id
  route_table_id = aws_route_table.db.id
}

# VPC endpoints — keep AWS API traffic on the VPC backbone
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    [aws_route_table.public.id, aws_route_table.db.id],
    [for rt in aws_route_table.private : rt.id],
  )
}

resource "aws_security_group" "interface_endpoints" {
  name        = "medbrains-${var.environment}-vpce-sg"
  description = "VPC interface endpoints — allow 443 from private subnets"
  vpc_id      = aws_vpc.this.id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Interface endpoints — billed hourly per AZ. Worth it for compliance
# (avoids public-internet hops to AWS APIs from private subnets).
locals {
  interface_services = ["ecr.api", "ecr.dkr", "sts", "kms", "secretsmanager", "logs"]
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(local.interface_services)
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for s in aws_subnet.private : s.id]
  security_group_ids  = [aws_security_group.interface_endpoints.id]
  private_dns_enabled = true
}

# Outputs

output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = [for s in aws_subnet.public : s.id]
}

output "private_subnet_ids" {
  value = [for s in aws_subnet.private : s.id]
}

output "db_subnet_ids" {
  value = [for s in aws_subnet.db : s.id]
}

output "nat_gw_eip_ids" {
  value       = [for e in aws_eip.nat : e.id]
  description = "NAT EIPs — register with Razorpay/ABDM/TPA dashboards for IP allowlisting"
}
