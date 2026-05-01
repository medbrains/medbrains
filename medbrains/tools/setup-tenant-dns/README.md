# `medbrains-setup-tenant-dns`

Interactive scaffolder for the DNS section of a tenant's
`terraform.tfvars`. Asks the operator for:

1. Tenant id
2. DNS provider (default: GoDaddy — the only one we currently have
   credentials for)
3. Apex zone the tenant brings (e.g. `acmehealthcare.com`)
4. Subdomain prefix (empty = at the apex)
5. Provider-specific credentials *(see "Credential storage" below)*

Then writes:

- `medbrains/infra/terraform/envs/tenants/<tenant-id>/terraform.tfvars`
- `medbrains/infra/terraform/envs/tenants/<tenant-id>/env.sh`

## Credential storage — no plaintext on disk by default

The tool **does not** write API secrets to `env.sh` in plaintext.
Instead, two mechanisms keep credentials out of the filesystem:

### Static-key providers (GoDaddy / Cloudflare / DigitalOcean / Namecheap)

Secrets are stored in the **OS keychain**:

- macOS → `security add-generic-password` (Keychain Access)
- Linux → `secret-tool store` (libsecret; install via
  `apt install libsecret-tools` or `dnf install libsecret`)

`env.sh` is generated as a thin shell script that pulls the secrets
out of the keychain at source-time:

```sh
export GODADDY_API_KEY="$(security find-generic-password -s 'medbrains-dns/<tenant>/GODADDY_API_KEY' -a "$USER" -w)"
```

Service name convention: `medbrains-dns/<tenant-id>/<env-var-name>`.

### Native auth-flow providers (AWS Route53 / Azure DNS / Google Cloud DNS)

The tool **never** asks for these creds. Instead, `env.sh` verifies
the operator's existing session is active:

| Provider | Verification |
|---|---|
| Route53 | `aws sts get-caller-identity` (run `aws sso login` first) |
| Azure | `az account show` (run `az login` first) |
| Google | `gcloud auth application-default print-access-token` (run `gcloud auth application-default login` first) |

`env.sh` bails out with instructions if the session is missing.

### Fallback (no keychain available)

Pass `--no-keychain` or run on a platform without a supported
keychain backend. `env.sh` is then written with plaintext exports
and a `# WARNING: plaintext credentials below` header. **Add the
file to `.gitignore` immediately.**

## Pre-flight for GoDaddy

For GoDaddy specifically, the tool runs a pre-flight `curl` against
`api.godaddy.com/v1/domains` before storing anything. A 403 means
the account doesn't qualify for API access (post-May-2024
restriction — needs 10+ domains or Discount Domain Club Premier);
the tool aborts with instructions to fall back to Cloudflare
delegation.

## Run

From the workspace root:

```sh
node medbrains/tools/setup-tenant-dns/src/index.mjs
```

Or with flags for non-interactive use:

```sh
node medbrains/tools/setup-tenant-dns/src/index.mjs --tenant=hospital-a
node medbrains/tools/setup-tenant-dns/src/index.mjs --no-keychain
```

## After it writes the files

```sh
cd medbrains/infra/terraform/envs/tenants/<tenant-id>
source ./env.sh
terraform init
terraform plan
```

## Tests

```sh
node --test medbrains/tools/setup-tenant-dns/src/*.test.mjs
```

11 tests across `index.test.mjs` (file-writing logic) and
`keychain.test.mjs` (retrieval-snippet shape, platform detection).

## Zero npm deps

The tool runs on Node's built-in modules only (`node:readline/promises`,
`node:fs`, `node:child_process`, `fetch`). No `npm install` step.
Same pattern as `tools/create-mobile-app`.
