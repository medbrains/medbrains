.PHONY: help dev dev-backend dev-frontend db db-stop db-reset \
       build build-backend build-frontend \
       camp-mobile camp-mobile-ios camp-mobile-android \
       mobile-staff-start mobile-staff-start-lan \
       mobile-staff-ios mobile-staff-ios-devices mobile-staff-ios-doctor mobile-staff-ios-platform \
       mobile-staff-android mobile-staff-prebuild mobile-staff-typecheck \
       check check-backend check-frontend lint check-api check-sqlx prepare-sqlx guard-sqlx-nonprod \
       check-ui-api check-types check-all \
       check-rls check-sharing check-authz-posture check-tenant-leak check-runtime-sqlx check-audit check-tracing \
       check-migration-headers \
       check-region-pinning check-no-card-logging check-egress-allowlist \
       smoke-test e2e-test generate-smoke generate-e2e \
       test-rust test-unit test-ts test-all test-coverage \
       ship ship-quick ship-cold ship-help \
       docker-build \
       packer-build packer-destroy packer-destroy-dry \
       deploy deploy-plan deploy-bootstrap \
       clean logs db-shell seed

# SQLx policy:
# - Normal build/check/test/deploy uses the committed .sqlx cache with SQLX_OFFLINE=true.
# - Only prepare-sqlx/check-sqlx connect to a schema database, and that database must be local/CI/staging.
# - Never run cargo sqlx prepare against production; deployment only runs embedded migrations at app startup.
LOCAL_SQLX_DATABASE_URL ?= postgres://medbrains:medbrains_dev@localhost:5435/medbrains
SQLX_DATABASE_URL ?= $(if $(DATABASE_URL),$(DATABASE_URL),$(LOCAL_SQLX_DATABASE_URL))
SQLX_PREPARE_CARGO_ARGS ?= --package medbrains-server
IOS_DEVICE ?=
ANDROID_DEVICE ?=
IOS_RUN_ARGS = -- --port 8082 $(if $(IOS_DEVICE),--device "$(IOS_DEVICE)",)
ANDROID_RUN_ARGS = -- --port 8082 $(if $(ANDROID_DEVICE),--device "$(ANDROID_DEVICE)",)

# Default
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────

dev: ## Start everything (db + compile backend + frontend)
	@echo "Starting PostgreSQL..."
	@docker compose up -d postgres
	@echo "Waiting for PostgreSQL..."
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@echo "PostgreSQL ready. Compiling backend..."
	@cargo build 2>&1 || { echo "❌ Backend compilation failed"; exit 1; }
	@echo "✅ Backend compiled. Starting backend + frontend..."
	@trap 'kill 0' EXIT; \
		cargo run & \
		pnpm dev:web & \
		wait

dev-fast: ## Start everything (skip compile check — use when already compiled)
	@docker compose up -d postgres 2>/dev/null
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@trap 'kill 0' EXIT; \
		cargo run & \
		pnpm dev:web & \
		wait

dev-backend: db ## Start database + backend only
	cargo run

dev-edge: ## Run medbrains-edge appliance locally for offline-mode testing
	@mkdir -p var/medbrains-edge/docs var/medbrains-edge/chain
	@cargo run -p medbrains-edge-app -- --config apps/edge/etc/medbrains-edge/dev.toml

dev-frontend: ## Start frontend only (assumes backend running)
	pnpm dev:web

# ── Mobile / Camp Mode ───────────────────────────────────────

camp-mobile: mobile-staff-start-lan ## Start Camp Mode staff mobile app (LAN QR, port 8082)

camp-mobile-ios: mobile-staff-ios ## Open Camp Mode staff mobile app on iOS

camp-mobile-android: mobile-staff-android ## Open Camp Mode staff mobile app on Android

mobile-staff-start: ## Start staff mobile Expo Metro using pnpm
	pnpm --filter @medbrains/mobile-staff start

mobile-staff-start-lan: ## Start staff mobile Expo Metro on LAN port 8082
	pnpm --filter @medbrains/mobile-staff start -- --host lan --port 8082

mobile-staff-ios: ## Build/open staff mobile app on iOS; set IOS_DEVICE="iPhone 17"
	pnpm --filter @medbrains/mobile-staff ios $(IOS_RUN_ARGS)

mobile-staff-ios-devices: ## List available iOS simulators/devices
	xcrun simctl list devices available

mobile-staff-ios-doctor: ## Show Xcode SDKs, simulator runtimes, and devices
	@xcodebuild -version
	@xcodebuild -showsdks | grep -E "iOS|Simulator" || true
	@xcrun simctl list runtimes
	@xcrun simctl list devices available

mobile-staff-ios-platform: ## Install the matching iOS platform/runtime for current Xcode
	xcodebuild -downloadPlatform iOS

mobile-staff-android: ## Build/open staff mobile app on Android emulator/device
	pnpm --filter @medbrains/mobile-staff android $(ANDROID_RUN_ARGS)

mobile-staff-prebuild: ## Regenerate native projects for staff mobile app
	pnpm --filter @medbrains/mobile-staff prebuild

mobile-staff-typecheck: ## Typecheck staff mobile app
	pnpm --filter @medbrains/mobile-staff typecheck

# ── Database ─────────────────────────────────────────────────

db: ## Start PostgreSQL
	docker compose up -d postgres

db-stop: ## Stop all containers
	docker compose down

db-reset: ## Wipe database and restart fresh
	docker compose down -v
	docker compose up -d postgres
	@echo "Waiting for PostgreSQL..."
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@echo "Database reset. Run 'make dev-backend' to re-run migrations + seed."

db-shell: ## Open psql shell
	docker compose exec postgres psql -U medbrains -d medbrains

logs: ## Tail database logs
	docker compose logs -f postgres

# ── Build ────────────────────────────────────────────────────

build: build-backend build-frontend ## Build everything

build-backend: ## Build Rust backend (release)
	cargo build --release

build-frontend: ## Build web frontend
	pnpm build --filter=@medbrains/web

# ── Check / Lint ─────────────────────────────────────────────

check: check-backend check-frontend ## Run all checks

check-backend: ## Run cargo clippy
	cargo clippy -- -D warnings

guard-sqlx-nonprod:
	@case "$(SQLX_DATABASE_URL)" in \
		*prod*|*production*|*hims.amh.org.in*|*amh.org.in*|*amazonaws.com*|*rds.amazonaws.com*) \
			echo "❌ Refusing SQLx metadata generation against a production-looking DATABASE_URL."; \
			echo "Use a migrated local/CI database. Example:"; \
			echo "  SQLX_DATABASE_URL=$(LOCAL_SQLX_DATABASE_URL) make prepare-sqlx"; \
			exit 1; \
			;; \
	esac

prepare-sqlx: guard-sqlx-nonprod ## Refresh SQLx offline metadata from local/CI schema DB only
	SQLX_OFFLINE=false DATABASE_URL="$(SQLX_DATABASE_URL)" cargo sqlx prepare --workspace -- $(SQLX_PREPARE_CARGO_ARGS)

check-sqlx: guard-sqlx-nonprod ## Verify SQLx offline metadata matches local/CI schema DB only
	SQLX_OFFLINE=false DATABASE_URL="$(SQLX_DATABASE_URL)" cargo sqlx prepare --check --workspace -- $(SQLX_PREPARE_CARGO_ARGS)

check-frontend: ## Run TypeScript typecheck
	pnpm typecheck --filter=@medbrains/web

lint: ## Run biome lint + format check
	pnpm --filter=@medbrains/web exec biome check src/

# ── API Contract & Coverage ──────────────────────────────

check-api: ## Verify frontend↔backend API contract
	python3 ../scripts/check_api_contract.py

check-ui-api: ## Verify UI pages ↔ API method coverage
	python3 ../scripts/check_ui_api_coverage.py

check-types: ## Verify TS ↔ Rust type field contracts
	python3 ../scripts/check_type_contract.py

check-nav-drift: ## Verify navigation.ts in sync with access::SCREENS
	python3 scripts/check_nav_drift.py

check-all: check-api check-ui-api check-types check-nav-drift check-rls check-authz-posture check-tenant-leak check-runtime-sqlx check-migrations check-sharing check-audit check-tracing check-migration-headers check-region-pinning check-no-card-logging check-egress-allowlist ## Run all static checks (incl. RLS + sharing + audit + tracing + compliance)

# ── Audit / Authz Static Checks (RFC-INFRA-2026-002 Phase 0) ─

check-rls: ## Verify every tenant_id-bearing table has RLS coverage
	python3 ../scripts/check_rls.py

check-authz-posture: ## Verify authz fail-closed posture invariants
	python3 ../scripts/check_authz_posture.py

check-tenant-leak: ## Ban raw sqlx::query* in routes/ (ratchets against baseline)
	python3 ../scripts/check_tenant_leak.py

check-runtime-sqlx: ## Strict compile-time SQL — block new sqlx::query() runtime calls in routes (ratchets against baseline)
	python3 ../scripts/check_runtime_sqlx.py

check-migrations: ## Migration sanity — version uniqueness, FK targets, idempotency, NOW()-in-index, dup tables/enums
	python3 ../scripts/check_migrations.py

check-tenant-leak-update-baseline: ## Update baseline after cleanup PR
	python3 ../scripts/check_tenant_leak.py --update-baseline

check-sharing: ## Verify shareable entities are registered in sharing/registry.rs (soft until Phase 3)
	python3 ../scripts/check_sharing.py

check-audit: ## Verify state-changing handlers use AuditLayer (soft until Phase 2)
	python3 ../scripts/check_audit_coverage.py

check-tracing: ## Verify route handlers carry #[tracing::instrument(... fields(tenant_id))]
	python3 ../scripts/check_tracing_spans.py

check-migration-headers: ## Verify migrations >=124 carry RLS-Posture header block
	python3 ../scripts/migration_header_lint.py

check-region-pinning: ## DPDP residency check — region-pinned configs may not reference other regions
	python3 ../scripts/check_region_pinning.py

check-no-card-logging: ## PCI scope check — card identifiers banned from log statements
	python3 ../scripts/check_no_card_logging.py

check-egress-allowlist: ## Cilium egress allowlist coherence check (soft until Phase 4)
	python3 ../scripts/check_egress_allowlist.py

# ── Docker ───────────────────────────────────────────────────

docker-build: ## Build the medbrains-server Docker image
	docker build -t medbrains-server:dev -f Dockerfile .

# ── Packer (Sprint B) ────────────────────────────────────────

packer-build: ## Build the postgres-patroni AMI (~$0.05, ~10min real EC2)
	cd infra/packer/postgres-bottlerocket && packer build -var "region=ap-south-1" postgres.pkr.hcl

packer-destroy: ## Deregister + delete medbrains-postgres-* AMIs we built
	infra/packer/postgres-bottlerocket/destroy.sh

packer-destroy-dry: ## Preview what packer-destroy would delete
	infra/packer/postgres-bottlerocket/destroy.sh --dry-run

# ── Terraform (RFC-INFRA-2026-002 Phase 4) ───────────────────

# Usage: make deploy ENV=prod REGION=ap-south-1
deploy: ## terraform apply for ENV/REGION combination
	@if [ -z "$(ENV)" ] || [ -z "$(REGION)" ]; then \
		echo "Usage: make deploy ENV=<dev|staging|prod> REGION=<aws-region>"; \
		exit 1; \
	fi
	cd infra/terraform/envs/$(ENV)/regions/$(REGION) && \
		terraform init -upgrade && \
		terraform plan -out=plan.tfplan && \
		terraform apply plan.tfplan

deploy-plan: ## terraform plan only for ENV/REGION
	@if [ -z "$(ENV)" ] || [ -z "$(REGION)" ]; then \
		echo "Usage: make deploy-plan ENV=<dev|staging|prod> REGION=<aws-region>"; \
		exit 1; \
	fi
	cd infra/terraform/envs/$(ENV)/regions/$(REGION) && \
		terraform init -upgrade && \
		terraform plan

deploy-bootstrap: ## terraform apply bootstrap (state buckets, run ONCE per region)
	@if [ -z "$(REGION)" ]; then \
		echo "Usage: make deploy-bootstrap REGION=<aws-region>"; \
		exit 1; \
	fi
	cd infra/terraform/modules/bootstrap && \
		terraform init -upgrade && \
		terraform apply -var=region=$(REGION)

# ── Desktop (Tauri 2) ────────────────────────────────────

desktop-dev: ## Run desktop app in dev mode (hot-reload SPA)
	cd apps/desktop && pnpm install && pnpm dev

desktop-build: ## Build desktop bundle for current OS
	cd apps/desktop && pnpm install && pnpm build

desktop-build-macos: ## Build .dmg (macOS host required)
	cd apps/desktop && pnpm install && pnpm build:macos

desktop-build-windows: ## Build .msi (Windows host required)
	cd apps/desktop && pnpm install && pnpm build:windows

desktop-build-linux: ## Build .AppImage + .deb + .rpm (Linux host required)
	cd apps/desktop && pnpm install && pnpm build:linux

# ── Smoke & E2E Tests ────────────────────────────────────

smoke-test: ## Run API smoke tests (needs running backend)
	pnpm exec playwright test --config apps/web/playwright.config.ts e2e/smoke/

e2e-test: ## Run full E2E scenario tests (needs backend + frontend)
	pnpm exec playwright test --config apps/web/playwright.config.ts e2e/scenarios/

generate-smoke: ## Regenerate smoke test files from API contract
	python3 ../scripts/generate_smoke_tests.py

generate-e2e: ## Regenerate E2E skeleton files
	python3 ../scripts/generate_e2e_skeletons.py

# ── Layered E2E Suite (per the comprehensive E2E plan) ────

e2e-smoke-generate: ## Regenerate Layer 1 API smoke specs from routes/mod.rs
	node apps/web/scripts/generate-api-smoke.mjs

e2e-smoke: ## Layer 1 — API smoke (every parameterless GET endpoint)
	cd apps/web && pnpm exec playwright test --project=smoke

e2e-crud: ## Layer 2 — Module CRUD specs (REST-driven)
	cd apps/web && pnpm exec playwright test --project=crud

e2e-forms: ## Layer 3 — Form-field validation (UI; needs dev server)
	cd apps/web && pnpm exec playwright test --project=forms

e2e-analytics: ## Layer 4 — Analytics endpoints (REST)
	cd apps/web && pnpm exec playwright test --project=analytics

e2e-journeys: ## Layer 5 — End-to-end journeys (hybrid UI + REST)
	cd apps/web && pnpm exec playwright test --project=journeys

e2e-all: e2e-smoke e2e-crud e2e-analytics e2e-journeys ## Run smoke + CRUD + analytics + journeys (skip forms by default)
	@echo "Run 'make e2e-forms' separately to drive the UI layer."

# ── Load test ─────────────────────────────────────────────────

loadtest-generate: ## Regenerate goose AllEndpoints scenario from routes/mod.rs
	node apps/web/scripts/generate-goose-endpoints.mjs

loadtest-build: loadtest-generate ## Build the goose loadtest binary
	cargo build -p medbrains-loadtest --release

loadtest: loadtest-build ## Run curated scenarios + AllEndpoints (4 users, 60s)
	cargo run --release -p medbrains-loadtest -- \
		--host http://localhost:3000 --users 4 --hatch-rate 1 --run-time 60s \
		--no-reset-metrics --report-file target/loadtest-report.html

loadtest-all: loadtest-build ## Run only the AllEndpoints breadth scenario
	cargo run --release -p medbrains-loadtest -- \
		--host http://localhost:3000 --users 4 --hatch-rate 1 --run-time 60s \
		--no-reset-metrics --scenarios AllEndpoints \
		--report-file target/loadtest-all-report.html

# ── Misc ─────────────────────────────────────────────────────

clean: ## Clean build artifacts
	cargo clean
	rm -rf apps/web/dist
	rm -rf packages/*/lib

seed: db ## Start db and run backend (triggers auto-seed)
	@echo "Running backend to execute migrations + seed..."
	@cargo run &
	@sleep 5
	@kill $$! 2>/dev/null || true
	@echo "Seed complete. Default login: admin / admin123"

# ── Testing ─────────────────────────────────────────────────

test-rust: ## Run all Rust tests + export results
	cargo test --workspace 2>&1 | python3 qa/reporters/cargo-kiwi-report.py

test-unit: ## Run Rust unit tests only (no DB needed)
	cargo test -p medbrains-adapter-sdk -p medbrains-core 2>&1 | python3 qa/reporters/cargo-kiwi-report.py

test-ts: ## Run TypeScript unit tests (Vitest)
	pnpm run test

test-e2e: ## Run Playwright E2E tests (results go to Allure)
	pnpm --filter @medbrains/web exec playwright test e2e/scenarios/

test-all: test-rust test-ts ## Run Rust + TypeScript tests
	@echo "All tests done. Results in qa/kiwi-results/"
	@echo "Run 'python3 qa/sync.py' to push cases to Kiwi."

# ── ship pipeline (Track 0.epsilon) ───────────────────────
#
# Three flavours:
#   make ship-quick   — local dev sanity (lint + typecheck + cargo check + audit)
#   make ship         — full CI gate (everything except deploy)
#   make ship-cold    — full release: ship + deploy to prod
#
# Each step is independently runnable as its own target. `ship` chains
# them so failures stop at the offending stage with a clear marker.

ship-quick: ## Local sanity: lint + typecheck + cargo check + audit (~5 min)
	@echo "── 1/4 lint ─────────────────────────────"
	@$(MAKE) -s lint
	@echo "── 2/4 typecheck ────────────────────────"
	@$(MAKE) -s check-frontend
	@echo "── 3/4 cargo check ──────────────────────"
	@$(MAKE) -s check-backend
	@echo "── 4/4 screen audit ────────────────────"
	@python3 ../scripts/audit_screens.py
	@echo "✅ ship-quick clean."

ship: ## Full CI gate (no deploy). lint → typecheck → tests → contract → audit → build (~15-20 min)
	@echo "── 1/9 lint ─────────────────────────────"
	@$(MAKE) -s lint
	@echo "── 2/9 typecheck (frontend) ─────────────"
	@$(MAKE) -s check-frontend
	@echo "── 3/9 cargo check ──────────────────────"
	@$(MAKE) -s check-backend
	@echo "── 4/9 unit tests ───────────────────────"
	@$(MAKE) -s test-all
	@echo "── 5/9 API + UI + type contract ─────────"
	@$(MAKE) -s check-api
	@$(MAKE) -s check-ui-api
	@$(MAKE) -s check-types
	@$(MAKE) -s check-nav-drift
	@echo "── 6/9 RLS + audit + tenant + tracing + sqlx ──"
	@$(MAKE) -s check-rls
	@$(MAKE) -s check-tenant-leak
	@$(MAKE) -s check-runtime-sqlx
	@$(MAKE) -s check-audit
	@$(MAKE) -s check-tracing
	@echo "── 7/9 compliance (region/PCI/egress) ──"
	@$(MAKE) -s check-region-pinning
	@$(MAKE) -s check-no-card-logging
	@$(MAKE) -s check-egress-allowlist
	@$(MAKE) -s check-migration-headers
	@echo "── 8/9 screen audit (strict) ───────────"
	@python3 ../scripts/audit_screens.py --strict
	@echo "── 9/9 release build ────────────────────"
	@$(MAKE) -s build
	@echo "✅ ship clean — ready to deploy."

ship-cold: ship ## Full ship + deploy to prod (Starter tier on hims.amh.org.in)
	@echo "── deploy ──────────────────────────────"
	@cd infra/terraform/envs/standalone/alagappa && $(MAKE) apply
	@echo "── post-deploy smoke ───────────────────"
	@curl -sS --fail --max-time 10 https://hims.amh.org.in/api/health > /dev/null \
		&& echo "✅ /api/health 200" \
		|| { echo "❌ /api/health failed"; exit 1; }
	@echo "✅ ship-cold complete."

ship-help: ## Document each ship-pipeline stage
	@echo "make ship-quick    — ~5 min  — local dev sanity"
	@echo "make ship          — ~15 min — full CI gate (no deploy)"
	@echo "make ship-cold     — ~25 min — ship + deploy"
	@echo ""
	@echo "Per-stage targets:"
	@echo "  lint, check-frontend, check-backend, test-all,"
	@echo "  check-api, check-ui-api, check-types, check-nav-drift,"
	@echo "  check-rls, check-tenant-leak, check-audit, check-tracing,"
	@echo "  check-region-pinning, check-no-card-logging,"
	@echo "  check-egress-allowlist, check-migration-headers, build"

kiwi-up: ## Start Kiwi TCMS
	docker compose up -d kiwi
	@echo "Kiwi TCMS: https://localhost:8443"

kiwi-sync: ## Sync YAML test cases → Kiwi TCMS
	python3 qa/sync.py

test-coverage: ## Show QA coverage report from YAML registry
	python3 qa/coverage-report.py

test-report: ## Show QA test coverage report
	python3 qa/coverage-report.py

# ── Hybrid (cloud + on-prem) deployment ────────────────────
# Per-tenant lifecycle. TENANT=hospital-A is the directory under
# infra/terraform/envs/tenants/. _template/ is copied to a new
# directory and customized for each real hospital.

TENANTS_DIR := infra/terraform/envs/tenants

hybrid-init: ## Initialize a new tenant from the template (TENANT=hospital-A)
	@if [ -z "$(TENANT)" ]; then echo "TENANT= required (e.g. make hybrid-init TENANT=hospital-A)"; exit 2; fi
	@if [ -d $(TENANTS_DIR)/$(TENANT) ]; then echo "Tenant $(TENANT) already exists at $(TENANTS_DIR)/$(TENANT)"; exit 1; fi
	@cp -r $(TENANTS_DIR)/_template $(TENANTS_DIR)/$(TENANT)
	@echo "Created $(TENANTS_DIR)/$(TENANT). Edit terraform.tfvars before running hybrid-up."

hybrid-up: ## Provision cloud + on-prem stacks for a tenant (TENANT=hospital-A)
	@if [ -z "$(TENANT)" ]; then echo "TENANT= required"; exit 2; fi
	@if [ ! -d $(TENANTS_DIR)/$(TENANT) ]; then echo "Tenant dir $(TENANTS_DIR)/$(TENANT) missing — run hybrid-init first"; exit 1; fi
	cd $(TENANTS_DIR)/$(TENANT) && terraform init
	cd $(TENANTS_DIR)/$(TENANT) && terraform apply -auto-approve

hybrid-plan: ## Plan changes for a tenant without applying (TENANT=hospital-A)
	@if [ -z "$(TENANT)" ]; then echo "TENANT= required"; exit 2; fi
	cd $(TENANTS_DIR)/$(TENANT) && terraform plan

hybrid-smoke: ## Run hybrid smoke tests (Headscale + Patroni + outbox path)
	@if [ -z "$(TENANT)" ]; then echo "TENANT= required"; exit 2; fi
	@bash scripts/hybrid-smoke.sh $(TENANT)

hybrid-down: ## Destroy a tenant's stacks (DESTRUCTIVE — irreversible without backups)
	@if [ -z "$(TENANT)" ]; then echo "TENANT= required"; exit 2; fi
	@echo "About to destroy tenant $(TENANT). Press Ctrl+C to abort, Enter to continue."
	@read _
	cd $(TENANTS_DIR)/$(TENANT) && terraform destroy -auto-approve

hybrid-tf-validate: ## Validate every hybrid TF module without applying
	@for d in infra/terraform/modules/headscale \
	          infra/terraform/modules/bridge-ingress \
	          infra/terraform/modules-onprem/k3s-cluster \
	          infra/terraform/modules-onprem/bridge-agent \
	          infra/terraform/modules-onprem/patroni-onprem \
	          infra/terraform/modules-onprem-baremetal/k3s-baremetal \
	          infra/terraform/modules-onprem-baremetal/patroni-baremetal; do \
	    echo "→ $$d"; \
	    (cd "$$d" && terraform init -backend=false -no-color > /dev/null && terraform validate -no-color) || exit $$?; \
	done
	@echo "✓ all hybrid modules valid"
