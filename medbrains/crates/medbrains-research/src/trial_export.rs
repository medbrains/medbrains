//! A clinical trial's data for its sponsor, de-identified by default.
//!
//! `GET /api/clinical-trials/{id}/export` needs `specialty.clinical_trials.export`.
//! It used to need only `list` and returned every participant's name.
//!
//! A participant appears only as a `subject_key`: [`crate::deid::patient_key`], the
//! research datasets' HMAC, under the trial's own salt
//! (`clinical_trials.subject_key_salt`, never read anywhere else). The key is
//! stable for the life of the trial, so the sponsor can match a subject across
//! transfers, and differs between trials. Randomisation rows carry the trial's
//! own `randomization_code`. Nothing else about the person goes out: no name,
//! patient id, UHID, ABHA, Aadhaar, phone, address or birth date, and no free
//! text (visit notes and procedures, AE narratives, unblinding reasons, ethics
//! notes), which is where names get typed. The GCP dates that exist on the
//! records — consent, visit, onset, report, randomisation, unblinding — stay.
//! Arms stay concealed unless the record was unblinded.
//!
//! No per-patient check: the trial is the scope, as for the trial lists in
//! medbrains-ancillary, and nothing that identifies a patient is released.
//! Every export writes an audit row in the same transaction — who, which
//! trial, how many subjects; if the row cannot be written, nothing is sent.
//!
//! An identified export, if a regulator ever needs one, is a separate audited
//! action and does not exist.

use std::collections::HashSet;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Claims, Tx, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::deid::patient_key;

/// The audit action every sponsor export writes.
pub const AUDIT_ACTION: &str = "clinical_trial.sponsor_export";

/// The trial as a sponsor sees it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportTrial {
    pub id: Uuid,
    pub protocol_number: String,
    pub title: String,
    pub sponsor: Option<String>,
    pub phase: Option<String>,
    pub status: String,
    pub indication: Option<String>,
    pub principal_investigator: Option<String>,
    pub target_enrollment: Option<i32>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

/// A row read with its patient, before the patient becomes a key.
#[derive(Debug, sqlx::FromRow)]
struct Keyed<T> {
    patient_id: Uuid,
    #[sqlx(flatten)]
    row: T,
}

/// A signed trial consent.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportConsent {
    pub template_name: Option<String>,
    pub template_version: Option<i32>,
    pub signed_by_patient: Option<bool>,
    pub patient_signed_at: Option<DateTime<Utc>>,
    pub is_revoked: Option<bool>,
}

/// A protocol visit.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportVisit {
    pub visit_name: String,
    pub scheduled_date: NaiveDate,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
}

/// An adverse event, without its narrative.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportAdverseEvent {
    pub event_term: String,
    pub onset_date: Option<NaiveDate>,
    pub severity: String,
    pub is_serious: bool,
    pub relatedness: String,
    pub outcome: String,
    pub reported_date: NaiveDate,
}

/// A randomisation, the arm concealed while blinded.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportRandomization {
    pub randomization_code: Option<String>,
    pub arm: Option<String>,
    pub is_unblinded: bool,
    pub unblinded_at: Option<DateTime<Utc>>,
    pub randomized_at: DateTime<Utc>,
}

/// An ethics-committee submission, without its notes.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportIrb {
    pub submission_type: String,
    pub committee_name: Option<String>,
    pub reference_number: Option<String>,
    pub submitted_date: NaiveDate,
    pub status: String,
    pub decision_date: Option<NaiveDate>,
}

/// The whole bundle.
#[derive(Debug, Serialize)]
pub struct TrialExport {
    pub deidentified: bool,
    pub subject_count: usize,
    pub trial: ExportTrial,
    pub consents: Vec<Subjected<ExportConsent>>,
    pub visits: Vec<Subjected<ExportVisit>>,
    pub adverse_events: Vec<Subjected<ExportAdverseEvent>>,
    pub randomizations: Vec<Subjected<ExportRandomization>>,
    pub irb_submissions: Vec<ExportIrb>,
}

/// A released row: the subject's key in place of the patient.
#[derive(Debug, Serialize)]
pub struct Subjected<T> {
    pub subject_key: String,
    #[serde(flatten)]
    pub row: T,
}

/// Replace each row's patient with its key, counting the patients seen.
fn keyed<T>(rows: Vec<Keyed<T>>, salt: &[u8], seen: &mut HashSet<Uuid>) -> Vec<Subjected<T>> {
    rows.into_iter()
        .map(|Keyed { patient_id, row }| {
            seen.insert(patient_id);
            Subjected {
                subject_key: patient_key(salt, patient_id),
                row,
            }
        })
        .collect()
}

/// Read one trial-scoped list (`$1` tenant, `$2` trial).
async fn rows<T>(tx: &mut Tx, sql: &str, t: Uuid, id: Uuid) -> Result<Vec<T>, AppError>
where
    T: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
{
    Ok(sqlx::query_as::<_, T>(sql)
        .bind(t)
        .bind(id)
        .fetch_all(&mut **tx)
        .await?)
}

/// `GET /api/clinical-trials/{id}/export` — the trial's de-identified sponsor bundle.
pub async fn export_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TrialExport>, AppError> {
    Ok(Json(export(&state.db, &claims, id).await?))
}

/// Check, build, audit and commit one export; the handler without the web layer.
pub async fn export(db: &PgPool, claims: &Claims, id: Uuid) -> Result<TrialExport, AppError> {
    require_permission(claims, permissions::specialty::clinical_trials::EXPORT)?;
    let mut tx = medbrains_kernel::begin(db, Actor::from_claims(claims)).await?;
    let bundle = build(&mut tx, claims.tenant_id, id).await?;
    let new_values = serde_json::json!({ "subjects": bundle.subject_count, "deidentified": true });
    let entry = AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action: AUDIT_ACTION,
        entity_type: "clinical_trial",
        entity_id: Some(id),
        old_values: None,
        new_values: Some(&new_values),
        ip_address: None,
    };
    medbrains_kernel::audit(&mut tx, &entry).await?;
    tx.commit().await?;
    Ok(bundle)
}

/// Read the trial and its records, each patient replaced by their subject key.
async fn build(tx: &mut Tx, t: Uuid, id: Uuid) -> Result<TrialExport, AppError> {
    let (trial, salt) = trial_and_salt(tx, t, id).await?;
    let mut seen = HashSet::new();
    let consents = keyed(rows(tx, CONSENTS, t, id).await?, &salt, &mut seen);
    let visits = keyed(rows(tx, VISITS, t, id).await?, &salt, &mut seen);
    let adverse_events = keyed(rows(tx, AES, t, id).await?, &salt, &mut seen);
    let randomizations = keyed(rows(tx, RANDS, t, id).await?, &salt, &mut seen);
    Ok(TrialExport {
        deidentified: true,
        subject_count: seen.len(),
        trial,
        consents,
        visits,
        adverse_events,
        randomizations,
        irb_submissions: rows(tx, IRB, t, id).await?,
    })
}

/// The trial and its subject-key salt; 404 when it is not this tenant's.
async fn trial_and_salt(
    tx: &mut Tx,
    t: Uuid,
    id: Uuid,
) -> Result<(ExportTrial, Vec<u8>), AppError> {
    #[derive(sqlx::FromRow)]
    struct Row {
        #[sqlx(flatten)]
        trial: ExportTrial,
        subject_key_salt: Vec<u8>,
    }
    let row = sqlx::query_as::<_, Row>(
        "SELECT id, protocol_number, title, sponsor, phase, status, indication, \
            principal_investigator, target_enrollment, start_date, end_date, subject_key_salt \
         FROM clinical_trials WHERE id = $2 AND tenant_id = $1",
    )
    .bind(t)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok((row.trial, row.subject_key_salt))
}

const CONSENTS: &str = "SELECT cr.patient_id, ct.name AS template_name, \
    ct.version AS template_version, cr.signed_by_patient, cr.patient_signed_at, cr.is_revoked \
    FROM consent_records cr LEFT JOIN consent_templates ct ON ct.id = cr.template_id \
    WHERE cr.tenant_id = $1 AND cr.trial_id = $2 AND cr.deleted_at IS NULL \
    ORDER BY cr.created_at";

const VISITS: &str = "SELECT patient_id, visit_name, scheduled_date, status, completed_at \
    FROM trial_visits WHERE tenant_id = $1 AND trial_id = $2 ORDER BY scheduled_date, created_at";

const AES: &str = "SELECT patient_id, event_term, onset_date, severity, is_serious, relatedness, \
    outcome, reported_date FROM trial_adverse_events WHERE tenant_id = $1 AND trial_id = $2 \
    ORDER BY reported_date, created_at";

const RANDS: &str = "SELECT patient_id, randomization_code, \
    CASE WHEN is_unblinded THEN arm ELSE NULL END AS arm, is_unblinded, unblinded_at, \
    randomized_at FROM trial_randomizations WHERE tenant_id = $1 AND trial_id = $2 \
    ORDER BY randomized_at";

const IRB: &str = "SELECT submission_type, committee_name, reference_number, submitted_date, \
    status, decision_date FROM trial_irb_submissions WHERE tenant_id = $1 AND trial_id = $2 \
    ORDER BY submitted_date";
