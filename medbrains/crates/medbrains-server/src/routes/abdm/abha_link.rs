//! Link a verified (or newly created) ABHA to an existing patient.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_patients::abha_link::{AbhaField, AbhaLinkRequest, link_verified_abha};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct LinkToPatient {
    pub patient_id: Uuid,
    #[serde(default)]
    pub apply: Vec<AbhaField>,
}

/// `POST /api/abdm/abha/verifications/{id}/link` — link the verified ABHA to an
/// existing patient, taking the demographics staff chose from it.
///
/// Scan & Share's "Find existing patient" links through here too, for a
/// patient the desk found by search; the share's `complete` then accepts that
/// patient because this verification names it.
///
/// # Errors
/// 403 without `abdm.abha.manage` and `patients.update`; 404 for a patient the
/// caller cannot reach (503 when that cannot be decided); 409 when the ABHA is
/// on another patient or the patient has a different ABHA; 400 when the
/// verification cannot be used.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkToPatient>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    require_permission(&claims, permissions::patients::UPDATE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    link_verified_abha(
        &mut tx,
        AbhaLinkRequest {
            tenant_id: claims.tenant_id,
            user_id: claims.sub,
            patient_id: body.patient_id,
            verification_id: id,
            expected_abha: None,
            apply: &body.apply,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "linked": true })))
}
