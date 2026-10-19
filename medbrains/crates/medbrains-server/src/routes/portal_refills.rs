//! Refill requests from the patient portal and the patient apps. The rules
//! and the work live in `medbrains_pharmacy_repeats::requests`; these handlers
//! only bind them to the signed-in patient.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_pharmacy_delivery::choice::{DeliveryChoice, check_choice, record_choice};
use medbrains_pharmacy_delivery::source::Source;
use medbrains_pharmacy_repeats::requests::{
    PatientRefill, RefillRequest, create_request, patient_refills,
};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::Deserialize;
use uuid::Uuid;

use super::portal::PatientClaims;

/// `GET /api/portal/refills` — the patient's recent prescriptions, and what
/// asking for a refill of each would do.
#[tracing::instrument(skip_all)]
pub async fn portal_refills(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PatientRefill>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = patient_refills(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RefillRequestBody {
    pub note: Option<String>,
    /// Home delivery; absent for pickup at the pharmacy.
    pub delivery: Option<DeliveryChoice>,
}

/// `POST /api/portal/prescriptions/{id}/refill-request`
#[tracing::instrument(skip_all)]
pub async fn portal_request_refill(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(prescription_id): Path<Uuid>,
    Json(body): Json<RefillRequestBody>,
) -> Result<Json<RefillRequest>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Delivery is checked first: when it isn't offered, the patient is told
    // why and nothing is requested.
    let delivery = match &body.delivery {
        Some(choice) => Some(
            check_choice(
                &mut tx,
                claims.tenant_id,
                claims.pid,
                prescription_id,
                choice,
            )
            .await?,
        ),
        None => None,
    };
    let request = create_request(
        &mut tx,
        claims.tenant_id,
        claims.pid,
        prescription_id,
        body.note.as_deref(),
    )
    .await?;
    if let Some(choice) = &delivery {
        record_choice(&mut tx, claims.tenant_id, Source::Refill(request.id), choice).await?;
    }
    tx.commit().await?;
    Ok(Json(request))
}
