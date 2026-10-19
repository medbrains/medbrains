//! Consent and data transfer (ABDM v3, HIP side).
//!
//! The consent manager tells us of each consent artefact naming this HIP;
//! we keep it and acknowledge. A health-information request is answered only
//! inside a GRANTED, unexpired artefact, with the care contexts and dates it
//! names: each record becomes an NRCeS bundle, encrypted with Fidelius for
//! the HIU's key, pushed to the `dataPushUrl` from the request, and the
//! outcome is notified to the gateway and recorded as a transfer.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use medbrains_abdm::gateway::{CONSENT_ON_NOTIFY_PATH, HI_NOTIFY_PATH, HI_ON_REQUEST_PATH};
use serde_json::{Value, json};
use uuid::Uuid;

use super::bundles::{self, ContextRow};
use super::gateway::{Caller, Hip, authenticate};
use super::linking::message;
use crate::{error::AppError, state::AppState};

/// Care contexts one transfer carries.
const TRANSFER_LIMIT: i64 = 100;

fn time(v: &Value) -> Option<DateTime<Utc>> {
    v.as_str()
        .and_then(|s| {
            DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|t| t.with_timezone(&Utc))
        })
        .or_else(|| {
            v.as_str()
                .and_then(|s| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").ok())
                .map(|n| n.and_utc())
        })
}

fn strings(v: &Value, field: Option<&str>) -> Vec<String> {
    v.as_array()
        .into_iter()
        .flatten()
        .filter_map(|x| field.map_or(x, |f| &x[f]).as_str().map(str::to_owned))
        .collect()
}

async fn hip(state: &AppState, caller: &Caller) -> Result<Hip, AppError> {
    Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        caller.tenant_id,
        &caller.hip_id,
    )
    .await
}

/// `POST /api/v3/consent/request/hip/notify` — keep the artefact, acknowledge.
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the acknowledgement cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn notify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let n = &body["notification"];
    let consent_id = n["consentId"].as_str().unwrap_or_default().to_owned();
    let status = n["status"].as_str().unwrap_or_default().to_owned();
    let detail = &n["consentDetail"];
    let names_us = detail["hip"]["id"].is_null() || detail["hip"]["id"] == caller.hip_id.as_str();
    let valid = !consent_id.is_empty()
        && ["GRANTED", "REVOKED", "EXPIRED", "DENIED"].contains(&status.as_str())
        && names_us;
    if valid {
        store(&state, &caller, &consent_id, &status, n).await?;
    }
    let mut ack = json!({ "response": { "requestId": caller.request_id } });
    if valid {
        ack["acknowledgement"] = json!({ "status": "OK", "consentId": consent_id });
    } else {
        ack["acknowledgement"] = json!({ "status": "FAILURE", "consentId": consent_id });
        ack["error"] =
            json!({ "code": "ABDM-1017", "message": "Consent artefact not valid for this HIP" });
    }
    hip(&state, &caller)
        .await?
        .send(CONSENT_ON_NOTIFY_PATH, None, &ack)
        .await?;
    Ok(StatusCode::ACCEPTED)
}

async fn store(
    state: &AppState,
    caller: &Caller,
    consent_id: &str,
    status: &str,
    n: &Value,
) -> Result<(), AppError> {
    let detail = &n["consentDetail"];
    let refs = strings(&detail["careContexts"], Some("careContextReference"));
    let patient_ref = detail["careContexts"][0]["patientReference"]
        .as_str()
        .unwrap_or_default();
    let permission = &detail["permission"];
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    if status != "GRANTED" {
        // Revoked, expired or denied: only the id is meaningful.
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query(
            "UPDATE abdm_consent_artefacts SET status = $3, notified_at = now() \
              WHERE tenant_id = $1 AND role = 'hip' AND consent_id = $2 AND deleted_at IS NULL",
        )
        .bind(caller.tenant_id)
        .bind(consent_id)
        .bind(status)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Ok(());
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "INSERT INTO abdm_consent_artefacts (tenant_id, consent_id, role, patient_id, abha_address, \
                hiu_id, purpose_code, purpose_text, hi_types, date_from, date_to, data_erase_at, \
                care_context_refs, status, signature) \
         SELECT $1, $2, 'hip', (SELECT id FROM patients WHERE tenant_id = $1 AND uhid = $3 AND deleted_at IS NULL), \
                $4, $5, $6, $7, $8, $9, $10, $11, $12, 'GRANTED', $13 \
         ON CONFLICT (tenant_id, role, consent_id) WHERE deleted_at IS NULL \
         DO UPDATE SET status = 'GRANTED', notified_at = now()",
    )
    .bind(caller.tenant_id)
    .bind(consent_id)
    .bind(patient_ref)
    .bind(detail["patient"]["id"].as_str())
    .bind(detail["hiu"]["id"].as_str())
    .bind(detail["purpose"]["code"].as_str())
    .bind(detail["purpose"]["text"].as_str())
    .bind(strings(&detail["hiTypes"], None))
    .bind(time(&permission["dateRange"]["from"]))
    .bind(time(&permission["dateRange"]["to"]))
    .bind(time(&permission["dataEraseAt"]))
    .bind(&refs)
    .bind(n["signature"].as_str())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct Artefact {
    patient_id: Option<Uuid>,
    hi_types: Vec<String>,
    care_context_refs: Vec<String>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
}

/// `POST /api/v3/hip/health-information/request` — send what was consented.
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the gateway cannot be reached.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn health_information_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let hi = &body["hiRequest"];
    let transaction_id = body["transactionId"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let consent_id = hi["consent"]["id"].as_str().unwrap_or_default();
    let push_url = hi["dataPushUrl"].as_str().unwrap_or_default().to_owned();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let artefact = sqlx::query_as::<_, Artefact>(
        "SELECT id, patient_id, hi_types, care_context_refs, date_from, date_to \
           FROM abdm_consent_artefacts \
          WHERE tenant_id = $1 AND role = 'hip' AND consent_id = $2 AND status = 'GRANTED' \
            AND deleted_at IS NULL AND (data_erase_at IS NULL OR data_erase_at > now())",
    )
    .bind(caller.tenant_id)
    .bind(consent_id)
    .fetch_optional(&mut *tx)
    .await?;
    let usable = artefact.filter(|a| a.patient_id.is_some() && push_url.starts_with("http"));
    let transfer_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO abdm_health_transfers (tenant_id, consent_artefact_id, patient_id, transaction_id, \
                data_push_url, status, error) \
         SELECT $1, a.id, a.patient_id, $3, $4, $5, $6 FROM abdm_consent_artefacts a \
          WHERE a.tenant_id = $1 AND a.consent_id = $2 AND a.role = 'hip' AND a.deleted_at IS NULL \
         ON CONFLICT (tenant_id, transaction_id) WHERE deleted_at IS NULL DO NOTHING RETURNING id",
    )
    .bind(caller.tenant_id)
    .bind(consent_id)
    .bind(&transaction_id)
    .bind(&push_url)
    .bind(if usable.is_some() { "requested" } else { "refused" })
    .bind(usable.is_none().then_some("No granted, unexpired consent for this request"))
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let hip = hip(&state, &caller).await?;
    let session_status = if usable.is_some() {
        "ACKNOWLEDGED"
    } else {
        "ERRORED"
    };
    let mut ack = json!({
        "hiRequest": { "transactionId": transaction_id,
                       "sessionStatus": session_status },
        "response": { "requestId": caller.request_id },
    });
    let (Some(artefact), Some(transfer_id)) = (usable, transfer_id) else {
        ack["error"] =
            json!({ "code": "ABDM-1023", "message": "Consent not found or not granted" });
        hip.send(HI_ON_REQUEST_PATH, None, &ack).await?;
        return Ok(StatusCode::ACCEPTED);
    };
    hip.send(HI_ON_REQUEST_PATH, None, &ack).await?;
    // ponytail: the transfer runs inside the callback (one page, up to
    // TRANSFER_LIMIT records); move to the outbox if HIUs time it out.
    let outcome = transfer(
        &state,
        &caller,
        &hip,
        &artefact,
        hi,
        &transaction_id,
        &push_url,
    )
    .await;
    finish(
        &state,
        &caller,
        &hip,
        transfer_id,
        consent_id,
        &transaction_id,
        outcome,
    )
    .await?;
    Ok(StatusCode::ACCEPTED)
}

/// Build, encrypt and push. Returns the care-context references sent.
async fn transfer(
    state: &AppState,
    caller: &Caller,
    hip: &Hip,
    a: &Artefact,
    hi: &Value,
    transaction_id: &str,
    push_url: &str,
) -> Result<Vec<String>, AppError> {
    // The requested range, never wider than the consented one.
    let from = [time(&hi["dateRange"]["from"]), a.date_from]
        .into_iter()
        .flatten()
        .max();
    let to = [time(&hi["dateRange"]["to"]), a.date_to]
        .into_iter()
        .flatten()
        .min();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let contexts = sqlx::query_as::<_, ContextRow>(
        "SELECT reference_number, source_kind, source_id, record_date, display, encounter_id \
           FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND patient_id = $2 AND reference_number = ANY($3) \
            AND hi_types && $4 AND deleted_at IS NULL \
            AND ($5::timestamptz IS NULL OR record_date >= ($5::timestamptz AT TIME ZONE 'Asia/Kolkata')::date) \
            AND ($6::timestamptz IS NULL OR record_date <= ($6::timestamptz AT TIME ZONE 'Asia/Kolkata')::date) \
          ORDER BY record_date LIMIT $7",
    )
    .bind(caller.tenant_id)
    .bind(a.patient_id)
    .bind(&a.care_context_refs)
    .bind(&a.hi_types)
    .bind(from)
    .bind(to)
    .bind(TRANSFER_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let patient_id = a.patient_id.ok_or(AppError::NotFound)?;
    let documents = bundles::build(&mut tx, caller.tenant_id, patient_id, &contexts).await?;
    tx.commit().await?;

    let km = &hi["keyMaterial"];
    let (their_key, their_nonce) = (
        km["dhPublicKey"]["keyValue"].as_str().unwrap_or_default(),
        km["nonce"].as_str().unwrap_or_default(),
    );
    let ours = medbrains_crypto::fidelius::generate()
        .map_err(|_| AppError::Internal("could not generate transfer keys".to_owned()))?;
    let bad_key = || AppError::BadRequest("the HIU's key material could not be used".to_owned());
    let mut entries = Vec::with_capacity(documents.len());
    for (reference, bundle) in &documents {
        let plain = bundle.to_string();
        entries.push(json!({
            "content": medbrains_crypto::fidelius::encrypt(&plain, &ours, their_key, their_nonce).map_err(|_| bad_key())?,
            "media": "application/fhir+json",
            "checksum": medbrains_crypto::fidelius::checksum(&plain).map_err(|_| bad_key())?,
            "careContextReference": reference,
        }));
    }
    let expiry = (Utc::now() + Duration::days(1)).to_rfc3339_opts(SecondsFormat::Millis, true);
    let push = json!({
        "pageNumber": 0, "pageCount": 1, "transactionId": transaction_id, "entries": entries,
        "keyMaterial": { "cryptoAlg": "ECDH", "curve": "Curve25519", "nonce": ours.nonce,
            "dhPublicKey": { "expiry": expiry, "parameters": "Curve25519/32byte random key",
                             "keyValue": ours.public_key } },
    });
    hip.gateway
        .push_data(push_url, &push)
        .await
        .map_err(super::super::abha::map_abdm_error)?;
    Ok(documents.into_iter().map(|(r, _)| r).collect())
}

/// Tell the gateway how the transfer went, and record it.
async fn finish(
    state: &AppState,
    caller: &Caller,
    hip: &Hip,
    transfer_id: Uuid,
    consent_id: &str,
    transaction_id: &str,
    outcome: Result<Vec<String>, AppError>,
) -> Result<(), AppError> {
    let (sent, error) = match outcome {
        Ok(refs) => (refs, None),
        Err(e) => (Vec::new(), Some(message(&e))),
    };
    let statuses: Vec<Value> = sent
        .iter()
        .map(|r| json!({ "careContextReference": r, "hiStatus": "DELIVERED", "description": "Delivered" }))
        .collect();
    let session_status = if error.is_none() {
        "TRANSFERRED"
    } else {
        "FAILED"
    };
    let notice = json!({ "notification": {
        "consentId": consent_id, "transactionId": transaction_id,
        "doneAt": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "notifier": { "type": "HIP", "id": caller.hip_id },
        "statusNotification": { "sessionStatus": session_status, "hipId": caller.hip_id,
                                "statusResponses": statuses } } });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_health_transfers SET status = $3, error = $4, care_context_refs = $5, \
                entry_count = cardinality($5::text[]), \
                transferred_at = CASE WHEN $3 = 'transferred' THEN now() END \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(caller.tenant_id)
    .bind(transfer_id)
    .bind(if error.is_none() {
        "transferred"
    } else {
        "failed"
    })
    .bind(error.as_deref())
    .bind(&sent)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    hip.send(HI_NOTIFY_PATH, None, &notice).await.map(|_| ())
}
