//! Inpatient hypoglycaemia management (ADA / NABH). Hypoglycaemia (blood glucose < 70 mg/dL) is the
//! most common serious harm from insulin/sulfonylureas; untreated it causes seizures, coma and death.
//! Severity is computed server-side from the glucose value and consciousness, with the standard
//! treatment advice, and a 15-minute recheck records whether the patient recovered — feeding the NABH
//! "hypoglycaemia target achieved" KPI which had no capture behind it.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const TREATMENTS: [&str; 4] = ["oral_carbs", "iv_dextrose", "im_glucagon", "none"];
/// Glucose at or above this (mg/dL) is out of the hypoglycaemic range / recovered.
const RECOVERY_THRESHOLD: f64 = 70.0;
/// Below this (mg/dL) is severe hypoglycaemia.
const SEVERE_THRESHOLD: f64 = 54.0;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HypoglycemiaEvent {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub glucose_value: f64,
    pub conscious: bool,
    pub severity: String,
    pub treatment: Option<String>,
    pub treatment_given_at: Option<DateTime<Utc>>,
    pub recheck_glucose: Option<f64>,
    pub recheck_at: Option<DateTime<Utc>>,
    pub resolved: bool,
    pub notes: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct HypoglycemiaView {
    pub event: HypoglycemiaEvent,
    pub treatment_advice: &'static str,
}

/// Classify severity and give the standard treatment advice. Severe = glucose < 54 mg/dL OR the
/// patient is not fully conscious (can't safely take oral carbohydrate).
pub fn classify_hypoglycemia(glucose: f64, conscious: bool) -> (&'static str, &'static str) {
    if glucose >= RECOVERY_THRESHOLD {
        ("none", "Glucose is not in the hypoglycaemic range; no acute treatment indicated.")
    } else if glucose < SEVERE_THRESHOLD || !conscious {
        (
            "severe",
            "Severe — give IV 25% dextrose (or IM glucagon if no IV access); do not give anything by \
             mouth if not fully conscious. Recheck glucose in 15 minutes and repeat until >= 70.",
        )
    } else {
        (
            "moderate",
            "Give 15-20 g fast-acting oral carbohydrate. Recheck glucose in 15 minutes and repeat \
             until >= 70, then give a meal or snack.",
        )
    }
}

const COLS: &str = "id, patient_id, admission_id, glucose_value, conscious, severity, treatment, \
     treatment_given_at, recheck_glucose, recheck_at, resolved, notes, recorded_by, created_at";

fn view(event: HypoglycemiaEvent) -> HypoglycemiaView {
    let (_, advice) = classify_hypoglycemia(event.glucose_value, event.conscious);
    HypoglycemiaView { event, treatment_advice: advice }
}

#[derive(Debug, Deserialize)]
pub struct CreateHypoglycemiaRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub glucose_value: f64,
    #[serde(default = "default_true")]
    pub conscious: bool,
    pub treatment: Option<String>,
    pub notes: Option<String>,
}

const fn default_true() -> bool {
    true
}

/// `POST /api/clinical/hypoglycemia-event`
pub async fn create_hypoglycemia_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHypoglycemiaRequest>,
) -> Result<Json<HypoglycemiaView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if body.glucose_value <= 0.0 || body.glucose_value > 2000.0 {
        return Err(AppError::BadRequest("glucose_value out of range".into()));
    }
    if let Some(t) = body.treatment.as_deref() {
        if !TREATMENTS.contains(&t) {
            return Err(AppError::BadRequest(format!("invalid treatment '{t}'")));
        }
    }
    let (severity, _) = classify_hypoglycemia(body.glucose_value, body.conscious);
    let treatment_given_at = body.treatment.as_deref().filter(|t| *t != "none").map(|_| Utc::now());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HypoglycemiaEvent>(&format!(
        "INSERT INTO hypoglycemia_events \
         (tenant_id, patient_id, admission_id, glucose_value, conscious, severity, treatment, \
          treatment_given_at, notes, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.glucose_value)
    .bind(body.conscious)
    .bind(severity)
    .bind(body.treatment.as_deref())
    .bind(treatment_given_at)
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(view(row)))
}

#[derive(Debug, Deserialize)]
pub struct HypoglycemiaRecheckRequest {
    pub recheck_glucose: f64,
}

/// `PATCH /api/clinical/hypoglycemia-event/{id}/recheck` — record the 15-minute recheck; resolved when
/// glucose has recovered to >= 70 mg/dL.
pub async fn recheck_hypoglycemia_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<HypoglycemiaRecheckRequest>,
) -> Result<Json<HypoglycemiaView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if body.recheck_glucose <= 0.0 || body.recheck_glucose > 2000.0 {
        return Err(AppError::BadRequest("recheck_glucose out of range".into()));
    }
    let resolved = body.recheck_glucose >= RECOVERY_THRESHOLD;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HypoglycemiaEvent>(&format!(
        "UPDATE hypoglycemia_events \
         SET recheck_glucose = $3, recheck_at = now(), resolved = $4 \
         WHERE tenant_id = $1 AND id = $2 RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.recheck_glucose)
    .bind(resolved)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(view(row)))
}

#[derive(Debug, Deserialize)]
pub struct ListHypoglycemiaQuery {
    pub patient_id: Uuid,
}

/// `GET /api/clinical/hypoglycemia-events?patient_id=`
pub async fn list_hypoglycemia_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListHypoglycemiaQuery>,
) -> Result<Json<Vec<HypoglycemiaView>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HypoglycemiaEvent>(&format!(
        "SELECT {COLS} FROM hypoglycemia_events \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows.into_iter().map(view).collect()))
}

#[cfg(test)]
mod tests {
    use super::classify_hypoglycemia;

    #[test]
    fn normal_glucose_is_none() {
        assert_eq!(classify_hypoglycemia(110.0, true).0, "none");
    }

    #[test]
    fn moderate_when_conscious_between_54_and_70() {
        assert_eq!(classify_hypoglycemia(60.0, true).0, "moderate");
    }

    #[test]
    fn severe_when_below_54() {
        assert_eq!(classify_hypoglycemia(45.0, true).0, "severe");
    }

    #[test]
    fn severe_when_not_conscious_even_if_mild() {
        assert_eq!(classify_hypoglycemia(65.0, false).0, "severe");
    }
}
