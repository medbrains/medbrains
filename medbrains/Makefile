.PHONY: help dev dev-backend dev-frontend db db-stop db-reset \
       build build-backend build-frontend \
       check check-backend check-frontend lint check-api check-sqlx prepare-sqlx \
       check-ui-api check-types check-all \
       smoke-test e2e-test generate-smoke generate-e2e \
       test-rust test-unit test-ts test-all test-coverage \
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

check-all: check-api check-ui-api check-types ## Run all static checks

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
