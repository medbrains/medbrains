//! Persistence for workflow automation.
//!
//! Seven tables, all of them tenant-scoped and none of them referenced by the
//! clinical schema — see `0978_automation.sql` and `0980_automation_state.sql`. Every read and write sets the
//! RLS context first, so a query that loses its tenant returns nothing instead
//! of somebody else's data.
//!
//! Credential data arrives already sealed by the engine. Nothing in this crate
//! can decrypt it, which keeps the key out of the storage layer entirely.

pub mod credentials;
pub mod executions;
pub mod runtime;
pub mod workflows;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("stored automation data is not readable: {0}")]
    Corrupt(String),
}

pub type Result<T> = std::result::Result<T, StoreError>;

/// Set the tenant context for a transaction.
///
/// Every entry point in this crate calls this before touching a table. It is
/// not a convenience: without it RLS has nothing to compare against and the
/// policies reject the row.
pub(crate) async fn scope_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &uuid::Uuid,
) -> Result<()> {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}
