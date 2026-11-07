//! The per-account password lockout, shared by sign-in and step-up.
//!
//! One counter per account: five wrong passwords, at sign-in or at a
//! signature's step-up, lock the account for fifteen minutes. Separate counters
//! would give a guesser who holds an open session (a ward computer left signed
//! in) five free guesses at step-up on top of five at sign-in, and step-up had
//! no limit at all. Every failure is audited, not only the lock.

use uuid::Uuid;

use crate::{error::AppError, state::AppState};

/// Wrong passwords before the account locks.
pub const MAX_FAILED_PASSWORDS: i32 = 5;
/// How long a locked account stays locked.
pub const LOCKOUT_MINUTES: i32 = 15;

/// Whether the account is locked right now.
///
/// # Errors
/// The database could not be read.
pub async fn is_locked(
    state: &AppState,
    (user_id, tenant_id): (Uuid, Uuid),
) -> Result<bool, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT locked_until IS NOT NULL AND locked_until > now() FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&mut *conn)
    .await?
    .unwrap_or(false))
}

/// Count a wrong password, lock the account at the threshold, and audit it.
///
/// `action` names where it happened (`login_failed`, `step_up_failed`);
/// `account_locked` is audited as well when this failure locks the account.
///
/// # Errors
/// The database could not be written.
pub async fn record_failed_password(
    state: &AppState,
    (user_id, tenant_id): (Uuid, Uuid),
    ip: Option<&str>,
    action: &str,
) -> Result<bool, AppError> {
    let now_locked: bool = sqlx::query_scalar(
        "UPDATE users SET \
           failed_login_attempts = CASE WHEN locked_until <= now() THEN 1 \
             ELSE failed_login_attempts + 1 END, \
           locked_until = CASE \
             WHEN locked_until <= now() THEN NULL \
             WHEN failed_login_attempts + 1 >= $2 \
             THEN now() + make_interval(mins => $3) \
             ELSE locked_until END \
         WHERE id = $1 \
         RETURNING failed_login_attempts >= $2",
    )
    .bind(user_id)
    .bind(MAX_FAILED_PASSWORDS)
    .bind(LOCKOUT_MINUTES)
    .fetch_one(&mut *medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?)
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let locked_too = ["account_locked"];
    let actions = std::iter::once(action).chain(locked_too.iter().copied().filter(|_| now_locked));
    for action in actions {
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id,
                user_id: Some(user_id),
                action,
                entity_type: "user",
                entity_id: Some(user_id),
                old_values: None,
                new_values: None,
                ip_address: ip,
            },
        )
        .await
        .map_err(AppError::from)?;
    }
    tx.commit().await?;
    if now_locked {
        tracing::warn!(%user_id, action, "account locked after repeated wrong passwords");
    }
    Ok(now_locked)
}

/// Clear the count after a right password, as sign-in does.
///
/// Without it, wrong passwords spread over a day would add up to a lock even
/// though the person kept getting it right in between.
///
/// # Errors
/// The database could not be written.
pub async fn clear_failed_passwords(
    state: &AppState,
    (user_id, tenant_id): (Uuid, Uuid),
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL \
         WHERE id = $1 AND (failed_login_attempts > 0 OR locked_until IS NOT NULL)",
    )
    .bind(user_id)
    .execute(&mut *medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?)
    .await?;
    Ok(())
}
