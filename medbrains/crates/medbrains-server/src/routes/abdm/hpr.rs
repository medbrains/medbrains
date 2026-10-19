//! ABDM HPR — Healthcare Professionals Registry IDs on doctor profiles.
//!
//! An HPR ID is 14 digits, kept hyphenated (`NN-NNNN-NNNN-NNNN`) as the
//! NRCeS Practitioner examples print it. Recording one never claims it is
//! verified; `hpr_verified_at` is set only when HPR search confirms it, and is
//! cleared whenever the ID changes.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::registry;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::registry_access::{Registry, registry_access, registry_configured, registry_fault};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Doctors listed as missing an HPR ID, at most.
const MISSING_LIMIT: i64 = 200;

const DOCTOR_COLUMNS: &str = "id, user_id, display_name, mci_number, hpr_id, hpr_verified_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorHpr {
    pub id: Uuid,
    pub user_id: Uuid,
    pub display_name: String,
    pub mci_number: Option<String>,
    pub hpr_id: Option<String>,
    pub hpr_verified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct HprCoverage {
    pub registry_configured: bool,
    pub active_doctors: i64,
    pub with_hpr_id: i64,
    pub verified: i64,
    /// Share of active doctors with an HPR ID, 0–100.
    pub coverage_percent: f64,
    pub missing: Vec<DoctorHpr>,
}

#[derive(Debug, Deserialize)]
pub struct SetHprRequest {
    /// `None` / empty clears it.
    pub hpr_id: Option<String>,
}

/// `GET /api/abdm/hpr/coverage` — how many active doctors carry an HPR ID.
pub async fn coverage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<HprCoverage>, AppError> {
    require_permission(&claims, permissions::abdm::hpr::MANAGE)?;
    let registry_configured = registry_configured(&state, &claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (active, with_id, verified): (i64, i64, i64) = sqlx::query_as(
        "SELECT count(*), count(hpr_id), count(hpr_verified_at) FROM doctor_profiles \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let missing = sqlx::query_as::<_, DoctorHpr>(&format!(
        "SELECT {DOCTOR_COLUMNS} FROM doctor_profiles \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL AND hpr_id IS NULL \
         ORDER BY display_name LIMIT $2"
    ))
    .bind(claims.tenant_id)
    .bind(MISSING_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(HprCoverage {
        registry_configured,
        active_doctors: active,
        with_hpr_id: with_id,
        verified,
        coverage_percent: percent(with_id, active),
        missing,
    }))
}

/// `PUT /api/abdm/hpr/doctors/{id}` — record or clear a doctor's HPR ID.
pub async fn set_hpr_id(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetHprRequest>,
) -> Result<Json<DoctorHpr>, AppError> {
    require_permission(&claims, permissions::abdm::hpr::MANAGE)?;
    let hpr_id = match body.hpr_id.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(raw) => Some(normalize_hpr_id(raw)?),
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, DoctorHpr>(&format!(
        "UPDATE doctor_profiles SET hpr_id = $3, \
                hpr_verified_at = CASE WHEN hpr_id IS NOT DISTINCT FROM $3 \
                                       THEN hpr_verified_at END \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING {DOCTOR_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(hpr_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/abdm/hpr/doctors/{id}/verify` — confirm the ID against HPR.
pub async fn verify_hpr_id(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DoctorHpr>, AppError> {
    require_permission(&claims, permissions::abdm::hpr::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let hpr_id: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT hpr_id FROM doctor_profiles \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let hpr_id = hpr_id.ok_or_else(|| AppError::BadRequest("record the HPR ID first".into()))?;

    let Some(access) = registry_access(&state, &claims.tenant_id, Registry::Hpr).await? else {
        return Err(AppError::ServiceUnavailable(
            "ABDM keys are not configured — HPR IDs cannot be verified yet".to_owned(),
        ));
    };
    let found = registry::hpr_search(&access.http, &access.base_url, &access.token, &hpr_id)
        .await
        .map_err(registry_fault)?;
    if found.is_none() {
        return Err(AppError::Conflict(format!("HPR does not list {hpr_id}")));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, DoctorHpr>(&format!(
        "UPDATE doctor_profiles SET hpr_verified_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND hpr_id = $3 \
         RETURNING {DOCTOR_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&hpr_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("the HPR ID changed while it was being verified".into()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// 14 digits, with or without hyphens → `NN-NNNN-NNNN-NNNN`.
fn normalize_hpr_id(raw: &str) -> Result<String, AppError> {
    let digits: String = raw.chars().filter(|c| *c != '-' && *c != ' ').collect();
    if digits.len() != 14 || !digits.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest("HPR ID is 14 digits".into()));
    }
    Ok(format!(
        "{}-{}-{}-{}",
        &digits[..2],
        &digits[2..6],
        &digits[6..10],
        &digits[10..]
    ))
}

fn percent(part: i64, whole: i64) -> f64 {
    if whole == 0 {
        return 0.0;
    }
    (part as f64 * 1000.0 / whole as f64).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::{normalize_hpr_id, percent};

    #[test]
    fn hpr_id_shape() {
        assert_eq!(
            normalize_hpr_id("21152138283227").ok().as_deref(),
            Some("21-1521-3828-3227")
        );
        assert_eq!(
            normalize_hpr_id("21-1521-3828-3227").ok().as_deref(),
            Some("21-1521-3828-3227")
        );
        assert!(normalize_hpr_id("2115213828322").is_err());
        assert!(normalize_hpr_id("21-1521-3828-322A").is_err());
    }

    #[test]
    fn coverage_rounds_to_one_decimal() {
        assert!((percent(1, 3) - 33.3).abs() < f64::EPSILON);
        assert!(percent(0, 0).abs() < f64::EPSILON);
        assert!((percent(4, 4) - 100.0).abs() < f64::EPSILON);
    }
}
