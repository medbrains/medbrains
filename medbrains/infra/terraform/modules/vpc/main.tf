# VPC module — 3 AZs × (public + private + db) subnets, NAT GW per AZ,
# VPC endpoints for S3, ECR, STS, KMS, Secrets Manager, CloudWatch.
#
# Phase 4.2 deliverable — fills in resource definitions.

variable "region"      { type = string }
variable "environment" { type = string }
variable "cidr_block"  {
  type    = string
  default = "10.10.0.0/16"
}

# TODO Phase 4.2: aws_vpc, aws_subnet × 9, aws_nat_gateway × 3,
# aws_vpc_endpoint × 6, NACLs, route tables.

output "vpc_id"             { value = "TODO" }
output "private_subnet_ids" { value = [] }
output "public_subnet_ids"  { value = [] }
output "db_subnet_ids"      { value = [] }
