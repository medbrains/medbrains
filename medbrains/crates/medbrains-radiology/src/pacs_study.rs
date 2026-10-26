//! A study in the PACS, read and filed.
//!
//! What it is, which order it belongs to, the dose it carries — and, when no
//! order claims it, the queue a person matches it from. Shared by the PACS
//! sync and the reconcile screen, so a study is filed the same way however it
//! was matched.

use chrono::NaiveDate;
use medbrains_outbox::handlers::pacs_target::Target;
use medbrains_server_core::error::AppError;
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::dose::{CapturedStudy, store_captured};
use crate::dose_capture::{self, CapturedDose};

/// Series and images read per study for its dose; a study bigger than this
/// still gets its RDSR, which is one object.
const MAX_SERIES: usize = 32;
const MAX_PROJECTION_IMAGES: usize = 50;
const MAX_SR_PER_SERIES: usize = 4;

/// GET a PACS path as JSON. An unreachable PACS is a 503, never "nothing".
///
/// # Errors
/// The PACS was unreachable, refused, or answered something not JSON.
pub async fn pacs_get(target: &Target, path: &str) -> Result<Value, AppError> {
    let response = target
        .get(path)
        .send()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("PACS unreachable: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::ServiceUnavailable(format!(
            "PACS answered {} for {path}",
            response.status()
        )));
    }
    response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("PACS reply for {path}: {e}")))
}

/// What the modality wrote into a study, and its size.
#[derive(Debug, Clone, Default)]
pub struct StudyFacts {
    pub orthanc_id: String,
    pub uid: String,
    pub accession: String,
    pub dicom_patient_id: String,
    pub dicom_patient_name: String,
    pub dicom_birth_date: Option<NaiveDate>,
    pub dicom_sex: String,
    pub modality: String,
    pub study_date: Option<NaiveDate>,
    pub description: String,
    pub instances: i32,
    pub series: i32,
    pub disk_size: i64,
}

fn dicom_date(raw: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(raw, "%Y%m%d").ok()
}

/// Read one study's tags and statistics.
///
/// # Errors
/// As [`pacs_get`].
pub async fn read_study(target: &Target, orthanc_id: &str) -> Result<StudyFacts, AppError> {
    let study = pacs_get(
        target,
        &format!("/studies/{orthanc_id}?requested-tags=ModalitiesInStudy"),
    )
    .await?;
    let stats = pacs_get(target, &format!("/studies/{orthanc_id}/statistics")).await?;
    let study_tag = |k: &str| {
        study["MainDicomTags"][k]
            .as_str()
            .unwrap_or_default()
            .trim()
            .to_owned()
    };
    let patient_tag = |k: &str| {
        study["PatientMainDicomTags"][k]
            .as_str()
            .unwrap_or_default()
            .trim()
            .to_owned()
    };
    let count = |k: &str| {
        stats[k]
            .as_i64()
            .or_else(|| stats[k].as_str().and_then(|s| s.parse().ok()))
            .unwrap_or(0)
    };
    Ok(StudyFacts {
        orthanc_id: orthanc_id.to_owned(),
        uid: study_tag("StudyInstanceUID"),
        accession: study_tag("AccessionNumber"),
        dicom_patient_id: patient_tag("PatientID"),
        dicom_patient_name: patient_tag("PatientName")
            .replace('^', " ")
            .trim()
            .to_owned(),
        dicom_birth_date: dicom_date(&patient_tag("PatientBirthDate")),
        dicom_sex: patient_tag("PatientSex"),
        modality: study["RequestedTags"]["ModalitiesInStudy"]
            .as_str()
            .unwrap_or_default()
            .split('\\')
            .next()
            .unwrap_or_default()
            .to_owned(),
        study_date: dicom_date(&study_tag("StudyDate")),
        description: study_tag("StudyDescription"),
        instances: i32::try_from(count("CountInstances")).unwrap_or(i32::MAX),
        series: i32::try_from(count("CountSeries")).unwrap_or(i32::MAX),
        disk_size: count("DiskSize"),
    })
}

/// The order a study is filed under.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrderRef {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub modality: String,
}

/// File a study under its order and mark the exam done. Returns the
/// `radiology_dicom_studies` row. `base` is the PACS address, for the viewer
/// link; `None` leaves the study without one.
///
/// # Errors
/// Database errors.
pub async fn attach_study(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order: &OrderRef,
    facts: &StudyFacts,
    base: Option<&str>,
) -> Result<Uuid, AppError> {
    let viewer = base.map(|b| format!("{b}/ohif/viewer?StudyInstanceUIDs={}", facts.uid));
    let study_row: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_dicom_studies \
           (tenant_id, order_id, patient_id, study_instance_uid, accession_number, modality, \
            study_date, study_description, instance_count, series_count, orthanc_id, pacs_url, \
            viewer_url, file_size_bytes) \
         VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, NULLIF($8, ''), $9, $10, $11, $12, $13, $14) \
         ON CONFLICT (tenant_id, study_instance_uid) DO UPDATE SET \
           instance_count = EXCLUDED.instance_count, series_count = EXCLUDED.series_count, \
           file_size_bytes = EXCLUDED.file_size_bytes, updated_at = now(), \
           deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(order.id)
    .bind(order.patient_id)
    .bind(&facts.uid)
    .bind(&facts.accession)
    .bind(&order.modality)
    .bind(facts.study_date)
    .bind(&facts.description)
    .bind(facts.instances)
    .bind(facts.series)
    .bind(&facts.orthanc_id)
    .bind(base)
    .bind(viewer)
    .bind(facts.disk_size)
    .fetch_one(&mut **tx)
    .await?;
    // The images are in: the exam is done, and the radiologist can report it.
    sqlx::query(
        "UPDATE radiology_orders SET pacs_study_uid = $1, orthanc_id = $2, \
                status = CASE WHEN status::text IN ('ordered', 'scheduled', 'in_progress') \
                              THEN 'completed'::radiology_order_status ELSE status END, \
                completed_at = COALESCE(completed_at, now()), updated_at = now() \
          WHERE id = $3 AND tenant_id = $4",
    )
    .bind(&facts.uid)
    .bind(&facts.orthanc_id)
    .bind(order.id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(study_row)
}

/// Queue a study no order claims, for a person to match. Seen again while
/// still open, its image counts are refreshed; once resolved it is left alone.
///
/// # Errors
/// Database errors.
pub async fn queue_unmatched(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    facts: &StudyFacts,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO radiology_unmatched_studies \
           (tenant_id, orthanc_id, study_instance_uid, accession_number, dicom_patient_id, \
            dicom_patient_name, dicom_birth_date, dicom_sex, modality, study_date, \
            study_description, instance_count, series_count) \
         VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7, NULLIF($8, ''), \
                 NULLIF($9, ''), $10, NULLIF($11, ''), $12, $13) \
         ON CONFLICT (tenant_id, study_instance_uid) WHERE deleted_at IS NULL DO UPDATE SET \
           instance_count = EXCLUDED.instance_count, series_count = EXCLUDED.series_count, \
           orthanc_id = EXCLUDED.orthanc_id, updated_at = now() \
         WHERE radiology_unmatched_studies.status = 'open'",
    )
    .bind(tenant_id)
    .bind(&facts.orthanc_id)
    .bind(&facts.uid)
    .bind(&facts.accession)
    .bind(&facts.dicom_patient_id)
    .bind(&facts.dicom_patient_name)
    .bind(facts.dicom_birth_date)
    .bind(&facts.dicom_sex)
    .bind(&facts.modality)
    .bind(facts.study_date)
    .bind(&facts.description)
    .bind(facts.instances)
    .bind(facts.series)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Read a study's dose: its RDSR when the scanner sent one, otherwise the
/// image headers. Returns the figures and their source.
///
/// # Errors
/// As [`pacs_get`].
pub async fn read_dose(
    target: &Target,
    orthanc_id: &str,
) -> Result<(CapturedDose, &'static str), AppError> {
    let series = pacs_get(target, &format!("/studies/{orthanc_id}/series")).await?;
    let mut headers: Vec<(String, Value)> = Vec::new();
    for s in series.as_array().into_iter().flatten().take(MAX_SERIES) {
        let modality = s["MainDicomTags"]["Modality"]
            .as_str()
            .unwrap_or_default()
            .to_owned();
        let take = match modality.as_str() {
            "SR" => MAX_SR_PER_SERIES,
            m if dose_capture::is_projection(m) => MAX_PROJECTION_IMAGES,
            _ => 1,
        };
        let instances = s["Instances"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str);
        for instance in instances.take(take) {
            let tags = pacs_get(target, &format!("/instances/{instance}/tags?simplify")).await?;
            if let Some(found) = dose_capture::from_rdsr(&tags) {
                return Ok((found, "rdsr"));
            }
            if modality != "SR" {
                headers.push((modality.clone(), tags));
            }
        }
    }
    let dose = dose_capture::from_headers(headers.iter().map(|(m, t)| (m.as_str(), t)));
    Ok((dose, "dicom_header"))
}

/// Read and store a filed study's dose. Returns whether a record was written.
///
/// # Errors
/// As [`pacs_get`], and database errors.
pub async fn capture_dose(
    pool: &PgPool,
    target: &Target,
    study: &CapturedStudy<'_>,
    orthanc_id: &str,
) -> Result<bool, AppError> {
    let (dose, source) = read_dose(target, orthanc_id).await?;
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &study.tenant_id).await?;
    let written = store_captured(&mut tx, study, &dose, source).await?;
    tx.commit().await?;
    Ok(written)
}
