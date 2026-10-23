//! A patient's vaccine doses (migration 1205): the chart's immunisation
//! record, and the source of ABDM's ImmunizationRecord.
//!
//! - `GET  /api/patients/{patient_id}/immunizations` — every dose, struck-off
//!   ones included (with who, when and why), newest first.
//! - `POST /api/patients/{patient_id}/immunizations` — record one.
//! - `POST /api/immunizations/{id}/strike` — strike one off as wrong.
//!
//! A dose given here carries its lot number (Drugs and Cosmetics Act batch
//! traceability: an adverse event is traced to a lot). One read off the
//! patient's card is recorded as given elsewhere, never as given here.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Doses listed per patient; a lifetime's schedule is well under this.
const LIST_LIMIT: i64 = 200;
const ROUTES: &[&str] = &[
    "intramuscular",
    "subcutaneous",
    "intradermal",
    "oral",
    "intranasal",
];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Immunization {
    pub id: Uuid,
    pub vaccine_name: String,
    pub vaccine_code: Option<String>,
    pub dose_number: Option<i32>,
    pub administered_on: NaiveDate,
    pub lot_number: Option<String>,
    pub manufacturer: Option<String>,
    pub route: Option<String>,
    pub site: Option<String>,
    pub given_elsewhere: bool,
    pub notes: Option<String>,
    pub recorded_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    /// Struck off as wrong: when and why.
    pub deleted_at: Option<DateTime<Utc>>,
    pub delete_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordImmunization {
    pub vaccine_name: String,
    pub vaccine_code: Option<String>,
    pub dose_number: Option<i32>,
    pub administered_on: NaiveDate,
    pub lot_number: Option<String>,
    pub manufacturer: Option<String>,
    pub route: Option<String>,
    pub site: Option<String>,
    #[serde(default)]
    pub given_elsewhere: bool,
    pub encounter_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Strike {
    pub reason: String,
}

fn text(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// What makes a dose unrecordable, in words for staff.
fn problem(b: &RecordImmunization, today: NaiveDate) -> Option<&'static str> {
    if b.vaccine_name.trim().is_empty() {
        Some("name the vaccine")
    } else if b.administered_on > today {
        Some("a dose cannot be recorded for a date still to come")
    } else if b.dose_number.is_some_and(|d| !(1..=20).contains(&d)) {
        Some("the dose number is 1 to 20")
    } else if b.route.as_deref().is_some_and(|r| !ROUTES.contains(&r)) {
        Some("choose the route from the list")
    } else if !b.given_elsewhere && text(b.lot_number.as_ref()).is_none() {
        Some("a dose given here needs its lot number")
    } else {
        None
    }
}

const SELECT: &str = "SELECT i.id, i.vaccine_name, i.vaccine_code, i.dose_number, i.administered_on, \
       i.lot_number, i.manufacturer, i.route, i.site, i.given_elsewhere, i.notes, \
       u.full_name AS recorded_by_name, i.created_at, i.deleted_at, i.delete_reason \
  FROM patient_immunizations i LEFT JOIN users u ON u.id = i.recorded_by";

/// `GET /api/patients/{patient_id}/immunizations`
///
/// # Errors
/// 403 without `patients.view` or access to the patient.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<Immunization>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows = sqlx::query_as::<_, Immunization>(&format!(
        "{SELECT} WHERE i.tenant_id = $1 AND i.patient_id = $2 \
          ORDER BY i.administered_on DESC, i.created_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/patients/{patient_id}/immunizations`
///
/// # Errors
/// 403 without `patients.immunizations.record` or access to the patient;
/// 400 for a dose that cannot be recorded as given.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(b): Json<RecordImmunization>,
) -> Result<Json<Immunization>, AppError> {
    require_permission(&claims, permissions::patients::immunizations::RECORD)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let today = (Utc::now() + chrono::Duration::minutes(330)).date_naive();
    if let Some(why) = problem(&b, today) {
        return Err(AppError::BadRequest(why.to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_immunizations (tenant_id, patient_id, encounter_id, vaccine_name, \
                vaccine_code, dose_number, administered_on, lot_number, manufacturer, route, site, \
                given_elsewhere, notes, recorded_by) \
         SELECT p.tenant_id, p.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14 \
           FROM patients p WHERE p.tenant_id = $1 AND p.id = $2 AND p.deleted_at IS NULL \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(b.encounter_id)
    .bind(b.vaccine_name.trim())
    .bind(text(b.vaccine_code.as_ref()))
    .bind(b.dose_number)
    .bind(b.administered_on)
    .bind(text(b.lot_number.as_ref()))
    .bind(text(b.manufacturer.as_ref()))
    .bind(b.route.as_deref())
    .bind(text(b.site.as_ref()))
    .bind(b.given_elsewhere)
    .bind(text(b.notes.as_ref()))
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let row = sqlx::query_as::<_, Immunization>(&format!("{SELECT} WHERE i.id = $1"))
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/immunizations/{id}/strike` — a wrong entry stays on the chart,
/// struck off with who, when and why, and is no longer shared.
///
/// # Errors
/// 403 without `patients.immunizations.record` or access to the patient;
/// 400 without a reason; 404 for a dose not here or already struck off.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn strike(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<Strike>,
) -> Result<Json<Immunization>, AppError> {
    require_permission(&claims, permissions::patients::immunizations::RECORD)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "say why the dose is struck off".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM patient_immunizations \
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE patient_immunizations SET deleted_at = now(), deleted_by = $3, delete_reason = $4 \
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(reason)
    .execute(&mut *tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let row = sqlx::query_as::<_, Immunization>(&format!("{SELECT} WHERE i.id = $1"))
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{RecordImmunization, problem};
    use chrono::NaiveDate;

    fn dose(lot: Option<&str>, elsewhere: bool, on: (i32, u32, u32)) -> RecordImmunization {
        RecordImmunization {
            vaccine_name: "Hepatitis B vaccine".into(),
            vaccine_code: None,
            dose_number: Some(2),
            administered_on: NaiveDate::from_ymd_opt(on.0, on.1, on.2).unwrap_or_default(),
            lot_number: lot.map(str::to_owned),
            manufacturer: None,
            route: Some("intramuscular".into()),
            site: None,
            given_elsewhere: elsewhere,
            encounter_id: None,
            notes: None,
        }
    }

    /// A dose given here needs its lot (batch recall); one off the card does
    /// not; nothing is recorded for tomorrow.
    #[test]
    fn a_dose_given_here_needs_its_lot_and_a_past_date() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 23).unwrap_or_default();
        assert_eq!(
            problem(&dose(Some("HB-1"), false, (2026, 10, 23)), today),
            None
        );
        assert!(
            problem(&dose(None, false, (2026, 10, 23)), today).is_some_and(|p| p.contains("lot"))
        );
        assert_eq!(problem(&dose(None, true, (1990, 1, 15)), today), None);
        assert!(problem(&dose(Some("HB-1"), false, (2026, 10, 24)), today).is_some());
    }
}
