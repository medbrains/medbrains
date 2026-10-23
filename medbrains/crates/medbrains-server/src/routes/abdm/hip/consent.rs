//! Consent and data transfer (ABDM v3, HIP side).
//!
//! The consent manager tells us of each consent artefact naming this HIP;
//! we keep it and acknowledge. A health-information request is answered only
//! inside a GRANTED, unexpired artefact, with the care contexts and dates it
//! names: each record becomes an `NRCeS` bundle, encrypted with Fidelius for
//! the HIU's key, pushed to the `dataPushUrl` from the request, and the
//! outcome is notified to the gateway and recorded as a transfer.
//!
//! Per the official sandbox docs (sandboxcms.abdm.gov.in, "Storing Consent
//! Artefacts") a REVOKED or EXPIRED artefact is deleted, not kept; error
//! codes are those of the M2 document's table (ABDM-1061 consent expired,
//! ABDM-1062 consent not granted, ABDM-1010 validation failed, ABDM-1035
//! invalid HIP ID, ABDM-1006 invalid request body).

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
/// `delete_reason` of an artefact deleted because ABDM revoked or expired it;
/// the dashboard still counts these.
pub(crate) const ARTEFACT_ENDED: &str = "consent ended at ABDM";

pub(crate) fn time(v: &Value) -> Option<DateTime<Utc>> {
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

pub(crate) fn strings(v: &Value, field: Option<&str>) -> Vec<String> {
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
    let well_formed = !consent_id.is_empty()
        && ["GRANTED", "REVOKED", "EXPIRED", "DENIED"].contains(&status.as_str());
    let refusal = if !well_formed {
        Some(("ABDM-1006", "Consent notification is missing its id or status"))
    } else if !names_us {
        Some(("ABDM-1035", "Consent artefact names another HIP"))
    } else {
        None
    };
    if refusal.is_none() {
        store(&state, &caller, &consent_id, &status, n).await?;
    }
    let mut ack = json!({ "response": { "requestId": caller.request_id } });
    if let Some((code, message)) = refusal {
        ack["acknowledgement"] = json!({ "status": "FAILURE", "consentId": consent_id });
        ack["error"] = json!({ "code": code, "message": message });
    } else {
        ack["acknowledgement"] = json!({ "status": "OK", "consentId": consent_id });
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
        // Revoked or expired: the artefact is deleted, its content cleared.
        // What stays is the tombstone the transfers made under it point at —
        // the hospital's record of what it disclosed and when (DPDP).
        // Denied: only the status changes.
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query(
            "UPDATE abdm_consent_artefacts SET status = $3, notified_at = now(), \
                    signature = CASE WHEN $3 = 'DENIED' THEN signature END, \
                    care_context_refs = CASE WHEN $3 = 'DENIED' THEN care_context_refs ELSE '{}' END, \
                    abha_address = CASE WHEN $3 = 'DENIED' THEN abha_address END, \
                    deleted_at = CASE WHEN $3 = 'DENIED' THEN NULL ELSE now() END, \
                    delete_reason = CASE WHEN $3 = 'DENIED' THEN NULL ELSE $4 END \
              WHERE tenant_id = $1 AND role = 'hip' AND consent_id = $2 AND deleted_at IS NULL",
        )
        .bind(caller.tenant_id)
        .bind(consent_id)
        .bind(status)
        .bind(ARTEFACT_ENDED)
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
    expired: bool,
}

/// Why a health-information request is refused: an ABDM error code and words.
type Refusal = (&'static str, &'static str);

/// The HIU's key material must be complete and unexpired (the official HIP
/// checklist: "key material is valid").
fn key_material_refusal(km: &Value) -> Option<Refusal> {
    let complete = km["dhPublicKey"]["keyValue"].as_str().is_some_and(|v| !v.is_empty())
        && km["nonce"].as_str().is_some_and(|v| !v.is_empty());
    if !complete {
        return Some(("ABDM-1010", "Key material is incomplete"));
    }
    match time(&km["dhPublicKey"]["expiry"]) {
        Some(expiry) if expiry > Utc::now() => None,
        Some(_) => Some(("ABDM-1010", "Key material has expired")),
        None => Some(("ABDM-1010", "Key material has no valid expiry")),
    }
}

fn artefact_refusal(artefact: Option<&Artefact>, push_url: &str) -> Option<Refusal> {
    match artefact {
        None => Some(("ABDM-1062", "Consent not found or not granted")),
        Some(a) if a.expired => Some(("ABDM-1061", "Consent artefact expired")),
        Some(a) if a.patient_id.is_none() => Some(("ABDM-1062", "Consent names no patient here")),
        Some(_) if !push_url.starts_with("http") => Some(("ABDM-1010", "No usable dataPushUrl")),
        Some(_) => None,
    }
}

/// A transfer already recorded for this transaction: the gateway retried.
async fn earlier_answer(
    state: &AppState,
    caller: &Caller,
    transaction_id: &str,
) -> Result<Option<String>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status FROM abdm_health_transfers \
          WHERE tenant_id = $1 AND transaction_id = $2 AND deleted_at IS NULL",
    )
    .bind(caller.tenant_id)
    .bind(transaction_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(status)
}

/// `POST /api/v3/hip/health-information/request` — send what was consented.
///
/// A retried request (same `transactionId`) is acknowledged again exactly as
/// the first one was, and never transferred twice.
///
/// # Errors
/// 400 without a `transactionId`; 401 without a valid gateway JWT; 503 when
/// the gateway cannot be reached.
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
        .filter(|t| !t.is_empty())
        .ok_or_else(|| AppError::BadRequest("transactionId is required".to_owned()))?
        .to_owned();
    let mut ack = json!({ "response": { "requestId": caller.request_id } });
    if let Some(earlier) = earlier_answer(&state, &caller, &transaction_id).await? {
        let refused = earlier == "refused";
        ack["hiRequest"] = json!({ "transactionId": transaction_id,
            "sessionStatus": if refused { "ERRORED" } else { "ACKNOWLEDGED" } });
        if refused {
            ack["error"] = json!({ "code": "ABDM-1062", "message": "Consent not found or not granted" });
        }
        hip(&state, &caller).await?.send(HI_ON_REQUEST_PATH, None, &ack).await?;
        return Ok(StatusCode::ACCEPTED);
    }
    let consent_id = hi["consent"]["id"].as_str().unwrap_or_default();
    let push_url = hi["dataPushUrl"].as_str().unwrap_or_default().to_owned();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let artefact = sqlx::query_as::<_, Artefact>(
        "SELECT patient_id, hi_types, care_context_refs, date_from, date_to, \
                (data_erase_at IS NOT NULL AND data_erase_at <= now()) AS expired \
           FROM abdm_consent_artefacts \
          WHERE tenant_id = $1 AND role = 'hip' AND consent_id = $2 AND status = 'GRANTED' \
            AND deleted_at IS NULL",
    )
    .bind(caller.tenant_id)
    .bind(consent_id)
    .fetch_optional(&mut *tx)
    .await?;
    let refusal = artefact_refusal(artefact.as_ref(), &push_url)
        .or_else(|| key_material_refusal(&hi["keyMaterial"]));
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
    .bind(if refusal.is_none() { "requested" } else { "refused" })
    .bind(refusal.map(|(_, why)| why))
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let hip = hip(&state, &caller).await?;
    ack["hiRequest"] = json!({ "transactionId": transaction_id,
        "sessionStatus": if refusal.is_none() { "ACKNOWLEDGED" } else { "ERRORED" } });
    if let Some((code, message)) = refusal {
        ack["error"] = json!({ "code": code, "message": message });
    }
    hip.send(HI_ON_REQUEST_PATH, None, &ack).await?;
    // No row inserted: a retry racing this one recorded it first and transfers.
    let (Some(artefact), Some(transfer_id), None) = (artefact, transfer_id, refusal) else {
        return Ok(StatusCode::ACCEPTED);
    };
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
        (transfer_id, consent_id, &transaction_id),
        &artefact.care_context_refs,
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
    // The HIU's refusal is not ABDM's: no session is dropped for it.
    hip.gateway.push_data(push_url, &push).await.map_err(|e| {
        AppError::ServiceUnavailable(format!("the HIU did not accept the records: {e}"))
    })?;
    Ok(documents.into_iter().map(|(r, _)| r).collect())
}

/// Tell the gateway how the transfer went, and record it. A failed transfer
/// names every care context the consent covered as ERRORED: the official
/// notify requires one `statusResponses` entry per care context.
async fn finish(
    state: &AppState,
    caller: &Caller,
    hip: &Hip,
    (transfer_id, consent_id, transaction_id): (Uuid, &str, &str),
    requested: &[String],
    outcome: Result<Vec<String>, AppError>,
) -> Result<(), AppError> {
    let (sent, error) = match outcome {
        Ok(refs) => (refs, None),
        Err(e) => (Vec::new(), Some(message(&e))),
    };
    let statuses: Vec<Value> = match &error {
        None => sent
            .iter()
            .map(|r| json!({ "careContextReference": r, "hiStatus": "DELIVERED", "description": "Delivered" }))
            .collect(),
        Some(why) => requested
            .iter()
            .map(|r| json!({ "careContextReference": r, "hiStatus": "ERRORED", "description": why }))
            .collect(),
    };
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
