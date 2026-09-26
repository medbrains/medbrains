//! Admin → Queues: set up, change, pause and close queues (P1a).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::queues::QueueConfig;

#[derive(Debug, Serialize)]
pub struct QueueRow {
    #[serde(flatten)]
    pub queue: QueueConfig,
    /// Tokens issued in the current numbering period.
    pub issued: i64,
}

/// A place a queue can serve, from the `token_scopes` registry.
#[derive(Debug, Serialize)]
pub struct QueuePlace {
    pub scope: String,
    pub scope_id: Uuid,
    pub label: String,
    pub kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QueueInput {
    pub name: String,
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub prefix: String,
    pub start_at: i32,
    pub pad_width: i16,
    pub reset_rule: String,
    pub max_tokens_per_period: Option<i32>,
    pub lifecycle: String,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub status: String,
}

impl QueueInput {
    /// The admin's mistakes, in words they can act on. The table's checks
    /// refuse the same things; this names them.
    fn validate(&mut self) -> Result<(), AppError> {
        self.prefix = self.prefix.trim().to_uppercase();
        let bad = |msg: &str| Err(AppError::BadRequest(msg.to_owned()));
        if self.name.trim().is_empty() {
            return bad("Give the queue a name");
        }
        if !(1..=6).contains(&self.prefix.len()) || !self.prefix.chars().all(|c| c.is_ascii_alphanumeric()) {
            return bad("The prefix is 1 to 6 letters or digits, like GEN or C1");
        }
        if self.lifecycle == "temporary" && (self.valid_from.is_none() || self.valid_until.is_none()) {
            return bad("A temporary queue needs its first and last day");
        }
        if matches!((self.valid_from, self.valid_until), (Some(from), Some(until)) if until < from) {
            return bad("The last day is before the first");
        }
        Ok(())
    }
}

/// `GET /api/queues`
pub async fn list_queues(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueueRow>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query!(
        r#"SELECT q.id, q.name, q.module, q.scope, q.scope_id, q.scope_label, q.prefix,
                  q.start_at, q.pad_width, q.reset_rule, q.max_tokens_per_period, q.lifecycle,
                  q.valid_from, q.valid_until, q.status,
                  (SELECT COUNT(*) FROM tokens t
                    WHERE t.queue_id = q.id
                      AND (q.reset_rule = 'never' OR t.token_date = CURRENT_DATE)) AS "issued!"
             FROM queues q
            WHERE q.tenant_id = $1
            ORDER BY (q.status = 'closed'), q.name"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| QueueRow {
                issued: r.issued,
                queue: QueueConfig {
                    id: r.id,
                    name: r.name,
                    module: r.module,
                    scope: r.scope,
                    scope_id: r.scope_id,
                    scope_label: r.scope_label,
                    prefix: r.prefix,
                    start_at: r.start_at,
                    pad_width: r.pad_width,
                    reset_rule: r.reset_rule,
                    max_tokens_per_period: r.max_tokens_per_period,
                    lifecycle: r.lifecycle,
                    valid_from: r.valid_from,
                    valid_until: r.valid_until,
                    status: r.status,
                },
            })
            .collect(),
    ))
}

/// `GET /api/queues/places` — departments, rooms, counters and stations a
/// queue can serve.
pub async fn list_places(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueuePlace>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let places = sqlx::query_as!(
        QueuePlace,
        r#"SELECT scope AS "scope!", scope_id AS "scope_id!", label AS "label!", kind
             FROM token_scopes
            WHERE tenant_id = $1 AND is_active
            ORDER BY scope, label
            LIMIT 1000"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(places))
}

/// `POST /api/queues`
pub async fn create_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(mut body): Json<QueueInput>,
) -> Result<Json<QueueConfig>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let label = crate::resolve_scope(&mut tx, &body.scope, body.scope_id, None).await?;
    let queue = sqlx::query_as!(
        QueueConfig,
        "INSERT INTO queues (tenant_id, name, module, scope, scope_id, scope_label, prefix, \
           start_at, pad_width, reset_rule, max_tokens_per_period, lifecycle, valid_from, \
           valid_until, status, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
           reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status",
        claims.tenant_id,
        body.name.trim(),
        body.module,
        body.scope,
        body.scope_id,
        label,
        body.prefix,
        body.start_at,
        body.pad_width,
        body.reset_rule,
        body.max_tokens_per_period,
        body.lifecycle,
        body.valid_from,
        body.valid_until,
        body.status,
        claims.sub,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(one_live_queue_per_place)?;
    tx.commit().await?;
    Ok(Json(queue))
}

/// `PUT /api/queues/{id}` — edit, pause, resume or close.
pub async fn update_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut body): Json<QueueInput>,
) -> Result<Json<QueueConfig>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // The place is fixed once tokens exist: moving a queue would re-home every
    // token already issued in it.
    let queue = sqlx::query_as!(
        QueueConfig,
        "UPDATE queues SET name = $3, prefix = $4, start_at = $5, pad_width = $6, \
           reset_rule = $7, max_tokens_per_period = $8, lifecycle = $9, valid_from = $10, \
           valid_until = $11, status = $12 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
           reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status",
        id,
        claims.tenant_id,
        body.name.trim(),
        body.prefix,
        body.start_at,
        body.pad_width,
        body.reset_rule,
        body.max_tokens_per_period,
        body.lifecycle,
        body.valid_from,
        body.valid_until,
        body.status,
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(one_live_queue_per_place)?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(queue))
}

/// Only one live queue per module and place: two would number the same room
/// twice.
fn one_live_queue_per_place(err: sqlx::Error) -> AppError {
    match err {
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505") => AppError::Conflict(
            "This place already has a live queue for that module — close it first".to_owned(),
        ),
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23514") => {
            AppError::BadRequest(format!("The queue settings are not valid: {}", db.message()))
        }
        other => other.into(),
    }
}
