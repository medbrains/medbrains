output "public_ip" {
  description = "Public IPv4 of the host (Starter / Enterprise-k3s / DO / existing). Empty for image-based tiers — see public_endpoint."
  value = (
    var.provider_kind == "aws-ec2" ? try(module.aws_ec2[0].public_ip, "") :
    var.provider_kind == "aws-k3s" ? try(module.aws_k3s[0].public_ip, "") :
    var.provider_kind == "digitalocean" ? try(module.digitalocean[0].public_ip, "") :
    var.provider_kind == "existing-host" ? try(module.existing_host[0].public_ip, "") :
    ""
  )
}

output "public_endpoint" {
  description = "Tier-agnostic public endpoint. IP for single-host tiers, ALB DNS for Fargate, EKS API for Enterprise."
  value = (
    var.provider_kind == "aws-ec2" ? try(module.aws_ec2[0].public_ip, "") :
    var.provider_kind == "aws-fargate" ? try(module.aws_fargate[0].public_endpoint, "") :
    var.provider_kind == "aws-k3s" ? try(module.aws_k3s[0].public_ip, "") :
    var.provider_kind == "aws-eks" ? try(module.aws_eks[0].public_endpoint, "") :
    var.provider_kind == "digitalocean" ? try(module.digitalocean[0].public_ip, "") :
    var.provider_kind == "existing-host" ? try(module.existing_host[0].public_ip, "") :
    ""
  )
}

output "ssh_endpoint" {
  description = "user@ip string suitable for ssh (single-host tiers only)."
  value = (
    var.provider_kind == "aws-ec2" ? try(module.aws_ec2[0].ssh_endpoint, "") :
    var.provider_kind == "aws-k3s" ? try(module.aws_k3s[0].ssh_endpoint, "") :
    var.provider_kind == "digitalocean" ? try(module.digitalocean[0].ssh_endpoint, "") :
    var.provider_kind == "existing-host" ? try(module.existing_host[0].ssh_endpoint, "") :
    ""
  )
}

output "db_endpoint" {
  description = "Database endpoint (Fargate / k3s / EKS tiers). Empty for Starter (postgres in docker)."
  value = (
    var.provider_kind == "aws-fargate" ? try(module.aws_fargate[0].db_endpoint, "") :
    var.provider_kind == "aws-k3s" ? try(module.aws_k3s[0].db_endpoint, "") :
    var.provider_kind == "aws-eks" ? try(module.aws_eks[0].db_endpoint, "") :
    ""
  )
}

output "bucket_name" {
  description = "S3 bucket name backing the object-storage tier (Fargate / k3s / EKS). Empty for Starter."
  value = (
    var.provider_kind == "aws-fargate" ? try(module.aws_fargate[0].bucket_name, "") :
    var.provider_kind == "aws-k3s" ? try(module.aws_k3s[0].bucket_name, "") :
    var.provider_kind == "aws-eks" ? try(module.aws_eks[0].bucket_name, "") :
    ""
  )
}

output "health_url" {
  description = "Probe to confirm the bootstrap succeeded."
  value       = "https://${var.domain}/api/health"
}

output "backup_bucket" {
  description = "S3 bucket holding daily pg dumps + Object Lock retention. Empty for non-Starter tiers (which use RDS automated backups)."
  value = (
    var.provider_kind == "aws-ec2" ? try(module.aws_ec2[0].backup_bucket, "") :
    ""
  )
}
