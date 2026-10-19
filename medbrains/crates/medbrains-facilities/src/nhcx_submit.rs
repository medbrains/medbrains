//! Submit an insurance claim (or a pre-authorisation raised from the claim
//! desk) to NHCX.
//!
//! Assembles the NHCX `ClaimBundle` and, in one transaction, records the HCX
//! correlation / api-call / workflow ids on the claim and queues an
//! `nhcx.*` outbox event. The outbox handler encrypts the bundle for the
//! payer and posts it to the gateway; the payer's answer arrives at the
//! callback receiver, which finds the claim by that correlation id.
//!
//! `recipient_code` is the payer's HCX participant code, chosen from the NHCX
//! payer directory — which must hold the payer's encryption certificate.

use axum::Json;
use axum::extract::Extension;
use axum::extract::{Path, State};
use serde::Deserialize;
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_bundle::{self, ClaimContent, ItemLine, Parties};
use crate::nhcx_common::{self, Outbound, PolicyParty, Tx};

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
    admission_id: Option<Uuid>,
    insurance_id: Option<Uuid>,
    insurance_provider: String,
    policy_number: Option<String>,
    member_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct InvoiceLineRow {
    charge_code: Option<String>,
    description: String,
    unit_price: Option<rust_decimal::Decimal>,
    line_total: Option<rust_decimal::Decimal>,
}

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
    let recipient = nhcx_common::required_recipient(&body.recipient_code)?;
    let (use_, operation) = if body.r#use.as_deref() == Some("claim") {
        ("claim", NhcxOperation::Claim)
    } else {
        ("preauthorization", NhcxOperation::Preauth)
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    nhcx_common::require_nhcx_onboarded(&mut tx, claims.tenant_id).await?;
    let claim = sqlx::query_as::<_, ClaimRow>(
        "SELECT id, patient_id, invoice_id, admission_id, insurance_id, insurance_provider, \
                policy_number, member_id \
         FROM insurance_claims WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // The path names a claim; the patient whose name, UHID and ABHA go to an
    // external payer is `claim.patient_id`.
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, claim.patient_id).await?;
    nhcx_common::require_payer_certificate(&mut tx, claims.tenant_id, recipient).await?;

    let bundle = build(&mut tx, claims.tenant_id, &claim, recipient, use_).await?;
    let ids = (Uuid::new_v4(), Uuid::new_v4());
    let workflow_id = mark_queued(&mut tx, &claims, &claim, recipient, ids).await?;
    let msg = Outbound {
        record: NhcxRecord::InsuranceClaim,
        record_id: claim.id,
        operation,
        recipient,
        correlation_id: ids.0,
        api_call_id: ids.1,
        workflow_id,
        payload: &bundle,
        hcx_status: None,
    };
    let queued = nhcx_common::queue(&mut tx, &claims, &msg).await?;
    tx.commit().await?;
    Ok(Json(queued))
}

async fn build(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    claim: &ClaimRow,
    recipient: &str,
    use_: &str,
) -> Result<Value, AppError> {
    let patient = nhcx_common::load_patient(tx, tenant_id, claim.patient_id).await?;
    let policy = match claim.insurance_id {
        Some(pid) => nhcx_common::load_policy(tx, tenant_id, claim.patient_id, Some(pid)).await?,
        None => None,
    };
    // A claim keyed by hand carries its own policy fields.
    let policy = policy.map_or_else(
        || PolicyParty {
            insurance_provider: claim.insurance_provider.clone(),
            policy_number: claim.policy_number.clone(),
            member_id: claim.member_id.clone(),
            ..PolicyParty::default()
        },
        |(_, p)| p,
    );
    let provider = nhcx_common::load_provider(tx, tenant_id).await?;
    let lines = sqlx::query_as::<_, InvoiceLineRow>(
        "SELECT charge_code, description, unit_price, total_price AS line_total \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 LIMIT 500",
    )
    .bind(claim.invoice_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let items: Vec<ItemLine> = lines
        .into_iter()
        .map(|l| ItemLine {
            code: l.charge_code,
            description: l.description,
            unit_price: l.unit_price,
            net: l.line_total,
        })
        .collect();
    let diagnoses = nhcx_common::admission_diagnoses(tx, tenant_id, claim.admission_id).await?;
    let parties = Parties {
        patient: &patient,
        policy: &policy,
        provider: &provider,
        doctor: None,
        recipient,
    };
    let content = ClaimContent {
        id: claim.id,
        use_,
        urgent: false,
        items: &items,
        diagnoses: &diagnoses,
        documents: &[],
    };
    Ok(nhcx_bundle::claim_bundle(&parties, &content))
}

/// Record the exchange ids on the claim. A message queued in the last 15
/// minutes is still on its way; a second would reach the payer twice. Older
/// than that the outbox has given up on it, and the desk may send again.
async fn mark_queued(
    tx: &mut Tx<'_>,
    claims: &Claims,
    claim: &ClaimRow,
    recipient: &str,
    (correlation_id, api_call_id): (Uuid, Uuid),
) -> Result<Uuid, AppError> {
    sqlx::query_scalar(
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
    .bind(claim.id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "a message for this claim is still on its way to NHCX — wait for it to be sent"
                .to_owned(),
        )
    })
}
