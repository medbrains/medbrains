.PHONY: help dev dev-fast dev-icd dev-backend dev-frontend local-https-cert dev-proxy dev-https db db-icd db-stop db-reset \
       build build-backend build-frontend \
       camp-mobile camp-mobile-ios camp-mobile-android \
       mobile-staff-start mobile-staff-start-lan \
       mobile-staff-ios mobile-staff-ios-https mobile-staff-ios-devices mobile-staff-ios-doctor mobile-staff-ios-platform \
       mobile-staff-android mobile-staff-prebuild mobile-staff-typecheck \
       check check-backend check-frontend lint check-api \
       check-ui-api check-types check-all \
       test-frontend test-frontend-coverage analyze \
       smoke-test e2e-test generate-smoke generate-e2e \
       loadtest loadtest-quick loadtest-stress loadtest-soak \
       desktop desktop-dev desktop-reports-dev desktop-build desktop-build-macos desktop-build-windows desktop-build-linux \
       icd-up icd-down icd-logs icd-open \
       clean logs db-shell seed \
       docs docs-build flamegraph profile-build miri watch watch-check

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))medbrains
IOS_DEVICE ?=
ANDROID_DEVICE ?=
IOS_RUN_ARGS = -- --port 8082 $(if $(IOS_DEVICE),--device "$(IOS_DEVICE)",)
ANDROID_RUN_ARGS = -- --port 8082 $(if $(ANDROID_DEVICE),--device "$(ANDROID_DEVICE)",)
DEV_HTTPS_DOMAIN ?= medbrains.localhost
DEV_HTTPS_ORIGIN ?= https://$(DEV_HTTPS_DOMAIN)
DEV_DESKTOP_HTTPS_DOMAIN ?= medbrains-desktop.localhost
DEV_DESKTOP_HTTPS_ORIGIN ?= https://$(DEV_DESKTOP_HTTPS_DOMAIN)
DEV_ICD_HTTPS_DOMAIN ?= medbrains-icd.localhost
DEV_ICD_HTTPS_ORIGIN ?= https://$(DEV_ICD_HTTPS_DOMAIN)
DEV_HTTPS_ALT_DOMAINS ?= $(DEV_DESKTOP_HTTPS_DOMAIN),$(DEV_ICD_HTTPS_DOMAIN)
DEV_PROXY_CONFIG ?= infra/local/pingora-dev.toml
WHO_ICD_RELEASE_ID ?= 2026-01
ICD_API_PORT ?= 8382
ICD_API_INCLUDE ?= $(WHO_ICD_RELEASE_ID)_en
ICD_API_SAVE_ANALYTICS ?= false

# Default
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────

dev: ## Start everything through the local HTTPS proxy
	@$(MAKE) -C $(ROOT) dev DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_DOMAIN=$(DEV_DESKTOP_HTTPS_DOMAIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) DEV_ICD_HTTPS_DOMAIN=$(DEV_ICD_HTTPS_DOMAIN) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG)

dev-fast: ## Start everything through HTTPS, skipping unchanged backend rebuilds
	@$(MAKE) -C $(ROOT) dev-fast DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_DOMAIN=$(DEV_DESKTOP_HTTPS_DOMAIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) DEV_ICD_HTTPS_DOMAIN=$(DEV_ICD_HTTPS_DOMAIN) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG)

dev-icd: ## Start HTTPS dev stack using local WHO ICD-API Docker service
	@$(MAKE) -C $(ROOT) dev-icd DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_DOMAIN=$(DEV_DESKTOP_HTTPS_DOMAIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) DEV_ICD_HTTPS_DOMAIN=$(DEV_ICD_HTTPS_DOMAIN) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG) WHO_ICD_RELEASE_ID=$(WHO_ICD_RELEASE_ID) ICD_API_PORT=$(ICD_API_PORT) ICD_API_INCLUDE=$(ICD_API_INCLUDE) ICD_API_SAVE_ANALYTICS=$(ICD_API_SAVE_ANALYTICS)

dev-backend: db ## Start database + backend only
	cd $(ROOT) && cargo run --bin medbrains-server

dev-frontend: ## Start frontend only (assumes backend running)
	cd $(ROOT) && pnpm dev:web

local-https-cert: ## Generate local HTTPS certificate for MedBrains local domains
	@$(MAKE) -C $(ROOT) local-https-cert DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS)

dev-proxy: ## Start local Pingora HTTPS proxy on https://medbrains.localhost
	@$(MAKE) -C $(ROOT) dev-proxy DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG)

dev-https: dev ## Alias for make dev

# ── Mobile / Camp Mode ───────────────────────────────────────

camp-mobile: mobile-staff-start-lan ## Start Camp Mode staff mobile app (LAN QR, port 8082)

camp-mobile-ios: mobile-staff-ios ## Open Camp Mode staff mobile app on iOS

camp-mobile-android: mobile-staff-android ## Open Camp Mode staff mobile app on Android

mobile-staff-start: ## Start staff mobile Expo Metro using pnpm
	cd $(ROOT) && pnpm --filter @medbrains/mobile-staff start

mobile-staff-start-lan: ## Start staff mobile Expo Metro on LAN port 8082
	cd $(ROOT) && pnpm --filter @medbrains/mobile-staff start -- --host lan --port 8082

mobile-staff-ios: ## Build/open staff mobile app on iOS with local HTTPS API base
	@$(MAKE) -C $(ROOT) mobile-staff-ios DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) IOS_DEVICE="$(IOS_DEVICE)"

mobile-staff-ios-https: mobile-staff-ios ## Alias for HTTPS staff iOS run

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
	cd $(ROOT) && pnpm --filter @medbrains/mobile-staff android $(ANDROID_RUN_ARGS)

mobile-staff-prebuild: ## Regenerate native projects for staff mobile app
	cd $(ROOT) && pnpm --filter @medbrains/mobile-staff prebuild

mobile-staff-typecheck: ## Typecheck staff mobile app
	cd $(ROOT) && pnpm --filter @medbrains/mobile-staff typecheck

watch: db ## Auto-restart backend on code changes (requires cargo-watch)
	cd $(ROOT) && cargo watch -w crates -w Cargo.toml -w Cargo.lock -x 'run --bin medbrains-server'

watch-check: ## Auto-check on code changes (requires cargo-watch)
	cd $(ROOT) && cargo watch -w crates -w Cargo.toml -w Cargo.lock -x 'clippy -- -D warnings'

# ── Database ─────────────────────────────────────────────────

db: ## Start PostgreSQL
	cd $(ROOT) && docker compose up -d postgres

db-icd: ## Start PostgreSQL, SpiceDB, and local WHO ICD-API
	@$(MAKE) -C $(ROOT) db-icd WHO_ICD_RELEASE_ID=$(WHO_ICD_RELEASE_ID) ICD_API_PORT=$(ICD_API_PORT) ICD_API_INCLUDE=$(ICD_API_INCLUDE) ICD_API_SAVE_ANALYTICS=$(ICD_API_SAVE_ANALYTICS)

db-stop: ## Stop all containers
	cd $(ROOT) && docker compose down

db-reset: ## Wipe database and restart fresh
	cd $(ROOT) && docker compose down -v
	cd $(ROOT) && docker compose up -d postgres
	@echo "Waiting for PostgreSQL..."
	@cd $(ROOT) && until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@echo "Database reset. Run 'make dev-backend' to re-run migrations + seed."

db-shell: ## Open psql shell
	cd $(ROOT) && docker compose exec postgres psql -U medbrains -d medbrains

logs: ## Tail database logs
	cd $(ROOT) && docker compose logs -f postgres

icd-up: ## Start local WHO ICD-API container for ICD-11 search
	@$(MAKE) -C $(ROOT) icd-up WHO_ICD_RELEASE_ID=$(WHO_ICD_RELEASE_ID) ICD_API_PORT=$(ICD_API_PORT) ICD_API_INCLUDE=$(ICD_API_INCLUDE) ICD_API_SAVE_ANALYTICS=$(ICD_API_SAVE_ANALYTICS)

icd-down: ## Stop local WHO ICD-API container
	@$(MAKE) -C $(ROOT) icd-down

icd-logs: ## Tail local WHO ICD-API logs
	@$(MAKE) -C $(ROOT) icd-logs

icd-open: ## Print local WHO ICD-API browser/coding-tool URLs
	@$(MAKE) -C $(ROOT) icd-open ICD_API_PORT=$(ICD_API_PORT) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN)

# ── Build ────────────────────────────────────────────────────

build: build-backend build-frontend ## Build everything

build-backend: ## Build Rust backend (release)
	cd $(ROOT) && cargo build --release

build-frontend: ## Build web frontend
	cd $(ROOT) && pnpm build --filter=@medbrains/web

profile-build: ## Build with profiling symbols (for flamegraph)
	cd $(ROOT) && cargo build --profile profiling

# ── Desktop (Tauri 2) ────────────────────────────────────────

desktop: ## Start desktop app against the running make dev stack
	@$(MAKE) -C $(ROOT) desktop DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) ROUTE="$(ROUTE)"

desktop-dev: ## Start desktop app against https://medbrains-desktop.localhost
	@$(MAKE) -C $(ROOT) desktop-dev DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) ROUTE="$(ROUTE)"

desktop-reports-dev: ## Run desktop app directly on the reports command center
	@$(MAKE) -C $(ROOT) desktop-reports-dev DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN)

desktop-build: ## Build desktop bundle for current OS
	@$(MAKE) -C $(ROOT) desktop-build

desktop-build-macos: ## Build .dmg (macOS host required)
	@$(MAKE) -C $(ROOT) desktop-build-macos

desktop-build-windows: ## Build .msi (Windows host required)
	@$(MAKE) -C $(ROOT) desktop-build-windows

desktop-build-linux: ## Build .AppImage + .deb + .rpm (Linux host required)
	@$(MAKE) -C $(ROOT) desktop-build-linux

# ── Check / Lint ─────────────────────────────────────────────

check: check-backend check-frontend ## Run all checks

check-backend: ## Run cargo clippy
	cd $(ROOT) && cargo clippy -- -D warnings

check-frontend: ## Run TypeScript typecheck
	cd $(ROOT) && pnpm typecheck --filter=@medbrains/web

lint: ## Run biome lint + format check
	cd $(ROOT) && pnpm --filter=@medbrains/web exec biome check src/

# ── Testing ──────────────────────────────────────────────────

test-frontend: ## Run frontend tests
	cd $(ROOT) && pnpm test

test-frontend-coverage: ## Run frontend tests with coverage
	cd $(ROOT) && pnpm --filter=@medbrains/web exec vitest run --coverage

# ── Load Testing (Goose) ───────────────────────────────────

loadtest: ## Build load test binary (release)
	cd $(ROOT) && cargo build --release -p medbrains-loadtest

loadtest-quick: ## Quick smoke test (10 users, 30s)
	cd $(ROOT) && cargo run --release -p medbrains-loadtest -- \
		--host http://localhost:3000 --users 10 --hatch-rate 2 \
		--run-time 30s --report-file target/loadtest-report.html

loadtest-stress: ## Stress test (100 users, 2min)
	cd $(ROOT) && cargo run --release -p medbrains-loadtest -- \
		--host http://localhost:3000 --users 100 --hatch-rate 10 \
		--run-time 2m --report-file target/loadtest-report.html

loadtest-soak: ## Soak test (50 users, 30min)
	cd $(ROOT) && cargo run --release -p medbrains-loadtest -- \
		--host http://localhost:3000 --users 50 --hatch-rate 5 \
		--run-time 30m --report-file target/loadtest-report.html

# ── Bundle Analysis ─────────────────────────────────────────

analyze: ## Build with bundle analysis (opens stats.html)
	cd $(ROOT) && ANALYZE=true pnpm --filter=@medbrains/web exec vite build

# ── Documentation ────────────────────────────────────────────

docs: ## Build and open Rust API docs
	cd $(ROOT) && cargo doc --workspace --no-deps --open

docs-build: ## Build Rust API docs (no open)
	cd $(ROOT) && cargo doc --workspace --no-deps

# ── Profiling & Analysis ────────────────────────────────────

flamegraph: ## Generate CPU flamegraph (requires cargo-flamegraph)
	cd $(ROOT) && cargo flamegraph --profile profiling --bin medbrains-server -o flamegraph.svg

miri: ## Run Miri undefined behavior checks (requires nightly)
	cd $(ROOT) && rustup run nightly cargo miri test --workspace

# ── API Contract & Coverage ──────────────────────────────

check-api: ## Verify frontend↔backend API contract
	python3 $(ROOT)/../scripts/check_api_contract.py

check-ui-api: ## Verify UI pages ↔ API method coverage
	python3 $(ROOT)/../scripts/check_ui_api_coverage.py

check-types: ## Verify TS ↔ Rust type field contracts
	python3 $(ROOT)/../scripts/check_type_contract.py

check-all: check-api check-ui-api check-types ## Run all static checks

# ── Smoke & E2E Tests ────────────────────────────────────

smoke-test: ## Run API smoke tests (needs running backend)
	cd $(ROOT) && pnpm exec playwright test --config apps/web/playwright.config.ts e2e/smoke/

e2e-test: ## Run full E2E scenario tests (needs backend + frontend)
	cd $(ROOT) && pnpm exec playwright test --config apps/web/playwright.config.ts e2e/scenarios/

generate-smoke: ## Regenerate smoke test files from API contract
	python3 $(ROOT)/../scripts/generate_smoke_tests.py

generate-e2e: ## Regenerate E2E skeleton files
	python3 $(ROOT)/../scripts/generate_e2e_skeletons.py

# ── Misc ─────────────────────────────────────────────────────

clean: ## Clean build artifacts
	cd $(ROOT) && cargo clean
	rm -rf $(ROOT)/apps/web/dist
	rm -rf $(ROOT)/packages/*/lib

seed: db ## Start db and run backend (triggers auto-seed)
	@echo "Running backend to execute migrations + seed..."
	@cd $(ROOT) && cargo run --bin medbrains-server &
	@sleep 5
	@kill $$! 2>/dev/null || true
	@echo "Seed complete. Default login: admin / admin123"
