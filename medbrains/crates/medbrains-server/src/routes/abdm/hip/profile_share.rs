//! ABDM Scan & Share, gateway side: a patient scanned a counter's QR with
//! their ABHA app and shared their profile. We keep it for the registration
//! desk, put them in the counter's queue and answer with the token number.
//!
//! - Idempotent per gateway `REQUEST-ID`: a retry gets the same token.
//! - The same ABHA scanning again at the same counter while their token is
//!   still waiting gets that token, not a second one.
//! - The token goes into the unified `tokens` queue (module `registration`,
//!   scoped to the counter's station), carrying the patient when their
//!   verified ABHA already names exactly one patient here.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::scan_share::{ON_SHARE_PATH, SharedProfile, parse_share};
use medbrains_tokens::{IssueToken, issue_token_or_reason_in_tx};
use serde_json::{Value, json};
use uuid::Uuid;

use super::gateway::{Caller, Hip, authenticate};
use crate::{error::AppError, state::AppState};

/// How long a Scan & Share token stays good; never past the end of the day.
pub const TOKEN_VALID_MINUTES: i32 = 120;
/// The queue a share's token joins: the registration counter's.
pub const TOKEN_MODULE: &str = "registration";
/// What a share's token points back at.
pub const TOKEN_ENTITY: &str = "abdm_profile_share";

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The token a share was given, if its queue took one.
#[derive(Debug)]
struct Issued {
    token_number: Option<String>,
    expires_at: DateTime<Utc>,
}

/// `POST /api/v3/hip/patient/share` (inferred path; see `scan_share`).
///
/// # Errors
/// 401 without a valid gateway JWT; 503 when the answer cannot be sent.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn share(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let answer = match parse_share(&body) {
        Some(profile) => {
            let issued = record_share(&state, &caller, &profile).await?;
            on_share(&caller, &profile, &issued)
        }
        None => json!({
            "acknowledgement": { "status": "FAILURE" },
            "error": { "code": "ABDM-1017", "message": "The shared profile names no ABHA address" },
            "response": { "requestId": caller.request_id },
        }),
    };
    let hip = Hip::connect(
        &state.db,
        state.secret_resolver.as_ref(),
        caller.tenant_id,
        &caller.hip_id,
    )
    .await?;
    hip.send(ON_SHARE_PATH, None, &answer).await?;
    Ok(StatusCode::ACCEPTED)
}

fn on_share(caller: &Caller, profile: &SharedProfile, issued: &Issued) -> Value {
    let expiry = (issued.expires_at - Utc::now()).num_seconds().max(0);
    json!({
        "acknowledgement": {
            "abhaAddress": profile.abha_address,
            "status": "SUCCESS",
            "profile": {
                "context": profile.counter,
                "tokenNumber": issued.token_number,
                "expiry": expiry.to_string(),
            },
        },
        "response": { "requestId": caller.request_id },
    })
}

async fn record_share(
    state: &AppState,
    caller: &Caller,
    profile: &SharedProfile,
) -> Result<Issued, AppError> {
    // Without a REQUEST-ID there is nothing to be idempotent on.
    let request_id = if caller.request_id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        caller.request_id.clone()
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    // One share per ABHA at a time, so a retry and a re-scan cannot both mint a token.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(format!(
            "scanshare:{}:{}",
            caller.tenant_id, profile.abha_address
        ))
        .execute(&mut *tx)
        .await?;
    let station = counter(&mut tx, caller.tenant_id, profile.counter.as_deref()).await?;
    if let Some(issued) = existing(&mut tx, caller.tenant_id, &request_id, profile, station).await?
    {
        tx.commit().await?;
        return Ok(issued);
    }
    let patient_id = matched_patient(&mut tx, caller.tenant_id, profile).await?;
    let id = Uuid::new_v4();
    let token_number = issue(
        &mut tx,
        caller.tenant_id,
        (id, station, patient_id),
        profile,
    )
    .await?;
    let stored = serde_json::to_value(profile)
        .map_err(|e| AppError::Internal(format!("profile json: {e}")))?;
    let expires_at: DateTime<Utc> = sqlx::query_scalar(
        "INSERT INTO abdm_profile_shares (id, tenant_id, facility_id, station_id, counter_code, \
            request_id, abha_number, abha_address, profile, patient_id, token_id, token_number, \
            expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, \
            (SELECT id FROM tokens WHERE tenant_id = $2 AND entity_type = $11 AND entity_id = $1 \
              LIMIT 1), $12, \
            LEAST(now() + make_interval(mins => $13), date_trunc('day', now()) + interval '1 day')) \
         RETURNING expires_at",
    )
    .bind(id)
    .bind(caller.tenant_id)
    .bind(caller.facility_id)
    .bind(station)
    .bind(profile.counter.as_deref())
    .bind(&request_id)
    .bind(profile.abha_number.as_deref())
    .bind(&profile.abha_address)
    .bind(stored)
    .bind(patient_id)
    .bind(TOKEN_ENTITY)
    .bind(token_number.as_deref())
    .bind(TOKEN_VALID_MINUTES)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Issued {
        token_number,
        expires_at,
    })
}

/// The counter the QR named: an active station with that code. An unknown
/// code still queues the patient, at no particular counter.
async fn counter(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    code: Option<&str>,
) -> Result<Option<Uuid>, AppError> {
    let Some(code) = code else { return Ok(None) };
    Ok(sqlx::query_scalar(
        "SELECT id FROM stations WHERE tenant_id = $1 AND code = $2 \
           AND deleted_at IS NULL AND is_active",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The same request again, or the same ABHA at the same counter today with
/// its token still waiting.
async fn existing(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request_id: &str,
    profile: &SharedProfile,
    station: Option<Uuid>,
) -> Result<Option<Issued>, AppError> {
    let row = sqlx::query_as::<_, (Option<String>, DateTime<Utc>)>(
        "SELECT token_number, expires_at FROM abdm_profile_shares \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND (request_id = $2 OR (abha_address = $3 AND station_id IS NOT DISTINCT FROM $4 \
                 AND status = 'waiting' AND expires_at > now() \
                 AND created_at >= date_trunc('day', now()))) \
          ORDER BY (request_id = $2) DESC, created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(&profile.abha_address)
    .bind(station)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|(token_number, expires_at)| Issued {
        token_number,
        expires_at,
    }))
}

/// The one patient whose verified ABHA (address or number) this is.
pub(crate) async fn matched_patient(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    profile: &SharedProfile,
) -> Result<Option<Uuid>, AppError> {
    let found = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT l.patient_id FROM patient_abha_links l \
           JOIN patients p ON p.id = l.patient_id AND p.deleted_at IS NULL \
          WHERE l.tenant_id = $1 AND l.verified_at IS NOT NULL AND l.deleted_at IS NULL \
            AND l.unlinked_at IS NULL \
            AND (lower(l.abha_address) = $2 \
              OR ($3::text IS NOT NULL AND regexp_replace(l.abha_number, '\\D', '', 'g') = $3)) \
          LIMIT 2",
    )
    .bind(tenant_id)
    .bind(&profile.abha_address)
    .bind(profile.abha_number.as_deref())
    .fetch_all(&mut **tx)
    .await?;
    Ok(match found.as_slice() {
        [one] => Some(*one),
        _ => None,
    })
}

/// A token in the counter's registration queue. `None` when tokens are off
/// or the queue is closed (the reason is logged; the share still waits).
async fn issue(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    (share_id, station, patient_id): (Uuid, Option<Uuid>, Option<Uuid>),
    profile: &SharedProfile,
) -> Result<Option<String>, AppError> {
    let issued = issue_token_or_reason_in_tx(
        tx,
        tenant_id,
        IssueToken {
            visit_id: None,
            module: TOKEN_MODULE,
            scope: if station.is_some() {
                "station"
            } else {
                "global"
            },
            scope_id: station,
            scope_label: None,
            priority: "normal",
            patient_id,
            // The patient's own name when matched; else the name they shared.
            patient_name: if patient_id.is_some() {
                None
            } else {
                profile.full_name.as_deref()
            },
            entity_type: Some(TOKEN_ENTITY),
            entity_id: Some(share_id),
            issued_by: None,
        },
    )
    .await?;
    Ok(issued.unwrap_or_else(|reason| {
        tracing::info!(reason, "scan & share: the queue took no token");
        None
    }))
}
