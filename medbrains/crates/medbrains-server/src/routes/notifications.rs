//! In-app notification centre — per-user, tenant-scoped feed with read state.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub category: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub action_url: Option<String>,
    pub is_read: bool,
    pub read_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    pub unread: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub notifications: Vec<Notification>,
    pub unread_count: i64,
}

#[derive(Debug, Serialize)]
pub struct UnreadCountResponse {
    pub unread_count: i64,
}

const SELECT_COLS: &str = "id, kind, title, body, category, entity_type, entity_id, \
     action_url, is_read, read_at, created_at";

/// GET /api/notifications — the caller's feed (optionally unread-only).
pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListNotificationsQuery>,
) -> Result<Json<NotificationListResponse>, AppError> {
    let limit = params.limit.unwrap_or(30).clamp(1, 100);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sql = if params.unread.unwrap_or(false) {
        format!(
            "SELECT {SELECT_COLS} FROM notifications \
             WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC LIMIT $2"
        )
    } else {
        format!(
            "SELECT {SELECT_COLS} FROM notifications \
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
        )
    };
    let notifications = sqlx::query_as::<_, Notification>(&sql)
        .bind(claims.sub)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?;

    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(NotificationListResponse { notifications, unread_count }))
}

/// GET /api/notifications/unread-count
pub async fn notifications_unread_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

/// POST /api/notifications/{id}/read
pub async fn mark_notification_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    let unread_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false")
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count }))
}

/// POST /api/notifications/read-all
pub async fn mark_all_notifications_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE notifications SET is_read = true, read_at = now() \
         WHERE user_id = $1 AND is_read = false",
    )
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(UnreadCountResponse { unread_count: 0 }))
}

// ── Producer helper ──────────────────────────────────────────────
/// A notification to insert for a recipient user. Use via `create_notification`.
pub struct NewNotification<'a> {
    pub user_id: Uuid,
    pub kind: &'a str,
    pub title: &'a str,
    pub body: Option<&'a str>,
    pub category: Option<&'a str>,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub action_url: Option<&'a str>,
}

/// Insert a notification row (call inside a tenant-scoped transaction).
pub async fn create_notification(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    notification: NewNotification<'_>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO notifications \
         (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(tenant_id)
    .bind(notification.user_id)
    .bind(notification.kind)
    .bind(notification.title)
    .bind(notification.body)
    .bind(notification.category)
    .bind(notification.entity_type)
    .bind(notification.entity_id)
    .bind(notification.action_url)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
