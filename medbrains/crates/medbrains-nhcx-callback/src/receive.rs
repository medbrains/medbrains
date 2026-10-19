//! The NHCX callback receiver — where the gateway delivers payers' answers.
//!
//! The hospital registers `{origin}/api/integrations/nhcx/hcx/v1` as its
//! NHCX `endpoint_url`; the gateway then POSTs to `…/coverageeligibility/on_check`,
//! `…/preauth/on_submit`, `…/claim/on_submit`, `…/communication/request`,
//! `…/paymentnotice/request`, `…/hcx/on_status`, `…/hcx/on_search`, and
//! the cancel and reprocess replies `…/claim/on_cancel`, `…/claim/on_reprocess`.
//!
//! Each request:
//! 1. names its recipient (`x-hcx-recipient_code`) in the JWE protected header
//!    or, for a plain protocol error, in the JSON body — that picks the tenant;
//! 2. must carry the gateway's RS256 bearer JWT, verified against the
//!    gateway key saved in that tenant's Settings → NHCX — before anything is
//!    decrypted or stored;
//! 3. is decrypted with the tenant's private key (the decryption authenticates
//!    the routing headers, which are then re-read from the result);
//! 4. is matched to what it answers — an eligibility check, pre-authorisation
//!    or claim — by correlation id *and* the payer it was sent to, so one
//!    payer cannot answer for another's request (see [`crate::apply`]);
//! 5. is logged, then acknowledged with `{timestamp, correlation_id, api_call_id}`.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, header::AUTHORIZATION};
use base64::Engine;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use medbrains_outbox::handlers::nhcx::config::{self, ConfigError};

use crate::apply;
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

/// The callbacks a provider receives, as `(resource, action)`.
const CALLBACKS: &[(&str, &str)] = &[
    ("coverageeligibility", "on_check"),
    ("preauth", "on_submit"),
    ("claim", "on_submit"),
    // INFERRED: the replies to the cancel and reprocess Tasks; see
    // `medbrains_core::nhcx::PATH_CANCEL`.
    ("claim", "on_cancel"),
    ("claim", "on_reprocess"),
    ("communication", "request"),
    ("paymentnotice", "request"),
    ("hcx", "on_status"),
    ("hcx", "on_search"),
];

/// `POST /api/integrations/nhcx/hcx/v1/{resource}/{action}` — a gateway callback.
///
/// # Errors
/// 404 for an unknown callback or recipient; 401 without a valid gateway JWT;
/// 503 when the hospital's NHCX keys are not set up; 400 for a message that
/// cannot be decrypted or names no correlation id.
#[tracing::instrument(skip_all)]
pub async fn receive_callback(
    State(state): State<AppState>,
    Path((resource, action)): Path<(String, String)>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    if !CALLBACKS.contains(&(resource.as_str(), action.as_str())) {
        return Err(AppError::NotFound);
    }
    let jwe = body.get("payload").and_then(Value::as_str);
    let routing = match jwe {
        Some(token) => unverified_protected_header(token)?,
        None => body.as_object().cloned().unwrap_or_default(),
    };
    let recipient = text(&routing, "x-hcx-recipient_code").ok_or(AppError::NotFound)?;
    let tenant_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE abdm_hcx_sender_code = $1 AND deleted_at IS NULL",
    )
    .bind(&recipient)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let stored = config::stored(&mut tx, tenant_id)
        .await
        .map_err(config_error)?;
    verify_gateway_jwt(&headers, &stored)?;

    let (routing, response) = match jwe {
        Some(token) => {
            let key = config::private_key(&stored, state.secret_resolver.as_ref())
                .await
                .map_err(config_error)?;
            medbrains_crypto::jwe::decrypt_hcx(token, key.as_bytes()).map_err(|_| {
                AppError::BadRequest("the NHCX message could not be decrypted".into())
            })?
        }
        None => (routing, body.clone()),
    };
    if text(&routing, "x-hcx-recipient_code").as_deref() != Some(recipient.as_str()) {
        return Err(AppError::BadRequest(
            "the NHCX message names another recipient".into(),
        ));
    }
    let correlation_id = text(&routing, "x-hcx-correlation_id")
        .and_then(|c| Uuid::parse_str(&c).ok())
        .ok_or_else(|| AppError::BadRequest("x-hcx-correlation_id is missing".into()))?;
    let api_call_id = text(&routing, "x-hcx-api_call_id");
    let sender = text(&routing, "x-hcx-sender_code").unwrap_or_default();
    let status = text(&routing, "x-hcx-status").unwrap_or_else(|| {
        if jwe.is_some() {
            "response.complete"
        } else {
            "response.error"
        }
        .to_owned()
    });

    let inbound = apply::Inbound {
        tenant_id,
        correlation_id,
        workflow_id: text(&routing, "x-hcx-workflow_id").and_then(|w| Uuid::parse_str(&w).ok()),
        api_call_id: api_call_id.as_deref().and_then(|a| Uuid::parse_str(a).ok()),
        sender: &sender,
        status: &status,
        response: &response,
    };
    let matched = apply::apply(&mut tx, &resource, &action, &inbound).await?;

    sqlx::query(
        "INSERT INTO nhcx_callback_log \
         (tenant_id, correlation_id, api_call_id, sender_code, recipient_code, callback_type, \
          raw_envelope, decrypted_payload, verification_status, matched_table, matched_id, \
          error_detail) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', $9, $10, $11)",
    )
    .bind(tenant_id)
    .bind(correlation_id)
    .bind(api_call_id.as_deref().and_then(|a| Uuid::parse_str(a).ok()))
    .bind(&sender)
    .bind(&recipient)
    .bind(format!("{resource}/{action}"))
    .bind(&body)
    .bind(&response)
    .bind(matched.map(|(table, _)| table))
    .bind(matched.map(|(_, id)| id))
    .bind(
        matched
            .is_none()
            .then_some("nothing sent to this payer has this correlation id"),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    tracing::info!(%tenant_id, %correlation_id, matched = matched.is_some(), "nhcx callback");
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "correlation_id": correlation_id,
            "api_call_id": api_call_id,
        })),
    ))
}

/// The JWE protected header, read before decryption only to find the tenant
/// whose keys decrypt it. Nothing is trusted from it until decryption
/// authenticates it.
fn unverified_protected_header(token: &str) -> Result<Map<String, Value>, AppError> {
    let bad = || AppError::BadRequest("the NHCX payload is not a compact JWE".into());
    let segment = token.split('.').next().ok_or_else(bad)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(segment)
        .map_err(|_| bad())?;
    serde_json::from_slice(&bytes).map_err(|_| bad())
}

fn verify_gateway_jwt(
    headers: &HeaderMap,
    stored: &config::StoredSettings,
) -> Result<(), AppError> {
    let key = stored
        .gateway_jwt_public_key_pem
        .as_deref()
        .ok_or_else(|| AppError::ServiceUnavailable("the NHCX gateway key is not set up".into()))?;
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;
    medbrains_crypto::jws::verify_rs256(token, key.as_bytes()).map_err(|_| {
        tracing::warn!("nhcx callback refused: gateway JWT did not verify");
        AppError::Unauthorized
    })?;
    Ok(())
}

fn config_error(e: ConfigError) -> AppError {
    match e {
        ConfigError::NotSetUp(m) => AppError::ServiceUnavailable(m),
        ConfigError::Db(e) => AppError::from(e),
    }
}

fn text(map: &Map<String, Value>, key: &str) -> Option<String> {
    map.get(key).and_then(Value::as_str).map(str::to_owned)
}
