use axum::{Extension, Json, extract::State};
use serde_json::Value;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::is_bypass_role},
    state::AppState,
};

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn seed_canonical_fixtures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    if !is_bypass_role(&claims) || !e2e_seed_enabled() {
        return Err(AppError::Forbidden);
    }

    medbrains_seed::seed_canonical_fixtures_for_tenant(&state.db, claims.tenant_id)
        .await
        .map_err(|err| AppError::Internal(format!("canonical fixture seed failed: {err}")))?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

fn e2e_seed_enabled() -> bool {
    cfg!(debug_assertions)
        || std::env::var("MEDBRAINS_ENABLE_E2E_SEED")
            .map(|value| {
                matches!(
                    value.to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(false)
}

/// The hospital one Playwright worker runs in, and its first administrator.
#[derive(serde::Deserialize)]
pub struct E2eTenantRequest {
    code: String,
    name: String,
    admin_username: String,
    admin_password: String,
}

// The password is never printed.
impl std::fmt::Debug for E2eTenantRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("E2eTenantRequest")
            .field("code", &self.code)
            .field("admin_username", &self.admin_username)
            .finish_non_exhaustive()
    }
}

/// Create (or refresh) a hospital for one E2E worker, seeded like the first one.
///
/// The suite runs several Playwright workers at once; sharing one hospital made tests depend
/// on each other's rows and settings, so each worker gets its own. Idempotent by `code`: a
/// rerun reuses the hospital, resets its administrator's password and re-applies the seed.
/// Debug builds (or `MEDBRAINS_ENABLE_E2E_SEED`) and bypass roles only, like the fixture seed.
/// The id is derived from `code`, so a code another hospital already uses is refused.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id, code = %body.code))]
pub async fn provision_e2e_tenant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<E2eTenantRequest>,
) -> Result<Json<Value>, AppError> {
    if !is_bypass_role(&claims) || !e2e_seed_enabled() {
        return Err(AppError::Forbidden);
    }
    let hash = argon2::PasswordHasher::hash_password(
        &argon2::Argon2::default(),
        body.admin_password.as_bytes(),
    )
    .map_err(|err| AppError::Internal(format!("password hash error: {err}")))?
    .to_string();
    let tenant_id = upsert_e2e_tenant(&state, &body, &hash).await?;
    medbrains_seed::seed_tenant(&state.db, tenant_id)
        .await
        .map_err(|err| AppError::Internal(format!("tenant seed failed: {err}")))?;
    Ok(Json(serde_json::json!({ "tenant_id": tenant_id })))
}

/// Seeds the E2E hospitals' ids: each id is derived from its code, so a rerun finds its hospital.
const E2E_TENANT_NAMESPACE: uuid::Uuid =
    uuid::Uuid::from_u128(0x6d62_6532_6574_656e_616e_7473_0000_0001);

/// The worker hospital's id, creating it and upserting its `super_admin` in one unit of work.
async fn upsert_e2e_tenant(
    state: &AppState,
    body: &E2eTenantRequest,
    password_hash: &str,
) -> Result<uuid::Uuid, AppError> {
    let tenant_id = uuid::Uuid::new_v5(&E2E_TENANT_NAMESPACE, body.code.as_bytes());
    let actor = medbrains_kernel::Actor::system(tenant_id);
    medbrains_kernel::work(&state.db, actor, async |tx: &mut medbrains_kernel::Tx| {
        // allow-raw-sql: debug-only E2E provisioning, in a kernel unit of work
        sqlx::query(
            "INSERT INTO tenants (id, code, name, hospital_type, config) \
             VALUES ($1, $2, $3, 'medical_college', '{}') ON CONFLICT (id) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(&body.code)
        .bind(&body.name)
        .execute(&mut **tx)
        .await?;
        // allow-raw-sql: the hospital's first administrator, as the boot seed inserts it
        sqlx::query(
            "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
             VALUES ($1, $2, $2 || '@e2e.medbrains.localhost', $3, 'E2E Administrator', 'super_admin') \
             ON CONFLICT (tenant_id, username) DO UPDATE \
             SET password_hash = EXCLUDED.password_hash, is_active = true",
        )
        .bind(tenant_id)
        .bind(&body.admin_username)
        .bind(password_hash)
        .execute(&mut **tx)
        .await?;
        Ok::<_, AppError>(())
    })
    .await?;
    Ok(tenant_id)
}

/// The E2E seed routes, merged into the authenticated API by `build_router`.
pub fn e2e_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/debug/e2e/canonical-fixtures",
            axum::routing::post(seed_canonical_fixtures),
        )
        .route(
            "/api/debug/e2e/tenant",
            axum::routing::post(provision_e2e_tenant),
        )
}
