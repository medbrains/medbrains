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
mod widget_catalog;
// Screen builder removed (see migration 123). seed/screens.rs retained as
// dead code for git history but not compiled.
// mod screens;
mod services;
mod stations;
mod store_catalog;
mod tax_categories;

use argon2::{Argon2, PasswordHasher};
use medbrains_core::access::{BUILT_IN_ROLES, DEFAULT_GROUPS};
#[allow(unused_imports)]
use medbrains_core::permissions;
use sqlx::PgPool;

/// Dev/local convenience: give the default tenant a custom domain and a
/// starter email config (pointing at a local Stalwart) so the Domains &
/// Email setup screen is populated out of the box instead of showing
/// placeholders. Idempotent and non-destructive — never overwrites a
/// domain or email config that's already set. Never runs in production.
async fn seed_dev_email_defaults(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    // Also rewrite the legacy `medbrains.local` value (mDNS, never resolved
    // and not hosted by the dev Stalwart) so an existing dev tenant is fixed,
    // not just a fresh one.
    sqlx::query(
        "UPDATE tenants SET custom_domain = 'medbrains.localhost' \
         WHERE id = $1 \
           AND (custom_domain IS NULL OR custom_domain = '' OR custom_domain = 'medbrains.local')",
    )
    .bind(tenant_id)
    .execute(pool)
    .await?;

    let config = serde_json::json!({
        "provider": "stalwart",
        "smtp_host": "mail.medbrains.localhost",
        "smtp_port": "587",
        "smtp_tls": "starttls",
        "from_address": "noreply@medbrains.localhost",
        "from_name": "MedBrains",
        "smtp_username": "noreply@medbrains.localhost",
    });
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // Refresh on conflict (dev-only seed): an existing tenant may still carry
    // the old localhost/`.local` config, which would silently send nowhere.
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'email', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value WHERE tenant_settings.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&config)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(())
}

pub async fn seed_canonical_fixtures_for_tenant(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    canonical_fixtures::seed_canonical_fixtures(pool, tenant_id).await
}

/// Advisory lock key (`"MBSEED"` in ASCII) that serialises seeding.
const SEED_LOCK: i64 = 0x4d42_5345_4544;

/// Seed the database, one server at a time.
///
/// Seeding checks for rows and then inserts them, so two servers starting
/// together on an empty database both try to create the first hospital and one
/// exits on a duplicate key. The lock lives in a transaction of its own and is
/// released whichever way this returns, including with an error.
pub async fn run_seed(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let _lock = medbrains_db::pool::hold_advisory_lock(pool, SEED_LOCK).await?;
    seed_everything(pool).await
}

/// Insert DEFAULT tenant + `super_admin` user + built-in roles + operational
/// master data if they don't already exist.
async fn seed_everything(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // The first hospital is created only on an empty database, and found by
    // age afterwards — never by its code. Keyed on `code = 'DEFAULT'`, renaming
    // a live hospital's code (so staff can type something meaningful at sign-in)
    // made the next start seed a second hospital and a second super admin.
    let existing: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at, id LIMIT 1")
            .fetch_optional(pool)
            .await?;

    let tenant_id: uuid::Uuid;

    if let Some(id) = existing {
        tracing::debug!(%id, "a hospital already exists, skipping tenant seed");
        tenant_id = id;
    } else {
        tracing::info!("Seeding default tenant and super_admin user");

        tenant_id = uuid::Uuid::new_v4();

        let password_hash = first_password_hash()?;

        // One transaction: a power cut here must not leave a hospital with no administrator,
        // because the next start would see the hospital and never create one.
        let mut tx = pool.begin().await?;

        // Insert default tenant
        sqlx::query(
            "INSERT INTO tenants (id, code, name, hospital_type, config) \
             VALUES ($1, 'DEFAULT', $2, 'medical_college', '{}')",
        )
        .bind(tenant_id)
        .bind(env_or("MEDBRAINS_SEED_HOSPITAL_NAME", "My Hospital"))
        .execute(&mut *tx)
        .await?;

        // The super_admin user needs the tenant context first, for RLS.
        sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
            .bind(tenant_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, \
             must_change_password) \
             VALUES ($1, $4, 'admin@medbrains.localhost', $2, \
             'System Administrator', 'super_admin', $3)",
        )
        .bind(tenant_id)
        .bind(&password_hash)
        .bind(must_change_first_password(
            production_env(),
            std::env::var("MEDBRAINS_SEED_ADMIN_PASSWORD_CHOSEN").is_ok_and(|v| v == "true"),
        ))
        .bind(env_or("MEDBRAINS_SEED_ADMIN_USERNAME", "admin"))
        .execute(&mut *tx)
        .await?;

        // The tenants trigger (migration 1214) has already created the default
        // sequences; this gives the seeded hospital its own prefixes.
        sqlx::query(
            "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) VALUES \
             ($1, 'UHID', 'MB-', 0, 5), \
             ($1, 'INVOICE', 'INV-', 0, 6), \
             ($1, 'OPD_TOKEN', 'T', 0, 3), \
             ($1, 'INDENT', 'IND-', 0, 6), \
             ($1, 'ADVANCE', 'ADV-', 0, 6), \
             ($1, 'CORPORATE_INVOICE', 'CINV-', 0, 6) \
             ON CONFLICT (tenant_id, seq_type) DO UPDATE \
             SET prefix = EXCLUDED.prefix, pad_width = EXCLUDED.pad_width",
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
    widget_catalog::sync_widget_catalog(pool).await?; // global widget catalogue (code registry)
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
    stations::seed_stations(pool, tenant_id).await?;
    default_dashboard::seed_default_dashboard(pool, tenant_id).await?;
    role_dashboards::seed_role_dashboards(pool, tenant_id).await?;

    if !production_env() {
        seed_dev_email_defaults(pool, tenant_id).await?;
    }

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

/// The first administrator's password hash. An OS machine's setup gives a hash, so the password
/// itself never reaches the disk. Otherwise it is explicit via env, or a dev-only default:
/// production refuses the default so admin/admin123 can never reach a real tenant.
fn first_password_hash() -> Result<String, Box<dyn std::error::Error>> {
    if let Ok(hash) = std::env::var("MEDBRAINS_SEED_ADMIN_PASSWORD_HASH")
        && !hash.trim().is_empty()
    {
        return Ok(hash);
    }
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
    Ok(Argon2::default()
        .hash_password(admin_password.as_bytes())
        .map_err(|e| format!("password hash error: {e}"))?
        .to_string())
}

/// A setting from the environment, or `default` when unset or blank.
fn env_or(key: &str, default: &str) -> String {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default.to_owned())
}

/// A production password must be changed at first use unless the person typed it themselves
/// at the machine's own setup, in which case nobody else has ever seen it.
const fn must_change_first_password(production: bool, chosen: bool) -> bool {
    production && !chosen
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
/// Re-apply the code-owned role definitions to every live tenant.
///
/// Permissions themselves are not database rows — they are 893 constants in
/// `medbrains_core::permissions`, referenced by `BUILT_IN_ROLES`, so the
/// compiler already refuses a role that names one that does not exist. What
/// *is* in the database is the role-to-permission mapping, and that has to be
/// rebuildable from code after a flush, a restore, or simply adding a
/// permission.
///
/// It ran for the `DEFAULT` tenant only. A hospital created through the
/// onboarding wizard therefore had no `roles` rows at all — and
/// `resolve_permissions` reads `SELECT permissions FROM roles WHERE tenant_id
/// = $1 AND code = $2`, so every non-bypass user at that hospital resolved to
/// zero permissions. Only `super_admin` and `hospital_admin` worked, because
/// they skip the lookup entirely.
///
/// Idempotent: `ON CONFLICT DO UPDATE` on `(tenant_id, code)`, and it touches
/// only `is_system` roles, so custom roles an administrator built are left
/// exactly as they are.
///
/// # Errors
/// Propagates database errors; a tenant that fails stops the run rather than
/// leaving the rest half-applied silently.
pub async fn reconcile_built_in_roles(pool: &PgPool) -> Result<usize, Box<dyn std::error::Error>> {
    let tenants: Vec<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM tenants WHERE deleted_at IS NULL AND is_active = true")
            .fetch_all(pool)
            .await?;

    for tenant_id in &tenants {
        seed_built_in_roles(pool, *tenant_id).await?;
    }

    tracing::info!(
        tenants = tenants.len(),
        roles = BUILT_IN_ROLES.len(),
        "reconciled built-in roles from code",
    );
    Ok(tenants.len())
}

pub(crate) async fn seed_built_in_roles(
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
             ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO UPDATE SET \
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
               updated_at = now() WHERE access_groups.deleted_at IS NULL",
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

#[cfg(test)]
mod first_password_tests {
    use super::must_change_first_password;

    /// A generated production password must never skip the change; a chosen one never asks.
    #[test]
    fn only_a_password_the_person_chose_skips_the_forced_change() {
        assert!(must_change_first_password(true, false));
        assert!(!must_change_first_password(true, true));
        assert!(!must_change_first_password(false, false));
    }
}
