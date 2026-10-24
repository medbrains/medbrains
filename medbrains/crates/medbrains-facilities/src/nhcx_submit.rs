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
//!
//! A final claim carries its documents as PDFs (`nhcx_claim_documents`): the
//! ones the desk picked, or — when the caller picks none — the discharge
//! summary, final bill and investigation reports rendered now.

use axum::Json;
use axum::extract::Extension;
use axum::extract::{Path, State};
use base64::Engine;
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

use crate::nhcx_bundle::{self, ClaimContent, DocumentRef, ItemLine, Parties};
use crate::nhcx_claim_documents::{self as docs, ClaimScope, DocumentPick, Loaded};
use crate::nhcx_common::{self, Outbound, PolicyParty, Tx};
use crate::nhcx_final_claim::{self, ClaimRef};

#[derive(Debug, Deserialize)]
pub struct SubmitToNhcxRequest {
    /// The payer's registered NHCX participant (HCX) code — the message recipient.
    pub recipient_code: String,
    /// `preauthorization` (default) or `claim`.
    pub r#use: Option<String>,
    /// A final claim's documents, as the desk chose them. Absent: the
    /// default set is rendered now.
    pub documents: Option<Vec<DocumentPick>>,
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
    nhcx_pre_auth_ref: Option<String>,
}

#[derive(Debug, FromRow)]
struct InvoiceLineRow {
    charge_code: Option<String>,
    description: String,
    quantity: Option<i32>,
    unit_price: Option<rust_decimal::Decimal>,
    line_total: Option<rust_decimal::Decimal>,
}

/// The bundle and, for a final claim, the lines and documents it sent.
struct Built {
    bundle: Value,
    sent_items: Option<Value>,
    attachments: Option<Value>,
}

/// Who is sending, and what the desk picked.
struct Sender<'a> {
    state: &'a AppState,
    claims: &'a Claims,
    picks: Option<&'a [DocumentPick]>,
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
                policy_number, member_id, nhcx_pre_auth_ref \
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

    let sender = Sender {
        state: &state,
        claims: &claims,
        picks: body.documents.as_deref(),
    };
    let built = build(&mut tx, &sender, &claim, (recipient, use_)).await?;
    // A request's correlation id is its own api call id.
    let call = Uuid::new_v4();
    let ids = (call, call);
    let sending = Sending {
        recipient,
        use_,
        sent_items: built.sent_items.as_ref(),
        attachments: built.attachments.as_ref(),
    };
    let workflow_id = mark_queued(&mut tx, &claims, &claim, &sending, ids).await?;
    let workflow_id = workflow_id.as_str();
    let bundle = built.bundle;
    let msg = Outbound {
        record: NhcxRecord::InsuranceClaim,
        record_id: claim.id,
        operation,
        recipient,
        correlation_id: ids.0,
        api_call_id: ids.1,
        workflow_id: Some(workflow_id),
        payload: &bundle,
    };
    let mut queued = nhcx_common::queue(&mut tx, &claims, &msg).await?;
    tx.commit().await?;
    if let (Some(obj), Some(a)) = (queued.as_object_mut(), built.attachments) {
        obj.insert("attachments".to_owned(), a);
    }
    Ok(Json(queued))
}

async fn build(
    tx: &mut Tx<'_>,
    sender: &Sender<'_>,
    claim: &ClaimRow,
    (recipient, use_): (&str, &str),
) -> Result<Built, AppError> {
    let tenant_id = sender.claims.tenant_id;
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
    let diagnoses = nhcx_common::admission_diagnoses(tx, tenant_id, claim.admission_id).await?;
    let parties = Parties {
        patient: &patient,
        policy: &policy,
        provider: &provider,
        doctor: None,
        recipient,
    };
    if use_ == "claim" {
        let claim_ref = ClaimRef {
            id: claim.id,
            invoice_id: claim.invoice_id,
            admission_id: claim.admission_id,
            pre_auth_ref: claim.nhcx_pre_auth_ref.clone(),
        };
        let fin = nhcx_final_claim::load(tx, tenant_id, &claim_ref).await?;
        let scope = ClaimScope {
            tenant_id,
            patient_id: claim.patient_id,
            invoice_id: claim.invoice_id,
            admission_id: claim.admission_id,
            summary_final_at: fin.summary_final_at,
        };
        let (kept, left) = gather_documents(tx, sender, &scope).await?;
        let documents: Vec<DocumentRef> = kept.iter().map(document_ref).collect();
        let content = ClaimContent {
            id: claim.id,
            use_,
            urgent: false,
            items: &fin.items,
            diagnoses: &diagnoses,
            documents: &documents,
            pre_auth_ref: fin.pre_auth_ref.as_deref(),
            total: Some(fin.total),
            notes: &fin.notes,
        };
        return Ok(Built {
            bundle: nhcx_bundle::claim_bundle(&parties, &content),
            sent_items: Some(fin.sent_items()),
            attachments: Some(docs::record(&kept, &left)),
        });
    }
    let lines = sqlx::query_as::<_, InvoiceLineRow>(
        "SELECT charge_code, description, quantity, unit_price, total_price AS line_total \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         LIMIT 500",
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
            quantity: l.quantity,
            unit_price: l.unit_price,
            net: l.line_total,
        })
        .collect();
    let content = ClaimContent {
        id: claim.id,
        use_,
        urgent: false,
        items: &items,
        diagnoses: &diagnoses,
        documents: &[],
        pre_auth_ref: None,
        total: None,
        notes: &[],
    };
    Ok(Built {
        bundle: nhcx_bundle::claim_bundle(&parties, &content),
        sent_items: None,
        attachments: None,
    })
}

/// The final claim's documents within the caps, refusing a stay's claim
/// whose discharge summary would not go.
async fn gather_documents(
    tx: &mut Tx<'_>,
    sender: &Sender<'_>,
    scope: &ClaimScope,
) -> Result<(Vec<Loaded>, Vec<docs::LeftOut>), AppError> {
    let (found, mut left) = match sender.picks {
        Some(picks) => crate::nhcx_claim_picks::load_picks(sender.state, tx, scope, picks).await?,
        None => docs::render_defaults(sender.state, sender.claims, tx, scope).await?,
    };
    let (kept, capped) = docs::apply_caps(found, docs::MAX_TOTAL_BYTES);
    left.extend(capped);
    docs::require_discharge_summary(&kept, &left, scope)?;
    Ok((kept, left))
}

fn document_ref(d: &Loaded) -> DocumentRef {
    DocumentRef {
        document_type: d.doc.title.clone(),
        file_name: Some(d.doc.title.clone()),
        file_path: None,
        mime_type: Some(d.doc.mime_type.clone()),
        created_at: d.doc.created_at,
        data: Some(base64::engine::general_purpose::STANDARD.encode(&d.bytes)),
        kind: Some(d.doc.kind),
    }
}

/// What is being sent, as the claim records it.
struct Sending<'a> {
    recipient: &'a str,
    use_: &'a str,
    sent_items: Option<&'a Value>,
    attachments: Option<&'a Value>,
}

/// Record the exchange ids on the claim. A message queued in the last 15
/// minutes is still on its way; a second would reach the payer twice. Older
/// than that the outbox has given up on it, and the desk may send again.
async fn mark_queued(
    tx: &mut Tx<'_>,
    claims: &Claims,
    claim: &ClaimRow,
    sending: &Sending<'_>,
    (correlation_id, api_call_id): (Uuid, Uuid),
) -> Result<String, AppError> {
    // A claim the payer has settled or cancelled keeps its status; anything
    // else is now waiting on the payer for this message.
    sqlx::query_scalar(
        "UPDATE insurance_claims SET nhcx_correlation_id = $1, nhcx_api_call_id = $2, \
                nhcx_workflow_id = CASE WHEN $6 = 'claim' THEN '15' \
                                        WHEN status = 'pre_auth_rejected' THEN '121' \
                                        ELSE '12' END, \
                nhcx_recipient_code = $3, nhcx_decision = NULL, \
                nhcx_status = 'queued', nhcx_disposition = NULL, nhcx_outcome = NULL, \
                nhcx_response_payload = NULL, nhcx_response_at = NULL, \
                nhcx_use = $6, \
                nhcx_claim_items = COALESCE($7, nhcx_claim_items), \
                nhcx_attachments = CASE WHEN $6 = 'claim' THEN $8 ELSE nhcx_attachments END, \
                nhcx_adjudication = CASE WHEN $6 = 'claim' THEN NULL ELSE nhcx_adjudication END, \
                nhcx_adjudicated_at = CASE WHEN $6 = 'claim' THEN NULL ELSE nhcx_adjudicated_at END, \
                status = CASE WHEN status IN ('settled', 'partially_settled', 'cancelled') THEN status \
                              WHEN $6 = 'claim' THEN 'claim_submitted' \
                              WHEN status = 'initiated' THEN 'pre_auth_requested' \
                              ELSE status END, \
                submitted_at = CASE WHEN $6 = 'claim' THEN COALESCE(submitted_at, now()) \
                                    ELSE submitted_at END \
         WHERE id = $4 AND tenant_id = $5 \
           AND NOT (nhcx_status IS NOT DISTINCT FROM 'queued' \
                    AND updated_at > now() - interval '15 minutes') \
         RETURNING nhcx_workflow_id",
    )
    .bind(correlation_id)
    .bind(api_call_id)
    .bind(sending.recipient)
    .bind(claim.id)
    .bind(claims.tenant_id)
    .bind(sending.use_)
    .bind(sending.sent_items)
    .bind(sending.attachments)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(
            "a message for this claim is still on its way to NHCX — wait for it to be sent"
                .to_owned(),
        )
    })
}
