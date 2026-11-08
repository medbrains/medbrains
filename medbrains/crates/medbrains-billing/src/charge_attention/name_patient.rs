//! Name the patient on a consignment implant the store recorded as used on
//! no one (`implant_no_patient`, revenue integrity wave 1.2), so the desk can
//! post its charge and the vendor's record says who received it.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_kernel::Actor;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Deserialize;
use uuid::Uuid;

use super::{ChargeAttentionItem, fetch, kinds, lock_open};

#[derive(Debug, Deserialize)]
pub struct NamePatientRequest {
    pub patient_id: Uuid,
}

/// `PUT /api/billing/charge-attention/{id}/patient` — name the patient a
/// consignment implant was used on, so the desk can post its charge.
///
/// Only an open `implant_no_patient` row with no patient yet; the usage
/// movement is linked to the patient too, so the vendor's consignment record
/// names who received it. The row stays open for the desk to post.
pub async fn name_patient_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NamePatientRequest>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    let kinds = kinds(&claims, true)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let item = lock_open(&mut tx, &claims, kinds, id).await?;
    require_row_access(&state, &claims, item.patient_id).await?;
    if item.reason != medbrains_server_services::billing::REASON_IMPLANT_NO_PATIENT
        || item.patient_id.is_some()
    {
        return Err(AppError::Conflict(
            "This charge already names its patient.".to_owned(),
        ));
    }
    require_row_access(&state, &claims, Some(body.patient_id)).await?;
    // The charge lands on the patient's current admission, if any: the bill
    // the discharge desk settles.
    sqlx::query(
        "UPDATE charge_attention_items SET patient_id = $3, \
                encounter_id = (SELECT ad.encounter_id FROM admissions ad \
                                 WHERE ad.tenant_id = $2 AND ad.patient_id = $3 \
                                   AND ad.status = 'admitted' \
                                 ORDER BY ad.admitted_at DESC LIMIT 1) \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE store_stock_movements SET patient_id = $3 \
          WHERE id = $1 AND tenant_id = $2 AND reference_type = 'consignment_usage' \
            AND patient_id IS NULL",
    )
    .bind(item.source_entity_id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .execute(&mut *tx)
    .await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The caller may work this row's patient's bill. A row with no patient
/// named is worked only by a desk that may bill every patient: a desk scoped
/// to some patients is not shown it (the list filter), so it answers 404.
pub(super) async fn require_row_access(
    state: &AppState,
    claims: &Claims,
    patient_id: Option<Uuid>,
) -> Result<(), AppError> {
    match patient_id {
        Some(p) => medbrains_authz_gate::require_patient_billing_access(state, claims, p).await,
        None => {
            let scope =
                medbrains_authz_gate::require_patient_billing_filter(state, claims, None).await?;
            if scope.is_some() {
                return Err(AppError::NotFound);
            }
            Ok(())
        }
    }
}
