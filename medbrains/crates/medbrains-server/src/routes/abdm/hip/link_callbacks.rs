//! The gateway's two answers to HIP-initiated linking: the link token
//! (`on-generate-token`), then the verdict on the link (`on_carecontext`).
//! Each is matched to its care contexts by the `REQUEST-ID` we sent.

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use uuid::Uuid;

use super::gateway::{Hip, authenticate};
use super::linking::{
    LINK_BATCH, TOKEN_CONTEXT, TOKEN_DAYS, load_patient, mark, mark_linked, send_links,
};
use crate::{error::AppError, routes::abdm::abha::secret_key, state::AppState};

fn request_id_of(body: &Value) -> Option<Uuid> {
    body["response"]["requestId"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
}

fn error_of(body: &Value) -> Option<String> {
    let e = &body["error"];
    (!e.is_null()).then(|| {
        e["message"]
            .as_str()
            .unwrap_or("ABDM refused the request")
            .to_owned()
    })
}

/// When the token expires: its own `exp` claim, else ABDM's six months.
fn token_expiry(token: &str) -> DateTime<Utc> {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    token
        .split('.')
        .nth(1)
        .and_then(|seg| URL_SAFE_NO_PAD.decode(seg.trim_end_matches('=')).ok())
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|claims| claims["exp"].as_i64())
        .and_then(|exp| DateTime::from_timestamp(exp, 0))
        .unwrap_or_else(|| Utc::now() + Duration::days(TOKEN_DAYS))
}

/// The care contexts waiting on `request_id`, and their patient.
async fn waiting_on(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<Vec<(Uuid, Uuid)>, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let rows = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT id, patient_id FROM abdm_care_contexts \
          WHERE tenant_id = $1 AND abdm_request_id = $2 AND deleted_at IS NULL LIMIT $3",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(LINK_BATCH)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// `POST /api/v3/hip/token/on-generate-token` — the link token arrives.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for an unknown request.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_generate_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let request_id = request_id_of(&body).ok_or(AppError::NotFound)?;
    let waiting = waiting_on(&state.db, caller.tenant_id, request_id).await?;
    let ids: Vec<Uuid> = waiting.iter().map(|w| w.0).collect();
    let patient_id = waiting.first().map(|w| w.1).ok_or(AppError::NotFound)?;
    let token = body["linkToken"].as_str().filter(|t| !t.is_empty());
    let (Some(token), None) = (token, error_of(&body)) else {
        let reason = error_of(&body).unwrap_or_else(|| "ABDM sent no link token".to_owned());
        mark(
            &state.db,
            caller.tenant_id,
            &ids,
            "failed",
            Some(reason.as_str()),
            None,
        )
        .await?;
        return Ok(StatusCode::ACCEPTED);
    };
    let secrets = state.secret_resolver.as_ref();
    let key = secret_key(secrets).await;
    let sealed = medbrains_crypto::aead::encrypt_token(&key, TOKEN_CONTEXT, &token)
        .map_err(|_| AppError::Internal("could not seal the ABDM link token".to_owned()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &caller.tenant_id).await?;
    let patient = load_patient(&mut tx, caller.tenant_id, patient_id).await?;
    if let Some(link_id) = patient.link_id {
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        sqlx::query(
            "UPDATE patient_abha_links SET linking_token = $3, token_expiry = $4 \
              WHERE tenant_id = $1 AND id = $2",
        )
        .bind(caller.tenant_id)
        .bind(link_id)
        .bind(&sealed)
        .bind(token_expiry(token))
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    let hip = Hip::connect(&state.db, secrets, caller.tenant_id, &caller.hip_id).await?;
    // A refusal is recorded on the care contexts; the gateway still gets 202.
    if let Err(e) = send_links(&state.db, &hip, caller.tenant_id, &patient, token).await {
        tracing::warn!(error = %e, "abdm: linking after the token arrived failed");
    }
    Ok(StatusCode::ACCEPTED)
}

/// `POST /api/v3/link/on_carecontext` — ABDM's verdict on a link.
///
/// # Errors
/// 401 without a valid gateway JWT; 404 for an unknown request.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn on_link_care_context(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    let caller = authenticate(&state, &headers).await?;
    tracing::Span::current().record("tenant_id", tracing::field::display(caller.tenant_id));
    let request_id = request_id_of(&body).ok_or(AppError::NotFound)?;
    let ids: Vec<Uuid> = waiting_on(&state.db, caller.tenant_id, request_id)
        .await?
        .into_iter()
        .map(|w| w.0)
        .collect();
    if ids.is_empty() {
        return Err(AppError::NotFound);
    }
    if let Some(reason) = error_of(&body) {
        mark(
            &state.db,
            caller.tenant_id,
            &ids,
            "failed",
            Some(reason.as_str()),
            None,
        )
        .await?;
        return Ok(StatusCode::ACCEPTED);
    }
    mark_linked(&state.db, caller.tenant_id, &ids, "hip_initiated").await?;
    Ok(StatusCode::ACCEPTED)
}
