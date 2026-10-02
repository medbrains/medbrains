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

/// Which way a KPI should move. A colour on the tile follows this, never the
/// raw direction: wait time rising is bad, visits rising is neither.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Better {
    Lower,
    Higher,
    Neutral,
}

struct Kpi {
    unit: &'static str,
    better: Better,
    /// A day with no rows is a true zero (visits), not an unknown (wait time).
    zero_fill: bool,
    /// Whether the query takes `$3` (tenant time zone) and `$4` (optional
    /// local clock cut-off) to compare today with earlier days fairly.
    clock: bool,
    /// A rate over the seven days ending each day, from `(day, numerator,
    /// denominator)` rows — a day's documentation rate swings 33 points on a
    /// doctor with three visits; a week's does not.
    rolling: bool,
    /// `(day date, value float8)` rows for days `$1..=$2`, or for a rolling
    /// KPI `(day date, numerator float8, denominator float8)`.
    sql: &'static str,
}

/// OPD visits that count towards documentation: not cancelled. `$1..=$2`.
/// A macro, not a const, so `concat!` can build each query at compile time.
macro_rules! opd_visits {
    () => {
        " FROM encounters e \
          WHERE e.encounter_type = 'opd' AND e.deleted_at IS NULL \
            AND e.status::text <> 'cancelled' AND e.encounter_date BETWEEN $1 AND $2"
    };
}

fn kpi(code: &str) -> Option<Kpi> {
    Some(match code {
        "opd_visits" => Kpi {
            unit: "visits",
            better: Better::Neutral,
            zero_fill: true,
            clock: true,
            rolling: false,
            sql: "SELECT encounter_date AS day, COUNT(*)::float8 AS value \
                  FROM encounters \
                  WHERE encounter_type = 'opd' AND deleted_at IS NULL \
                    AND encounter_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, created_at)::time <= $4) \
                  GROUP BY encounter_date",
        },
        "opd_wait_minutes" => Kpi {
            unit: "min",
            better: Better::Lower,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT token_date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM called_at - created_at)) / 60.0)::float8 \
                      AS value \
                  FROM tokens \
                  WHERE module = 'opd' AND called_at IS NOT NULL \
                    AND token_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, called_at)::time <= $4) \
                  GROUP BY token_date",
        },
        "opd_consult_minutes" => Kpi {
            unit: "min",
            better: Better::Neutral,
            zero_fill: false,
            clock: true,
            rolling: false,
            sql: "SELECT token_date AS day, \
                    (percentile_cont(0.5) WITHIN GROUP \
                      (ORDER BY EXTRACT(EPOCH FROM completed_at - called_at)) / 60.0)::float8 \
                      AS value \
                  FROM tokens \
                  WHERE module = 'opd' AND called_at IS NOT NULL AND completed_at IS NOT NULL \
                    AND token_date BETWEEN $1 AND $2 \
                    AND ($4::time IS NULL OR timezone($3, completed_at)::time <= $4) \
                  GROUP BY token_date",
        },
        // Of appointments whose outcome is known: one still scheduled for
        // later today is neither kept nor missed yet.
        "appointment_no_show_pct" => Kpi {
            unit: "%",
            better: Better::Lower,
            zero_fill: false,
            clock: false,
            rolling: false,
            sql: "SELECT appointment_date AS day, \
                    (100.0 * COUNT(*) FILTER (WHERE status::text = 'no_show') \
                      / NULLIF(COUNT(*) FILTER (WHERE status::text IN \
                          ('checked_in', 'in_consultation', 'completed', 'no_show')), 0))::float8 \
                      AS value \
                  FROM appointments \
                  WHERE deleted_at IS NULL AND appointment_date BETWEEN $1 AND $2 \
                  GROUP BY appointment_date",
        },
        "coded_diagnosis_pct" => Kpi {
            unit: "%",
            better: Better::Higher,
            zero_fill: false,
            clock: false,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, COUNT(*) FILTER (WHERE EXISTS ( \
                   SELECT 1 FROM diagnoses d WHERE d.encounter_id = e.id \
                     AND d.deleted_at IS NULL AND d.icd_code IS NOT NULL))::float8, \
                 COUNT(*)::float8",
                opd_visits!(),
                " GROUP BY e.encounter_date"
            ),
        },
        // A complete note says why the patient came and what was found.
        "complete_note_pct" => Kpi {
            unit: "%",
            better: Better::Higher,
            zero_fill: false,
            clock: false,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, COUNT(*) FILTER (WHERE EXISTS ( \
                   SELECT 1 FROM consultations c WHERE c.encounter_id = e.id \
                     AND c.deleted_at IS NULL AND btrim(COALESCE(c.chief_complaint, '')) <> '' \
                     AND (btrim(COALESCE(c.examination, '')) <> '' \
                          OR COALESCE(c.physical_examination, '{}'::jsonb) <> '{}'::jsonb)))::float8, \
                 COUNT(*)::float8",
                opd_visits!(),
                " GROUP BY e.encounter_date"
            ),
        },
        // Of visits from days already over: today's are open because the
        // clinic is.
        "visits_left_open_pct" => Kpi {
            unit: "%",
            better: Better::Lower,
            zero_fill: false,
            clock: false,
            rolling: true,
            sql: concat!(
                "SELECT e.encounter_date, \
                 COUNT(*) FILTER (WHERE e.status::text <> 'completed')::float8, COUNT(*)::float8",
                opd_visits!(),
                " AND e.encounter_date < (SELECT timezone(COALESCE(t.timezone, 'UTC'), now())::date \
                    FROM tenants t WHERE t.id = current_setting('app.tenant_id')::uuid) \
                 GROUP BY e.encounter_date"
            ),
        },
        _ => return None,
    })
}

/// The rate over the seven days ending on each day `from..=to`, from daily
/// `(numerator, denominator)` counts that start six days before `from`. A
/// window with no denominator is unknown, not 0%.
pub fn rolling_rates(
    counts: &BTreeMap<NaiveDate, (f64, f64)>,
    from: NaiveDate,
    to: NaiveDate,
) -> BTreeMap<NaiveDate, f64> {
    from.iter_days()
        .take_while(|d| *d <= to)
        .filter_map(|day| {
            let (num, den) = counts
                .range(day - Duration::days(WEEK_DAYS - 1)..=day)
                .fold((0.0, 0.0), |(n, d), (_, (a, b))| (n + a, d + b));
            (den > 0.0).then(|| (day, 100.0 * num / den))
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

    let series = if kpi.rolling {
        let counts: Vec<(NaiveDate, f64, f64)> = sqlx::query_as(kpi.sql)
            .bind(from - Duration::days(WEEK_DAYS - 1))
            .bind(as_of)
            .fetch_all(&mut **tx)
            .await?;
        let counts = counts.into_iter().map(|(d, n, t)| (d, (n, t))).collect();
        rolling_rates(&counts, from, as_of)
    } else {
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
        let rates = rolling_rates(&counts, day(24), day(30));
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
        let quiet = rolling_rates(&BTreeMap::new(), day(24), day(30));
        assert!(
            quiet.is_empty(),
            "a week with no visits has no rate, not 0%"
        );
    }
}
