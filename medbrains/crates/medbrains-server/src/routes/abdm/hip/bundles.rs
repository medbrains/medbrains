//! The NRCeS bundles a health-information transfer carries, one per care
//! context. Records are loaded per kind in one query each, plus one for
//! their line items and one for their diagnoses, however many care contexts
//! a consent names. `bundle_sections` turns the rows into IG sections.

use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_fhir::mapper::PatientView;
use medbrains_fhir::nrces::{
    DiagnosisLine, DocumentInput, EncounterInfo, LabResult, Party, RecordKind, document_bundle,
};
use serde_json::Value;
use uuid::Uuid;

use super::bundle_records::{Common, Files, build_later};
use super::bundle_sections::{Record, Rows, Who, sections};
use crate::error::AppError;

type Tx<'a, 'b> = &'a mut sqlx::Transaction<'b, sqlx::Postgres>;

/// Line items and diagnoses read per transfer, across all its records.
const ITEM_LIMIT: i64 = 5000;

/// A care context to send.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ContextRow {
    pub reference_number: String,
    pub source_kind: String,
    pub source_id: Uuid,
    pub record_date: NaiveDate,
    pub display: String,
    pub encounter_id: Option<Uuid>,
}

#[derive(sqlx::FromRow)]
struct PatientRow {
    id: Uuid,
    uhid: String,
    abha_id: Option<String>,
    first_name: String,
    last_name: String,
    gender: String,
    date_of_birth: Option<NaiveDate>,
    phone: Option<String>,
}

const AUTHOR_JOIN: &str = "LEFT JOIN users u ON u.id = {author} \
     LEFT JOIN doctor_profiles dp ON dp.user_id = u.id AND dp.tenant_id = $1 AND dp.deleted_at IS NULL";

/// Per kind: `(from, author, at, encounter columns, title, LOINC,
/// conclusion, [key, text] narratives)`. The later kinds are built in
/// `bundle_records`.
fn records_sql(kind: RecordKind) -> String {
    let (from, author, at, encounter, title, loinc, conclusion, narratives) = match kind {
        RecordKind::OpConsult => (
            "encounters x",
            "x.doctor_id",
            "x.updated_at",
            "x.id AS encounter_id, x.created_at AS encounter_start, x.updated_at AS encounter_end",
            "NULL::text",
            "NULL::text",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('complaints', x.chief_complaints), \
             jsonb_build_array('diagnosis', x.diagnosis), \
             jsonb_build_array('exam', x.examination_findings), jsonb_build_array('advice', x.advice), \
             jsonb_build_array('follow_up', concat_ws(' ', x.follow_up_date::text, x.follow_up_instructions)))",
        ),
        RecordKind::Prescription => (
            "prescriptions x",
            "x.doctor_id",
            "x.created_at",
            "x.encounter_id AS encounter_id, NULL::timestamptz AS encounter_start, NULL::timestamptz AS encounter_end",
            "NULL::text",
            "NULL::text",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('notes', x.notes))",
        ),
        RecordKind::DiagnosticReport => (
            "lab_orders x LEFT JOIN lab_test_catalog c ON c.id = x.test_id",
            "x.verified_by",
            "COALESCE(x.verified_at, x.updated_at)",
            "x.encounter_id AS encounter_id, NULL::timestamptz AS encounter_start, NULL::timestamptz AS encounter_end",
            "c.name",
            "NULLIF(c.loinc_code, '')",
            "COALESCE(NULLIF(x.interpretation, ''), NULLIF(x.notes, ''), NULLIF(x.comments, ''))",
            "'[]'::jsonb",
        ),
        RecordKind::DischargeSummary => (
            "ipd_discharge_summaries x JOIN admissions a ON a.id = x.admission_id",
            "COALESCE(x.verified_by, x.prepared_by, a.admitting_doctor)",
            "COALESCE(x.finalized_at, x.updated_at)",
            "a.encounter_id AS encounter_id, a.admitted_at AS encounter_start, a.discharged_at AS encounter_end",
            "NULL::text",
            "NULL::text",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('final_diagnosis', x.final_diagnosis), \
             jsonb_build_array('condition_at_discharge', x.condition_at_discharge), \
             jsonb_build_array('investigations', x.investigation_summary), \
             jsonb_build_array('follow_up', concat_ws(' ', x.follow_up_date::text, x.follow_up_instructions)), \
             jsonb_build_array('course', x.course_in_hospital), \
             jsonb_build_array('treatment', x.treatment_given))",
        ),
        RecordKind::Immunization
        | RecordKind::Wellness
        | RecordKind::HealthDocument
        | RecordKind::Invoice => return String::new(),
    };
    format!(
        "SELECT x.id, {at} AS at, {title} AS title, u.id AS author_id, u.full_name AS author_name, \
                dp.hpr_id AS author_hpr, {narratives} AS narratives, {loinc} AS loinc, \
                {conclusion} AS conclusion, {encounter} \
           FROM {from} {join} WHERE x.tenant_id = $1 AND x.id = ANY($2)",
        join = AUTHOR_JOIN.replace("{author}", author),
    )
}

#[derive(sqlx::FromRow)]
struct DiagnosisRow {
    id: Uuid,
    encounter_id: Uuid,
    icd_system: String,
    icd_code: Option<String>,
    icd_display: Option<String>,
    snomed_code: Option<String>,
    snomed_display: Option<String>,
    description: String,
    certainty: Option<String>,
    onset_date: Option<NaiveDate>,
    resolved_date: Option<NaiveDate>,
    created_at: DateTime<Utc>,
}

/// The coded diagnoses of the given visits and admissions. A ruled-out one
/// is left out: an HIU that ignores verification status would read it as
/// the diagnosis.
async fn diagnoses(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    encounter_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<DiagnosisLine>>, AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: Vec<DiagnosisRow> = sqlx::query_as(
        "SELECT id, encounter_id, icd_system, icd_code, icd_display, snomed_code, snomed_display, \
                description, certainty, onset_date, resolved_date, created_at \
           FROM diagnoses WHERE tenant_id = $1 AND encounter_id = ANY($2) AND deleted_at IS NULL \
            AND certainty IS DISTINCT FROM 'ruled_out' \
          ORDER BY is_primary DESC, created_at LIMIT $3",
    )
    .bind(tenant_id)
    .bind(encounter_ids)
    .bind(ITEM_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut out: HashMap<Uuid, Vec<DiagnosisLine>> = HashMap::new();
    for r in rows {
        out.entry(r.encounter_id).or_default().push(DiagnosisLine {
            id: r.id,
            icd_system: r.icd_system,
            icd_code: r.icd_code,
            icd_display: r.icd_display,
            snomed_code: r.snomed_code,
            snomed_display: r.snomed_display,
            description: r.description,
            certainty: r.certainty,
            onset: r.onset_date,
            resolved: r.resolved_date,
            recorded: r.created_at,
        });
    }
    Ok(out)
}

#[derive(sqlx::FromRow)]
struct ResultRow {
    id: Uuid,
    order_id: Uuid,
    name: String,
    value: String,
    numeric: Option<f64>,
    unit: Option<String>,
    range: Option<String>,
    flag: Option<String>,
    loinc: Option<String>,
}

/// Prescription items as `(prescription, drug, instructions)`, and lab
/// results by order. The test's LOINC code goes on a result only when it is
/// the test's single result; a panel's code does not name its analytes.
async fn items(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    kind: RecordKind,
    ids: &[Uuid],
    rows: &mut Rows,
) -> Result<(), AppError> {
    match kind {
        RecordKind::Prescription => {
            // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
            let drugs: Vec<(Uuid, String, String)> = sqlx::query_as(
                "SELECT prescription_id, drug_name, concat_ws(' ', dosage, frequency, 'for', duration, route, instructions) \
                   FROM prescription_items WHERE tenant_id = $1 AND prescription_id = ANY($2) AND deleted_at IS NULL \
                  ORDER BY created_at LIMIT $3",
            )
            .bind(tenant_id)
            .bind(ids)
            .bind(ITEM_LIMIT)
            .fetch_all(&mut **tx)
            .await?;
            for (rx, drug, how) in drugs {
                rows.drugs.entry(rx).or_default().push((drug, how));
            }
        }
        RecordKind::DiagnosticReport => {
            // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
            let results: Vec<ResultRow> = sqlx::query_as(
                "SELECT r.id, r.order_id, r.parameter_name AS name, r.value, r.numeric_value::float8 AS numeric, \
                        r.unit, COALESCE(NULLIF(r.reference_range, ''), NULLIF(r.normal_range, '')) AS range, \
                        r.flag::text AS flag, \
                        CASE WHEN count(*) OVER (PARTITION BY r.order_id) = 1 THEN NULLIF(c.loinc_code, '') END AS loinc \
                   FROM lab_results r \
                   JOIN lab_orders lo ON lo.id = r.order_id AND lo.tenant_id = r.tenant_id \
                   LEFT JOIN lab_test_catalog c ON c.id = lo.test_id \
                  WHERE r.tenant_id = $1 AND r.order_id = ANY($2) AND r.deleted_at IS NULL \
                  ORDER BY r.display_order, r.created_at LIMIT $3",
            )
            .bind(tenant_id)
            .bind(ids)
            .bind(ITEM_LIMIT)
            .fetch_all(&mut **tx)
            .await?;
            for r in results {
                rows.results.entry(r.order_id).or_default().push(LabResult {
                    id: r.id,
                    name: r.name,
                    value: r.value,
                    numeric: r.numeric,
                    unit: r.unit,
                    range: r.range,
                    flag: r.flag,
                    loinc: r.loinc,
                });
            }
        }
        _ => {}
    }
    Ok(())
}

async fn patient(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientView, AppError> {
    let r = sqlx::query_as::<_, PatientRow>(
        "SELECT p.id, p.uhid, COALESCE(l.abha_number, p.abha_id) AS abha_id, p.first_name, p.last_name, \
                p.gender::text AS gender, p.date_of_birth, p.phone \
           FROM patients p LEFT JOIN LATERAL (SELECT abha_number FROM patient_abha_links l \
                WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id AND l.verified_at IS NOT NULL \
                  AND l.deleted_at IS NULL ORDER BY l.verified_at DESC LIMIT 1) l ON true \
          WHERE p.tenant_id = $1 AND p.id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(PatientView {
        id: r.id,
        uhid: r.uhid,
        abha_id: r.abha_id,
        prefix: None,
        first_name: r.first_name,
        middle_name: None,
        last_name: r.last_name,
        gender: r.gender,
        date_of_birth: r.date_of_birth,
        phone: r.phone,
        email: None,
        is_active: true,
    })
}

/// The campus records are shared as; a hospital with no campus row yet is
/// named by its tenant, so every bundle has a custodian (and an author).
async fn custodian(tx: Tx<'_, '_>, tenant_id: Uuid) -> Result<Party, AppError> {
    let row = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT id, name, hfr FROM ( \
            SELECT f.id, f.name, f.hfr_facility_id AS hfr, 0 AS rank, \
                   (f.hfr_facility_id IS NOT NULL) AS has_hfr, (f.facility_type = 'main_hospital') AS main, f.created_at \
              FROM facilities f WHERE f.tenant_id = $1 AND f.deleted_at IS NULL AND f.parent_id IS NULL \
            UNION ALL SELECT t.id, t.name, NULL, 1, false, false, t.created_at FROM tenants t WHERE t.id = $1 \
          ) c ORDER BY rank, has_hfr DESC, main DESC, created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Party {
        id: row.0,
        name: row.1,
        registry_id: row.2,
    })
}

/// One NRCeS bundle per care context, keyed by its reference number. A care
/// context whose record no longer exists — or a document whose bytes are
/// not in `files` — is left out.
///
/// # Errors
/// Database faults; 404 for an unknown patient.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn build(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    contexts: &[ContextRow],
    files: &Files,
) -> Result<Vec<(String, Value)>, AppError> {
    let patient = patient(tx, tenant_id, patient_id).await?;
    let custodian = custodian(tx, tenant_id).await?;
    let mut out = Vec::with_capacity(contexts.len());
    for kind in [
        RecordKind::OpConsult,
        RecordKind::Prescription,
        RecordKind::DiagnosticReport,
        RecordKind::DischargeSummary,
    ] {
        let mine: Vec<&ContextRow> = contexts
            .iter()
            .filter(|c| RecordKind::from_source_kind(&c.source_kind) == Some(kind))
            .collect();
        if mine.is_empty() {
            continue;
        }
        let ids: Vec<Uuid> = mine.iter().map(|c| c.source_id).collect();
        let records: HashMap<Uuid, Record> = sqlx::query_as::<_, Record>(&records_sql(kind))
            .bind(tenant_id)
            .bind(&ids)
            .fetch_all(&mut **tx)
            .await?
            .into_iter()
            .map(|r| (r.id, r))
            .collect();
        let mut rows = Rows::default();
        items(tx, tenant_id, kind, &ids, &mut rows).await?;
        if matches!(kind, RecordKind::OpConsult | RecordKind::DischargeSummary) {
            let encounters: Vec<Uuid> = records.values().map(|r| r.encounter_id).collect();
            rows.diagnoses = diagnoses(tx, tenant_id, &encounters).await?;
        }
        for c in mine {
            let Some(record) = records.get(&c.source_id) else {
                continue;
            };
            let author = record.author_id.map(|id| Party {
                id,
                name: record.author_name.clone().unwrap_or_default(),
                registry_id: record.author_hpr.clone(),
            });
            let who = Who {
                patient_id: patient.id,
                author: author.as_ref(),
                custodian: &custodian,
            };
            let (sections, resources) = sections(kind, record, &rows, &who);
            let bundle = document_bundle(&DocumentInput {
                kind,
                id: Uuid::new_v4(),
                date: record.at,
                title: c.display.clone(),
                patient: &patient,
                author,
                custodian: custodian.clone(),
                encounter: Some(EncounterInfo {
                    id: record.encounter_id,
                    inpatient: kind == RecordKind::DischargeSummary,
                    start: record.encounter_start,
                    end: record.encounter_end,
                }),
                sections,
                resources,
            });
            out.push((c.reference_number.clone(), bundle));
        }
    }
    let common = Common {
        tenant_id,
        patient: &patient,
        custodian: &custodian,
    };
    build_later(tx, &common, contexts, files, &mut out).await?;
    Ok(out)
}
