//! Admin → Queues → Lanes: the priority categories a queue offers (P1b).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
            return bad(format!(
                "{} is a clinical priority and is always first",
                c.label
            ));
        }
        let valid_code = c
            .code
            .chars()
            .next()
            .is_some_and(|ch| ch.is_ascii_lowercase())
            && c.code.len() <= 32
            && c.code
                .chars()
                .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_');
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
    if let Some(c) = categories
        .iter()
        .find(|c| PROTECTED.contains(&c.code.as_str()) && c.rank > normal)
    {
        return bad(format!(
            "{} cannot be called after ordinary patients",
            c.label
        ));
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
