//! User-initiated discovery and linking (ABDM v3): the patient's PHR app
//! asks, through the gateway, which records this hospital holds for them,
//! then links them with an OTP the hospital sends to the registered mobile.
//!
//! Matching never leaks another patient: a verified ABHA (address or number)
//! first; otherwise the verified mobile, gender, year of birth and full name
//! must all agree and pick out exactly one patient. Anything else is "not
//! found".

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{Duration, SecondsFormat, Utc};
use medbrains_abdm::gateway::{ON_DISCOVER_PATH, ON_LINK_CONFIRM_PATH, ON_LINK_INIT_PATH};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::gateway::{Caller, Hip, authenticate};
use super::linking::{mark_linked, patient_entries};
use crate::{error::AppError, state::AppState};

const OTP_MINUTES: i64 = 10;
const OTP_MAX_ATTEMPTS: i32 = 5;
const CONTEXT_LIMIT: i64 = 100;
const NOT_FOUND: (&str, &str) = ("ABDM-1010", "Patient not found");
const WRONG_OTP: (&str, &str) = ("ABDM-1035", "Incorrect OTP");

fn identifier(patient: &Value, kind: &str) -> Option<String> {
    patient["verifiedIdentifiers"]
        .as_array()?
        .iter()
        .find(|i| i["type"] == kind)
        .and_then(|i| i["value"].as_str())
        .map(str::to_owned)
}

fn digits(s: &str) -> String {
    s.chars().filter(char::is_ascii_digit).collect()
}

/// The one patient the discovery request names, and how it was matched.
async fn match_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient: &Value,
) -> Result<Option<(Uuid, &'static str)>, AppError> {
    let address = patient["id"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    let number = identifier(patient, "ABHA_NUMBER").map(|n| digits(&n));
    let by_abha = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT patient_id FROM patient_abha_links \
          WHERE tenant_id = $1 AND verified_at IS NOT NULL AND deleted_at IS NULL \
            AND unlinked_at IS NULL \
            AND ((abha_address IS NOT NULL AND lower(abha_address) = $2) \
              OR ($3::text IS NOT NULL AND regexp_replace(abha_number, '\\D', '', 'g') = $3)) \
          LIMIT 2",
    )
    .bind(tenant_id)
    .bind(&address)
    .bind(number.as_deref())
    .fetch_all(&mut **tx)
    .await?;
    if let [one] = by_abha.as_slice() {
        return Ok(Some((*one, "ABHA_ADDRESS")));
    }
    let Some(mobile) = identifier(patient, "MOBILE").map(|m| digits(&m)) else {
        return Ok(None);
    };
    let gender = match patient["gender"].as_str() {
        Some("M") => "male",
        Some("F") => "female",
        Some("O") => "other",
        _ => return Ok(None),
    };
    let by_demographics = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM patients \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND length($2) >= 10 \
            AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = right($2, 10) \
            AND gender::text = $3 AND date_part('year', date_of_birth) = $4 \
            AND lower(regexp_replace(btrim(first_name || ' ' || last_name), '\\s+', ' ', 'g')) \
                = lower(regexp_replace(btrim($5), '\\s+', ' ', 'g')) \
          LIMIT 2",
    )
    .bind(tenant_id)
    .bind(&mobile)
    .bind(gender)
    .bind(patient["yearOfBirth"].as_f64().unwrap_or(-1.0))
    .bind(patient["name"].as_str().unwrap_or_default())
    .fetch_all(&mut **tx)
    .await?;
    Ok(match by_demographics.as_slice() {
        [one] => Some((*one, "MOBILE")),
        _ => None,
    })
}

/// The patient's UHID, name and unlinked care contexts (reference, display, HI type).
async fn unlinked_contexts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    only: Option<&[String]>,
) -> Result<(String, String, Vec<(Uuid, String, String, String)>), AppError> {
    let (uhid, name) = sqlx::query_as::<_, (String, String)>(
        "SELECT uhid, btrim(first_name || ' ' || last_name) FROM patients \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    let rows = sqlx::query_as::<_, (Uuid, String, String, String)>(
        "SELECT id, reference_number, display, hi_types[1] FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
            AND link_status <> 'linked' AND ($3::text[] IS NULL OR reference_number = ANY($3)) \
          ORDER BY record_date DESC LIMIT $4",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(only)
    .bind(CONTEXT_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    Ok((uhid, name, rows))
}

fn triples(rows: &[(Uuid, String, String, String)]) -> Vec<(String, String, String)> {
    rows.iter()
        .map(|(_, r, d, h)| (r.clone(), d.clone(), h.clone()))
        .collect()
}

async fn reply(
    state: &AppState,
    caller: &Caller,
    path: &str,
    body: &Value,
) -> Result<(), AppError> {
    let hip = Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        caller.tenant_id,
        &caller.hip_id,
    )
    .await?;
    hip.send(path, None, body).await.map(|_| ())
}

fn error_body(code: (&str, &str)) -> Value {
    json!({ "code": code.0, "message": code.1 })
}

/// `POST /api/v3/hip/patient/care-context/discover`.
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the answer cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn discover(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let matched = match_patient(&mut tx, caller.tenant_id, &body["patient"]).await?;
    let mut answer = json!({
        "transactionId": body["transactionId"],
        "response": { "requestId": caller.request_id },
    });
    if let Some((patient_id, matched_by)) = matched {
        let (uhid, name, rows) =
            unlinked_contexts(&mut tx, caller.tenant_id, patient_id, None).await?;
        answer["patient"] = patient_entries(&uhid, &name, &triples(&rows));
        answer["matchedBy"] = json!([matched_by]);
    } else {
        answer["error"] = error_body(NOT_FOUND);
    }
    tx.commit().await?;
    reply(&state, &caller, ON_DISCOVER_PATH, &answer).await?;
    Ok(StatusCode::ACCEPTED)
}

fn otp_hash(link_ref: Uuid, otp: &str) -> String {
    hex::encode(Sha256::digest(format!("{link_ref}:{otp}").as_bytes()))
}

/// `POST /api/v3/hip/link/care-context/init` — send the OTP.
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the answer cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn link_init(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let entries = body["patient"].as_array().cloned().unwrap_or_default();
    let uhid = entries
        .first()
        .and_then(|p| p["referenceNumber"].as_str())
        .unwrap_or_default();
    let refs: Vec<String> = entries
        .iter()
        .flat_map(|p| p["careContexts"].as_array().cloned().unwrap_or_default())
        .filter_map(|c| c["referenceNumber"].as_str().map(str::to_owned))
        .take(usize::try_from(CONTEXT_LIMIT).unwrap_or(100))
        .collect();
    let abha_address = body["abhaAddress"]
        .as_str()
        .unwrap_or_default()
        .to_lowercase();
    let mut answer = json!({
        "transactionId": body["transactionId"],
        "response": { "requestId": caller.request_id },
    });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // The patient by UHID, refusing one whose verified ABHA is someone else's.
    let patient = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT p.id, p.phone FROM patients p \
          WHERE p.tenant_id = $1 AND p.uhid = $2 AND p.deleted_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM patient_abha_links l \
                 WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id \
                   AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL \
                   AND l.abha_address IS NOT NULL AND lower(l.abha_address) <> $3)",
    )
    .bind(caller.tenant_id)
    .bind(uhid)
    .bind(&abha_address)
    .fetch_optional(&mut *tx)
    .await?;
    let found = match patient {
        Some((id, Some(phone))) if !refs.is_empty() => {
            let (_, _, rows) =
                unlinked_contexts(&mut tx, caller.tenant_id, id, Some(refs.as_slice())).await?;
            (rows.len() == refs.len()).then_some((id, phone))
        }
        _ => None,
    };
    if let Some((patient_id, phone)) = found {
        let link_ref = Uuid::new_v4();
        let otp = new_otp()?;
        let expires = Utc::now() + Duration::minutes(OTP_MINUTES);
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query(
            "INSERT INTO abdm_link_requests (tenant_id, patient_id, transaction_id, link_ref_number, \
                    abha_address, care_context_refs, otp_hash, expires_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(caller.tenant_id)
        .bind(patient_id)
        .bind(body["transactionId"].as_str().unwrap_or_default())
        .bind(link_ref)
        .bind(&abha_address)
        .bind(&refs)
        .bind(otp_hash(link_ref, &otp))
        .bind(expires)
        .execute(&mut *tx)
        .await?;
        queue_otp_sms(&mut tx, caller.tenant_id, link_ref, &phone, &otp).await?;
        answer["link"] = json!({
            "referenceNumber": link_ref.to_string(),
            "authenticationType": "DIRECT",
            "meta": { "communicationMedium": "MOBILE", "communicationHint": "OTP",
                      "communicationExpiry": expires.to_rfc3339_opts(SecondsFormat::Millis, true) },
        });
    } else {
        answer["error"] = error_body(NOT_FOUND);
    }
    tx.commit().await?;
    reply(&state, &caller, ON_LINK_INIT_PATH, &answer).await?;
    Ok(StatusCode::ACCEPTED)
}

fn new_otp() -> Result<String, AppError> {
    let mut buf = [0_u8; 4];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("otp generation failed: {e}")))?;
    Ok(format!("{:06}", u32::from_le_bytes(buf) % 1_000_000))
}

async fn queue_otp_sms(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    link_ref: Uuid,
    phone: &str,
    otp: &str,
) -> Result<(), AppError> {
    medbrains_outbox::queue::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "abdm_link_request",
            aggregate_id: Some(link_ref),
            event_type: "sms.abdm_link_otp",
            payload: json!({
                "to": phone,
                "body": format!(
                    "{otp} is your code to link this hospital's health records to your ABHA. \
                     Valid for {OTP_MINUTES} minutes. Do not share it."
                ),
            }),
            idempotency_key: Some(link_ref.to_string()),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue the ABDM link OTP: {e}")))?;
    Ok(())
}

/// `POST /api/v3/hip/link/care-context/confirm` — check the OTP and link.
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the answer cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn link_confirm(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let confirmation = &body["confirmation"];
    let link_ref = confirmation["linkRefNumber"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_default();
    let otp = match &confirmation["token"] {
        Value::Number(n) => format!("{:0>6}", n.to_string()),
        other => other.as_str().unwrap_or_default().trim().to_owned(),
    };
    let mut answer = json!({ "response": { "requestId": caller.request_id } });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let request = sqlx::query_as::<_, (Uuid, Uuid, Vec<String>, String)>(
        "UPDATE abdm_link_requests SET attempts = attempts + 1 \
          WHERE tenant_id = $1 AND link_ref_number = $2 AND status = 'pending' \
            AND expires_at > now() AND attempts < $3 \
          RETURNING id, patient_id, care_context_refs, otp_hash",
    )
    .bind(caller.tenant_id)
    .bind(link_ref)
    .bind(OTP_MAX_ATTEMPTS)
    .fetch_optional(&mut *tx)
    .await?;
    let mut linked = Vec::new();
    match request {
        Some((id, patient_id, refs, hash)) if hash == otp_hash(link_ref, &otp) => {
            // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
            sqlx::query("UPDATE abdm_link_requests SET status = 'confirmed' WHERE tenant_id = $1 AND id = $2")
                .bind(caller.tenant_id)
                .bind(id)
                .execute(&mut *tx)
                .await?;
            let (uhid, name, rows) =
                unlinked_contexts(&mut tx, caller.tenant_id, patient_id, Some(refs.as_slice()))
                    .await?;
            answer["patient"] = patient_entries(&uhid, &name, &triples(&rows));
            linked = rows.iter().map(|r| r.0).collect();
        }
        _ => answer["error"] = error_body(WRONG_OTP),
    }
    tx.commit().await?;
    if !linked.is_empty() {
        mark_linked(&state.db, caller.tenant_id, &linked, "user_initiated").await?;
    }
    reply(&state, &caller, ON_LINK_CONFIRM_PATH, &answer).await?;
    Ok(StatusCode::ACCEPTED)
}
