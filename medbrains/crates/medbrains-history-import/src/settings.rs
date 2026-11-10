//! The go-live cut-over: the moment imported history must end before.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::tx_for;

const SETTING_CATEGORY: &str = "history_import";
const SETTING_KEY: &str = "go_live_at";

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct Settings {
    pub(crate) go_live_at: Option<DateTime<Utc>>,
}

pub(crate) async fn load_go_live(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
) -> Result<Option<DateTime<Utc>>, AppError> {
    let value: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = $2 AND key = $3",
    )
    .bind(tenant)
    .bind(SETTING_CATEGORY)
    .bind(SETTING_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value
        .and_then(|v| {
            v.as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        })
        .map(|d| d.with_timezone(&Utc)))
}

/// `GET /api/history-import/settings`
pub(crate) async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Settings>, AppError> {
    require_permission(&claims, permissions::admin::history_import::VIEW)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let go_live_at = load_go_live(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(Settings { go_live_at }))
}

/// `PUT /api/history-import/settings` — the go-live moment history must end before.
pub(crate) async fn put_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<Settings>,
) -> Result<Json<Settings>, AppError> {
    require_permission(&claims, permissions::admin::history_import::RUN)?;
    let go_live = body
        .go_live_at
        .ok_or_else(|| AppError::BadRequest("Give the go-live date and time".to_owned()))?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let latest: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT max(occurred_at) FROM history_import_records WHERE tenant_id = $1 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if let Some(latest) = latest.filter(|l| *l >= go_live) {
        return Err(AppError::BadRequest(format!(
            "Imported history already runs to {latest}; go-live cannot be moved before it"
        )));
    }
    let old = load_go_live(&mut tx, claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(claims.tenant_id)
    .bind(SETTING_CATEGORY)
    .bind(SETTING_KEY)
    .bind(json!(go_live.to_rfc3339()))
    .execute(&mut *tx)
    .await?;
    AuditLogger::log(
        &mut tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "history_import.go_live_set",
            entity_type: "tenant_settings",
            entity_id: None,
            old_values: Some(&json!({ "go_live_at": old })),
            new_values: Some(&json!({ "go_live_at": go_live })),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(Settings {
        go_live_at: Some(go_live),
    }))
}
