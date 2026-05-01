//! DLT template registry — India SMS compliance.
//!
//! Telcos drop any commercial SMS that doesn't match a pre-registered
//! DLT template (TRAI TCCCPR, 2018). This module surfaces the registry
//! to operators and provides the lookup the SMS handler uses at send
//! time.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DltTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub template_id: String,
    pub template_name: String,
    pub category: String,
    pub sender_id: String,
    pub entity_id: String,
    pub body_pattern: String,
    pub variable_count: i32,
    pub scope: Option<String>,
    pub language: String,
    pub is_active: bool,
    pub registered_at: Option<NaiveDate>,
    pub expires_at: Option<NaiveDate>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDltTemplateRequest {
    pub template_id: String,
    pub template_name: String,
    pub category: String,
    pub sender_id: String,
    pub entity_id: String,
    pub body_pattern: String,
    pub variable_count: Option<i32>,
    pub scope: Option<String>,
    pub language: Option<String>,
    pub registered_at: Option<NaiveDate>,
    pub expires_at: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDltTemplateRequest {
    pub template_name: Option<String>,
    pub body_pattern: Option<String>,
    pub variable_count: Option<i32>,
    pub scope: Option<String>,
    pub language: Option<String>,
    pub is_active: Option<bool>,
    pub expires_at: Option<NaiveDate>,
    pub notes: Option<String>,
}

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DltTemplate>>, AppError> {
    require_permission(&claims, permissions::communications::dlt::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DltTemplate>(
        "SELECT * FROM dlt_templates WHERE tenant_id = $1 ORDER BY scope, language, template_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDltTemplateRequest>,
) -> Result<Json<DltTemplate>, AppError> {
    require_permission(&claims, permissions::communications::dlt::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DltTemplate>(
        "INSERT INTO dlt_templates \
         (tenant_id, template_id, template_name, category, sender_id, entity_id, \
          body_pattern, variable_count, scope, language, registered_at, expires_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.template_id)
    .bind(&body.template_name)
    .bind(&body.category)
    .bind(&body.sender_id)
    .bind(&body.entity_id)
    .bind(&body.body_pattern)
    .bind(body.variable_count.unwrap_or(0))
    .bind(body.scope.as_deref())
    .bind(body.language.as_deref().unwrap_or("en"))
    .bind(body.registered_at)
    .bind(body.expires_at)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDltTemplateRequest>,
) -> Result<Json<DltTemplate>, AppError> {
    require_permission(&claims, permissions::communications::dlt::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DltTemplate>(
        "UPDATE dlt_templates SET \
            template_name = COALESCE($1, template_name), \
            body_pattern = COALESCE($2, body_pattern), \
            variable_count = COALESCE($3, variable_count), \
            scope = COALESCE($4, scope), \
            language = COALESCE($5, language), \
            is_active = COALESCE($6, is_active), \
            expires_at = COALESCE($7, expires_at), \
            notes = COALESCE($8, notes), \
            updated_at = now() \
         WHERE id = $9 AND tenant_id = $10 \
         RETURNING *",
    )
    .bind(body.template_name)
    .bind(body.body_pattern)
    .bind(body.variable_count)
    .bind(body.scope)
    .bind(body.language)
    .bind(body.is_active)
    .bind(body.expires_at)
    .bind(body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::communications::dlt::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let n = sqlx::query("DELETE FROM dlt_templates WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    tx.commit().await?;

    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DltLookupResult {
    pub template_id: String,
    pub body_pattern: String,
    pub sender_id: String,
    pub entity_id: String,
}

/// Helper used by the SMS handler. Pure DB lookup — no permission
/// check (handler-internal). Returns the active template that matches
/// `tenant_id × scope × language` (language falls back to 'en' if not
/// found).
pub async fn lookup_template_for_send(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
    scope: &str,
    language: Option<&str>,
) -> Option<DltLookupResult> {
    let lang = language.unwrap_or("en");
    let row: Option<DltLookupResult> = sqlx::query_as(
        "SELECT template_id, body_pattern, sender_id, entity_id \
         FROM dlt_templates \
         WHERE tenant_id = $1 AND scope = $2 AND is_active \
           AND (expires_at IS NULL OR expires_at > CURRENT_DATE) \
         ORDER BY (language = $3) DESC, language ASC \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(scope)
    .bind(lang)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    row
}
