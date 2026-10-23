//! Proving a hospital controls its custom domain before the domain takes
//! effect. The hospital adds a TXT record `_medbrains-verify.<domain>` with
//! a token issued here; verifying looks it up. Sign-in follows only proven
//! domains, and the certificate front end (Caddy on-demand TLS) asks
//! `/api/tls/allow` before issuing, so a certificate is never issued for a
//! domain nobody proved.

use axum::{
    Extension, Json,
    extract::{Query, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};

/// The label the TXT record goes under.
const TXT_LABEL: &str = "_medbrains-verify";

#[derive(Debug, Serialize)]
pub struct DomainOwnership {
    pub domain: String,
    /// Where the TXT record goes, e.g. `_medbrains-verify.hms.hospital.com`.
    pub record_name: String,
    /// What the TXT record says.
    pub token: String,
    pub verified_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct Row {
    custom_domain: Option<String>,
    custom_domain_token: Option<String>,
    custom_domain_verified_at: Option<DateTime<Utc>>,
}

async fn read(state: &AppState, claims: &Claims) -> Result<DomainOwnership, AppError> {
    let row = sqlx::query_as::<_, Row>(
        "SELECT custom_domain, custom_domain_token, custom_domain_verified_at FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&state.db)
    .await?;
    let domain = row
        .custom_domain
        .map(|d| d.trim().to_lowercase())
        .filter(|d| !d.is_empty())
        .ok_or_else(|| {
            AppError::BadRequest("Set a custom domain first (Settings → Organization)".to_owned())
        })?;
    Ok(DomainOwnership {
        record_name: format!("{TXT_LABEL}.{domain}"),
        domain,
        token: row.custom_domain_token.unwrap_or_default(),
        verified_at: row.custom_domain_verified_at,
    })
}

/// `GET /api/admin/domain-ownership` — the TXT record to add, and whether the
/// domain is proven.
pub async fn get_domain_ownership(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DomainOwnership>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    Ok(Json(read(&state, &claims).await?))
}

/// `POST /api/admin/domain-ownership/verify` — looks the TXT record up and,
/// when it carries the token, proves the domain.
pub async fn verify_domain_ownership(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DomainOwnership>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let ownership = read(&state, &claims).await?;
    if ownership.verified_at.is_some() {
        return Ok(Json(ownership));
    }
    let found =
        crate::lookup_text(&ownership.record_name, hickory_resolver::proto::rr::RecordType::TXT).await;
    if !found.iter().any(|v| v.trim() == ownership.token) {
        return Err(AppError::BadRequest(format!(
            "No TXT record at {} says {} yet. DNS changes can take a while to appear; try again shortly.",
            ownership.record_name, ownership.token
        )));
    }
    sqlx::query(
        "UPDATE tenants SET custom_domain_verified_at = now() \
         WHERE id = $1 AND custom_domain_token = $2 AND custom_domain_verified_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&ownership.token)
    .execute(&state.db)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            AppError::Conflict("Another hospital already uses this domain".to_owned())
        }
        _ => AppError::from(e),
    })?;
    Ok(Json(read(&state, &claims).await?))
}

#[derive(Debug, Deserialize)]
pub struct TlsAsk {
    pub domain: String,
}

/// `GET /api/tls/allow?domain=…` — public; Caddy's on-demand TLS asks it
/// before issuing a certificate. 200 for a proven hospital domain, 404 for
/// anything else, so the front end never requests a certificate for a name
/// nobody proved.
pub async fn tls_allow(
    State(state): State<AppState>,
    Query(q): Query<TlsAsk>,
) -> Result<StatusCode, AppError> {
    let domain = q.domain.trim().trim_end_matches('.').to_lowercase();
    let allowed: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM tenants WHERE lower(custom_domain) = $1 \
           AND custom_domain_verified_at IS NOT NULL AND is_active)",
    )
    .bind(&domain)
    .fetch_one(&state.db)
    .await?;
    Ok(if allowed {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    })
}
