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

/// One priority lane a queue offers. Stat, urgent and emergency referral are
/// not here: they are always first, in every queue, and cannot be configured.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueCategory {
    pub code: String,
    pub label: String,
    /// 3 (called first) to 9 (called last) — below every clinical tier.
    pub rank: i16,
    pub kiosk_selectable: bool,
    pub is_active: bool,
}

const CLINICAL: [&str; 3] = ["stat", "urgent", "emergency_referral"];
/// Priority by law or policy (the `RPwD` Act 2016, senior-citizen priority): never
/// called after an ordinary patient.
const PROTECTED: [&str; 3] = ["elderly", "disabled", "pregnant"];
/// Where "normal" sits when a queue does not configure it.
const DEFAULT_NORMAL_RANK: i16 = 6;

/// Refuse a category list that would put a courtesy lane ahead of an
/// emergency or a protected patient behind an ordinary one.
pub fn validate_categories(categories: &[QueueCategory]) -> Result<(), AppError> {
    let bad = |msg: String| Err(AppError::BadRequest(msg));
    let mut seen = std::collections::HashSet::new();
    for c in categories {
        if CLINICAL.contains(&c.code.as_str()) {
            return bad(format!("{} is a clinical priority and is always first", c.label));
        }
        let valid_code = c.code.chars().next().is_some_and(|ch| ch.is_ascii_lowercase())
            && c.code.len() <= 32
            && c.code.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_');
        if !valid_code {
            return bad(format!("\"{}\" needs a short code like senior_80", c.label));
        }
        if !(3..=9).contains(&c.rank) {
            return bad(format!("{} must be ordered between 3 and 9", c.label));
        }
        if c.label.trim().is_empty() {
            return bad("Every category needs a name".to_owned());
        }
        if !seen.insert(c.code.as_str()) {
            return bad(format!("{} appears twice", c.code));
        }
    }
    let normal = categories
        .iter()
        .find(|c| c.code == "normal")
        .map_or(DEFAULT_NORMAL_RANK, |c| c.rank);
    if let Some(c) = categories.iter().find(|c| PROTECTED.contains(&c.code.as_str()) && c.rank > normal) {
        return bad(format!("{} cannot be called after ordinary patients", c.label));
    }
    Ok(())
}

/// `GET /api/queues/{id}/categories`
pub async fn list_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<QueueCategory>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let categories = read_categories(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(categories))
}

/// `PUT /api/queues/{id}/categories` — replace the queue's list.
pub async fn replace_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(categories): Json<Vec<QueueCategory>>,
) -> Result<Json<Vec<QueueCategory>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    validate_categories(&categories)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM queues WHERE id = $1 AND tenant_id = $2) AS "exists!""#,
        id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    if !exists {
        return Err(AppError::NotFound);
    }
    sqlx::query!(
        "DELETE FROM queue_categories WHERE queue_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;
    for c in &categories {
        sqlx::query!(
            "INSERT INTO queue_categories \
               (tenant_id, queue_id, code, label, rank, kiosk_selectable, is_active) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
            claims.tenant_id,
            id,
            c.code,
            c.label.trim(),
            c.rank,
            c.kiosk_selectable,
            c.is_active,
        )
        .execute(&mut *tx)
        .await?;
    }
    let saved = read_categories(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

async fn read_categories(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    queue_id: Uuid,
) -> Result<Vec<QueueCategory>, AppError> {
    Ok(sqlx::query_as!(
        QueueCategory,
        "SELECT code, label, rank, kiosk_selectable, is_active FROM queue_categories \
          WHERE queue_id = $1 AND tenant_id = $2 ORDER BY rank, label",
        queue_id,
        tenant_id,
    )
    .fetch_all(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::{QueueCategory, validate_categories};

    fn cat(code: &str, rank: i16) -> QueueCategory {
        QueueCategory {
            code: code.to_owned(),
            label: code.to_owned(),
            rank,
            kiosk_selectable: false,
            is_active: true,
        }
    }

    #[test]
    fn no_hospital_can_configure_an_emergency_lane() {
        assert!(validate_categories(&[cat("urgent", 3)]).is_err());
    }

    #[test]
    fn a_protected_patient_is_never_called_after_an_ordinary_one() {
        assert!(validate_categories(&[cat("elderly", 7)]).is_err());
        assert!(validate_categories(&[cat("normal", 8), cat("elderly", 7)]).is_ok());
        assert!(validate_categories(&[cat("pregnant", 3), cat("normal", 4)]).is_ok());
    }

    #[test]
    fn a_custom_lane_is_allowed_between_3_and_9() {
        assert!(validate_categories(&[cat("staff", 4), cat("senior_80", 3)]).is_ok());
        assert!(validate_categories(&[cat("staff", 2)]).is_err());
        assert!(validate_categories(&[cat("Staff Lane", 4)]).is_err());
        assert!(validate_categories(&[cat("staff", 4), cat("staff", 5)]).is_err());
    }
}
