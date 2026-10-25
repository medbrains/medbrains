//! Dates the model asks for by name. It never sees a real date (the redactor
//! turns dates into offsets), so a `call_api` path says `[TODAY]` or
//! `[LAST_30_DAYS]` and the server writes the real values in.
//!
//! | placeholder      | becomes                                   |
//! |------------------|-------------------------------------------|
//! | `[TODAY]`        | `2026-10-25`                              |
//! | `[DAYS_AGO_n]`   | the date n days before today (n ≤ 366)    |
//! | `[LAST_7_DAYS]`  | `from=<today-6>&to=<today>`               |
//! | `[LAST_30_DAYS]` | `from=<today-29>&to=<today>`              |
//! | `[THIS_MONTH]`   | `from=<1st of this month>&to=<today>`     |
//! | `[LAST_MONTH]`   | `from=<1st of last month>&to=<its last day>` |

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(clippy::redundant_pub_crate, reason = "unreachable_pub is denied workspace-wide")]

use chrono::{Datelike as _, Days, NaiveDate};

/// Longest look-back `[DAYS_AGO_n]` accepts.
const MAX_DAYS_AGO: u64 = 366;
/// Placeholders per path; a path is short.
const MAX_PLACEHOLDERS: usize = 8;

/// What the model writes in the tool's description, kept in one place.
pub(super) const HELP: &str = "Dates: write [TODAY] or [DAYS_AGO_n] for one date, and \
    [LAST_7_DAYS], [LAST_30_DAYS], [THIS_MONTH] or [LAST_MONTH] for a from/to range \
    (e.g. /api/billing/reports/daily-revenue?[LAST_30_DAYS]); the server fills them in.";

fn ymd(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn range(from: NaiveDate, to: NaiveDate) -> String {
    format!("from={}&to={}", ymd(from), ymd(to))
}

/// The value of one placeholder name (without brackets), if it is one.
fn resolve(name: &str, today: NaiveDate) -> Option<String> {
    let back = |n: u64| today.checked_sub_days(Days::new(n));
    let first = today.with_day(1)?;
    match name {
        "TODAY" => Some(ymd(today)),
        "LAST_7_DAYS" => Some(range(back(6)?, today)),
        "LAST_30_DAYS" => Some(range(back(29)?, today)),
        "THIS_MONTH" => Some(range(first, today)),
        "LAST_MONTH" => {
            let end = first.pred_opt()?;
            Some(range(end.with_day(1)?, end))
        }
        other => {
            let n: u64 = other.strip_prefix("DAYS_AGO_")?.parse().ok()?;
            (n <= MAX_DAYS_AGO).then(|| back(n).map(ymd)).flatten()
        }
    }
}

/// `path` with every known placeholder replaced; unknown brackets stay as
/// written (the endpoint then refuses them, and the model is told).
pub(super) fn fill(path: &str, today: NaiveDate) -> String {
    let mut out = String::with_capacity(path.len() + 24);
    let mut rest = path;
    for _ in 0..MAX_PLACEHOLDERS {
        let Some(open) = rest.find('[') else { break };
        let Some(close) = rest[open..].find(']').map(|c| open + c) else {
            break;
        };
        out.push_str(&rest[..open]);
        match resolve(&rest[open + 1..close], today) {
            Some(value) => out.push_str(&value),
            None => out.push_str(&rest[open..=close]),
        }
        rest = &rest[close + 1..];
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::fill;
    use chrono::NaiveDate;

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, 25).unwrap_or_default()
    }

    #[test]
    fn single_dates_and_ranges_are_filled_by_the_server() {
        let t = today();
        assert_eq!(fill("/r?date=[TODAY]", t), "/r?date=2026-10-25");
        assert_eq!(fill("/r?date=[DAYS_AGO_1]", t), "/r?date=2026-10-24");
        assert_eq!(
            fill("/r?[LAST_7_DAYS]", t),
            "/r?from=2026-10-19&to=2026-10-25"
        );
        assert_eq!(
            fill("/r?[LAST_30_DAYS]", t),
            "/r?from=2026-09-26&to=2026-10-25"
        );
        assert_eq!(
            fill("/r?[THIS_MONTH]", t),
            "/r?from=2026-10-01&to=2026-10-25"
        );
        assert_eq!(
            fill("/r?[LAST_MONTH]", t),
            "/r?from=2026-09-01&to=2026-09-30"
        );
    }

    #[test]
    fn anything_else_is_left_as_written() {
        let t = today();
        assert_eq!(fill("/api/patients/1", t), "/api/patients/1");
        assert_eq!(fill("/r?x=[PATIENT_1]", t), "/r?x=[PATIENT_1]");
        assert_eq!(
            fill("/r?date=[DAYS_AGO_9999]", t),
            "/r?date=[DAYS_AGO_9999]"
        );
        assert_eq!(fill("/r?date=[TODAY", t), "/r?date=[TODAY");
    }

    #[test]
    fn last_month_crosses_a_year() {
        let jan = NaiveDate::from_ymd_opt(2027, 1, 10).unwrap_or_default();
        assert_eq!(fill("?[LAST_MONTH]", jan), "?from=2026-12-01&to=2026-12-31");
    }
}
