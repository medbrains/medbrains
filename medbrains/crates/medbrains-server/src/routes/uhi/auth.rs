//! Authenticating inbound UHI calls, trusting callback addresses, and the
//! network endpoints we call.
//!
//! Two kinds of caller (NHA-ABDM/UHI reference HSPA, `HspaUtility.java`):
//! - a search fanned out by the **gateway** carries only the gateway's
//!   signature, in `X-Gateway-Authorization`, over a body the gateway
//!   re-serialised. It is checked against the gateway key configured for the
//!   environment (`UHI_GATEWAY_PUBLIC_KEY_{SANDBOX,PRODUCTION}`), else the
//!   registry's.
//! - every other call carries the **patient app's** signature in
//!   `Authorization`, checked against the app's registry record. The lookup
//!   names the app's `subscriber_url` (its `consumer_uri`), so the registry
//!   only answers when that is where the app is registered — and the answer
//!   is checked again here. Callbacks go nowhere else.
//!
//! Three outcomes, never two: a signature that does not verify, or a signer
//! the registry does not know, is 401; a registry we cannot ask — down,
//! refusing *our* signature, or answering something unreadable — is 503 and
//! an error-level log, never "you are not registered".

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::{
    Json,
    http::{HeaderMap, HeaderValue, StatusCode, header::WWW_AUTHENTICATE},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, FixedOffset, NaiveDateTime, Utc};
use medbrains_core::secrets::SecretResolver;
use medbrains_crypto::beckn::{SIGNED_HEADERS, SignatureHeader};
use serde_json::{Value, json};

use super::{
    protocol::{
        Context, ERR_AUTH_MISSING, ERR_BAD_REQUEST, ERR_INTERNAL, ERR_INVALID_SIGNATURE,
        ERR_NOT_REGISTERED, nack,
    },
    settings::Subscription,
};

/// A stand-in gateway (and its registry) for tests and rehearsals.
pub const UHI_GATEWAY_BASE_URL_OVERRIDE: &str = "UHI_GATEWAY_BASE_URL_OVERRIDE";
/// The gateway's public key, per environment (base64 SPKI, issued by NHA).
pub const GATEWAY_KEY_SANDBOX: &str = "UHI_GATEWAY_PUBLIC_KEY_SANDBOX";
pub const GATEWAY_KEY_PRODUCTION: &str = "UHI_GATEWAY_PUBLIC_KEY_PRODUCTION";
/// The UHI gateway — hosts verified from NHA's code.
const SANDBOX_GATEWAY: &str = "https://uhigatewaysandbox.abdm.gov.in";
const PRODUCTION_GATEWAY: &str = "https://uhigateway.abdm.gov.in";
/// Registry lookup — the same path in NHA-ABDM/UHI's Postman and v2.0.2.
const LOOKUP_PATH: &str = "/api/v1/networkregistry/lookup";
/// The only registry status whose keys are trusted (`GlobalConstants.java`).
const SUBSCRIBED: &str = "SUBSCRIBED";
/// Registry participant type of a patient app.
const EUA: &str = "EUA";
/// How long a registry record is trusted before it is looked up again.
const KEY_TTL: Duration = Duration::from_secs(3600);
/// How long any network call may take.
pub const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
/// How long our own signatures stay valid.
pub const SIGNATURE_TTL_SECONDS: i64 = 60;

/// A registry record, as far as we act on it.
#[derive(Debug, Clone)]
pub struct Participant {
    pub key: String,
    pub subscriber_url: Option<String>,
    valid: (Option<DateTime<Utc>>, Option<DateTime<Utc>>),
}

// ponytail: in-process cache, one server per hospital install (as abha.rs).
// Keyed by environment + the exact lookup body, so a sandbox record never
// answers for production and another callback URL is another question.
static RECORDS: LazyLock<Mutex<HashMap<String, (Participant, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub static HTTP: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .unwrap_or_default()
});

/// A UHI refusal: the HTTP status and the NACK body that explains it.
#[derive(Debug)]
pub struct Nack {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl Nack {
    pub fn unauthorized(code: &'static str, message: &str) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code,
            message: message.to_owned(),
        }
    }
    pub fn bad_request(message: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: ERR_BAD_REQUEST,
            message: message.to_owned(),
        }
    }
    pub fn unavailable(message: &str) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            code: ERR_INTERNAL,
            message: message.to_owned(),
        }
    }
    fn not_registered() -> Self {
        Self::unauthorized(ERR_NOT_REGISTERED, "the signer is not registered on UHI")
    }
}

impl IntoResponse for Nack {
    fn into_response(self) -> Response {
        let kind = if self.status.is_server_error() {
            "CORE-ERROR"
        } else {
            "CONTEXT-ERROR"
        };
        let mut response =
            (self.status, Json(nack(kind, self.code, &self.message))).into_response();
        if self.status == StatusCode::UNAUTHORIZED
            && let Ok(v) = HeaderValue::from_str(&format!("Signature headers=\"{SIGNED_HEADERS}\""))
        {
            response.headers_mut().insert(WWW_AUTHENTICATE, v);
        }
        response
    }
}

async fn secret(secrets: &dyn SecretResolver, key: &str) -> Option<String> {
    secrets.get(key).await.ok().filter(|v| !v.trim().is_empty())
}

/// The gateway host for `environment`, or the stand-in a test names.
pub async fn gateway_base(secrets: &dyn SecretResolver, environment: &str) -> String {
    secret(secrets, UHI_GATEWAY_BASE_URL_OVERRIDE)
        .await
        .unwrap_or_else(|| {
            if environment == "production" {
                PRODUCTION_GATEWAY
            } else {
                SANDBOX_GATEWAY
            }
            .to_owned()
        })
        .trim_end_matches('/')
        .to_owned()
}

/// Where a gateway search is answered, under this subscription's contract.
pub async fn gateway_on_search(secrets: &dyn SecretResolver, sub: &Subscription) -> String {
    format!(
        "{}{}",
        gateway_base(secrets, &sub.environment).await,
        sub.spec().on_search_path()
    )
}

fn parse_header(raw: &str) -> Result<SignatureHeader, Nack> {
    SignatureHeader::parse(raw)
        .map_err(|_| Nack::unauthorized(ERR_INVALID_SIGNATURE, "the signature header is malformed"))
}

fn check(header: &SignatureHeader, body: &[u8], key: &str) -> Result<(), Nack> {
    header
        .verify(body, key, Utc::now().timestamp())
        .map_err(|_| Nack::unauthorized(ERR_INVALID_SIGNATURE, "INVALID SIGNATURE"))
}

/// Check the gateway's signature, when the call carries one. `Ok(false)`
/// when it does not (a direct call).
///
/// # Errors
/// 401 when it does not verify; 503 when its key cannot be found out.
pub async fn verify_gateway(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    headers: &HeaderMap,
    ctx: &Context,
    body: &[u8],
) -> Result<bool, Nack> {
    let Some(raw) = sub
        .spec()
        .gateway_headers()
        .iter()
        .find_map(|h| headers.get(*h).and_then(|v| v.to_str().ok()))
    else {
        return Ok(false);
    };
    let header = parse_header(raw)?;
    let configured = if sub.environment == "production" {
        GATEWAY_KEY_PRODUCTION
    } else {
        GATEWAY_KEY_SANDBOX
    };
    let key = if let Some(key) = secret(secrets, configured).await {
        key
    } else {
        // ponytail: NHA's registry has no gateway type; asked by id + key id.
        let ask = json!({ "subscriber_id": header.subscriber_id,
            "pub_key_id": header.unique_key_id, "domain": ctx.domain,
            "city": ctx.city, "country": ctx.country });
        record(secrets, sub, &ask, &header.unique_key_id).await?.key
    };
    check(&header, body, &key)?;
    Ok(true)
}

/// Check the patient app's own signature, that it is the app the context
/// names, and that `consumer_uri` is where the registry has it. Returns the
/// app's registry key ID.
///
/// # Errors
/// 401 when unsigned, forged, unregistered or pointing elsewhere; 503 when
/// the registry cannot be asked.
pub async fn verify_app(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    headers: &HeaderMap,
    ctx: &Context,
    body: &[u8],
) -> Result<String, Nack> {
    let raw = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| Nack::unauthorized(ERR_AUTH_MISSING, "the request is not signed"))?;
    let header = parse_header(raw)?;
    if header.subscriber_id != ctx.consumer_id {
        return Err(Nack::unauthorized(
            ERR_INVALID_SIGNATURE,
            "the request is signed by someone other than its consumer",
        ));
    }
    let participant = app_record(secrets, sub, ctx, &header.unique_key_id).await?;
    check(&header, body, &participant.key)?;
    callback_allowed(&participant, &ctx.consumer_uri)?;
    Ok(header.unique_key_id)
}

/// The registry record of the app `ctx` names, at its `consumer_uri` — the
/// body NHA's reference HSPA sends (`HspaUtility.getSubscriberDetailsOfEua`).
///
/// # Errors
/// As [`verify_app`].
pub async fn app_record(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    ctx: &Context,
    key_id: &str,
) -> Result<Participant, Nack> {
    let ask = json!({ "subscriber_id": ctx.consumer_id, "pub_key_id": key_id, "type": EUA,
        "domain": ctx.domain, "city": ctx.city, "country": ctx.country,
        "subscriber_url": ctx.consumer_uri });
    record(secrets, sub, &ask, key_id).await
}

/// Whether `url` (a callback, or the `consumer_uri` it is built from) is
/// under the app's registered subscriber URL.
///
/// # Errors
/// 401 when it is not; the attempt is logged.
pub fn callback_allowed(participant: &Participant, url: &str) -> Result<(), Nack> {
    let registered = participant
        .subscriber_url
        .as_deref()
        .map(|u| u.trim_end_matches('/').to_ascii_lowercase())
        .filter(|u| !u.is_empty());
    let url = url.trim_end_matches('/').to_ascii_lowercase();
    if registered
        .as_deref()
        .is_some_and(|r| url == r || url.starts_with(&format!("{r}/")))
    {
        return Ok(());
    }
    tracing::warn!(
        url,
        ?registered,
        "uhi callback address is not the registered one"
    );
    Err(Nack::unauthorized(
        ERR_NOT_REGISTERED,
        "consumer_uri is not the subscriber URL registered on UHI",
    ))
}

async fn record(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    ask: &Value,
    key_id: &str,
) -> Result<Participant, Nack> {
    let cache_key = format!("{}|{ask}", sub.environment);
    let cached = RECORDS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(&cache_key)
        .filter(|(_, until)| *until > Instant::now())
        .map(|(p, _)| p.clone());
    let participant = if let Some(p) = cached {
        p
    } else {
        let p = lookup(secrets, sub, ask, key_id).await?;
        RECORDS
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(cache_key, (p.clone(), Instant::now() + KEY_TTL));
        p
    };
    let now = Utc::now();
    let (from, until) = participant.valid;
    if from.is_some_and(|f| now < f) || until.is_some_and(|u| now > u) {
        return Err(Nack::unauthorized(
            ERR_NOT_REGISTERED,
            "the signer's UHI key is outside its validity",
        ));
    }
    Ok(participant)
}

/// Our own fault reaching the registry: logged for the operator, 503.
fn registry_fault(why: &str) -> Nack {
    tracing::error!(
        alert = "uhi.registry",
        why,
        "UHI registry lookup failed on our side"
    );
    Nack::unavailable("the UHI registry could not be asked right now")
}

/// Ask the UHI registry, signed with our key.
async fn lookup(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    ask: &Value,
    key_id: &str,
) -> Result<Participant, Nack> {
    let body = serde_json::to_vec(ask).map_err(|_| registry_fault("lookup body"))?;
    let private = sub
        .private_key(secrets)
        .await
        .map_err(|_| registry_fault("this hospital's UHI key is not set up"))?;
    let url = format!(
        "{}{LOOKUP_PATH}",
        gateway_base(secrets, &sub.environment).await
    );
    let response = signed_post(sub, &private, url, body)
        .map_err(|_| registry_fault("this hospital's UHI key cannot sign"))?
        .send()
        .await
        .map_err(|_| registry_fault("the registry is not responding"))?;
    match response.status().as_u16() {
        200..=299 => {}
        // "No record found!" — the registry does not know the signer here.
        404 => return Err(Nack::not_registered()),
        // 401: our header is wrong; 403: our key is unregistered or
        // inactive; anything else is the registry's trouble. None of it is
        // the caller's.
        other => return Err(registry_fault(&format!("registry answered {other}"))),
    }
    let found: Value = response
        .json()
        .await
        .map_err(|_| registry_fault("the registry answered something unreadable"))?;
    let Some(p) = found
        .as_array()
        .into_iter()
        .flatten()
        .find(|p| p["pub_key_id"].as_str() == Some(key_id))
    else {
        return Err(Nack::not_registered());
    };
    if !p["status"]
        .as_str()
        .is_some_and(|s| s.eq_ignore_ascii_case(SUBSCRIBED))
    {
        return Err(Nack::unauthorized(
            ERR_NOT_REGISTERED,
            "the signer is not SUBSCRIBED on UHI",
        ));
    }
    // UHI's own services verify against `encr_public_key` (NHA code).
    let key = p["encr_public_key"]
        .as_str()
        .or_else(|| p["signing_public_key"].as_str())
        .map(str::to_owned)
        .ok_or_else(Nack::not_registered)?;
    Ok(Participant {
        key,
        subscriber_url: p["subscriber_url"].as_str().map(str::to_owned),
        valid: (instant(&p["valid_from"])?, instant(&p["valid_until"])?),
    })
}

/// A registry timestamp: RFC 3339, or NHA's zone-less `2026-06-18T00:00:00`
/// (read as India time). Absent is no bound; unreadable is our fault.
fn instant(v: &Value) -> Result<Option<DateTime<Utc>>, Nack> {
    let Some(text) = v.as_str().map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if let Ok(t) = DateTime::parse_from_rfc3339(text) {
        return Ok(Some(t.with_timezone(&Utc)));
    }
    let ist = FixedOffset::east_opt(5 * 3600 + 1800).ok_or_else(|| registry_fault("zone"))?;
    NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S%.f"))
        .ok()
        .and_then(|t| t.and_local_timezone(ist).single())
        .map(|t| Some(t.with_timezone(&Utc)))
        .ok_or_else(|| registry_fault("an unreadable valid_from/valid_until"))
}

/// A signed POST of `body` to `url`, with the `Digest` header when this
/// subscription's contract wants it.
///
/// # Errors
/// When the private key cannot sign.
pub fn signed_post(
    sub: &Subscription,
    private_key: &str,
    url: String,
    body: Vec<u8>,
) -> Result<reqwest::RequestBuilder, medbrains_crypto::CryptoError> {
    let mut request = HTTP
        .post(url)
        .header("content-type", "application/json")
        .header("authorization", sign_now(sub, private_key, &body)?);
    if sub.spec().sends_digest() {
        request = request.header(
            "digest",
            format!("BLAKE-512={}", medbrains_crypto::beckn::digest(&body)),
        );
    }
    Ok(request.body(body))
}

/// Our `Authorization` header for `body`, valid for a minute from now.
///
/// # Errors
/// When the private key cannot be used, or NHA has issued no subscriber ID.
pub fn sign_now(
    sub: &Subscription,
    private_key: &str,
    body: &[u8],
) -> Result<String, medbrains_crypto::CryptoError> {
    let (Some(subscriber), Some(key_id)) = (&sub.subscriber_id, &sub.unique_key_id) else {
        return Err(medbrains_crypto::CryptoError::InvalidKey);
    };
    let created = Utc::now().timestamp();
    medbrains_crypto::beckn::sign(
        subscriber,
        key_id,
        private_key,
        body,
        (created, created + SIGNATURE_TTL_SECONDS),
    )
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{Participant, callback_allowed, instant};
    use serde_json::json;

    fn at(url: &str) -> Participant {
        Participant {
            key: String::new(),
            subscriber_url: Some(url.to_owned()),
            valid: (None, None),
        }
    }

    #[test]
    fn a_callback_goes_only_under_the_registered_url() {
        let eua = at("https://eua.example/api/v1/");
        assert!(callback_allowed(&eua, "https://eua.example/api/v1").is_ok());
        assert!(callback_allowed(&eua, "https://EUA.example/api/v1/on_search").is_ok());
        assert!(callback_allowed(&eua, "https://eua.example/api/v10/on_search").is_err());
        assert!(callback_allowed(&eua, "https://evil.example/api/v1/on_search").is_err());
        assert!(callback_allowed(&at(""), "https://eua.example/api/v1").is_err());
    }

    #[test]
    fn registry_timestamps_read_with_or_without_a_zone() {
        assert!(instant(&json!("2026-06-18T00:00:00")).unwrap().is_some());
        assert!(instant(&json!("2026-06-18T00:00:00Z")).unwrap().is_some());
        assert!(instant(&json!(null)).unwrap().is_none());
        assert!(instant(&json!("next tuesday")).is_err());
    }
}
