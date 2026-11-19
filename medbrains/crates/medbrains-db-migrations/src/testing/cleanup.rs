//! Clearing up after test runs: old templates, copies a crashed run left
//! behind, and the name check that keeps either from touching a database this
//! module did not create.

use std::time::{SystemTime, UNIX_EPOCH};

use sqlx::{Executor, PgConnection};

use super::{TestDbError, fail};

/// Templates kept for other worktrees' migration sets; older ones are dropped.
const KEEP_TEMPLATES: usize = 3;
/// A copy older than this belongs to a run that died; no test runs an hour.
const STALE_COPY_SECS: u64 = 3600;

/// Drop templates beyond the newest few (by OID, which only grows).
///
/// Not `FORCE`: a template another run is copying right now makes the drop
/// wait or fail, and failing is fine — it goes next time.
pub(super) async fn trim_templates(admin: &mut PgConnection) -> Result<(), TestDbError> {
    let old = sqlx::query_scalar!(
        r#"SELECT datname::text AS "n!" FROM pg_database
            WHERE datname LIKE 'mb\_tpl\_%' ORDER BY oid DESC OFFSET $1"#,
        i64::try_from(KEEP_TEMPLATES).unwrap_or(i64::MAX)
    )
    .fetch_all(&mut *admin)
    .await
    .map_err(fail("list templates"))?;
    for name in old.into_iter().filter(|n| is_ours(n)) {
        let _ = admin
            .execute(sqlx::raw_sql(&format!(
                "DROP DATABASE IF EXISTS \"{name}\""
            )))
            .await;
    }
    Ok(())
}

/// Drop copies a crashed run left behind. Not `FORCE`, so a copy somebody is
/// still connected to survives however old its name says it is.
pub(super) async fn sweep_stale_copies(admin: &mut PgConnection) -> Result<(), TestDbError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let copies = sqlx::query_scalar!(
        r#"SELECT datname::text AS "n!" FROM pg_database WHERE datname LIKE 'mb\_t\_%'"#
    )
    .fetch_all(&mut *admin)
    .await
    .map_err(fail("list copies"))?;
    for name in copies
        .into_iter()
        .filter(|n| is_ours(n) && is_stale(n, now))
    {
        let _ = admin
            .execute(sqlx::raw_sql(&format!(
                "DROP DATABASE IF EXISTS \"{name}\""
            )))
            .await;
    }
    Ok(())
}

/// Whether `name` is one this module generates (`^mb_(t|tpl)_[0-9a-z_]+$`),
/// and so safe to format into DDL. Anything else on the server is not ours.
pub(super) fn is_ours(name: &str) -> bool {
    let rest = name
        .strip_prefix("mb_tpl_")
        .or_else(|| name.strip_prefix("mb_t_"));
    rest.is_some_and(|r| {
        !r.is_empty()
            && r.bytes()
                .all(|b| b.is_ascii_digit() || b.is_ascii_lowercase() || b == b'_')
    })
}

/// Whether a copy's name says it is older than [`STALE_COPY_SECS`]. A name
/// that does not parse is not ours to judge, so it is left alone.
pub(super) fn is_stale(name: &str, now: u64) -> bool {
    name.strip_prefix("mb_t_")
        .and_then(|rest| rest.split('_').next())
        .and_then(|secs| secs.parse::<u64>().ok())
        .is_some_and(|secs| now.saturating_sub(secs) > STALE_COPY_SECS)
}
