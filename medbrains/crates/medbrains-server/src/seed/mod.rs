mod bed_types;
mod camp_fixtures;
mod canonical_fixtures;
mod charge_master;
mod ckb;
mod default_dashboard;
mod demo_patients;
mod departments;
mod device_integration_fixtures;
mod insurance_providers;
mod lab_catalog;
mod locations;
mod module_config;
mod payment_methods;
mod pharmacy_catalog;
mod procedure_catalog;
mod radiology_fixtures;
mod role_dashboards;
// Screen builder removed (see migration 123). seed/screens.rs retained as
// dead code for git history but not compiled.
// mod screens;
mod services;
mod store_catalog;
mod tax_categories;

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use medbrains_core::access::{BUILT_IN_ROLES, DEFAULT_GROUPS};
#[allow(unused_imports)]
use medbrains_core::permissions;
use sqlx::PgPool;

pub(crate) async fn seed_canonical_fixtures_for_tenant(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    canonical_fixtures::seed_canonical_fixtures(pool, tenant_id).await
}

/// Insert DEFAULT tenant + `super_admin` user + built-in roles + operational
/// master data if they don't already exist.
pub async fn run_seed(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Check if default tenant exists
    let tenant_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tenants WHERE code = 'DEFAULT')")
            .fetch_one(pool)
            .await?;

    let tenant_id: uuid::Uuid;

    if tenant_exists {
        tracing::debug!("Default tenant already exists, skipping tenant seed");
        let tid: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM tenants WHERE code = 'DEFAULT'")
                .fetch_optional(pool)
                .await?;
        tenant_id = tid.ok_or("DEFAULT tenant row missing after EXISTS check")?;
    } else {
        tracing::info!("Seeding default tenant and super_admin user");

        tenant_id = uuid::Uuid::new_v4();

        // Insert default tenant
        sqlx::query(
            "INSERT INTO tenants (id, code, name, hospital_type, config) \
             VALUES ($1, 'DEFAULT', 'Alagappa Medical College & Hospital', \
             'medical_college', '{}')",
        )
        .bind(tenant_id)
        .execute(pool)
        .await?;

        // Admin password: explicit via env, or dev-only default. Production
        // refuses the default so admin/admin123 can never reach a real tenant.
        let admin_password = match std::env::var("MEDBRAINS_SEED_ADMIN_PASSWORD") {
            Ok(value) if !value.trim().is_empty() => value,
            _ if production_env() => {
                return Err(
                    "MEDBRAINS_SEED_ADMIN_PASSWORD must be set when MEDBRAINS_ENV=production — \
                     refusing to seed the default admin credential"
                        .into(),
                );
            }
            _ => "admin123".to_owned(),
        };

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(admin_password.as_bytes(), &salt)
            .map_err(|e| format!("password hash error: {e}"))?
            .to_string();

        // Insert super_admin user (need to set tenant context first for RLS)
        let mut tx = pool.begin().await?;

        sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
            .bind(tenant_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, \
             must_change_password) \
             VALUES ($1, 'admin', 'admin@medbrains.local', $2, \
             'System Administrator', 'super_admin', $3)",
        )
        .bind(tenant_id)
        .bind(&password_hash)
        .bind(production_env())
        .execute(&mut *tx)
        .await?;

        // Seed default sequences
        sqlx::query(
            "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) VALUES \
             ($1, 'UHID', 'ACMS-2026-', 0, 5), \
             ($1, 'INVOICE', 'INV-', 0, 6), \
             ($1, 'OPD_TOKEN', 'T', 0, 3), \
             ($1, 'INDENT', 'IND-', 0, 6), \
             ($1, 'ADVANCE', 'ADV-', 0, 6), \
             ($1, 'CORPORATE_INVOICE', 'CINV-', 0, 6)",
        )
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        tracing::info!(%tenant_id, "Seed complete — admin user created");
    }

    // Idempotent seeds — always run (ON CONFLICT DO NOTHING / DO UPDATE)
    seed_built_in_roles(pool, tenant_id).await?;
    seed_default_groups(pool, tenant_id).await?;
    ckb::seed_diagnosis_reference(pool).await?; // global reference (no tenant)
    ckb::seed_drug_reference(pool).await?; // global CDS drug reference
    ckb::seed_lab_reference(pool).await?; // global CDS lab reference
    ckb::seed_ingredients(pool).await?; // global ingredient model
    ckb::seed_state_formulary(pool).await?; // global per-state free-drug schemes
    departments::seed_departments(pool, tenant_id).await?;
    lab_catalog::seed_lab_catalog(pool, tenant_id).await?;
    pharmacy_catalog::seed_pharmacy_catalog(pool, tenant_id).await?;
    procedure_catalog::seed_procedure_catalog(pool, tenant_id).await?;
    charge_master::seed_charge_master(pool, tenant_id).await?;
    bed_types::seed_bed_types(pool, tenant_id).await?;
    tax_categories::seed_tax_categories(pool, tenant_id).await?;
    payment_methods::seed_payment_methods(pool, tenant_id).await?;
    services::seed_services(pool, tenant_id).await?;
    module_config::seed_module_config(pool, tenant_id).await?;
    store_catalog::seed_store_catalog(pool, tenant_id).await?;
    insurance_providers::seed_insurance_providers(pool, tenant_id).await?;
    locations::seed_locations(pool, tenant_id).await?;
    default_dashboard::seed_default_dashboard(pool, tenant_id).await?;
    role_dashboards::seed_role_dashboards(pool, tenant_id).await?;

    if demo_fixture_seed_enabled() && production_env() {
        tracing::warn!(
            "MEDBRAINS_SEED_DEMO_DATA ignored — demo fixtures are never seeded in production"
        );
    }

    if demo_fixture_seed_enabled() && !production_env() {
        // Demo patients + OPD visits for explicit demo/test environments.
        demo_patients::seed_demo_patients(pool, tenant_id).await?;
        device_integration_fixtures::seed_device_integration_fixtures(pool, tenant_id).await?;
        radiology_fixtures::seed_radiology_fixtures(pool, tenant_id).await?;
        camp_fixtures::seed_rural_camp_fixtures(pool, tenant_id).await?;

        // Canonical fixture rows with hardcoded UUIDs — must run AFTER
        // demo_patients so the dept + doctor + admin user FK refs exist.
        // See `apps/web/e2e/helpers/canonical-seed.ts` for the matching
        // UUID map used by smoke + Vitest tests.
        canonical_fixtures::seed_canonical_fixtures(pool, tenant_id).await?;
    } else {
        tracing::info!(
            "Demo fixture seed disabled. Set MEDBRAINS_SEED_DEMO_DATA=true for explicit demo/test fixtures."
        );
    }

    // Screen definitions removed — screen builder eradicated
    // (see migration 123_drop_builders.sql + RFC nuke-builders).
    let _ = pool;

    Ok(())
}

fn production_env() -> bool {
    std::env::var("MEDBRAINS_ENV")
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

fn demo_fixture_seed_enabled() -> bool {
    std::env::var("MEDBRAINS_SEED_DEMO_DATA")
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

/// Insert built-in system roles into the `roles` table.
/// Idempotent — updates roles that already exist via `ON CONFLICT DO UPDATE`.
async fn seed_built_in_roles(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for role in BUILT_IN_ROLES {
        let perms_json = serde_json::Value::Array(
            role.permissions
                .iter()
                .map(|s| serde_json::Value::String((*s).to_string()))
                .collect(),
        );

        sqlx::query(
            "INSERT INTO roles (tenant_id, code, name, description, permissions, is_system) \
             VALUES ($1, $2, $3, $4, $5, true) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET \
               permissions = EXCLUDED.permissions, \
               name = EXCLUDED.name, \
               description = EXCLUDED.description",
        )
        .bind(tenant_id)
        .bind(role.code)
        .bind(role.name)
        .bind(role.description)
        .bind(&perms_json)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    tracing::info!("Seeded {} built-in roles", BUILT_IN_ROLES.len());

    Ok(())
}
/// Insert the 8 default access_groups for the tenant. Idempotent —
/// re-running just refreshes name/description, never wipes member rows.
async fn seed_default_groups(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for group in DEFAULT_GROUPS {
        sqlx::query(
            "INSERT INTO access_groups (tenant_id, code, name, description, is_active) \
             VALUES ($1, $2, $3, $4, true) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET \
               name = EXCLUDED.name, \
               description = EXCLUDED.description, \
               updated_at = now()",
        )
        .bind(tenant_id)
        .bind(group.code)
        .bind(group.name)
        .bind(group.description)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    tracing::info!("Seeded {} default access groups", DEFAULT_GROUPS.len());

    Ok(())
}
