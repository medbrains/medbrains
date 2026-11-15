//! The zone prints are formatted in, with every offset change it has had.
//!
//! A single offset taken "now" is wrong for any timestamp on the other side
//! of a daylight-saving change (a London admission in January printed in
//! July). Postgres holds the zone rules, so the changes are read from it once
//! per zone per process and kept: each timestamp then gets its own offset.

use std::collections::HashMap;
use std::fmt;
use std::sync::{LazyLock, Mutex, PoisonError};

use chrono::{FixedOffset, LocalResult, NaiveDate, NaiveDateTime, Offset, TimeZone};

use medbrains_server_core::error::AppError;

/// `(from this UTC second, this offset in seconds)`, ascending; the first
/// entry starts at `i64::MIN`.
type Changes = &'static [(i64, i32)];

/// UTC: no changes.
const UTC_CHANGES: Changes = &[(i64::MIN, 0)];

/// A zone's offset history, `Copy` so every formatter can take it by value.
#[derive(Debug, Clone, Copy)]
pub struct PrintZone {
    changes: Changes,
}

/// The offset a [`PrintZone`] has at one instant.
#[derive(Debug, Clone, Copy)]
pub struct PrintOffset {
    zone: PrintZone,
    fixed: FixedOffset,
}

impl Offset for PrintOffset {
    fn fix(&self) -> FixedOffset {
        self.fixed
    }
}

impl fmt::Display for PrintOffset {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.fixed, f)
    }
}

impl PrintZone {
    /// UTC, for tests and documents with no zone of their own.
    #[must_use]
    pub const fn utc() -> Self {
        Self {
            changes: UTC_CHANGES,
        }
    }

    /// The offset in force at a UTC second: one binary search.
    fn offset_at(self, utc_secs: i64) -> PrintOffset {
        let i = self.changes.partition_point(|(from, _)| *from <= utc_secs);
        let secs = self.changes[i.saturating_sub(1)].1;
        PrintOffset {
            zone: self,
            // Zone offsets are always under a day; UTC if one ever is not.
            fixed: FixedOffset::east_opt(secs).unwrap_or_else(|| chrono::Utc.fix()),
        }
    }
}

impl TimeZone for PrintZone {
    type Offset = PrintOffset;

    fn from_offset(offset: &PrintOffset) -> Self {
        offset.zone
    }

    fn offset_from_local_date(&self, local: &NaiveDate) -> LocalResult<PrintOffset> {
        self.offset_from_local_datetime(&local.and_time(chrono::NaiveTime::MIN))
    }

    /// A wall-clock time: one offset, none (skipped by a spring change) or two
    /// (repeated by an autumn change, earliest first).
    fn offset_from_local_datetime(&self, local: &NaiveDateTime) -> LocalResult<PrintOffset> {
        let wall = local.and_utc().timestamp();
        let fits = |o: PrintOffset| {
            self.offset_at(wall - i64::from(o.fixed.local_minus_utc()))
                .fixed
                == o.fixed
        };
        let mut found: Vec<PrintOffset> =
            [self.offset_at(wall - 86_400), self.offset_at(wall + 86_400)]
                .into_iter()
                .filter(|o| fits(*o))
                .collect();
        found.dedup_by_key(|o| o.fixed);
        found.sort_by_key(|o| std::cmp::Reverse(o.fixed.local_minus_utc()));
        match found.as_slice() {
            [] => LocalResult::None,
            [one] => LocalResult::Single(*one),
            [first, second, ..] => LocalResult::Ambiguous(*first, *second),
        }
    }

    fn offset_from_utc_date(&self, utc: &NaiveDate) -> PrintOffset {
        self.offset_at(utc.and_time(chrono::NaiveTime::MIN).and_utc().timestamp())
    }

    fn offset_from_utc_datetime(&self, utc: &NaiveDateTime) -> PrintOffset {
        self.offset_at(utc.and_utc().timestamp())
    }
}

/// Every zone read so far. ponytail: each table is leaked once and kept for
/// the process; bounded by the zones tzdata has (about 600), a few KB each.
static ZONES: LazyLock<Mutex<HashMap<String, Changes>>> = LazyLock::new(Mutex::default);

/// The zone named `zone`, from the cache or from Postgres (daily samples
/// 1970–2040, refined to 15 minutes around each change).
///
/// # Errors
/// The database error; Postgres refuses a zone it does not know.
// `unreachable_pub` is denied workspace-wide; nursery asks for the opposite.
#[allow(clippy::redundant_pub_crate)]
pub(crate) async fn load(conn: &mut sqlx::PgConnection, zone: &str) -> Result<PrintZone, AppError> {
    if let Some(changes) = ZONES
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(zone)
    {
        return Ok(PrintZone { changes });
    }
    let rows = sqlx::query!(
        r#"WITH d AS (
             SELECT t, EXTRACT(EPOCH FROM (t AT TIME ZONE $1) - (t AT TIME ZONE 'UTC'))::int AS off
               FROM generate_series(timestamptz '1970-01-01 00:00Z', timestamptz '2040-01-01 00:00Z',
                                    interval '1 day') t),
           days AS (SELECT t, off, lag(off) OVER (ORDER BY t) AS prev FROM d),
           fine AS (
             SELECT h, EXTRACT(EPOCH FROM (h AT TIME ZONE $1) - (h AT TIME ZONE 'UTC'))::int AS off
               FROM days, generate_series(days.t - interval '1 day', days.t, interval '15 minutes') h
              WHERE days.prev IS NOT NULL AND days.prev <> days.off),
           steps AS (SELECT h, off, lag(off) OVER (ORDER BY h) AS prev FROM fine)
         SELECT NULL::bigint AS at, (SELECT off FROM d ORDER BY t LIMIT 1) AS off
         UNION ALL
         SELECT EXTRACT(EPOCH FROM h)::bigint, off FROM steps
          WHERE prev IS NOT NULL AND prev <> off"#,
        zone,
    )
    .fetch_all(conn)
    .await?;
    let mut changes: Vec<(i64, i32)> = rows
        .into_iter()
        .filter_map(|r| Some((r.at.unwrap_or(i64::MIN), r.off?)))
        .collect();
    changes.sort_unstable();
    changes.dedup();
    let changes: Changes = Box::leak(changes.into_boxed_slice());
    ZONES
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(zone.to_owned(), changes);
    Ok(PrintZone { changes })
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;

    /// London: GMT, BST from 2026-03-29 01:00 UTC.
    const LONDON: Changes = &[(i64::MIN, 0), (1_774_746_000, 3600)];

    #[test]
    fn each_timestamp_gets_its_own_offset() {
        let zone = PrintZone { changes: LONDON };
        let winter = Utc
            .with_ymd_and_hms(2026, 1, 10, 9, 0, 0)
            .single()
            .map(|t| t.with_timezone(&zone));
        let summer = Utc
            .with_ymd_and_hms(2026, 7, 10, 9, 0, 0)
            .single()
            .map(|t| t.with_timezone(&zone));
        assert_eq!(
            winter.map(|t| t.format("%H:%M").to_string()).as_deref(),
            Some("09:00")
        );
        assert_eq!(
            summer.map(|t| t.format("%H:%M").to_string()).as_deref(),
            Some("10:00")
        );
    }

    #[test]
    fn a_skipped_wall_time_has_no_offset_and_utc_never_changes() {
        let zone = PrintZone { changes: LONDON };
        let skipped = NaiveDate::from_ymd_opt(2026, 3, 29).and_then(|d| d.and_hms_opt(1, 30, 0));
        assert!(
            skipped
                .is_some_and(|t| matches!(zone.offset_from_local_datetime(&t), LocalResult::None))
        );
        let utc = PrintZone::utc().offset_from_utc_datetime(&NaiveDateTime::MIN);
        assert_eq!(utc.fix().local_minus_utc(), 0);
    }
}
