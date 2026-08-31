//! Team invites. An admin invites a colleague by email; the colleague follows
//! a link, sets a username + password, and the account is created with
//! `email_verified = true` (the invite proves they own the email).
//!
//! The token table is a pre-auth capability table (no RLS); admin list/revoke
//! filter by tenant_id explicitly, the public accept resolves the token
//! globally then sets the tenant RLS context for the user INSERT. Only the
//! SHA-256 hash of the token is stored.

use axum::routing::{delete,get,post};
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHasher};
use axum::extract::{Path, State};
use axum::{Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::validation::{self, ValidationErrors};
use medbrains_server_core::{error::AppError, state::AppState};
use medbrains_core::permissions;

const INVITE_TTL_DAYS: i64 = 7;
const USER_ROLES: &[&str] = &[
    "super_admin",
    "hospital_admin",
    "doctor",
    "nurse",
    "receptionist",
    "lab_technician",
    "pharmacist",
    "billing_clerk",
    "housekeeping_staff",
    "facilities_manager",
    "audit_officer",
];

fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

fn accept_base(headers: &axum::http::HeaderMap) -> String {
    headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(axum::http::header::HOST))
        .and_then(|v| v.to_str().ok())
        .map_or_else(
            || "https://localhost".to_owned(),
            |host| format!("https://{}", host.split(':').next().unwrap_or(host)),
        )
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InvitationRow {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub full_name: Option<String>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub email: String,
    pub role: String,
    pub full_name: Option<String>,
}

/// POST /api/admin/invitations
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: axum::http::HeaderMap,
    Json(body): Json<CreateInviteRequest>,
) -> Result<Json<InvitationRow>, AppError> {
    require_permission(&claims, permissions::admin::users::CREATE)?;

    let email = body.email.trim().to_lowercase();
    let mut errors = ValidationErrors::new();
    validation::validate_email(&mut errors, "email", &email);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }
    let role = body.role.trim();
    if !USER_ROLES.contains(&role) {
        return Err(AppError::BadRequest(format!("Unknown role '{role}'")));
    }

    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("rng: {e}")))?;
    let raw = hex::encode(buf);
    let token_hash = hash_token(&raw);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(INVITE_TTL_DAYS);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, InvitationRow>(
        "INSERT INTO user_invitations \
         (tenant_id, email, role, full_name, token_hash, invited_by, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, email, role, full_name, expires_at, created_at",
    )
    .bind(claims.tenant_id)
    .bind(&email)
    .bind(role)
    .bind(&body.full_name)
    .bind(&token_hash)
    .bind(claims.sub)
    .bind(expires_at)
    .fetch_one(&mut *tx)
    .await?;

    let link = format!("{}/accept-invite?token={raw}", accept_base(&headers));
    let html = format!(
        "<p>You've been invited to join MedBrains.</p>\
         <p>Set up your account: <a href=\"{link}\">Accept invitation</a></p>\
         <p>This invitation expires in {INVITE_TTL_DAYS} days.</p>"
    );
    let text = format!("You've been invited to join MedBrains. Accept: {link}");
    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "user",
            aggregate_id: Some(row.id),
            event_type: "email.invite",
            payload: json!({
                "to": email,
                "subject": "You're invited to MedBrains",
                "html": html,
                "text": text,
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("queue invite email: {e}")))?;

    tx.commit().await?;
    Ok(Json(row))
}

/// GET /api/admin/invitations — pending invites for the tenant.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InvitationRow>>, AppError> {
    require_permission(&claims, permissions::admin::users::LIST)?;
    let rows = sqlx::query_as::<_, InvitationRow>(
        "SELECT id, email, role, full_name, expires_at, created_at FROM user_invitations \
         WHERE tenant_id = $1 AND accepted_at IS NULL ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// DELETE /api/admin/invitations/{id}
pub async fn revoke(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::users::CREATE)?;
    sqlx::query(
        "DELETE FROM user_invitations WHERE id = $1 AND tenant_id = $2 AND accepted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&state.db)
    .await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Debug, Serialize)]
pub struct PublicInvite {
    pub email: String,
    pub role: String,
    pub full_name: Option<String>,
    pub hospital_name: String,
}

/// GET /api/public/invitations/{token} — show who/where the invite is for.
pub async fn get_public(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicInvite>, AppError> {
    let token_hash = hash_token(token.trim());
    let row: Option<(String, String, Option<String>, Uuid)> = sqlx::query_as(
        "SELECT email, role, full_name, tenant_id FROM user_invitations \
         WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;
    let Some((email, role, full_name, tenant_id)) = row else {
        return Err(AppError::BadRequest(
            "This invitation is invalid or has expired".to_owned(),
        ));
    };
    let hospital_name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(PublicInvite {
        email,
        role,
        full_name,
        hospital_name,
    }))
}

#[derive(Debug, Deserialize)]
pub struct AcceptInviteRequest {
    pub username: String,
    pub password: String,
    pub full_name: Option<String>,
}

/// POST /api/public/invitations/{token}/accept — create the account.
pub async fn accept(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<AcceptInviteRequest>,
) -> Result<Json<Value>, AppError> {
    let token_hash = hash_token(token.trim());
    let mut errors = ValidationErrors::new();
    validation::validate_username(&mut errors, "username", &body.username);
    validation::validate_password(&mut errors, "password", &body.password);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let invite: Option<(Uuid, String, String, Option<String>)> = sqlx::query_as(
        "SELECT tenant_id, email, role, full_name FROM user_invitations \
         WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;
    let Some((tenant_id, email, role, invite_name)) = invite else {
        return Err(AppError::BadRequest(
            "This invitation is invalid or has expired".to_owned(),
        ));
    };
    let full_name = body
        .full_name
        .filter(|n| !n.trim().is_empty())
        .or(invite_name)
        .unwrap_or_else(|| body.username.clone());

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash: {e}")))?
        .to_string();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // Invited email is proven → email_verified = true.
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role, email_verified) \
         VALUES ($1, $2, $3, $4, $5, $6::user_role, true)",
    )
    .bind(tenant_id)
    .bind(body.username.trim())
    .bind(&email)
    .bind(&password_hash)
    .bind(&full_name)
    .bind(&role)
    .execute(&mut *tx)
    .await
    .map_err(|_| {
        AppError::BadRequest("That username or email is already taken".to_owned())
    })?;
    sqlx::query("UPDATE user_invitations SET accepted_at = now() WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    Ok(Json(json!({ "status": "ok" })))
}

/// Invitation routes reachable without a JWT.
///
/// Someone accepting an invitation has no account yet, so these cannot sit
/// behind the auth layer. They are gated by the single-use token in the path.
pub fn public_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/public/invitations/{token}", get(get_public))
        .route("/api/public/invitations/{token}/accept", post(accept))
}

/// Invitation routes that require an authenticated administrator.
///
/// These must be merged into the protected router. Mounted on the public one
/// they never receive the `Claims` extension their handlers extract, and Axum
/// rejects every call with a 500 before the permission check is ever reached —
/// which is how issuing an invitation, and with it creating a user, stayed
/// broken for everyone.
pub fn admin_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/admin/invitations", get(list).post(create))
        .route("/api/admin/invitations/{id}", delete(revoke))
}
