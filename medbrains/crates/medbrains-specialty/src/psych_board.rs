//! What the Mental Health Review Board is owed, and the patient's say over
//! ABDM sharing.
//!
//! - s.97(5): every restraint is told to the nominated representative within
//!   24 hours — recorded here, so the screen can show which are late.
//! - s.97(7): every restraint goes into the monthly report to the Board.
//! - ABDM: a psychiatric care context is shared only if the hospital allows
//!   it and the patient has consented to that category.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_authz_gate::mental_health::{
    MentalHealthViewer, PsychChild, require_psych_child_access, require_psych_record_access,
};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::{PsychAdmissionCategory, PsychPatient};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct RestraintReportQuery {
    /// First day of the month, `YYYY-MM-01`.
    pub month: NaiveDate,
}

/// One restraint episode as the monthly Board report lists it.
#[derive(Debug, Serialize)]
pub struct RestraintReportRow {
    pub id: Uuid,
    pub psych_patient_id: Uuid,
    pub patient_id: Uuid,
    pub restraint_type: String,
    pub method: Option<String>,
    pub reason: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub authorised_by: Option<Uuid>,
    pub nominated_rep_informed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct AbdmConsentRequest {
    pub consented: bool,
}

pub async fn mark_nominated_rep_informed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::restraint::MANAGE,
    )?;
    require_psych_child_access(&state, &claims, PsychChild::Restraint, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query!(
        "UPDATE psych_seclusion_restraint \
            SET nominated_rep_informed_at = now(), nominated_rep_informed_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND nominated_rep_informed_at IS NULL \
            AND deleted_at IS NULL",
        id,
        claims.tenant_id,
        claims.sub,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if done == 0 {
        return Err(AppError::Conflict(
            "The representative was already recorded as informed".to_owned(),
        ));
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "informed": true })))
}

/// s.97(7): the month's restraint episodes, for the Board report.
pub async fn restraint_monthly_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<RestraintReportQuery>,
) -> Result<Json<Vec<RestraintReportRow>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, None).await?;
    let viewer = MentalHealthViewer::of(&claims);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        RestraintReportRow,
        r#"SELECT r.id, r.psych_patient_id, pp.patient_id, r.restraint_type::text AS "restraint_type!",
                  r.method, r.reason, r.start_time, r.end_time, r.authorised_by,
                  r.nominated_rep_informed_at
             FROM psych_seclusion_restraint r JOIN psych_patients pp ON pp.id = r.psych_patient_id
            WHERE r.tenant_id = $1 AND r.deleted_at IS NULL
              AND r.start_time >= date_trunc('month', $2::date)
              AND r.start_time < date_trunc('month', $2::date) + interval '1 month'
              AND ($3::uuid[] IS NULL OR pp.patient_id = ANY($3))
              AND (NOT pp.is_restricted
                   OR NOT public.mental_health_withheld(pp.patient_id, $4, $5))
            ORDER BY r.start_time LIMIT 5000"#,
        claims.tenant_id,
        q.month,
        permitted.as_deref(),
        viewer.user_id,
        viewer.can_all,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Record (or withdraw) the patient's consent to share mental-health care
/// contexts through ABDM. Withdrawal stops future transfers.
pub async fn set_abdm_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
    Json(body): Json<AbdmConsentRequest>,
) -> Result<Json<PsychPatient>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::abdm_consent::MANAGE,
    )?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychPatient,
        r#"UPDATE psych_patients
              SET abdm_mh_share_consented_at = CASE WHEN $3 THEN now() END,
                  abdm_mh_share_consented_by = CASE WHEN $3 THEN $4::uuid END
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
           RETURNING id, tenant_id, patient_id,
                  admission_category AS "admission_category: PsychAdmissionCategory",
                  substance_abuse_flag, is_restricted, treating_psychiatrist_id, notes,
                  abdm_mh_share_consented_at, abdm_mh_share_consented_by,
                  created_at, updated_at"#,
        psych_patient_id,
        claims.tenant_id,
        body.consented,
        claims.sub,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
