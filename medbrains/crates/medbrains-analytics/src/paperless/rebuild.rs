//! One recount of a window of days for one hospital, inside the caller's
//! unit of work.
//!
//! The statement timeout is set before any lock is taken, so a recount never
//! waits on a lock without a limit. Only one recount of a hospital runs at a
//! time: a second answers 409 at once rather than queueing behind the first.
//! Each source runs in its own savepoint: one that fails or runs past the
//! timeout is rolled back alone and recorded as "could not count" on the days
//! it covered, never failing the rest of the hospital's recount and never read
//! as zero.

use chrono::NaiveDate;
use medbrains_documents::signable::SIGNABLE;
use medbrains_kernel::Tx;
use medbrains_server_core::error::AppError;
use uuid::Uuid;

use super::{Rebuilt, clock, columns, route, sources};

/// Every statement in a recount stops after this.
const STATEMENT_TIMEOUT: &str = "60s";
/// What a source whose statement failed is recorded as.
const COULD_NOT_COUNT: &str = "could not count (the count failed or ran out of time)";

/// The window one recount covers: tenant, first and last day, time zone.
type Window<'a> = (Uuid, NaiveDate, NaiveDate, &'a str);

/// Run one counting statement for the window into `paperless_daily` in its
/// own savepoint: the rows written, or `None` (logged) when it failed and was
/// rolled back alone.
async fn insert_counts(
    tx: &mut Tx,
    sql: &str,
    window: Window<'_>,
    record_type: Option<&str>,
) -> Result<Option<u64>, AppError> {
    let sql = format!(
        "INSERT INTO paperless_daily \
           (tenant_id, day, department_id, doc_type, created, signed, scanned, printed) {sql}"
    );
    let (tenant, from, to, zone) = window;
    sqlx::query("SAVEPOINT paperless_source")
        .execute(&mut **tx)
        .await?;
    let mut query = sqlx::query(&sql)
        .bind(tenant)
        .bind(from)
        .bind(to)
        .bind(zone);
    if let Some(t) = record_type {
        query = query.bind(t);
    }
    match query.execute(&mut **tx).await {
        Ok(done) => {
            sqlx::query("RELEASE SAVEPOINT paperless_source")
                .execute(&mut **tx)
                .await?;
            Ok(Some(done.rows_affected()))
        }
        Err(error) => {
            tracing::warn!(%error, %tenant, record_type, "paperless meter could not count a source");
            sqlx::query("ROLLBACK TO SAVEPOINT paperless_source")
                .execute(&mut **tx)
                .await?;
            Ok(None)
        }
    }
}

/// Take the hospital's recount lock without waiting.
///
/// # Errors
/// `Conflict` (409) while another recount of this hospital runs.
async fn lock(tx: &mut Tx, tenant: Uuid) -> Result<(), AppError> {
    sqlx::query(&format!(
        "SET LOCAL statement_timeout = '{STATEMENT_TIMEOUT}'"
    ))
    .execute(&mut **tx)
    .await?;
    let locked: bool = sqlx::query_scalar(
        "SELECT pg_try_advisory_xact_lock(hashtextextended('analytics.paperless:' || $1, 0))",
    )
    .bind(tenant.to_string())
    .fetch_one(&mut **tx)
    .await?;
    if locked {
        Ok(())
    } else {
        Err(AppError::Conflict(
            "A recount is already running. Try again when it finishes.".to_owned(),
        ))
    }
}

/// Count every source for days `from..=to` of the transaction's hospital,
/// replacing what the window held, and mark the days counted with what could
/// not be.
pub(super) async fn rebuild(
    tx: &mut Tx,
    tenant: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Rebuilt, AppError> {
    lock(tx, tenant).await?;
    let (zone, _) = clock(tx, tenant).await?;
    let cols = columns(tx).await?;
    sqlx::query("DELETE FROM paperless_daily WHERE tenant_id = $1 AND day BETWEEN $2 AND $3")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .execute(&mut **tx)
        .await?;
    let window = (tenant, from, to, zone.as_str());
    let mut rows = 0;
    let mut skipped = Vec::new();
    for spec in SIGNABLE {
        let counted = match route::signable_statement(spec, &cols) {
            Ok(sql) => insert_counts(tx, &sql, window, Some(spec.record_type))
                .await?
                .ok_or(COULD_NOT_COUNT),
            Err(unfit) => {
                tracing::warn!(
                    record_type = spec.record_type,
                    reason = unfit.reason(),
                    "paperless meter skipped a signable type"
                );
                Err(unfit.reason())
            }
        };
        match counted {
            Ok(n) => rows += n,
            Err(reason) => skipped.push(format!("{}: {reason}", spec.label)),
        }
    }
    for (label, sql) in [
        ("Clinical notes", sources::CLINICAL_NOTES),
        ("Case sheets scanned", sources::CASE_SHEET_SCANS),
        ("First prints", sources::FIRST_PRINTS),
    ] {
        match insert_counts(tx, sql, window, None).await? {
            Some(n) => rows += n,
            None => skipped.push(format!("{label}: {COULD_NOT_COUNT}")),
        }
    }
    mark_counted(tx, window, &skipped).await?;
    Ok(Rebuilt {
        from,
        to,
        rows,
        skipped,
    })
}

/// Record the window's days as counted now, with the sources that were not,
/// so a day with no documents reads as none rather than as never measured.
async fn mark_counted(tx: &mut Tx, window: Window<'_>, skipped: &[String]) -> Result<(), AppError> {
    let (tenant, from, to, _) = window;
    sqlx::query(
        "INSERT INTO paperless_days (tenant_id, day, not_counted) \
         SELECT $1, d::date, $4 FROM generate_series($2::date, $3::date, INTERVAL '1 day') d \
         ON CONFLICT (tenant_id, day) \
         DO UPDATE SET computed_at = now(), not_counted = EXCLUDED.not_counted",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .bind(skipped)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
