//! News / health-advisory routes.
//!
//! - `GET /api/news`                     — list active articles, any auth'd role.
//! - `POST /api/admin/news`              — create (super_admin / hospital_admin).
//! - `PUT  /api/admin/news/{id}`         — update.
//! - `DELETE /api/admin/news/{id}`       — soft delete.
//! - `GET  /api/admin/news`              — list all (including inactive / expired).
//!
//! Active = `is_active = true AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use medbrains_core::news::NewsArticle;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::is_bypass_role,
    state::AppState,
};

fn require_admin(claims: &Claims) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

const VALID_CATEGORIES: &[&str] = &[
    "outbreak_alert",
    "weather_advisory",
    "festival_advisory",
    "internal_notice",
];
const VALID_SEVERITIES: &[&str] = &["info", "warning", "critical"];

fn validate_category(cat: &str) -> Result<(), AppError> {
    if VALID_CATEGORIES.contains(&cat) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "invalid category '{cat}' — expected one of {:?}",
            VALID_CATEGORIES
        )))
    }
}

fn validate_severity(sev: &str) -> Result<(), AppError> {
    if VALID_SEVERITIES.contains(&sev) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "invalid severity '{sev}' — expected one of {:?}",
            VALID_SEVERITIES
        )))
    }
}

// ── Public listing ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListNewsQuery {
    pub category: Option<String>,
    pub limit: Option<i64>,
}

pub async fn list_active(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListNewsQuery>,
) -> Result<Json<Vec<NewsArticle>>, AppError> {
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows: Vec<NewsArticle> = if let Some(cat) = q.category.as_deref() {
        sqlx::query_as(
            "SELECT * FROM news_articles \
             WHERE is_active = true AND deleted_at IS NULL \
               AND (expires_at IS NULL OR expires_at > NOW()) \
               AND category = $1 \
             ORDER BY published_at DESC LIMIT $2",
        )
        .bind(cat)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as(
            "SELECT * FROM news_articles \
             WHERE is_active = true AND deleted_at IS NULL \
               AND (expires_at IS NULL OR expires_at > NOW()) \
             ORDER BY published_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

// ── Admin CRUD ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateNewsRequest {
    pub category: String,
    pub title: String,
    pub body: Option<String>,
    pub severity: Option<String>,
    pub source: Option<String>,
    #[serde(default)]
    pub icd_boost: Vec<String>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNewsRequest {
    pub category: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub severity: Option<String>,
    pub source: Option<String>,
    pub icd_boost: Option<Vec<String>>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_active: Option<bool>,
}

pub async fn list_all(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NewsArticle>>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows: Vec<NewsArticle> = sqlx::query_as(
        "SELECT * FROM news_articles WHERE deleted_at IS NULL ORDER BY published_at DESC LIMIT 500",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_article(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNewsRequest>,
) -> Result<(StatusCode, Json<NewsArticle>), AppError> {
    require_admin(&claims)?;
    validate_category(&body.category)?;
    let severity = body.severity.as_deref().unwrap_or("info");
    validate_severity(severity)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row: NewsArticle = sqlx::query_as(
        "INSERT INTO news_articles \
         (tenant_id, category, title, body, severity, source, icd_boost, \
          is_active, published_at, expires_at, created_by) \
         VALUES ($1, $2, $3, COALESCE($4, ''), $5, $6, $7, \
                 COALESCE($8, true), COALESCE($9, NOW()), $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.category)
    .bind(&body.title)
    .bind(body.body.as_deref())
    .bind(severity)
    .bind(body.source.as_deref())
    .bind(&body.icd_boost)
    .bind(body.is_active)
    .bind(body.published_at)
    .bind(body.expires_at)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_article(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNewsRequest>,
) -> Result<Json<NewsArticle>, AppError> {
    require_admin(&claims)?;
    if let Some(cat) = body.category.as_deref() {
        validate_category(cat)?;
    }
    if let Some(sev) = body.severity.as_deref() {
        validate_severity(sev)?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row: NewsArticle = sqlx::query_as(
        "UPDATE news_articles SET \
            category = COALESCE($1, category), \
            title = COALESCE($2, title), \
            body = COALESCE($3, body), \
            severity = COALESCE($4, severity), \
            source = COALESCE($5, source), \
            icd_boost = COALESCE($6, icd_boost), \
            published_at = COALESCE($7, published_at), \
            expires_at = COALESCE($8, expires_at), \
            is_active = COALESCE($9, is_active), \
            updated_at = NOW() \
         WHERE id = $10 AND deleted_at IS NULL \
         RETURNING *",
    )
    .bind(body.category)
    .bind(body.title)
    .bind(body.body)
    .bind(body.severity)
    .bind(body.source)
    .bind(body.icd_boost)
    .bind(body.published_at)
    .bind(body.expires_at)
    .bind(body.is_active)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_article(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query(
        "UPDATE news_articles SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
