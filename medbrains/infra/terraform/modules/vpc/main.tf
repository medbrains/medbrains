# VPC module — 3 AZs × (public + private + db) subnets,
# NAT GW per AZ, VPC endpoints for S3, ECR, STS, KMS,
# Secrets Manager, CloudWatch Logs.

variable "region" { type = string }
variable "environment" { type = string }
variable "cidr_block" {
  type    = string
  default = "10.10.0.0/16"
}
variable "azs" {
  type    = list(string)
  default = ["a", "b", "c"]
}

# Cost knobs — default to prod-safe (HA) behaviour; non-prod envs opt into the
# cheaper values. Single NAT and no interface endpoints save ~$195/mo in dev.
variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "One shared NAT GW instead of one per AZ. Set true in non-prod."
}
variable "enable_interface_endpoints" {
  type        = bool
  default     = true
  description = "Billed hourly per AZ. Set false in non-prod (NAT already reaches AWS APIs)."
}

variable "flow_log_kms_key_arn" {
  type        = string
  default     = null
  description = "KMS key for the flow-log group (its policy must admit logs.<region>.amazonaws.com, as modules/kms keys do). Null = CloudWatch's own encryption."
}

variable "flow_log_retention_days" {
  type    = number
  default = 365
}

locals {
  full_azs = [for az in var.azs : "${var.region}${az}"]
  # AZs that get a NAT GW: all of them, or just the first when single_nat_gateway.
  nat_azs = var.single_nat_gateway ? [local.full_azs[0]] : local.full_azs
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "medbrains-${var.environment}-${var.region}" }
}

# Rejected traffic only: what an incident review asks first ("what tried
# to reach the DB subnet?") at a fraction of the cost of ALL, which on a
# NAT-heavy VPC is the dominant CloudWatch bill. Switch traffic_type to
# ALL when forensics needs accepted flows too.
resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/aws/vpc/medbrains-${var.environment}-${var.region}/flow-logs"
  retention_in_days = var.flow_log_retention_days
  kms_key_id        = var.flow_log_kms_key_arn
}

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_logs" {
  name               = "medbrains-${var.environment}-${var.region}-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json
}

data "aws_iam_policy_document" "flow_logs" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.flow_logs.arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  role   = aws_iam_role.flow_logs.id
  policy = data.aws_iam_policy_document.flow_logs.json
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "REJECT"
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  iam_role_arn    = aws_iam_role.flow_logs.arn
}

# Adopt the default security group and strip its rules: nothing in this
# VPC is meant to use it, and anything that lands in it by accident now
# gets no traffic instead of all of it.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id
}

# Subnets — 3 AZs × {public, private, db}
# Public: 10.10.0.0/20 → /24 per AZ
# Private (workloads): 10.10.16.0/20 → /22 per AZ
# DB: 10.10.32.0/24 → /26 per AZ

resource "aws_subnet" "public" {
  for_each          = toset(local.full_azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, index(local.full_azs, each.value))
  availability_zone = each.value
  # Only NAT gateways (EIPs) and load balancers live here; nothing that
  # launches into a public subnet should get an address it did not ask for.
  map_public_ip_on_launch = false
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
  tags              = { Name = "db-${each.value}" }
}

# Internet GW + NAT GW per AZ

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
}

resource "aws_eip" "nat" {
  #checkov:skip=CKV2_AWS_19: this EIP belongs to a NAT gateway, not an instance
  for_each = toset(local.nat_azs)
  domain   = "vpc"
}

resource "aws_nat_gateway" "this" {
  for_each      = toset(local.nat_azs)
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
    cidr_block = "0.0.0.0/0"
    # Per-AZ NAT normally; all AZs share the single NAT when single_nat_gateway.
    nat_gateway_id = aws_nat_gateway.this[var.single_nat_gateway ? local.full_azs[0] : each.value].id
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
  route_table_ids = concat(
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
    description = "HTTPS from inside the VPC"
    cidr_blocks = [var.cidr_block]
  }
  # Endpoint ENIs never open connections; replies are stateful.
  egress = []
}

# Interface endpoints — billed hourly per AZ. Worth it for compliance
# (avoids public-internet hops to AWS APIs from private subnets).
locals {
  interface_services = ["ecr.api", "ecr.dkr", "sts", "kms", "secretsmanager", "logs"]
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = var.enable_interface_endpoints ? toset(local.interface_services) : toset([])
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
