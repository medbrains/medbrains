//! `POST /api/v3/hiu/data/push?ref={artefact}` — a HIP sends the records.
//!
//! A push carries no gateway JWT: it comes from the HIP, to the
//! `dataPushUrl` we sent. *Inferred* authentication, as NHA's wrapper does
//! it: the artefact named in the URL must be granted and unexpired, hold a
//! key from our request, and the push's `transactionId` must be the one ABDM
//! gave us for it (the first push binds it if `on-request` has not arrived).
//! An entry with a `link` instead of inline `content` is fetched first,
//! guarded (`link`). Each entry must then decrypt with that request's private key, match its
//! checksum, be a FHIR bundle and fall inside the consent; anything else is
//! refused and reported to ABDM as ERRORED, never stored.

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use chrono::{DateTime, SecondsFormat, Utc};
use medbrains_abdm::gateway::HI_NOTIFY_PATH;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::purge::erase_due;
use super::scope::{Refusal, Scope, open_entry};
use super::{keys, link};
use crate::{error::AppError, routes::abdm::hip::gateway::Hip, state::AppState};

/// Entries read from one push; ABDM pages larger transfers.
const MAX_ENTRIES: usize = 100;

#[derive(Debug, Deserialize)]
pub struct PushQuery {
    #[serde(rename = "ref")]
    pub artefact: Option<Uuid>,
}

#[derive(sqlx::FromRow)]
struct Held {
    id: Uuid,
    consent_id: String,
    patient_id: Uuid,
    consent_request_id: Uuid,
    hiu_id: String,
    hip_id: Option<String>,
    hip_name: Option<String>,
    hi_types: Vec<String>,
    care_context_refs: Vec<String>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    data_erase_at: DateTime<Utc>,
    transaction_id: Option<String>,
    key_material_sealed: Option<String>,
}

/// Receive one page of records.
///
/// # Errors
/// 401 for a push that is not ours to accept; 400 for a malformed push or
/// one whose every entry was refused.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn receive(
    State(state): State<AppState>,
    Query(q): Query<PushQuery>,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let artefact_id = q.artefact.ok_or(AppError::Unauthorized)?;
    let tenant_id =
        sqlx::query_scalar::<_, Option<Uuid>>("SELECT app_abdm_hiu_artefact_tenant($1)")
            .bind(artefact_id)
            .fetch_one(&state.db)
            .await?
            .ok_or(AppError::Unauthorized)?;
    tracing::Span::current().record("tenant_id", tracing::field::display(tenant_id));
    let transaction_id = body["transactionId"]
        .as_str()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| AppError::BadRequest("transactionId is required".to_owned()))?;
    let km = &body["keyMaterial"];
    let sender = (
        km["dhPublicKey"]["keyValue"].as_str().unwrap_or_default(),
        km["nonce"].as_str().unwrap_or_default(),
    );
    let entries = body["entries"].as_array().map_or(&[][..], Vec::as_slice);
    let entries = &entries[..entries.len().min(MAX_ENTRIES)];
    // Authenticated before any linked entry is fetched, and fetched before
    // the artefact is locked: no row lock is held across the network.
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    load_held(&mut tx, tenant_id, artefact_id, transaction_id, "").await?;
    let allow_loopback = link::loopback_allowed(&state, &mut tx, tenant_id).await?;
    tx.commit().await?;
    let entries = link::inline_all(entries, allow_loopback).await;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    erase_due(&mut tx, tenant_id).await?;
    let held = load_held(
        &mut tx,
        tenant_id,
        artefact_id,
        transaction_id,
        " FOR UPDATE",
    )
    .await?;
    let sealed = held
        .key_material_sealed
        .as_deref()
        .ok_or(AppError::Unauthorized)?;
    let ours = keys::open(state.secret_resolver.as_ref(), sealed).await?;
    let scope = Scope {
        care_context_refs: held.care_context_refs.clone(),
        hi_types: held.hi_types.clone(),
        from: held.date_from,
        to: held.date_to,
    };
    let mut stored = Vec::new();
    let mut refused: Vec<Refusal> = Vec::new();
    for entry in entries {
        match entry.and_then(|e| open_entry(&e, &ours, sender, &scope)) {
            Ok(r) => {
                store(&mut tx, tenant_id, &held, transaction_id, &r).await?;
                stored.push(r.reference);
            }
            Err(r) => refused.push(r),
        }
    }
    let last_page =
        body["pageNumber"].as_i64().unwrap_or(0) + 1 >= body["pageCount"].as_i64().unwrap_or(1);
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET transaction_id = $3, \
                hi_status = CASE WHEN $4 THEN 'transferred' ELSE 'receiving' END, \
                key_material_sealed = CASE WHEN $4 THEN NULL ELSE key_material_sealed END \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(held.id)
    .bind(transaction_id)
    .bind(last_page)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    for r in &refused {
        tracing::warn!(reason = r.reason, "abdm hiu: pushed entry refused");
    }
    notify(&state, tenant_id, &held, transaction_id, &stored, &refused).await;
    if stored.is_empty() && !refused.is_empty() {
        return Err(AppError::BadRequest(
            "no entry could be verified".to_owned(),
        ));
    }
    Ok(StatusCode::ACCEPTED)
}

/// The artefact a push names, while it may receive: granted, unexpired,
/// holding a key, and under the push's transaction (or none bound yet).
async fn load_held(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    artefact_id: Uuid,
    transaction_id: &str,
    lock: &str,
) -> Result<Held, AppError> {
    sqlx::query_as::<_, Held>(&format!(
        "SELECT id, consent_id, patient_id, consent_request_id, hiu_id, hip_id, hip_name, hi_types, \
                care_context_refs, date_from, date_to, data_erase_at, transaction_id, key_material_sealed \
           FROM abdm_consent_artefacts \
          WHERE tenant_id = $1 AND id = $2 AND role = 'hiu' AND status = 'GRANTED' \
            AND deleted_at IS NULL AND data_erase_at > now() \
            AND key_material_sealed IS NOT NULL{lock}"
    ))
    .bind(tenant_id)
    .bind(artefact_id)
    .fetch_optional(&mut **tx)
    .await?
    .filter(|h| h.transaction_id.as_deref().is_none_or(|t| t == transaction_id))
    .ok_or(AppError::Unauthorized)
}

async fn store(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    held: &Held,
    transaction_id: &str,
    r: &super::scope::Received,
) -> Result<(), AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "INSERT INTO abdm_received_records (tenant_id, patient_id, consent_request_id, \
                consent_artefact_id, care_context_reference, hi_type, source_hip_id, source_hip_name, \
                transaction_id, checksum, bundle, erase_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         ON CONFLICT (tenant_id, consent_artefact_id, care_context_reference, checksum) \
            WHERE deleted_at IS NULL DO NOTHING",
    )
    .bind(tenant_id)
    .bind(held.patient_id)
    .bind(held.consent_request_id)
    .bind(held.id)
    .bind(&r.reference)
    .bind(&r.hi_type)
    .bind(held.hip_id.as_deref().unwrap_or("unknown"))
    .bind(held.hip_name.as_deref())
    .bind(transaction_id)
    .bind(&r.checksum)
    .bind(&r.bundle)
    .bind(held.data_erase_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Tell ABDM what arrived. The records are already kept; a gateway outage
/// here is logged, not turned into a failed push.
async fn notify(
    state: &AppState,
    tenant_id: Uuid,
    held: &Held,
    transaction_id: &str,
    stored: &[String],
    refused: &[Refusal],
) {
    let ok = stored
        .iter()
        .map(|r| json!({ "careContextReference": r, "hiStatus": "OK", "description": "Received" }));
    let errored = refused.iter().map(|r| {
        json!({ "careContextReference": r.reference, "hiStatus": "ERRORED", "description": r.reason })
    });
    let statuses: Vec<Value> = ok.chain(errored).collect();
    let session = if stored.is_empty() {
        "FAILED"
    } else {
        "TRANSFERRED"
    };
    let notice = json!({ "notification": {
        "consentId": held.consent_id, "transactionId": transaction_id,
        "doneAt": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "notifier": { "type": "HIU", "id": held.hiu_id },
        "statusNotification": { "sessionStatus": session, "hipId": held.hip_id,
                                "statusResponses": statuses } } });
    let sent = match Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        tenant_id,
        &held.hiu_id,
    )
    .await
    {
        Ok(hiu) => hiu.send_as_hiu(HI_NOTIFY_PATH, &notice).await.map(|_| ()),
        Err(e) => Err(e),
    };
    if let Err(e) = sent {
        tracing::warn!(error = %e, "abdm hiu: could not notify ABDM of a received transfer");
    }
}
