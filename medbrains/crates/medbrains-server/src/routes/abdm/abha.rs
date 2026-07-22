//! ABDM ABHA service contract.
//!
//! This is a real integration boundary: when tenant/env credentials exist,
//! calls go to ABDM sandbox or production. Without credentials, the endpoints
//! return 503 so the UI can show "configure integration" instead of pretending
//! the provider call succeeded.

use axum::{Extension, Json, extract::State};
use chrono::Utc;
use medbrains_abdm::{
    AbdmAbhaClient, AbdmAbhaConfig, AbdmEnvironment, AbdmError, AbdmRequestContext,
    AbhaIntegrationReadiness, PublicCertificateResponse, RequestOtpRequest, RequestOtpResponse,
    SessionTokenRequest, SessionTokenResponse, VerifyOtpRequest, VerifyOtpResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const ABDM_ABHA_VIEW: &str = "abdm.abha.view";
const ABDM_ABHA_MANAGE: &str = "abdm.abha.manage";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AbhaSessionRequest {
    pub environment: Option<AbdmEnvironment>,
    pub credentials: Option<SessionTokenRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AbhaAuthenticatedRequest<T> {
    pub environment: Option<AbdmEnvironment>,
    pub access_token: String,
    pub request: T,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AbhaPublicCertificateRequest {
    pub environment: Option<AbdmEnvironment>,
    pub access_token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AbhaStatusResponse {
    pub environment: AbdmEnvironment,
    pub configured: bool,
    pub source: String,
    pub readiness: AbhaIntegrationReadiness,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AbhaProviderResponse<T>
where
    T: Serialize,
{
    pub environment: AbdmEnvironment,
    pub request_id: Uuid,
    pub response: T,
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AbhaStatusResponse>, AppError> {
    require_permission(&claims, ABDM_ABHA_VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let config = read_abdm_config(&mut tx, &claims.tenant_id).await.ok();
    tx.commit().await?;

    let environment = config
        .as_ref()
        .map(|value| value.environment.clone())
        .unwrap_or(AbdmEnvironment::Sandbox);
    let readiness = client_for(&environment).readiness();
    Ok(Json(AbhaStatusResponse {
        environment,
        configured: config.is_some(),
        source: config
            .map(|value| value.source)
            .unwrap_or_else(|| "none".to_owned()),
        readiness,
    }))
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn create_session(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AbhaSessionRequest>,
) -> Result<Json<AbhaProviderResponse<SessionTokenResponse>>, AppError> {
    require_permission(&claims, ABDM_ABHA_MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let config = read_abdm_config(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;

    let environment = body.environment.unwrap_or(config.environment);
    let credentials = body.credentials.unwrap_or(SessionTokenRequest {
        client_id: config.client_id,
        client_secret: config.client_secret,
    });
    let response = client_for(&environment)
        .create_session(&credentials)
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(provider_response(environment, response)))
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn public_certificate(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AbhaPublicCertificateRequest>,
) -> Result<Json<AbhaProviderResponse<PublicCertificateResponse>>, AppError> {
    require_permission(&claims, ABDM_ABHA_VIEW)?;
    let environment = body.environment.unwrap_or(AbdmEnvironment::Sandbox);
    let context = request_context(body.access_token);
    let response = client_for(&environment)
        .public_certificate(&context)
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(provider_response(environment, response)))
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_login_otp(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AbhaAuthenticatedRequest<RequestOtpRequest>>,
) -> Result<Json<AbhaProviderResponse<RequestOtpResponse>>, AppError> {
    require_permission(&claims, ABDM_ABHA_MANAGE)?;
    let environment = body.environment.unwrap_or(AbdmEnvironment::Sandbox);
    let context = request_context(body.access_token);
    let response = client_for(&environment)
        .request_login_otp(&context, &body.request)
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(provider_response(environment, response)))
}

#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn verify_login_otp(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AbhaAuthenticatedRequest<VerifyOtpRequest>>,
) -> Result<Json<AbhaProviderResponse<VerifyOtpResponse>>, AppError> {
    require_permission(&claims, ABDM_ABHA_MANAGE)?;
    let environment = body.environment.unwrap_or(AbdmEnvironment::Sandbox);
    let context = request_context(body.access_token);
    let response = client_for(&environment)
        .verify_login_otp(&context, &body.request)
        .await
        .map_err(map_abdm_error)?;
    Ok(Json(provider_response(environment, response)))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoredAbdmConfig {
    environment: Option<AbdmEnvironment>,
    client_id: Option<String>,
    client_secret: Option<String>,
}

#[derive(Debug)]
struct ResolvedAbdmConfig {
    environment: AbdmEnvironment,
    client_id: String,
    client_secret: String,
    source: String,
}

async fn read_abdm_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<ResolvedAbdmConfig, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'abdm' AND key = 'abha_config'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(value) = row {
        let stored: StoredAbdmConfig = serde_json::from_value(value)
            .map_err(|err| AppError::Internal(format!("invalid abha_config: {err}")))?;
        if let (Some(client_id), Some(client_secret)) = (stored.client_id, stored.client_secret) {
            return Ok(ResolvedAbdmConfig {
                environment: stored.environment.unwrap_or(AbdmEnvironment::Sandbox),
                client_id,
                client_secret,
                source: "tenant_settings".to_owned(),
            });
        }
    }

    let client_id = std::env::var("ABDM_CLIENT_ID").ok();
    let client_secret = std::env::var("ABDM_CLIENT_SECRET").ok();
    if let (Some(client_id), Some(client_secret)) = (client_id, client_secret) {
        let environment = match std::env::var("ABDM_ENVIRONMENT")
            .unwrap_or_else(|_| "sandbox".to_owned())
            .as_str()
        {
            "production" => AbdmEnvironment::Production,
            _ => AbdmEnvironment::Sandbox,
        };
        return Ok(ResolvedAbdmConfig {
            environment,
            client_id,
            client_secret,
            source: "env".to_owned(),
        });
    }

    Err(AppError::ServiceUnavailable(
        "ABDM ABHA credentials are not configured".to_owned(),
    ))
}

fn client_for(environment: &AbdmEnvironment) -> AbdmAbhaClient {
    let config = match environment {
        AbdmEnvironment::Sandbox => AbdmAbhaConfig::sandbox(),
        AbdmEnvironment::Production => AbdmAbhaConfig::production(),
    };
    AbdmAbhaClient::new(reqwest::Client::new(), config)
}

fn request_context(access_token: String) -> AbdmRequestContext {
    AbdmRequestContext {
        request_id: Uuid::new_v4(),
        timestamp: Utc::now(),
        access_token,
    }
}

fn provider_response<T>(environment: AbdmEnvironment, response: T) -> AbhaProviderResponse<T>
where
    T: Serialize,
{
    AbhaProviderResponse {
        environment,
        request_id: Uuid::new_v4(),
        response,
    }
}

fn map_abdm_error(error: AbdmError) -> AppError {
    match error {
        AbdmError::Status { status, body } => {
            AppError::BadRequest(format!("ABDM returned {status}: {body}"))
        }
        AbdmError::Http(err) => AppError::Internal(format!("ABDM HTTP request failed: {err}")),
    }
}
