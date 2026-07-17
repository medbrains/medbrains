//! Self-service email verification. On signup the admin is issued a one-time
//! link; clicking it flips `users.email_verified`. Advisory — login is not
//! blocked. Only the SHA-256 hash of the high-entropy token is stored; the
//! token table is a pre-auth capability table (no RLS), so the public verify
//! endpoint resolves it globally then sets the tenant RLS context for the
//! `users` update.

use axum::{Extension, Json, extract::State};
use axum::routing::{post};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

/// Best-effort public origin for verify links, from the forwarded host.
fn verify_base_from_headers(headers: &axum::http::HeaderMap) -> String {
    headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(axum::http::header::HOST))
        .and_then(|v| v.to_str().ok())
        .map_or_else(
            || "https://localhost".to_owned(),
            |host| format!("https://{}", host.split(':').next().unwrap_or(host)),
        )
}

const VERIFY_TTL_HOURS: i64 = 48;

fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

/// Issue a verification token and queue the verify email (call inside the
/// signup transaction, after the user row is inserted). `verify_base` is the
/// app's public origin, e.g. `https://hms.apollo.com`.
pub async fn issue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    email: &str,
    verify_base: &str,
) -> Result<(), AppError> {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("rng: {e}")))?;
    let raw = hex::encode(buf);
    let token_hash = hash_token(&raw);
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(VERIFY_TTL_HOURS);

    sqlx::query(
        "INSERT INTO email_verification_tokens (tenant_id, user_id, token_hash, expires_at) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&mut **tx)
    .await?;

    let link = format!("{}/verify-email?token={raw}", verify_base.trim_end_matches('/'));
    let html = format!(
        "<p>Welcome to MedBrains.</p>\
         <p>Confirm your email address to secure your account:</p>\
         <p><a href=\"{link}\">Verify email</a></p>\
         <p>This link expires in 48 hours.</p>"
    );
    let text = format!("Confirm your MedBrains email address: {link}\n(This link expires in 48 hours.)");

    medbrains_outbox::queue::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "user",
            aggregate_id: Some(user_id),
            event_type: "email.verify_email",
            payload: serde_json::json!({
                "to": email,
                "subject": "Verify your MedBrains email",
                "html": html,
                "text": text,
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue verify email: {e}")))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyEmailResponse {
    pub verified: bool,
}

/// POST /api/auth/verify-email (public) — confirm a verification token.
pub async fn verify_email(
    State(state): State<AppState>,
    Json(body): Json<VerifyEmailRequest>,
) -> Result<Json<VerifyEmailResponse>, AppError> {
    let token_hash = hash_token(body.token.trim());

    // Capability table (no RLS) — resolve the token globally.
    let row: Option<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT tenant_id, user_id FROM email_verification_tokens \
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;
    let Some((tenant_id, user_id)) = row else {
        return Err(AppError::BadRequest(
            "This verification link is invalid or has expired".to_owned(),
        ));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    sqlx::query("UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE email_verification_tokens SET used_at = now() WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    Ok(Json(VerifyEmailResponse { verified: true }))
}

/// POST /api/auth/resend-verification (authenticated) — re-send the verify
/// email to the signed-in user; no-op if already verified.
pub async fn resend(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: axum::http::HeaderMap,
) -> Result<Json<VerifyEmailResponse>, AppError> {
    let (email, verified): (String, bool) =
        sqlx::query_as("SELECT email, email_verified FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_one(&state.db)
            .await?;
    if verified {
        return Ok(Json(VerifyEmailResponse { verified: true }));
    }

    let verify_base = verify_base_from_headers(&headers);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    issue(&mut tx, claims.tenant_id, claims.sub, &email, &verify_base).await?;
    tx.commit().await?;

    Ok(Json(VerifyEmailResponse { verified: false }))
}

/// Email verification routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/auth/verify-email",
            post(verify_email),
        )
        .route(
            "/api/auth/resend-verification",
            post(resend),
        )
}
