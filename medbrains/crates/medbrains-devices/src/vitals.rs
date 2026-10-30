//! Bedside monitor readings: an HL7 ORU from a patient monitor or central
//! station, read into a vitals sample and kept as a draft against whoever is
//! admitted to the monitor's bed, for a nurse to confirm.
//!
//! Observation identifiers are matched by IEEE 11073-10101 (MDC) code or
//! reference id, or by LOINC, so the same table serves Philips, GE, Mindray
//! and Nihon Kohden. A reading that cannot be tied to exactly one admission
//! -- the monitor has no bed, the bed is empty, the message names a different
//! patient -- is held with the reason. A monitor sends every few seconds;
//! one normal reading per 15 minutes is kept, and every abnormal one.

use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone, Utc};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Keep one normal reading per this many minutes per bed.
const KEEP_EVERY_MINUTES: i64 = 15;
/// HL7 timestamps without an offset are hospital local time (India).
const LOCAL_OFFSET_SECS: i32 = 19_800;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Param {
    Spo2,
    Pulse,
    Systolic,
    Diastolic,
    Resp,
    Temp,
}

/// (MDC numeric code, MDC reference id, LOINC codes) for each parameter.
const CODES: &[(Param, &[&str], &[&str])] = &[
    (
        Param::Spo2,
        &["150456", "MDC_PULS_OXIM_SAT_O2"],
        &["59408-5", "2708-6", "20564-1"],
    ),
    (
        Param::Pulse,
        &[
            "147842",
            "MDC_ECG_HEART_RATE",
            "149530",
            "MDC_PULS_OXIM_PULS_RATE",
            "149514",
            "MDC_PULS_RATE",
        ],
        &["8867-4"],
    ),
    (
        Param::Systolic,
        &[
            "150021",
            "MDC_PRESS_BLD_NONINV_SYS",
            "150017",
            "MDC_PRESS_BLD_ART_SYS",
        ],
        &["8480-6"],
    ),
    (
        Param::Diastolic,
        &[
            "150022",
            "MDC_PRESS_BLD_NONINV_DIA",
            "150018",
            "MDC_PRESS_BLD_ART_DIA",
        ],
        &["8462-4"],
    ),
    (
        Param::Resp,
        &["151562", "MDC_RESP_RATE", "151578", "MDC_TTHOR_RESP_RATE"],
        &["9279-1"],
    ),
    (
        Param::Temp,
        &[
            "150344",
            "MDC_TEMP",
            "150364",
            "MDC_TEMP_BODY",
            "188496",
            "MDC_TEMP_CORE",
        ],
        &["8310-5", "8331-1"],
    ),
];

/// One OBX as the bridge forwards it.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Obs {
    #[serde(default)]
    pub test_code: String,
    pub test_name: Option<String>,
    #[serde(default)]
    pub value: String,
    pub unit: Option<String>,
    pub observed_at: Option<String>,
}

/// One monitor sample in charting units (degrees Celsius).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Sample {
    pub temperature: Option<f64>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
}

impl Sample {
    pub const fn is_empty(&self) -> bool {
        self.temperature.is_none()
            && self.pulse.is_none()
            && self.systolic_bp.is_none()
            && self.diastolic_bp.is_none()
            && self.respiratory_rate.is_none()
            && self.spo2.is_none()
    }

    /// Outside the range a ward would act on (roughly a NEWS2 parameter
    /// score of 3, or 2 for blood pressure), so it is kept whatever the
    /// 15-minute rule says.
    pub fn is_abnormal(&self) -> bool {
        let out = |v: Option<i32>, lo: i32, hi: i32| v.is_some_and(|x| x < lo || x > hi);
        out(self.spo2, 92, 100)
            || out(self.pulse, 41, 130)
            || out(self.respiratory_rate, 9, 24)
            || out(self.systolic_bp, 91, 219)
            || self
                .temperature
                .is_some_and(|t| !(35.1..=39.0).contains(&t))
    }
}

fn param_of(o: &Obs) -> Option<Param> {
    let name = o.test_name.as_deref().unwrap_or_default();
    CODES
        .iter()
        .find(|(_, mdc, loinc)| {
            mdc.iter()
                .chain(loinc.iter())
                .any(|c| *c == o.test_code || *c == name)
        })
        .map(|(p, _, _)| *p)
}

/// Fahrenheit when the unit says so (`[degF]`, `MDC_DIM_FAHR`, `degF`).
fn celsius(v: f64, unit: Option<&str>) -> f64 {
    let u = unit.unwrap_or_default().to_ascii_uppercase();
    if u.contains("FAHR") || u.contains("DEGF") || u == "F" {
        (v - 32.0) * 5.0 / 9.0
    } else {
        v
    }
}

/// The vitals in a monitor's observations; unknown parameters are ignored.
pub fn sample(observations: &[Obs]) -> Sample {
    let mut s = Sample::default();
    for o in observations {
        let Some(p) = param_of(o) else { continue };
        let Ok(v) = o.value.trim().parse::<f64>() else {
            continue;
        };
        let i = || Some(v.round() as i32);
        match p {
            Param::Spo2 => s.spo2 = i(),
            // ECG heart rate is listed first; a pleth rate only fills a gap.
            Param::Pulse => s.pulse = s.pulse.or_else(i),
            Param::Systolic => s.systolic_bp = i(),
            Param::Diastolic => s.diastolic_bp = i(),
            Param::Resp => s.respiratory_rate = i(),
            Param::Temp => {
                s.temperature = Some((celsius(v, o.unit.as_deref()) * 10.0).round() / 10.0);
            }
        }
    }
    s
}

/// The earliest OBX-14, read as hospital local time unless it carries an offset.
pub fn observed_at(observations: &[Obs]) -> Option<DateTime<Utc>> {
    observations
        .iter()
        .filter_map(|o| parse_ts(o.observed_at.as_deref()?))
        .min()
}

fn parse_ts(s: &str) -> Option<DateTime<Utc>> {
    let s = s.trim();
    let (body, offset) = match s.find(['+', '-']) {
        Some(i) => (&s[..i], Some(&s[i..])),
        None => (s, None),
    };
    let digits: String = body.chars().take_while(char::is_ascii_digit).collect();
    let padded = format!("{digits:0<14}");
    let naive = NaiveDateTime::parse_from_str(padded.get(..14)?, "%Y%m%d%H%M%S").ok()?;
    let secs = match offset {
        Some(o) if o.len() == 5 => {
            let sign = if o.starts_with('-') { -1 } else { 1 };
            let h: i32 = o.get(1..3)?.parse().ok()?;
            let m: i32 = o.get(3..5)?.parse().ok()?;
            sign * (h * 3600 + m * 60)
        }
        _ => LOCAL_OFFSET_SECS,
    };
    FixedOffset::east_opt(secs)?
        .from_local_datetime(&naive)
        .single()
        .map(|d| d.with_timezone(&Utc))
}

#[derive(Debug, Default, Deserialize)]
struct Mapped {
    #[serde(default)]
    identifiers: Ids,
    #[serde(default)]
    results: Vec<Obs>,
}

#[derive(Debug, Default, Deserialize)]
struct Ids {
    patient_id: Option<String>,
}

/// What became of a monitor message.
#[derive(Debug, PartialEq, Eq)]
pub enum Routed {
    /// Kept as a draft for the nurse.
    Draft(Uuid),
    /// Normal, and a reading from this bed is already kept this quarter hour.
    Thinned,
    /// Kept, but tied to no admission; why.
    Held(Uuid, String),
    /// Nothing in it was a vital sign.
    Empty,
}

/// Read `mapped` from `device` into a draft (or held) reading.
pub async fn route(
    tx: &mut Tx<'_>,
    (tenant_id, device_id): (Uuid, Uuid),
    message_id: Uuid,
    mapped: &serde_json::Value,
) -> Result<Routed, AppError> {
    let m: Mapped = serde_json::from_value(mapped.clone()).unwrap_or_default();
    let s = sample(&m.results);
    if s.is_empty() {
        return Ok(Routed::Empty);
    }
    let at = observed_at(&m.results).unwrap_or_else(Utc::now);
    let abnormal = s.is_abnormal();
    let bound = bind(
        tx,
        tenant_id,
        device_id,
        m.identifiers.patient_id.as_deref(),
    )
    .await?;
    let (encounter, patient, held) = match bound {
        Ok((e, p)) => (Some(e), Some(p), None),
        Err(why) => (None, None, Some(why)),
    };
    if let (Some(e), false) = (encounter, abnormal)
        && kept_recently(tx, tenant_id, e, at).await?
    {
        return Ok(Routed::Thinned);
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO device_vital_readings (tenant_id, device_instance_id, device_message_id, \
                encounter_id, patient_id, observed_at, temperature, pulse, systolic_bp, \
                diastolic_bp, respiratory_rate, spo2, is_abnormal, status, held_reason) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(device_id)
    .bind(message_id)
    .bind(encounter)
    .bind(patient)
    .bind(at)
    .bind(s.temperature)
    .bind(s.pulse)
    .bind(s.systolic_bp)
    .bind(s.diastolic_bp)
    .bind(s.respiratory_rate)
    .bind(s.spo2)
    .bind(abnormal)
    .bind(if held.is_some() { "held" } else { "draft" })
    .bind(held.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    Ok(match held {
        Some(why) => Routed::Held(id, why),
        None => Routed::Draft(id),
    })
}

/// The one admission on the monitor's bed, cross-checked against the patient
/// the message names; or why there is not one.
async fn bind(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    device_id: Uuid,
    sent_patient: Option<&str>,
) -> Result<Result<(Uuid, Uuid), String>, AppError> {
    let rows: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT a.encounter_id, a.patient_id, p.uhid \
           FROM device_instances d \
           JOIN admissions a ON a.bed_id = d.bed_location_id AND a.tenant_id = d.tenant_id \
                            AND a.status = 'admitted' AND a.deleted_at IS NULL \
           JOIN patients p ON p.id = a.patient_id \
          WHERE d.id = $1 AND d.tenant_id = $2 LIMIT 2",
    )
    .bind(device_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let bed: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT bed_location_id FROM device_instances WHERE id = $1 AND tenant_id = $2",
    )
    .bind(device_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if bed.flatten().is_none() {
        return Ok(Err("the monitor is not assigned to a bed".to_owned()));
    }
    Ok(match rows.as_slice() {
        [] => Err("no patient is admitted to the monitor's bed".to_owned()),
        [(e, p, uhid)] => match sent_patient.map(str::trim).filter(|s| !s.is_empty()) {
            Some(sent) if !sent.eq_ignore_ascii_case(uhid) => Err(format!(
                "the monitor sent patient {sent} but {uhid} is admitted to its bed"
            )),
            _ => Ok((*e, *p)),
        },
        _ => Err("more than one admission is on the monitor's bed".to_owned()),
    })
}

async fn kept_recently(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    encounter: Uuid,
    at: DateTime<Utc>,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM device_vital_readings \
           WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL \
             AND status IN ('draft', 'confirmed') \
             AND observed_at > $3 - make_interval(mins => $4) AND observed_at <= $3 + make_interval(mins => $4))",
    )
    .bind(tenant_id)
    .bind(encounter)
    .bind(at)
    .bind(i32::try_from(KEEP_EVERY_MINUTES).unwrap_or(15))
    .fetch_one(&mut **tx)
    .await?)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests;
