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
use medbrains_fhir::mapper::{
    ClaimItemView, ClaimView, CoverageView, PatientView, claim_to_fhir, coverage_to_fhir,
    patient_to_fhir,
};
use medbrains_fhir::r4::Resource;
use medbrains_fhir::r4::bundle::{Bundle, BundleEntry, BundleType};
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;
use medbrains_core::permissions;

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
    policy_number: Option<String>,
    member_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct PatientRow {
    id: Uuid,
    uhid: String,
    abha_id: Option<String>,
    prefix: Option<String>,
    first_name: String,
    middle_name: Option<String>,
    last_name: String,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    phone: Option<String>,
    email: Option<String>,
}

#[derive(Debug, FromRow)]
struct InvoiceLineRow {
    description: String,
    charge_code: Option<String>,
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
        "SELECT id, patient_id, invoice_id, insurance_provider, policy_number, member_id \
         FROM insurance_claims WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let patient = sqlx::query_as::<_, PatientRow>(
        "SELECT id, uhid, abha_id, prefix, first_name, middle_name, last_name, gender, \
         date_of_birth, phone, email FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let lines = sqlx::query_as::<_, InvoiceLineRow>(
        "SELECT description, charge_code, unit_price, line_total \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2",
    )
    .bind(claim.invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Build the FHIR resources from the internal views.
    let patient_view = PatientView {
        id: patient.id,
        uhid: patient.uhid,
        abha_id: patient.abha_id,
        prefix: patient.prefix,
        first_name: patient.first_name,
        middle_name: patient.middle_name,
        last_name: patient.last_name,
        gender: patient.gender,
        date_of_birth: patient.date_of_birth,
        phone: patient.phone,
        email: patient.email,
        is_active: true,
    };
    let fhir_patient = patient_to_fhir(&patient_view);

    let coverage_view = CoverageView {
        id: claim.id,
        patient_id: claim.patient_id,
        status: "active".to_owned(),
        policy_number: claim.policy_number.clone(),
        subscriber_id: claim.member_id.clone(),
        insurer_name: claim.insurance_provider.clone(),
        insurer_id: None,
    };
    let fhir_coverage = coverage_to_fhir(&coverage_view);

    let items: Vec<ClaimItemView> = lines
        .into_iter()
        .map(|l| ClaimItemView {
            name: l.description,
            code: l.charge_code,
            unit_price: l.unit_price.and_then(|d| d.to_f64()),
            net: l.line_total.and_then(|d| d.to_f64()),
        })
        .collect();
    let total = items.iter().filter_map(|i| i.net).sum::<f64>();

    let claim_view = ClaimView {
        id: claim.id,
        patient_id: claim.patient_id,
        use_,
        status: "active".to_owned(),
        created: Utc::now(),
        insurer_name: claim.insurance_provider,
        insurer_id: None,
        provider_id: claims.tenant_id,
        provider_name: "Provider".to_owned(),
        priority: "normal".to_owned(),
        coverage_id: claim.id,
        // ponytail: diagnoses enrichment (join encounter diagnoses) is a follow-up;
        // items carry the claimed amounts which is what adjudication needs first.
        diagnoses: Vec::new(),
        items,
        total: Some(total),
    };
    let fhir_claim = claim_to_fhir(&claim_view);

    // FHIR transaction Bundle: Patient + Coverage + Claim.
    let bundle = Bundle {
        id: claim.id.to_string(),
        r#type: BundleType::Transaction,
        timestamp: Utc::now().to_rfc3339(),
        total: None,
        entry: vec![
            BundleEntry {
                full_url: Some(format!("Patient/{}", claim.patient_id)),
                resource: Resource::Patient(fhir_patient),
            },
            BundleEntry {
                full_url: Some(format!("Coverage/{}", claim.id)),
                resource: Resource::Coverage(fhir_coverage),
            },
            BundleEntry {
                full_url: Some(format!("Claim/{}", claim.id)),
                resource: Resource::Claim(fhir_claim),
            },
        ],
    };

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
