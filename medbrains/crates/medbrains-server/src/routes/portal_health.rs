//! Health data a patient shares from Apple Health or Health Connect.
//!
//! The phone reads, never writes: the patient app reads blood pressure,
//! glucose, weight, SpO2 and heart rate from HealthKit / Health Connect and
//! posts them here, but only the kinds the patient has said yes to, per
//! source. The answer is checked here too, so an old app build or a revoked
//! "yes" cannot slip readings in. Readings are patient-reported: they go to
//! `remote_vital_readings` for the care team to read, never to `vitals`,
//! never early-warning scored, and never flagged as clinical observations.
//!
//! - `GET  /api/portal/health-data`          — the patient's sharing choices
//! - `PUT  /api/portal/health-data/consent`  — say yes or no to one kind
//! - `POST /api/portal/health-data/readings` — share readings (idempotent)

use std::collections::HashMap;

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use medbrains_server_core::{error::AppError, state::AppState};

use super::portal::PatientClaims;

const SOURCES: [&str; 2] = ["healthkit", "health_connect"];
const DATA_TYPES: [&str; 5] = ["blood_pressure", "glucose", "weight", "spo2", "heart_rate"];
/// Readings in one post; the app sends in batches of this size.
pub const MAX_BATCH: usize = 500;
/// Readings older than this are not taken: a backfill of years is not a
/// care team's to read through.
const MAX_AGE_DAYS: i64 = 90;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Consent {
    pub source: String,
    pub data_type: String,
    pub granted: bool,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct HealthDataSharing {
    pub consents: Vec<Consent>,
}

/// `GET /api/portal/health-data`
pub async fn get_sharing(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<HealthDataSharing>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consents = latest_consents(&mut tx, &claims).await?;
    tx.commit().await?;
    Ok(Json(HealthDataSharing { consents }))
}

async fn latest_consents(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &PatientClaims,
) -> Result<Vec<Consent>, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    Ok(sqlx::query_as::<_, Consent>(
        "SELECT DISTINCT ON (source, data_type) source, data_type, granted, recorded_at \
           FROM patient_health_data_consents \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          ORDER BY source, data_type, recorded_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut **tx)
    .await?)
}

#[derive(Debug, Deserialize)]
pub struct ConsentRequest {
    pub source: String,
    pub data_type: String,
    pub granted: bool,
}

/// `PUT /api/portal/health-data/consent`
pub async fn set_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<ConsentRequest>,
) -> Result<Json<HealthDataSharing>, AppError> {
    if !SOURCES.contains(&body.source.as_str()) || !DATA_TYPES.contains(&body.data_type.as_str()) {
        return Err(AppError::BadRequest(
            "Unknown source or kind of reading.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "INSERT INTO patient_health_data_consents (tenant_id, patient_id, source, data_type, granted) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .bind(&body.source)
    .bind(&body.data_type)
    .bind(body.granted)
    .execute(&mut *tx)
    .await?;
    let consents = latest_consents(&mut tx, &claims).await?;
    tx.commit().await?;
    Ok(Json(HealthDataSharing { consents }))
}

/// One reading as the app sends it. Glucose in mg/dL, weight in kg.
#[derive(Debug, Clone, Deserialize)]
pub struct AppReading {
    pub data_type: String,
    /// The sample's id in HealthKit / Health Connect.
    pub external_id: String,
    pub measured_at: DateTime<Utc>,
    pub value: Option<f64>,
    pub systolic: Option<f64>,
    pub diastolic: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ReadingsRequest {
    pub source: String,
    pub readings: Vec<AppReading>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Refused {
    pub external_id: String,
    pub reason: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReadingsResult {
    pub accepted: u64,
    pub duplicates: u64,
    pub refused: Vec<Refused>,
}

/// `(device_type, reading)` to store, or why not. Bounds are what a body can
/// produce; a reading outside them is a unit or entry error.
pub fn to_row(
    r: &AppReading,
    shared: &HashMap<String, bool>,
    now: DateTime<Utc>,
) -> Result<(&'static str, serde_json::Value), &'static str> {
    if !shared.get(&r.data_type).copied().unwrap_or(false) {
        return Err("the patient has not chosen to share this kind of reading");
    }
    if r.external_id.trim().is_empty() || r.external_id.len() > 200 {
        return Err("the reading has no sample id");
    }
    if r.measured_at > now + Duration::minutes(5)
        || r.measured_at < now - Duration::days(MAX_AGE_DAYS)
    {
        return Err("the reading is dated in the future or more than 90 days ago");
    }
    let within = |v: Option<f64>, lo: f64, hi: f64| v.filter(|x| (lo..=hi).contains(x));
    let row = match r.data_type.as_str() {
        "blood_pressure" => {
            let (Some(s), Some(d)) = (
                within(r.systolic, 50.0, 300.0),
                within(r.diastolic, 20.0, 200.0),
            ) else {
                return Err("blood pressure outside what a body can produce");
            };
            if d >= s {
                return Err("diastolic is not below systolic");
            }
            (
                "bp",
                serde_json::json!({ "systolic": s.round(), "diastolic": d.round() }),
            )
        }
        "glucose" => match within(r.value, 10.0, 1000.0) {
            Some(v) => ("glucometer", serde_json::json!({ "glucose": v.round() })),
            None => return Err("glucose outside 10-1000 mg/dL"),
        },
        "weight" => match within(r.value, 0.3, 400.0) {
            Some(v) => (
                "weight",
                serde_json::json!({ "weight_kg": (v * 10.0).round() / 10.0 }),
            ),
            None => return Err("weight outside 0.3-400 kg"),
        },
        "spo2" => match within(r.value, 50.0, 100.0) {
            Some(v) => ("pulse_ox", serde_json::json!({ "spo2": v.round() })),
            None => return Err("SpO2 outside 50-100%"),
        },
        "heart_rate" => match within(r.value, 20.0, 300.0) {
            Some(v) => ("heart_rate", serde_json::json!({ "pulse": v.round() })),
            None => return Err("heart rate outside 20-300 per minute"),
        },
        _ => return Err("unknown kind of reading"),
    };
    Ok(row)
}

/// `POST /api/portal/health-data/readings`
pub async fn post_readings(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<ReadingsRequest>,
) -> Result<Json<ReadingsResult>, AppError> {
    if !SOURCES.contains(&body.source.as_str()) {
        return Err(AppError::BadRequest("Unknown source.".to_owned()));
    }
    if body.readings.len() > MAX_BATCH {
        return Err(AppError::BadRequest(format!(
            "Send at most {MAX_BATCH} readings at a time."
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let shared: HashMap<String, bool> = latest_consents(&mut tx, &claims)
        .await?
        .into_iter()
        .filter(|c| c.source == body.source)
        .map(|c| (c.data_type, c.granted))
        .collect();
    let now = Utc::now();
    let (mut accepted, mut duplicates, mut refused) = (0, 0, Vec::new());
    for r in &body.readings {
        let (device_type, reading) = match to_row(r, &shared, now) {
            Ok(row) => row,
            Err(reason) => {
                refused.push(Refused {
                    external_id: r.external_id.clone(),
                    reason,
                });
                continue;
            }
        };
        // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
        let inserted = sqlx::query(
            "INSERT INTO remote_vital_readings (tenant_id, patient_id, device_type, reading, \
                    is_flagged, measured_at, source, external_id) \
             VALUES ($1, $2, $3, $4, false, $5, $6, $7) \
             ON CONFLICT (tenant_id, patient_id, source, external_id) WHERE external_id IS NOT NULL \
             DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(claims.pid)
        .bind(device_type)
        .bind(&reading)
        .bind(r.measured_at)
        .bind(&body.source)
        .bind(r.external_id.trim())
        .execute(&mut *tx)
        .await?;
        if inserted.rows_affected() == 1 {
            accepted += 1;
        } else {
            duplicates += 1;
        }
    }
    tx.commit().await?;
    Ok(Json(ReadingsResult {
        accepted,
        duplicates,
        refused,
    }))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{AppReading, to_row};
    use chrono::{Duration, Utc};
    use std::collections::HashMap;

    fn r(kind: &str, value: Option<f64>, bp: Option<(f64, f64)>) -> AppReading {
        AppReading {
            data_type: kind.to_owned(),
            external_id: "HK-1".to_owned(),
            measured_at: Utc::now() - Duration::hours(1),
            value,
            systolic: bp.map(|b| b.0),
            diastolic: bp.map(|b| b.1),
        }
    }

    fn all() -> HashMap<String, bool> {
        ["blood_pressure", "glucose", "weight", "spo2", "heart_rate"]
            .iter()
            .map(|k| ((*k).to_owned(), true))
            .collect()
    }

    #[test]
    fn each_kind_maps_to_its_remote_reading() {
        let now = Utc::now();
        assert_eq!(
            to_row(&r("blood_pressure", None, Some((128.0, 82.0))), &all(), now)
                .unwrap()
                .0,
            "bp"
        );
        assert_eq!(
            to_row(&r("glucose", Some(110.0), None), &all(), now)
                .unwrap()
                .1["glucose"],
            110.0
        );
        assert_eq!(
            to_row(&r("weight", Some(70.26), None), &all(), now)
                .unwrap()
                .1["weight_kg"],
            70.3
        );
        assert_eq!(
            to_row(&r("spo2", Some(96.0), None), &all(), now).unwrap().0,
            "pulse_ox"
        );
        assert_eq!(
            to_row(&r("heart_rate", Some(72.0), None), &all(), now)
                .unwrap()
                .0,
            "heart_rate"
        );
    }

    #[test]
    fn nothing_is_taken_without_the_patients_yes_for_that_kind() {
        let mut shared = all();
        shared.insert("glucose".to_owned(), false);
        assert!(to_row(&r("glucose", Some(110.0), None), &shared, Utc::now()).is_err());
        shared.remove("spo2");
        assert!(to_row(&r("spo2", Some(96.0), None), &shared, Utc::now()).is_err());
    }

    #[test]
    fn impossible_values_and_dates_are_refused() {
        let now = Utc::now();
        assert!(to_row(&r("spo2", Some(140.0), None), &all(), now).is_err());
        assert!(
            to_row(&r("glucose", Some(6.1), None), &all(), now).is_err(),
            "mmol/L sent as mg/dL"
        );
        assert!(to_row(&r("blood_pressure", None, Some((80.0, 90.0))), &all(), now).is_err());
        let mut old = r("weight", Some(70.0), None);
        old.measured_at = now - Duration::days(120);
        assert!(to_row(&old, &all(), now).is_err());
        let mut future = r("weight", Some(70.0), None);
        future.measured_at = now + Duration::hours(2);
        assert!(to_row(&future, &all(), now).is_err());
    }
}
