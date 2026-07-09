//! MUST (Malnutrition Universal Screening Tool) nutritional screening. NABH requires malnutrition-risk
//! screening for every inpatient at admission. MUST sums three steps — BMI, unplanned weight loss, and
//! an acute-disease effect — into a 0-6 score banded low / medium / high, which drives a dietitian
//! referral. BMI and the step scores are computed server-side from height and weight so the risk band
//! is authoritative, not mis-added at the bedside.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NutritionScreening {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub height_cm: f64,
    pub weight_kg: f64,
    pub bmi: f64,
    pub weight_loss_percent: f64,
    pub acute_disease_no_intake: bool,
    pub bmi_score: i32,
    pub weight_loss_score: i32,
    pub acute_score: i32,
    pub total_score: i32,
    pub risk: String,
    pub notes: Option<String>,
    pub assessed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNutritionScreeningRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub height_cm: f64,
    pub weight_kg: f64,
    /// Unplanned weight loss over 3-6 months, as a percentage of body weight.
    #[serde(default)]
    pub weight_loss_percent: f64,
    /// Acutely ill AND no / likely no nutritional intake for > 5 days.
    #[serde(default)]
    pub acute_disease_no_intake: bool,
    pub notes: Option<String>,
}

pub struct MustScore {
    pub bmi: f64,
    pub bmi_score: i32,
    pub weight_loss_score: i32,
    pub acute_score: i32,
    pub total: i32,
    pub risk: &'static str,
}

/// Compute the MUST score. BMI band: >20 = 0, 18.5-20 = 1, <18.5 = 2. Weight-loss band: <5% = 0,
/// 5-10% = 1, >10% = 2. Acute-disease effect = 2 when acutely ill with no intake > 5 days. Total 0-6
/// bands to low (0), medium (1), high (>=2).
pub fn compute_must(
    height_cm: f64,
    weight_kg: f64,
    weight_loss_percent: f64,
    acute: bool,
) -> MustScore {
    let height_m = height_cm / 100.0;
    let bmi = weight_kg / (height_m * height_m);
    let bmi_score = if bmi > 20.0 {
        0
    } else if bmi >= 18.5 {
        1
    } else {
        2
    };
    let weight_loss_score = if weight_loss_percent < 5.0 {
        0
    } else if weight_loss_percent <= 10.0 {
        1
    } else {
        2
    };
    let acute_score = i32::from(acute) * 2;
    let total = bmi_score + weight_loss_score + acute_score;
    let risk = if total == 0 {
        "low"
    } else if total == 1 {
        "medium"
    } else {
        "high"
    };
    MustScore { bmi, bmi_score, weight_loss_score, acute_score, total, risk }
}

const COLS: &str = "id, patient_id, admission_id, height_cm, weight_kg, bmi, weight_loss_percent, \
     acute_disease_no_intake, bmi_score, weight_loss_score, acute_score, total_score, risk, notes, \
     assessed_by, created_at";

/// `POST /api/clinical/nutrition-screening`
pub async fn create_nutrition_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNutritionScreeningRequest>,
) -> Result<Json<NutritionScreening>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    if body.height_cm < 50.0 || body.height_cm > 260.0 {
        return Err(AppError::BadRequest("height_cm must be between 50 and 260".into()));
    }
    if body.weight_kg <= 0.0 || body.weight_kg > 500.0 {
        return Err(AppError::BadRequest("weight_kg must be between 0 and 500".into()));
    }
    if !(0.0..=100.0).contains(&body.weight_loss_percent) {
        return Err(AppError::BadRequest("weight_loss_percent must be between 0 and 100".into()));
    }
    let s = compute_must(
        body.height_cm,
        body.weight_kg,
        body.weight_loss_percent,
        body.acute_disease_no_intake,
    );

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, NutritionScreening>(&format!(
        "INSERT INTO nutrition_screenings \
         (tenant_id, patient_id, admission_id, height_cm, weight_kg, bmi, weight_loss_percent, \
          acute_disease_no_intake, bmi_score, weight_loss_score, acute_score, total_score, risk, \
          notes, assessed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.height_cm)
    .bind(body.weight_kg)
    .bind(s.bmi)
    .bind(body.weight_loss_percent)
    .bind(body.acute_disease_no_intake)
    .bind(s.bmi_score)
    .bind(s.weight_loss_score)
    .bind(s.acute_score)
    .bind(s.total)
    .bind(s.risk)
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListNutritionScreeningQuery {
    pub patient_id: Uuid,
}

/// `GET /api/clinical/nutrition-screenings?patient_id=`
pub async fn list_nutrition_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListNutritionScreeningQuery>,
) -> Result<Json<Vec<NutritionScreening>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NutritionScreening>(&format!(
        "SELECT {COLS} FROM nutrition_screenings \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::compute_must;

    #[test]
    fn healthy_is_low_risk() {
        // 70 kg, 175 cm -> BMI ~22.9, no loss, not acute.
        let s = compute_must(175.0, 70.0, 0.0, false);
        assert_eq!(s.bmi_score, 0);
        assert_eq!(s.total, 0);
        assert_eq!(s.risk, "low");
    }

    #[test]
    fn low_bmi_scores_two() {
        // 45 kg, 175 cm -> BMI ~14.7.
        let s = compute_must(175.0, 45.0, 0.0, false);
        assert_eq!(s.bmi_score, 2);
        assert_eq!(s.risk, "high");
    }

    #[test]
    fn moderate_weight_loss_is_medium() {
        let s = compute_must(175.0, 70.0, 7.0, false); // 7% loss -> 1
        assert_eq!(s.weight_loss_score, 1);
        assert_eq!(s.total, 1);
        assert_eq!(s.risk, "medium");
    }

    #[test]
    fn acute_disease_adds_two_and_high_risk() {
        let s = compute_must(175.0, 70.0, 0.0, true);
        assert_eq!(s.acute_score, 2);
        assert_eq!(s.total, 2);
        assert_eq!(s.risk, "high");
    }
}
