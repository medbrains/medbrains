//! Hospital-wide facts `GET /api/auth/me` tells every user: whether copying
//! out of the app is restricted, and whether the hospital can send email.
//!
//! The "verify your email" banner asks the user to click a link in a message.
//! A hospital with no sender configured never sends one (the outbox runs the
//! email as a stub), so the banner asked for something impossible on every
//! screen. The sender needs a from-address, from the hospital's email settings
//! (`tenant_settings` `email`/`config`) or the server's `EMAIL_FROM_ADDRESS`
//! secret, the same two places `medbrains-outbox` reads it from.

use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::error::AppError;
use sqlx::PgConnection;
use uuid::Uuid;

/// Is a from-address set in this hospital's email settings?
async fn email_configured(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    let set = sqlx::query_scalar!(
        r#"SELECT COALESCE(btrim(value ->> 'from_address'), '') <> '' AS "set!" FROM tenant_settings
         WHERE tenant_id = $1 AND category = 'email' AND key = 'config' AND deleted_at IS NULL"#,
        tenant_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(set.unwrap_or(false))
}

/// Can the hospital send email: its own from-address, else the server's
/// `EMAIL_FROM_ADDRESS` secret. An unreadable secret store counts as "can
/// send", so a hiccup shows the banner as before rather than hiding it.
pub(crate) async fn email_can_send(configured: bool, secrets: &dyn SecretResolver) -> bool {
    if configured {
        return true;
    }
    match secrets.get("EMAIL_FROM_ADDRESS").await {
        Ok(value) => !value.trim().is_empty(),
        Err(medbrains_core::secrets::SecretError::NotFound(_)) => false,
        Err(_) => true,
    }
}

/// The hospital restricts copying data out of the app (`security.restrict_copy`).
async fn restrict_copy(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM tenant_settings WHERE tenant_id = $1
         AND category = 'security' AND key = 'restrict_copy'
         AND value IN ('true'::jsonb, '"true"'::jsonb)) AS "restricted!""#,
        tenant_id
    )
    .fetch_one(conn)
    .await?)
}

/// Both settings `me` reads in its transaction: copy restriction, email configured.
pub(crate) async fn read(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<(bool, bool), AppError> {
    Ok((
        restrict_copy(&mut *conn, tenant_id).await?,
        email_configured(conn, tenant_id).await?,
    ))
}
