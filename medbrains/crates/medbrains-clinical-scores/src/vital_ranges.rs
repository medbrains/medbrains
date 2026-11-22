//! What a typed vital sign may be.
//!
//! The forms clamped a typed value into range ("`SpO2` 150" saved as 100) and
//! the server stored whatever it was sent. This refuses such a value for every
//! client, as a layer on the routes that take typed readings ([`checked`]).
//! Each limit is the widest one a web form already applies, so nothing a
//! screen accepts is refused. Temperature is stored as entered, so either
//! unit's range passes.

use std::fmt::Display;
use std::ops::RangeInclusive;

use axum::body::{Body, to_bytes};
use axum::extract::Request;
use axum::handler::Handler;
use axum::middleware::{Next, from_fn};
use axum::response::Response;
use medbrains_server_core::{error::AppError, state::AppState};
use rust_decimal::Decimal;
use serde::Deserialize;

/// The largest vitals body read for the check; the forms send a few hundred bytes.
const MAX_BODY_BYTES: usize = 64 * 1024;

/// One set of typed readings, under the names the vitals and the ER triage
/// bodies use; a reading left blank is `None` and always passes.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct VitalReadings {
    pub temperature: Option<Decimal>,
    #[serde(alias = "pulse_rate")]
    pub pulse: Option<i32>,
    #[serde(alias = "blood_pressure_systolic")]
    pub systolic_bp: Option<i32>,
    #[serde(alias = "blood_pressure_diastolic")]
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub head_circumference_cm: Option<Decimal>,
    #[serde(alias = "gcs_score")]
    pub gcs: Option<i32>,
    pub pain_score: Option<i32>,
}

/// Answers 400 when the JSON body carries a reading outside its range. A body
/// that does not parse as readings is passed on for the handler to refuse.
async fn refuse_impossible_vitals(request: Request, next: Next) -> Result<Response, AppError> {
    let (parts, body) = request.into_parts();
    let bytes = to_bytes(body, MAX_BODY_BYTES)
        .await
        .map_err(|_| AppError::BadRequest("The request is too large".to_owned()))?;
    if let Ok(readings) = serde_json::from_slice::<VitalReadings>(&bytes) {
        check_vital_readings(&readings)?;
    }
    Ok(next
        .run(Request::from_parts(parts, Body::from(bytes)))
        .await)
}

/// Wraps a handler that takes typed vital signs so an impossible reading is
/// refused before it runs: one layer keeps the rule in one place.
pub fn checked<H, T>(handler: H) -> impl Handler<T, AppState>
where
    H: Handler<T, AppState>,
    T: 'static,
{
    handler.layer(from_fn(refuse_impossible_vitals))
}

/// Refuses a reading outside `range`, naming the reading and its limits.
fn check<T: PartialOrd + Display>(
    label: &str,
    value: Option<T>,
    range: &RangeInclusive<T>,
) -> Result<(), AppError> {
    match value {
        Some(v) if !range.contains(&v) => Err(AppError::BadRequest(format!(
            "{label} must be between {} and {}",
            range.start(),
            range.end()
        ))),
        _ => Ok(()),
    }
}

/// Refuses a temperature that is neither a plausible °C nor a plausible °F reading.
fn check_temperature(value: Option<Decimal>) -> Result<(), AppError> {
    let celsius = Decimal::from(32)..=Decimal::from(43);
    let fahrenheit = Decimal::from(90)..=Decimal::from(110);
    match value {
        Some(v) if !celsius.contains(&v) && !fahrenheit.contains(&v) => Err(AppError::BadRequest(
            "Temperature must be between 32 and 43 °C (90 and 110 °F)".to_owned(),
        )),
        _ => Ok(()),
    }
}

/// Refuses the whole set when any reading is outside its range.
pub fn check_vital_readings(v: &VitalReadings) -> Result<(), AppError> {
    let decimal = |low: i64, high: i64| Decimal::from(low)..=Decimal::from(high);
    check_temperature(v.temperature)?;
    check("Pulse", v.pulse, &(0..=300))?;
    check("Systolic blood pressure", v.systolic_bp, &(50..=300))?;
    check("Diastolic blood pressure", v.diastolic_bp, &(20..=200))?;
    check("Respiratory rate", v.respiratory_rate, &(0..=80))?;
    check("SpO2", v.spo2, &(0..=100))?;
    check(
        "Weight (kg)",
        v.weight_kg,
        &(Decimal::new(5, 1)..=Decimal::from(500)),
    )?;
    check("Height (cm)", v.height_cm, &decimal(20, 300))?;
    check(
        "Head circumference (cm)",
        v.head_circumference_cm,
        &decimal(20, 70),
    )?;
    check("GCS", v.gcs, &(3..=15))?;
    check("Pain score", v.pain_score, &(0..=10))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    /// The refusal for a request body as a form would send it, if any.
    fn refusal(body: &str) -> Option<String> {
        let readings: VitalReadings = serde_json::from_str(body).unwrap();
        match check_vital_readings(&readings) {
            Err(AppError::BadRequest(message)) => Some(message),
            _ => None,
        }
    }

    #[test]
    fn blank_and_ordinary_readings_pass() {
        assert_eq!(refusal("{}"), None);
        let ordinary = r#"{"temperature":"98.6","pulse":72,"systolic_bp":120,"diastolic_bp":80,
            "respiratory_rate":16,"spo2":98,"weight_kg":"61.5","notes":"x"}"#;
        assert_eq!(refusal(ordinary), None);
        assert_eq!(refusal(r#"{"temperature":36.8,"gcs_score":15}"#), None);
    }

    #[test]
    fn an_impossible_reading_is_refused_by_name() {
        let message = |body| refusal(body).unwrap_or_default();
        assert_eq!(
            message(r#"{"encounter_id":"e","spo2":150}"#),
            "SpO2 must be between 0 and 100"
        );
        assert_eq!(
            message(r#"{"pulse":-5}"#),
            "Pulse must be between 0 and 300"
        );
        // The ER triage body's own field names.
        let triage = r#"{"triage_level":"urgent","pulse_rate":900,"gcs_score":15}"#;
        assert_eq!(message(triage), "Pulse must be between 0 and 300");
        assert_eq!(
            message(r#"{"gcs_score":99}"#),
            "GCS must be between 3 and 15"
        );
        // Between the two units' ranges: neither a °C nor a °F reading.
        assert!(message(r#"{"temperature":60}"#).starts_with("Temperature must be"));
    }
}
