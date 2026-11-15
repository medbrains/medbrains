//! HPR sign-in for HFR onboarding: the facility manager's token for
//! `x-hprid-auth`, and a verifying professional's for `x-hprid-auth-verifier`.
//!
//! The password goes straight to HPR, encrypted under HPR's certificate, and
//! is never stored or logged. The token HPR returns stays on the server,
//! keyed by hospital, `MedBrains` user and role, for at most
//! [`HPR_SESSION_TTL`]; the browser only ever learns who is signed in and
//! until when.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
    time::{Duration, Instant},
};

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_abdm::hfr_onboarding;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::registry_access::{Registry, registry_access, registry_fault};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// How long a signed-in HPR token is used for: one sitting at the form.
pub(crate) const HPR_SESSION_TTL: Duration = Duration::from_mins(15);
/// Bound on held tokens; expired ones are dropped first.
const MAX_SESSIONS: usize = 1000;

/// Which HPR header a token is for.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum HprRole {
    Manager,
    Verifier,
}

/// A held HPR token.
struct Held {
    token: String,
    hpr_id: String,
    until: Instant,
    expires_at: DateTime<Utc>,
}

type Key = (Uuid, Uuid, HprRole);
// ponytail: in-process, one server per hospital install, like the ABDM
// session cache in `abha.rs`; a restart signs everyone out of HPR (safe).
static SESSIONS: LazyLock<Mutex<HashMap<Key, Held>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Who is signed in to HPR for one role — never the token.
#[derive(Clone, Debug, Serialize)]
pub struct HprSessionView {
    pub role: HprRole,
    pub hpr_id: String,
    pub expires_at: DateTime<Utc>,
}

/// The sign-in form. `Debug` is hand-written so the password can never
/// reach a log line.
#[derive(Deserialize)]
pub struct HprSignInRequest {
    pub role: HprRole,
    pub hpr_id: String,
    pub password: String,
}

impl std::fmt::Debug for HprSignInRequest {
    /// Role and HPR ID only; the password is never printed.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HprSignInRequest")
            .field("role", &self.role)
            .field("hpr_id", &self.hpr_id)
            .finish_non_exhaustive()
    }
}

/// The live token for `role`, if signed in and not expired.
pub(crate) fn hpr_token(claims: &Claims, role: HprRole) -> Option<String> {
    let guard = SESSIONS.lock().unwrap_or_else(PoisonError::into_inner);
    guard
        .get(&(claims.tenant_id, claims.sub, role))
        .filter(|h| h.until > Instant::now())
        .map(|h| h.token.clone())
}

/// Who is signed in, per role, for the onboarding screen.
pub(crate) fn hpr_sessions(claims: &Claims) -> Vec<HprSessionView> {
    let guard = SESSIONS.lock().unwrap_or_else(PoisonError::into_inner);
    [HprRole::Manager, HprRole::Verifier]
        .into_iter()
        .filter_map(|role| {
            guard
                .get(&(claims.tenant_id, claims.sub, role))
                .filter(|h| h.until > Instant::now())
                .map(|h| HprSessionView {
                    role,
                    hpr_id: h.hpr_id.clone(),
                    expires_at: h.expires_at,
                })
        })
        .collect()
}

/// Hold `token` for the caller and `role`, dropping expired tokens and
/// refusing to grow past [`MAX_SESSIONS`].
fn hold(key: Key, token: String, hpr_id: String) -> Result<HprSessionView, AppError> {
    let mut guard = SESSIONS.lock().unwrap_or_else(PoisonError::into_inner);
    let now = Instant::now();
    guard.retain(|_, h| h.until > now);
    if guard.len() >= MAX_SESSIONS && !guard.contains_key(&key) {
        return Err(AppError::TooManyRequests(
            "too many HPR sign-ins are open; try again in a few minutes".to_owned(),
        ));
    }
    let expires_at = Utc::now() + HPR_SESSION_TTL;
    let view = HprSessionView {
        role: key.2,
        hpr_id: hpr_id.clone(),
        expires_at,
    };
    guard.insert(
        key,
        Held {
            token,
            hpr_id,
            until: now + HPR_SESSION_TTL,
            expires_at,
        },
    );
    drop(guard);
    Ok(view)
}

/// `POST /api/abdm/hfr/hpr-session` — sign a professional in to HPR for the
/// manager or verifier header.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn sign_in(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<HprSignInRequest>,
) -> Result<Json<HprSessionView>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    let hpr_id = body.hpr_id.trim().to_owned();
    if hpr_id.is_empty() || body.password.is_empty() {
        return Err(AppError::BadRequest("enter the HPR ID and password".into()));
    }
    let Some(access) = registry_access(&state, &claims.tenant_id, Registry::Hpr).await? else {
        return Err(AppError::ServiceUnavailable(
            "ABDM keys are not configured — HPR sign-in is not possible yet".to_owned(),
        ));
    };
    let key = hfr_onboarding::hpr_certificate(&access.http, &access.base_url, &access.token)
        .await
        .map_err(|e| registry_fault(&e))?;
    let encrypted = medbrains_crypto::abha::encrypt_field(&key, &body.password).map_err(|_| {
        AppError::ServiceUnavailable("HPR's encryption key could not be used".to_owned())
    })?;
    let token = hfr_onboarding::hpr_login(
        &access.http,
        &access.base_url,
        &access.token,
        &hpr_id,
        &encrypted,
    )
    .await
    .map_err(|e| match e {
        medbrains_abdm::AbdmError::Status { status, message } if status.is_client_error() => {
            AppError::BadRequest(format!("HPR refused the sign-in: {message}"))
        }
        other => registry_fault(&other),
    })?
    .ok_or_else(|| AppError::ServiceUnavailable("HPR answered without a token".to_owned()))?;
    Ok(Json(hold(
        (claims.tenant_id, claims.sub, body.role),
        token,
        hpr_id,
    )?))
}
