//! App manifest — a device/app instance's resolved identity on boot: form-factor (`app_variant`),
//! user/role, and location (which instance of the surface it serves). One codebase per form-factor
//! reads this to know which location/role it is, so many instances share one build. Mirrors the
//! `access::get_manifest` pattern.
//!
//! Resolution: a **paired device** passes its own `device_id` (returned at pairing) → its stored
//! variant + location. A **user-login app** (mobile/desktop) passes its build's `variant` code →
//! location from the user's primary department. Everything is tenant-scoped from the caller's JWT.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

#[derive(Debug, Deserialize)]
pub struct ManifestQuery {
    pub device_id: Option<Uuid>,
    pub variant: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ManifestDevice {
    pub id: Uuid,
    pub label: String,
    pub paired_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ManifestLocation {
    pub department_id: Option<Uuid>,
    pub label: Option<String>,
    pub scope: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct AppManifest {
    pub tenant_id: Uuid,
    pub app_variant: Option<String>,
    pub role: String,
    pub user_id: Uuid,
    pub device: Option<ManifestDevice>,
    pub location: ManifestLocation,
    pub config: serde_json::Value,
}

async fn resolve_dept_label(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    department_id: Option<Uuid>,
) -> Result<Option<String>, AppError> {
    let Some(dept) = department_id else {
        return Ok(None);
    };
    let name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1 AND tenant_id = $2",
    )
    .bind(dept)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(name)
}

/// `GET /api/app/manifest?device_id=&variant=` — the caller's resolved app-instance identity.
pub async fn get_app_manifest(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ManifestQuery>,
) -> Result<Json<AppManifest>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Paired device → its stored variant + location (tenant-scoped, non-revoked).
    if let Some(device_id) = q.device_id {
        type DeviceRow = (
            String,
            String,
            Option<Uuid>,
            Option<String>,
            serde_json::Value,
            chrono::DateTime<chrono::Utc>,
        );
        let row: Option<DeviceRow> = sqlx::query_as(
            "SELECT app_variant, label, department_id, location_label, location_scope, paired_at \
             FROM paired_devices WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
        )
        .bind(device_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        let Some((app_variant, label, department_id, location_label, location_scope, paired_at)) =
            row
        else {
            return Err(AppError::NotFound);
        };
        let dept_label = resolve_dept_label(&mut tx, &claims.tenant_id, department_id).await?;
        tx.commit().await?;
        return Ok(Json(AppManifest {
            tenant_id: claims.tenant_id,
            app_variant: Some(app_variant),
            role: claims.role,
            user_id: claims.sub,
            device: Some(ManifestDevice { id: device_id, label, paired_at }),
            location: ManifestLocation {
                department_id,
                label: location_label.or(dept_label),
                scope: location_scope,
            },
            config: serde_json::json!({}),
        }));
    }

    // User-login app → variant from the build hint; location from the user's primary department.
    let department_id = claims.department_ids.first().copied();
    let dept_label = resolve_dept_label(&mut tx, &claims.tenant_id, department_id).await?;
    tx.commit().await?;
    Ok(Json(AppManifest {
        tenant_id: claims.tenant_id,
        app_variant: q.variant,
        role: claims.role,
        user_id: claims.sub,
        device: None,
        location: ManifestLocation {
            department_id,
            label: dept_label,
            scope: serde_json::json!({}),
        },
        config: serde_json::json!({}),
    }))
}
