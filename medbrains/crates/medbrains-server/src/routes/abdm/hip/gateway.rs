//! The gateway client for one hospital, and callback authentication.
//!
//! Every gateway callback must carry the gateway's own JWT: signature (RS256
//! or RS512) against the keys at the gateway's `/certs`, expiry, issuer and
//! the gateway's identity. The hospital is the one whose campus holds the HFR
//! ID in `X-HIP-ID` (or `X-HIU-ID`, on the M3 callbacks: the campus is both)
//! — never a query string, never a session.
//!
//! The v3 `/certs` needs a session (nha-in/docs integration learnings 1.5),
//! so on a cold key cache the HFR ID is looked up to borrow its hospital's
//! session. Nothing about that lookup is revealed until the token verifies:
//! a caller whose token does not verify gets the same 401 for an HFR ID we
//! host and one we do not.
//!
//! Why the identity check: the keys belong to the shared `central-registry`
//! realm that signs EVERY ABDM client's session token (the sample token in
//! the official M2 document, sandboxcms.abdm.gov.in/uploads/M2_Document_16_02_2026_…docx,
//! has `iss` `https://dev.ndhm.gov.in/auth/realms/central-registry` and the
//! integrator's own `clientId`). A signature check alone would let any
//! integrator call our callbacks with its own token. Link tokens and PHR user
//! tokens (signed RS512, no `iss`) are refused by the same checks.

use std::{
    collections::HashMap,
    future::Future,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::http::{HeaderMap, header::AUTHORIZATION};
use medbrains_abdm::{
    AbdmEnvironment, AbdmError,
    gateway::{ABDM_GATEWAY_BASE_URL_OVERRIDE, AbdmGatewayClient},
};
use medbrains_core::secrets::SecretResolver;
use serde_json::{Map, Value};
use uuid::Uuid;

use super::super::abha::{Session, dev_override, map_abdm_error, session};
use crate::{error::AppError, state::AppState};

/// Secret-store key holding a PEM the callback JWT is checked against
/// instead of the gateway's `/certs` — a stand-in gateway in tests and
/// rehearsals. Honoured only in development and tests.
pub const ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE: &str = "ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE";
/// Comma-separated `iss` values a sandbox gateway token may carry. Default:
/// the realm a real sandbox callback carried (`dev.abdm.gov.in`, measured by
/// OHC care-abdm, MIT, docs/findings.md E2) and the one in the official M2
/// document's sample token (`dev.ndhm.gov.in`).
pub const ABDM_GATEWAY_ISSUER_SANDBOX: &str = "ABDM_GATEWAY_ISSUER_SANDBOX";
/// The `iss` a production gateway token carries. No official source names
/// it, so there is no default: production callbacks are refused until it is
/// set (a refusal is logged with the issuer seen).
pub const ABDM_GATEWAY_ISSUER_PRODUCTION: &str = "ABDM_GATEWAY_ISSUER_PRODUCTION";
/// Comma-separated `clientId`/`azp` values or realm roles that mark a token
/// as the gateway's own. Default `gateway` — what a real sandbox callback
/// carried in `azp` and `clientId` (care-abdm E2); no integrator's token can
/// carry it. A refused token's client and roles are logged.
pub const ABDM_GATEWAY_CALLER_IDS: &str = "ABDM_GATEWAY_CALLER_IDS";
const SANDBOX_ISSUERS: &str = "https://dev.abdm.gov.in/auth/realms/central-registry,\
https://dev.ndhm.gov.in/auth/realms/central-registry";
/// How long after its `exp` a gateway token is still taken: the gateway
/// repeats a refused delivery ~16 minutes later with the same session token,
/// expired by then by up to a few minutes (care-abdm E10). Ten minutes takes
/// those repeats; the issuer and identity checks still apply.
const EXPIRY_LEEWAY: Duration = Duration::from_secs(600);
const GATEWAY_CALLER: &str = "gateway";

/// How long the gateway's published keys are trusted before refetching.
const CERTS_TTL: Duration = Duration::from_secs(3600);
/// A token no cached key verifies triggers a refetch (key rotation) at most
/// this often, so forged tokens cannot make us hammer the gateway.
const CERTS_REFETCH_GAP: Duration = Duration::from_secs(60);

// ponytail: in-process cache, as for the session in `abha.rs`.
static CERTS: LazyLock<Mutex<HashMap<String, (Value, Instant)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// The gateway client for `environment`, at a stand-in host in tests.
///
/// # Errors
/// 503 when the HTTP client cannot be built.
pub(crate) async fn gateway_client(
    secrets: &dyn SecretResolver,
    environment: AbdmEnvironment,
) -> Result<AbdmGatewayClient, AppError> {
    let base = dev_override(secrets, ABDM_GATEWAY_BASE_URL_OVERRIDE).await;
    AbdmGatewayClient::new(environment, base.as_deref()).map_err(map_abdm_error)
}

/// A signed-in gateway client acting as one HIP (one HFR facility).
pub struct Hip {
    pub tenant_id: Uuid,
    pub gateway: AbdmGatewayClient,
    pub(crate) auth: Session,
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
        let auth = session(db, secrets, tenant_id).await?;
        let gateway = gateway_client(secrets, auth.environment).await?;
        Ok(Self {
            tenant_id,
            gateway,
            auth,
            hip_id: hip_id.to_owned(),
        })
    }

    /// Run `call` with the session; when the gateway answers 401 (it revoked
    /// the session before our cache expired), sign in again once and retry.
    async fn with_session<T, F, Fut>(&self, call: F) -> Result<T, AppError>
    where
        F: Fn(String) -> Fut,
        Fut: Future<Output = Result<T, AbdmError>>,
    {
        match call(self.auth.token.clone()).await {
            Err(AbdmError::Status { status, .. })
                if status == reqwest::StatusCode::UNAUTHORIZED =>
            {
                tracing::info!("abdm gateway refused the session; signing in again");
                let fresh = self.auth.renew().await?;
                call(fresh).await.map_err(map_abdm_error)
            }
            other => other.map_err(map_abdm_error),
        }
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
        self.with_session(|s| async move {
            self.gateway
                .send(path, &s, &self.hip_id, link_token, body)
                .await
        })
        .await
    }

    /// As [`Hip::send`], with a `REQUEST-ID` recorded before sending: the
    /// gateway's answer can arrive before this call returns.
    ///
    /// # Errors
    /// As [`Hip::send`].
    #[tracing::instrument(skip_all, fields(tenant_id = %self.tenant_id))]
    pub async fn send_with_id(
        &self,
        path: &str,
        request_id: Uuid,
        body: &Value,
    ) -> Result<(), AppError> {
        self.with_session(|s| async move {
            self.gateway
                .send_with_id(path, &s, (self.hip_id.as_str(), request_id), body)
                .await
        })
        .await
    }

    /// One gateway call as a Health Information User, the same HFR facility
    /// ID sent as `X-HIU-ID`. Returns the `REQUEST-ID` it was sent with.
    ///
    /// # Errors
    /// As [`Hip::send`].
    #[tracing::instrument(skip_all, fields(tenant_id = %self.tenant_id))]
    pub async fn send_as_hiu(&self, path: &str, body: &Value) -> Result<Uuid, AppError> {
        self.with_session(|s| async move {
            self.gateway
                .send_as_hiu(path, &s, &self.hip_id, body)
                .await
        })
        .await
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
        self.with_session(|s| async move {
            self.gateway
                .send_as_hiu_with_id(path, &s, (self.hip_id.as_str(), request_id), body)
                .await
        })
        .await
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
/// 401 without a gateway JWT that verifies and names the gateway — whatever
/// the `X-HIP-ID`, known or not; 404 for an `X-HIP-ID` (or `X-HIU-ID`) no
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
    // Not revealed until the token verifies: same 401 for ours and not ours.
    let session_from = match owners.as_slice() {
        [(tenant, _)] => Some((&state.db, *tenant)),
        _ => None,
    };
    verify_gateway_token(state.secret_resolver.as_ref(), token, session_from).await?;
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
    Ok(Caller {
        tenant_id,
        facility_id,
        hip_id,
        request_id: header(headers, "request-id").unwrap_or_default(),
    })
}

fn list(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(|c| c.trim().to_owned())
        .filter(|c| !c.is_empty())
        .collect()
}

/// Which tokens count as the gateway's own.
struct Trust {
    sandbox_issuers: Vec<String>,
    production_issuer: Option<String>,
    callers: Vec<String>,
}

impl Trust {
    async fn load(secrets: &dyn SecretResolver) -> Self {
        let get = |key: &'static str| async move {
            secrets
                .get(key)
                .await
                .ok()
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
        };
        Self {
            sandbox_issuers: list(
                &get(ABDM_GATEWAY_ISSUER_SANDBOX)
                    .await
                    .unwrap_or_else(|| SANDBOX_ISSUERS.to_owned()),
            ),
            production_issuer: get(ABDM_GATEWAY_ISSUER_PRODUCTION).await,
            callers: list(
                &get(ABDM_GATEWAY_CALLER_IDS)
                    .await
                    .unwrap_or_else(|| GATEWAY_CALLER.to_owned()),
            ),
        }
    }

    fn environment_of(&self, issuer: &str) -> Option<AbdmEnvironment> {
        if self.sandbox_issuers.iter().any(|i| i == issuer) {
            Some(AbdmEnvironment::Sandbox)
        } else if self.production_issuer.as_deref() == Some(issuer) {
            Some(AbdmEnvironment::Production)
        } else {
            None
        }
    }

    /// The token's client (`clientId`, `azp`) or one of its realm roles is a
    /// configured gateway identity.
    fn names_the_gateway(&self, claims: &Map<String, Value>) -> bool {
        let ids = ["clientId", "azp"]
            .into_iter()
            .filter_map(|k| claims.get(k).and_then(Value::as_str));
        let roles = claims
            .get("realm_access")
            .and_then(|r| r.get("roles"))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str);
        ids.chain(roles).any(|v| self.callers.iter().any(|c| c == v))
    }
}

/// Verify `token` as the gateway's own. Returns the environment it is from.
///
/// # Errors
/// 401 for any token that is not; 503 when the gateway's keys are unavailable.
async fn verify_gateway_token(
    secrets: &dyn SecretResolver,
    token: &str,
    session_from: Option<(&sqlx::PgPool, Uuid)>,
) -> Result<AbdmEnvironment, AppError> {
    let trust = Trust::load(secrets).await;
    // Unverified, only to pick whose keys to verify with; checked again below.
    let peeked = medbrains_crypto::jws::peek_claims(token).map_err(|_| refused("not a JWT"))?;
    let issuer = peeked.get("iss").and_then(Value::as_str).unwrap_or_default();
    let environment = trust.environment_of(issuer).ok_or_else(|| {
        tracing::warn!(issuer, "abdm callback refused: issuer is not a configured ABDM gateway");
        refused("issuer")
    })?;
    let claims = verify_signature(secrets, (environment, session_from), token).await?;
    if claims.get("iss").and_then(Value::as_str) != Some(issuer) {
        return Err(refused("issuer"));
    }
    if claims.get("typ").and_then(Value::as_str).is_some_and(|t| t != "Bearer") {
        return Err(refused("not an access token"));
    }
    if !trust.names_the_gateway(&claims) {
        let client = claims
            .get("clientId")
            .or_else(|| claims.get("azp"))
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let roles = claims
            .get("realm_access")
            .map(|r| r["roles"].to_string())
            .unwrap_or_default();
        tracing::warn!(
            client,
            roles,
            "abdm callback refused: a valid ABDM token, but not the gateway's \
             (set ABDM_GATEWAY_CALLER_IDS if this is the gateway)"
        );
        return Err(refused("not the gateway"));
    }
    Ok(environment)
}

/// Verify against the gateway's keys: cached, else fetched with the session
/// of the hospital the callback names. With neither, the token cannot be
/// verified and is refused like any other.
async fn verify_signature(
    secrets: &dyn SecretResolver,
    (environment, session_from): (AbdmEnvironment, Option<(&sqlx::PgPool, Uuid)>),
    token: &str,
) -> Result<Map<String, Value>, AppError> {
    if let Some(pem) = dev_override(secrets, ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE).await {
        return medbrains_crypto::jws::verify_rsa(token, pem.as_bytes(), EXPIRY_LEEWAY)
            .map_err(|_| refused("signature"));
    }
    let gateway = gateway_client(secrets, environment).await?;
    let key = gateway.base_url().to_owned();
    let cached = CERTS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(&key)
        .cloned();
    if let Some((jwks, fetched)) = &cached {
        if fetched.elapsed() < CERTS_TTL
            && let Ok(claims) = medbrains_crypto::jws::verify_rsa_jwks(token, jwks, EXPIRY_LEEWAY)
        {
            return Ok(claims);
        }
        if fetched.elapsed() < CERTS_REFETCH_GAP {
            return Err(refused("signature"));
        }
    }
    let Some((db, tenant_id)) = session_from else {
        return Err(refused("no gateway keys cached and no hospital to fetch them as"));
    };
    let auth = session(db, secrets, tenant_id).await?;
    let jwks = gateway
        .certs(&auth.token)
        .await
        .map_err(|_| keys_unavailable())?;
    let verified = medbrains_crypto::jws::verify_rsa_jwks(token, &jwks, EXPIRY_LEEWAY);
    CERTS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(key, (jwks, Instant::now()));
    match verified {
        Ok(claims) => Ok(claims),
        Err(medbrains_crypto::CryptoError::InvalidKey) => Err(keys_unavailable()),
        Err(_) => Err(refused("signature")),
    }
}

fn keys_unavailable() -> AppError {
    AppError::ServiceUnavailable("the ABDM gateway's keys could not be fetched".to_owned())
}

fn refused(why: &'static str) -> AppError {
    tracing::warn!(why, "abdm callback refused");
    AppError::Unauthorized
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::Trust;

    fn trust() -> Trust {
        Trust {
            sandbox_issuers: super::list(super::SANDBOX_ISSUERS),
            production_issuer: None,
            callers: vec!["gateway".to_owned()],
        }
    }

    /// The official sample session token (M2 document) is an integrator's:
    /// same realm, its own client and roles. It must never pass as the gateway.
    #[test]
    fn an_integrators_session_token_is_not_the_gateway() {
        let integrator = json!({ "iss": "https://dev.abdm.gov.in/auth/realms/central-registry", "azp": "SBX_000135",
            "clientId": "SBX_000135", "typ": "Bearer",
            "realm_access": { "roles": ["hiu", "hip", "hfr", "phr", "offline_access"] } });
        let claims = integrator.as_object().cloned().unwrap_or_default();
        assert!(!trust().names_the_gateway(&claims));
        let gateway = json!({ "clientId": "gateway" });
        assert!(trust().names_the_gateway(&gateway.as_object().cloned().unwrap_or_default()));
        let by_role = json!({ "azp": "x", "realm_access": { "roles": ["gateway"] } });
        assert!(trust().names_the_gateway(&by_role.as_object().cloned().unwrap_or_default()));
    }

    /// No production issuer is configured by default: production tokens are
    /// refused rather than trusted on a guess.
    #[test]
    fn only_configured_issuers_map_to_an_environment() {
        let t = trust();
        assert_eq!(
            t.environment_of("https://dev.abdm.gov.in/auth/realms/central-registry"),
            Some(medbrains_abdm::AbdmEnvironment::Sandbox)
        );
        assert_eq!(
            t.environment_of("https://dev.ndhm.gov.in/auth/realms/central-registry"),
            Some(medbrains_abdm::AbdmEnvironment::Sandbox)
        );
        assert_eq!(t.environment_of("https://evil.example/realms/central-registry"), None);
        assert_eq!(t.environment_of(""), None);
    }
}
