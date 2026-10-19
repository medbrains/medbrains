//! The gateway's answers to this hospital as an HIU (ABDM v3). Each is
//! authenticated as every M2 callback is — the gateway's JWT, the hospital
//! named by `X-HIU-ID` — and matched to our request by the `REQUEST-ID` we
//! sent or the consent ids ABDM issued.
//!
//! - `on-init`: ABDM accepted the request and named it; the patient decides.
//! - `notify`: the patient's answer. GRANTED brings one artefact per HIP; we
//!   keep each, acknowledge, and fetch it. REVOKED and EXPIRED erase what was
//!   received under it at once.
//! - `on-fetch`: the artefact itself; narrowed to what was asked, then the
//!   health-information request goes out with a fresh key pair.
//! - `on-request`: the transaction the records will arrive under.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::gateway::CONSENT_HIU_ON_NOTIFY_PATH;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    grant::{ANSWERS, ASKED_COLUMNS, Asked, MAX_ARTEFACTS, fetch_all, settle},
    keys::request_data,
    scope,
};
use crate::{
    error::AppError,
    routes::abdm::hip::{
        consent::{strings, time},
        gateway::{Caller, Hip, authenticate},
    },
    state::AppState,
};

pub(super) fn error_of(body: &Value) -> Option<String> {
    let e = &body["error"];
    (!e.is_null()).then(|| {
        e["message"]
            .as_str()
            .unwrap_or("ABDM refused the request")
            .to_owned()
    })
}

pub(super) fn request_id_of(body: &Value) -> Option<Uuid> {
    body["response"]["requestId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
}

pub(super) async fn caller_of(state: &AppState, headers: &HeaderMap) -> Result<Caller, AppError> {
    let caller = authenticate(state, headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    Ok(caller)
}

pub(super) async fn connect_hiu(state: &AppState, caller: &Caller) -> Result<Hip, AppError> {
    Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        caller.tenant_id,
        &caller.hip_id,
    )
    .await
}

/// `POST /api/v3/hiu/consent/request/on-init`.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for a request we did not send.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_init(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = caller_of(&state, &headers).await?;
    let request_id = request_id_of(&body).ok_or(AppError::NotFound)?;
    let consent_request_id = body["consentRequest"]["id"]
        .as_str()
        .filter(|s| !s.is_empty());
    let error = error_of(&body).or_else(|| {
        consent_request_id
            .is_none()
            .then(|| "ABDM did not accept the request".to_owned())
    });
    let status = if error.is_some() {
        "failed"
    } else {
        "awaiting_patient"
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let done = sqlx::query(
        "UPDATE abdm_consent_requests SET status = $3, consent_request_id = $4, error = $5, \
                status_at = now() \
          WHERE tenant_id = $1 AND gateway_request_id = $2 AND status = 'requested' \
            AND deleted_at IS NULL",
    )
    .bind(caller.tenant_id)
    .bind(request_id)
    .bind(status)
    .bind(consent_request_id)
    .bind(error)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::ACCEPTED)
}

/// `POST /api/v3/hiu/consent/request/notify` — the patient's answer.
///
/// # Errors
/// 401 without a valid gateway JWT; 400 for an unknown status; 404 for a
/// request we did not send; 503 when the acknowledgement cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn notify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = caller_of(&state, &headers).await?;
    let n = &body["notification"];
    let status = n["status"].as_str().unwrap_or_default().to_owned();
    if !ANSWERS.contains(&status.as_str()) {
        return Err(AppError::BadRequest("unknown consent status".to_owned()));
    }
    let mut artefact_ids = strings(&n["consentArtefacts"], Some("id"));
    artefact_ids.truncate(MAX_ARTEFACTS);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let asked = sqlx::query_as::<_, Asked>(&format!(
        "SELECT {ASKED_COLUMNS} FROM abdm_consent_requests r \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
            AND (r.consent_request_id = $2 OR r.id IN (SELECT a.consent_request_id \
                 FROM abdm_consent_artefacts a WHERE a.tenant_id = $1 AND a.role = 'hiu' \
                  AND a.consent_id = ANY($3))) LIMIT 1"
    ))
    .bind(caller.tenant_id)
    .bind(n["consentRequestId"].as_str())
    .bind(&artefact_ids)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let granted = settle(
        &mut tx,
        &caller,
        &asked,
        (&status, n["consentRequestId"].as_str()),
        &artefact_ids,
    )
    .await?;
    tx.commit().await?;

    let hiu = connect_hiu(&state, &caller).await?;
    let acknowledgement: Vec<Value> = artefact_ids
        .iter()
        .map(|id| json!({ "status": "OK", "consentId": id }))
        .collect();
    let ack = json!({ "acknowledgement": acknowledgement,
                      "response": { "requestId": caller.request_id } });
    hiu.send_as_hiu(CONSENT_HIU_ON_NOTIFY_PATH, &ack).await?;
    fetch_all(&state, &hiu, granted).await?;
    Ok(StatusCode::ACCEPTED)
}

#[derive(sqlx::FromRow)]
struct Fetched {
    id: Uuid,
    status: String,
    abha_address: String,
    hi_types: Vec<String>,
    date_from: DateTime<Utc>,
    date_to: DateTime<Utc>,
    data_erase_at: DateTime<Utc>,
}

/// `POST /api/v3/hiu/consent/on-fetch` — the artefact; then ask for its data.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for an artefact we do not hold.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_fetch(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = caller_of(&state, &headers).await?;
    let detail = &body["consent"]["consentDetail"];
    let consent_id = detail["consentId"].as_str().unwrap_or_default();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let held = sqlx::query_as::<_, Fetched>(
        "SELECT a.id, a.status, r.abha_address, r.hi_types, r.date_from, r.date_to, r.data_erase_at \
           FROM abdm_consent_artefacts a JOIN abdm_consent_requests r ON r.id = a.consent_request_id \
          WHERE a.tenant_id = $1 AND a.role = 'hiu' AND a.consent_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(caller.tenant_id)
    .bind(consent_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let window = grant_window(&body, &caller, &held);
    let (hi_status, window) = match (error_of(&body), window) {
        (Some(_), _) => ("fetch_failed", None),
        (None, None) => ("out_of_scope", None),
        (None, Some(w)) => ("fetched", Some(w)),
    };
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET hi_status = $3, hip_id = $4, hip_name = $5, \
                care_context_refs = $6, signature = $7, purpose_text = $8, \
                hi_types = COALESCE($9, hi_types), date_from = COALESCE($10, date_from), \
                date_to = COALESCE($11, date_to), data_erase_at = COALESCE($12, data_erase_at) \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(caller.tenant_id)
    .bind(held.id)
    .bind(hi_status)
    .bind(detail["hip"]["id"].as_str())
    .bind(detail["hip"]["name"].as_str())
    .bind(strings(
        &detail["careContexts"],
        Some("careContextReference"),
    ))
    .bind(body["consent"]["signature"].as_str())
    .bind(detail["purpose"]["text"].as_str())
    .bind(window.as_ref().map(|w| w.hi_types.clone()))
    .bind(window.as_ref().map(|w| w.from))
    .bind(window.as_ref().map(|w| w.to))
    .bind(window.as_ref().map(|w| w.erase_at))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    let Some(window) = window else {
        return Ok(StatusCode::ACCEPTED);
    };
    let hiu = connect_hiu(&state, &caller).await?;
    // Recorded on the artefact (`request_failed`); the gateway still gets 202.
    if let Err(e) = request_data(&state, &hiu, held.id, consent_id, &window).await {
        tracing::warn!(error = %e, "abdm hiu: health-information request failed");
    }
    Ok(StatusCode::ACCEPTED)
}

/// The artefact's scope, narrowed to what was asked — `None` when it is not
/// a granted consent for this patient and this HIU, or nothing survives.
fn grant_window(body: &Value, caller: &Caller, held: &Fetched) -> Option<scope::Window> {
    let detail = &body["consent"]["consentDetail"];
    let patient = detail["patient"]["id"].as_str().unwrap_or_default();
    let hiu_matches = detail["hiu"]["id"].as_str() == Some(caller.hip_id.as_str());
    let granted = body["consent"]["status"] == "GRANTED" && held.status == "GRANTED";
    if !(granted && hiu_matches && patient.eq_ignore_ascii_case(&held.abha_address)) {
        return None;
    }
    let permission = &detail["permission"];
    let asked = scope::Window {
        hi_types: held.hi_types.clone(),
        from: held.date_from,
        to: held.date_to,
        erase_at: held.data_erase_at,
    };
    let given = scope::Window {
        hi_types: strings(&detail["hiTypes"], None),
        from: time(&permission["dateRange"]["from"]).unwrap_or(asked.from),
        to: time(&permission["dateRange"]["to"]).unwrap_or(asked.to),
        erase_at: time(&permission["dataEraseAt"]).unwrap_or(asked.erase_at),
    };
    scope::narrow(&asked, &given)
}

/// `POST /api/v3/hiu/health-information/on-request` — the transaction id.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for a request we did not send.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = caller_of(&state, &headers).await?;
    let request_id = request_id_of(&body).ok_or(AppError::NotFound)?;
    let hi = &body["hiRequest"];
    let acknowledged = error_of(&body).is_none() && hi["sessionStatus"] == "ACKNOWLEDGED";
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let done = sqlx::query(
        "UPDATE abdm_consent_artefacts SET transaction_id = COALESCE(transaction_id, $3), \
                hi_status = CASE WHEN $4 THEN 'acknowledged' ELSE 'request_failed' END, \
                key_material_sealed = CASE WHEN $4 THEN key_material_sealed END \
          WHERE tenant_id = $1 AND role = 'hiu' AND hi_request_id = $2 AND deleted_at IS NULL",
    )
    .bind(caller.tenant_id)
    .bind(request_id)
    .bind(hi["transactionId"].as_str())
    .bind(acknowledged)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::ACCEPTED)
}
