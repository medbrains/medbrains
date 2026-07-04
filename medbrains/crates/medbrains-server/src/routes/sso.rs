//! Enterprise SSO configuration — admin CRUD for identity providers and the
//! AD/IdP-group → role / access-group mappings. The OIDC and SAML login flows
//! (token validation + JIT provisioning) live in follow-up modules and read this
//! configuration. See migration 0200 + memory project_sso_ad_groups.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

const MANAGE: &str = "admin.settings.general.manage";
const SSO_SECRET_KEY: &str = "MEDBRAINS_OAUTH_TOKEN_KEY";
const DEV_SSO_SECRET_KEY: &[u8] = b"medbrains-dev-oauth-token-key-32";
const SSO_SECRET_CONTEXT: &[u8] = b"sso-client-secret";

async fn secret_key(state: &AppState) -> Vec<u8> {
    match state.secret_resolver.get(SSO_SECRET_KEY).await {
        Ok(value) if value.len() >= 32 => value.into_bytes(),
        _ => DEV_SSO_SECRET_KEY.to_vec(),
    }
}

fn encrypt_secret(key: &[u8], secret: &str) -> Result<String, AppError> {
    medbrains_crypto::aead::encrypt_token(key, SSO_SECRET_CONTEXT, &secret)
        .map_err(|e| AppError::Internal(format!("sso secret encrypt: {e}")))
}

/// SSO provisioning file (like Google's `client_secret.json`) — drop it in place,
/// gitignored, and the provider is configured at boot.
#[derive(Deserialize)]
struct SsoSeedConfig {
    #[serde(default = "seed_default_code")]
    code: String,
    /// Button label. Blank → best-effort auto-fetch the org name from the IdP
    /// (Microsoft Graph for Entra); falls back to "SSO".
    #[serde(default)]
    name: Option<String>,
    discovery_url: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    #[serde(default = "seed_default_group_claim")]
    group_claim: String,
    default_role: Option<String>,
    /// `{"<entra-group-object-id>": "<role_code>"}`
    #[serde(default)]
    group_map: std::collections::HashMap<String, String>,
}

fn seed_default_code() -> String {
    "entra".to_owned()
}
fn seed_default_group_claim() -> String {
    "groups".to_owned()
}

/// Best-effort fetch of the tenant's org display name from Microsoft Graph, used
/// as the SSO button label when none is configured. Client-credentials against the
/// tenant (needs the `Organization.Read.All` app permission + admin consent);
/// returns None on any failure (non-Entra, no permission, network) → caller falls
/// back. 5s timeout so a slow/unreachable Graph never stalls startup.
async fn fetch_entra_org_name(
    discovery_url: &str,
    client_id: &str,
    client_secret: &str,
) -> Option<String> {
    // Derive the token endpoint from the standard Entra discovery URL shape.
    let token_url =
        discovery_url.replace("/v2.0/.well-known/openid-configuration", "/oauth2/v2.0/token");
    if token_url == discovery_url {
        return None; // not the expected Entra URL — skip Graph
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;
    let token: serde_json::Value = client
        .post(&token_url)
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("scope", "https://graph.microsoft.com/.default"),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    let access = token.get("access_token")?.as_str()?;
    let org: serde_json::Value = client
        .get("https://graph.microsoft.com/v1.0/organization")
        .bearer_auth(access)
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    org.get("value")?
        .get(0)?
        .get("displayName")?
        .as_str()
        .map(str::to_owned)
}

/// Provision the SSO provider + group mappings from a local JSON file at startup,
/// so a turnkey deploy federates declaratively — no manual login + `/admin/sso`
/// clicking. Reads `$SSO_CONFIG_FILE` (default `entra-sso.json`); absent → no-op.
/// Idempotent (upsert). Encrypts with the same key runtime decrypts with
/// (`secret_key`), so prod KMS stays consistent.
pub async fn seed_from_config(state: &AppState) -> Result<(), AppError> {
    let path = std::env::var("SSO_CONFIG_FILE").unwrap_or_else(|_| "entra-sso.json".to_owned());
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Ok(()); // no creds file → SSO not seeded (fine)
    };
    let cfg: SsoSeedConfig = serde_json::from_str(&raw)
        .map_err(|e| AppError::Internal(format!("{path} parse: {e}")))?;

    let secret_enc = match cfg.client_secret.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(encrypt_secret(&secret_key(state).await, s)?),
        None => None,
    };
    // Button label: configured value, else best-effort org name from Entra Graph, else "SSO".
    let name = match cfg.name.as_deref().filter(|s| !s.is_empty()) {
        Some(n) => n.to_owned(),
        None => match (cfg.client_id.as_deref(), cfg.client_secret.as_deref()) {
            (Some(cid), Some(sec)) => fetch_entra_org_name(&cfg.discovery_url, cid, sec)
                .await
                .unwrap_or_else(|| "SSO".to_owned()),
            _ => "SSO".to_owned(),
        },
    };
    let (code, discovery_url, group_claim, client_id, default_role) = (
        cfg.code,
        cfg.discovery_url,
        cfg.group_claim,
        cfg.client_id,
        cfg.default_role,
    );

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants WHERE code = 'DEFAULT'")
        .fetch_one(&state.db)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let provider_id: Uuid = sqlx::query_scalar(
        "INSERT INTO identity_providers
            (tenant_id, code, name, protocol, is_active, discovery_url, client_id,
             client_secret_enc, group_claim, default_role, jit_enabled)
         VALUES ($1,$2,$3,'oidc',true,$4,$5,$6,$7,$8,true)
         ON CONFLICT (tenant_id, code) DO UPDATE SET
            name = EXCLUDED.name, discovery_url = EXCLUDED.discovery_url,
            client_id = EXCLUDED.client_id,
            client_secret_enc = COALESCE(EXCLUDED.client_secret_enc, identity_providers.client_secret_enc),
            group_claim = EXCLUDED.group_claim, default_role = EXCLUDED.default_role,
            is_active = true, updated_at = now()
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&code)
    .bind(&name)
    .bind(&discovery_url)
    .bind(&client_id)
    .bind(&secret_enc)
    .bind(&group_claim)
    .bind(&default_role)
    .fetch_one(&mut *tx)
    .await?;

    for (idp_group, role_code) in &cfg.group_map {
        sqlx::query(
            "INSERT INTO idp_group_mappings (tenant_id, provider_id, idp_group, role_code)
             SELECT $1,$2,$3,$4 WHERE NOT EXISTS (
                 SELECT 1 FROM idp_group_mappings
                 WHERE provider_id = $2 AND idp_group = $3 AND role_code = $4)",
        )
        .bind(tenant_id)
        .bind(provider_id)
        .bind(idp_group)
        .bind(role_code)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    tracing::info!(provider = %code, "SSO provider seeded from config file");
    Ok(())
}

#[derive(Debug, sqlx::FromRow)]
struct ProviderRow {
    id: Uuid,
    code: String,
    name: String,
    protocol: String,
    is_active: bool,
    discovery_url: Option<String>,
    metadata_url: Option<String>,
    client_id: Option<String>,
    client_secret_enc: Option<String>,
    group_claim: String,
    default_role: Option<String>,
    jit_enabled: bool,
    config: serde_json::Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

/// Provider as returned to the admin UI — the client secret is never echoed,
/// only whether one is configured.
#[derive(Debug, Serialize)]
pub struct ProviderResponse {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub protocol: String,
    pub is_active: bool,
    pub discovery_url: Option<String>,
    pub metadata_url: Option<String>,
    pub client_id: Option<String>,
    pub has_client_secret: bool,
    pub group_claim: String,
    pub default_role: Option<String>,
    pub jit_enabled: bool,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ProviderRow> for ProviderResponse {
    fn from(r: ProviderRow) -> Self {
        Self {
            id: r.id,
            code: r.code,
            name: r.name,
            protocol: r.protocol,
            is_active: r.is_active,
            discovery_url: r.discovery_url,
            metadata_url: r.metadata_url,
            client_id: r.client_id,
            has_client_secret: r.client_secret_enc.is_some(),
            group_claim: r.group_claim,
            default_role: r.default_role,
            jit_enabled: r.jit_enabled,
            config: r.config,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateProviderRequest {
    pub code: String,
    pub name: String,
    pub protocol: String,
    pub discovery_url: Option<String>,
    pub metadata_url: Option<String>,
    pub client_id: Option<String>,
    /// Plaintext — encrypted at rest with the app secret key.
    pub client_secret: Option<String>,
    pub group_claim: Option<String>,
    pub default_role: Option<String>,
    pub jit_enabled: Option<bool>,
    pub is_active: Option<bool>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderRequest {
    pub name: Option<String>,
    pub discovery_url: Option<String>,
    pub metadata_url: Option<String>,
    pub client_id: Option<String>,
    /// Provide to rotate the secret; omit to keep the existing one.
    pub client_secret: Option<String>,
    pub group_claim: Option<String>,
    pub default_role: Option<String>,
    pub jit_enabled: Option<bool>,
    pub is_active: Option<bool>,
    pub config: Option<serde_json::Value>,
}

fn validate_protocol(p: &str) -> Result<(), AppError> {
    if p == "oidc" || p == "saml" {
        Ok(())
    } else {
        Err(AppError::BadRequest("protocol must be 'oidc' or 'saml'".to_owned()))
    }
}

/// GET /api/admin/sso/providers
pub async fn list_providers(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ProviderResponse>>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ProviderRow>(
        "SELECT id, code, name, protocol, is_active, discovery_url, metadata_url, client_id, \
         client_secret_enc, group_claim, default_role, jit_enabled, config, created_at, updated_at \
         FROM identity_providers ORDER BY name LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows.into_iter().map(ProviderResponse::from).collect()))
}

/// POST /api/admin/sso/providers
pub async fn create_provider(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<CreateProviderRequest>,
) -> Result<Json<ProviderResponse>, AppError> {
    require_permission(&claims, MANAGE)?;
    validate_protocol(&req.protocol)?;

    let secret_enc = match req.client_secret.as_deref().filter(|s| !s.is_empty()) {
        Some(secret) => {
            let key = secret_key(&state).await;
            Some(encrypt_secret(&key, secret)?)
        }
        None => None,
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, ProviderRow>(
        "INSERT INTO identity_providers
            (tenant_id, code, name, protocol, is_active, discovery_url, metadata_url, client_id,
             client_secret_enc, group_claim, default_role, jit_enabled, config)
         VALUES ($1,$2,$3,$4,COALESCE($5,true),$6,$7,$8,$9,COALESCE($10,'groups'),$11,
                 COALESCE($12,true),COALESCE($13,'{}'::jsonb))
         RETURNING id, code, name, protocol, is_active, discovery_url, metadata_url, client_id,
                   client_secret_enc, group_claim, default_role, jit_enabled, config,
                   created_at, updated_at",
    )
    .bind(claims.tenant_id)
    .bind(&req.code)
    .bind(&req.name)
    .bind(&req.protocol)
    .bind(req.is_active)
    .bind(&req.discovery_url)
    .bind(&req.metadata_url)
    .bind(&req.client_id)
    .bind(&secret_enc)
    .bind(&req.group_claim)
    .bind(&req.default_role)
    .bind(req.jit_enabled)
    .bind(&req.config)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row.into()))
}

/// PUT /api/admin/sso/providers/{id}
pub async fn update_provider(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProviderRequest>,
) -> Result<Json<ProviderResponse>, AppError> {
    require_permission(&claims, MANAGE)?;

    let new_secret_enc = match req.client_secret.as_deref().filter(|s| !s.is_empty()) {
        Some(secret) => {
            let key = secret_key(&state).await;
            Some(encrypt_secret(&key, secret)?)
        }
        None => None,
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // COALESCE keeps existing values when a field is omitted; the secret is only
    // overwritten when a non-empty new one is supplied.
    let row = sqlx::query_as::<_, ProviderRow>(
        "UPDATE identity_providers SET
            name = COALESCE($2, name),
            discovery_url = COALESCE($3, discovery_url),
            metadata_url = COALESCE($4, metadata_url),
            client_id = COALESCE($5, client_id),
            client_secret_enc = COALESCE($6, client_secret_enc),
            group_claim = COALESCE($7, group_claim),
            default_role = COALESCE($8, default_role),
            jit_enabled = COALESCE($9, jit_enabled),
            is_active = COALESCE($10, is_active),
            config = COALESCE($11, config),
            updated_at = now()
         WHERE id = $1
         RETURNING id, code, name, protocol, is_active, discovery_url, metadata_url, client_id,
                   client_secret_enc, group_claim, default_role, jit_enabled, config,
                   created_at, updated_at",
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.discovery_url)
    .bind(&req.metadata_url)
    .bind(&req.client_id)
    .bind(&new_secret_enc)
    .bind(&req.group_claim)
    .bind(&req.default_role)
    .bind(req.jit_enabled)
    .bind(req.is_active)
    .bind(&req.config)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row.into()))
}

/// DELETE /api/admin/sso/providers/{id}
pub async fn delete_provider(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("DELETE FROM identity_providers WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ── Group mappings ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GroupMapping {
    pub id: Uuid,
    pub provider_id: Uuid,
    pub idp_group: String,
    pub role_code: Option<String>,
    pub access_group_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMappingRequest {
    pub idp_group: String,
    pub role_code: Option<String>,
    pub access_group_id: Option<Uuid>,
}

/// GET /api/admin/sso/providers/{id}/mappings
pub async fn list_mappings(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(provider_id): Path<Uuid>,
) -> Result<Json<Vec<GroupMapping>>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, GroupMapping>(
        "SELECT id, provider_id, idp_group, role_code, access_group_id, created_at \
         FROM idp_group_mappings WHERE provider_id = $1 ORDER BY idp_group LIMIT 500",
    )
    .bind(provider_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/admin/sso/providers/{id}/mappings
pub async fn create_mapping(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(provider_id): Path<Uuid>,
    Json(req): Json<CreateMappingRequest>,
) -> Result<Json<GroupMapping>, AppError> {
    require_permission(&claims, MANAGE)?;
    if req.role_code.is_none() && req.access_group_id.is_none() {
        return Err(AppError::BadRequest(
            "a mapping must set role_code and/or access_group_id".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, GroupMapping>(
        "INSERT INTO idp_group_mappings (tenant_id, provider_id, idp_group, role_code, access_group_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, provider_id, idp_group, role_code, access_group_id, created_at",
    )
    .bind(claims.tenant_id)
    .bind(provider_id)
    .bind(&req.idp_group)
    .bind(&req.role_code)
    .bind(req.access_group_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/admin/sso/mappings/{id}
pub async fn delete_mapping(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("DELETE FROM idp_group_mappings WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
