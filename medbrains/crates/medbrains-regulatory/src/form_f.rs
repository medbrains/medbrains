//! Completing a PC-PNDT Form F: the indication, the doctor who performed the
//! scan, her living children, the result, and the two declarations the Act
//! requires — hers, that she does not want to know the sex of the fetus, and
//! the doctor's, that it was neither detected nor disclosed. Until both are
//! recorded the scan's report cannot be verified.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::regulatory::PcpndtForm;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CompleteFormF {
    pub indication: String,
    pub performing_doctor_id: Uuid,
    pub living_sons: Option<i32>,
    pub living_daughters: Option<i32>,
    #[serde(default)]
    pub self_referred: bool,
    pub result_summary: Option<String>,
    /// She has declared she does not want to know the sex of the fetus.
    pub woman_declares: bool,
    /// The doctor declares the sex was neither detected nor disclosed.
    pub doctor_declares: bool,
}

/// `PUT /api/regulatory/pcpndt/forms/{id}/complete`
pub async fn complete_form_f(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteFormF>,
) -> Result<Json<PcpndtForm>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::CREATE)?;
    if body.indication.trim().len() < 3 {
        return Err(AppError::BadRequest(
            "Record the indication for the scan".to_owned(),
        ));
    }
    if !body.woman_declares || !body.doctor_declares {
        return Err(AppError::BadRequest(
            "Form F needs both declarations: the woman's and the doctor's".to_owned(),
        ));
    }
    if body.living_sons.is_some_and(|n| n < 0) || body.living_daughters.is_some_and(|n| n < 0) {
        return Err(AppError::BadRequest(
            "Children cannot be negative".to_owned(),
        ));
    }
    let patient: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM pcpndt_forms WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, PcpndtForm>(
        "UPDATE pcpndt_forms SET indication = $3, performing_doctor_id = $4, living_sons = $5, \
           living_daughters = $6, self_referred = $7, result_summary = $8, \
           woman_declared_at = COALESCE(woman_declared_at, now()), \
           doctor_declared_at = COALESCE(doctor_declared_at, now()), \
           doctor_declared_by = COALESCE(doctor_declared_by, $9), \
           form_signed_at = COALESCE(form_signed_at, now()), gender_disclosure_blocked = true, \
           status = CASE WHEN status = 'draft' THEN 'submitted'::pcpndt_form_status ELSE status END \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.indication.trim())
    .bind(body.performing_doctor_id)
    .bind(body.living_sons)
    .bind(body.living_daughters)
    .bind(body.self_referred)
    .bind(body.result_summary.as_deref().map(str::trim).filter(|r| !r.is_empty()))
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
