//! The hospital's timezone on a connection, so `CURRENT_DATE`, `now()::date`
//! and `timestamptz::date` follow the hospital's business day, not the
//! database server's. Set per transaction by `pool::set_tenant_context` and
//! per session by `pool::tenant_conn` (the pool resets it on release).

use sqlx::PgConnection;

use crate::pool::DbError;

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

/// The process-wide set of timezone names, read from `pg_timezone_names` on
/// first use and served from [`VALID_TIMEZONES`] after that.
async fn valid_timezones(
    tx: &mut PgConnection,
) -> Result<&'static std::collections::HashSet<String>, DbError> {
    if let Some(set) = VALID_TIMEZONES.get() {
        return Ok(set);
    }
    let names: Vec<String> = sqlx::query_scalar("SELECT name FROM pg_timezone_names")
        .fetch_all(&mut *tx)
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

/// Set the hospital's timezone on `conn`: for its transaction when `local`,
/// else for the session (a `tenant_conn`, reset on release by the pool).
pub(crate) async fn apply(
    conn: &mut PgConnection,
    tenant_id: &uuid::Uuid,
    local: bool,
) -> Result<(), DbError> {
    // Read fresh every time (a cheap primary-key lookup) so a changed timezone
    // takes effect at once; only the list of valid names is cached.
    let raw: Option<String> = sqlx::query_scalar("SELECT timezone FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?
        .flatten();
    let zone = resolve_timezone(raw, valid_timezones(conn).await?);
    let _ = sqlx::query(
        "SELECT set_config('app.tenant_timezone', $1, $2), set_config('TimeZone', $1, $2)",
    )
    .bind(&zone)
    .bind(local)
    .fetch_optional(&mut *conn)
    .await?;

    Ok(())
}

#[cfg(test)]
mod timezone_tests {
    use super::{DEFAULT_TIMEZONE, resolve_timezone};
    use std::collections::HashSet;

    /// A small stand-in for `pg_timezone_names`: three zones the tests name.
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
