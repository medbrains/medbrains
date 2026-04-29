.PHONY: help dev dev-backend dev-frontend db db-stop db-reset \
       build build-backend build-frontend \
       check check-backend check-frontend lint check-api check-sqlx prepare-sqlx \
       check-ui-api check-types check-all \
       check-rls check-sharing check-tenant-leak check-audit check-tracing \
       check-migration-headers \
       check-region-pinning check-no-card-logging check-egress-allowlist \
       smoke-test e2e-test generate-smoke generate-e2e \
       test-rust test-unit test-ts test-all test-coverage \
       docker-build \
       packer-build packer-destroy packer-destroy-dry \
       deploy deploy-plan deploy-bootstrap \
       clean logs db-shell seed

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
	@SQLX_OFFLINE=false cargo build 2>&1 || { echo "❌ Backend compilation failed"; exit 1; }
	@echo "✅ Backend compiled. Starting backend + frontend..."
	@trap 'kill 0' EXIT; \
		SQLX_OFFLINE=false cargo run & \
		pnpm dev:web & \
		wait

dev-fast: ## Start everything (skip compile check — use when already compiled)
	@docker compose up -d postgres 2>/dev/null
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@trap 'kill 0' EXIT; \
		SQLX_OFFLINE=false cargo run & \
		pnpm dev:web & \
		wait

dev-backend: db ## Start database + backend only
	SQLX_OFFLINE=false cargo run

dev-frontend: ## Start frontend only (assumes backend running)
	pnpm dev:web

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

prepare-sqlx: ## Refresh SQLx offline metadata from the configured database
	SQLX_OFFLINE=false DATABASE_URL="$${DATABASE_URL:-postgres://medbrains:medbrains_dev@localhost:5435/medbrains}" cargo sqlx prepare --workspace

check-sqlx: ## Verify SQLx offline metadata matches schema and query text
	SQLX_OFFLINE=false DATABASE_URL="$${DATABASE_URL:-postgres://medbrains:medbrains_dev@localhost:5435/medbrains}" cargo sqlx prepare --check --workspace

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

check-all: check-api check-ui-api check-types check-rls check-tenant-leak check-sharing check-audit check-tracing check-migration-headers check-region-pinning check-no-card-logging check-egress-allowlist ## Run all static checks (incl. RLS + sharing + audit + tracing + compliance)

# ── Audit / Authz Static Checks (RFC-INFRA-2026-002 Phase 0) ─

check-rls: ## Verify every tenant_id-bearing table has RLS coverage
	python3 ../scripts/check_rls.py

check-tenant-leak: ## Ban raw sqlx::query* in routes/ (ratchets against baseline)
	python3 ../scripts/check_tenant_leak.py

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

# ── Smoke & E2E Tests ────────────────────────────────────

smoke-test: ## Run API smoke tests (needs running backend)
	pnpm exec playwright test --config apps/web/playwright.config.ts e2e/smoke/

e2e-test: ## Run full E2E scenario tests (needs backend + frontend)
	pnpm exec playwright test --config apps/web/playwright.config.ts e2e/scenarios/

generate-smoke: ## Regenerate smoke test files from API contract
	python3 ../scripts/generate_smoke_tests.py

generate-e2e: ## Regenerate E2E skeleton files
	python3 ../scripts/generate_e2e_skeletons.py

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

kiwi-up: ## Start Kiwi TCMS
	docker compose up -d kiwi
	@echo "Kiwi TCMS: https://localhost:8443"

kiwi-sync: ## Sync YAML test cases → Kiwi TCMS
	python3 qa/sync.py

test-coverage: ## Show QA coverage report from YAML registry
	python3 qa/coverage-report.py

test-report: ## Show QA test coverage report
	python3 qa/coverage-report.py
