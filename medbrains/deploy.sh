#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
deploy.sh is intentionally disabled.

This legacy script bypassed Terraform state, hardcoded host/key/domain
details, and uploaded root .env.production directly to the server.

Use the canonical deploy path instead:

  make ship-cold

or, for infra-only operations:

  cd infra/terraform/envs/standalone/alagappa
  make plan
  make apply

Destructive operations stay guarded by that Terraform Makefile.
EOF

exit 2
