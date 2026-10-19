//! Signing in to the NHCX gateway — ABDM v3 sessions: client id + secret in,
//! a time-limited bearer token out, cached per tenant and environment until
//! shortly before it expires.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock, PoisonError};
use std::time::{Duration, Instant};

use chrono::{SecondsFormat, Utc};
use medbrains_core::nhcx::NhcxEnvironment;
use serde::Deserialize;
use uuid::Uuid;

use super::config::Credentials;

/// Refresh this long before ABDM's stated expiry.
const SESSION_MARGIN: Duration = Duration::from_secs(30);
/// Bound on cached sessions — one per tenant and environment, so far above need.
const MAX_CACHED_SESSIONS: usize = 4096;

/// Where calls go: the real gateway for the environment, or the override.
#[derive(Debug, Clone)]
pub struct Endpoints {
    pub gateway: String,
    pub sessions: String,
}

impl Endpoints {
    #[must_use]
    pub fn new(environment: NhcxEnvironment, base_url_override: Option<&str>) -> Self {
        base_url_override.map_or_else(
            || Self {
                gateway: environment.gateway_host().to_owned(),
                sessions: environment.sessions_url().to_owned(),
            },
            |base| Self {
                gateway: base.to_owned(),
                sessions: format!("{base}/sessions"),
            },
        )
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    /// ABDM refused the credentials; its own words.
    #[error("the gateway refused the NHCX credentials: {0}")]
    Refused(String),
    /// ABDM could not be reached or failed.
    #[error("the NHCX gateway is not responding: {0}")]
    Unavailable(String),
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
    access_token: String,
    #[serde(default)]
    expires_in: u64,
}

type Cache = Mutex<HashMap<(Uuid, NhcxEnvironment), (String, Instant)>>;

fn cache() -> &'static Cache {
    static CACHE: OnceLock<Cache> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Drop the tenant's cached sessions — after its credentials change, or the
/// gateway rejected the token.
pub fn forget(tenant_id: Uuid) {
    let mut guard = cache().lock().unwrap_or_else(PoisonError::into_inner);
    guard.retain(|(tenant, _), _| *tenant != tenant_id);
}

/// A bearer token for the gateway.
///
/// # Errors
/// [`SessionError`] when ABDM refuses the credentials or cannot be reached.
pub async fn token(
    http: &reqwest::Client,
    tenant_id: Uuid,
    creds: &Credentials,
    endpoints: &Endpoints,
) -> Result<String, SessionError> {
    let key = (tenant_id, creds.environment);
    {
        let guard = cache().lock().unwrap_or_else(PoisonError::into_inner);
        let now = Instant::now();
        if let Some((token, _)) = guard.get(&key).filter(|(_, expires)| *expires > now) {
            return Ok(token.clone());
        }
    }
    let resp = http
        .post(&endpoints.sessions)
        .header("REQUEST-ID", Uuid::new_v4().to_string())
        .header(
            "TIMESTAMP",
            Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        )
        .header("X-CM-ID", creds.environment.cm_id())
        .json(&serde_json::json!({
            "clientId": creds.client_id,
            "clientSecret": creds.client_secret,
            "grantType": "client_credentials",
        }))
        .send()
        .await
        .map_err(|e| SessionError::Unavailable(e.to_string()))?;
    let status = resp.status();
    if !status.is_success() {
        let body: String = resp
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(300)
            .collect();
        return Err(if status.is_client_error() {
            SessionError::Refused(body)
        } else {
            SessionError::Unavailable(format!("{status}: {body}"))
        });
    }
    let session: SessionResponse = resp
        .json()
        .await
        .map_err(|e| SessionError::Unavailable(format!("unreadable sessions reply: {e}")))?;
    let ttl = Duration::from_secs(session.expires_in).saturating_sub(SESSION_MARGIN);
    let mut guard = cache().lock().unwrap_or_else(PoisonError::into_inner);
    if guard.len() >= MAX_CACHED_SESSIONS {
        let now = Instant::now();
        guard.retain(|_, (_, expires)| *expires > now);
    }
    if guard.len() < MAX_CACHED_SESSIONS {
        guard.insert(key, (session.access_token.clone(), Instant::now() + ttl));
    }
    Ok(session.access_token)
}
