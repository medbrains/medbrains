//! Submit an insurance claim / pre-authorisation to NHCX, or check coverage
//! eligibility.
//!
//! Assembles a FHIR R4 bundle (per the NHCX `ClaimBundle` /
//! `CoverageEligibilityRequestBundle` profiles) and, in one transaction,
//! records the HCX correlation / api-call / workflow ids on the claim and
//! queues an `nhcx.*` outbox event. The outbox handler encrypts the bundle for
//! the payer and posts it to the gateway; the payer's answer arrives at the
//! callback receiver, which finds the claim by that correlation id.
//!
//! `recipient_code` is the payer's HCX participant code, chosen from the NHCX
//! payer directory — which must hold the payer's encryption certificate.

use axum::Json;
use axum::extract::Extension;
use axum::extract::{Path, State};
use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{
    CLAIM_BUNDLE_PROFILE, CONFIDENTIALITY_SYSTEM, COVERAGE_ELIGIBILITY_BUNDLE_PROFILE,
    NhcxOperation, SNOMED_HEALTHCARE_PROFESSIONAL_CODE, SNOMED_INSTITUTIONAL_CLAIM_CODE,
};
use medbrains_core::permissions;
use medbrains_fhir::mapper::{ABHA_SYSTEM, PROCESS_PRIORITY_SYSTEM, SNOMED_SYSTEM, UHID_SYSTEM};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

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

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// `POST /api/billing/insurance-claims/{id}/submit-to-nhcx`
///
/// # Errors
/// 503 until the hospital has an NHCX participant code; 400 for a payer not in
/// the directory or without an encryption certificate; 409 while a message
/// for this claim is still waiting to be sent; 404 for an unknown claim.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit_claim_to_nhcx(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitToNhcxRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let recipient = required_recipient(&body)?;
    let use_ = body.r#use.as_deref().unwrap_or("preauthorization");
    let operation = if use_ == "claim" {
        NhcxOperation::Claim
    } else {
        NhcxOperation::Preauth
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    let (claim, patient) = load_claim(&state, &claims, &mut tx, id).await?;
    let lines = sqlx::query_as::<_, InvoiceLineRow>(
        "SELECT description, unit_price, total_price AS line_total \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2",
    )
    .bind(claim.invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let bundle = claim_bundle(&claim, &patient, recipient, use_, &lines);
    let queued = queue_message(&mut tx, &claims, claim.id, recipient, operation, &bundle).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

/// `POST /api/billing/insurance-claims/{id}/check-eligibility` — queue an NHCX
/// coverage eligibility check for the claim's patient and policy; the payer's
/// `on_check` reply lands at the callback receiver.
///
/// # Errors
/// As for [`submit_claim_to_nhcx`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn check_coverage_eligibility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitToNhcxRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let recipient = required_recipient(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    let (claim, patient) = load_claim(&state, &claims, &mut tx, id).await?;

    let bundle = eligibility_bundle(&claim, &patient, recipient);
    let operation = NhcxOperation::CoverageEligibility;
    let queued = queue_message(&mut tx, &claims, claim.id, recipient, operation, &bundle).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

fn required_recipient(body: &SubmitToNhcxRequest) -> Result<&str, AppError> {
    let code = body.recipient_code.trim();
    if code.is_empty() {
        return Err(AppError::BadRequest(
            "recipient_code (payer HCX id) is required".to_owned(),
        ));
    }
    Ok(code)
}

/// The claim and its patient. The path names a claim, so the access check goes
/// on `claim.patient_id` — the patient whose name, UHID, ABHA id and gender
/// are bound for an external payer.
async fn load_claim(
    state: &AppState,
    claims: &Claims,
    tx: &mut Tx<'_>,
    id: Uuid,
) -> Result<(ClaimRow, PatientRow), AppError> {
    let claim = sqlx::query_as::<_, ClaimRow>(
        "SELECT id, patient_id, invoice_id, insurance_provider, member_id \
         FROM insurance_claims WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, claim.patient_id).await?;
    let patient = sqlx::query_as::<_, PatientRow>(
        "SELECT uhid, abha_id, first_name, last_name, gender::text AS gender \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok((claim, patient))
}

/// Refuse a payer the handler could not encrypt for — before anything is queued.
async fn require_payer_certificate(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    recipient: &str,
) -> Result<(), AppError> {
    let has_cert: Option<bool> = sqlx::query_scalar(
        "SELECT COALESCE(btrim(encryption_cert), '') <> '' FROM nhcx_participants \
         WHERE tenant_id = $1 AND participant_code = $2 AND is_active",
    )
    .bind(tenant_id)
    .bind(recipient)
    .fetch_optional(&mut **tx)
    .await?;
    match has_cert {
        Some(true) => Ok(()),
        Some(false) => Err(AppError::BadRequest(format!(
            "payer {recipient} has no encryption certificate — add it in the NHCX payer directory"
        ))),
        None => Err(AppError::BadRequest(format!(
            "payer {recipient} is not in the NHCX payer directory"
        ))),
    }
}

/// Record the exchange ids on the claim and queue the message — one
/// transaction, so a callback can never arrive for a claim that does not
/// know its correlation id.
async fn queue_message(
    tx: &mut Tx<'_>,
    claims: &Claims,
    claim_id: Uuid,
    recipient: &str,
    operation: NhcxOperation,
    bundle: &Value,
) -> Result<Value, AppError> {
    require_payer_certificate(tx, claims.tenant_id, recipient).await?;
    let correlation_id = Uuid::new_v4();
    let api_call_id = Uuid::new_v4();
    // A message queued in the last 15 minutes is still on its way; a second
    // would reach the payer twice. Older than that the outbox has given up on
    // it, and the desk may send again.
    let workflow_id: Uuid = sqlx::query_scalar(
        "UPDATE insurance_claims SET nhcx_correlation_id = $1, nhcx_api_call_id = $2, \
                nhcx_workflow_id = COALESCE(nhcx_workflow_id, $3), nhcx_recipient_code = $4, \
                nhcx_status = 'queued', nhcx_disposition = NULL, nhcx_outcome = NULL, \
                nhcx_response_payload = NULL, nhcx_response_at = NULL \
         WHERE id = $5 AND tenant_id = $6 \
           AND NOT (nhcx_status IS NOT DISTINCT FROM 'queued' \
                    AND updated_at > now() - interval '15 minutes') \
         RETURNING nhcx_workflow_id",
    )
    .bind(correlation_id)
    .bind(api_call_id)
    .bind(Uuid::new_v4())
    .bind(recipient)
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "a message for this claim is still on its way to NHCX — wait for it to be sent"
                .to_owned(),
        )
    })?;

    let event_id = medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "insurance_claim",
            aggregate_id: Some(claim_id),
            event_type: operation.event_type(),
            payload: json!({
                "claim_id": claim_id,
                "recipient_code": recipient,
                "correlation_id": correlation_id,
                "api_call_id": api_call_id,
                "workflow_id": workflow_id,
                "bundle": bundle,
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("nhcx queue failed: {e}")))?;

    Ok(json!({
        "claim_id": claim_id,
        "queued": true,
        "correlation_id": correlation_id,
        "outbox_event_id": event_id,
    }))
}

/// The intra-bundle references both bundle kinds share.
struct Urns {
    patient: String,
    coverage: (Uuid, String),
    insurer: (Uuid, String),
    provider: (Uuid, String),
}

impl Urns {
    fn new(patient_id: Uuid) -> Self {
        let fresh = || {
            let id = Uuid::new_v4();
            (id, format!("urn:uuid:{id}"))
        };
        Self {
            patient: format!("urn:uuid:{patient_id}"),
            coverage: fresh(),
            insurer: fresh(),
            provider: fresh(),
        }
    }
}

/// Patient, insurer, provider and coverage — the entries both bundles carry
/// after their focal resource.
fn shared_entries(c: &ClaimRow, p: &PatientRow, recipient: &str, urns: &Urns) -> [Value; 4] {
    let mut identifier = vec![json!({ "system": UHID_SYSTEM, "value": p.uhid })];
    if let Some(abha) = p.abha_id.as_deref().filter(|s| !s.is_empty()) {
        identifier.push(json!({ "system": ABHA_SYSTEM, "value": abha }));
    }
    let full_name = format!("{} {}", p.first_name, p.last_name);
    [
        json!({ "fullUrl": urns.patient, "resource": {
            "resourceType": "Patient",
            "id": c.patient_id,
            "identifier": identifier,
            "name": [{ "text": full_name, "given": [p.first_name], "family": p.last_name }],
            "gender": p.gender
        }}),
        json!({ "fullUrl": urns.insurer.1, "resource": {
            "resourceType": "Organization",
            "id": urns.insurer.0,
            "identifier": [{ "value": recipient }],
            "name": c.insurance_provider
        }}),
        json!({ "fullUrl": urns.provider.1, "resource": {
            "resourceType": "Practitioner", "id": urns.provider.0, "name": [{ "text": "Provider" }]
        }}),
        json!({ "fullUrl": urns.coverage.1, "resource": {
            "resourceType": "Coverage",
            "id": urns.coverage.0,
            "status": "active",
            "subscriberId": c.member_id,
            "beneficiary": { "reference": urns.patient },
            "payor": [{ "reference": urns.insurer.1 }]
        }}),
    ]
}

fn bundle(id: Uuid, profile: &str, focal: Value, rest: [Value; 4], now: &str) -> Value {
    let mut entry = vec![focal];
    entry.extend(rest);
    json!({
        "resourceType": "Bundle",
        "id": id,
        "meta": {
            "profile": [profile],
            "security": [{ "system": CONFIDENTIALITY_SYSTEM, "code": "V", "display": "very restricted" }]
        },
        "type": "collection",
        "timestamp": now,
        "entry": entry
    })
}

/// The NHCX `ClaimBundle` (validated against the official sample): a Claim
/// with inline items, then the shared entries.
fn claim_bundle(
    claim: &ClaimRow,
    patient: &PatientRow,
    recipient: &str,
    use_: &str,
    lines: &[InvoiceLineRow],
) -> Value {
    let urns = Urns::new(claim.patient_id);
    let now = Utc::now().to_rfc3339();
    let money = |d: Option<rust_decimal::Decimal>| {
        d.and_then(|d| d.to_f64())
            .map(|v| json!({ "value": v, "currency": "INR" }))
    };
    let items: Vec<Value> = lines
        .iter()
        .enumerate()
        .map(|(i, l)| {
            json!({
                "sequence": i + 1,
                "productOrService": { "text": l.description },
                "unitPrice": money(l.unit_price),
                "net": money(l.line_total),
            })
        })
        .collect();
    let total: f64 = lines
        .iter()
        .filter_map(|l| l.line_total.and_then(|d| d.to_f64()))
        .sum();
    let focal = json!({ "fullUrl": format!("urn:uuid:{}", claim.id), "resource": {
        "resourceType": "Claim",
        "id": claim.id,
        "status": "active",
        "type": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_INSTITUTIONAL_CLAIM_CODE, "display": "Inpatient care management (procedure)" }] },
        "use": use_,
        "patient": { "reference": urns.patient },
        "created": now,
        "insurer": { "reference": urns.insurer.1 },
        "provider": { "reference": urns.provider.1 },
        "priority": { "coding": [{ "system": PROCESS_PRIORITY_SYSTEM, "code": "normal" }] },
        "careTeam": [{
            "sequence": 1,
            "provider": { "reference": urns.provider.1 },
            "role": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_HEALTHCARE_PROFESSIONAL_CODE, "display": "Healthcare professional (occupation)" }] }
        }],
        "insurance": [{ "sequence": 1, "focal": true, "coverage": { "reference": urns.coverage.1 } }],
        "item": items,
        "total": { "value": total, "currency": "INR" }
    }});
    let rest = shared_entries(claim, patient, recipient, &urns);
    bundle(claim.id, CLAIM_BUNDLE_PROFILE, focal, rest, &now)
}

/// The NHCX `CoverageEligibilityRequestBundle`.
fn eligibility_bundle(claim: &ClaimRow, patient: &PatientRow, recipient: &str) -> Value {
    let urns = Urns::new(claim.patient_id);
    let now = Utc::now().to_rfc3339();
    let request_id = Uuid::new_v4();
    let focal = json!({ "fullUrl": format!("urn:uuid:{request_id}"), "resource": {
        "resourceType": "CoverageEligibilityRequest",
        "id": request_id,
        "status": "active",
        "purpose": ["benefits"],
        "patient": { "reference": urns.patient },
        "created": now,
        "provider": { "reference": urns.provider.1 },
        "insurer": { "reference": urns.insurer.1 },
        "insurance": [{ "focal": true, "coverage": { "reference": urns.coverage.1 } }]
    }});
    let rest = shared_entries(claim, patient, recipient, &urns);
    bundle(
        claim.id,
        COVERAGE_ELIGIBILITY_BUNDLE_PROFILE,
        focal,
        rest,
        &now,
    )
}

/// Refuse to queue anything for NHCX until this hospital holds an NHCX
/// participant code. Without it nothing can be sent — and a claim accepted
/// here that never reaches the payer is worse than one the desk knows to file
/// on the payer's portal.
async fn require_nhcx_onboarded(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<(), AppError> {
    let code: Option<String> =
        sqlx::query_scalar("SELECT abdm_hcx_sender_code FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_one(&mut **tx)
            .await?;
    if code.as_deref().is_none_or(|c| c.trim().is_empty()) {
        return Err(AppError::ServiceUnavailable(
            "NHCX is not set up for this hospital yet — file this on the payer's portal for now"
                .to_owned(),
        ));
    }
    Ok(())
}
