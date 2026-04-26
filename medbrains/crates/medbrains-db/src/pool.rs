use std::{str::FromStr, time::Duration};

use log::LevelFilter;
use sqlx::{
    ConnectOptions, PgPool, Postgres, Transaction,
    postgres::{PgConnectOptions, PgPoolOptions},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("migration error: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
}

#[derive(Debug, Clone)]
pub struct PoolConfig {
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout: Duration,
    pub idle_timeout: Duration,
    pub max_lifetime: Duration,
    pub statement_cache_capacity: usize,
    pub slow_statement_threshold: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_connections: 20,
            min_connections: 2,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(600),
            max_lifetime: Duration::from_secs(1800),
            statement_cache_capacity: 256,
            slow_statement_threshold: Duration::from_millis(250),
        }
    }
}

/// Create a `PostgreSQL` connection pool with sensible defaults.
pub async fn create_pool(database_url: &str) -> Result<PgPool, DbError> {
    create_pool_with_config(database_url, &PoolConfig::default()).await
}

/// Create a `PostgreSQL` connection pool with explicit tuning knobs.
pub async fn create_pool_with_config(
    database_url: &str,
    config: &PoolConfig,
) -> Result<PgPool, DbError> {
    let connect_options = PgConnectOptions::from_str(database_url)?
        .application_name("medbrains-server")
        .statement_cache_capacity(config.statement_cache_capacity)
        .log_slow_statements(LevelFilter::Warn, config.slow_statement_threshold);

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(config.acquire_timeout)
        .idle_timeout(Some(config.idle_timeout))
        .max_lifetime(Some(config.max_lifetime))
        .connect_with(connect_options)
        .await?;

    tracing::info!(
        max_connections = config.max_connections,
        min_connections = config.min_connections,
        idle_timeout_secs = config.idle_timeout.as_secs(),
        max_lifetime_secs = config.max_lifetime.as_secs(),
        statement_cache_capacity = config.statement_cache_capacity,
        slow_statement_ms = config.slow_statement_threshold.as_millis(),
        "PostgreSQL connection pool established"
    );
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
    apply_context(tx, Some(tenant_id), None, None, None, None, None).await
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
    let dept_str = format_department_context(department_ids);
    apply_context(
        tx,
        Some(tenant_id),
        Some(dept_str.as_str()),
        None,
        None,
        None,
        None,
    )
    .await
}

/// Set the user context for audit triggers within a transaction.
/// Sets `app.user_id` and optionally `app.ip_address` so the
/// `audit_trigger_func()` can attribute changes to the right user.
pub async fn set_user_context(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &uuid::Uuid,
    ip_address: Option<&str>,
) -> Result<(), DbError> {
    apply_context(tx, None, None, Some(user_id), ip_address, None, None).await
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
    apply_context(
        tx,
        Some(tenant_id),
        None,
        Some(user_id),
        ip_address,
        None,
        None,
    )
    .await
}

/// Set extended audit context including user agent and session ID.
///
/// Superset of `set_audit_context` — additionally sets:
/// - `app.user_agent` for browser/client identification in audit entries
/// - `app.session_id` for correlating actions within a single session
pub async fn set_extended_audit_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
    user_id: &uuid::Uuid,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    session_id: Option<&str>,
) -> Result<(), DbError> {
    apply_context(
        tx,
        Some(tenant_id),
        None,
        Some(user_id),
        ip_address,
        user_agent,
        session_id,
    )
    .await
}

/// Simple health check — runs `SELECT 1`.
pub async fn health_check(pool: &PgPool) -> Result<bool, DbError> {
    let row: (i32,) = sqlx::query_as("SELECT 1").fetch_one(pool).await?;
    Ok(row.0 == 1)
}

fn format_department_context(department_ids: &[uuid::Uuid]) -> String {
    if department_ids.is_empty() {
        String::new()
    } else {
        let parts: Vec<String> = department_ids.iter().map(ToString::to_string).collect();
        format!("{{{}}}", parts.join(","))
    }
}

async fn apply_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Option<&uuid::Uuid>,
    department_ids: Option<&str>,
    user_id: Option<&uuid::Uuid>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    session_id: Option<&str>,
) -> Result<(), DbError> {
    let _ = sqlx::query(
        "SELECT \
            CASE WHEN $1::text IS NOT NULL \
                THEN set_config('app.tenant_id', $1::text, true) ELSE NULL END, \
            CASE WHEN $2::text IS NOT NULL \
                THEN set_config('app.user_department_ids', $2::text, true) ELSE NULL END, \
            CASE WHEN $3::text IS NOT NULL \
                THEN set_config('app.user_id', $3::text, true) ELSE NULL END, \
            CASE WHEN $4::text IS NOT NULL \
                THEN set_config('app.ip_address', $4::text, true) ELSE NULL END, \
            CASE WHEN $5::text IS NOT NULL \
                THEN set_config('app.user_agent', $5::text, true) ELSE NULL END, \
            CASE WHEN $6::text IS NOT NULL \
                THEN set_config('app.session_id', $6::text, true) ELSE NULL END",
    )
    .bind(tenant_id.map(ToString::to_string))
    .bind(department_ids)
    .bind(user_id.map(ToString::to_string))
    .bind(ip_address)
    .bind(user_agent)
    .bind(session_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(())
}
