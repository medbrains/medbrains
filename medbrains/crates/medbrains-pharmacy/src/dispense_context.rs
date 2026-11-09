//! `GET /api/pharmacy/patients/{id}/dispense-context` — the patient as the
//! dispensing pharmacist needs them: who they are and which drugs they react to.
//!
//! The pharmacist on an order usually has no relationship with the patient, so
//! the general patient reads answer 404 and the allergy banner vanished from
//! the dispense screen. This read is gated by `require_patient_pharmacy_access`
//! and returns identity and drug allergies only: no notes, no insurance, no
//! next of kin, no balance. Name and UHID are masked per the caller's field
//! access exactly as the patient record masks them.

use axum::Extension;
use axum::{
    Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::field_access::resolve_restricted_fields;
use medbrains_server_core::state::AppState;
use medbrains_server_services::patient_identity::patient_identities;
use serde::Serialize;
use uuid::Uuid;

/// The most allergy rows the dispense screen reads.
const ALLERGY_LIMIT: i64 = 200;

/// One documented drug allergy.
#[derive(Debug, Serialize)]
pub struct DispenseAllergy {
    pub allergen_name: String,
    pub severity: Option<String>,
    pub reaction: Option<String>,
}

/// Identity and drug allergies, nothing else.
#[derive(Debug, Serialize)]
pub struct DispenseContext {
    pub patient_id: Uuid,
    pub uhid: String,
    pub full_name: String,
    /// `None` when nobody has asked; `Some(true)` only when recorded as none.
    pub no_known_allergies: Option<bool>,
    pub drug_allergies: Vec<DispenseAllergy>,
}

/// Returns the dispensing view of one patient.
pub async fn patient_dispense_context(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<DispenseContext>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;
    medbrains_authz_gate::require_patient_pharmacy_access(&state, &claims, patient_id).await?;

    let restricted =
        resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let no_known_allergies = sqlx::query_scalar!(
        "SELECT no_known_allergies FROM patients \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let identity = patient_identities(&mut tx, claims.tenant_id, &[patient_id], &restricted)
        .await?
        .pop()
        .ok_or(AppError::NotFound)?;
    let drug_allergies = sqlx::query_as!(
        DispenseAllergy,
        "SELECT allergen_name, severity::text AS severity, reaction \
           FROM patient_allergies \
          WHERE patient_id = $1 AND tenant_id = $2 AND is_active \
            AND allergy_type = 'drug' AND deleted_at IS NULL \
          ORDER BY allergen_name \
          LIMIT $3",
        patient_id,
        claims.tenant_id,
        ALLERGY_LIMIT,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(DispenseContext {
        patient_id,
        uhid: identity.uhid,
        full_name: identity.full_name,
        no_known_allergies,
        drug_allergies,
    }))
}

/// Refuses a dispense to a patient whose allergy status nobody has recorded —
/// no active drug allergy on file (as the dispense screen's card reads it), and "no known allergies" never noted — unless
/// the pharmacist acknowledges it, and files the acknowledgement with the
/// dispense. An empty allergy list reads as a clean one; this one is unknown.
///
/// # Errors
/// `BadRequest` (filed as refused) without the acknowledgement; the database.
pub(crate) async fn require_allergy_status_known(
    state: &AppState,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    subject: &crate::rx_safety::Subject,
    acknowledged: bool,
) -> Result<(), AppError> {
    let unknown: bool = sqlx::query_scalar(
        "SELECT p.no_known_allergies IS NULL \
                AND NOT EXISTS (SELECT 1 FROM patient_allergies a \
                                 WHERE a.patient_id = p.id AND a.tenant_id = p.tenant_id \
                                   AND a.is_active AND a.allergy_type = 'drug' \
                                   AND a.deleted_at IS NULL) \
           FROM patients p WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(subject.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .unwrap_or(true);
    if !unknown {
        return Ok(());
    }
    if !acknowledged {
        let refusal = AppError::BadRequest(
            "This patient's allergy status is unknown: no allergy is recorded and nobody has \
             noted \"no known allergies\". Ask the patient, then acknowledge it to dispense."
                .to_owned(),
        );
        crate::rx_safety::file_dispense_refusal(
            state,
            claims,
            subject,
            crate::rx_safety::ALLERGY_UNKNOWN,
            &refusal,
        )
        .await;
        return Err(refusal);
    }
    crate::rx_safety::record_in_tx(
        tx,
        claims,
        subject,
        &[crate::rx_safety::allergy_unknown_finding()],
        None,
    )
    .await
}
