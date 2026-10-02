//! Management KPIs: a day's figure, set against what is usual for that day.
//!
//! A bare number tells management nothing; the departure from normal does.
//! Each reading carries the day's value and three baselines — the same
//! weekday over the previous four weeks, yesterday, and the previous seven
//! days — plus the daily series behind them, so the tile can show the
//! comparison the viewer picked and the dates it came from.
//!
//! One bounded query per KPI returns the daily series for the 29 days ending
//! on the reading's date; the baselines are arithmetic over that series.
//! For today, counts are compared at the same local clock time on each
//! baseline day — 40 visits by 11:00 against usual full days would read as a
//! collapse every morning.
//!
//! A day with nothing to measure is `null`, never 0: no consultations means
//! no consultation time, not a zero-minute one.

use std::collections::BTreeMap;

use chrono::{Duration, NaiveDate, NaiveTime};
use serde::Serialize;
use serde_json::{Value, json};

use medbrains_server_core::error::AppError;

/// Days of history before the reading's date: four weeks covers the
/// same-weekday baseline, and the last seven are the week baseline.
const HISTORY_DAYS: i64 = 28;
/// Previous same-weekday days in the "usual" baseline.
const WEEKDAY_SAMPLES: i64 = 4;
/// Days in the week baseline.
const WEEK_DAYS: i64 = 7;

mod catalog;

pub use catalog::Better;
use catalog::{Shape, kpi};

/// Numerator over denominator for the seven days ending on each day.
///
/// Days `from..=to`, times `per` (100 for a rate, 1 for a mean), from daily
/// counts that start six days before `from`. A window with no denominator is
/// unknown, not 0.
pub fn rolling_rates(
    counts: &BTreeMap<NaiveDate, (f64, f64)>,
    from: NaiveDate,
    to: NaiveDate,
    per: f64,
) -> BTreeMap<NaiveDate, f64> {
    from.iter_days()
        .take_while(|d| *d <= to)
        .filter_map(|day| {
            let (num, den) = counts
                .range(day - Duration::days(WEEK_DAYS - 1)..=day)
                .fold((0.0, 0.0), |(n, d), (_, (a, b))| (n + a, d + b));
            (den > 0.0).then(|| (day, per * num / den))
        })
        .collect()
}

/// The day's value and its baselines, from a daily series.
#[derive(Debug, PartialEq, Serialize)]
pub struct Baselines {
    pub value: Option<f64>,
    /// Mean of the previous four same weekdays.
    pub weekday: Option<f64>,
    pub yesterday: Option<f64>,
    /// Mean of the previous seven days.
    pub week: Option<f64>,
}

fn mean(values: impl Iterator<Item = Option<f64>>) -> Option<f64> {
    let known: Vec<f64> = values.flatten().collect();
    #[allow(clippy::cast_precision_loss)] // at most four weeks of days
    let n = known.len() as f64;
    (!known.is_empty()).then(|| known.iter().sum::<f64>() / n)
}

/// Baselines for `as_of` from a series keyed by day. Missing days are zero for
/// counts and unknown for everything else.
pub fn baselines(
    series: &BTreeMap<NaiveDate, f64>,
    as_of: NaiveDate,
    zero_fill: bool,
) -> Baselines {
    let at = |days_back: i64| {
        let day = as_of - Duration::days(days_back);
        series
            .get(&day)
            .copied()
            .or_else(|| zero_fill.then_some(0.0))
    };
    Baselines {
        value: at(0),
        weekday: mean((1..=WEEKDAY_SAMPLES).map(|w| at(w * WEEK_DAYS))),
        yesterday: at(1),
        week: mean((1..=WEEK_DAYS).map(at)),
    }
}

/// `{value, unit, better, as_of, baselines, series}` for one KPI, or the
/// "could not load" shape for a code this resolver does not know.
pub async fn reading(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    params: &Value,
    as_of: Option<NaiveDate>,
) -> Result<Value, AppError> {
    let code = params
        .get("code")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let Some(kpi) = kpi(code) else {
        tracing::warn!(code, "management KPI widget names an unknown KPI");
        return Ok(json!({ "error": "unavailable" }));
    };
    let (zone, today, now): (String, NaiveDate, NaiveTime) = sqlx::query_as(
        "SELECT z, timezone(z, now())::date, timezone(z, now())::time FROM ( \
           SELECT COALESCE(timezone, 'UTC') AS z FROM tenants \
            WHERE id = current_setting('app.tenant_id')::uuid) t",
    )
    .fetch_one(&mut **tx)
    .await?;
    let as_of = as_of.unwrap_or(today).min(today);
    let cutoff = (as_of == today).then_some(now);
    let from = as_of - Duration::days(HISTORY_DAYS);

    let series = if kpi.shape == Shape::Daily {
        let mut query = sqlx::query_as::<_, (NaiveDate, Option<f64>)>(kpi.sql)
            .bind(from)
            .bind(as_of);
        if kpi.clock {
            query = query.bind(&zone).bind(cutoff);
        }
        let rows = query.fetch_all(&mut **tx).await?;
        rows.into_iter()
            .filter_map(|(d, v)| v.map(|v| (d, v)))
            .collect()
    } else {
        let mut query = sqlx::query_as::<_, (NaiveDate, f64, f64)>(kpi.sql)
            .bind(from - Duration::days(WEEK_DAYS - 1))
            .bind(as_of);
        if kpi.clock {
            query = query.bind(&zone);
        }
        let counts = query.fetch_all(&mut **tx).await?;
        let counts = counts.into_iter().map(|(d, n, t)| (d, (n, t))).collect();
        let per = if kpi.shape == Shape::Rate { 100.0 } else { 1.0 };
        rolling_rates(&counts, from, as_of, per)
    };
    let b = baselines(&series, as_of, kpi.zero_fill);
    let daily: Vec<Value> = (0..=HISTORY_DAYS)
        .rev()
        .map(|back| {
            let day = as_of - Duration::days(back);
            let value = series
                .get(&day)
                .copied()
                .or_else(|| kpi.zero_fill.then_some(0.0));
            json!({ "date": day, "value": value })
        })
        .collect();
    Ok(json!({
        "value": b.value,
        "unit": kpi.unit,
        "better": kpi.better,
        "as_of": as_of,
        "so_far": cutoff.is_some(),
        "baselines": { "weekday": b.weekday, "yesterday": b.yesterday, "week": b.week },
        "series": daily,
    }))
}

#[cfg(test)]
mod tests {
    use super::{Baselines, baselines, rolling_rates};
    use chrono::NaiveDate;
    use std::collections::BTreeMap;

    fn day(d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, d).unwrap_or_default()
    }

    #[test]
    fn counts_fill_missing_days_with_zero_and_average_same_weekdays() {
        // Tuesday 29 Sep; previous Tuesdays 22, 15, 8, 1 Sep.
        let series = BTreeMap::from([
            (day(29), 40.0),
            (day(22), 30.0),
            (day(15), 50.0),
            (day(28), 10.0),
        ]);
        let b = baselines(&series, day(29), true);
        assert_eq!(b.value, Some(40.0));
        assert_eq!(
            b.weekday,
            Some(20.0),
            "(30 + 50 + 0 + 0) / 4 — a closed day counts"
        );
        assert_eq!(b.yesterday, Some(10.0));
        assert_eq!(b.week, Some((10.0 + 30.0) / 7.0));
    }

    #[test]
    fn measures_leave_unmeasured_days_unknown() {
        let series = BTreeMap::from([(day(22), 12.0), (day(15), 18.0)]);
        let b = baselines(&series, day(29), false);
        assert_eq!(
            b,
            Baselines {
                value: None,
                weekday: Some(15.0),
                yesterday: None,
                week: Some(12.0)
            },
            "no consultations is no wait time, not a zero-minute one"
        );
    }

    #[test]
    fn rates_roll_over_seven_days_and_an_empty_week_is_unknown() {
        // 1 of 2 visits coded on the 20th, 3 of 4 on the 25th, none after.
        let counts = BTreeMap::from([(day(20), (1.0, 2.0)), (day(25), (3.0, 4.0))]);
        let rates = rolling_rates(&counts, day(24), day(30), 100.0);
        assert_eq!(
            rates.get(&day(24)),
            Some(&50.0),
            "only the 20th is in 18th–24th"
        );
        assert_eq!(
            rates.get(&day(26)),
            Some(&(400.0 / 6.0)),
            "20th–26th holds both"
        );
        assert_eq!(
            rates.get(&day(27)),
            Some(&75.0),
            "21st–27th has only the 25th"
        );
        assert_eq!(
            rates.get(&day(30)),
            Some(&75.0),
            "24th–30th still has the 25th"
        );
        let quiet = rolling_rates(&BTreeMap::new(), day(24), day(30), 100.0);
        assert!(
            quiet.is_empty(),
            "a week with no visits has no rate, not 0%"
        );
    }
}
