//! What a typed vital sign may be.
//!
//! The forms clamped a typed value into range ("`SpO2` 150" saved as 100) and
//! the server stored whatever it was sent. This refuses such a value for every
//! client, as a layer on the routes that take typed readings ([`checked`]).
//! Each limit is the widest one a web form already applies, so nothing a
//! screen accepts is refused. Temperature is stored as entered, so either
//! unit's range passes.

use axum::body::{Body, to_bytes};
use axum::extract::Request;
use axum::handler::Handler;
use axum::middleware::{Next, from_fn};
use axum::response::Response;
use medbrains_server_core::{error::AppError, state::AppState};
use serde_json::{Map, Value};

/// The largest vitals body read for the check; the forms send a few hundred bytes.
const MAX_BODY_BYTES: usize = 64 * 1024;

/// One typed reading's names in the vitals and ER triage bodies, and its limits.
struct Limit {
    label: &'static str,
    names: &'static [&'static str],
    low: f64,
    high: f64,
}

/// Every reading but temperature. Each limit is the widest a web form applies.
const LIMITS: [Limit; 10] = [
    Limit {
        label: "Pulse",
        names: &["pulse", "pulse_rate"],
        low: 0.0,
        high: 300.0,
    },
    Limit {
        label: "Systolic blood pressure",
        names: &["systolic_bp", "blood_pressure_systolic"],
        low: 50.0,
        high: 300.0,
    },
    Limit {
        label: "Diastolic blood pressure",
        names: &["diastolic_bp", "blood_pressure_diastolic"],
        low: 20.0,
        high: 200.0,
    },
    Limit {
        label: "Respiratory rate",
        names: &["respiratory_rate"],
        low: 0.0,
        high: 80.0,
    },
    Limit {
        label: "SpO2",
        names: &["spo2"],
        low: 0.0,
        high: 100.0,
    },
    Limit {
        label: "Weight (kg)",
        names: &["weight_kg"],
        low: 0.3,
        high: 500.0,
    },
    Limit {
        label: "Height (cm)",
        names: &["height_cm"],
        low: 20.0,
        high: 300.0,
    },
    Limit {
        label: "Head circumference (cm)",
        names: &["head_circumference_cm"],
        low: 20.0,
        high: 70.0,
    },
    Limit {
        label: "GCS",
        names: &["gcs", "gcs_score"],
        low: 3.0,
        high: 15.0,
    },
    Limit {
        label: "Pain score",
        names: &["pain_score"],
        low: 0.0,
        high: 10.0,
    },
];

/// Answers 400 when the JSON body carries a reading outside its range, or a
/// reading that is not a number. A body that is not a JSON object is passed on
/// for the handler to refuse.
async fn refuse_impossible_vitals(request: Request, next: Next) -> Result<Response, AppError> {
    let (parts, body) = request.into_parts();
    let bytes = to_bytes(body, MAX_BODY_BYTES)
        .await
        .map_err(|_| AppError::BadRequest("The request is too large".to_owned()))?;
    if let Ok(Value::Object(fields)) = serde_json::from_slice::<Value>(&bytes) {
        check_vital_readings(&fields)?;
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

/// A reading as a number: a JSON number or a numeric string (the forms send
/// decimals as strings). Blank is `None`; anything else that is not a number is
/// refused, so a mistyped reading can never skip the check. A decimal where a
/// whole number is stored ("spo2": 97.5) is still range-checked here.
fn number(label: &str, value: &Value) -> Result<Option<f64>, AppError> {
    let parsed = match value {
        Value::Null => return Ok(None),
        Value::String(s) if s.trim().is_empty() => return Ok(None),
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    };
    parsed
        .filter(|f| f.is_finite())
        .map(Some)
        .ok_or_else(|| AppError::BadRequest(format!("{label} must be a number")))
}

/// Refuses a reading outside `limit`, under any of its names, naming it and its limits.
fn check(fields: &Map<String, Value>, limit: &Limit) -> Result<(), AppError> {
    for value in limit.names.iter().filter_map(|name| fields.get(*name)) {
        if let Some(v) = number(limit.label, value)?
            && !(limit.low..=limit.high).contains(&v)
        {
            return Err(AppError::BadRequest(format!(
                "{} must be between {} and {}",
                limit.label, limit.low, limit.high
            )));
        }
    }
    Ok(())
}

/// Refuses a temperature that is neither a plausible °C nor a plausible °F reading.
fn check_temperature(fields: &Map<String, Value>) -> Result<(), AppError> {
    let Some(value) = fields.get("temperature") else {
        return Ok(());
    };
    match number("Temperature", value)? {
        Some(v) if !(32.0..=43.0).contains(&v) && !(90.0..=110.0).contains(&v) => {
            Err(AppError::BadRequest(
                "Temperature must be between 32 and 43 °C (90 and 110 °F)".to_owned(),
            ))
        }
        _ => Ok(()),
    }
}

/// Refuses the whole set when any known reading is outside its range or is not
/// a number. Fields that are not readings are ignored.
pub fn check_vital_readings(fields: &Map<String, Value>) -> Result<(), AppError> {
    check_temperature(fields)?;
    LIMITS.iter().try_for_each(|limit| check(fields, limit))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    /// The refusal for a request body as a form would send it, if any.
    fn refusal(body: &str) -> Option<String> {
        let Value::Object(fields) = serde_json::from_str(body).unwrap() else {
            return None;
        };
        match check_vital_readings(&fields) {
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

    #[test]
    fn a_reading_that_is_not_a_number_is_refused_not_skipped() {
        let message = |body| refusal(body).unwrap_or_default();
        // Before: one bad field failed the typed parse and skipped every check.
        assert_eq!(
            message(r#"{"spo2":150,"pulse":"fast"}"#),
            "Pulse must be a number"
        );
        assert_eq!(message(r#"{"gcs":true}"#), "GCS must be a number");
        assert_eq!(
            message(r#"{"temperature":"hot"}"#),
            "Temperature must be a number"
        );
        assert_eq!(refusal(r#"{"pulse":null,"spo2":""}"#), None);
    }

    #[test]
    fn a_decimal_or_a_doubled_name_is_still_checked() {
        let message = |body| refusal(body).unwrap_or_default();
        assert_eq!(refusal(r#"{"spo2":97.5}"#), None);
        assert_eq!(
            message(r#"{"spo2":150.5}"#),
            "SpO2 must be between 0 and 100"
        );
        assert_eq!(
            message(r#"{"pulse":72,"pulse_rate":900}"#),
            "Pulse must be between 0 and 300"
        );
    }

    #[test]
    fn a_preterm_weight_passes_down_to_three_hundred_grams() {
        assert_eq!(refusal(r#"{"weight_kg":"0.3"}"#), None);
        assert_eq!(
            refusal(r#"{"weight_kg":0.29}"#).unwrap_or_default(),
            "Weight (kg) must be between 0.3 and 500"
        );
    }
}
