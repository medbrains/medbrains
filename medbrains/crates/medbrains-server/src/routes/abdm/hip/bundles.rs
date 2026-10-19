//! The NRCeS bundles a health-information transfer carries, one per care
//! context. Records are loaded per kind in one query each (plus one for
//! their line items), however many care contexts a consent names.

use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_fhir::mapper::PatientView;
use medbrains_fhir::nrces::{
    DocumentInput, Party, RecordKind, Section, diagnostic_report, document_bundle,
    medication_request, observation,
};
use serde_json::Value;
use uuid::Uuid;

use crate::error::AppError;

type Tx<'a, 'b> = &'a mut sqlx::Transaction<'b, sqlx::Postgres>;

/// `(parent id, name, detail, unit)`: a drug or a lab result.
type Item = (Uuid, String, String, Option<String>);

/// Line items read per transfer, across all its records.
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

/// One clinical record's text, author and time, whatever its kind.
#[derive(sqlx::FromRow)]
struct Record {
    id: Uuid,
    at: DateTime<Utc>,
    title: Option<String>,
    author_id: Option<Uuid>,
    author_name: Option<String>,
    author_hpr: Option<String>,
    /// `[title, text]` pairs for narrative sections.
    sections: Value,
}

const AUTHOR_JOIN: &str = "LEFT JOIN users u ON u.id = {author} \
     LEFT JOIN doctor_profiles dp ON dp.user_id = u.id AND dp.tenant_id = $1 AND dp.deleted_at IS NULL";

fn records_sql(kind: RecordKind) -> String {
    let (from, author, at, title, sections) = match kind {
        RecordKind::OpConsult => (
            "encounters x",
            "x.doctor_id",
            "x.updated_at",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('Chief complaints', x.chief_complaints), \
             jsonb_build_array('Physical examination', x.examination_findings), \
             jsonb_build_array('Diagnosis', x.diagnosis), jsonb_build_array('Advice', x.advice), \
             jsonb_build_array('Follow up', concat_ws(' ', x.follow_up_date::text, x.follow_up_instructions)))",
        ),
        RecordKind::Prescription => (
            "prescriptions x",
            "x.doctor_id",
            "x.created_at",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('Notes', x.notes))",
        ),
        RecordKind::DiagnosticReport => (
            "lab_orders x LEFT JOIN lab_test_catalog c ON c.id = x.test_id",
            "x.verified_by",
            "COALESCE(x.verified_at, x.updated_at)",
            "c.name",
            "jsonb_build_array(jsonb_build_array('Notes', x.notes))",
        ),
        RecordKind::DischargeSummary => (
            "ipd_discharge_summaries x JOIN admissions a ON a.id = x.admission_id",
            "COALESCE(x.verified_by, x.prepared_by, a.admitting_doctor)",
            "COALESCE(x.finalized_at, x.updated_at)",
            "NULL::text",
            "jsonb_build_array(jsonb_build_array('Final diagnosis', x.final_diagnosis), \
             jsonb_build_array('Course in hospital', x.course_in_hospital), \
             jsonb_build_array('Treatment given', x.treatment_given), \
             jsonb_build_array('Investigations', x.investigation_summary), \
             jsonb_build_array('Condition at discharge', x.condition_at_discharge), \
             jsonb_build_array('Follow up', x.follow_up_instructions))",
        ),
    };
    format!(
        "SELECT x.id, {at} AS at, {title} AS title, u.id AS author_id, u.full_name AS author_name, \
                dp.hpr_id AS author_hpr, {sections} AS sections \
           FROM {from} {join} WHERE x.tenant_id = $1 AND x.id = ANY($2)",
        join = AUTHOR_JOIN.replace("{author}", author),
    )
}

/// `(parent id, name, detail, unit)` line items: drugs or lab results.
async fn items(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    kind: RecordKind,
    ids: &[Uuid],
) -> Result<Vec<Item>, AppError> {
    let sql = match kind {
        RecordKind::Prescription => {
            "SELECT prescription_id, drug_name, concat_ws(' ', dosage, frequency, 'for', duration, route, instructions), NULL::text \
               FROM prescription_items WHERE tenant_id = $1 AND prescription_id = ANY($2) AND deleted_at IS NULL \
              ORDER BY created_at LIMIT $3"
        }
        RecordKind::DiagnosticReport => {
            "SELECT order_id, parameter_name, value, unit FROM lab_results \
              WHERE tenant_id = $1 AND order_id = ANY($2) ORDER BY created_at LIMIT $3"
        }
        RecordKind::OpConsult | RecordKind::DischargeSummary => return Ok(Vec::new()),
    };
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    Ok(sqlx::query_as(sql)
        .bind(tenant_id)
        .bind(ids)
        .bind(ITEM_LIMIT)
        .fetch_all(&mut **tx)
        .await?)
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

async fn custodian(tx: Tx<'_, '_>, tenant_id: Uuid) -> Result<Option<Party>, AppError> {
    let row = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT f.id, f.name, f.hfr_facility_id FROM facilities f \
          WHERE f.tenant_id = $1 AND f.deleted_at IS NULL AND f.parent_id IS NULL \
          ORDER BY (f.hfr_facility_id IS NOT NULL) DESC, (f.facility_type = 'main_hospital') DESC, \
                   f.created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|(id, name, registry_id)| Party {
        id,
        name,
        registry_id,
    }))
}

/// SNOMED CT section codes the NRCeS profiles use for each narrative.
fn section_code(title: &str, kind: RecordKind) -> (&'static str, &'static str) {
    match title {
        "Chief complaints" => ("422843007", "Chief complaint section"),
        "Physical examination" => ("425044008", "Physical exam section"),
        "Diagnosis" | "Final diagnosis" | "Condition at discharge" => ("439401001", "Diagnosis"),
        "Investigations" => ("721981007", "Diagnostic studies report"),
        "Advice" | "Follow up" | "Course in hospital" | "Treatment given" => {
            ("736271009", "Outpatient care plan")
        }
        _ => kind.type_code(),
    }
}

fn sections(kind: RecordKind, record: &Record, patient_id: Uuid, lines: &[&Item]) -> Vec<Section> {
    let mut out: Vec<Section> = record
        .sections
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|pair| {
            let text = pair[1].as_str().map(str::trim).filter(|t| !t.is_empty())?;
            let title = pair[0].as_str().unwrap_or_default();
            Some(Section {
                title: title.to_owned(),
                code: section_code(title, kind),
                lines: vec![text.to_owned()],
                entries: Vec::new(),
            })
        })
        .collect();
    let title = record
        .title
        .clone()
        .unwrap_or_else(|| "Lab report".to_owned());
    match kind {
        RecordKind::Prescription => out.push(Section {
            title: "Prescription".to_owned(),
            code: ("440545006", "Prescription record"),
            lines: Vec::new(),
            entries: lines
                .iter()
                .map(|(_, drug, how, _)| medication_request(patient_id, record.at, drug, how))
                .collect(),
        }),
        RecordKind::DiagnosticReport => {
            let results: Vec<Value> = lines
                .iter()
                .map(|(_, name, value, unit)| observation(patient_id, name, value, unit.as_deref()))
                .collect();
            let mut entries = vec![diagnostic_report(patient_id, &title, record.at, &results)];
            entries.extend(results);
            out.push(Section {
                title,
                code: ("721981007", "Diagnostic studies report"),
                lines: Vec::new(),
                entries,
            });
        }
        RecordKind::OpConsult | RecordKind::DischargeSummary => {}
    }
    out
}

/// One NRCeS bundle per care context, keyed by its reference number. A care
/// context whose record no longer exists is left out.
///
/// # Errors
/// Database faults; 404 for an unknown patient.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn build(
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    contexts: &[ContextRow],
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
        let all_items = items(tx, tenant_id, kind, &ids).await?;
        let mut by_record: HashMap<Uuid, Vec<&Item>> = HashMap::new();
        for item in &all_items {
            by_record.entry(item.0).or_default().push(item);
        }
        for c in mine {
            let Some(record) = records.get(&c.source_id) else {
                continue;
            };
            let lines = by_record.remove(&c.source_id).unwrap_or_default();
            let bundle = document_bundle(&DocumentInput {
                kind,
                id: Uuid::new_v4(),
                date: record.at,
                title: c.display.clone(),
                patient: &patient,
                author: record.author_id.map(|id| Party {
                    id,
                    name: record.author_name.clone().unwrap_or_default(),
                    registry_id: record.author_hpr.clone(),
                }),
                custodian: custodian.clone(),
                encounter_id: c.encounter_id,
                sections: sections(kind, record, patient.id, &lines),
            });
            out.push((c.reference_number.clone(), bundle));
        }
    }
    Ok(out)
}
