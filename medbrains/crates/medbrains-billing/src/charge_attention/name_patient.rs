//! Name the patient on a consignment implant the store recorded as used on
//! no one (`implant_no_patient`, revenue integrity wave 1.2), so the desk can
//! post its charge and the vendor's record says who received it.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_kernel::Actor;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use medbrains_server_services::billing::{REASON_IMPLANT_NO_PATIENT, require_live_patient};
use serde::Deserialize;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{ChargeAttentionItem, fetch, kinds, lock_open};

#[derive(Debug, Deserialize)]
pub struct NamePatientRequest {
    pub patient_id: Uuid,
}

/// `PUT /api/billing/charge-attention/{id}/patient` — name the patient a
/// consignment implant was used on, so the desk can post its charge.
///
/// Only an open `implant_no_patient` row. While it is open the desk may name
/// a different patient (a wrong pick); every naming is audited with the old
/// and new patient. The usage movement is renamed with it, so the vendor's
/// consignment record names who received it; 409 when that record is gone or
/// already names someone else. The row stays open for the desk to post.
/// Needs `billing.leakage.name_implant_recipient` as well as the row's
/// resolve permission: naming rewrites the store's consignment record.
pub async fn name_patient_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NamePatientRequest>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    medbrains_kernel::require_permission(
        &claims,
        medbrains_core::permissions::billing::leakage::NAME_IMPLANT_RECIPIENT,
    )?;
    let kinds = kinds(&claims, true)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let item = lock_open(&mut tx, &claims, kinds, id).await?;
    require_row_access(&state, &claims, item.patient_id).await?;
    if item.reason != REASON_IMPLANT_NO_PATIENT {
        return Err(AppError::Conflict(
            "Only an implant used without a patient can be named.".to_owned(),
        ));
    }
    require_row_access(&state, &claims, Some(body.patient_id)).await?;
    require_live_patient(&mut tx, claims.tenant_id, body.patient_id).await?;
    rename_usage(&mut tx, &claims, &item, body.patient_id).await?;
    // The charge lands on the patient's current admission, if any: the bill
    // the discharge desk settles.
    sqlx::query(
        "UPDATE charge_attention_items SET patient_id = $3, \
                encounter_id = (SELECT ad.encounter_id FROM admissions ad \
                                 WHERE ad.tenant_id = $2 AND ad.patient_id = $3 \
                                   AND ad.status = 'admitted' \
                                   AND ad.deleted_at IS NULL AND NOT ad.is_dummy \
                                 ORDER BY ad.admitted_at DESC LIMIT 1) \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .execute(&mut *tx)
    .await?;
    audit_naming(&mut tx, &claims, &item, body.patient_id).await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Point the consignment usage record at the named patient. It must still
/// exist and name either no one or the row's current patient; otherwise the
/// two records disagree and the naming is refused with 409.
async fn rename_usage(
    conn: &mut PgConnection,
    claims: &Claims,
    item: &ChargeAttentionItem,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let changed = sqlx::query(
        "UPDATE store_stock_movements SET patient_id = $3 \
          WHERE id = $1 AND tenant_id = $2 AND reference_type = 'consignment_usage' \
            AND deleted_at IS NULL AND patient_id IS NOT DISTINCT FROM $4",
    )
    .bind(item.source_entity_id)
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(item.patient_id)
    .execute(&mut *conn)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(AppError::Conflict(
            "The store's usage record is missing or names another patient.".to_owned(),
        ));
    }
    Ok(())
}

/// Audit the naming: the row, the usage record, and the old and new patient.
async fn audit_naming(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    item: &ChargeAttentionItem,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let old = serde_json::json!({ "patient_id": item.patient_id });
    let new = serde_json::json!({
        "patient_id": patient_id,
        "store_stock_movement_id": item.source_entity_id,
    });
    medbrains_kernel::audit(
        tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "billing.charge_attention.patient_named",
            entity_type: "charge_attention_items",
            entity_id: Some(item.id),
            old_values: Some(&old),
            new_values: Some(&new),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
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
