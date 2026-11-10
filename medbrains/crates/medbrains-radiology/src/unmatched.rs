//! The radiology desk's queue of studies the PACS could not file.
//!
//! A study is matched to an order by a person, never by name: the screen
//! shows what the modality wrote (patient ID, name, birth date, sex) beside
//! the order's patient, and the server compares them. Any difference — a
//! patient ID that is not the UHID, a different birth date or sex, another
//! modality — must be confirmed with a note, which is kept and audited.
//! A study that is nobody's (a phantom, a test shot, a duplicate) is
//! dismissed with a reason.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_outbox::handlers::pacs_target::{self, Policy};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::dose::{CapturedStudy, open_tx};
use crate::pacs_study::{self, OrderRef, StudyFacts};

const LIST_LIMIT: i64 = 200;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UnmatchedStudy {
    pub id: Uuid,
    pub orthanc_id: String,
    pub study_instance_uid: String,
    pub accession_number: Option<String>,
    pub dicom_patient_id: Option<String>,
    pub dicom_patient_name: Option<String>,
    pub dicom_birth_date: Option<NaiveDate>,
    pub dicom_sex: Option<String>,
    pub modality: Option<String>,
    pub study_date: Option<NaiveDate>,
    pub study_description: Option<String>,
    pub instance_count: i32,
    pub series_count: i32,
    pub status: String,
    pub linked_order_id: Option<Uuid>,
    pub resolution_note: Option<String>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UnmatchedQuery {
    pub status: Option<String>,
}

/// `GET /api/radiology/unmatched-studies?status=open` — the desk's queue.
///
/// These rows carry the demographics a modality wrote but belong to no
/// patient record yet, so there is no patient to check access against: the
/// permission is the whole of the gate, and it is held by the radiology desk.
pub async fn list_unmatched_studies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<UnmatchedQuery>,
) -> Result<Json<Vec<UnmatchedStudy>>, AppError> {
    require_permission(&claims, permissions::radiology::studies::RECONCILE)?;
    let status = q.status.as_deref().unwrap_or("open");
    if !matches!(status, "open" | "linked" | "dismissed") {
        return Err(AppError::BadRequest(
            "status is open, linked or dismissed".to_owned(),
        ));
    }
    let mut tx = open_tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, UnmatchedStudy>(
        "SELECT id, orthanc_id, study_instance_uid, accession_number, dicom_patient_id, \
                dicom_patient_name, dicom_birth_date, dicom_sex, modality, study_date, \
                study_description, instance_count, series_count, status, linked_order_id, \
                resolution_note, resolved_by, resolved_at, created_at \
           FROM radiology_unmatched_studies \
          WHERE tenant_id = $1 AND status = $2 AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(status)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// The order's patient, as the comparison needs it.
#[derive(Debug, sqlx::FromRow)]
struct OrderPatient {
    patient_id: Uuid,
    uhid: String,
    date_of_birth: Option<NaiveDate>,
    gender: String,
    order_status: String,
    pacs_study_uid: Option<String>,
    modality: String,
}

fn sex_code(gender: &str) -> &'static str {
    match gender {
        "male" => "M",
        "female" => "F",
        _ => "O",
    }
}

/// How what the modality wrote differs from the order's patient and exam.
fn mismatches(study: &UnmatchedStudy, target: &OrderPatient) -> Vec<String> {
    let mut out = Vec::new();
    match study.dicom_patient_id.as_deref().map(str::trim) {
        None | Some("") => out.push("the images carry no patient ID".to_owned()),
        Some(id) if !id.eq_ignore_ascii_case(target.uhid.trim()) => out.push(format!(
            "patient ID on the images is {id}, the patient's UHID is {}",
            target.uhid
        )),
        _ => {}
    }
    if let (Some(a), Some(b)) = (study.dicom_birth_date, target.date_of_birth)
        && a != b
    {
        out.push(format!(
            "birth date on the images is {a}, the patient's is {b}"
        ));
    }
    let sex = study.dicom_sex.as_deref().unwrap_or_default();
    if matches!(sex, "M" | "F") && sex != sex_code(&target.gender) {
        out.push(format!(
            "sex on the images is {sex}, the patient's is {}",
            sex_code(&target.gender)
        ));
    }
    if let Some(m) = study.modality.as_deref().filter(|m| !m.is_empty())
        && !m.eq_ignore_ascii_case(&target.modality)
    {
        out.push(format!(
            "the study is {m}, the order is {}",
            target.modality
        ));
    }
    out
}

#[derive(Debug, Deserialize)]
pub struct LinkRequest {
    pub order_id: Uuid,
    /// Required when anything differs: who confirmed it, and how.
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LinkResult {
    pub study: UnmatchedStudy,
    pub mismatches: Vec<String>,
    /// Whether the dose was read from the PACS; when not, enter it on the order.
    pub dose_captured: bool,
}

async fn open_study(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<UnmatchedStudy, AppError> {
    let study = sqlx::query_as::<_, UnmatchedStudy>(
        "SELECT id, orthanc_id, study_instance_uid, accession_number, dicom_patient_id, \
                dicom_patient_name, dicom_birth_date, dicom_sex, modality, study_date, \
                study_description, instance_count, series_count, status, linked_order_id, \
                resolution_note, resolved_by, resolved_at, created_at \
           FROM radiology_unmatched_studies \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if study.status != "open" {
        return Err(AppError::Conflict(format!(
            "This study was already {}",
            study.status
        )));
    }
    Ok(study)
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    action: &str,
    id: Uuid,
    values: &Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "radiology_unmatched_study",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

fn facts_of(study: &UnmatchedStudy) -> StudyFacts {
    StudyFacts {
        orthanc_id: study.orthanc_id.clone(),
        uid: study.study_instance_uid.clone(),
        accession: study.accession_number.clone().unwrap_or_default(),
        modality: study.modality.clone().unwrap_or_default(),
        study_date: study.study_date,
        description: study.study_description.clone().unwrap_or_default(),
        instances: study.instance_count,
        series: study.series_count,
        ..StudyFacts::default()
    }
}

/// `POST /api/radiology/unmatched-studies/{id}/link` — file the study under
/// an order a person has confirmed it belongs to.
pub async fn link_unmatched_study(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkRequest>,
) -> Result<Json<LinkResult>, AppError> {
    require_permission(&claims, permissions::radiology::studies::RECONCILE)?;
    // Filing images into a record is a write to that patient's chart.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        body.order_id,
    )
    .await?;
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    let mut tx = open_tx(&state, &claims).await?;
    let study = open_study(&mut tx, claims.tenant_id, id).await?;
    let target = sqlx::query_as::<_, OrderPatient>(
        "SELECT o.patient_id, p.uhid, p.date_of_birth, p.gender::text AS gender, \
                o.status::text AS order_status, o.pacs_study_uid, m.code AS modality \
           FROM radiology_orders o \
           JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
           JOIN radiology_modalities m ON m.id = o.modality_id \
          WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL FOR UPDATE OF o",
    )
    .bind(body.order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if target.order_status == "cancelled" {
        return Err(AppError::Conflict("That order was cancelled".to_owned()));
    }
    if target
        .pacs_study_uid
        .as_deref()
        .is_some_and(|uid| uid != study.study_instance_uid)
    {
        return Err(AppError::Conflict(
            "That order already has images".to_owned(),
        ));
    }
    let differences = mismatches(&study, &target);
    if !differences.is_empty() && note.is_none() {
        return Err(AppError::BadRequest(format!(
            "Check before filing: {}. Confirm the patient and add a note saying how.",
            differences.join("; ")
        )));
    }
    let order = OrderRef {
        id: body.order_id,
        patient_id: target.patient_id,
        modality: target.modality.clone(),
    };
    let config: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' \
           AND key = 'pacs_config' AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let base = config
        .as_ref()
        .and_then(|c| c["orthanc_url"].as_str())
        .map(pacs_target::normalize_url)
        .filter(|u| !u.is_empty());
    let facts = facts_of(&study);
    let study_row =
        pacs_study::attach_study(&mut tx, claims.tenant_id, &order, &facts, base.as_deref())
            .await?;
    let linked = sqlx::query_as::<_, UnmatchedStudy>(
        "UPDATE radiology_unmatched_studies SET status = 'linked', linked_order_id = $3, \
                resolution_note = $4, resolved_by = $5, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2 \
          RETURNING id, orthanc_id, study_instance_uid, accession_number, dicom_patient_id, \
                dicom_patient_name, dicom_birth_date, dicom_sex, modality, study_date, \
                study_description, instance_count, series_count, status, linked_order_id, \
                resolution_note, resolved_by, resolved_at, created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(note)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let values = json!({
        "order_id": body.order_id, "patient_id": target.patient_id,
        "study_instance_uid": study.study_instance_uid, "mismatches": differences, "note": note,
    });
    audit(
        &mut tx,
        &claims,
        "radiology.unmatched_study.link",
        id,
        &values,
    )
    .await?;
    tx.commit().await?;

    let captured = CapturedStudy {
        tenant_id: claims.tenant_id,
        order_id: body.order_id,
        patient_id: target.patient_id,
        dicom_study_id: study_row,
        modality: &target.modality,
    };
    let dose_captured = match config {
        Some(c) => read_dose(&state, &claims, &c, &captured, &study.orthanc_id).await,
        None => false,
    };
    Ok(Json(LinkResult {
        study: linked,
        mismatches: differences,
        dose_captured,
    }))
}

/// Best effort: the images are filed whether or not the dose can be read.
async fn read_dose(
    state: &AppState,
    claims: &Claims,
    config: &Value,
    study: &CapturedStudy<'_>,
    orthanc_id: &str,
) -> bool {
    let target = pacs_target::target_from_config(
        claims.tenant_id,
        config,
        state.secret_resolver.as_ref(),
        &Policy::from_env(),
    )
    .await;
    let Ok(Some(target)) = target else {
        return false;
    };
    match pacs_study::capture_dose(&state.db, &target, study, orthanc_id).await {
        Ok(written) => written,
        Err(error) => {
            tracing::warn!(%error, orthanc_id, "dose not read for a reconciled study");
            false
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct DismissRequest {
    pub reason: String,
}

/// `POST /api/radiology/unmatched-studies/{id}/dismiss` — the study is
/// nobody's: a phantom, a test exposure, a duplicate.
pub async fn dismiss_unmatched_study(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DismissRequest>,
) -> Result<Json<UnmatchedStudy>, AppError> {
    require_permission(&claims, permissions::radiology::studies::RECONCILE)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why this study is dismissed".to_owned(),
        ));
    }
    let mut tx = open_tx(&state, &claims).await?;
    open_study(&mut tx, claims.tenant_id, id).await?;
    let study = sqlx::query_as::<_, UnmatchedStudy>(
        "UPDATE radiology_unmatched_studies SET status = 'dismissed', resolution_note = $3, \
                resolved_by = $4, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2 \
          RETURNING id, orthanc_id, study_instance_uid, accession_number, dicom_patient_id, \
                dicom_patient_name, dicom_birth_date, dicom_sex, modality, study_date, \
                study_description, instance_count, series_count, status, linked_order_id, \
                resolution_note, resolved_by, resolved_at, created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    audit(
        &mut tx,
        &claims,
        "radiology.unmatched_study.dismiss",
        id,
        &json!({ "reason": reason }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(study))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn study() -> UnmatchedStudy {
        UnmatchedStudy {
            id: Uuid::nil(),
            orthanc_id: "o".to_owned(),
            study_instance_uid: "1.2.3".to_owned(),
            accession_number: None,
            dicom_patient_id: Some("uh-77".to_owned()),
            dicom_patient_name: Some("Devi Lakshmi".to_owned()),
            dicom_birth_date: NaiveDate::from_ymd_opt(1980, 3, 9),
            dicom_sex: Some("F".to_owned()),
            modality: Some("DX".to_owned()),
            study_date: None,
            study_description: None,
            instance_count: 1,
            series_count: 1,
            status: "open".to_owned(),
            linked_order_id: None,
            resolution_note: None,
            resolved_by: None,
            resolved_at: None,
            created_at: Utc::now(),
        }
    }

    fn target() -> OrderPatient {
        OrderPatient {
            patient_id: Uuid::nil(),
            uhid: "UH-77".to_owned(),
            date_of_birth: NaiveDate::from_ymd_opt(1980, 3, 9),
            gender: "female".to_owned(),
            order_status: "ordered".to_owned(),
            pacs_study_uid: None,
            modality: "DX".to_owned(),
        }
    }

    #[test]
    fn the_same_patient_and_exam_needs_no_note() {
        assert!(
            mismatches(&study(), &target()).is_empty(),
            "UHID compared without case"
        );
    }

    #[test]
    fn every_difference_is_named() {
        let mut s = study();
        s.dicom_patient_id = Some("12345".to_owned());
        s.dicom_birth_date = NaiveDate::from_ymd_opt(1979, 1, 1);
        s.dicom_sex = Some("M".to_owned());
        s.modality = Some("CT".to_owned());
        let found = mismatches(&s, &target());
        assert_eq!(found.len(), 4, "{found:?}");
        assert!(found[0].contains("12345") && found[0].contains("UH-77"));
    }

    #[test]
    fn a_study_with_no_patient_id_is_never_matched_silently() {
        let mut s = study();
        s.dicom_patient_id = None;
        assert_eq!(
            mismatches(&s, &target()),
            vec!["the images carry no patient ID"]
        );
    }
}
