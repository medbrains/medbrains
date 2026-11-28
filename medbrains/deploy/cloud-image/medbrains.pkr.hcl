# Builds the MedBrains cloud image for AWS: an official Debian 13 AMI + one signed
# MedBrains release + the standalone kit, sealed by bake.sh (RFC-DEPLOYMENT-MODELS.md).
# It creates billable AWS resources, so it runs only on the owner's go, in the account
# the owner names. From medbrains/deploy/cloud-image, once per architecture:
#   packer init . && AWS_PROFILE=<profile> packer build -var release=v3.35.5 .
# Add -var arch=amd64 for x86-64 and -var region=us-east-1 for a Marketplace submission.
# No cloud account needed: ./test-local.sh v3.35.5 <folder with the release files>

packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = ">= 1.3.0"
    }
  }
}

# The release tag to bake, for example v3.35.5. The kit is taken from the same tag.
variable "release" { type = string }

# Build region: Mumbai for our own tests, us-east-1 for a Marketplace submission.
variable "region" { default = "ap-south-1" }

# arm64 or amd64 (the Debian AMI's name for x86-64).
variable "arch" { default = "arm64" }

locals {
  instance_type = var.arch == "arm64" ? "t4g.small" : "t3.small"
  kit_tar       = "/tmp/medbrains-kit-${var.release}.tar"
}

source "amazon-ebs" "medbrains" {
  region        = var.region
  instance_type = local.instance_type
  ssh_username  = "admin"
  ami_name      = "medbrains-${var.release}-debian13-${var.arch}-{{timestamp}}"
  # A Marketplace image must be unencrypted; a hospital encrypts its own volume at launch.
  encrypt_boot = false
  imds_support = "v2.0"
  metadata_options {
    http_tokens = "required"
  }
  source_ami_filter {
    # 136693071363 is the Debian project's own publishing account (wiki.debian.org/Cloud/AmazonEC2Image).
    owners      = ["136693071363"]
    most_recent = true
    filters = {
      name                = "debian-13-${var.arch}-*"
      virtualization-type = "hvm"
      root-device-type    = "ebs"
    }
  }
  launch_block_device_mappings {
    device_name           = "/dev/xvda"
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
  }
}

build {
  sources = ["source.amazon-ebs.medbrains"]

  # The kit comes from the release's own tag, never from the working tree.
  provisioner "shell-local" {
    inline = ["git -C \"$(git -C '${path.root}' rev-parse --show-toplevel)\" archive --format=tar '${var.release}:medbrains/deploy/standalone' > '${local.kit_tar}'"]
  }
  provisioner "file" {
    sources     = ["${path.root}/bake.sh", "${path.root}/seal-check.sh", "${path.root}/medbrains-cloud-setup", "${path.root}/medbrains-first-boot.service", local.kit_tar]
    destination = "/tmp/"
  }
  # Last step on purpose: bake.sh ends by removing the login key Packer came in with.
  provisioner "shell" {
    inline = ["cloud-init status --wait >/dev/null; sudo bash /tmp/bake.sh '${var.release}' '${local.kit_tar}'"]
  }
  post-processor "shell-local" {
    inline = ["rm -f '${local.kit_tar}'"]
  }
}
