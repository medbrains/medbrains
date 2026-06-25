//! Stalwart mail-server provisioning — automate per-tenant domain + mailbox
//! setup instead of doing it by hand in Stalwart's admin UI.
//!
//! Talks to Stalwart's management REST API (HTTP Basic with the fallback
//! admin). Config via env so it targets the dev instance out of the box:
//!   - `STALWART_API_URL`        (default `https://localhost:8086`)
//!   - `STALWART_ADMIN_USER`     (default `admin`)
//!   - `STALWART_ADMIN_SECRET`   (default `medbrains_dev` — the dev compose value)
//!   - `STALWART_INSECURE_TLS=1`  accept the dev self-signed cert
//!
//! Endpoints follow Stalwart's documented management API (`/api/principal`,
//! `/api/dns/records/{domain}`); a Stalwart error is surfaced verbatim so a
//! version/path mismatch is obvious rather than silent.

use axum::{Extension, Json, extract::State};
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};
use medbrains_core::permissions;

struct StalwartClient {
    base_url: String,
    admin_user: String,
    admin_secret: String,
    http: reqwest::Client,
}

impl StalwartClient {
    fn from_env() -> Result<Self, AppError> {
        let base_url = std::env::var("STALWART_API_URL")
            .unwrap_or_else(|_| "https://localhost:8086".to_owned());
        let admin_user =
            std::env::var("STALWART_ADMIN_USER").unwrap_or_else(|_| "admin".to_owned());
        let admin_secret =
            std::env::var("STALWART_ADMIN_SECRET").unwrap_or_else(|_| "medbrains_dev".to_owned());
        let insecure = std::env::var("STALWART_INSECURE_TLS").is_ok();
        let http = reqwest::Client::builder()
            .danger_accept_invalid_certs(insecure)
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| AppError::Internal(format!("stalwart client init: {e}")))?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_owned(),
            admin_user,
            admin_secret,
            http,
        })
    }

    async fn post(&self, path: &str, body: serde_json::Value) -> Result<serde_json::Value, AppError> {
        let resp = self
            .http
            .post(format!("{}{path}", self.base_url))
            .basic_auth(&self.admin_user, Some(&self.admin_secret))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("Stalwart unreachable: {e}")))?;
        Self::parse(resp).await
    }

    async fn get(&self, path: &str) -> Result<serde_json::Value, AppError> {
        let resp = self
            .http
            .get(format!("{}{path}", self.base_url))
            .basic_auth(&self.admin_user, Some(&self.admin_secret))
            .send()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("Stalwart unreachable: {e}")))?;
        Self::parse(resp).await
    }

    async fn parse(resp: reqwest::Response) -> Result<serde_json::Value, AppError> {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "Stalwart API {status}: {}",
                text.chars().take(300).collect::<String>()
            )));
        }
        Ok(serde_json::from_str(&text).unwrap_or(serde_json::Value::Null))
    }
}

#[derive(Debug, Deserialize)]
pub struct ProvisionDomainRequest {
    pub domain: String,
}

#[derive(Debug, Serialize)]
pub struct DnsRecord {
    pub record_type: String,
    pub host: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct ProvisionDomainResponse {
    pub domain: String,
    pub dns_records: Vec<DnsRecord>,
}

/// Create the domain in Stalwart (idempotent — an "already exists" error is
/// tolerated) and return the DNS records (MX / SPF / DKIM / DMARC) the tenant
/// must publish.
pub async fn provision_domain(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ProvisionDomainRequest>,
) -> Result<Json<ProvisionDomainResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let domain = body.domain.trim().to_lowercase();
    if domain.is_empty() || !domain.contains('.') {
        return Err(AppError::BadRequest("Enter a valid domain".to_owned()));
    }

    let client = StalwartClient::from_env()?;

    // Register the domain (principal type=domain). Ignore "already exists".
    if let Err(err) = client
        .post(
            "/api/principal",
            serde_json::json!({ "type": "domain", "name": domain }),
        )
        .await
    {
        let msg = format!("{err:?}").to_lowercase();
        if !msg.contains("exist") && !msg.contains("409") {
            return Err(err);
        }
    }

    let records = client
        .get(&format!("/api/dns/records/{domain}"))
        .await?;
    let dns_records = parse_dns_records(&records);

    Ok(Json(ProvisionDomainResponse {
        domain,
        dns_records,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateMailboxRequest {
    pub email: String,
    pub password: String,
}

/// Create a mailbox/account in Stalwart (e.g. `noreply@<domain>`).
pub async fn create_mailbox(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMailboxRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let email = body.email.trim().to_lowercase();
    if !email.contains('@') {
        return Err(AppError::BadRequest("Enter a valid email address".to_owned()));
    }
    if body.password.trim().len() < 8 {
        return Err(AppError::BadRequest(
            "Mailbox password must be at least 8 characters".to_owned(),
        ));
    }

    // Stalwart's principal API takes `secrets` (array), not `secret` — a
    // string 400s with "JSON deserialization failed".
    //
    // `roles: ["user"]` is REQUIRED. A principal created via the API gets no
    // role (unlike the admin UI, which assigns `user` automatically), so it
    // has zero permissions: auth succeeds but the account is then denied the
    // `authenticate` action — SMTP submission 550s "not authorized to use
    // this service" and IMAP login fails. The `user` role grants the standard
    // mail permissions (submit/IMAP/POP3). Verified live against
    // stalwartlabs/stalwart 0.15.5.
    let client = StalwartClient::from_env()?;
    client
        .post(
            "/api/principal",
            serde_json::json!({
                "type": "individual",
                "name": email,
                "secrets": [body.password],
                "emails": [email],
                "roles": ["user"],
            }),
        )
        .await?;

    Ok(Json(serde_json::json!({ "email": email, "created": true })))
}

/// Best-effort extraction of `{type, name, content}` records from Stalwart's
/// `/api/dns/records` response (wrapped under `data` in current versions).
fn parse_dns_records(value: &serde_json::Value) -> Vec<DnsRecord> {
    let arr = value
        .get("data")
        .and_then(|d| d.as_array())
        .or_else(|| value.as_array());
    let Some(items) = arr else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|r| {
            let record_type = r.get("type").and_then(|v| v.as_str())?.to_owned();
            let host = r
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_owned();
            let val = r
                .get("content")
                .or_else(|| r.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_owned();
            Some(DnsRecord {
                record_type,
                host,
                value: val,
            })
        })
        .collect()
}

