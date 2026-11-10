//! The past day a dashboard is read for, and how a count tile reads it.
//!
//! "As of" names a day on the hospital's own calendar. A tile that can say
//! what was true at the end of that day answers for it; a tile that can only
//! say what is true now stays live and says so on the screen, rather than
//! printing today's figure under last January's date.

use chrono::{DateTime, NaiveDate, Utc};

use medbrains_server_core::error::AppError;

/// One hospital-local day, as the instants it starts and ends.
#[derive(Clone, Copy, Debug)]
pub(super) struct DayWindow {
    pub(super) date: NaiveDate,
    pub(super) start: DateTime<Utc>,
    pub(super) end: DateTime<Utc>,
}

/// The window for `as_of` when it is a day already over in the tenant's time
/// zone; `None` for no date, today, or a day still to come — all read live.
pub(super) async fn past_day(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    as_of: Option<NaiveDate>,
) -> Result<Option<DayWindow>, AppError> {
    let Some(date) = as_of else {
        return Ok(None);
    };
    let (start, end, past): (DateTime<Utc>, DateTime<Utc>, bool) = sqlx::query_as(
        "SELECT timezone(z, $1::date::timestamp), timezone(z, ($1::date + 1)::timestamp), \
                $1::date < timezone(z, now())::date \
           FROM (SELECT COALESCE(timezone, 'UTC') AS z FROM tenants \
                  WHERE id = app_current_tenant()) t",
    )
    .bind(date)
    .fetch_one(&mut **tx)
    .await?;
    Ok(past.then_some(DayWindow { date, start, end }))
}

/// The predicate that counts `(table, filter)` as it stood at the end of a
/// past day, over `w.day` (date) and `w.day_end` (instant). `None` for a
/// count with no history to read — it stays live.
pub(super) fn sql_count_as_of(table: &str, filter: Option<&str>) -> Option<&'static str> {
    Some(match (table, filter) {
        ("patients", None) => "created_at < w.day_end",
        (
            "encounters",
            Some("encounter_type = 'opd' AND encounter_date = tenant_local_date(tenant_id, now())"),
        ) => "encounter_type = 'opd' AND encounter_date = w.day",
        // In a bed at the end of the day: admitted by then, and either still
        // in or discharged after it.
        ("admissions", Some("status = 'admitted'")) => {
            "admitted_at < w.day_end \
             AND ((discharged_at IS NULL AND status::text = 'admitted') \
                  OR discharged_at >= w.day_end)"
        }
        // ponytail: no "processing started" time is kept, so an order still
        // processing today is left out of every past day; add one if that
        // gap shows on a real day.
        ("lab_orders", Some("status IN ('ordered','sample_collected')")) => {
            "created_at < w.day_end AND deleted_at IS NULL \
             AND (status::text IN ('ordered', 'sample_collected') \
                  OR COALESCE(completed_at, verified_at) >= w.day_end)"
        }
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::sql_count_as_of;

    #[test]
    fn the_default_count_tiles_can_be_read_for_a_past_day() {
        for (table, filter) in [
            ("patients", None),
            (
                "encounters",
                Some(
                    "encounter_type = 'opd' AND encounter_date = tenant_local_date(tenant_id, now())",
                ),
            ),
            ("admissions", Some("status = 'admitted'")),
            (
                "lab_orders",
                Some("status IN ('ordered','sample_collected')"),
            ),
        ] {
            assert!(
                sql_count_as_of(table, filter).is_some(),
                "{table} {filter:?}"
            );
        }
    }

    #[test]
    fn a_count_with_no_history_stays_live() {
        assert_eq!(sql_count_as_of("invoices", None), None);
        assert_eq!(
            sql_count_as_of("patients", Some("status = 'admitted'")),
            None
        );
    }
}
