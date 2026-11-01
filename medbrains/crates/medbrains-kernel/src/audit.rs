//! Audit: one append-only, hash-chained log.
//!
//! Wraps `medbrains_db::audit::AuditLogger::log`. Verification stays with the
//! nightly job (`AuditLogger::verify_chain_for_tenant`, run from the server's
//! `audit verify-chain` command); its verdicts are read here from
//! `audit_chain_verifications`.

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::{AppError, Tx};

pub use medbrains_db::audit::AuditEntry;

/// Append `entry` to the tenant's chain inside the unit of work.
///
/// The tenant and actor come from the [`Tx`], not the entry: an entry naming
/// another hospital or another person is refused rather than written.
#[inline]
pub async fn audit(tx: &mut Tx, entry: &AuditEntry<'_>) -> Result<(), AppError> {
    let actor = tx.actor();
    if entry.tenant_id != actor.tenant_id || entry.user_id.is_some_and(|u| u != actor.user_id) {
        return Err(AppError::Forbidden);
    }
    Ok(medbrains_db::audit::AuditLogger::log(tx.transaction(), entry).await?)
}

/// The most recent completed chain verification for the tenant.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ChainVerdict {
    pub completed_at: Option<DateTime<Utc>>,
    pub valid: bool,
    pub rows_checked: i64,
    pub broken_at: Option<Uuid>,
}

/// Read the last verdict the nightly job wrote; `None` when the chain has
/// never been verified.
pub async fn last_verification(tx: &mut Tx) -> Result<Option<ChainVerdict>, AppError> {
    let tenant_id = tx.actor().tenant_id;
    let row = sqlx::query_as::<_, ChainVerdict>(
        "SELECT completed_at, valid, rows_checked, broken_at \
           FROM audit_chain_verifications \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
          ORDER BY started_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row)
}
