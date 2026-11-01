//! Weather and air quality for the hospital's own location, fetched by the
//! server from Open-Meteo (free, no key) so staff browsers never send theirs.
//!
//! **Heat** (India Meteorological Department heat-wave criteria, plains): a
//! heat wave is declared when the maximum reaches 45 °C, or 40 °C and 4.5 °C
//! above the normal; severe at 47 °C. We have no station normal, so a forecast
//! maximum of 40 °C is shown as *heat caution*, 45 °C as *heat wave* and 47 °C
//! as *severe heat wave*.
//!
//! **Air** (CPCB National Air Quality Index bands, µg/m³): PM2.5 good ≤ 30,
//! satisfactory ≤ 60, moderate ≤ 90, poor ≤ 120, very poor ≤ 250, severe above;
//! PM10 good ≤ 50, ≤ 100, ≤ 250, ≤ 350, ≤ 430, severe above. The worse of the
//! two is the band. The index is defined on 24-hour means; this is the current
//! hourly reading, and the screen says so. Poor or worse is an advisory.
//!
//! A reading older than two fetch intervals, or a last attempt that failed,
//! is **not available** — never shown as current.

use std::time::Duration;

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

/// The job's interval; a reading older than two of these is not current.
pub const FETCH_INTERVAL_SECS: i64 = 3600;
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
const AIR_URL: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";

const HEAT_CAUTION_C: f64 = 40.0;
const HEAT_WAVE_C: f64 = 45.0;
const SEVERE_HEAT_WAVE_C: f64 = 47.0;
const PM25_BANDS: [f64; 5] = [30.0, 60.0, 90.0, 120.0, 250.0];
const PM10_BANDS: [f64; 5] = [50.0, 100.0, 250.0, 350.0, 430.0];
const AQI_CATEGORIES: [&str; 6] = [
    "good",
    "satisfactory",
    "moderate",
    "poor",
    "very_poor",
    "severe",
];
/// Index into `AQI_CATEGORIES` from which an advisory is raised ("poor").
const AQI_ADVISORY_FROM: usize = 3;

/// One fetched reading.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Reading {
    pub temperature_c: Option<f64>,
    pub weather_code: Option<i32>,
    pub forecast_max_c: Option<f64>,
    pub forecast_max_on: Option<NaiveDate>,
    pub pm2_5: Option<f64>,
    pub pm10: Option<f64>,
}

#[derive(Deserialize)]
struct Forecast {
    current: ForecastNow,
    daily: Daily,
}
#[derive(Deserialize)]
struct ForecastNow {
    temperature_2m: Option<f64>,
    weather_code: Option<i32>,
}
#[derive(Deserialize)]
struct Daily {
    time: Vec<NaiveDate>,
    temperature_2m_max: Vec<Option<f64>>,
}
#[derive(Deserialize)]
struct Air {
    current: AirNow,
}
#[derive(Deserialize)]
struct AirNow {
    pm2_5: Option<f64>,
    pm10: Option<f64>,
}

fn hottest_day(daily: &Daily) -> (Option<f64>, Option<NaiveDate>) {
    daily
        .time
        .iter()
        .zip(&daily.temperature_2m_max)
        .filter_map(|(day, max)| max.map(|m| (m, *day)))
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map_or((None, None), |(m, d)| (Some(m), Some(d)))
}

/// Fetch weather (now + 3-day maximum) and air quality for one place.
///
/// # Errors
/// Any network, HTTP or parse failure, as text for the status line.
pub async fn fetch(lat: f64, lon: f64) -> Result<Reading, String> {
    let client = reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;
    let place = [
        ("latitude", lat.to_string()),
        ("longitude", lon.to_string()),
    ];
    let forecast: Forecast = client
        .get(FORECAST_URL)
        .query(&place)
        .query(&[
            ("current", "temperature_2m,weather_code"),
            ("daily", "temperature_2m_max"),
            ("forecast_days", "3"),
            ("timezone", "auto"),
        ])
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| format!("weather: {e}"))?
        .json()
        .await
        .map_err(|e| format!("weather: {e}"))?;
    let air: Air = client
        .get(AIR_URL)
        .query(&place)
        .query(&[("current", "pm2_5,pm10")])
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| format!("air quality: {e}"))?
        .json()
        .await
        .map_err(|e| format!("air quality: {e}"))?;
    let (forecast_max_c, forecast_max_on) = hottest_day(&forecast.daily);
    Ok(Reading {
        temperature_c: forecast.current.temperature_2m,
        weather_code: forecast.current.weather_code,
        forecast_max_c,
        forecast_max_on,
        pm2_5: air.current.pm2_5,
        pm10: air.current.pm10,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Advisory {
    /// `none`, `heat_caution`, `heat_wave`, `severe_heat_wave` for heat; the
    /// CPCB band (`good` … `severe`) for air.
    pub level: &'static str,
    /// Whether this needs attention (heat caution or worse; poor air or worse).
    pub is_advisory: bool,
}

pub fn heat_advisory(forecast_max_c: f64) -> Advisory {
    let level = if forecast_max_c >= SEVERE_HEAT_WAVE_C {
        "severe_heat_wave"
    } else if forecast_max_c >= HEAT_WAVE_C {
        "heat_wave"
    } else if forecast_max_c >= HEAT_CAUTION_C {
        "heat_caution"
    } else {
        "none"
    };
    Advisory {
        level,
        is_advisory: level != "none",
    }
}

fn band(value: f64, bands: &[f64; 5]) -> usize {
    bands.iter().take_while(|&&upper| value > upper).count()
}

pub fn air_advisory(pm2_5: Option<f64>, pm10: Option<f64>) -> Option<Advisory> {
    let worst = [
        pm2_5.map(|v| band(v, &PM25_BANDS)),
        pm10.map(|v| band(v, &PM10_BANDS)),
    ]
    .into_iter()
    .flatten()
    .max()?;
    Some(Advisory {
        level: AQI_CATEGORIES[worst.min(AQI_CATEGORIES.len() - 1)],
        is_advisory: worst >= AQI_ADVISORY_FROM,
    })
}

/// The stored row for a hospital: the last attempt and the last good reading.
#[derive(Debug, Clone, Default)]
pub struct Stored {
    pub attempted_at: Option<DateTime<Utc>>,
    pub ok_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub reading: Reading,
}

#[derive(Debug, Clone, Serialize)]
pub struct EnvironmentView {
    /// `current`, `not_available`, `off` (turned off in settings) or
    /// `no_location` (no coordinates on the hospital or a campus).
    pub status: &'static str,
    /// When the shown reading was taken; set only when `status = current`.
    pub as_of: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub last_good_at: Option<DateTime<Utc>>,
    pub reason: Option<String>,
    pub temperature_c: Option<f64>,
    pub weather_code: Option<i32>,
    pub forecast_max_c: Option<f64>,
    pub forecast_max_on: Option<NaiveDate>,
    pub pm2_5: Option<f64>,
    pub pm10: Option<f64>,
    pub heat: Option<Advisory>,
    pub air: Option<Advisory>,
}

impl EnvironmentView {
    const fn empty(status: &'static str, stored: &Stored, reason: Option<String>) -> Self {
        Self {
            status,
            as_of: None,
            last_attempt_at: stored.attempted_at,
            last_good_at: stored.ok_at,
            reason,
            temperature_c: None,
            weather_code: None,
            forecast_max_c: None,
            forecast_max_on: None,
            pm2_5: None,
            pm10: None,
            heat: None,
            air: None,
        }
    }
}

/// What the screen may show. Values only when the last attempt succeeded and
/// the reading is under two intervals old; otherwise "not available" with
/// the times, so an old reading is never read as today's.
pub fn view(stored: Option<&Stored>, fetch_on: bool, now: DateTime<Utc>) -> EnvironmentView {
    let blank = Stored::default();
    let row = stored.unwrap_or(&blank);
    if !fetch_on {
        return EnvironmentView::empty("off", row, None);
    }
    let Some(ok_at) = row.ok_at else {
        let reason = row
            .error
            .clone()
            .or_else(|| Some("No reading has been fetched yet".to_owned()));
        return EnvironmentView::empty("not_available", row, reason);
    };
    let last_failed = row.attempted_at.is_some_and(|a| a > ok_at);
    let too_old = (now - ok_at).num_seconds() > 2 * FETCH_INTERVAL_SECS;
    if last_failed || too_old {
        let reason = row
            .error
            .clone()
            .or_else(|| Some("The last reading is too old to show as current".to_owned()));
        return EnvironmentView::empty("not_available", row, reason);
    }
    let r = row.reading;
    EnvironmentView {
        status: "current",
        as_of: Some(ok_at),
        temperature_c: r.temperature_c,
        weather_code: r.weather_code,
        forecast_max_c: r.forecast_max_c,
        forecast_max_on: r.forecast_max_on,
        pm2_5: r.pm2_5,
        pm10: r.pm10,
        heat: r.forecast_max_c.map(heat_advisory),
        air: air_advisory(r.pm2_5, r.pm10),
        ..EnvironmentView::empty("current", row, None)
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::{Reading, Stored, air_advisory, heat_advisory, view};

    fn good(at: chrono::DateTime<Utc>) -> Stored {
        Stored {
            attempted_at: Some(at),
            ok_at: Some(at),
            error: None,
            reading: Reading {
                temperature_c: Some(38.0),
                forecast_max_c: Some(46.0),
                pm2_5: Some(95.0),
                pm10: Some(80.0),
                ..Reading::default()
            },
        }
    }

    #[test]
    fn a_failed_fetch_after_a_good_one_is_not_available_not_the_old_value() {
        let now = Utc::now();
        let mut row = good(now - Duration::minutes(50));
        row.attempted_at = Some(now - Duration::minutes(2));
        row.error = Some("weather: timed out".to_owned());
        let v = view(Some(&row), true, now);
        assert_eq!(v.status, "not_available");
        assert_eq!(v.temperature_c, None);
        assert_eq!(v.as_of, None);
        assert_eq!(v.reason.as_deref(), Some("weather: timed out"));
    }

    #[test]
    fn a_reading_older_than_two_hours_is_not_current() {
        let now = Utc::now();
        let v = view(Some(&good(now - Duration::hours(3))), true, now);
        assert_eq!(v.status, "not_available");
        assert_eq!(v.forecast_max_c, None);
    }

    #[test]
    fn a_fresh_reading_is_current_with_its_time_and_advisories() {
        let now = Utc::now();
        let at = now - Duration::minutes(10);
        let v = view(Some(&good(at)), true, now);
        assert_eq!(v.status, "current");
        assert_eq!(v.as_of, Some(at));
        assert_eq!(v.heat.map(|h| h.level), Some("heat_wave"));
        assert_eq!(v.air.map(|a| a.level), Some("poor"));
    }

    #[test]
    fn never_fetched_and_turned_off_are_told_apart() {
        let now = Utc::now();
        assert_eq!(view(None, true, now).status, "not_available");
        assert_eq!(view(Some(&good(now)), false, now).status, "off");
    }

    #[test]
    fn imd_heat_thresholds() {
        assert_eq!(heat_advisory(39.9).level, "none");
        assert_eq!(heat_advisory(40.0).level, "heat_caution");
        assert_eq!(heat_advisory(45.0).level, "heat_wave");
        assert_eq!(heat_advisory(47.0).level, "severe_heat_wave");
    }

    #[test]
    fn cpcb_bands_take_the_worse_pollutant() {
        assert_eq!(
            air_advisory(Some(25.0), Some(40.0)).map(|a| a.level),
            Some("good")
        );
        let a = air_advisory(Some(25.0), Some(360.0));
        assert_eq!(a.as_ref().map(|a| a.level), Some("very_poor"));
        assert!(a.is_some_and(|a| a.is_advisory));
        assert_eq!(
            air_advisory(Some(300.0), None).map(|a| a.level),
            Some("severe")
        );
        assert_eq!(air_advisory(None, None), None);
    }
}
