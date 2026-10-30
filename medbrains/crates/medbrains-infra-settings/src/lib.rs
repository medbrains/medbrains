//! Admin infrastructure & security settings (Setup Center → Infrastructure).
//!
//! - Read-only node infra status: which secrets backend + deploy mode are
//!   active (both are boot-time env decisions, not per-tenant editable).
//! - Per-tenant AI provider config (`tenant_settings` category `ai`, key
//!   `config`) consumed by the AI config module. The API key itself is never
//!   stored here or returned — only a reference to a key in the secret backend.

pub mod domain_ownership;
pub mod preflight;
use axum::extract::rejection::JsonRejection;
use axum::routing::{get, post};
use axum::{Extension, Json, extract::State};
use hickory_resolver::TokioResolver;
use hickory_resolver::config::{CLOUDFLARE, ResolverConfig};
use hickory_resolver::net::runtime::TokioRuntimeProvider;
use hickory_resolver::proto::rr::{RData, RecordType};
use medbrains_core::deploy_mode::DeployMode;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct InfraStatus {
    /// Active secrets backend label (`env` | `file` | `aws-secrets-manager`).
    pub secrets_backend: &'static str,
    /// Active deploy mode (`saas` | `hybrid` | `onprem`).
    pub deploy_mode: &'static str,
    /// What the startup checks found when this server booted.
    pub startup_checks: &'static [preflight::Finding],
}

/// GET /api/admin/infra-status
pub async fn get_infra_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<InfraStatus>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    Ok(Json(InfraStatus {
        secrets_backend: state.secret_resolver.backend_label(),
        deploy_mode: DeployMode::from_env().as_code(),
        startup_checks: preflight::report(),
    }))
}

#[derive(Debug, Serialize)]
pub struct AiSettings {
    pub provider: String,
    pub model: String,
}

/// GET /api/admin/ai-settings
pub async fn get_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'ai' AND key = 'config' AND deleted_at IS NULL",
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let cfg = stored.unwrap_or_default();
    let field = |name: &str| {
        cfg.get(name)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned)
    };

    Ok(Json(AiSettings {
        provider: field("provider").unwrap_or_else(|| "anthropic".to_owned()),
        model: field("model").unwrap_or_default(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAiSettings {
    pub provider: String,
    pub model: String,
}

/// PUT /api/admin/ai-settings
pub async fn update_ai_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<UpdateAiSettings>, JsonRejection>,
) -> Result<Json<AiSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let Json(body) = body?;

    let provider = body.provider.trim();
    if provider != "anthropic" {
        return Err(AppError::BadRequest(format!(
            "AI provider '{provider}' is not supported by this build"
        )));
    }

    // Anthropic has no key to store: access is AWS identity federation,
    // configured per node and checked at startup (`ai.anthropic_federation`).
    let value = serde_json::json!({
        "provider": provider,
        "model": body.model.trim(),
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'ai', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value, updated_at = now()",
        claims.tenant_id,
        &value,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(AiSettings {
        provider: provider.to_owned(),
        model: body.model.trim().to_owned(),
    }))
}

#[derive(Debug, Serialize)]
pub struct EmailSettings {
    /// `sendgrid` | `smtp` | `stalwart`.
    pub provider: String,
    pub smtp_host: String,
    pub smtp_port: String,
    pub smtp_tls: String,
    pub from_address: String,
    pub from_name: String,
    pub smtp_username: String,
    /// Reference (not the value) to the SMTP password in the secret backend.
    pub smtp_password_secret: Option<String>,
    /// Whether `EMAIL_FROM_ADDRESS` is present in the environment as a fallback.
    pub env_fallback: bool,
}

/// GET /api/admin/email-settings
pub async fn get_email_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<EmailSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stored = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'email' AND key = 'config' AND deleted_at IS NULL",
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let cfg = stored.unwrap_or_default();
    let field = |name: &str| {
        cfg.get(name)
            .and_then(serde_json::Value::as_str)
            .map(|s| s.trim().to_owned())
            .unwrap_or_default()
    };

    Ok(Json(EmailSettings {
        provider: {
            let p = field("provider");
            if p.is_empty() { "smtp".to_owned() } else { p }
        },
        smtp_host: field("smtp_host"),
        smtp_port: field("smtp_port"),
        smtp_tls: {
            let t = field("smtp_tls");
            if t.is_empty() {
                "starttls".to_owned()
            } else {
                t
            }
        },
        from_address: field("from_address"),
        from_name: field("from_name"),
        smtp_username: field("smtp_username"),
        smtp_password_secret: Some(field("smtp_password_secret")).filter(|s| !s.is_empty()),
        env_fallback: std::env::var("EMAIL_FROM_ADDRESS").is_ok(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmailSettings {
    pub provider: String,
    pub smtp_host: String,
    pub smtp_port: String,
    pub smtp_tls: String,
    pub from_address: String,
    pub from_name: String,
    pub smtp_username: String,
    pub smtp_password_secret: Option<String>,
}

/// PUT /api/admin/email-settings — non-secret email config; the SMTP password
/// is referenced (not stored) via the secret backend.
pub async fn update_email_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<UpdateEmailSettings>, JsonRejection>,
) -> Result<Json<EmailSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let Json(body) = body?;

    let provider = body.provider.trim();
    if !matches!(provider, "sendgrid" | "smtp" | "stalwart") {
        return Err(AppError::BadRequest(format!(
            "Email provider '{provider}' is not supported"
        )));
    }

    let secret = body
        .smtp_password_secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let value = serde_json::json!({
        "provider": provider,
        "smtp_host": body.smtp_host.trim(),
        "smtp_port": body.smtp_port.trim(),
        "smtp_tls": body.smtp_tls.trim(),
        "from_address": body.from_address.trim(),
        "from_name": body.from_name.trim(),
        "smtp_username": body.smtp_username.trim(),
        "smtp_password_secret": secret,
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'email', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value, updated_at = now()",
        claims.tenant_id,
        &value,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(EmailSettings {
        provider: provider.to_owned(),
        smtp_host: body.smtp_host.trim().to_owned(),
        smtp_port: body.smtp_port.trim().to_owned(),
        smtp_tls: body.smtp_tls.trim().to_owned(),
        from_address: body.from_address.trim().to_owned(),
        from_name: body.from_name.trim().to_owned(),
        smtp_username: body.smtp_username.trim().to_owned(),
        smtp_password_secret: secret.map(ToOwned::to_owned),
        env_fallback: std::env::var("EMAIL_FROM_ADDRESS").is_ok(),
    }))
}

#[derive(Debug, Serialize)]
pub struct DomainRecordStatus {
    pub kind: String,
    pub host: String,
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Serialize)]
pub struct DomainStatus {
    pub domain: String,
    pub records: Vec<DomainRecordStatus>,
    pub all_ok: bool,
}

/// GET /api/admin/domain-status — live DNS check for the tenant's custom domain
/// (app A record + mail MX/SPF/DMARC). The frontend polls this while records
/// propagate. DNS failures degrade to `ok: false`, never an error.
pub async fn get_domain_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DomainStatus>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let domain: Option<String> =
        sqlx::query_scalar("SELECT custom_domain FROM tenants WHERE id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&state.db)
            .await?;
    let Some(domain) = domain
        .map(|d| d.trim().to_lowercase())
        .filter(|d| !d.is_empty())
    else {
        return Err(AppError::BadRequest(
            "Set a custom domain first (Settings → Organization)".to_owned(),
        ));
    };

    let records = check_domain_dns(&domain).await;
    let all_ok = records.iter().all(|r| r.ok);
    Ok(Json(DomainStatus {
        domain,
        records,
        all_ok,
    }))
}

/// Public resolver (Cloudflare, UDP + TCP) so a hospital's answer does not
/// depend on whatever the box's own resolv.conf points at.
fn public_resolver() -> Result<TokioResolver, hickory_resolver::net::NetError> {
    TokioResolver::builder_with_config(
        ResolverConfig::udp_and_tcp(&CLOUDFLARE),
        TokioRuntimeProvider::default(),
    )
    .build()
}

/// Every record of one type at `name`, as text. A failed lookup is an empty
/// list: the caller reports "no record found", which is what the operator fixes.
pub(crate) async fn lookup_text(name: &str, kind: RecordType) -> Vec<String> {
    let Ok(resolver) = public_resolver() else {
        return Vec::new();
    };
    let Ok(lookup) = resolver.lookup(name, kind).await else {
        return Vec::new();
    };
    lookup
        .answers()
        .iter()
        .filter_map(|record| record_text(&record.data))
        .collect()
}

/// The part of a record the domain checks compare: the address, the mail
/// host, or the TXT string.
fn record_text(data: &RData) -> Option<String> {
    match data {
        RData::A(a) => Some(a.to_string()),
        RData::MX(mx) => Some(mx.exchange.to_string()),
        RData::TXT(txt) => Some(txt.to_string()),
        _ => None,
    }
}

async fn check_domain_dns(domain: &str) -> Vec<DomainRecordStatus> {
    let mut out = Vec::with_capacity(4);

    // App: any A record present (we can't know the exact edge IP here).
    let a_ip = lookup_text(domain, RecordType::A).await.into_iter().next();
    out.push(DomainRecordStatus {
        kind: "A".to_owned(),
        host: domain.to_owned(),
        ok: a_ip.is_some(),
        detail: a_ip.unwrap_or_else(|| "no A record found".to_owned()),
    });

    // Mail MX → should point at mail.<domain>.
    let expected_mx = format!("mail.{domain}");
    let mx_hosts: Vec<String> = lookup_text(domain, RecordType::MX)
        .await
        .into_iter()
        .map(|host| host.trim_end_matches('.').to_owned())
        .collect();
    out.push(DomainRecordStatus {
        kind: "MX".to_owned(),
        host: domain.to_owned(),
        ok: mx_hosts
            .iter()
            .any(|h| h.eq_ignore_ascii_case(&expected_mx)),
        detail: if mx_hosts.is_empty() {
            "no MX record".to_owned()
        } else {
            mx_hosts.join(", ")
        },
    });

    // SPF (TXT at apex) and DMARC (_dmarc.<domain>).
    let apex_txt = lookup_text(domain, RecordType::TXT).await;
    out.push(DomainRecordStatus {
        kind: "SPF".to_owned(),
        host: domain.to_owned(),
        ok: apex_txt
            .iter()
            .any(|t| t.to_lowercase().starts_with("v=spf1")),
        detail: spf_detail(&apex_txt),
    });

    let dmarc_txt = lookup_text(&format!("_dmarc.{domain}"), RecordType::TXT).await;
    out.push(DomainRecordStatus {
        kind: "DMARC".to_owned(),
        host: format!("_dmarc.{domain}"),
        ok: dmarc_txt
            .iter()
            .any(|t| t.to_uppercase().starts_with("V=DMARC1")),
        detail: if dmarc_txt.is_empty() {
            "no DMARC record".to_owned()
        } else {
            "found".to_owned()
        },
    });

    out
}

fn spf_detail(txts: &[String]) -> String {
    txts.iter()
        .find(|t| t.to_lowercase().starts_with("v=spf1"))
        .cloned()
        .unwrap_or_else(|| "no SPF record".to_owned())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EmailLogEntry {
    pub id: Uuid,
    pub event_type: String,
    pub recipient: Option<String>,
    pub status: String,
    pub attempts: i32,
    pub sent_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_error: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// GET /api/admin/email-log — recent transactional email sends + status.
pub async fn get_email_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<EmailLogEntry>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, EmailLogEntry>(
        "SELECT id, event_type, payload->>'to' AS recipient, status, attempts, \
         sent_at, last_error, created_at \
         FROM outbox_events \
         WHERE event_type LIKE 'email.%' \
         ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct EmailTestRequest {
    pub to: String,
}

/// POST /api/admin/email-test — queue a test email via the configured provider.
pub async fn send_email_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Result<Json<EmailTestRequest>, JsonRejection>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let Json(body) = body?;
    let to = body.to.trim();
    if !to.contains('@') || to.len() < 3 {
        return Err(AppError::BadRequest(
            "Enter a valid email address".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "tenant",
            aggregate_id: Some(claims.tenant_id),
            event_type: "email.test",
            payload: serde_json::json!({
                "to": to,
                "subject": "MedBrains test email",
                "html": "<p>This is a test email from MedBrains. Your mail server is configured correctly.</p>",
                "text": "This is a test email from MedBrains. Your mail server is configured correctly.",
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue test email: {e}")))?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "queued" })))
}

/// infra_settings routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/admin/infra-status", get(get_infra_status))
        .route(
            "/api/admin/ai-settings",
            get(get_ai_settings).put(update_ai_settings),
        )
        .route(
            "/api/admin/email-settings",
            get(get_email_settings).put(update_email_settings),
        )
        .route("/api/admin/email-log", get(get_email_log))
        .route("/api/admin/email-test", post(send_email_test))
        .route("/api/admin/domain-status", get(get_domain_status))
        .route(
            "/api/admin/domain-ownership",
            get(domain_ownership::get_domain_ownership),
        )
        .route(
            "/api/admin/domain-ownership/verify",
            post(domain_ownership::verify_domain_ownership),
        )
}

/// Routes that answer without a session: the certificate front end asks
/// before issuing.
pub fn public_router() -> axum::Router<AppState> {
    axum::Router::new().route("/api/tls/allow", get(domain_ownership::tls_allow))
}

#[cfg(test)]
mod dns_tests {
    use super::record_text;
    use hickory_resolver::proto::rr::Name;
    use hickory_resolver::proto::rr::RData;
    use hickory_resolver::proto::rr::rdata::{A, MX, TXT};

    #[test]
    fn reads_the_fields_the_domain_checks_compare() -> Result<(), Box<dyn std::error::Error>> {
        let mx = RData::MX(MX::new(10, Name::from_ascii("mail.example.in.")?));
        assert_eq!(record_text(&mx).as_deref(), Some("mail.example.in."));
        let spf = RData::TXT(TXT::new(vec![
            "v=spf1 include:_spf.example.in ~all".to_owned(),
        ]));
        assert_eq!(
            record_text(&spf).as_deref(),
            Some("v=spf1 include:_spf.example.in ~all")
        );
        let a = RData::A(A::new(203, 0, 113, 7));
        assert_eq!(record_text(&a).as_deref(), Some("203.0.113.7"));
        assert_eq!(
            record_text(&RData::Update0(
                hickory_resolver::proto::rr::RecordType::NULL
            )),
            None
        );
        Ok(())
    }
}
