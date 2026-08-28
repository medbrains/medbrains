//! Internal data simulator engine.
//!
//! Drives clinical activity (OPD → vitals → diagnosis → prescription →
//! lab/radiology/IPD branch, plus an ER track with triage and optional
//! admit) against the live database. Every row written carries
//! `is_dummy = true` so regulator-facing reports filter the activity out.
//!
//! Day-1: inserts mirror the live route SQL column-for-column. A later
//! pass extracts proper in-tx helpers from `routes::opd`, `routes::ipd`,
//! `routes::emergency` and switches the engine over to call them.

pub mod agent;
pub mod agent_tools;
pub mod calendar;
pub mod decision;
pub mod fixtures;
pub mod pacer;
pub mod scheduler;
pub mod seasonality;
pub mod sweep_endpoints;
pub mod verifier;

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::simulator::{Profile, RunSummary};
use rand::Rng;
use rand::SeedableRng;
use rand::rngs::StdRng;
use rand::seq::IndexedRandom;
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;

#[derive(Debug)]
pub struct EngineResult {
    pub summary: RunSummary,
    pub steps: Vec<StepRecord>,
}

#[derive(Debug)]
pub struct StepRecord {
    pub step_type: &'static str,
    pub target_id: Option<Uuid>,
    pub success: bool,
    pub error: Option<String>,
}

/// Per-run realism context. Computed once at the top of `run()` and
/// passed into per-episode helpers so we don't re-resolve the date's
/// season / holiday / outbreak news for every record.
#[derive(Clone)]
struct RunContext<'a> {
    season: seasonality::SeasonProfile,
    holiday: Option<&'static calendar::HolidayInfo>,
    /// ICD codes from active outbreak-alert news rows. Empty when no
    /// outbreak is active.
    news_icds: &'a [String],
    /// (icd_code, count) tuples from the last N days of real (non-dummy)
    /// encounters. Used to blend the synthetic distribution toward the
    /// tenant's actual case mix.
    natural_icds: &'a [(String, i64)],
    natural_blend: f32,
}

pub async fn run(
    pool: &PgPool,
    claims: &Claims,
    profile: &Profile,
) -> Result<EngineResult, AppError> {
    let mut summary = RunSummary::default();
    let mut steps: Vec<StepRecord> = Vec::new();
    let mut rng = StdRng::from_os_rng();

    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let encounter_date = profile.date.unwrap_or_else(|| Utc::now().date_naive());

    // Day-4: resolve realism context for this run — season profile and
    // any holiday/festival overlay. These drive ICD weighting and the
    // OPD/ER volume scaling below.
    let season = if profile.seasonality.enabled {
        seasonality::season_for(encounter_date, &profile.seasonality.region)
    } else {
        seasonality::SeasonProfile {
            label: "off",
            boosted_icds: &[],
            boosted_complaints: &[],
        }
    };
    let holiday: Option<&'static calendar::HolidayInfo> = if profile.holidays.respect_holidays {
        calendar::lookup(encounter_date)
    } else {
        None
    };

    // Pull active news entries that should bias the diagnosis pool:
    // outbreak alerts (dengue surge etc.) and weather advisories (heat
    // wave, severe rain, cold wave). Their icd_boost arrays are added
    // on top of the holiday boost when picking diagnoses.
    let outbreak_icds: Vec<String> = sqlx::query_scalar::<_, Vec<String>>(
        "SELECT icd_boost FROM news_articles \
         WHERE tenant_id = $1 \
           AND is_active = true \
           AND deleted_at IS NULL \
           AND category IN ('outbreak_alert', 'weather_advisory') \
           AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .flatten()
    .collect();

    // Natural-flow snapshot — derive ICD-frequency weights from real
    // (is_dummy = false) encounters of the last N days. When the tenant
    // has live history the simulator nudges its synthetic load toward
    // the same distribution.
    let natural_icds: Vec<(String, i64)> =
        if profile.natural_flow.enabled && profile.natural_flow.blend > 0.0 {
            let lookback = profile.natural_flow.lookback_days.clamp(1, 365);
            sqlx::query_as::<_, (String, i64)>(
                "SELECT d.icd_code, COUNT(*)::bigint AS n \
             FROM diagnoses d \
             JOIN encounters e ON e.id = d.encounter_id \
             WHERE e.tenant_id = $1 \
               AND e.is_dummy = false \
               AND e.encounter_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day') \
               AND d.icd_code IS NOT NULL \
             GROUP BY d.icd_code \
             ORDER BY n DESC \
             LIMIT 50",
            )
            .bind(claims.tenant_id)
            .bind(lookback)
            .fetch_all(&mut *tx)
            .await
            .unwrap_or_default()
        } else {
            Vec::new()
        };
    let opd_scale = if holiday.is_some() {
        profile.holidays.opd_scale_on_holiday
    } else {
        1.0
    };
    let er_scale = if holiday.is_some() {
        profile.holidays.er_scale_on_holiday
    } else {
        1.0
    };

    // Resolve effective per-patient counts. Volume overrides win when set;
    // otherwise derive from `patients` × percentages × holiday scale.
    let base_opd = ((profile.patients as f32) * profile.opd_pct * opd_scale).round() as u32;
    let base_er = ((profile.patients as f32) * profile.er_pct * er_scale).round() as u32;
    let total_target = profile
        .volumes
        .opd_count
        .unwrap_or(base_opd)
        .saturating_add(profile.volumes.er_count.unwrap_or(base_er))
        .max(1);

    let patients = pick_patients(&mut tx, claims.tenant_id, total_target).await?;
    if patients.is_empty() {
        tx.commit().await?;
        return Err(AppError::BadRequest(
            "No patients available. Register at least one real patient first.".into(),
        ));
    }
    let doctors = pick_doctors(&mut tx, claims.tenant_id).await?;
    let departments = pick_departments(&mut tx, claims.tenant_id).await?;
    let labs = pick_lab_tests(&mut tx, claims.tenant_id).await?;
    let modalities = pick_modalities(&mut tx, claims.tenant_id).await?;

    // Effective ER ratio for the current run (post-scaling).
    let effective_er_pct = if total_target == 0 {
        profile.er_pct
    } else {
        let opd = profile.volumes.opd_count.unwrap_or(base_opd) as f32;
        let er = profile.volumes.er_count.unwrap_or(base_er) as f32;
        if opd + er <= 0.0 {
            profile.er_pct
        } else {
            er / (opd + er)
        }
    };

    let ctx = RunContext {
        season,
        holiday,
        news_icds: &outbreak_icds,
        natural_icds: &natural_icds,
        natural_blend: profile.natural_flow.blend.clamp(0.0, 1.0),
    };

    for patient_id in patients {
        let go_er = chance(&mut rng, effective_er_pct);
        if go_er {
            match run_er_episode(
                &mut tx,
                claims,
                patient_id,
                &doctors,
                &mut summary,
                &mut steps,
                &mut rng,
                profile,
                encounter_date,
                &ctx,
            )
            .await
            {
                Ok(()) => summary.er_count += 1,
                Err(err) => {
                    summary.errors += 1;
                    steps.push(StepRecord {
                        step_type: "er_visit",
                        target_id: None,
                        success: false,
                        error: Some(err.to_string()),
                    });
                }
            }
        } else {
            match run_opd_episode(
                &mut tx,
                claims,
                patient_id,
                &doctors,
                &departments,
                &labs,
                &modalities,
                &mut summary,
                &mut steps,
                &mut rng,
                profile,
                encounter_date,
                &ctx,
            )
            .await
            {
                Ok(()) => summary.opd_count += 1,
                Err(err) => {
                    summary.errors += 1;
                    steps.push(StepRecord {
                        step_type: "opd_encounter",
                        target_id: None,
                        success: false,
                        error: Some(err.to_string()),
                    });
                }
            }
        }
    }

    tx.commit().await?;
    Ok(EngineResult { summary, steps })
}

// ── OPD episode ──────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
async fn run_opd_episode(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    doctors: &[DoctorRow],
    departments: &[Uuid],
    labs: &[Uuid],
    modalities: &[Uuid],
    summary: &mut RunSummary,
    steps: &mut Vec<StepRecord>,
    rng: &mut StdRng,
    profile: &Profile,
    encounter_date: NaiveDate,
    ctx: &RunContext<'_>,
) -> Result<(), AppError> {
    let doctor = doctors.choose(rng);
    let department_id = pick_department_for_doctor(doctor, departments, rng);
    let complaint = fixtures::CHIEF_COMPLAINTS
        .choose(rng)
        .copied()
        .unwrap_or("OPD visit");

    let opd_ts = random_timestamp_in_opd_hours(
        rng,
        encounter_date,
        profile.hours.opd_open_hour,
        profile.hours.opd_close_hour,
    );
    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes, visit_type, is_dummy, created_by, created_at, updated_at) \
         VALUES ($1, $2, 'opd'::encounter_type, 'closed'::encounter_status, $3, $4, \
                 $5, $6, '{}'::jsonb, 'walk_in', true, $7, $8, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(department_id)
    .bind(doctor.map(|d| d.id))
    .bind(encounter_date)
    .bind(complaint)
    .bind(claims.sub)
    .bind(opd_ts)
    .fetch_one(&mut **tx)
    .await?;
    steps.push(StepRecord {
        step_type: "opd_encounter",
        target_id: Some(encounter_id),
        success: true,
        error: None,
    });

    // Vitals — recorded_by must be a real user, fall back to claims.sub
    if let Some(doc) = doctor {
        let (temp, pulse, sys, dia, rr, spo2, weight, height) = random_vitals(rng);
        sqlx::query(
            "INSERT INTO vitals \
             (tenant_id, encounter_id, recorded_by, temperature, pulse, \
              systolic_bp, diastolic_bp, respiratory_rate, spo2, \
              weight_kg, height_cm) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(doc.id)
        .bind(temp)
        .bind(pulse)
        .bind(sys)
        .bind(dia)
        .bind(rr)
        .bind(spo2)
        .bind(weight)
        .bind(height)
        .execute(&mut **tx)
        .await?;
        summary.vitals_count += 1;
        steps.push(StepRecord {
            step_type: "vitals",
            target_id: Some(encounter_id),
            success: true,
            error: None,
        });
    }

    // Diagnosis — bias toward season + holiday + active outbreak-alert ICDs.
    let holiday_boost: &[&str] = ctx.holiday.map(|h| h.icd_boost).unwrap_or(&[]);
    let news_refs: Vec<&str> = ctx.news_icds.iter().map(String::as_str).collect();
    // Merge holiday + news into a single boost list for the picker.
    let mut combined_boost: Vec<&str> = holiday_boost.to_vec();
    combined_boost.extend(news_refs.iter().copied());
    let (icd, desc) = fixtures::random_diagnosis_weighted(
        rng,
        ctx.season.boosted_icds,
        &combined_boost,
        profile.holidays.festival_weight_boost,
        ctx.natural_icds,
        ctx.natural_blend,
    );
    sqlx::query(
        "INSERT INTO diagnoses \
         (tenant_id, encounter_id, icd_code, description, is_primary, certainty) \
         VALUES ($1, $2, $3, $4, true, 'confirmed')",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(icd)
    .bind(desc)
    .execute(&mut **tx)
    .await?;
    summary.diagnoses_count += 1;
    steps.push(StepRecord {
        step_type: "diagnosis",
        target_id: Some(encounter_id),
        success: true,
        error: None,
    });

    // Prescription
    if chance(rng, profile.branches.rx_pct) {
        let prescriber = doctor.map(|d| d.id).unwrap_or(claims.sub);
        let prescription_id: Uuid = sqlx::query_scalar(
            "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) \
             VALUES ($1, $2, $3, $4) RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(prescriber)
        .bind(patient_id)
        .fetch_one(&mut **tx)
        .await?;
        summary.prescription_count += 1;

        let n_items = rng.random_range(1..=3);
        for _ in 0..n_items {
            let drug = fixtures::RX_DRUGS.choose(rng).copied().unwrap_or((
                "Paracetamol 500mg",
                "1 tab",
                "TDS",
                "3 days",
            ));
            sqlx::query(
                "INSERT INTO prescription_items \
                 (tenant_id, prescription_id, drug_name, dosage, frequency, duration) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(claims.tenant_id)
            .bind(prescription_id)
            .bind(drug.0)
            .bind(drug.1)
            .bind(drug.2)
            .bind(drug.3)
            .execute(&mut **tx)
            .await?;
        }
        steps.push(StepRecord {
            step_type: "prescription",
            target_id: Some(prescription_id),
            success: true,
            error: None,
        });
    }

    // Lab order branch
    if chance(rng, profile.branches.lab_pct)
        && let Some(&test_id) = labs.choose(rng)
    {
        let lab_id: Uuid = sqlx::query_scalar(
            "INSERT INTO lab_orders \
             (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
              status, priority, is_dummy) \
             VALUES ($1, $2, $3, $4, $5, 'ordered'::lab_order_status, \
                     'routine'::lab_priority, true) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(patient_id)
        .bind(test_id)
        .bind(claims.sub)
        .fetch_one(&mut **tx)
        .await?;
        summary.lab_count += 1;
        steps.push(StepRecord {
            step_type: "lab_order",
            target_id: Some(lab_id),
            success: true,
            error: None,
        });
    }

    // Radiology order branch
    if chance(rng, profile.branches.rad_pct)
        && let Some(&modality_id) = modalities.choose(rng)
    {
        let rad_id: Uuid = sqlx::query_scalar(
            "INSERT INTO radiology_orders \
             (tenant_id, patient_id, encounter_id, modality_id, ordered_by, \
              clinical_indication, priority, status, is_dummy) \
             VALUES ($1, $2, $3, $4, $5, $6, 'routine'::radiology_priority, \
                     'ordered'::radiology_order_status, true) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(patient_id)
        .bind(encounter_id)
        .bind(modality_id)
        .bind(claims.sub)
        .bind("Routine evaluation")
        .fetch_one(&mut **tx)
        .await?;
        summary.radiology_count += 1;
        steps.push(StepRecord {
            step_type: "radiology_order",
            target_id: Some(rad_id),
            success: true,
            error: None,
        });
    }

    // IPD escalation branch
    if chance(rng, profile.branches.ipd_escalation_pct) {
        let doctor_id = doctor.map(|d| d.id).unwrap_or(claims.sub);
        let dept =
            department_id.unwrap_or_else(|| departments.first().copied().unwrap_or(Uuid::nil()));
        if dept != Uuid::nil() {
            // IPD admissions cluster after OPD opens, peaking around
            // ipd_admission_start_hour through close.
            let ipd_ts = random_timestamp_in_range(
                rng,
                encounter_date,
                profile.hours.ipd_admission_start_hour,
                profile
                    .hours
                    .opd_close_hour
                    .max(profile.hours.ipd_admission_start_hour + 1),
            );
            let ipd_enc_id: Uuid = sqlx::query_scalar(
                "INSERT INTO encounters \
                 (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
                  encounter_date, attributes, visit_type, is_dummy, created_by, created_at, updated_at) \
                 VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, \
                         $5, '{}'::jsonb, 'walk_in', true, $6, $7, $7) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(patient_id)
            .bind(dept)
            .bind(doctor_id)
            .bind(encounter_date)
            .bind(claims.sub)
            .bind(ipd_ts)
            .fetch_one(&mut **tx)
            .await?;

            let admission_id: Uuid = sqlx::query_scalar(
                "INSERT INTO admissions \
                 (tenant_id, encounter_id, patient_id, admitting_doctor, status, \
                  admitted_at, admission_source, provisional_diagnosis, is_dummy, created_by) \
                 VALUES ($1, $2, $3, $4, 'admitted'::admission_status, \
                         NOW(), 'opd'::admission_source, $5, true, $6) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(ipd_enc_id)
            .bind(patient_id)
            .bind(doctor_id)
            .bind("OPD-escalated routine admission")
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;
            summary.ipd_admission_count += 1;
            steps.push(StepRecord {
                step_type: "ipd_admission",
                target_id: Some(admission_id),
                success: true,
                error: None,
            });
        }
    }

    Ok(())
}

// ── ER episode ───────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
async fn run_er_episode(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    doctors: &[DoctorRow],
    summary: &mut RunSummary,
    steps: &mut Vec<StepRecord>,
    rng: &mut StdRng,
    profile: &Profile,
    encounter_date: NaiveDate,
    _ctx: &RunContext<'_>,
) -> Result<(), AppError> {
    let triage = pick_triage(&profile.er.triage_mix, rng);
    let complaint = fixtures::ER_COMPLAINTS
        .choose(rng)
        .copied()
        .unwrap_or("Emergency presentation");
    let is_mlc = chance(rng, profile.er.mlc_pct);
    let visit_number = format!(
        "ER-{}-{:06}",
        encounter_date.format("%Y%m%d"),
        rng.random_range(1..=999_999u32)
    );
    let doctor_id = doctors.choose(rng).map(|d| d.id);
    let arrival_time = encounter_date
        .and_hms_opt(rng.random_range(0..24) as u32, 0, 0)
        .unwrap_or_else(|| encounter_date.and_time(chrono::NaiveTime::MIN))
        .and_utc();

    let er_id: Uuid = sqlx::query_scalar(
        "INSERT INTO er_visits \
         (tenant_id, patient_id, visit_number, status, arrival_mode, arrival_time, \
          chief_complaint, is_mlc, triage_level, attending_doctor_id, is_dummy, created_by) \
         VALUES ($1, $2, $3, 'discharged'::er_visit_status, 'walk_in', $4, \
                 $5, $6, $7::triage_level, $8, true, $9) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(&visit_number)
    .bind(arrival_time)
    .bind(complaint)
    .bind(is_mlc)
    .bind(triage)
    .bind(doctor_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    steps.push(StepRecord {
        step_type: "er_visit",
        target_id: Some(er_id),
        success: true,
        error: None,
    });

    // Triage assessment
    let (_, pulse, sys, dia, rr, spo2, _, _) = random_vitals(rng);
    sqlx::query(
        "INSERT INTO er_triage_assessments \
         (tenant_id, er_visit_id, triage_level, score, \
          respiratory_rate, pulse_rate, blood_pressure_systolic, \
          blood_pressure_diastolic, spo2, chief_complaint, assessed_by) \
         VALUES ($1, $2, $3::triage_level, $4, $5, $6, $7, $8, $9, $10, $11)",
    )
    .bind(claims.tenant_id)
    .bind(er_id)
    .bind(triage)
    .bind(rng.random_range(1..=5))
    .bind(rr)
    .bind(pulse)
    .bind(sys)
    .bind(dia)
    .bind(spo2)
    .bind(complaint)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    summary.triage_count += 1;
    steps.push(StepRecord {
        step_type: "er_triage",
        target_id: Some(er_id),
        success: true,
        error: None,
    });

    // Direct admission for red/yellow with probability
    if triage != "green" && chance(rng, profile.er.admit_pct) {
        let doctor = doctor_id.unwrap_or(claims.sub);
        let er_enc_id: Uuid = sqlx::query_scalar(
            "INSERT INTO encounters \
             (tenant_id, patient_id, encounter_type, status, doctor_id, \
              encounter_date, attributes, visit_type, is_dummy, created_by) \
             VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, \
                     $4, '{}'::jsonb, 'emergency', true, $5) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(patient_id)
        .bind(doctor)
        .bind(encounter_date)
        .bind(claims.sub)
        .fetch_one(&mut **tx)
        .await?;
        let admission_id: Uuid = sqlx::query_scalar(
            "INSERT INTO admissions \
             (tenant_id, encounter_id, patient_id, admitting_doctor, status, \
              admitted_at, admission_source, provisional_diagnosis, is_dummy, created_by) \
             VALUES ($1, $2, $3, $4, 'admitted'::admission_status, \
                     NOW(), 'er'::admission_source, $5, true, $6) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(er_enc_id)
        .bind(patient_id)
        .bind(doctor)
        .bind("ER-direct admission")
        .bind(claims.sub)
        .fetch_one(&mut **tx)
        .await?;
        summary.er_admit_count += 1;
        steps.push(StepRecord {
            step_type: "er_admit",
            target_id: Some(admission_id),
            success: true,
            error: None,
        });
    }

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct DoctorRow {
    id: Uuid,
    department_ids: Vec<Uuid>,
}

async fn pick_patients(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    n: u32,
) -> Result<Vec<Uuid>, AppError> {
    let rows: Vec<(Uuid,)> =
        sqlx::query_as("SELECT id FROM patients WHERE tenant_id = $1 ORDER BY random() LIMIT $2")
            .bind(tenant_id)
            .bind(i64::from(n))
            .fetch_all(&mut **tx)
            .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

async fn pick_doctors(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<DoctorRow>, AppError> {
    let rows: Vec<(Uuid, Vec<Uuid>)> = sqlx::query_as(
        "SELECT id, COALESCE(department_ids, ARRAY[]::uuid[]) \
         FROM users WHERE tenant_id = $1 AND is_active = true AND role = 'doctor' \
         LIMIT 200",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, department_ids)| DoctorRow { id, department_ids })
        .collect())
}

async fn pick_departments(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM departments WHERE tenant_id = $1 AND is_active = true LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

async fn pick_lab_tests(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM lab_test_catalog WHERE tenant_id = $1 AND is_active = true LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await
    .unwrap_or_default();
    Ok(rows.into_iter().map(|r| r.0).collect())
}

async fn pick_modalities(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<Uuid>, AppError> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM radiology_modalities WHERE tenant_id = $1 AND is_active = true LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await
    .unwrap_or_default();
    Ok(rows.into_iter().map(|r| r.0).collect())
}

fn pick_department_for_doctor(
    doctor: Option<&DoctorRow>,
    departments: &[Uuid],
    rng: &mut StdRng,
) -> Option<Uuid> {
    if let Some(doc) = doctor {
        if let Some(d) = doc.department_ids.choose(rng).copied() {
            return Some(d);
        }
    }
    departments.choose(rng).copied()
}

fn pick_triage(mix: &medbrains_core::simulator::TriageMix, rng: &mut StdRng) -> &'static str {
    let roll: f32 = rng.random::<f32>();
    if roll < mix.red {
        "red"
    } else if roll < mix.red + mix.yellow {
        "yellow"
    } else {
        "green"
    }
}

fn random_vitals(rng: &mut StdRng) -> (Decimal, i32, i32, i32, i32, i32, Decimal, Decimal) {
    let temp = Decimal::new(rng.random_range(965..=998), 1); // 96.5-99.8 °F
    let pulse = rng.random_range(60..=95);
    let sys = rng.random_range(105..=135);
    let dia = rng.random_range(65..=88);
    let rr = rng.random_range(12..=20);
    let spo2 = rng.random_range(96..=100);
    let weight = Decimal::new(rng.random_range(500..=900), 1);
    let height = Decimal::new(rng.random_range(1500..=1850), 1);
    (temp, pulse, sys, dia, rr, spo2, weight, height)
}

fn random_timestamp_in_opd_hours(
    rng: &mut StdRng,
    date: NaiveDate,
    open_hour: u8,
    close_hour: u8,
) -> DateTime<Utc> {
    random_timestamp_in_range(rng, date, open_hour, close_hour)
}

fn random_timestamp_in_range(
    rng: &mut StdRng,
    date: NaiveDate,
    start_hour: u8,
    end_hour: u8,
) -> DateTime<Utc> {
    let start = u32::from(start_hour.min(23));
    let end_raw = u32::from(end_hour.min(24));
    let end = if end_raw <= start { start + 1 } else { end_raw };
    let hour = rng.random_range(start..end);
    let minute = rng.random_range(0..60);
    let second = rng.random_range(0..60);
    let naive = date
        .and_hms_opt(hour, minute, second)
        .unwrap_or_else(|| date.and_time(chrono::NaiveTime::MIN));
    DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc)
}

fn chance(rng: &mut StdRng, p: f32) -> bool {
    rng.random::<f32>() < p
}

// ── Persistence helpers used by routes ───────────────────────────────

pub async fn insert_run(
    pool: &PgPool,
    tenant_id: Uuid,
    schedule_id: Option<Uuid>,
    triggered_by: Uuid,
    trigger_kind: &str,
) -> Result<Uuid, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO simulator_runs \
         (tenant_id, schedule_id, triggered_by, trigger_kind) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(schedule_id)
    .bind(triggered_by)
    .bind(trigger_kind)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn finalize_run(
    pool: &PgPool,
    tenant_id: Uuid,
    run_id: Uuid,
    status: &str,
    summary: &RunSummary,
    error: Option<&str>,
) -> Result<(), AppError> {
    finalize_run_with_approval(
        pool,
        tenant_id,
        run_id,
        status,
        summary,
        error,
        "auto_committed",
    )
    .await
}

pub async fn finalize_run_with_approval(
    pool: &PgPool,
    tenant_id: Uuid,
    run_id: Uuid,
    status: &str,
    summary: &RunSummary,
    error: Option<&str>,
    approval_status: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    sqlx::query(
        "UPDATE simulator_runs \
         SET finished_at = NOW(), status = $1, summary = $2, error = $3, approval_status = $6 \
         WHERE id = $4 AND tenant_id = $5",
    )
    .bind(status)
    .bind(json!(summary))
    .bind(error)
    .bind(run_id)
    .bind(tenant_id)
    .bind(approval_status)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn persist_steps(
    pool: &PgPool,
    tenant_id: Uuid,
    run_id: Uuid,
    steps: &[StepRecord],
) -> Result<(), AppError> {
    if steps.is_empty() {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    for step in steps {
        sqlx::query(
            "INSERT INTO simulator_run_steps \
             (tenant_id, run_id, step_type, target_id, success, error) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(tenant_id)
        .bind(run_id)
        .bind(step.step_type)
        .bind(step.target_id)
        .bind(step.success)
        .bind(step.error.as_deref())
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}
