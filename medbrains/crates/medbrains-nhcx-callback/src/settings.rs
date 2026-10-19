//! Settings → NHCX: the hospital's NHCX participant code, environment,
//! gateway credentials and keys.
//!
//! The client secret and private key are sealed before they are stored and
//! no endpoint returns them; the view says only whether one is saved.

use std::time::Duration;

use axum::{Extension, Json, extract::State};
use medbrains_core::nhcx::NhcxEnvironment;
use medbrains_core::permissions;
use medbrains_outbox::handlers::nhcx::config::{
    self, CLIENT_SECRET_CONTEXT, PRIVATE_KEY_CONTEXT, StoredSettings,
};
use medbrains_outbox::handlers::nhcx::session::{self, Endpoints};
use serde::{Deserialize, Serialize};
use serde_json::{Map, json};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const TEST_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Serialize)]
pub struct NhcxSettingsView {
    pub environment: NhcxEnvironment,
    pub participant_code: Option<String>,
    pub client_id: Option<String>,
    pub has_client_secret: bool,
    pub has_private_key: bool,
    pub public_cert_pem: Option<String>,
    pub gateway_jwt_public_key_pem: Option<String>,
    /// `settings` when saved here, `env` when the server's ABDM credentials
    /// are used instead, `none` when neither.
    pub credentials_source: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct SaveNhcxSettings {
    pub environment: NhcxEnvironment,
    pub participant_code: String,
    pub client_id: Option<String>,
    /// Blank keeps the saved secret.
    pub client_secret: Option<String>,
    /// Blank keeps the saved key.
    pub private_key_pem: Option<String>,
    pub public_cert_pem: Option<String>,
    pub gateway_jwt_public_key_pem: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NhcxConnectionTest {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct NhcxStatus {
    pub ready: bool,
    pub environment: NhcxEnvironment,
    /// What is still to be set up, in words.
    pub missing: Vec<&'static str>,
}

async fn load(state: &AppState, claims: &Claims) -> Result<StoredSettings, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = config::stored(&mut tx, claims.tenant_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.commit().await?;
    Ok(stored)
}

async fn view(state: &AppState, stored: StoredSettings) -> NhcxSettingsView {
    let saved = stored.client_id.is_some() && stored.client_secret_sealed.is_some();
    let credentials_source = if saved {
        "settings"
    } else if config::has_env_credentials(state.secret_resolver.as_ref()).await {
        "env"
    } else {
        "none"
    };
    NhcxSettingsView {
        environment: stored.environment(),
        participant_code: stored.participant_code().map(str::to_owned),
        has_client_secret: stored.client_secret_sealed.is_some(),
        has_private_key: stored.private_key_sealed.is_some(),
        client_id: stored.client_id,
        public_cert_pem: stored.public_cert_pem,
        gateway_jwt_public_key_pem: stored.gateway_jwt_public_key_pem,
        credentials_source,
    }
}

/// `GET /api/integrations/nhcx/settings` — what is set, never a secret.
///
/// # Errors
/// 403 without `insurance.nhcx.configure`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NhcxSettingsView>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::CONFIGURE)?;
    let stored = load(&state, &claims).await?;
    Ok(Json(view(&state, stored).await))
}

fn blank_to_none(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|v| !v.is_empty())
}

fn require_pem(value: Option<&str>, what: &str) -> Result<Option<String>, AppError> {
    match blank_to_none(value) {
        Some(pem) if !pem.contains("-----BEGIN ") => Err(AppError::BadRequest(format!(
            "the {what} must be PEM text (-----BEGIN …)"
        ))),
        other => Ok(other.map(str::to_owned)),
    }
}

/// A private key that cannot decrypt what is encrypted to the certificate
/// would turn every payer response into a 400 — refuse it at the door.
fn check_key_pair(private_key: &str, cert: &str) -> Result<(), AppError> {
    let probe = json!({ "probe": true });
    let pair_ok = medbrains_crypto::jwe::encrypt_hcx(&probe, &Map::new(), cert.as_bytes())
        .ok()
        .and_then(|t| medbrains_crypto::jwe::decrypt_hcx(&t, private_key.as_bytes()).ok())
        .is_some_and(|(_, back)| back == probe);
    if pair_ok {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "the private key and the public certificate are not a matching RSA pair".to_owned(),
        ))
    }
}

/// `PUT /api/integrations/nhcx/settings` — save; a blank secret or key keeps
/// the saved one.
///
/// # Errors
/// 400 without a participant code, for non-PEM keys, or a key that does not
/// match the certificate; 409 when another hospital holds the code.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveNhcxSettings>,
) -> Result<Json<NhcxSettingsView>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::CONFIGURE)?;
    let code = body.participant_code.trim();
    if code.is_empty() {
        return Err(AppError::BadRequest(
            "enter the NHCX participant code".to_owned(),
        ));
    }
    let cert = require_pem(body.public_cert_pem.as_deref(), "public certificate")?;
    let gateway_key = require_pem(body.gateway_jwt_public_key_pem.as_deref(), "gateway key")?;
    let new_private_key = require_pem(body.private_key_pem.as_deref(), "private key")?;
    if let (Some(key), Some(cert)) = (&new_private_key, &cert) {
        check_key_pair(key, cert)?;
    }
    let sealing_key = config::sealing_key(state.secret_resolver.as_ref()).await;
    let seal = |context: &[u8], secret: &str| {
        config::seal(&sealing_key, context, secret)
            .map_err(|_| AppError::Internal("could not seal the NHCX secret".to_owned()))
    };
    let secret_sealed = blank_to_none(body.client_secret.as_deref())
        .map(|s| seal(CLIENT_SECRET_CONTEXT, s))
        .transpose()?;
    let key_sealed = new_private_key
        .as_deref()
        .map(|k| seal(PRIVATE_KEY_CONTEXT, k))
        .transpose()?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("UPDATE tenants SET abdm_hcx_sender_code = $1, updated_at = now() WHERE id = $2")
        .bind(code)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO nhcx_settings (tenant_id, environment, client_id, client_secret_sealed, \
             private_key_sealed, public_cert_pem, gateway_jwt_public_key_pem, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (tenant_id) WHERE deleted_at IS NULL DO UPDATE SET \
           environment = EXCLUDED.environment, client_id = EXCLUDED.client_id, \
           client_secret_sealed = COALESCE(EXCLUDED.client_secret_sealed, \
                                           nhcx_settings.client_secret_sealed), \
           private_key_sealed = COALESCE(EXCLUDED.private_key_sealed, \
                                         nhcx_settings.private_key_sealed), \
           public_cert_pem = EXCLUDED.public_cert_pem, \
           gateway_jwt_public_key_pem = EXCLUDED.gateway_jwt_public_key_pem, \
           updated_by = EXCLUDED.updated_by",
    )
    .bind(claims.tenant_id)
    .bind(match body.environment {
        NhcxEnvironment::Sandbox => "sandbox",
        NhcxEnvironment::Production => "production",
    })
    .bind(blank_to_none(body.client_id.as_deref()))
    .bind(secret_sealed)
    .bind(key_sealed)
    .bind(cert)
    .bind(gateway_key)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let stored = config::stored(&mut tx, claims.tenant_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.commit().await?;
    session::forget(claims.tenant_id);
    Ok(Json(view(&state, stored).await))
}

/// `POST /api/integrations/nhcx/settings/test` — sign in to the NHCX gateway
/// with the saved credentials. A refusal is reported, not raised, so the
/// screen can show the gateway's reason.
///
/// # Errors
/// 403 without `insurance.nhcx.configure`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn test_connection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NhcxConnectionTest>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::CONFIGURE)?;
    let stored = load(&state, &claims).await?;
    let resolver = state.secret_resolver.as_ref();
    let creds = match config::credentials(&stored, resolver).await {
        Ok(creds) => creds,
        Err(e) => {
            return Ok(Json(NhcxConnectionTest {
                ok: false,
                message: e.to_string(),
            }));
        }
    };
    let base = config::base_url_override(resolver).await;
    let endpoints = Endpoints::new(creds.environment, base.as_deref());
    let http = reqwest::Client::builder()
        .timeout(TEST_TIMEOUT)
        .build()
        .map_err(|e| AppError::Internal(format!("http client: {e}")))?;
    session::forget(claims.tenant_id);
    let result = match session::token(&http, claims.tenant_id, &creds, &endpoints).await {
        Ok(_) => NhcxConnectionTest {
            ok: true,
            message: match creds.environment {
                NhcxEnvironment::Sandbox => "Signed in to the NHCX sandbox gateway.".to_owned(),
                NhcxEnvironment::Production => {
                    "Signed in to the NHCX production gateway.".to_owned()
                }
            },
        },
        Err(e) => NhcxConnectionTest {
            ok: false,
            message: e.to_string(),
        },
    };
    Ok(Json(result))
}

/// `GET /api/integrations/nhcx/status` — whether claims can go to NHCX, and
/// what is missing if not. Never returns a key.
///
/// # Errors
/// 403 without `insurance.nhcx.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NhcxStatus>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let stored = load(&state, &claims).await?;
    let has_creds = (stored.client_id.is_some() && stored.client_secret_sealed.is_some())
        || config::has_env_credentials(state.secret_resolver.as_ref()).await;
    let missing: Vec<&'static str> = [
        (stored.participant_code().is_none(), "participant code"),
        (!has_creds, "gateway client ID and secret"),
        (stored.private_key_sealed.is_none(), "private key"),
        (
            stored.gateway_jwt_public_key_pem.is_none(),
            "gateway public key",
        ),
    ]
    .into_iter()
    .filter_map(|(is_missing, what)| is_missing.then_some(what))
    .collect();
    Ok(Json(NhcxStatus {
        ready: missing.is_empty(),
        environment: stored.environment(),
        missing,
    }))
}
