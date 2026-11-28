//! A stand-in for the ABDM gateway: it answers `/sessions`, records every
//! other call, and answers each one 202 unless a test asked for something
//! else (a canned reply, a one-off 401, or a hook run before replying). It
//! also signs gateway tokens the way the gateway does, so a server whose
//! `ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE` holds the public half takes them.
//!
//! Moved here from `medbrains-server/tests/abdm_hip_world` so the tests and
//! a local rehearsal between two installs share one fake. It is never part
//! of a release: no release build names this crate.

use std::{
    collections::{HashMap, HashSet},
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
};

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::post,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use openssl::{error::ErrorStack, hash::MessageDigest, pkey::PKey, sign::Signer};
use serde_json::{Value, json};

/// One call the gateway received.
#[derive(Clone, Debug)]
pub struct Call {
    pub path: String,
    pub headers: HeaderMap,
    pub body: Value,
}

pub type Calls = Arc<Mutex<Vec<Call>>>;
/// Run while the gateway call is still open — ABDM answering before our
/// call returns.
pub type Hook = Arc<dyn Fn(Call) -> Pin<Box<dyn Future<Output = ()> + Send>> + Send + Sync>;
pub type Hooks = Arc<Mutex<HashMap<String, Hook>>>;
/// Gateway paths that answer 401 once — a session the gateway revoked.
pub type RefuseOnce = Arc<Mutex<HashSet<String>>>;
/// Canned answers by path (status and JSON body), instead of a bare 202.
pub type Replies = Arc<Mutex<HashMap<String, (StatusCode, Value)>>>;

/// What the gateway remembers and how it answers; clones share it.
#[derive(Clone, Default)]
pub struct Recorder {
    pub calls: Calls,
    pub hooks: Hooks,
    pub refuse_once: RefuseOnce,
    pub replies: Replies,
}

impl std::fmt::Debug for Recorder {
    /// Hooks are closures, so only the number of calls is shown.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Recorder")
            .field("calls", &lock(&self.calls).len())
            .finish_non_exhaustive()
    }
}

/// A lock that a panicked test thread cannot poison for the others.
pub fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The sandbox realm the official M2 document's sample token names.
pub const SANDBOX_ISSUER: &str = "https://dev.ndhm.gov.in/auth/realms/central-registry";

/// What the gateway's own token carries (`clientId` "gateway").
pub fn gateway_claims() -> Value {
    json!({ "iss": SANDBOX_ISSUER, "clientId": "gateway", "azp": "gateway", "typ": "Bearer" })
}

/// A JWT over `claims` (plus a one-minute `exp`), signed RS256 or RS512 with
/// `key` (a PKCS#8 PEM).
pub fn jwt(alg: &str, mut claims: Value, key: &[u8]) -> Result<String, ErrorStack> {
    claims["exp"] = json!(chrono::Utc::now().timestamp() + 60);
    let part = |v: &Value| URL_SAFE_NO_PAD.encode(v.to_string());
    let input = format!(
        "{}.{}",
        part(&json!({ "alg": alg, "typ": "JWT" })),
        part(&claims)
    );
    let pkey = PKey::private_key_from_pem(key)?;
    let digest = if alg == "RS512" {
        MessageDigest::sha512()
    } else {
        MessageDigest::sha256()
    };
    let mut signer = Signer::new(digest, &pkey)?;
    signer.update(input.as_bytes())?;
    let signature = signer.sign_to_vec()?;
    Ok(format!("{input}.{}", URL_SAFE_NO_PAD.encode(signature)))
}

/// The gateway's callback token, signed with `key`.
pub fn gateway_jwt(key: &[u8]) -> Result<String, ErrorStack> {
    jwt("RS256", gateway_claims(), key)
}

/// Record a call, then answer it: a one-off 401, the hook, the canned reply
/// or 202.
async fn record(State(r): State<Recorder>, uri: Uri, headers: HeaderMap, body: Bytes) -> Response {
    let body = serde_json::from_slice(&body).unwrap_or(Value::Null);
    let call = Call {
        path: uri.path().to_owned(),
        headers,
        body,
    };
    lock(&r.calls).push(call.clone());
    if lock(&r.refuse_once).remove(&call.path) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let reply = lock(&r.replies).get(&call.path).cloned();
    let hook = lock(&r.hooks).get(&call.path).cloned();
    if let Some(hook) = hook {
        hook(call).await;
    }
    match reply {
        Some((status, body)) => (status, Json(body)).into_response(),
        None => StatusCode::ACCEPTED.into_response(),
    }
}

/// A session for any caller; the gateway swagger requires
/// `grantType: client_credentials`.
async fn sessions(State(r): State<Recorder>, Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    lock(&r.calls).push(Call {
        path: "/sessions".to_owned(),
        headers: HeaderMap::new(),
        body: body.clone(),
    });
    if body["grantType"] != "client_credentials" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "message": "grantType is required" })),
        );
    }
    (
        StatusCode::OK,
        Json(json!({ "accessToken": "session-token", "expiresIn": 1200 })),
    )
}

/// The gateway's routes: sessions, and every other path recorded.
pub fn router(recorder: Recorder) -> Router {
    Router::new()
        .route("/sessions", post(sessions))
        .fallback(record)
        .with_state(recorder)
}

/// Serve the gateway on `listener` in the background; returns its base URL.
pub fn spawn(listener: tokio::net::TcpListener, recorder: Recorder) -> std::io::Result<String> {
    let addr = listener.local_addr()?;
    let app = router(recorder);
    tokio::spawn(async move { axum::serve(listener, app).await });
    Ok(format!("http://{addr}"))
}
