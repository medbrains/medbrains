//! Home delivery from the patient's side: what they may choose for a refill,
//! and where each delivery they asked for has got to. The rules and the work
//! live in `medbrains_pharmacy_delivery`; these handlers bind them to the
//! signed-in patient, whose deliveries are the only ones they can see.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_pharmacy_delivery::choice::{DeliveryOffer, offer};
use medbrains_pharmacy_delivery::tracking::{PatientDelivery, patient_deliveries};
use medbrains_server_core::{error::AppError, state::AppState};
use uuid::Uuid;

use super::portal::PatientClaims;

/// `GET /api/portal/prescriptions/{id}/delivery-options`
#[tracing::instrument(skip_all)]
pub async fn portal_delivery_options(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(prescription_id): Path<Uuid>,
) -> Result<Json<DeliveryOffer>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let offered = offer(&mut tx, claims.tenant_id, claims.pid, prescription_id).await?;
    tx.commit().await?;
    Ok(Json(offered))
}

/// `GET /api/portal/deliveries` — the patient's delivery requests, newest first.
#[tracing::instrument(skip_all)]
pub async fn portal_deliveries(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PatientDelivery>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = patient_deliveries(&mut tx, claims.tenant_id, claims.pid, None).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/portal/deliveries/{id}` — one of theirs; anyone else's is 404.
#[tracing::instrument(skip_all)]
pub async fn portal_delivery(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PatientDelivery>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = patient_deliveries(&mut tx, claims.tenant_id, claims.pid, Some(id))
        .await?
        .into_iter()
        .next()
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
