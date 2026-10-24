//! The bundles of ABDM's four later HI types (migration 1205): immunisations,
//! a visit's vital signs, uploaded clinical documents and issued bills. One
//! query per kind and one for invoice lines, however many care contexts a
//! consent names; `medbrains_fhir::nrces::records` builds the resources.
//! Documents are in `bundle_files`, bills in `bundle_bills`.

use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_fhir::mapper::PatientView;
use medbrains_fhir::nrces::{
    Clinical, DocumentInput, EncounterInfo, ImmunizationLine, Party, RecordKind, Section,
    VitalsLine, author_reference, document_bundle, immunization,
    sections::{IMMUNIZATION, SectionCode},
    vital_observations,
};
use serde_json::Value;
use uuid::Uuid;

use super::bundles::ContextRow;
use crate::error::AppError;

pub(super) type Tx<'a, 'b> = &'a mut sqlx::Transaction<'b, sqlx::Postgres>;

/// Readings and bill lines read per transfer, across all its records.
pub(super) const ITEM_LIMIT: i64 = 5000;
/// The largest document sent inline; ABDM's push carries the whole bundle.
pub(super) const MAX_DOCUMENT_BYTES: usize = 10 * 1024 * 1024;

pub use super::bundle_files::{Files, document_files};

/// What every bundle of one patient shares.
pub struct Common<'a> {
    pub tenant_id: Uuid,
    pub patient: &'a PatientView,
    pub custodian: &'a Party,
}

#[derive(sqlx::FromRow)]
pub(super) struct Who {
    pub(super) id: Uuid,
    pub(super) author_id: Option<Uuid>,
    pub(super) author_name: Option<String>,
    pub(super) author_hpr: Option<String>,
    pub(super) encounter_id: Option<Uuid>,
    pub(super) encounter_start: Option<DateTime<Utc>>,
    pub(super) inpatient: Option<bool>,
}

impl Who {
    pub(super) fn author(&self) -> Option<Party> {
        self.author_id.map(|id| Party {
            id,
            name: self.author_name.clone().unwrap_or_default(),
            registry_id: self.author_hpr.clone(),
        })
    }

    pub(super) fn encounter(&self) -> Option<EncounterInfo> {
        self.encounter_id.map(|id| EncounterInfo {
            id,
            inpatient: self.inpatient.unwrap_or(false),
            start: self.encounter_start,
            end: None,
        })
    }
}

/// `who` columns for a record whose author is `{author}` and visit `{visit}`.
pub(super) fn who(author: &str, visit: &str) -> String {
    format!(
        "u.id AS author_id, u.full_name AS author_name, dp.hpr_id AS author_hpr, \
         e.id AS encounter_id, e.created_at AS encounter_start, \
         (e.encounter_type::text = 'ipd') AS inpatient \
         FROM {{from}} \
         LEFT JOIN users u ON u.id = {author} \
         LEFT JOIN doctor_profiles dp ON dp.user_id = u.id AND dp.tenant_id = $1 AND dp.deleted_at IS NULL \
         LEFT JOIN encounters e ON e.id = {visit}"
    )
}

#[derive(sqlx::FromRow)]
struct ShotRow {
    #[sqlx(flatten)]
    who: Who,
    vaccine_name: String,
    vaccine_code: Option<String>,
    dose_number: Option<i32>,
    administered_on: NaiveDate,
    lot_number: Option<String>,
    route: Option<String>,
    given_elsewhere: bool,
}

#[derive(sqlx::FromRow)]
struct VitalsRow {
    encounter: Uuid,
    at: DateTime<Utc>,
    recorded_by: Uuid,
    temperature: Option<f64>,
    pulse: Option<f64>,
    systolic: Option<f64>,
    diastolic: Option<f64>,
    respiratory_rate: Option<f64>,
    spo2: Option<f64>,
    weight_kg: Option<f64>,
    height_cm: Option<f64>,
    bmi: Option<f64>,
}

/// The bundles of the later kinds among `contexts`, keyed by reference.
///
/// # Errors
/// Database faults.
#[tracing::instrument(skip_all, fields(tenant_id = %c.tenant_id))]
pub async fn build_later(
    tx: Tx<'_, '_>,
    c: &Common<'_>,
    contexts: &[ContextRow],
    files: &Files,
    out: &mut Vec<(String, Value)>,
) -> Result<(), AppError> {
    let of = |kind: RecordKind| -> Vec<&ContextRow> {
        contexts
            .iter()
            .filter(|x| RecordKind::from_source_kind(&x.source_kind) == Some(kind))
            .collect()
    };
    immunizations(tx, c, &of(RecordKind::Immunization), out).await?;
    wellness(tx, c, &of(RecordKind::Wellness), out).await?;
    super::bundle_files::documents(tx, c, &of(RecordKind::HealthDocument), files, out).await?;
    super::bundle_bills::invoices(tx, c, &of(RecordKind::Invoice), out).await
}

pub(super) fn ids(mine: &[&ContextRow]) -> Vec<Uuid> {
    mine.iter().map(|c| c.source_id).collect()
}

pub(super) struct One<'a> {
    pub(super) kind: RecordKind,
    pub(super) context: &'a ContextRow,
    pub(super) at: DateTime<Utc>,
    pub(super) author: Option<Party>,
    pub(super) encounter: Option<EncounterInfo>,
    pub(super) sections: Vec<Section>,
}

pub(super) fn bundle(c: &Common<'_>, one: One<'_>) -> (String, Value) {
    let b = document_bundle(&DocumentInput {
        kind: one.kind,
        id: Uuid::new_v4(),
        date: one.at,
        title: one.context.display.clone(),
        patient: c.patient,
        author: one.author,
        custodian: c.custodian.clone(),
        encounter: one.encounter,
        sections: one.sections,
        resources: Vec::new(),
    });
    (one.context.reference_number.clone(), b)
}

pub(super) fn clinical(
    c: &Common<'_>,
    author: Option<&Party>,
    encounter: Option<Uuid>,
    at: DateTime<Utc>,
) -> Clinical {
    Clinical {
        patient_id: c.patient.id,
        encounter_id: encounter,
        at,
        practitioner: author_reference(author, c.custodian),
    }
}

pub(super) fn section(title: &str, code: Option<SectionCode>, entries: Vec<Value>) -> Section {
    Section {
        title: title.to_owned(),
        code,
        lines: Vec::new(),
        entries,
    }
}

async fn immunizations(
    tx: Tx<'_, '_>,
    c: &Common<'_>,
    mine: &[&ContextRow],
    out: &mut Vec<(String, Value)>,
) -> Result<(), AppError> {
    if mine.is_empty() {
        return Ok(());
    }
    let sql = format!(
        "SELECT x.id, x.vaccine_name, x.vaccine_code, x.dose_number, x.administered_on, \
                x.lot_number, x.route, x.given_elsewhere, {} \
          WHERE x.tenant_id = $1 AND x.id = ANY($2) AND x.deleted_at IS NULL",
        who("x.recorded_by", "x.encounter_id").replace("{from}", "patient_immunizations x")
    );
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: HashMap<Uuid, ShotRow> = sqlx::query_as::<_, ShotRow>(&sql)
        .bind(c.tenant_id)
        .bind(ids(mine))
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|r| (r.who.id, r))
        .collect();
    for context in mine {
        let Some(r) = rows.get(&context.source_id) else {
            continue;
        };
        let author = r.who.author();
        let at = r.administered_on.and_time(chrono::NaiveTime::MIN).and_utc();
        let ctx = clinical(c, author.as_ref(), r.who.encounter_id, at);
        let shot = immunization(
            &ctx,
            &ImmunizationLine {
                id: r.who.id,
                vaccine: r.vaccine_name.clone(),
                code: r.vaccine_code.clone().filter(|v| !v.trim().is_empty()),
                on: r.administered_on,
                dose: r.dose_number,
                lot: r.lot_number.clone(),
                route: r.route.clone(),
                given_elsewhere: r.given_elsewhere,
            },
        );
        out.push(bundle(
            c,
            One {
                kind: RecordKind::Immunization,
                context,
                at,
                author,
                encounter: r.who.encounter(),
                sections: vec![section(
                    "Immunization record",
                    Some(IMMUNIZATION),
                    vec![shot],
                )],
            },
        ));
    }
    Ok(())
}

async fn wellness(
    tx: Tx<'_, '_>,
    c: &Common<'_>,
    mine: &[&ContextRow],
    out: &mut Vec<(String, Value)>,
) -> Result<(), AppError> {
    if mine.is_empty() {
        return Ok(());
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: Vec<VitalsRow> = sqlx::query_as(
        "SELECT encounter_id AS encounter, recorded_at AS at, recorded_by, \
                temperature::float8 AS temperature, COALESCE(pulse, pulse_rate)::float8 AS pulse, \
                COALESCE(systolic_bp, bp_systolic)::float8 AS systolic, \
                COALESCE(diastolic_bp, bp_diastolic)::float8 AS diastolic, \
                respiratory_rate::float8 AS respiratory_rate, spo2::float8 AS spo2, \
                weight_kg::float8 AS weight_kg, height_cm::float8 AS height_cm, bmi::float8 AS bmi \
           FROM vitals WHERE tenant_id = $1 AND encounter_id = ANY($2) AND deleted_at IS NULL \
          ORDER BY recorded_at DESC LIMIT $3",
    )
    .bind(c.tenant_id)
    .bind(ids(mine))
    .bind(ITEM_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_visit: HashMap<Uuid, Vec<VitalsRow>> = HashMap::new();
    for r in rows {
        by_visit.entry(r.encounter).or_default().push(r);
    }
    let authors = parties(
        tx,
        c.tenant_id,
        by_visit.values().flatten().map(|r| r.recorded_by),
    )
    .await?;
    for context in mine {
        let Some(readings) = by_visit.get(&context.source_id) else {
            continue;
        };
        let at = readings.first().map_or_else(Utc::now, |r| r.at);
        let author = readings
            .first()
            .and_then(|r| authors.get(&r.recorded_by))
            .cloned();
        let ctx = clinical(c, author.as_ref(), Some(context.source_id), at);
        let lines: Vec<VitalsLine> = readings
            .iter()
            .map(|r| VitalsLine {
                at: Some(r.at),
                temperature_c: r.temperature,
                pulse: r.pulse,
                systolic: r.systolic,
                diastolic: r.diastolic,
                respiratory_rate: r.respiratory_rate,
                spo2: r.spo2,
                weight_kg: r.weight_kg,
                height_cm: r.height_cm,
                bmi: r.bmi,
            })
            .collect();
        let (vitals, body) = vital_observations(&ctx, &lines);
        let mut sections: Vec<Section> = Vec::new();
        if !vitals.is_empty() {
            sections.push(section("Vital Signs", None, vitals));
        }
        if !body.is_empty() {
            sections.push(section("Body Measurement", None, body));
        }
        if sections.is_empty() {
            continue;
        }
        out.push(bundle(
            c,
            One {
                kind: RecordKind::Wellness,
                context,
                at,
                author,
                encounter: Some(EncounterInfo {
                    id: context.source_id,
                    inpatient: false,
                    start: Some(at),
                    end: None,
                }),
                sections,
            },
        ));
    }
    Ok(())
}

/// Staff names and HPR IDs, once each.
async fn parties(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    users: impl Iterator<Item = Uuid>,
) -> Result<HashMap<Uuid, Party>, AppError> {
    let mut wanted: Vec<Uuid> = users.collect();
    wanted.sort_unstable();
    wanted.dedup();
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: Vec<(Uuid, String, Option<String>)> = sqlx::query_as(
        "SELECT u.id, u.full_name, dp.hpr_id FROM users u \
           LEFT JOIN doctor_profiles dp ON dp.user_id = u.id AND dp.tenant_id = $1 AND dp.deleted_at IS NULL \
          WHERE u.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&wanted)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, name, hpr)| {
            (
                id,
                Party {
                    id,
                    name,
                    registry_id: hpr,
                },
            )
        })
        .collect())
}
