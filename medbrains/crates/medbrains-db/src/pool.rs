use std::{str::FromStr, time::Duration};

use log::LevelFilter;
use sqlx::{
    ConnectOptions, Executor, PgPool, Postgres, Transaction,
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

/// So code that speaks `sqlx::Error` (workers, pipelines) can take a
/// [`tenant_conn`] or [`set_tenant_context`] with `?`.
impl From<DbError> for sqlx::Error {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlx(e) => e,
            DbError::Migrate(e) => Self::Migrate(Box::new(e)),
        }
    }
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
            min_connections: 5,
            acquire_timeout: Duration::from_secs(2),
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
        // Clear the request's identity before the connection is reused.
        //
        // Without this, a session-level `app.tenant_id` outlives the request
        // that set it and is inherited by whoever gets the connection next.
        // That is worse than having no context at all: no context returns
        // nothing and is obvious, while a stale one returns another hospital's
        // rows and looks entirely normal.
        //
        // `RESET` rather than setting an empty string, so a connection that
        // has never carried a tenant and one that has are indistinguishable.
        //
        // NOT `sqlx::query`: this is eight statements in one string, and
        // `query` carries an (empty) argument list, which sends it down the
        // extended/prepared path - and Postgres refuses multiple commands
        // there: "cannot insert multiple commands into a prepared statement".
        //
        // sqlx picks the protocol on whether `take_arguments()` yields `Some`,
        // NOT on `persistent()`. `raw_sql` and a bare `&str` both yield `None`
        // and both reach the simple protocol, so either is correct here;
        // `raw_sql` says so out loud. `query` yields `Some` and is the trap.
        //
        // This took production down on 2026-09-01. The error propagates out of
        // `after_release`, so sqlx discards the connection on *every* release:
        // the pool never has a spare, every acquire waits out the full timeout,
        // and the service reports itself degraded while Postgres sits there
        // idle with this RESET chain as every connection's last statement.
        // `tests/tenant_conn.rs` pins it — a discarded connection changes
        // `pg_backend_pid()`.
        .after_release(|conn, _meta| {
            Box::pin(async move {
                conn.execute(sqlx::raw_sql(
                    "RESET app.tenant_id; \
                     RESET app.scope; \
                     RESET app.user_id; \
                     RESET app.user_department_ids; \
                     RESET app.ip_address; \
                     RESET app.user_agent; \
                     RESET app.session_id; \
                     RESET app.correlation_id",
                ))
                .await?;
                Ok(true)
            })
        })
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

/// A pooled connection carrying this tenant's identity for as long as it is
/// held.
///
/// The reason this exists: `set_config(..., true)` is transaction-local, so
/// the context every handler sets applies only inside its own transaction. A
/// query run straight on the pool — `.fetch_all(pool)` — carries no tenant at
/// all, and under row level security returns nothing. Not an error, not a
/// warning: an empty list, which reads as "this hospital has no patients".
///
/// So a read that is not already inside a scoped transaction takes one of
/// these instead of the pool, and stays correct whether row level security is
/// enforced or not.
///
/// Safe because the pool resets `app.*` when the connection is released — see
/// `create_pool_with_config`. Without that, this would leak one request's
/// tenant into the next.
pub async fn tenant_conn(
    pool: &PgPool,
    tenant_id: &uuid::Uuid,
) -> Result<sqlx::pool::PoolConnection<Postgres>, DbError> {
    let mut conn = pool.acquire().await?;
    // `false` — session level. A transaction-local setting would expire at the
    // end of the first statement, which is exactly the bug this avoids.
    sqlx::query("SELECT set_config('app.tenant_id', $1, false)")
        .bind(tenant_id.to_string())
        .execute(&mut *conn)
        .await?;
    Ok(conn)
}

/// A connection scoped to the caller's whole hospital group.
///
/// For the screens that are about the group rather than about a hospital:
/// who works where, the group's drug master, how its hospitals compare. A
/// group exists because those are shared — that is what makes it a group —
/// so this does not consult the clinical sharing switch. Whether a clinician
/// at one location may read a chart written at another is a different
/// question with its own answer.
///
/// Use [`tenant_conn`] for everything else, including anything touching a
/// patient's record.
///
/// This is not the access control. The permission check in front of the
/// handler is; this only stops row level security from contradicting a query
/// that was already allowed to be group-wide. Reach is bounded by the
/// database, which holds one hospital group.
pub async fn group_conn(
    pool: &PgPool,
    tenant_id: &uuid::Uuid,
) -> Result<sqlx::pool::PoolConnection<Postgres>, DbError> {
    let mut conn = tenant_conn(pool, tenant_id).await?;
    sqlx::query("SELECT set_config('app.scope', 'group', false)")
        .execute(&mut *conn)
        .await?;
    Ok(conn)
}

// run_migrations moved to the medbrains-db-migrations crate.
//
// sqlx::migrate! embeds the migration directory at compile time, so keeping
// it here meant every new .sql file recompiled this crate and all 109 that
// depend on it. 854 of this crate's 1,145 edits in six months were
// migrations; only 21 were Rust.

/// Set the tenant context for Row-Level Security within a transaction.
/// This ensures RLS applies to the correct connection, not a random pool connection.
///
/// Also sets the transaction-local `PostgreSQL` `TimeZone` from the tenant so
/// `CURRENT_DATE`, `now()::date`, and `timestamptz::date` follow the hospital
/// business day instead of the database server's timezone.
pub async fn set_tenant_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
) -> Result<(), DbError> {
    apply_context(tx, Some(tenant_id), None, None, None, None, None, None).await
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
        None,
    )
    .await
}

/// Sprint A.5: full per-request context including bypass-role flag.
///
/// Adds `app.bypass_dept_rls` to the standard context bundle so dept-RLS
/// policies can short-circuit for `super_admin` / `hospital_admin` without
/// requiring `department_ids` to be populated.
///
/// Caller responsibility: pass `bypass_dept_rls=true` when the user's
/// role is in `middleware::authorization::BYPASS_ROLES`.
pub async fn set_request_context_full(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
    department_ids: &[uuid::Uuid],
    user_id: &uuid::Uuid,
    bypass_dept_rls: bool,
    ip_address: Option<&str>,
) -> Result<(), DbError> {
    let dept_str = format_department_context(department_ids);
    let bypass_str = if bypass_dept_rls { "true" } else { "false" };
    apply_context(
        tx,
        Some(tenant_id),
        Some(dept_str.as_str()),
        Some(user_id),
        ip_address,
        None,
        None,
        Some(bypass_str),
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
    apply_context(tx, None, None, Some(user_id), ip_address, None, None, None).await
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
        None,
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

#[allow(clippy::too_many_arguments)]
async fn apply_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Option<&uuid::Uuid>,
    department_ids: Option<&str>,
    user_id: Option<&uuid::Uuid>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    session_id: Option<&str>,
    bypass_dept_rls: Option<&str>,
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
                THEN set_config('app.session_id', $6::text, true) ELSE NULL END, \
            CASE WHEN $7::text IS NOT NULL \
                THEN set_config('app.bypass_dept_rls', $7::text, true) ELSE NULL END, \
            CASE WHEN $8::text IS NOT NULL \
                THEN set_config('app.acting_agent', $8::text, true) ELSE NULL END",
    )
    .bind(tenant_id.map(ToString::to_string))
    .bind(department_ids)
    .bind(user_id.map(ToString::to_string))
    .bind(ip_address)
    .bind(user_agent)
    .bind(session_id)
    .bind(bypass_dept_rls)
    // The AI actor in scope, so rows the handler or the audit trigger writes in
    // this transaction default `acting_agent` to it (migration 1211).
    .bind(crate::audit::acting_agent().map(|a| a.to_string()))
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(id) = tenant_id {
        apply_tenant_timezone(tx, id).await?;
    }

    Ok(())
}

/// Fallback when a hospital has no timezone, or one PostgreSQL doesn't know.
const DEFAULT_TIMEZONE: &str = "Asia/Kolkata";

/// Every timezone name this PostgreSQL knows, read once per process.
///
/// `pg_timezone_names` reads the whole timezone database from disk (~600 rows);
/// checking a hospital's zone against it inside every transaction cost about
/// 16 ms per unit of work. The list only changes when PostgreSQL's tz data is
/// upgraded, which needs a restart, so one read per process is exact.
static VALID_TIMEZONES: tokio::sync::OnceCell<std::collections::HashSet<String>> =
    tokio::sync::OnceCell::const_new();

async fn valid_timezones(
    tx: &mut Transaction<'_, Postgres>,
) -> Result<&'static std::collections::HashSet<String>, DbError> {
    if let Some(set) = VALID_TIMEZONES.get() {
        return Ok(set);
    }
    let names: Vec<String> = sqlx::query_scalar("SELECT name FROM pg_timezone_names")
        .fetch_all(&mut **tx)
        .await?;
    Ok(VALID_TIMEZONES
        .get_or_init(|| async { names.into_iter().collect() })
        .await)
}

/// The zone to use: the hospital's own if PostgreSQL knows it, else the default.
fn resolve_timezone(raw: Option<String>, valid: &std::collections::HashSet<String>) -> String {
    raw.filter(|tz| !tz.is_empty() && valid.contains(tz))
        .unwrap_or_else(|| DEFAULT_TIMEZONE.to_owned())
}

async fn apply_tenant_timezone(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &uuid::Uuid,
) -> Result<(), DbError> {
    // Read fresh every time (a cheap primary-key lookup) so a changed timezone
    // takes effect at once; only the list of valid names is cached.
    let raw: Option<String> = sqlx::query_scalar("SELECT timezone FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .flatten();
    let zone = resolve_timezone(raw, valid_timezones(tx).await?);
    let _ = sqlx::query(
        "SELECT set_config('app.tenant_timezone', $1, true), set_config('TimeZone', $1, true)",
    )
    .bind(&zone)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(())
}

#[cfg(test)]
mod timezone_tests {
    use super::{DEFAULT_TIMEZONE, resolve_timezone};
    use std::collections::HashSet;

    fn zones() -> HashSet<String> {
        ["Asia/Kolkata", "Asia/Dubai", "UTC"]
            .iter()
            .map(|z| (*z).to_owned())
            .collect()
    }

    #[test]
    fn known_zone_is_kept() {
        assert_eq!(
            resolve_timezone(Some("Asia/Dubai".to_owned()), &zones()),
            "Asia/Dubai"
        );
    }

    #[test]
    fn missing_empty_or_unknown_zone_falls_back() {
        assert_eq!(resolve_timezone(None, &zones()), DEFAULT_TIMEZONE);
        assert_eq!(
            resolve_timezone(Some(String::new()), &zones()),
            DEFAULT_TIMEZONE
        );
        assert_eq!(
            resolve_timezone(Some("Mars/Olympus".to_owned()), &zones()),
            DEFAULT_TIMEZONE
        );
    }
}
