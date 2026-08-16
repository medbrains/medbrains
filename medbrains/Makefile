.PHONY: help dev dev-watch dev-fast dev-icd dev-backend dev-frontend dev-simulator-admin db db-stop db-reset db-icd \
       sim-hospital sim-hospital-batch sim-hospital-clean \
       local-https-cert dev-proxy dev-https \
       build build-backend build-frontend \
       camp-mobile camp-mobile-ios camp-mobile-android \
       mobile-camp-start mobile-camp-start-lan mobile-camp-ios mobile-camp-android mobile-camp-prebuild mobile-camp-typecheck \
       mobile-staff-start mobile-staff-start-lan \
       mobile-staff-ios mobile-staff-ios-https mobile-staff-ios-devices mobile-staff-ios-doctor mobile-staff-ios-platform \
       mobile-staff-android mobile-staff-prebuild mobile-staff-typecheck \
       check check-backend check-frontend lint check-api check-sqlx prepare-sqlx guard-sqlx-nonprod \
       check-ui-api check-types check-ui-seam check-raw-html check-secrets check-all \
       check-field-classes check-authz-collapse check-relation-parity check-parent-id-scoping authz-ledger \
       check-rls check-sharing check-authz-posture check-print-placeholders check-requirement-flags check-surface-drift check-role-templates check-tx-error-discard check-pg-enum-parity check-default-parity check-unbounded-reads check-permission-enforcement check-tenant-registry-reads check-pool-reads check-rls-only-writes check-tenant-leak check-runtime-sqlx check-audit check-tracing \
       check-migration-headers \
       check-region-pinning check-no-card-logging check-egress-allowlist check-cert-readiness check-encryption-at-rest check-redaction-masking \
       smoke-test e2e-test e2e-smoke e2e-crud e2e-forms e2e-analytics e2e-rbac e2e-journeys e2e-ui-aaa e2e-full e2e-all generate-smoke generate-e2e \
       test-rust test-unit test-ts test-all test-coverage \
       ship ship-quick ship-cold hotpush-ui ship-help \
       docker-build \
       packer-build packer-destroy packer-destroy-dry \
       deploy deploy-plan deploy-bootstrap \
       desktop desktop-dev desktop-reports-dev desktop-build desktop-build-macos desktop-build-windows desktop-build-linux \
       icd-up icd-down icd-logs icd-open \
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
CAMP_MOBILE_PORT ?= 8083
IOS_RUN_ARGS = -- --port 8082 $(if $(IOS_DEVICE),--device "$(IOS_DEVICE)",)
ANDROID_RUN_ARGS = -- --port 8082 $(if $(ANDROID_DEVICE),--device "$(ANDROID_DEVICE)",)
CAMP_IOS_RUN_ARGS = -- --port $(CAMP_MOBILE_PORT) $(if $(IOS_DEVICE),--device "$(IOS_DEVICE)",)
CAMP_ANDROID_RUN_ARGS = -- --port $(CAMP_MOBILE_PORT) $(if $(ANDROID_DEVICE),--device "$(ANDROID_DEVICE)",)
DEV_HTTPS_DOMAIN ?= medbrains.localhost
DEV_HTTPS_ORIGIN ?= https://$(DEV_HTTPS_DOMAIN)
DEV_DESKTOP_HTTPS_DOMAIN ?= medbrains-desktop.localhost
DEV_DESKTOP_HTTPS_ORIGIN ?= https://$(DEV_DESKTOP_HTTPS_DOMAIN)
DEV_SIMULATOR_HTTPS_DOMAIN ?= medbrains-simulator.localhost
DEV_SIMULATOR_HTTPS_ORIGIN ?= https://$(DEV_SIMULATOR_HTTPS_DOMAIN)
DEV_ICD_HTTPS_DOMAIN ?= medbrains-icd.localhost
DEV_ICD_HTTPS_ORIGIN ?= https://$(DEV_ICD_HTTPS_DOMAIN)
# Mail hostname for the dev Stalwart (Outlook/Apple Mail point here). Included
# in the mkcert SAN list so the system-trusted dev cert covers it; the cert is
# mounted into Stalwart (make stalwart-cert) so mail clients get a trusted TLS.
DEV_MAIL_HTTPS_DOMAIN ?= mail.medbrains.localhost
DEV_HTTPS_ALT_DOMAINS ?= $(DEV_DESKTOP_HTTPS_DOMAIN),$(DEV_SIMULATOR_HTTPS_DOMAIN),$(DEV_ICD_HTTPS_DOMAIN),$(DEV_MAIL_HTTPS_DOMAIN)
DEV_PROXY_CONFIG ?= infra/local/pingora-dev.toml
SIM_CONFIG ?= configs/simulators/hospital-stream.demo.json
SIM_RUN_ID ?= nmc-demo
SIM_PATIENTS ?= 60
SIM_RATE ?= 3
WHO_ICD_RELEASE_ID ?= 2026-01
ICD_API_PORT ?= 8382
ICD_API_INCLUDE ?= $(WHO_ICD_RELEASE_ID)_en
ICD_API_SAVE_ANALYTICS ?= false
ICD_API_LOCAL_BASE_URL ?= $(DEV_ICD_HTTPS_ORIGIN)

# Default
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────

dev: local-https-cert icd-up ## Start everything with local HTTPS proxy and local ICD-11
	@echo "Starting PostgreSQL and local SpiceDB..."
	@docker compose up -d postgres spicedb gotenberg stalwart
	@echo "Waiting for PostgreSQL..."
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@SPICEDB_SKIP_START=true SPICEDB_ENDPOINT=http://localhost:50051 SPICEDB_TOKEN=devsecret scripts/spicedb_local_schema.sh
	@MEDBRAINS_LOG_PAYLOAD_SIZES=1 WHO_ICD_API_BASE_URL=$(ICD_API_LOCAL_BASE_URL) WHO_ICD_AUTH_MODE=none WHO_ICD_RELEASE_ID=$(WHO_ICD_RELEASE_ID) DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_DOMAIN=$(DEV_DESKTOP_HTTPS_DOMAIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) DEV_SIMULATOR_HTTPS_DOMAIN=$(DEV_SIMULATOR_HTTPS_DOMAIN) DEV_SIMULATOR_HTTPS_ORIGIN=$(DEV_SIMULATOR_HTTPS_ORIGIN) DEV_ICD_HTTPS_DOMAIN=$(DEV_ICD_HTTPS_DOMAIN) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG) scripts/dev_https.sh

dev-watch: ## Same as `make dev` but the BACKEND auto-rebuilds+restarts on save (cargo-watch; only the changed crate recompiles)
	@DEV_BACKEND_WATCH=true $(MAKE) dev

dev-fast: local-https-cert icd-up ## Start everything with HTTPS proxy and ICD-11, skip compile check
	@docker compose up -d postgres spicedb gotenberg stalwart 2>/dev/null
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@SPICEDB_SKIP_START=true SPICEDB_ENDPOINT=http://localhost:50051 SPICEDB_TOKEN=devsecret scripts/spicedb_local_schema.sh
	@SKIP_BACKEND_BUILD=true WHO_ICD_API_BASE_URL=$(ICD_API_LOCAL_BASE_URL) WHO_ICD_AUTH_MODE=none WHO_ICD_RELEASE_ID=$(WHO_ICD_RELEASE_ID) DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ORIGIN=$(DEV_HTTPS_ORIGIN) DEV_DESKTOP_HTTPS_DOMAIN=$(DEV_DESKTOP_HTTPS_DOMAIN) DEV_DESKTOP_HTTPS_ORIGIN=$(DEV_DESKTOP_HTTPS_ORIGIN) DEV_SIMULATOR_HTTPS_DOMAIN=$(DEV_SIMULATOR_HTTPS_DOMAIN) DEV_SIMULATOR_HTTPS_ORIGIN=$(DEV_SIMULATOR_HTTPS_ORIGIN) DEV_ICD_HTTPS_DOMAIN=$(DEV_ICD_HTTPS_DOMAIN) DEV_ICD_HTTPS_ORIGIN=$(DEV_ICD_HTTPS_ORIGIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) DEV_PROXY_CONFIG=$(DEV_PROXY_CONFIG) scripts/dev_https.sh

dev-icd: dev ## Alias for make dev; ICD-11 is now part of the default dev stack

dev-backend: db ## Start database + backend only
	SPICEDB_ENDPOINT=http://localhost:50051 SPICEDB_TOKEN=devsecret scripts/spicedb_local_schema.sh
	MAKEFLAGS= cargo run -p medbrains-server --bin medbrains-server

dev-backend-reload: db ## Backend only, RN-Metro style: press `r` to rebuild+restart, `q` to quit
	SPICEDB_ENDPOINT=http://localhost:50051 SPICEDB_TOKEN=devsecret scripts/dev_backend_reload.sh

dev-backend-watch: db ## Backend auto-rebuild+restart on save (incremental — only the changed crate recompiles + relink, thanks to the crate split)
	MAKEFLAGS= SPICEDB_ENDPOINT=http://localhost:50051 SPICEDB_TOKEN=devsecret \
	cargo watch --why --watch crates --exec 'run -p medbrains-server --bin medbrains-server'

dev-mail-mailboxes: ## Create a local Stalwart mailbox for every seeded user (via the app API)
	scripts/dev_mail_mailboxes.sh

dev-edge: ## Run medbrains-edge appliance locally for offline-mode testing
	@mkdir -p var/medbrains-edge/docs var/medbrains-edge/chain
	@cargo run -p medbrains-edge-app -- --config apps/edge/etc/medbrains-edge/dev.toml

dev-frontend: ## Start frontend only (assumes backend running)
	pnpm dev:web

dev-simulator-admin: ## Start simulator control UI on http://127.0.0.1:5180
	pnpm --filter @medbrains/simulator-admin dev

local-https-cert: ## Generate local HTTPS certificate for MedBrains local domains
	DEV_HTTPS_DOMAIN=$(DEV_HTTPS_DOMAIN) DEV_HTTPS_ALT_DOMAINS=$(DEV_HTTPS_ALT_DOMAINS) scripts/local_https_cert.sh

dev-proxy: local-https-cert ## Start local Pingora HTTPS proxy
	cargo build -p medbrains-proxy
	sudo -E target/debug/medbrains-proxy --config $(DEV_PROXY_CONFIG)

dev-https: dev ## Alias for make dev

dev-split: ## Start backend + web without local HTTPS proxy
	@docker compose up -d postgres 2>/dev/null
	@until docker compose exec -T postgres pg_isready -U medbrains > /dev/null 2>&1; do sleep 1; done
	@trap 'kill 0' EXIT; \
		MAKEFLAGS= cargo run -p medbrains-server --bin medbrains-server & \
		pnpm dev:web & \
		wait

sim-hospital: ## Stream synthetic OPD/lab/radiology/pharmacy traffic into local dev DB
	node scripts/simulators/hospital_stream.mjs --config $(SIM_CONFIG) --run-id $(SIM_RUN_ID) --patients $(SIM_PATIENTS) --rate $(SIM_RATE) --stream

sim-hospital-batch: ## Bulk-generate synthetic hospital traffic quickly
	node scripts/simulators/hospital_stream.mjs --config $(SIM_CONFIG) --run-id $(SIM_RUN_ID) --patients $(SIM_PATIENTS) --rate $(SIM_RATE) --batch

sim-hospital-clean: ## Remove only simulator records for SIM_RUN_ID
	node scripts/simulators/hospital_stream.mjs cleanup --config $(SIM_CONFIG) --run-id $(SIM_RUN_ID)

# ── Mobile / Camp Mode ───────────────────────────────────────

camp-mobile: mobile-camp-start-lan ## Start dedicated Camp mobile app (LAN QR, port 8083)

camp-mobile-ios: mobile-camp-ios ## Open dedicated Camp mobile app on iOS

camp-mobile-android: mobile-camp-android ## Open dedicated Camp mobile app on Android

mobile-camp-start: ## Start Camp mobile Expo Metro using pnpm
	pnpm --filter @medbrains/mobile-camp start

mobile-camp-start-lan: ## Start Camp mobile Expo Metro on LAN port 8083
	pnpm --filter @medbrains/mobile-camp start -- --host lan --port $(CAMP_MOBILE_PORT)

mobile-camp-ios: ## Build/open Camp mobile app using local HTTPS API base
	EXPO_PUBLIC_API_BASE=$(DEV_HTTPS_ORIGIN) pnpm --filter @medbrains/mobile-camp ios $(CAMP_IOS_RUN_ARGS)

mobile-camp-android: ## Build/open Camp mobile app on Android emulator/device
	EXPO_PUBLIC_API_BASE=$(DEV_HTTPS_ORIGIN) pnpm --filter @medbrains/mobile-camp android $(CAMP_ANDROID_RUN_ARGS)

mobile-camp-prebuild: ## Regenerate native projects for Camp mobile app
	pnpm --filter @medbrains/mobile-camp prebuild

mobile-camp-typecheck: ## Typecheck Camp mobile app
	pnpm --filter @medbrains/mobile-camp typecheck

mobile-staff-start: ## Start staff mobile Expo Metro using pnpm
	pnpm --filter @medbrains/mobile-staff start

mobile-staff-start-lan: ## Start staff mobile Expo Metro on LAN port 8082
	pnpm --filter @medbrains/mobile-staff start -- --host lan --port 8082

mobile-staff-ios: ## Build/open staff iOS app using local HTTPS API base
	EXPO_PUBLIC_API_BASE=$(DEV_HTTPS_ORIGIN) pnpm --filter @medbrains/mobile-staff ios $(IOS_RUN_ARGS)

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
	pnpm --filter @medbrains/mobile-staff android $(ANDROID_RUN_ARGS)

mobile-staff-prebuild: ## Regenerate native projects for staff mobile app
	pnpm --filter @medbrains/mobile-staff prebuild

mobile-staff-typecheck: ## Typecheck staff mobile app
	pnpm --filter @medbrains/mobile-staff typecheck

# ── Database ─────────────────────────────────────────────────

db: ## Start PostgreSQL + local SpiceDB
	docker compose up -d postgres spicedb gotenberg stalwart

db-icd: db icd-up ## Start PostgreSQL, SpiceDB, and local WHO ICD-API

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

icd-up: ## Start local WHO ICD-API container for ICD-11 search
	ICD_API_ACCEPT_LICENSE=true ICD_API_SAVE_ANALYTICS=$(ICD_API_SAVE_ANALYTICS) ICD_API_INCLUDE=$(ICD_API_INCLUDE) ICD_API_PORT=$(ICD_API_PORT) docker compose --profile icd up -d icd-api
	@echo "WHO ICD-API proxied URL: $(ICD_API_LOCAL_BASE_URL)"
	@echo "Set WHO_ICD_API_BASE_URL=$(ICD_API_LOCAL_BASE_URL) and WHO_ICD_AUTH_MODE=none for the backend."

icd-down: ## Stop local WHO ICD-API container
	docker compose --profile icd stop icd-api

icd-logs: ## Tail local WHO ICD-API logs
	docker compose --profile icd logs -f icd-api

icd-open: ## Print local WHO ICD-API browser/coding-tool URLs
	@echo "ICD-API Swagger:      $(DEV_ICD_HTTPS_ORIGIN)/swagger/index.html"
	@echo "ICD-11 Coding Tool:   $(DEV_ICD_HTTPS_ORIGIN)/ct"
	@echo "ICD-11 Browser:       $(DEV_ICD_HTTPS_ORIGIN)/browse"
	@echo "Backend base URL:     $(ICD_API_LOCAL_BASE_URL)"

# ── Build ────────────────────────────────────────────────────

build: build-backend build-frontend ## Build everything

build-backend: ## Build Rust backend (release)
	cargo build --release

build-frontend: ## Build web frontend
	pnpm build --filter=@medbrains/web

# ── Check / Lint ─────────────────────────────────────────────

check: check-backend check-frontend ## Run all checks

check-backend: ## Run cargo clippy with workspace lint policy
	cargo clippy --workspace

guard-sqlx-nonprod:
	@case "$(SQLX_DATABASE_URL)" in \
		*prod*|*production*|*hims.amh.org.in*|*amh.org.in*|*amazonaws.com*|*rds.amazonaws.com*) \
			echo "❌ Refusing SQLx metadata generation against a production-looking DATABASE_URL."; \
			echo "Use a migrated local/CI database. Example:"; \
			echo "  SQLX_DATABASE_URL=$(LOCAL_SQLX_DATABASE_URL) make prepare-sqlx"; \
			exit 1; \
			;; \
	esac

schema-db: guard-sqlx-nonprod ## Build a migrated schema DB (for prepare-sqlx, smoke tests, experiments)
	@scripts/schema_db.sh "$(SQLX_DATABASE_URL)"

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

check-circular: ## Fail on circular imports in the web app (prevents TDZ-class build crashes)
	pnpm --filter=@medbrains/web run check:circular

check-nav-drift: ## Verify navigation.ts in sync with access::SCREENS
	python3 scripts/check_nav_drift.py

check-ui-seam: ## Verify pages use @/components/ui (not raw Mantine Button/Badge)
	python3 scripts/check_ui_seam.py

check-raw-html: ## Verify no raw <button>/<input>/<select>/<textarea> in shipped JSX
	python3 scripts/check_raw_html.py

check-secrets: ## Verify no live credentials (AWS/PAT/keys) are tracked in git
	python3 scripts/check_secrets.py

check-all: check-permissions check-field-classes check-authz-collapse check-api check-ui-api check-types check-print-placeholders check-requirement-flags check-surface-drift check-role-templates check-tx-error-discard check-pg-enum-parity check-default-parity check-unbounded-reads check-permission-enforcement check-tenant-registry-reads check-pool-reads check-rls-only-writes check-circular check-nav-drift check-ui-seam check-raw-html check-secrets check-rls check-authz-posture check-tenant-leak check-runtime-sqlx check-migrations check-sharing check-audit check-tracing check-migration-headers check-region-pinning check-no-card-logging check-egress-allowlist check-encryption-at-rest check-redaction-masking ## Run all static checks (incl. RLS + sharing + audit + tracing + compliance)

# ── Audit / Authz Static Checks (RFC-INFRA-2026-002 Phase 0) ─

check-rls: ## Verify every tenant_id-bearing table has RLS coverage
	python3 ../scripts/check_rls.py

check-authz-posture: ## Verify authz fail-closed posture invariants
	python3 ../scripts/check_authz_posture.py

check-print-placeholders: ## Verify print endpoints don't invent rows when a query is empty
	python3 ../scripts/check_print_placeholders.py

check-requirement-flags: ## Verify requires_*/_required columns are actually enforced
	python3 ../scripts/check_requirement_flags.py

check-surface-drift: ## Verify the three deployment-surface lists agree
	python3 ../scripts/check_surface_drift.py

check-permissions: ## Verify the UI permission catalogue is generated from the Rust constants
	python3 scripts/generate_permissions_ts.py --check

check-authz-collapse: ## Ban collapsing an authz check's error into a denial
	python3 scripts/check_authz_collapse.py

authz-ledger: ## Report authorization conformance per module (4 axes)
	python3 scripts/authz_ledger.py

check-parent-id-scoping: ## Ban nested routes that discard their parent id
	python3 scripts/check_parent_id_scoping.py

check-relation-parity: ## Verify schema.zed and the Relation enum name the same relations
	python3 scripts/check_relation_parity.py

check-field-classes: ## Verify every redactable field declares a DataClass
	python3 scripts/check_field_classes.py

check-role-templates: ## Verify UI role templates match the seeded built-in roles
	python3 ../scripts/check_role_template_parity.py

check-tx-error-discard: ## Ban discarding a Result from a statement run inside a transaction
	python3 ../scripts/check_tx_error_discard.py

check-pg-enum-parity: ## Verify sqlx enum variants exist in the Postgres enum they name
	python3 ../scripts/check_pg_enum_parity.py

check-default-parity: ## Verify server-side unwrap_or defaults match the column DEFAULT
	python3 ../scripts/check_default_parity.py

check-unbounded-reads: ## Ban multi-row reads with neither a LIMIT nor a WHERE
	python3 ../scripts/check_unbounded_reads.py

check-permission-enforcement: ## Ban UI permission gates no handler enforces
	python3 ../scripts/check_permission_enforcement.py

check-tenant-registry-reads: ## Ban unowned `tenants` reads on a caller-supplied id
	python3 ../scripts/check_tenant_registry_reads.py

check-pool-reads: ## Ban unscoped off-transaction reads of RLS-policed tables
	python3 ../scripts/check_pool_reads_policed_tables.py

check-rls-only-writes: ## Ratchet writes keyed only on a caller-supplied id
	python3 ../scripts/check_rls_only_writes.py

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

check-cert-readiness: ## Map modules to ISO/SOC/HIPAA/HITRUST/NABH/ABDM/SaMD readiness evidence
	python3 ../scripts/check_cert_readiness.py

check-encryption-at-rest: ## Verify KMS-backed at-rest encryption evidence for SOC 2/ISO readiness
	python3 ../scripts/check_encryption_at_rest.py

check-redaction-masking: ## Verify privacy masking/redaction evidence beyond storage encryption
	python3 ../scripts/check_redaction_masking.py

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
deploy: e2e-full ## terraform apply for ENV/REGION combination after full E2E
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

desktop: desktop-dev ## Start desktop app against the running make dev stack

desktop-dev: ## Start desktop app against https://medbrains-desktop.localhost
	cd apps/desktop && pnpm install && MEDBRAINS_DESKTOP_DEV_URL=$(DEV_DESKTOP_HTTPS_ORIGIN) MEDBRAINS_DESKTOP_API_BASE=$(DEV_HTTPS_ORIGIN)/api MEDBRAINS_DESKTOP_START_ROUTE=$(ROUTE) pnpm tauri dev --config '{"build":{"beforeDevCommand":"","devUrl":"$(DEV_DESKTOP_HTTPS_ORIGIN)"}}'

desktop-reports-dev: ## Run desktop app directly on the reports command center
	cd apps/desktop && pnpm install && MEDBRAINS_DESKTOP_DEV_URL=$(DEV_DESKTOP_HTTPS_ORIGIN) MEDBRAINS_DESKTOP_API_BASE=$(DEV_HTTPS_ORIGIN)/api MEDBRAINS_DESKTOP_START_ROUTE=/reports pnpm tauri dev --config '{"build":{"beforeDevCommand":"","devUrl":"$(DEV_DESKTOP_HTTPS_ORIGIN)"}}'

desktop-build: ## Build desktop bundle for current OS
	cd apps/desktop && pnpm install && pnpm build

desktop-build-macos: ## Build .dmg (macOS host required)
	cd apps/desktop && pnpm install && pnpm build:macos

desktop-build-windows: ## Build .msi (Windows host required)
	cd apps/desktop && pnpm install && pnpm build:windows

desktop-build-linux: ## Build .AppImage + .deb + .rpm (Linux host required)
	cd apps/desktop && pnpm install && pnpm build:linux

# ── Smoke & E2E Tests ────────────────────────────────────

smoke-test: ## Run API smoke tests (needs running backend; no browser required)
	pnpm exec playwright test --config apps/web/playwright.config.ts --project=api

e2e-test: ## Run full E2E scenario tests (needs backend + frontend)
	pnpm exec playwright test --config apps/web/playwright.config.ts e2e/scenarios/

generate-smoke: ## Regenerate smoke test files from API contract
	python3 ../scripts/generate_smoke_tests.py

generate-e2e: ## Regenerate E2E skeleton files
	python3 ../scripts/generate_e2e_skeletons.py

sim-tool-shapes: ## Regenerate the simulator's contract-exact tool shapes (embedded via include_str!)
	python3 ../scripts/fetch_api_shape.py --emit-sim crates/medbrains-server/src/services/simulator/tool_shapes.json

collections: ## Generate importable OpenAPI + Postman collections (positive + negative) into test-collections/
	python3 ../scripts/generate_api_collection.py

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

e2e-rbac: ## Layer 6 — RBAC matrix (REST, multi-role)
	cd apps/web && pnpm exec playwright test --project=rbac

e2e-journeys: ## Layer 5 — End-to-end journeys (hybrid UI + REST)
	cd apps/web && pnpm exec playwright test --project=journeys

e2e-ui-aaa: ## Accessibility — WCAG 2 AAA UI journey gates
	cd apps/web && pnpm exec playwright test --project=accessibility

e2e-full: ## Full E2E gate: smoke + CRUD + forms + analytics + RBAC + journeys
	cd apps/web && pnpm exec playwright test --project=smoke --project=crud --project=forms --project=analytics --project=rbac --project=journeys

e2e-all: e2e-full ## Alias for the full E2E gate used before deploy

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

ship: ## Full CI gate (no deploy). Includes full E2E before release build.
	@echo "── 1/10 lint ─────────────────────────────"
	@$(MAKE) -s lint
	@echo "── 2/10 typecheck (frontend) ─────────────"
	@$(MAKE) -s check-frontend
	@echo "── 3/10 cargo check ──────────────────────"
	@$(MAKE) -s check-backend
	@echo "── 4/10 unit tests ───────────────────────"
	@$(MAKE) -s test-all
	@echo "── 5/10 API + UI + type contract ─────────"
	@$(MAKE) -s check-api
	@$(MAKE) -s check-ui-api
	@$(MAKE) -s check-types
	@$(MAKE) -s check-nav-drift
	@echo "── 6/10 RLS + audit + tenant + tracing + sqlx ──"
	@$(MAKE) -s check-rls
	@$(MAKE) -s check-tenant-leak
	@$(MAKE) -s check-runtime-sqlx
	@$(MAKE) -s check-audit
	@$(MAKE) -s check-tracing
	@echo "── 7/10 compliance (region/PCI/egress) ──"
	@$(MAKE) -s check-region-pinning
	@$(MAKE) -s check-no-card-logging
	@$(MAKE) -s check-egress-allowlist
	@$(MAKE) -s check-migration-headers
	@echo "── 8/10 screen audit (strict) ───────────"
	@python3 ../scripts/audit_screens.py --strict
	@echo "── 9/10 full E2E gate ───────────────────"
	@$(MAKE) -s e2e-full
	@echo "── 10/10 release build ──────────────────"
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

hotpush-ui: ## Build and deploy only the web SPA to the standalone host
	@set -euo pipefail; \
	if [ -f infra/.env ]; then set -a; . infra/.env; set +a; fi; \
	: "$${TF_VAR_ssh_private_key_path:?Set TF_VAR_ssh_private_key_path in infra/.env}"; \
	DOMAIN="$${TF_VAR_domain:-hims.amh.org.in}"; \
	SSH_ENDPOINT="$$(cd infra/terraform/envs/standalone/alagappa && terraform output -raw ssh_endpoint 2>/dev/null || true)"; \
	if [ -z "$$SSH_ENDPOINT" ] || [ "$$SSH_ENDPOINT" = "null" ]; then SSH_ENDPOINT="ubuntu@$$DOMAIN"; fi; \
	echo "── hotpush-ui: typecheck web ───────────"; \
	pnpm --filter @medbrains/web typecheck; \
	echo "── hotpush-ui: build web ───────────────"; \
	pnpm --filter @medbrains/web build; \
	echo "── hotpush-ui: upload SPA ──────────────"; \
	rsync -az --delete -e "ssh -i $${TF_VAR_ssh_private_key_path} -o StrictHostKeyChecking=no" apps/web/dist/ "$$SSH_ENDPOINT:/tmp/medbrains-web-hotpush/"; \
	ssh -i "$${TF_VAR_ssh_private_key_path}" -o StrictHostKeyChecking=no "$$SSH_ENDPOINT" "sudo rm -rf /var/www/medbrains && sudo mkdir -p /var/www/medbrains && sudo cp -r /tmp/medbrains-web-hotpush/. /var/www/medbrains/ && sudo chown -R medbrains:medbrains /var/www/medbrains && rm -rf /tmp/medbrains-web-hotpush"; \
	echo "── hotpush-ui: post-deploy smoke ───────"; \
	curl -sS --fail --max-time 10 "https://$$DOMAIN/api/health" > /dev/null; \
	echo "✅ hotpush-ui complete: https://$$DOMAIN"

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
	@echo "  check-egress-allowlist, check-migration-headers, e2e-full, build"

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
