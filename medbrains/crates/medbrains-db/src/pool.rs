use sqlx::{PgPool, Postgres, Transaction, postgres::PgPoolOptions};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("migration error: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
}

/// Create a `PostgreSQL` connection pool with sensible defaults.
pub async fn create_pool(database_url: &str) -> Result<PgPool, DbError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(database_url)
        .await?;

    tracing::info!("PostgreSQL connection pool established");
    Ok(pool)
}

/// Run embedded `SQLx` migrations.
pub async fn run_migrations(pool: &PgPool) -> Result<(), DbError> {
    sqlx::migrate!("src/migrations").run(pool).await?;
    tracing::info!("Database migrations applied");
    Ok(())
}

/// Set the tenant context for Row-Level Security within a transaction.
/// This ensures RLS applies to the correct connection, not a random pool connection.
pub async fn set_tenant_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
) -> Result<(), DbError> {
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Set both tenant and department context for RLS.
///
/// Sets `app.tenant_id` for tenant isolation and `app.user_department_ids`
/// for department-scoped policies. Pass an empty slice for bypass roles
/// (no department restriction).
pub async fn set_full_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
    department_ids: &[uuid::Uuid],
) -> Result<(), DbError> {
    set_tenant_context(tx, tenant_id).await?;

    let dept_str = if department_ids.is_empty() {
        String::new()
    } else {
        let parts: Vec<String> = department_ids.iter().map(ToString::to_string).collect();
        format!("{{{}}}", parts.join(","))
    };

    sqlx::query("SELECT set_config('app.user_department_ids', $1::text, true)")
        .bind(&dept_str)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Set the user context for audit triggers within a transaction.
/// Sets `app.user_id` and optionally `app.ip_address` so the
/// `audit_trigger_func()` can attribute changes to the right user.
pub async fn set_user_context(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &uuid::Uuid,
    ip_address: Option<&str>,
) -> Result<(), DbError> {
    sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
        .bind(user_id.to_string())
        .execute(&mut **tx)
        .await?;

    if let Some(ip) = ip_address {
        sqlx::query("SELECT set_config('app.ip_address', $1::text, true)")
            .bind(ip)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

/// Set full audit context for a transaction: tenant, user, and IP.
///
/// This is the recommended way to start any write transaction. It sets:
/// - `app.tenant_id` for Row-Level Security
/// - `app.user_id` for audit trigger attribution
/// - `app.ip_address` for audit trail (optional)
///
/// Call this immediately after `pool.begin()` before any INSERT/UPDATE/DELETE.
pub async fn set_audit_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
    user_id: &uuid::Uuid,
    ip_address: Option<&str>,
) -> Result<(), DbError> {
    set_tenant_context(tx, tenant_id).await?;
    set_user_context(tx, user_id, ip_address).await?;
    Ok(())
}

/// Simple health check — runs `SELECT 1`.
pub async fn health_check(pool: &PgPool) -> Result<bool, DbError> {
    let row: (i32,) = sqlx::query_as("SELECT 1").fetch_one(pool).await?;
    Ok(row.0 == 1)
}
