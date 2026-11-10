//! Paediatric growth charts: WHO Child Growth Standards for 0-5 years and the
//! IAP 2015 references for 5-18 years, as IAP recommends.
//!
//! Points come from what was charted -- OPD and ward vitals (weight, length or
//! height, head circumference) and the birth record -- and every z-score and
//! centile is computed here, never typed in. Gestation at birth, when
//! recorded, corrects the age of a preterm child until 24 months.

pub mod assess;
mod iap;
#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests;
mod who;

use axum::extract::{Path, State};
use axum::{Extension, Json};
use chrono::{NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use assess::{Chart, Child};

/// Sex for the reference tables, which exist only for boys and girls.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Sex {
    Male,
    Female,
}

/// One day's charted measurements.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Measurement {
    pub measured_on: NaiveDate,
    pub weight_kg: Option<f64>,
    pub height_cm: Option<f64>,
    pub head_circumference_cm: Option<f64>,
}

impl Measurement {
    /// BMI when weight and length/height were measured together.
    pub fn bmi(&self) -> Option<f64> {
        let (w, h) = (self.weight_kg?, self.height_cm? / 100.0);
        (h > 0.0).then(|| w / (h * h))
    }
}

/// The oldest age charted (IAP stops at 18 years).
const MAX_AGE_YEARS: i64 = 18;
/// Gestation at birth that can be recorded, in completed weeks.
const GESTATION_WEEKS: std::ops::RangeInclusive<f64> = 22.0..=44.0;

#[derive(Debug, Serialize)]
pub struct GrowthResponse {
    /// Why no chart can be drawn, when none can.
    pub unavailable: Option<String>,
    pub sex: Option<Sex>,
    pub date_of_birth: Option<NaiveDate>,
    pub gestation_weeks: Option<f64>,
    pub charts: Vec<Chart>,
}

#[derive(sqlx::FromRow)]
struct PatientRow {
    date_of_birth: Option<NaiveDate>,
    sex: Option<String>,
    birth_gestation_weeks: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct MeasureRow {
    measured_on: NaiveDate,
    weight_kg: Option<f64>,
    height_cm: Option<f64>,
    head_circumference_cm: Option<f64>,
}

/// `GET /api/patients/{id}/growth`
pub async fn get_growth(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<GrowthResponse>, AppError> {
    require_permission(&claims, permissions::patients::growth::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let p = sqlx::query_as::<_, PatientRow>(
        "SELECT date_of_birth, COALESCE(biological_sex, gender)::text AS sex, \
                birth_gestation_weeks::float8 AS birth_gestation_weeks \
           FROM patients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let rows = measurements(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(respond(&p, &rows, Utc::now().date_naive())))
}

fn respond(p: &PatientRow, rows: &[MeasureRow], today: NaiveDate) -> GrowthResponse {
    let sex = match p.sex.as_deref() {
        Some("male") => Some(Sex::Male),
        Some("female") => Some(Sex::Female),
        _ => None,
    };
    let mut out = GrowthResponse {
        unavailable: None,
        sex,
        date_of_birth: p.date_of_birth,
        gestation_weeks: p.birth_gestation_weeks,
        charts: Vec::new(),
    };
    let (Some(sex), Some(dob)) = (sex, p.date_of_birth) else {
        out.unavailable = Some(
            "Growth charts need the child's date of birth and sex recorded as male or female; \
             the reference tables exist only for boys and girls."
                .to_owned(),
        );
        return out;
    };
    if (today - dob).num_days() > MAX_AGE_YEARS * 366 {
        out.unavailable = Some("Growth charts cover birth to 18 years.".to_owned());
        return out;
    }
    let child = Child {
        sex,
        date_of_birth: dob,
        gestation_weeks: p.birth_gestation_weeks,
    };
    let ms: Vec<Measurement> = rows
        .iter()
        .map(|r| Measurement {
            measured_on: r.measured_on,
            weight_kg: r.weight_kg,
            height_cm: r.height_cm,
            head_circumference_cm: r.head_circumference_cm,
        })
        .collect();
    out.charts = assess::charts(&child, &ms, today);
    out
}

/// Charted vitals and the birth record, oldest first, bounded.
async fn measurements(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<MeasureRow>, AppError> {
    Ok(sqlx::query_as::<_, MeasureRow>(
        "SELECT measured_on, weight_kg, height_cm, head_circumference_cm FROM ( \
           SELECT b.date_of_birth AS measured_on, (b.weight_grams / 1000)::float8 AS weight_kg, \
                  b.length_cm::float8 AS height_cm, b.head_circumference_cm::float8 AS head_circumference_cm \
             FROM ipd_birth_records b \
            WHERE b.baby_patient_id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL \
           UNION ALL \
           SELECT v.recorded_at::date, v.weight_kg::float8, v.height_cm::float8, \
                  v.head_circumference_cm::float8 \
             FROM vitals v LEFT JOIN encounters e ON e.id = v.encounter_id \
            WHERE COALESCE(v.patient_id, e.patient_id) = $1 AND v.tenant_id = $2 \
              AND v.deleted_at IS NULL \
              AND (v.weight_kg IS NOT NULL OR v.height_cm IS NOT NULL \
                   OR v.head_circumference_cm IS NOT NULL) \
         ) m ORDER BY measured_on LIMIT 500",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

#[derive(Debug, Deserialize)]
pub struct GestationRequest {
    /// Completed weeks at birth; `None` clears it.
    pub weeks: Option<f64>,
}

/// `PUT /api/patients/{id}/growth/gestation`
pub async fn set_gestation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<GestationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::growth::RECORD_GESTATION)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    if body.weeks.is_some_and(|w| !GESTATION_WEEKS.contains(&w)) {
        return Err(AppError::BadRequest(
            "Gestation at birth must be between 22 and 44 weeks.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let old: Option<Option<f64>> = sqlx::query_scalar(
        "UPDATE patients p SET birth_gestation_weeks = $3 \
           FROM (SELECT birth_gestation_weeks::float8 AS was FROM patients \
                  WHERE id = $1 AND tenant_id = $2) o \
          WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL RETURNING o.was",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .bind(body.weeks)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(was) = old else {
        return Err(AppError::NotFound);
    };
    let (old_v, new_v) = (
        serde_json::json!({ "weeks": was }),
        serde_json::json!({ "weeks": body.weeks }),
    );
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "patients.birth_gestation_recorded",
            entity_type: "patients",
            entity_id: Some(patient_id),
            old_values: Some(&old_v),
            new_values: Some(&new_v),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(new_v))
}
