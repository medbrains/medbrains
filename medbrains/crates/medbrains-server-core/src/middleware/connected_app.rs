//! Signing a connected app in: OAuth 2.0 client credentials (RFC-HOSPITAL-OS C1).
//!
//! A vendor app presents a `client_id` and a client secret to the token
//! endpoint. This is the identity half of that exchange, kept next to
//! [`super::api_key`] because it is the same kind of decision — who is this
//! machine, and which hospital is it in — made before any tenant is known.
//!
//! What it settles, and nothing more:
//!
//! * the secret is checked against an **Argon2** hash. Unlike an API key it is
//!   presented once per token, not once per request, so a slow hash costs the
//!   app nothing and costs a thief with a stolen database everything;
//! * an unknown client id still pays for one hash, so timing does not say
//!   which ids exist;
//! * only an **approved** app gets through. A pending or revoked app with the
//!   right secret is told so — the secret proves it is the vendor asking — and
//!   anything else is `invalid_client` with no detail.
//!
//! Minting the token is the caller's job, inside a kernel unit of work.

use std::fmt;
use std::fmt::Write as _;
use std::sync::LazyLock;

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Recognisable on sight in a log or a repository, like `mb_live_`.
pub const CLIENT_ID_PREFIX: &str = "mbapp_";
pub const SECRET_PREFIX: &str = "mbcs_";
const SECRET_BYTES: usize = 32;
const VISIBLE_CHARS: usize = 11;

/// A freshly generated client secret. The secret exists only here.
pub struct ClientSecret {
    /// Shown to the registering admin once, never stored.
    pub secret: String,
    /// Stored in the clear, for display.
    pub prefix: String,
    /// Argon2 PHC string. What a presented secret is verified against.
    pub hash: String,
}

// Deriving Debug would print a live credential from any log line that
// formats the struct.
impl fmt::Debug for ClientSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ClientSecret")
            .field("prefix", &self.prefix)
            .field("secret", &"<redacted>")
            .field("hash", &"<redacted>")
            .finish()
    }
}

fn random_hex(bytes: usize) -> Result<String, AppError> {
    let mut buf = vec![0_u8; bytes];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("entropy: {e}")))?;
    Ok(buf
        .iter()
        .fold(String::with_capacity(bytes * 2), |mut out, b| {
            let _ = write!(out, "{b:02x}");
            out
        }))
}

/// A new public client identifier: `mbapp_` + 24 hex characters.
///
/// # Errors
/// If the system entropy source fails.
pub fn new_client_id() -> Result<String, AppError> {
    Ok(format!("{CLIENT_ID_PREFIX}{}", random_hex(12)?))
}

/// A new client secret and its Argon2 hash.
///
/// # Errors
/// If the entropy source or the hasher fails.
pub fn new_client_secret() -> Result<ClientSecret, AppError> {
    let secret = format!("{SECRET_PREFIX}{}", random_hex(SECRET_BYTES)?);
    let hash = hash_secret(&secret)?;
    let prefix = secret.chars().take(VISIBLE_CHARS).collect();
    Ok(ClientSecret {
        secret,
        prefix,
        hash,
    })
}

fn hash_secret(secret: &str) -> Result<String, AppError> {
    Ok(Argon2::default()
        .hash_password(secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hash: {e}")))?
        .to_string())
}

/// Constant-work verification. A malformed stored hash verifies nothing.
fn verify_secret(presented: &str, stored: &str) -> bool {
    PasswordHash::new(stored).is_ok_and(|parsed| {
        Argon2::default()
            .verify_password(presented.as_bytes(), &parsed)
            .is_ok()
    })
}

/// Spent on an unknown client id so it costs the same as a known one.
static DUMMY_HASH: LazyLock<String> =
    LazyLock::new(|| hash_secret("mbcs_timing_equaliser").unwrap_or_default());

/// The app behind a verified exchange.
#[derive(Debug, Clone)]
pub struct AppCredential {
    pub app_id: Uuid,
    pub tenant_id: Uuid,
    pub service_user_id: Uuid,
    pub name: String,
    /// The app's grant: exactly its manifest's permissions.
    pub permissions: Vec<String>,
}

/// The answer to "may this client have a token".
#[derive(Debug)]
pub enum Exchange {
    Granted(AppCredential),
    /// Unknown id or wrong secret. Never says which.
    InvalidClient,
    /// Right secret, but the hospital has not approved it, or has revoked it.
    NotApproved(&'static str),
}

/// Verify a client id + secret.
///
/// # Errors
/// A database fault is an error, never an `InvalidClient`: an outage must not
/// read as "your credentials are wrong", or the vendor rotates a good secret.
pub async fn exchange(db: &PgPool, client_id: &str, secret: &str) -> Result<Exchange, AppError> {
    let row = sqlx::query!(
        r#"SELECT id AS "id!", tenant_id AS "tenant_id!",
                  client_secret_hash AS "client_secret_hash!", status AS "status!",
                  permissions AS "permissions!", service_user_id AS "service_user_id!",
                  name AS "name!"
             FROM public.app_connected_app_by_client_id($1)"#,
        client_id,
    )
    .fetch_optional(db)
    .await?;

    let stored = row
        .as_ref()
        .map_or_else(|| DUMMY_HASH.clone(), |r| r.client_secret_hash.clone());
    let presented = secret.to_owned();
    let matches = tokio::task::spawn_blocking(move || verify_secret(&presented, &stored))
        .await
        .map_err(|e| AppError::Internal(format!("verify: {e}")))?;

    let Some(row) = row.filter(|_| matches) else {
        return Ok(Exchange::InvalidClient);
    };
    match row.status.as_str() {
        "approved" => {}
        "pending" => return Ok(Exchange::NotApproved("awaiting the hospital's approval")),
        _ => return Ok(Exchange::NotApproved("revoked by the hospital")),
    }
    let permissions: Vec<String> = serde_json::from_value(row.permissions)
        .map_err(|e| AppError::Internal(format!("app permissions: {e}")))?;
    Ok(Exchange::Granted(AppCredential {
        app_id: row.id,
        tenant_id: row.tenant_id,
        service_user_id: row.service_user_id,
        name: row.name,
        permissions,
    }))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::{CLIENT_ID_PREFIX, SECRET_PREFIX, new_client_id, new_client_secret, verify_secret};

    #[test]
    fn a_secret_verifies_against_its_own_hash_only() {
        let a = new_client_secret().unwrap();
        let b = new_client_secret().unwrap();
        assert!(a.secret.starts_with(SECRET_PREFIX));
        assert!(a.hash.starts_with("$argon2"), "stored as Argon2");
        assert!(verify_secret(&a.secret, &a.hash));
        assert!(!verify_secret(&b.secret, &a.hash));
        assert!(
            !verify_secret(&a.prefix, &a.hash),
            "the prefix is not enough"
        );
        assert!(!verify_secret(&a.secret, "not a hash"));
    }

    #[test]
    fn client_ids_are_prefixed_and_distinct() {
        let a = new_client_id().unwrap();
        assert!(a.starts_with(CLIENT_ID_PREFIX));
        assert_eq!(a.len(), CLIENT_ID_PREFIX.len() + 24);
        assert_ne!(a, new_client_id().unwrap());
    }

    #[test]
    fn the_secret_never_appears_in_debug_output() {
        let s = new_client_secret().unwrap();
        let rendered = format!("{s:?}");
        assert!(!rendered.contains(&s.secret));
        assert!(!rendered.contains(&s.hash));
        assert!(rendered.contains(&s.prefix));
    }
}
