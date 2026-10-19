//! The gateway client for one hospital, and callback authentication.
//!
//! Every gateway callback must carry the gateway's RS256 JWT, checked against
//! the keys at the gateway's `/certs` (cached, refetched once when a key does
//! not verify, for rotation). The hospital is the one whose campus holds the
//! HFR facility ID in `X-HIP-ID` (or `X-HIU-ID`, on the M3 callbacks: the
//! campus is both) — never a query string, never a session.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::http::{HeaderMap, header::AUTHORIZATION};
use medbrains_abdm::gateway::{ABDM_GATEWAY_BASE_URL_OVERRIDE, AbdmGatewayClient};
use medbrains_core::secrets::SecretResolver;
use serde_json::Value;
use uuid::Uuid;

use super::super::abha::{map_abdm_error, session};
use crate::{error::AppError, state::AppState};

/// Secret-store key holding a PEM the callback JWT is checked against
/// instead of the gateway's `/certs` — a stand-in gateway in tests and
/// rehearsals. Never set in production.
pub const ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE: &str = "ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE";
/// How long the gateway's published keys are trusted before refetching.
const CERTS_TTL: Duration = Duration::from_secs(3600);

// ponytail: in-process cache, as for the session in `abha.rs`.
static CERTS: LazyLock<Mutex<HashMap<String, (Value, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// A signed-in gateway client acting as one HIP (one HFR facility).
pub struct Hip {
    pub tenant_id: Uuid,
    pub gateway: AbdmGatewayClient,
    pub session: String,
    pub hip_id: String,
}

// Hand-written so the session token never reaches a log line.
impl std::fmt::Debug for Hip {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Hip")
            .field("hip_id", &self.hip_id)
            .finish_non_exhaustive()
    }
}

impl Hip {
    /// Sign in to the gateway for `tenant_id`, acting as `hip_id`.
    ///
    /// # Errors
    /// 503 when ABDM is not set up or not reachable.
    #[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
    pub async fn connect(
        db: &sqlx::PgPool,
        secrets: &dyn SecretResolver,
        tenant_id: Uuid,
        hip_id: &str,
    ) -> Result<Self, AppError> {
        let s = session(db, secrets, tenant_id).await?;
        let base = secrets
            .get(ABDM_GATEWAY_BASE_URL_OVERRIDE)
            .await
            .ok()
            .filter(|v| !v.trim().is_empty());
        let gateway =
            AbdmGatewayClient::new(s.environment, base.as_deref()).map_err(map_abdm_error)?;
        Ok(Self {
            tenant_id,
            gateway,
            session: s.token,
            hip_id: hip_id.to_owned(),
        })
    }

    /// One gateway call. Returns the `REQUEST-ID` it was sent with.
    ///
    /// # Errors
    /// 400 with ABDM's words when it refuses; 503 when it is unreachable.
    #[tracing::instrument(skip_all, fields(tenant_id = %self.tenant_id))]
    pub async fn send(
        &self,
        path: &str,
        link_token: Option<&str>,
        body: &Value,
    ) -> Result<Uuid, AppError> {
        self.gateway
            .send(path, &self.session, &self.hip_id, link_token, body)
            .await
            .map_err(map_abdm_error)
    }

    /// One gateway call as a Health Information User, the same HFR facility
    /// ID sent as `X-HIU-ID`. Returns the `REQUEST-ID` it was sent with.
    ///
    /// # Errors
    /// As [`Hip::send`].
    #[tracing::instrument(skip_all, fields(tenant_id = %self.tenant_id))]
    pub async fn send_as_hiu(&self, path: &str, body: &Value) -> Result<Uuid, AppError> {
        self.gateway
            .send_as_hiu(path, &self.session, &self.hip_id, body)
            .await
            .map_err(map_abdm_error)
    }

    /// As [`Hip::send_as_hiu`], with a `REQUEST-ID` recorded before sending:
    /// the gateway's answer can arrive before this call returns, and must
    /// find the row it answers.
    ///
    /// # Errors
    /// As [`Hip::send`].
    #[tracing::instrument(skip_all, fields(tenant_id = %self.tenant_id))]
    pub async fn send_as_hiu_with_id(
        &self,
        path: &str,
        request_id: Uuid,
        body: &Value,
    ) -> Result<(), AppError> {
        self.gateway
            .send_as_hiu_with_id(
                path,
                &self.session,
                (self.hip_id.as_str(), request_id),
                body,
            )
            .await
            .map_err(map_abdm_error)
    }
}

/// Who a verified callback is for.
#[derive(Debug, Clone)]
pub struct Caller {
    pub tenant_id: Uuid,
    pub facility_id: Uuid,
    pub hip_id: String,
    /// The callback's `REQUEST-ID`, echoed back as `response.requestId`.
    pub request_id: String,
}

fn header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// Authenticate a gateway callback.
///
/// # Errors
/// 401 without a gateway JWT that verifies; 404 for an `X-HIP-ID` (or
/// `X-HIU-ID`) no
/// hospital holds; 409 for one two hospitals both claim; 503 when the
/// gateway's keys cannot be fetched (an outage, not a refusal).
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn authenticate(state: &AppState, headers: &HeaderMap) -> Result<Caller, AppError> {
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;
    let hip_id = header(headers, "x-hip-id")
        .or_else(|| header(headers, "x-hiu-id"))
        .ok_or(AppError::Unauthorized)?;
    let owners = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT tenant_id, facility_id FROM app_abdm_hip_tenant($1) LIMIT 2",
    )
    .bind(&hip_id)
    .fetch_all(&state.db)
    .await?;
    let (tenant_id, facility_id) = match owners.as_slice() {
        [one] => *one,
        [] => return Err(AppError::NotFound),
        _ => {
            return Err(AppError::Conflict(
                "this HFR facility ID is recorded by more than one hospital".to_owned(),
            ));
        }
    };
    tracing::Span::current().record("tenant_id", tracing::field::display(tenant_id));
    verify_jwt(state, tenant_id, token).await?;
    Ok(Caller {
        tenant_id,
        facility_id,
        hip_id,
        request_id: header(headers, "request-id").unwrap_or_default(),
    })
}

async fn verify_jwt(state: &AppState, tenant_id: Uuid, token: &str) -> Result<(), AppError> {
    let secrets = state.secret_resolver.as_ref();
    if let Some(pem) = secrets
        .get(ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE)
        .await
        .ok()
        .filter(|v| !v.trim().is_empty())
    {
        return medbrains_crypto::jws::verify_rs256(token, pem.as_bytes())
            .map(|_| ())
            .map_err(|_| refused());
    }
    let hip = Hip::connect(&state.db, secrets, tenant_id, "").await?;
    let key = hip.gateway.base_url().to_owned();
    let cached = {
        let guard = CERTS.lock().unwrap_or_else(PoisonError::into_inner);
        guard
            .get(&key)
            .filter(|(_, until)| *until > Instant::now())
            .map(|(jwks, _)| jwks.clone())
    };
    if let Some(jwks) = cached
        && medbrains_crypto::jws::verify_rs256_jwks(token, &jwks).is_ok()
    {
        return Ok(());
    }
    let jwks = hip.gateway.certs(&hip.session).await.map_err(|_| {
        AppError::ServiceUnavailable("the ABDM gateway's keys could not be fetched".to_owned())
    })?;
    let verified = medbrains_crypto::jws::verify_rs256_jwks(token, &jwks).is_ok();
    CERTS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(key, (jwks, Instant::now() + CERTS_TTL));
    if verified { Ok(()) } else { Err(refused()) }
}

fn refused() -> AppError {
    tracing::warn!("abdm callback refused: the gateway JWT did not verify");
    AppError::Unauthorized
}
