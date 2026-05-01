# `modules/standalone-vm` — provision the host + run `install.sh`

Companion to `modules/dns` and `deploy/standalone/`. Creates the
single-server VM (or talks to an existing one over SSH), uploads
the pre-built MedBrains binaries + the standalone deploy kit, runs
`install.sh` via cloud-init / `remote-exec`. End state:
`terraform apply` produces a working `https://<domain>` with the
DNS records already pointing at it.

## Provider matrix

| Sub-module | When to use |
|---|---|
| **`digitalocean`** | Recommended default for an Indian hospital pilot. Mumbai region, ~$24/mo for a 4 GB / 80 GB droplet that comfortably runs a 100-bed hospital |
| **`existing-host`** | The hospital already owns the box (bare metal in the IT room, or pre-provisioned VM). Terraform doesn't create a host; just runs install.sh over SSH |

Hetzner Cloud, AWS EC2, Linode, Vultr — pluggable via the same
sub-module pattern as `modules/dns`. Add when a tenant needs them.

## What every sub-module does

1. Materialise (or look up) the server.
2. Open inbound 22 / 80 / 443 in whatever firewall the provider has.
3. Wait for SSH to come up.
4. `file` provisioner → upload pre-built `medbrains-server` +
   `medbrains-archive` binaries and the SPA `dist/` and the
   `deploy/standalone/` kit to `/tmp` on the host.
5. `remote-exec` → run
   `sudo bash /tmp/standalone/install.sh <domain> <admin-email>`.
6. Output: `public_ip`, `ssh_endpoint`, `health_url`.

## Usage (DigitalOcean default)

```hcl
module "alagappa_vm" {
  source = "../../modules/standalone-vm"
  providers = {
    digitalocean = digitalocean.tenant
  }

  provider_kind = "digitalocean"

  hostname           = "hims-alagappahospital"
  domain             = "hims.alagappahospital.com"
  admin_email        = "ops@alagappahospital.com"
  region             = "blr1"
  size               = "s-2vcpu-4gb"
  ssh_public_keys    = [data.digitalocean_ssh_key.ops.fingerprint]
  ssh_private_key    = file("~/.ssh/medbrains-deploy")

  binaries_dir       = "../../../../target/release"   # cargo build --release output
  spa_dist_dir       = "../../../../apps/web/dist"    # pnpm build output
  deploy_kit_dir     = "../../../../deploy/standalone"
}

module "alagappa_dns" {
  source = "../../modules/dns"
  providers = { godaddy-dns = godaddy-dns.tenant }

  provider_kind = "godaddy"
  zone_name     = "alagappahospital.com"
  records = [
    { name = "hims", type = "A", value = module.alagappa_vm.public_ip, ttl = 600 },
  ]
}
```

`terraform apply` and 5-7 minutes later
`https://hims.alagappahospital.com` is live with a Let's Encrypt
cert.

## Using an existing host

```hcl
module "alagappa_vm" {
  source = "../../modules/standalone-vm"

  provider_kind = "existing-host"

  hostname        = "hims-alagappahospital"
  domain          = "hims.alagappahospital.com"
  admin_email     = "ops@alagappahospital.com"
  existing_ipv4   = "203.0.113.42"
  ssh_user        = "ubuntu"
  ssh_private_key = file("~/.ssh/medbrains-deploy")

  binaries_dir   = "../../../../target/release"
  spa_dist_dir   = "../../../../apps/web/dist"
  deploy_kit_dir = "../../../../deploy/standalone"
}
```

Terraform doesn't manage the host's lifecycle — it just runs
install.sh. Tearing down `terraform destroy` does **not** delete
the host (it can't); operator owns it.

## Prerequisites the operator still does manually (true manual ops)

- Buy / own the domain (registrar account, payment).
- Generate API token at the cloud provider (DigitalOcean / etc.) +
  the GoDaddy DNS API key.
- Choose a server SSH keypair and add the public key to the cloud
  account or the existing host's `authorized_keys`.

After those, `terraform apply` is the only command.
