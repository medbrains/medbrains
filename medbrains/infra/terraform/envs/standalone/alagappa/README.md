# `envs/standalone/alagappa/`

End-to-end deploy of MedBrains for **Alagappa Hospital** at
`hims.alagappahospital.com`. One `terraform apply` produces:

1. A DigitalOcean droplet in Bangalore (`s-2vcpu-4gb`, ~$24/mo).
2. Cloud firewall opening 22 / 80 / 443.
3. Pre-built MedBrains binaries + SPA + deploy kit pushed to the host.
4. `install.sh` run on the host (postgres-17, systemd units, Caddy
   with auto Let's Encrypt).
5. GoDaddy A record `hims.alagappahospital.com → <droplet IP>`.

Total wall time: 5-7 minutes.

## Manually-only prerequisites

- Domain `alagappahospital.com` registered at GoDaddy (already done).
- DigitalOcean account with billing enabled.
- SSH keypair: generate `~/.ssh/medbrains-deploy` and add the public
  key to the DigitalOcean account under name `medbrains-deploy`.
- API tokens — both fetched once, stored in OS keychain via
  `medbrains-setup-tenant-dns`:

  ```sh
  node medbrains/tools/setup-tenant-dns/src/index.mjs --tenant=alagappa
  # Pick GoDaddy, paste API key + secret. Tool runs the API
  # pre-flight curl and aborts if the account doesn't qualify.
  ```

  `DIGITALOCEAN_TOKEN` is exported the same way (or sourced from
  your existing dotfile).

## Build artefacts (one-time per release)

```sh
# In the repo root:
cargo build --release -p medbrains-server --bin medbrains-server
cargo build --release -p medbrains-server --bin medbrains-archive
pnpm --filter @medbrains/web build
```

These produce `target/release/medbrains-server`,
`target/release/medbrains-archive`, and `apps/web/dist/`. Terraform
references these paths via `binaries_dir`, `spa_dist_dir`, and
`deploy_kit_dir` in `terraform.tfvars`.

## Run

```sh
cd medbrains/infra/terraform/envs/standalone/alagappa
cp terraform.tfvars.example terraform.tfvars   # edit the email
source ~/.config/medbrains/alagappa.env         # or wherever your tokens live
terraform init
terraform plan
terraform apply
```

Output:

```text
public_ip    = "X.X.X.X"
ssh_endpoint = "root@X.X.X.X"
health_url   = "https://hims.alagappahospital.com/api/health"
```

Wait ~30 seconds for ACME, then `curl $health_url` returns
`{"status":"ok",...}`.

## Re-deploy

Anything from a binary update to a Caddyfile change is one command:

```sh
# Rebuild what changed:
cargo build --release -p medbrains-server --bin medbrains-server
# Re-apply — terraform's filemd5 trigger picks up the new binary
# and re-runs install.sh:
terraform apply
```

`install.sh` is idempotent — re-runs preserve postgres data, JWT
keys, and configured secrets.

## Tear down

```sh
terraform destroy
```

This deletes the droplet (postgres data goes with it — back up first
if needed). DNS records are removed. Domain registration stays at
GoDaddy.

## Move to a different VM provider

Same env, swap one line in `main.tf`:

```hcl
module "vm" {
  source        = "../../../modules/standalone-vm"
  provider_kind = "existing-host"   # was "digitalocean"
  existing_ipv4 = "203.0.113.42"
  # ...
}
```

The `existing-host` sub-module skips droplet creation and just
runs `install.sh` over SSH. Useful when the hospital owns the
hardware.
