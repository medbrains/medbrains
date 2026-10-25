//! OPD visits (with diagnoses and vitals) and closed admissions.

use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::ctx::{Ctx, Ref};

/// The visit types a live OPD visit accepts.
const VISIT_TYPES: &[&str] = &[
    "walk_in",
    "booked",
    "follow_up",
    "referral",
    "emergency",
    "camp",
];
const DISCHARGE_TYPES: &[&str] = &[
    "normal",
    "lama",
    "dama",
    "absconded",
    "referred",
    "deceased",
];
const ADMISSION_SOURCES: &[&str] = &["er", "opd", "direct", "referral", "transfer_in"];

#[derive(Debug, Deserialize)]
pub(crate) struct DiagnosisRec {
    pub(crate) icd_code: String,
    pub(crate) icd_system: String,
    pub(crate) description: String,
    #[serde(default)]
    pub(crate) is_primary: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VitalsRec {
    pub(crate) temperature: Option<f64>,
    pub(crate) pulse: Option<i32>,
    pub(crate) systolic_bp: Option<i32>,
    pub(crate) diastolic_bp: Option<i32>,
    pub(crate) respiratory_rate: Option<i32>,
    pub(crate) spo2: Option<i32>,
    pub(crate) weight_kg: Option<f64>,
    pub(crate) height_cm: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct VisitRec {
    pub(crate) external_id: String,
    pub(crate) patient: String,
    pub(crate) department: String,
    pub(crate) doctor: String,
    pub(crate) visited_at: DateTime<Utc>,
    pub(crate) visit_type: Option<String>,
    pub(crate) chief_complaint: Option<String>,
    /// `completed` (default) or `cancelled` (booked, never seen).
    pub(crate) status: Option<String>,
    pub(crate) follow_up_date: Option<NaiveDate>,
    #[serde(default)]
    pub(crate) diagnoses: Vec<DiagnosisRec>,
    pub(crate) vitals: Option<VitalsRec>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AdmissionRec {
    pub(crate) external_id: String,
    pub(crate) patient: String,
    pub(crate) department: String,
    pub(crate) doctor: String,
    pub(crate) admitted_at: DateTime<Utc>,
    /// History is closed: every imported admission was discharged before go-live.
    pub(crate) discharged_at: DateTime<Utc>,
    pub(crate) discharge_type: Option<String>,
    pub(crate) admission_source: Option<String>,
    pub(crate) diagnosis: String,
    pub(crate) discharge_summary: Option<String>,
    #[serde(default)]
    pub(crate) diagnoses: Vec<DiagnosisRec>,
}

/// `value` must be one of `allowed`; `None` means the default.
pub(crate) fn one_of(
    ctx: &mut Ctx<'_>,
    field: &'static str,
    value: Option<&String>,
    allowed: &[&str],
    default: &str,
) -> Option<String> {
    let v = value.map_or_else(|| default.to_owned(), |v| v.trim().to_lowercase());
    if allowed.contains(&v.as_str()) {
        return Some(v);
    }
    ctx.problem(field, format!("Use one of: {}", allowed.join(", ")));
    None
}

pub(crate) fn provenance(ctx: &Ctx<'_>) -> serde_json::Value {
    json!({ "source": "historical_import", "batch_id": ctx.batch, "external_id": ctx.at.2 })
}

fn check_vitals(ctx: &mut Ctx<'_>, v: &VitalsRec) {
    let ranges: [(&'static str, Option<f64>, f64, f64); 7] = [
        ("vitals.temperature", v.temperature, 30.0, 45.0),
        ("vitals.pulse", v.pulse.map(f64::from), 20.0, 250.0),
        (
            "vitals.systolic_bp",
            v.systolic_bp.map(f64::from),
            50.0,
            280.0,
        ),
        (
            "vitals.diastolic_bp",
            v.diastolic_bp.map(f64::from),
            20.0,
            180.0,
        ),
        (
            "vitals.respiratory_rate",
            v.respiratory_rate.map(f64::from),
            4.0,
            80.0,
        ),
        ("vitals.spo2", v.spo2.map(f64::from), 40.0, 100.0),
        ("vitals.weight_kg", v.weight_kg, 0.3, 350.0),
    ];
    for (field, value, lo, hi) in ranges {
        if let Some(x) = value.filter(|x| *x < lo || *x > hi) {
            ctx.problem(field, format!("{x} is outside {lo}-{hi}"));
        }
    }
    if let (Some(s), Some(d)) = (v.systolic_bp, v.diastolic_bp)
        && s <= d
    {
        ctx.problem("vitals.systolic_bp", "Systolic must be above diastolic");
    }
}

/// Diagnoses under the hospital's own coding switch, exactly as a live entry is checked.
async fn diagnoses(
    ctx: &mut Ctx<'_>,
    encounter: Uuid,
    list: &[DiagnosisRec],
    at: DateTime<Utc>,
) -> Result<(), AppError> {
    for d in list {
        if d.description.trim().is_empty() {
            ctx.problem(
                "diagnoses.description",
                "Every diagnosis needs its description",
            );
            continue;
        }
        let system = d.icd_system.trim().to_lowercase();
        let checked = medbrains_terminology::icd10::store::check_diagnosis_code(
            &mut ctx.tx,
            ctx.tenant,
            &system,
            Some(d.icd_code.as_str()),
        )
        .await;
        if let Err(AppError::BadRequest(m)) = checked {
            ctx.problem("diagnoses.icd_code", m);
            continue;
        }
        checked?;
        sqlx::query(
            "INSERT INTO diagnoses (tenant_id, encounter_id, icd_code, icd_system, description, is_primary, \
                certainty, recorded_by, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8, $8)",
        )
        .bind(ctx.tenant)
        .bind(encounter)
        .bind(d.icd_code.trim())
        .bind(&system)
        .bind(d.description.trim())
        .bind(d.is_primary)
        .bind(ctx.user)
        .bind(at)
        .execute(&mut *ctx.tx)
        .await?;
    }
    Ok(())
}

pub(crate) async fn visit(ctx: &mut Ctx<'_>, r: &VisitRec) -> Result<Option<Ref>, AppError> {
    let patient = ctx.patient(&r.patient);
    let department = ctx.department(&r.department);
    let doctor = ctx.doctor(&r.doctor);
    let visit_type = one_of(
        ctx,
        "visit_type",
        r.visit_type.as_ref(),
        VISIT_TYPES,
        "walk_in",
    );
    let status = one_of(
        ctx,
        "status",
        r.status.as_ref(),
        &["completed", "cancelled"],
        "completed",
    );
    let in_past = ctx.past("visited_at", r.visited_at);
    if let Some(v) = &r.vitals {
        check_vitals(ctx, v);
    }
    let (
        Some((patient, registered)),
        Some(department),
        Some(doctor),
        Some(visit_type),
        Some(status),
        true,
    ) = (patient, department, doctor, visit_type, status, in_past)
    else {
        return Ok(None);
    };
    if !ctx.after_registration(registered, r.visited_at) {
        return Ok(None);
    }
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
            encounter_date, visit_type, chief_complaints, follow_up_date, attributes, created_at, updated_at, created_by) \
         VALUES ($1, $2, 'opd', $3::encounter_status, $4, $5, timezone($6, $7)::date, $8, $9, $10, $11, $7, $7, $12) \
         RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(patient)
    .bind(&status)
    .bind(department)
    .bind(doctor)
    .bind(&ctx.tz)
    .bind(r.visited_at)
    .bind(&visit_type)
    .bind(&r.chief_complaint)
    .bind(r.follow_up_date)
    .bind(json!({ "history_import": provenance(ctx) }))
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    diagnoses(ctx, encounter, &r.diagnoses, r.visited_at).await?;
    if let Some(v) = &r.vitals {
        sqlx::query(
            "INSERT INTO vitals (tenant_id, encounter_id, patient_id, recorded_by, temperature, pulse, systolic_bp, \
                diastolic_bp, respiratory_rate, spo2, weight_kg, height_cm, recorded_at, created_at, is_retrospective, notes) \
             VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, $8, $9, $10, $11::numeric, $12::numeric, $13, $13, true, 'Historical import')",
        )
        .bind(ctx.tenant)
        .bind(encounter)
        .bind(patient)
        .bind(ctx.user)
        .bind(v.temperature)
        .bind(v.pulse)
        .bind(v.systolic_bp)
        .bind(v.diastolic_bp)
        .bind(v.respiratory_rate)
        .bind(v.spo2)
        .bind(v.weight_kg)
        .bind(v.height_cm)
        .bind(r.visited_at)
        .execute(&mut *ctx.tx)
        .await?;
    }
    ctx.record_provenance("encounters", encounter, r.visited_at)
        .await?;
    Ok(Some(Ref {
        id: encounter,
        patient,
        encounter: Some(encounter),
        admission: None,
        at: r.visited_at,
    }))
}

pub(crate) async fn admission(
    ctx: &mut Ctx<'_>,
    r: &AdmissionRec,
) -> Result<Option<Ref>, AppError> {
    let patient = ctx.patient(&r.patient);
    let department = ctx.department(&r.department);
    let doctor = ctx.doctor(&r.doctor);
    let discharge = one_of(
        ctx,
        "discharge_type",
        r.discharge_type.as_ref(),
        DISCHARGE_TYPES,
        "normal",
    );
    let source = one_of(
        ctx,
        "admission_source",
        r.admission_source.as_ref(),
        ADMISSION_SOURCES,
        "opd",
    );
    let dated = ctx.past("admitted_at", r.admitted_at)
        & ctx.past("discharged_at", r.discharged_at)
        & ctx.in_order("discharged_at", r.admitted_at, r.discharged_at);
    if r.diagnosis.trim().is_empty() {
        ctx.problem("diagnosis", "An admission needs its working diagnosis");
    }
    let (
        Some((patient, registered)),
        Some(department),
        Some(doctor),
        Some(discharge),
        Some(source),
        true,
    ) = (patient, department, doctor, discharge, source, dated)
    else {
        return Ok(None);
    };
    if !ctx.after_registration(registered, r.admitted_at) {
        return Ok(None);
    }
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
            encounter_date, attributes, created_at, updated_at, created_by) \
         VALUES ($1, $2, 'ipd', 'completed', $3, $4, timezone($5, $6)::date, $7, $6, $8, $9) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(patient)
    .bind(department)
    .bind(doctor)
    .bind(&ctx.tz)
    .bind(r.admitted_at)
    .bind(json!({ "history_import": provenance(ctx) }))
    .bind(r.discharged_at)
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, attending_doctor_id, \
            department_id, status, admitted_at, discharged_at, discharge_type, discharge_summary, admission_source, \
            provisional_diagnosis, final_diagnosis, created_at, updated_at, created_by) \
         VALUES ($1, $2, $3, $4, $4, $5, 'discharged', $6, $7, $8::discharge_type, $9, $10::admission_source, \
            $11, $11, $6, $7, $12) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(encounter)
    .bind(patient)
    .bind(doctor)
    .bind(department)
    .bind(r.admitted_at)
    .bind(r.discharged_at)
    .bind(&discharge)
    .bind(&r.discharge_summary)
    .bind(&source)
    .bind(r.diagnosis.trim())
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    diagnoses(ctx, encounter, &r.diagnoses, r.admitted_at).await?;
    ctx.record_provenance("admissions", admission, r.admitted_at)
        .await?;
    Ok(Some(Ref {
        id: admission,
        patient,
        encounter: Some(encounter),
        admission: Some(admission),
        at: r.admitted_at,
    }))
}
