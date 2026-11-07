//! `GET /api/pharmacy/patients/{id}/dispense-context` — the patient as the
//! dispensing pharmacist needs them: who they are and which drugs they react to.
//!
//! The pharmacist on an order usually has no relationship with the patient, so
//! the general patient reads answer 404 and the allergy banner vanished from
//! the dispense screen. This read is gated by `require_patient_pharmacy_access`
//! and returns identity and drug allergies only: no notes, no insurance, no
//! next of kin, no balance.

use axum::Extension;
use axum::{
    Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
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

    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let patient = sqlx::query!(
        "SELECT uhid, first_name, last_name, no_known_allergies \
           FROM patients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
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
        uhid: patient.uhid,
        full_name: format!("{} {}", patient.first_name, patient.last_name)
            .trim()
            .to_owned(),
        no_known_allergies: patient.no_known_allergies,
        drug_allergies,
    }))
}
