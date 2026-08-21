//! VTE (venous thromboembolism) risk assessment — Padua Prediction Score for medical inpatients.
//! Score >= 4 is high risk and warrants pharmacological thromboprophylaxis unless a bleeding risk
//! contraindicates it. The score + risk band are computed server-side from the documented factors,
//! so the risk stratification can't be mis-entered. NABH/JCI preventable-VTE measure.

use axum::routing::{get,post};
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VteRiskAssessment {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub active_cancer: bool,
    pub previous_vte: bool,
    pub reduced_mobility: bool,
    pub thrombophilia: bool,
    pub recent_trauma_surgery: bool,
    pub age_over_70: bool,
    pub cardiac_resp_failure: bool,
    pub acute_mi_stroke: bool,
    pub acute_infection_rheum: bool,
    pub obesity: bool,
    pub hormonal_treatment: bool,
    pub score: i32,
    pub high_risk: bool,
    pub prophylaxis_recommended: bool,
    pub has_bleeding_risk: bool,
    pub prophylaxis_type: Option<String>,
    pub notes: Option<String>,
    pub assessed_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVteRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    #[serde(default)]
    pub active_cancer: bool,
    #[serde(default)]
    pub previous_vte: bool,
    #[serde(default)]
    pub reduced_mobility: bool,
    #[serde(default)]
    pub thrombophilia: bool,
    #[serde(default)]
    pub recent_trauma_surgery: bool,
    #[serde(default)]
    pub age_over_70: bool,
    #[serde(default)]
    pub cardiac_resp_failure: bool,
    #[serde(default)]
    pub acute_mi_stroke: bool,
    #[serde(default)]
    pub acute_infection_rheum: bool,
    #[serde(default)]
    pub obesity: bool,
    #[serde(default)]
    pub hormonal_treatment: bool,
    #[serde(default)]
    pub has_bleeding_risk: bool,
    pub prophylaxis_type: Option<String>,
    pub notes: Option<String>,
}

/// Padua Prediction Score: 3 for active cancer / previous VTE / reduced mobility / thrombophilia,
/// 2 for recent trauma or surgery, 1 for each of the six minor factors. >= 4 is high risk.
fn padua_score(r: &CreateVteRequest) -> i32 {
    let mut s = 0;
    for (present, weight) in [
        (r.active_cancer, 3),
        (r.previous_vte, 3),
        (r.reduced_mobility, 3),
        (r.thrombophilia, 3),
        (r.recent_trauma_surgery, 2),
        (r.age_over_70, 1),
        (r.cardiac_resp_failure, 1),
        (r.acute_mi_stroke, 1),
        (r.acute_infection_rheum, 1),
        (r.obesity, 1),
        (r.hormonal_treatment, 1),
    ] {
        if present {
            s += weight;
        }
    }
    s
}

const VTE_COLS: &str = "id, patient_id, admission_id, active_cancer, previous_vte, reduced_mobility, \
     thrombophilia, recent_trauma_surgery, age_over_70, cardiac_resp_failure, acute_mi_stroke, \
     acute_infection_rheum, obesity, hormonal_treatment, score, high_risk, prophylaxis_recommended, \
     has_bleeding_risk, prophylaxis_type, notes, assessed_by, created_at";

/// `POST /api/vte-assessments`
pub async fn create_vte_assessment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVteRequest>,
) -> Result<Json<VteRiskAssessment>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    // A VTE risk score is a clinical assessment of the patient the body
    // names, not of the ward.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    if let Some(t) = body.prophylaxis_type.as_deref() {
        if !["pharmacological", "mechanical", "none"].contains(&t) {
            return Err(AppError::BadRequest(format!("invalid prophylaxis_type '{t}'")));
        }
    }
    let score = padua_score(&body);
    let high_risk = score >= 4;
    // High-risk patients need thromboprophylaxis unless a documented bleeding risk contraindicates it.
    let prophylaxis_recommended = high_risk && !body.has_bleeding_risk;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, VteRiskAssessment>(&format!(
        "INSERT INTO vte_risk_assessments \
         (tenant_id, patient_id, admission_id, active_cancer, previous_vte, reduced_mobility, \
          thrombophilia, recent_trauma_surgery, age_over_70, cardiac_resp_failure, acute_mi_stroke, \
          acute_infection_rheum, obesity, hormonal_treatment, score, high_risk, \
          prophylaxis_recommended, has_bleeding_risk, prophylaxis_type, notes, assessed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, \
                 $19, $20, $21) \
         RETURNING {VTE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.active_cancer)
    .bind(body.previous_vte)
    .bind(body.reduced_mobility)
    .bind(body.thrombophilia)
    .bind(body.recent_trauma_surgery)
    .bind(body.age_over_70)
    .bind(body.cardiac_resp_failure)
    .bind(body.acute_mi_stroke)
    .bind(body.acute_infection_rheum)
    .bind(body.obesity)
    .bind(body.hormonal_treatment)
    .bind(score)
    .bind(high_risk)
    .bind(prophylaxis_recommended)
    .bind(body.has_bleeding_risk)
    .bind(body.prophylaxis_type.as_deref())
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/patients/{patient_id}/vte-assessments`
pub async fn list_vte_assessments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<VteRiskAssessment>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, VteRiskAssessment>(&format!(
        "SELECT {VTE_COLS} FROM vte_risk_assessments \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::{CreateVteRequest, padua_score};

    fn base() -> CreateVteRequest {
        CreateVteRequest {
            patient_id: Uuid::nil(),
            admission_id: None,
            active_cancer: false,
            previous_vte: false,
            reduced_mobility: false,
            thrombophilia: false,
            recent_trauma_surgery: false,
            age_over_70: false,
            cardiac_resp_failure: false,
            acute_mi_stroke: false,
            acute_infection_rheum: false,
            obesity: false,
            hormonal_treatment: false,
            has_bleeding_risk: false,
            prophylaxis_type: None,
            notes: None,
        }
    }
    use uuid::Uuid;

    #[test]
    fn scoring() {
        assert_eq!(padua_score(&base()), 0);
        let mut r = base();
        r.active_cancer = true; // 3
        r.age_over_70 = true; // 1
        assert_eq!(padua_score(&r), 4); // high risk threshold
        r.recent_trauma_surgery = true; // +2
        assert_eq!(padua_score(&r), 6);
    }
}

/// vte routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/vte-assessments", post(create_vte_assessment))
        .route(
            "/api/patients/{patient_id}/vte-assessments",
            get(list_vte_assessments),
        )
}
