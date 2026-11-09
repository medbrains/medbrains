//! A clinical trial's data for its sponsor, pseudonymised.
//!
//! `GET /api/clinical-trials/{id}/export` needs `specialty.clinical_trials.export`.
//! It used to need only `list` and returned every participant's name.
//!
//! A participant appears only as a `subject_key`: [`crate::deid::patient_key`]
//! under a per-trial key, [`trial_key`]: `HMAC(server key, tenant ‖ trial ‖
//! salt)`, the server key being `MEDBRAINS_IDENTIFIER_HMAC_KEY` from the secret
//! store and the salt `clinical_trials.subject_key_salt`. A database copy alone
//! cannot recompute it. The key is stable for the life of the trial, so the
//! sponsor can match a subject across transfers, and differs between trials.
//! It is a pseudonym, not anonymity: the hospital can link it back.
//!
//! What leaves, per subject: consents (template name and version, signed,
//! signed at, revoked), visits (visit name, scheduled date, status, completed
//! at), adverse events (event term, onset, severity, seriousness, relatedness,
//! outcome, report date) and randomisations (the trial's `randomization_code`,
//! the arm only once unblinded, unblinded at, randomised at); and the trial's
//! ethics submissions without their notes. Three of those are typed free text:
//! `visit_name`, `event_term` and `randomization_code`. Each is replaced with
//! [`crate::trial_subject::REDACTED`] when it holds its participant's UHID, a
//! first or last name as a whole word, phone, ABHA number or Aadhaar last four
//! ([`crate::trial_subject::names_person`]). That catches the participant's own
//! identifiers, not every name a person might type. Never released: name,
//! patient id, UHID, ABHA, Aadhaar, phone, address or birth date, visit notes
//! and procedures, AE narratives, unblinding reasons and ethics notes.
//!
//! Data collected before a consent was revoked is exported (ICH-GCP E6; the
//! consent row says it was revoked); see DECISIONS for the pending DPDP review.
//!
//! No per-patient check: the trial is the scope, as for the trial lists in
//! medbrains-ancillary, and nothing that identifies a patient is released.
//! Each list holds at most [`MAX_ROWS`] rows; a larger trial is refused, never
//! cut short. Every export writes an audit row in the same transaction — who,
//! which trial, how many subjects; if the row cannot be written, nothing is
//! sent.
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
use medbrains_core::secrets::sealing::sealing_key;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::{Actor, Claims, Tx, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::deid::patient_key;
use crate::trial_subject::{Person, redact, redact_opt, released_arm, trial_key};

/// The audit action every sponsor export writes.
pub const AUDIT_ACTION: &str = "clinical_trial.sponsor_export";
/// Most rows one list of one export holds.
pub const MAX_ROWS: usize = 50_000;
/// The server key the subject keys are derived from. The same secret keys the
/// identifier fingerprints (medbrains-patients `identifier_key`); the label in
/// [`trial_key`] keeps the two uses apart.
const SERVER_KEY_NAME: &str = "MEDBRAINS_IDENTIFIER_HMAC_KEY";
/// Development fallback only, as in medbrains-patients.
const DEV_SERVER_KEY: &[u8] = b"medbrains-dev-identifier-hmac-key";

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
    person: Person,
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
    /// Always true: subjects are keyed pseudonyms the hospital can link back.
    pub pseudonymised: bool,
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

/// Replace each row's patient with its key, scrubbing its free text against
/// that patient, and count the patients seen.
fn keyed<T>(
    rows: Vec<Keyed<T>>,
    key: &[u8],
    seen: &mut HashSet<Uuid>,
    scrub: fn(&mut T, &Person),
) -> Vec<Subjected<T>> {
    rows.into_iter()
        .map(
            |Keyed {
                 patient_id,
                 person,
                 mut row,
             }| {
                seen.insert(patient_id);
                scrub(&mut row, &person);
                Subjected {
                    subject_key: patient_key(key, patient_id),
                    row,
                }
            },
        )
        .collect()
}

/// Consents carry no typed text.
const fn keep_consent(_: &mut ExportConsent, _: &Person) {}

/// A visit's name is typed per visit.
fn scrub_visit(v: &mut ExportVisit, p: &Person) {
    redact(&mut v.visit_name, p);
}

/// An event term is typed per event.
fn scrub_event(e: &mut ExportAdverseEvent, p: &Person) {
    redact(&mut e.event_term, p);
}

/// The randomisation code is typed; the arm goes out only once unblinded.
fn scrub_randomization(r: &mut ExportRandomization, p: &Person) {
    redact_opt(&mut r.randomization_code, p);
    r.arm = released_arm(r.arm.take(), r.is_unblinded);
}

/// Read one trial-scoped list (`$1` tenant, `$2` trial, `$3` row cap);
/// refused, not cut short, when it holds more than [`MAX_ROWS`].
async fn rows<T>(
    tx: &mut Tx,
    (sql, list): (&str, &str),
    t: Uuid,
    id: Uuid,
) -> Result<Vec<T>, AppError>
where
    T: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin,
{
    let cap = i64::try_from(MAX_ROWS + 1).unwrap_or(i64::MAX);
    let rows = sqlx::query_as::<_, T>(sql)
        .bind(t)
        .bind(id)
        .bind(cap)
        .fetch_all(&mut **tx)
        .await?;
    if rows.len() > MAX_ROWS {
        return Err(AppError::BadRequest(format!(
            "This trial has more than {MAX_ROWS} {list}, more than one export carries. \
             Nothing was exported; ask support to export it in parts."
        )));
    }
    Ok(rows)
}

/// `GET /api/clinical-trials/{id}/export` — the trial's pseudonymised sponsor bundle.
pub async fn export_trial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TrialExport>, AppError> {
    require_permission(&claims, permissions::specialty::clinical_trials::EXPORT)?;
    let server_key = sealing_key(
        state.secret_resolver.as_ref(),
        SERVER_KEY_NAME,
        DEV_SERVER_KEY,
    )
    .await?;
    Ok(Json(export(&state.db, &server_key, &claims, id).await?))
}

/// Check, build, audit and commit one export; the handler without the web
/// layer. `server_key` is the secret the subject keys derive from.
pub async fn export(
    db: &PgPool,
    server_key: &[u8],
    claims: &Claims,
    id: Uuid,
) -> Result<TrialExport, AppError> {
    require_permission(claims, permissions::specialty::clinical_trials::EXPORT)?;
    let mut tx = medbrains_kernel::begin(db, Actor::from_claims(claims)).await?;
    let bundle = build(&mut tx, server_key, claims.tenant_id, id).await?;
    let new_values = serde_json::json!({ "subjects": bundle.subject_count, "pseudonymised": true });
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
async fn build(tx: &mut Tx, server_key: &[u8], t: Uuid, id: Uuid) -> Result<TrialExport, AppError> {
    let (trial, salt) = trial_and_salt(tx, t, id).await?;
    let key = trial_key(server_key, t, id, &salt);
    let mut seen = HashSet::new();
    let consents = keyed(
        rows(tx, CONSENTS, t, id).await?,
        &key,
        &mut seen,
        keep_consent,
    );
    let visits = keyed(rows(tx, VISITS, t, id).await?, &key, &mut seen, scrub_visit);
    let adverse_events = keyed(rows(tx, AES, t, id).await?, &key, &mut seen, scrub_event);
    let randomizations = keyed(
        rows(tx, RANDS, t, id).await?,
        &key,
        &mut seen,
        scrub_randomization,
    );
    Ok(TrialExport {
        pseudonymised: true,
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

/// The participant's identifiers beside each row (`x` is the row's table), to
/// check its typed text against; all NULL if the patient cannot be read.
macro_rules! person {
    () => {
        "p.uhid, p.first_name, p.last_name, p.phone, p.abha_number, \
         ARRAY(SELECT right(regexp_replace(pi.id_number, '\\D', '', 'g'), 4) \
               FROM patient_identifiers pi WHERE pi.tenant_id = x.tenant_id \
               AND pi.patient_id = x.patient_id AND pi.id_type = 'aadhaar' \
               AND pi.deleted_at IS NULL) AS aadhaar_last4"
    };
}

/// Joins the row's patient for [`person!`].
macro_rules! patient_join {
    () => {
        " LEFT JOIN patients p ON p.id = x.patient_id AND p.tenant_id = x.tenant_id "
    };
}

const CONSENTS: (&str, &str) = (
    concat!(
        "SELECT x.patient_id, ",
        person!(),
        ", ct.name AS template_name, \
        ct.version AS template_version, x.signed_by_patient, x.patient_signed_at, x.is_revoked \
        FROM consent_records x LEFT JOIN consent_templates ct ON ct.id = x.template_id",
        patient_join!(),
        "WHERE x.tenant_id = $1 AND x.trial_id = $2 AND x.deleted_at IS NULL \
        ORDER BY x.created_at LIMIT $3"
    ),
    "consents",
);

const VISITS: (&str, &str) = (
    concat!(
        "SELECT x.patient_id, ",
        person!(),
        ", x.visit_name, x.scheduled_date, x.status, \
        x.completed_at FROM trial_visits x",
        patient_join!(),
        "WHERE x.tenant_id = $1 AND x.trial_id = $2 ORDER BY x.scheduled_date, x.created_at \
        LIMIT $3"
    ),
    "visits",
);

const AES: (&str, &str) = (
    concat!(
        "SELECT x.patient_id, ",
        person!(),
        ", x.event_term, x.onset_date, x.severity, \
        x.is_serious, x.relatedness, x.outcome, x.reported_date FROM trial_adverse_events x",
        patient_join!(),
        "WHERE x.tenant_id = $1 AND x.trial_id = $2 ORDER BY x.reported_date, x.created_at \
        LIMIT $3"
    ),
    "adverse events",
);

const RANDS: (&str, &str) = (
    concat!(
        "SELECT x.patient_id, ",
        person!(),
        ", x.randomization_code, x.arm, x.is_unblinded, \
        x.unblinded_at, x.randomized_at FROM trial_randomizations x",
        patient_join!(),
        "WHERE x.tenant_id = $1 AND x.trial_id = $2 ORDER BY x.randomized_at LIMIT $3"
    ),
    "randomisations",
);

const IRB: (&str, &str) = (
    "SELECT submission_type, committee_name, reference_number, submitted_date, \
    status, decision_date FROM trial_irb_submissions WHERE tenant_id = $1 AND trial_id = $2 \
    ORDER BY submitted_date LIMIT $3",
    "ethics submissions",
);
