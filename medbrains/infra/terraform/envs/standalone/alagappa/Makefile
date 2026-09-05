# All operator commands in one file. Source = medbrains/infra/.env.
# No manual exports, no -var flags.
#
# Tier-aware: builds + uploads what each tier needs.
#   starter         → cargo build + pnpm build → upload binaries + SPA
#   growth          → docker buildx push (or wait for CI) → image-only
#   enterprise-k3s  → docker buildx push (ARM) + helm chart upload
#   enterprise      → docker buildx push + helm chart upload
#
# Usage:
#   make help

ENV_FILE := ../../../../.env
REPO_ROOT := ../../../../..

# Auto-export every var in the env file when any target runs.
include $(ENV_FILE)
export

# Tier comes from TF_VAR_tier (default "starter" if unset).
TIER ?= $(TF_VAR_tier)
TIER := $(if $(TIER),$(TIER),starter)

GHCR_IMAGE ?= ghcr.io/domnicamalan/medbrains
GHCR_TAG   ?= latest
PLAN_FILE  ?= plan.tfplan
APPLY_CONFIRMATION ?= deploy-$(TF_VAR_domain)

# Starter target: cross-compile from operator's mac (apple-darwin)
# to the Linux EC2 host via cargo-zigbuild. No docker, no QEMU.
# Default targets ARM (t4g.small Starter); override to
# x86_64-unknown-linux-gnu if you switched to a t3.* instance.
STARTER_TARGET ?= aarch64-unknown-linux-gnu

.PHONY: help check check-db-reset-guard check-destroy-guard init init-state-backend plan apply destroy outputs tail-app rebuild rollback \
        build build-starter build-image build-image-local kubeconfig \
        helm-render helm-test pre-apply-backup

# Remote terraform state: S3 (versioned + encrypted) with a DynamoDB
# lock table. Created idempotently on first `make init`.
TFSTATE_KEY        := standalone/alagappa/terraform.tfstate
TFSTATE_LOCK_TABLE := medbrains-tfstate-lock

help:
	@echo "MedBrains standalone deploy targets (tier=$(TIER)):"
	@echo "  make check             — verify env + creds before doing anything"
	@echo "  make build             — tier-aware build (binaries OR docker image)"
	@echo "  make build-image-local — multi-arch docker buildx → push to GHCR"
	@echo "  make plan              — terraform plan"
	@echo "  make apply             — terraform apply (provisions everything)"
	@echo "  make rebuild           — build then apply"
	@echo "  make outputs           — print tier outputs (public_endpoint / db / bucket)"
	@echo "  make kubeconfig        — pull kubeconfig from k3s/EKS cluster to ./kubeconfig"
	@echo "  make tail-app          — tail medbrains-server logs (tier-aware)"
	@echo "  make helm-render       — render the helm chart locally for review"
	@echo "  make helm-test         — helm lint + helm template (no apply)"
	@echo "  make rollback          — swap previous binaries + SPA back on the host"
	@echo "  make destroy           — tear down everything"

check:
	@test -f $(ENV_FILE) || { echo "ERROR: $(ENV_FILE) missing"; exit 1; }
	@grep -q '^AWS_ACCESS_KEY_ID=' $(ENV_FILE) || { echo "ERROR: AWS_ACCESS_KEY_ID missing in $(ENV_FILE)"; exit 1; }
	@grep -q '^AWS_SECRET_ACCESS_KEY=' $(ENV_FILE) || { echo "ERROR: AWS_SECRET_ACCESS_KEY missing in $(ENV_FILE)"; exit 1; }
	@grep -q '^AWS_REGION=' $(ENV_FILE) || { echo "ERROR: AWS_REGION missing in $(ENV_FILE)"; exit 1; }
	@grep -q '^GODADDY_API_KEY=' $(ENV_FILE) || { echo "ERROR: GODADDY_API_KEY missing in $(ENV_FILE)"; exit 1; }
	@grep -q '^GODADDY_API_SECRET=' $(ENV_FILE) || { echo "ERROR: GODADDY_API_SECRET missing in $(ENV_FILE)"; exit 1; }
	@grep -q '^TF_VAR_admin_email=' $(ENV_FILE) || { echo "ERROR: TF_VAR_admin_email missing in $(ENV_FILE)"; exit 1; }
	@if [ "$(TIER)" = "starter" ] || [ "$(TIER)" = "enterprise-k3s" ]; then \
		grep -q '^TF_VAR_aws_ssh_key_name=' $(ENV_FILE) || { echo "ERROR: TF_VAR_aws_ssh_key_name missing (required for tier=$(TIER))"; exit 1; }; \
	fi
	@if [ "$(TIER)" = "starter" ]; then \
		command -v zig >/dev/null 2>&1 || { echo "ERROR: zig not installed. Run: brew install zig"; exit 1; }; \
		command -v cargo-zigbuild >/dev/null 2>&1 || { echo "ERROR: cargo-zigbuild not installed. Run: cargo install cargo-zigbuild"; exit 1; }; \
	fi
	@$(MAKE) -s check-db-reset-guard
	@echo "==> env OK ($(ENV_FILE)), tier=$(TIER)"

check-db-reset-guard:
	@if [ "$${TF_VAR_reset_pgdata:-false}" = "true" ] && [ "$${ALLOW_RESET_PGDATA:-}" != "wipe-medbrains-db" ]; then \
		echo "ERROR: TF_VAR_reset_pgdata=true wipes the standalone Postgres named volume."; \
		echo "Refusing. Take/verify backup first, then run with ALLOW_RESET_PGDATA=wipe-medbrains-db."; \
		exit 1; \
	fi

check-destroy-guard:
	@if [ "$${ALLOW_TERRAFORM_DESTROY:-}" != "destroy-alagappa-standalone" ]; then \
		echo "ERROR: terraform destroy deletes the EC2 host and local Postgres volume."; \
		echo "Refusing. Take/verify backup first, then run with:"; \
		echo "  ALLOW_TERRAFORM_DESTROY=destroy-alagappa-standalone make destroy"; \
		exit 1; \
	fi

# ── tier-aware build dispatcher ───────────────────────────────────────

build:
ifeq ($(TIER),starter)
	@$(MAKE) -s build-starter
else
	@$(MAKE) -s build-image
endif

# Starter: cross-compile mac → linux x86_64 with cargo-zigbuild
# (no docker, no QEMU). Output lands at
# target/$(STARTER_TARGET)/release/, which is what the terraform
# `binaries_dir` default points to.
build-starter:
	cd $(REPO_ROOT) && cargo zigbuild --release --target=$(STARTER_TARGET) -p medbrains-server --bin medbrains-server
	cd $(REPO_ROOT) && cargo zigbuild --release --target=$(STARTER_TARGET) -p medbrains-server --bin medbrains-archive
	cd $(REPO_ROOT) && cargo zigbuild --release --target=$(STARTER_TARGET) -p medbrains-proxy --bin medbrains-proxy
	cd $(REPO_ROOT) && cargo zigbuild --release --target=$(STARTER_TARGET) -p medbrains-edge-app --bin medbrains-edge
	cd $(REPO_ROOT) && pnpm --filter "@medbrains/types" --filter "@medbrains/utils" --filter "@medbrains/schemas" --filter "@medbrains/api" --filter "@medbrains/stores" --filter "@medbrains/expressions" --filter "@medbrains/crdt" build
	cd $(REPO_ROOT) && pnpm --filter @medbrains/web exec vite build
	@echo "==> starter build OK (target=$(STARTER_TARGET))"

# Image-based tiers default: rely on the GHCR image already published
# by CI. Use `make build-image-local` to bypass CI and build locally.
build-image:
	@echo "==> image-based tier — assuming $(GHCR_IMAGE):$(GHCR_TAG) is already in GHCR"
	@echo "    (push to master triggers the multi-arch build. Or run \`make build-image-local\`.)"

# Local build → push multi-arch image to GHCR. Useful for fast iteration
# or when the operator's mac is ARM (apple silicon — no QEMU emulation).
build-image-local:
	@command -v docker >/dev/null || { echo "ERROR: docker not installed"; exit 1; }
	@docker buildx version >/dev/null 2>&1 || { echo "ERROR: docker buildx not available"; exit 1; }
	@test -n "$$GHCR_PUSH_TOKEN" || { echo "ERROR: set GHCR_PUSH_TOKEN in env (PAT with write:packages)"; exit 1; }
	@test -n "$$GHCR_USERNAME" || { echo "ERROR: set GHCR_USERNAME in env"; exit 1; }
	echo "$$GHCR_PUSH_TOKEN" | docker login ghcr.io -u "$$GHCR_USERNAME" --password-stdin
	docker buildx create --name medbrains-builder --use 2>/dev/null || docker buildx use medbrains-builder
	cd $(REPO_ROOT) && docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--file medbrains/Dockerfile \
		--tag $(GHCR_IMAGE):$(GHCR_TAG) \
		--tag $(GHCR_IMAGE):$$(git rev-parse --short HEAD) \
		--push \
		medbrains/
	@echo "==> pushed $(GHCR_IMAGE):$(GHCR_TAG) (amd64 + arm64)"

# ── terraform ──────────────────────────────────────────────────────────

init-state-backend:
	@ACCOUNT=$$(aws sts get-caller-identity --query Account --output text) && \
	BUCKET=medbrains-tfstate-$$ACCOUNT && \
	if ! aws s3api head-bucket --bucket $$BUCKET 2>/dev/null; then \
	    echo "==> creating terraform state bucket s3://$$BUCKET"; \
	    aws s3api create-bucket --bucket $$BUCKET --region $(AWS_REGION) \
	        --create-bucket-configuration LocationConstraint=$(AWS_REGION); \
	    aws s3api put-bucket-versioning --bucket $$BUCKET \
	        --versioning-configuration Status=Enabled; \
	    aws s3api put-bucket-encryption --bucket $$BUCKET \
	        --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'; \
	    aws s3api put-public-access-block --bucket $$BUCKET \
	        --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true; \
	fi && \
	if ! aws dynamodb describe-table --table-name $(TFSTATE_LOCK_TABLE) >/dev/null 2>&1; then \
	    echo "==> creating terraform lock table $(TFSTATE_LOCK_TABLE)"; \
	    aws dynamodb create-table --table-name $(TFSTATE_LOCK_TABLE) \
	        --attribute-definitions AttributeName=LockID,AttributeType=S \
	        --key-schema AttributeName=LockID,KeyType=HASH \
	        --billing-mode PAY_PER_REQUEST >/dev/null; \
	    aws dynamodb wait table-exists --table-name $(TFSTATE_LOCK_TABLE); \
	fi

# -force-copy migrates any existing local terraform.tfstate into S3
# on the first init after the backend switch; later runs are no-ops.
init: init-state-backend
	@ACCOUNT=$$(aws sts get-caller-identity --query Account --output text) && \
	terraform init -force-copy \
	    -backend-config="bucket=medbrains-tfstate-$$ACCOUNT" \
	    -backend-config="key=$(TFSTATE_KEY)" \
	    -backend-config="region=$(AWS_REGION)" \
	    -backend-config="dynamodb_table=$(TFSTATE_LOCK_TABLE)" \
	    -backend-config="encrypt=true"

plan: check init
	terraform plan -out=$(PLAN_FILE)
	terraform show -no-color $(PLAN_FILE)

apply: check init build pre-apply-backup
	terraform plan -out=$(PLAN_FILE)
	terraform show -no-color $(PLAN_FILE)
	@if [ "$${CONFIRM_APPLY:-}" != "$(APPLY_CONFIRMATION)" ]; then \
		echo; \
		echo "Refusing to apply without reviewed-plan confirmation."; \
		echo "Review the plan above, then run:"; \
		echo "  CONFIRM_APPLY=$(APPLY_CONFIRMATION) make apply"; \
		exit 1; \
	fi
	terraform apply $(PLAN_FILE)
	@echo
	@echo "==> deploy complete (tier=$(TIER))"
	@$(MAKE) -s outputs

# Versioned safety-net backup taken BEFORE every terraform apply. On
# the first ever apply the host doesn't exist yet — we no-op cleanly.
# Backups land in the S3 bucket Object-Lock'd for 5y, so even if the
# apply destroys data we can restore.
pre-apply-backup:
	@# One shell for the whole target. Each recipe line otherwise runs in its
	@# own shell, so the `exit 0` below used to end only that line and Make
	@# carried on to the ssh - which then ran with empty outputs and failed
	@# with "hostname contains invalid characters".
	@set -e; \
	if [ "$(TIER)" = "attach" ]; then \
		echo "==> pre-apply-backup: tier=attach - the host and its Postgres are the operator's;"; \
		echo "    backing them up from here would be presumptuous. Skipping."; \
		exit 0; \
	fi; \
	if ! terraform state list 2>/dev/null | grep -q aws_instance.this; then \
		echo "==> pre-apply-backup: no instance in state (initial deploy) - skipping"; \
		exit 0; \
	fi; \
	SSH_ENDPOINT=$$(terraform output -raw ssh_endpoint 2>/dev/null || true); \
	case "$$SSH_ENDPOINT" in *Warning*|*Error*|null) SSH_ENDPOINT="";; esac; \
	if [ -z "$$SSH_ENDPOINT" ]; then \
		PUBLIC_ENDPOINT=$$(terraform output -raw public_endpoint 2>/dev/null || true); \
		case "$$PUBLIC_ENDPOINT" in *Warning*|*Error*|null) PUBLIC_ENDPOINT="";; esac; \
		[ -n "$$PUBLIC_ENDPOINT" ] && SSH_ENDPOINT="ubuntu@$$PUBLIC_ENDPOINT"; \
	fi; \
	BACKUP_BUCKET=$$(terraform output -raw backup_bucket 2>/dev/null || true); \
	case "$$BACKUP_BUCKET" in *Warning*|*Error*|null) BACKUP_BUCKET="";; esac; \
	if [ -z "$$SSH_ENDPOINT" ]; then \
		echo "==> pre-apply-backup: no SSH endpoint output - skipping"; \
		exit 0; \
	fi; \
	if [ -z "$$BACKUP_BUCKET" ]; then \
		echo "==> pre-apply-backup: no backup_bucket output (non-Starter tier?) - skipping"; \
		exit 0; \
	fi; \
	echo "==> pre-apply-backup: SSH $$SSH_ENDPOINT -> s3://$$BACKUP_BUCKET"; \
	ssh -i $(TF_VAR_ssh_private_key_path) -o StrictHostKeyChecking=no $$SSH_ENDPOINT \
	    "if systemctl is-active --quiet medbrains-pg-backup.timer 2>/dev/null && sudo docker ps --format '{{.Names}}' | grep -q medbrains-postgres; then \
	        echo '   running medbrains-pg-backup on host'; \
	        sudo systemctl start medbrains-pg-backup.service && \
	        sudo journalctl -u medbrains-pg-backup.service -n 5 --no-pager; \
	    else \
	        echo '   medbrains-pg-backup or postgres not running - nothing to back up'; \
	    fi"

rebuild:
	@$(MAKE) -s apply

# One-command rollback: the host keeps the previous binaries (*.prev)
# and SPA (/var/www/medbrains.prev) from the last deploy.
rollback:
	@SSH_ENDPOINT=$$(terraform output -raw ssh_endpoint 2>/dev/null || true) && \
	  if [ -z "$$SSH_ENDPOINT" ] || [ "$$SSH_ENDPOINT" = "null" ]; then \
	      echo "ERROR: no ssh_endpoint output — is the starter tier deployed?"; exit 1; \
	  fi && \
	  echo "==> rolling back on $$SSH_ENDPOINT" && \
	  ssh -i $(TF_VAR_ssh_private_key_path) -o StrictHostKeyChecking=no $$SSH_ENDPOINT \
	      'sudo /usr/local/bin/medbrains-rollback' && \
	  echo "==> rollback done — check https://$(TF_VAR_domain)/api/health"

destroy: check check-destroy-guard pre-apply-backup
	terraform destroy

outputs:
	@terraform output -json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'{k:22}= {v[\"value\"]}') for k,v in d.items()]"

# ── k8s helpers (k3s / EKS tiers) ──────────────────────────────────────

kubeconfig:
ifneq ($(filter $(TIER),enterprise-k3s enterprise),)
	@SSH_ENDPOINT=$$(terraform output -raw public_endpoint) && \
	  KEY="$(TF_VAR_ssh_private_key_path)" && \
	  scp -i "$$KEY" -o StrictHostKeyChecking=no ubuntu@$$SSH_ENDPOINT:.kube/config ./kubeconfig && \
	  sed -i.bak "s|server: https://127.0.0.1:6443|server: https://$$SSH_ENDPOINT:6443|" ./kubeconfig && \
	  rm -f ./kubeconfig.bak && \
	  echo "==> kubeconfig at ./kubeconfig — try \`KUBECONFIG=./kubeconfig kubectl get pods -A\`"
else
	@echo "tier=$(TIER) doesn't have a k8s cluster — skipping"
endif

tail-app:
ifeq ($(TIER),starter)
	@SSH_ENDPOINT=$$(terraform output -raw ssh_endpoint 2>/dev/null || true) && \
	  if [ -z "$$SSH_ENDPOINT" ] || [ "$$SSH_ENDPOINT" = "null" ]; then \
	      PUBLIC_ENDPOINT=$$(terraform output -raw public_endpoint 2>/dev/null || true); \
	      SSH_ENDPOINT="ubuntu@$$PUBLIC_ENDPOINT"; \
	  fi && \
	  ssh -i $(TF_VAR_ssh_private_key_path) $$SSH_ENDPOINT 'sudo journalctl -u medbrains-server -f'
else
	@$(MAKE) -s kubeconfig >/dev/null
	KUBECONFIG=./kubeconfig kubectl -n medbrains logs -l app.kubernetes.io/name=medbrains-server -f --tail=100
endif

helm-render:
	helm template medbrains $(REPO_ROOT)/medbrains/deploy/helm/medbrains-server/ \
		--set database.url='postgres://x:y@host/db' \
		--set ingress.host='$(TF_VAR_domain)'

helm-test:
	helm lint $(REPO_ROOT)/medbrains/deploy/helm/medbrains-server/ \
		--set database.url='postgres://x:y@host/db'
	helm template medbrains $(REPO_ROOT)/medbrains/deploy/helm/medbrains-server/ \
		--set database.url='postgres://x:y@host/db' >/dev/null
	@echo "==> helm chart OK"
