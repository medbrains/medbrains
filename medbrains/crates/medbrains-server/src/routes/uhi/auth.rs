//! Authenticating inbound UHI calls, and the network endpoints we call.
//!
//! Every call carries the patient app's signature in `Authorization`; a
//! search fanned out by the gateway carries the gateway's as well, in
//! `X-Gateway-Authorization`. Each is checked against the signer's key in
//! the UHI registry (cached), or against the key a test or rehearsal names.
//!
//! Three outcomes, never two: a signature that does not verify is 401; a
//! registry that cannot be reached is 503 — an outage must not read as "you
//! are not who you say".

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
use medbrains_core::secrets::SecretResolver;
use medbrains_crypto::beckn::{SIGNED_HEADERS, SignatureHeader};
use serde_json::{Value, json};

use super::{
    protocol::{
        ERR_AUTH_MISSING, ERR_BAD_REQUEST, ERR_INTERNAL, ERR_INVALID_SIGNATURE, ERR_NOT_REGISTERED,
        nack,
    },
    settings::Subscription,
};

/// A stand-in gateway (and its registry) for tests and rehearsals.
pub const UHI_GATEWAY_BASE_URL_OVERRIDE: &str = "UHI_GATEWAY_BASE_URL_OVERRIDE";
/// A public key every inbound signature is checked against instead of the
/// registry's. Never set in production.
pub const UHI_REGISTRY_PUBLIC_KEY_OVERRIDE: &str = "UHI_REGISTRY_PUBLIC_KEY_OVERRIDE";
/// The UHI gateway — hosts verified from NHA's code.
const SANDBOX_GATEWAY: &str = "https://uhigatewaysandbox.abdm.gov.in/api/v1";
const PRODUCTION_GATEWAY: &str = "https://uhigateway.abdm.gov.in/api/v1";
/// Registry lookup under the gateway — verified for production in NHA's
/// Postman; **inferred** for the sandbox.
const LOOKUP_PATH: &str = "/networkregistry/lookup";
/// How long a registry key is trusted before it is looked up again.
const KEY_TTL: Duration = Duration::from_secs(3600);
/// How long any network call may take.
pub const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
/// How long our own signatures stay valid.
pub const SIGNATURE_TTL_SECONDS: i64 = 60;

// ponytail: in-process cache, one server per hospital install (as abha.rs).
static KEYS: LazyLock<Mutex<HashMap<String, (String, Instant)>>> =
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
}

impl IntoResponse for Nack {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(nack(self.code, &self.message))).into_response();
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

/// The gateway for `environment`, or the stand-in a test names.
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

/// Check the signature in `header_name` over `body`, and return who signed.
///
/// # Errors
/// 401 when it is missing or does not verify; 503 when the registry cannot
/// be asked.
pub async fn verify(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    headers: &HeaderMap,
    header_name: &str,
    body: &[u8],
) -> Result<String, Nack> {
    let raw = headers
        .get(header_name)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| Nack::unauthorized(ERR_AUTH_MISSING, "the request is not signed"))?;
    let header = SignatureHeader::parse(raw).map_err(|_| {
        Nack::unauthorized(ERR_INVALID_SIGNATURE, "the signature header is malformed")
    })?;
    let key = match secret(secrets, UHI_REGISTRY_PUBLIC_KEY_OVERRIDE).await {
        Some(key) => key,
        None => registry_key(secrets, sub, &header).await?,
    };
    header
        .verify(body, &key, chrono::Utc::now().timestamp())
        .map_err(|_| Nack::unauthorized(ERR_INVALID_SIGNATURE, "INVALID SIGNATURE"))?;
    Ok(header.subscriber_id)
}

async fn registry_key(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    header: &SignatureHeader,
) -> Result<String, Nack> {
    let cache_key = format!("{}|{}", header.subscriber_id, header.unique_key_id);
    let cached = KEYS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(&cache_key)
        .filter(|(_, until)| *until > Instant::now())
        .map(|(key, _)| key.clone());
    if let Some(key) = cached {
        return Ok(key);
    }
    let key = lookup(secrets, sub, header).await?;
    KEYS.lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(cache_key, (key.clone(), Instant::now() + KEY_TTL));
    Ok(key)
}

/// Ask the UHI registry for a participant's key. The lookup is signed with
/// ours. UHI's own services verify against `encr_public_key` (NHA code), so
/// that is preferred over `signing_public_key`.
async fn lookup(
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    header: &SignatureHeader,
) -> Result<String, Nack> {
    let body = serde_json::to_vec(&json!({
        "subscriber_id": header.subscriber_id,
        "pub_key_id": header.unique_key_id,
        "country": "IND",
    }))
    .map_err(|_| Nack::unavailable("could not build the registry lookup"))?;
    let private = sub
        .private_key(secrets)
        .await
        .map_err(|_| Nack::unavailable("this hospital's UHI key is not set up"))?;
    let signature = sign_now(sub, &private, &body)
        .map_err(|_| Nack::unavailable("this hospital's UHI key cannot sign"))?;
    let url = format!(
        "{}{LOOKUP_PATH}",
        gateway_base(secrets, &sub.environment).await
    );
    let response = HTTP
        .post(url)
        .header("content-type", "application/json")
        .header("authorization", signature)
        .body(body)
        .send()
        .await
        .map_err(|_| Nack::unavailable("the UHI registry is not responding"))?;
    if response.status().is_server_error() {
        return Err(Nack::unavailable("the UHI registry is not responding"));
    }
    if !response.status().is_success() {
        return Err(Nack::unauthorized(
            ERR_NOT_REGISTERED,
            "the signer is not registered on UHI",
        ));
    }
    let found: Value = response
        .json()
        .await
        .map_err(|_| Nack::unavailable("the UHI registry answered something unreadable"))?;
    found
        .as_array()
        .into_iter()
        .flatten()
        .filter(|p| p["pub_key_id"].as_str() == Some(header.unique_key_id.as_str()))
        .find_map(|p| {
            p["encr_public_key"]
                .as_str()
                .or_else(|| p["signing_public_key"].as_str())
                .map(str::to_owned)
        })
        .ok_or_else(|| {
            Nack::unauthorized(ERR_NOT_REGISTERED, "the signer is not registered on UHI")
        })
}

/// Our `Authorization` header for `body`, valid for a minute from now.
///
/// # Errors
/// When the private key cannot be used.
pub fn sign_now(
    sub: &Subscription,
    private_key: &str,
    body: &[u8],
) -> Result<String, medbrains_crypto::CryptoError> {
    let created = chrono::Utc::now().timestamp();
    medbrains_crypto::beckn::sign(
        &sub.subscriber_id,
        &sub.unique_key_id,
        private_key,
        body,
        (created, created + SIGNATURE_TTL_SECONDS),
    )
}
