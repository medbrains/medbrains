//! A patient's own privacy controls, from the portal and the patient apps
//! (DPDP Act s.6(4), s.11-14): what they agreed to and the switch to change
//! it, what the hospital holds about them, and their rights requests — made
//! and followed by the patient, with the same rules the desk applies.

use axum::{Extension, Json, extract::State};
use medbrains_patients::dpdp_consent::{self, DpdpConsentInput, PatientDpdpConsent};
use medbrains_patients::privacy_requests::{
    self, CreatePrivacyRequest, PatientDataSummary, PrivacyRequest,
};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};

use super::portal::PatientClaims;

#[derive(Debug, Serialize)]
pub struct PortalPrivacy {
    pub consent: PatientDpdpConsent,
    pub requests: Vec<PrivacyRequest>,
    pub held: PatientDataSummary,
}

/// `GET /api/portal/privacy`
#[tracing::instrument(skip_all)]
pub async fn portal_privacy(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<PortalPrivacy>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consent = dpdp_consent::read(&mut tx, claims.tenant_id, claims.pid).await?;
    let requests =
        privacy_requests::requests_for_patient(&mut tx, claims.tenant_id, claims.pid).await?;
    let held = privacy_requests::data_summary(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(PortalPrivacy {
        consent,
        requests,
        held,
    }))
}

/// `PUT /api/portal/dpdp-consent` — the patient changes what they agreed to.
/// Withdrawing here is as easy as agreeing was at the desk.
#[tracing::instrument(skip_all)]
pub async fn portal_set_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<DpdpConsentInput>,
) -> Result<Json<PatientDpdpConsent>, AppError> {
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // The patient records it themselves; no staff member is the recorder.
    dpdp_consent::insert_by_patient(&mut tx, (claims.tenant_id, claims.pid), &body).await?;
    let consent = dpdp_consent::read(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(consent))
}

#[derive(Debug, Deserialize)]
pub struct PortalPrivacyRequest {
    pub request_type: String,
    pub details: String,
    pub nominee_name: Option<String>,
    pub nominee_relation: Option<String>,
    pub nominee_contact: Option<String>,
}

/// `POST /api/portal/privacy-requests` — the patient makes a request.
#[tracing::instrument(skip_all)]
pub async fn portal_create_request(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<PortalPrivacyRequest>,
) -> Result<Json<PrivacyRequest>, AppError> {
    let request = CreatePrivacyRequest {
        patient_id: claims.pid,
        request_type: body.request_type,
        details: body.details,
        received_via: Some("portal".to_owned()),
        nominee_name: body.nominee_name,
        nominee_relation: body.nominee_relation,
        nominee_contact: body.nominee_contact,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = privacy_requests::record_request(&mut tx, (claims.tenant_id, None), &request).await?;
    tx.commit().await?;
    Ok(Json(row))
}
