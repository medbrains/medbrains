//! Submit an insurance claim / pre-authorisation to NHCX.
//!
//! Assembles a FHIR R4 transaction `Bundle` (Patient + Coverage + Claim) from the
//! `medbrains-fhir` mappers and queues the existing `abdm.nhcx.claim_submit` outbox
//! event, which the outbox handler encrypts (JWE/JWS) and posts to the NHCX gateway.
//! The async payer response arrives at the NHCX callback receiver.
//!
//! `recipient_code` (the payer's registered HCX id) is an explicit request field —
//! our `insurance_provider` is free text and there is no payer-HCX directory yet.

use axum::Json;
use axum::extract::{Path, State};
use axum::extract::Extension;
use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;
use medbrains_core::nhcx::{
    CLAIM_BUNDLE_PROFILE, CONFIDENTIALITY_SYSTEM, COVERAGE_ELIGIBILITY_BUNDLE_PROFILE,
    SNOMED_HEALTHCARE_PROFESSIONAL_CODE, SNOMED_INSTITUTIONAL_CLAIM_CODE,
};
use medbrains_core::permissions;
use medbrains_fhir::mapper::{ABHA_SYSTEM, PROCESS_PRIORITY_SYSTEM, SNOMED_SYSTEM, UHID_SYSTEM};

#[derive(Debug, Deserialize)]
pub struct SubmitToNhcxRequest {
    /// The payer's registered NHCX participant (HCX) code — the message recipient.
    pub recipient_code: String,
    /// `preauthorization` (default) or `claim`.
    pub r#use: Option<String>,
}

#[derive(Debug, FromRow)]
struct ClaimRow {
    id: Uuid,
    patient_id: Uuid,
    invoice_id: Uuid,
    insurance_provider: String,
    member_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct PatientRow {
    uhid: String,
    abha_id: Option<String>,
    first_name: String,
    last_name: String,
    gender: String,
}

#[derive(Debug, FromRow)]
struct InvoiceLineRow {
    description: String,
    unit_price: Option<rust_decimal::Decimal>,
    line_total: Option<rust_decimal::Decimal>,
}

/// `POST /api/billing/insurance-claims/{id}/submit-to-nhcx`
pub async fn submit_claim_to_nhcx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitToNhcxRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;
    if body.recipient_code.trim().is_empty() {
        return Err(AppError::BadRequest(
            "recipient_code (payer HCX id) is required".to_owned(),
        ));
    }
    let use_ = body.r#use.as_deref().unwrap_or("preauthorization").to_owned();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let claim = sqlx::query_as::<_, ClaimRow>(
        "SELECT id, patient_id, invoice_id, insurance_provider, member_id \
         FROM insurance_claims WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let patient = sqlx::query_as::<_, PatientRow>(
        "SELECT uhid, abha_id, first_name, last_name, gender \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let lines = sqlx::query_as::<_, InvoiceLineRow>(
        "SELECT description, unit_price, line_total \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2",
    )
    .bind(claim.invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Assemble the NHCX ClaimBundle exactly per the profile (validated against the
    // official sample bundle): a `collection` bundle with meta.profile + a very-restricted
    // security tag, intra-bundle `urn:uuid` references, and the Organization (insurer),
    // Practitioner (provider) and Coverage resources the Claim references. Diagnoses/items
    // are inline on the Claim (valid FHIR); diagnosis enrichment is a follow-up.
    let patient_urn = format!("urn:uuid:{}", claim.patient_id);
    let claim_urn = format!("urn:uuid:{}", claim.id);
    let coverage_uuid = Uuid::new_v4();
    let insurer_uuid = Uuid::new_v4();
    let provider_uuid = Uuid::new_v4();
    let coverage_urn = format!("urn:uuid:{coverage_uuid}");
    let insurer_urn = format!("urn:uuid:{insurer_uuid}");
    let provider_urn = format!("urn:uuid:{provider_uuid}");
    let now = Utc::now().to_rfc3339();

    let item_json: Vec<serde_json::Value> = lines
        .iter()
        .enumerate()
        .map(|(i, l)| {
            serde_json::json!({
                "sequence": i + 1,
                "productOrService": { "text": l.description },
                "unitPrice": l.unit_price.and_then(|d| d.to_f64())
                    .map(|v| serde_json::json!({ "value": v, "currency": "INR" })),
                "net": l.line_total.and_then(|d| d.to_f64())
                    .map(|v| serde_json::json!({ "value": v, "currency": "INR" })),
            })
        })
        .collect();
    let total: f64 = lines
        .iter()
        .filter_map(|l| l.line_total.and_then(|d| d.to_f64()))
        .sum();

    let mut patient_identifier = vec![serde_json::json!({
        "system": UHID_SYSTEM, "value": patient.uhid
    })];
    if let Some(abha) = patient.abha_id.as_deref().filter(|s| !s.is_empty()) {
        patient_identifier.push(serde_json::json!({
            "system": ABHA_SYSTEM, "value": abha
        }));
    }
    let patient_full_name = format!("{} {}", patient.first_name, patient.last_name);

    let bundle = serde_json::json!({
        "resourceType": "Bundle",
        "id": claim.id,
        "meta": {
            "profile": [CLAIM_BUNDLE_PROFILE],
            "security": [{
                "system": CONFIDENTIALITY_SYSTEM,
                "code": "V", "display": "very restricted"
            }]
        },
        "type": "collection",
        "timestamp": now,
        "entry": [
            { "fullUrl": claim_urn, "resource": {
                "resourceType": "Claim",
                "id": claim.id,
                "status": "active",
                "type": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_INSTITUTIONAL_CLAIM_CODE, "display": "Inpatient care management (procedure)" }] },
                "use": use_,
                "patient": { "reference": patient_urn },
                "created": now,
                "insurer": { "reference": insurer_urn },
                "provider": { "reference": provider_urn },
                "priority": { "coding": [{ "system": PROCESS_PRIORITY_SYSTEM, "code": "normal" }] },
                "careTeam": [{
                    "sequence": 1,
                    "provider": { "reference": provider_urn },
                    "role": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_HEALTHCARE_PROFESSIONAL_CODE, "display": "Healthcare professional (occupation)" }] }
                }],
                "insurance": [{ "sequence": 1, "focal": true, "coverage": { "reference": coverage_urn } }],
                "item": item_json,
                "total": { "value": total, "currency": "INR" }
            }},
            { "fullUrl": patient_urn, "resource": {
                "resourceType": "Patient",
                "id": claim.patient_id,
                "identifier": patient_identifier,
                "name": [{ "text": patient_full_name, "given": [patient.first_name], "family": patient.last_name }],
                "gender": patient.gender
            }},
            { "fullUrl": insurer_urn, "resource": {
                "resourceType": "Organization",
                "id": insurer_uuid,
                "identifier": [{ "value": body.recipient_code.clone() }],
                "name": claim.insurance_provider
            }},
            { "fullUrl": provider_urn, "resource": {
                "resourceType": "Practitioner",
                "id": provider_uuid,
                "name": [{ "text": "Provider" }]
            }},
            { "fullUrl": coverage_urn, "resource": {
                "resourceType": "Coverage",
                "id": coverage_uuid,
                "status": "active",
                "subscriberId": claim.member_id,
                "beneficiary": { "reference": patient_urn },
                "payor": [{ "reference": insurer_urn }]
            }}
        ]
    });

    // Queue the outbox event the NHCX handler consumes (it JWE/JWS-wraps + posts).
    let payload = serde_json::json!({
        "claim_id": claim.id,
        "recipient_code": body.recipient_code,
        "bundle": bundle,
    });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let event_id = medbrains_outbox::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "insurance_claim",
            aggregate_id: Some(claim.id),
            event_type: "abdm.nhcx.claim_submit",
            payload,
            idempotency_key: Some(format!("nhcx-submit:{}", claim.id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("nhcx submit queue failed: {e}")))?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "claim_id": claim.id,
        "queued": true,
        "outbox_event_id": event_id,
    })))
}

/// `POST /api/billing/insurance-claims/{id}/check-eligibility` — queue an NHCX coverage
/// eligibility check for the claim's patient + policy. Same transport as claim submit
/// (the outbox handler routes a CoverageEligibilityRequest bundle to
/// `/hcx/v1/coverageeligibility/check`); the payer's on_check reply lands at the callback.
pub async fn check_coverage_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitToNhcxRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;
    if body.recipient_code.trim().is_empty() {
        return Err(AppError::BadRequest(
            "recipient_code (payer HCX id) is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let claim = sqlx::query_as::<_, ClaimRow>(
        "SELECT id, patient_id, invoice_id, insurance_provider, member_id \
         FROM insurance_claims WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let patient = sqlx::query_as::<_, PatientRow>(
        "SELECT uhid, abha_id, first_name, last_name, gender \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    let patient_urn = format!("urn:uuid:{}", claim.patient_id);
    let elig_uuid = Uuid::new_v4();
    let coverage_uuid = Uuid::new_v4();
    let insurer_uuid = Uuid::new_v4();
    let provider_uuid = Uuid::new_v4();
    let elig_urn = format!("urn:uuid:{elig_uuid}");
    let coverage_urn = format!("urn:uuid:{coverage_uuid}");
    let insurer_urn = format!("urn:uuid:{insurer_uuid}");
    let provider_urn = format!("urn:uuid:{provider_uuid}");
    let now = Utc::now().to_rfc3339();

    let mut patient_identifier = vec![serde_json::json!({
        "system": UHID_SYSTEM, "value": patient.uhid
    })];
    if let Some(abha) = patient.abha_id.as_deref().filter(|s| !s.is_empty()) {
        patient_identifier.push(serde_json::json!({ "system": ABHA_SYSTEM, "value": abha }));
    }
    let patient_full_name = format!("{} {}", patient.first_name, patient.last_name);

    let bundle = serde_json::json!({
        "resourceType": "Bundle",
        "id": claim.id,
        "meta": {
            "profile": [COVERAGE_ELIGIBILITY_BUNDLE_PROFILE],
            "security": [{ "system": CONFIDENTIALITY_SYSTEM, "code": "V", "display": "very restricted" }]
        },
        "type": "collection",
        "timestamp": now,
        "entry": [
            { "fullUrl": elig_urn, "resource": {
                "resourceType": "CoverageEligibilityRequest",
                "id": elig_uuid,
                "status": "active",
                "purpose": ["benefits"],
                "patient": { "reference": patient_urn },
                "created": now,
                "provider": { "reference": provider_urn },
                "insurer": { "reference": insurer_urn },
                "insurance": [{ "focal": true, "coverage": { "reference": coverage_urn } }]
            }},
            { "fullUrl": patient_urn, "resource": {
                "resourceType": "Patient",
                "id": claim.patient_id,
                "identifier": patient_identifier,
                "name": [{ "text": patient_full_name, "given": [patient.first_name], "family": patient.last_name }],
                "gender": patient.gender
            }},
            { "fullUrl": insurer_urn, "resource": {
                "resourceType": "Organization",
                "id": insurer_uuid,
                "identifier": [{ "value": body.recipient_code.clone() }],
                "name": claim.insurance_provider
            }},
            { "fullUrl": provider_urn, "resource": {
                "resourceType": "Practitioner", "id": provider_uuid, "name": [{ "text": "Provider" }]
            }},
            { "fullUrl": coverage_urn, "resource": {
                "resourceType": "Coverage",
                "id": coverage_uuid,
                "status": "active",
                "subscriberId": claim.member_id,
                "beneficiary": { "reference": patient_urn },
                "payor": [{ "reference": insurer_urn }]
            }}
        ]
    });

    let payload = serde_json::json!({
        "claim_id": claim.id,
        "recipient_code": body.recipient_code,
        "bundle": bundle,
    });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let event_id = medbrains_outbox::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "insurance_claim",
            aggregate_id: Some(claim.id),
            event_type: "abdm.nhcx.claim_submit",
            payload,
            idempotency_key: Some(format!("nhcx-eligibility:{}", claim.id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("nhcx eligibility queue failed: {e}")))?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "claim_id": claim.id,
        "queued": true,
        "outbox_event_id": event_id,
    })))
}
