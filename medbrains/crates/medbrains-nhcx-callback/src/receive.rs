//! The NHCX callback receiver — where the gateway delivers payers' answers.
//!
//! The hospital registers `{origin}/api/integrations/nhcx/hcx` as its NHCX
//! `endpoint_url`; the gateway appends `/v1/<resource>/<action>` itself and
//! POSTs to `…/v1/coverageeligibility/on_check`, `…/v1/preauth/on_submit`,
//! `…/v1/claim/on_submit`, `…/v1/communication/request`,
//! `…/v1/paymentnotice/request`, `…/v1/task/on_submit`,
//! `…/v1/search/on_submit`, `…/v1/insuranceplan/on_request`, `…/v1/on_status`
//! and `…/v1/error` (NHA's NHCX package, docs.abdm.gov.in, "Receiving a
//! Callback").
//!
//! Each delivery:
//! 1. names its recipient (`x-hcx-recipient_code`) in the JWE protected header
//!    or, for a plain protocol error, in the JSON body — that picks the tenant;
//! 2. is authenticated ([`crate::gateway_auth`]) before anything is
//!    decrypted or applied;
//! 3. is decrypted with the tenant's private key (the decryption authenticates
//!    the routing headers, which are then re-read from the result);
//! 4. is matched to what it answers by correlation id (a retry's alias
//!    resolved to the record's) *and* the payer it was sent to;
//! 5. is logged, and answered `202` with the receipt NHCX expects.
//!
//! Every delivery is answered `202`, a refused one too — the refusal goes in
//! the receipt's `error` and on the callback log. Anything else makes NHCX
//! retry five times and retire the correlation. Only our own fault (the
//! database unreachable) answers 5xx, so the gateway tries again rather than
//! being told a message it never landed was received.

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, Path, State};
use axum::http::{HeaderMap, StatusCode};
use base64::Engine;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use medbrains_core::nhcx_wire;
use medbrains_outbox::handlers::nhcx::config::{self, ConfigError};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::client_ip::ClientIp;
use medbrains_server_core::state::AppState;

use crate::apply::{self, Tx};
use crate::gateway_auth::{self, Refusal};

/// The callbacks a provider receives, as `(resource, action)`; an empty
/// resource is a path straight under `/v1`.
const CALLBACKS: &[(&str, &str)] = &[
    ("coverageeligibility", "on_check"),
    ("preauth", "on_submit"),
    ("claim", "on_submit"),
    ("communication", "request"),
    ("paymentnotice", "request"),
    ("task", "on_submit"),
    ("search", "on_submit"),
    ("insuranceplan", "on_request"),
    ("", "on_status"),
    ("", "error"),
];

type Reply = Result<(StatusCode, Json<Value>), AppError>;

/// `POST /api/integrations/nhcx/hcx/v1/{resource}/{action}`.
///
/// # Errors
/// 404 for a path NHCX does not deliver to; 5xx only when the database fails.
#[tracing::instrument(skip_all)]
pub async fn receive_callback(
    State(state): State<AppState>,
    Path((resource, action)): Path<(String, String)>,
    ip: Option<Extension<ClientIp>>,
    headers: HeaderMap,
    body: Bytes,
) -> Reply {
    let path = Route::new(resource, action)?;
    let ip = ip.map(|Extension(ClientIp(ip))| ip);
    deliver(&state, &path, ip, &headers, &body).await
}

/// `POST /api/integrations/nhcx/hcx/v1/{action}` — `on_status` and `error`.
///
/// # Errors
/// As [`receive_callback`].
#[tracing::instrument(skip_all)]
pub async fn receive_top_level(
    State(state): State<AppState>,
    Path(action): Path<String>,
    ip: Option<Extension<ClientIp>>,
    headers: HeaderMap,
    body: Bytes,
) -> Reply {
    let path = Route::new(String::new(), action)?;
    let ip = ip.map(|Extension(ClientIp(ip))| ip);
    deliver(&state, &path, ip, &headers, &body).await
}

/// A recognised callback path.
pub(crate) struct Route {
    resource: String,
    action: String,
}

impl Route {
    fn new(resource: String, action: String) -> Result<Self, AppError> {
        if !CALLBACKS.contains(&(resource.as_str(), action.as_str())) {
            return Err(AppError::NotFound);
        }
        Ok(Self { resource, action })
    }

    /// The receipt's `entity_type`: the resource, or the action straight
    /// under `/v1`, with `on_` stripped; `paymentnotice` is `payment`.
    fn entity_type(&self) -> String {
        let name = match self.resource.as_str() {
            "" => self.action.as_str(),
            "paymentnotice" => "payment",
            r => r,
        };
        name.trim_start_matches("on_").to_owned()
    }

    fn label(&self) -> String {
        if self.resource.is_empty() {
            self.action.clone()
        } else {
            format!("{}/{}", self.resource, self.action)
        }
    }

    fn is_error_report(&self) -> bool {
        self.resource.is_empty() && self.action == "error"
    }
}

/// One verified, opened delivery.
struct Opened {
    routing: Map<String, Value>,
    response: Value,
    tenant_id: Uuid,
    jti: String,
}

/// The receipt's error, as `(code, message)`.
type ReceiptError<'a> = Option<(&'a str, &'a str)>;

async fn deliver(
    state: &AppState,
    path: &Route,
    ip: Option<std::net::IpAddr>,
    headers: &HeaderMap,
    bytes: &[u8],
) -> Reply {
    let body: Value = serde_json::from_slice(bytes).unwrap_or(Value::Null);
    let jwe = body.get("payload").and_then(Value::as_str);
    let routing = match jwe {
        Some(token) => unverified_protected_header(token),
        None => body.as_object().cloned().unwrap_or_default(),
    };
    let Some(recipient) = text(&routing, "x-hcx-recipient_code") else {
        tracing::warn!(path = %path.label(), "nhcx callback names no recipient");
        let none = Some(("ERR_INVALID_RECIPIENT", "the message names no recipient"));
        return Ok(receipt(&routing, path, none));
    };
    let tenant_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE abdm_hcx_sender_code = $1 AND deleted_at IS NULL",
    )
    .bind(&recipient)
    .fetch_optional(&state.db)
    .await?;
    let Some(tenant_id) = tenant_id else {
        tracing::warn!(%recipient, path = %path.label(), "nhcx callback for an unknown recipient");
        let unknown = Some(("ERR_INVALID_RECIPIENT", "no hospital here has that code"));
        return Ok(receipt(&routing, path, unknown));
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let stored = config::stored(&mut tx, tenant_id)
        .await
        .map_err(config_error)?;
    let checked = match gateway_auth::check_address(&stored, ip) {
        Ok(()) => gateway_auth::verify(&mut tx, tenant_id, headers, &stored).await?,
        Err(r) => Err(r),
    };
    let opened = match checked {
        Ok(jti) => {
            open(state, &stored, jwe, &routing, &recipient)
                .await
                .map(|(routing, response)| Opened {
                    routing,
                    response,
                    tenant_id,
                    jti,
                })
        }
        Err(r) => Err(r),
    };
    let refusal = match opened {
        Ok(opened) => match land(&mut tx, path, &opened, &body).await? {
            None => {
                tx.commit().await?;
                return Ok(receipt(&opened.routing, path, None));
            }
            Some(refusal) => refusal,
        },
        Err(refusal) => refusal,
    };
    drop(tx);
    let refused = Refused {
        tenant_id,
        path,
        routing: &routing,
        body: &body,
        refusal,
    };
    log_refusal(state, &refused).await?;
    let error = Some((refusal.code(), refusal.message()));
    Ok(receipt(&routing, path, error))
}

/// Decrypt a JWE delivery; a plain protocol response is read as it came.
async fn open(
    state: &AppState,
    stored: &config::StoredSettings,
    jwe: Option<&str>,
    routing: &Map<String, Value>,
    recipient: &str,
) -> Result<(Map<String, Value>, Value), Refusal> {
    let (routing, response) = match jwe {
        Some(token) => {
            let key = config::private_key(stored, state.secret_resolver.as_ref())
                .await
                .map_err(|_| Refusal::Undecryptable)?;
            medbrains_crypto::jwe::decrypt_hcx(token, key.as_bytes())
                .map_err(|_| Refusal::Undecryptable)?
        }
        None => (routing.clone(), Value::Object(routing.clone())),
    };
    if text(&routing, "x-hcx-recipient_code").as_deref() != Some(recipient) {
        return Err(Refusal::WrongRecipient);
    }
    Ok((routing, response))
}

/// Apply a verified delivery and log it. `Some` is a refusal found only
/// after decryption (no correlation id).
async fn land(
    tx: &mut Tx<'_>,
    path: &Route,
    o: &Opened,
    body: &Value,
) -> Result<Option<Refusal>, AppError> {
    let routing = &o.routing;
    let sent = text(routing, "x-hcx-correlation_id").and_then(|c| Uuid::parse_str(&c).ok());
    // An error report's field names are unpublished; it may name nothing.
    let Some(sent) = sent.or_else(|| path.is_error_report().then(Uuid::nil)) else {
        return Ok(Some(Refusal::NoCorrelation));
    };
    let correlation_id = apply::canonical_correlation(tx, o.tenant_id, sent).await?;
    let api_call_id = text(routing, "x-hcx-api_call_id").and_then(|a| Uuid::parse_str(&a).ok());
    let sender = text(routing, "x-hcx-sender_code").unwrap_or_default();
    let workflow = text(routing, "x-hcx-workflow_id");
    // A message that does not say where it stands is not a final answer.
    let status = text(routing, "x-hcx-status").unwrap_or_else(|| {
        let fallback = if body.get("payload").is_some() {
            "unknown"
        } else {
            "response.error"
        };
        fallback.to_owned()
    });
    let inbound = apply::Inbound {
        tenant_id: o.tenant_id,
        correlation_id,
        workflow_id: workflow.as_deref(),
        api_call_id,
        sender: &sender,
        status: &status,
        response: &o.response,
    };
    let matched = apply::apply(tx, &path.resource, &path.action, &inbound).await?;
    let detail = match (matched, path.resource.as_str()) {
        (Some(_), _) => None,
        (None, "insuranceplan") => Some("insurance plan answers are kept but not read yet"),
        (None, _) => Some("nothing sent to this payer has this correlation id"),
    };
    sqlx::query(
        "INSERT INTO nhcx_callback_log \
         (tenant_id, correlation_id, api_call_id, sender_code, recipient_code, callback_type, \
          raw_envelope, decrypted_payload, verification_status, matched_table, matched_id, \
          error_detail, workflow_code, gateway_jti) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', $9, $10, $11, $12, $13)",
    )
    .bind(o.tenant_id)
    .bind((!sent.is_nil()).then_some(sent))
    .bind(api_call_id)
    .bind(&sender)
    .bind(text(routing, "x-hcx-recipient_code"))
    .bind(path.label())
    .bind(body)
    .bind(&o.response)
    .bind(matched.map(|(table, _)| table))
    .bind(matched.map(|(_, id)| id))
    .bind(detail)
    .bind(&workflow)
    .bind(&o.jti)
    .execute(&mut **tx)
    .await?;
    let found = matched.is_some();
    tracing::info!(tenant_id = %o.tenant_id, %correlation_id, matched = found, "nhcx callback");
    Ok(None)
}

struct Refused<'a> {
    tenant_id: Uuid,
    path: &'a Route,
    routing: &'a Map<String, Value>,
    body: &'a Value,
    refusal: Refusal,
}

/// Log a refused delivery in its own transaction. The body is kept only
/// when the sender is known to be the gateway.
async fn log_refusal(state: &AppState, r: &Refused<'_>) -> Result<(), AppError> {
    let reason = r.refusal.message();
    tracing::warn!(tenant_id = %r.tenant_id, path = %r.path.label(), reason, "nhcx callback refused");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &r.tenant_id).await?;
    let uuid = |k: &str| text(r.routing, k).and_then(|v| Uuid::parse_str(&v).ok());
    sqlx::query(
        "INSERT INTO nhcx_callback_log \
         (tenant_id, correlation_id, api_call_id, sender_code, recipient_code, callback_type, \
          raw_envelope, verification_status, error_detail, workflow_code) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(r.tenant_id)
    .bind(uuid("x-hcx-correlation_id"))
    .bind(uuid("x-hcx-api_call_id"))
    .bind(text(r.routing, "x-hcx-sender_code"))
    .bind(text(r.routing, "x-hcx-recipient_code"))
    .bind(r.path.label())
    .bind(r.refusal.is_authenticated().then_some(r.body))
    .bind(r.refusal.status())
    .bind(reason)
    .bind(text(r.routing, "x-hcx-workflow_id"))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// The receipt every delivery gets: `202` with the ids it came with, the
/// routing as NHCX reads it, and an `error` saying why it was refused, if
/// it was.
fn receipt(
    routing: &Map<String, Value>,
    path: &Route,
    error: ReceiptError<'_>,
) -> (StatusCode, Json<Value>) {
    let timestamp = nhcx_wire::receipt_timestamp(chrono::Utc::now());
    let (code, message) = error.unwrap_or(("", ""));
    (
        StatusCode::ACCEPTED,
        Json(json!({
            "timestamp": timestamp,
            "api_call_id": text(routing, "x-hcx-api_call_id"),
            "correlation_id": text(routing, "x-hcx-correlation_id"),
            "result": {
                "sender_code": text(routing, "x-hcx-sender_code"),
                "recipient_code": text(routing, "x-hcx-recipient_code"),
                "entity_type": path.entity_type(),
                "protocol_status": "request.queued",
            },
            "error": { "code": code, "message": message },
        })),
    )
}

/// The JWE protected header, read before decryption only to find the tenant
/// whose keys decrypt it. Nothing is trusted from it until decryption
/// authenticates it; a token that is not a JWE reads as no header.
fn unverified_protected_header(token: &str) -> Map<String, Value> {
    token
        .split('.')
        .next()
        .and_then(|s| {
            base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(s)
                .ok()
        })
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_receipt_names_the_entity_from_the_path() {
        let route = |r: &str, a: &str| Route::new(r.to_owned(), a.to_owned());
        let names: Vec<String> = [
            ("preauth", "on_submit"),
            ("paymentnotice", "request"),
            ("", "on_status"),
            ("", "error"),
            ("task", "on_submit"),
        ]
        .iter()
        .filter_map(|(r, a)| route(r, a).ok())
        .map(|p| p.entity_type())
        .collect();
        assert_eq!(names, ["preauth", "payment", "status", "error", "task"]);
        assert!(route("v1", "preauth").is_err());
    }
}
