//! Every record type the hospital signs, in one table.
//!
//! A paperless record is valid when it is named, signed, dated and timed by
//! its author (NABH IMS; BSA 2023 s.63 for the electronic record). Each entry
//! says which source table holds the record, who may sign it, and the SQL
//! that reads its signable content. The sign, preview and public-verify paths
//! all go through this table, and `GET /api/signatures/types` publishes it so
//! the sign-off inbox offers only what the server can sign.
//!
//! Every type needs a fresh step-up to sign (see `signatures::sign_record`).
//! The step-up lasts five minutes, so a nurse signs a round of charting under
//! one password prompt.
//!
//! Clinical notes (OPD consultation, admission history, progress, procedure
//! and nursing notes) are signed through their own ledger,
//! `POST /api/clinical-notes/{id}/sign`, and consents through the consent
//! module; neither is listed here.
//!
//! Payload SQL (`signable/sql/<type>.sql`, listed in `signable/table.rs`)
//! binds `$1` tenant and `$2` record id. Content only: workflow state that
//! changes after signing is left out, or the public check would call every
//! signed document altered. Migration 1418 watches the same columns, on the
//! record and on its related rows (child rows such as prescription items and
//! MLC injuries; parents whose fields it shows, such as the lab order or the
//! OT booking), and takes the signature off an edited record.
//!
//! Before anything is signed: the primary signer is the record's author and
//! nobody else (others co-sign). The author is the person who answers for
//! the document: the validating pathologist for a lab result (ISO 15189 /
//! NABL authorised signatory), the verifying consultant for a radiology
//! report or discharge summary when one is named, else the reporter or
//! preparer. The signer holds a registration;
//! the signer may see the patient (`require_patient_access`, every role); and
//! the signer opened the review screen on this exact content within the last
//! 30 minutes.

use medbrains_core::permissions;
use medbrains_health_services::patient::require_patient_access;
use medbrains_kernel::{require_any_permission, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use medbrains_signing::signing;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

/// Who signs a record type as its author.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Signer {
    /// An active doctor profile with a registration number.
    Doctor,
    /// A nurse profile with a licence number, or a doctor's (doctors chart too).
    Nurse,
    /// A doctor recorded as the anaesthesia record's anaesthetist.
    Anaesthetist,
    /// A doctor who entered the result.
    Pathologist,
    /// A doctor who reported the study.
    Radiologist,
}

/// The extra licence flag on `doctor_profiles` a type needs, if any.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Licence {
    /// No flag beyond the registration.
    None,
    /// `can_sign_mlc`.
    Mlc,
    /// `can_sign_death_certificate`.
    DeathCertificate,
    /// `can_sign_fitness_certificate`.
    FitnessCertificate,
}

/// One signable record type.
#[derive(Debug)]
pub struct SignableType {
    pub record_type: &'static str,
    pub label: &'static str,
    /// The source table; carries `is_signed` and `signed_record_id`.
    pub table: &'static str,
    /// SQL naming the record's author, the only primary signer, over the
    /// record as `r`; it may reach a parent (a lab result's validator is on
    /// its order). Every column it reads is watched by an edit guard.
    pub author: &'static str,
    /// The refusal while the author is not yet named (a lab result nobody
    /// has validated); `None` answers as a missing record.
    pub unassigned: Option<&'static str>,
    /// Tables whose rows this record's signature also covers.
    pub related: &'static [Related],
    pub signer: Signer,
    pub licence: Licence,
    /// The legal class a signature takes when the client names none.
    pub legal_class: &'static str,
    /// The query reading the signable content: `$1` tenant, `$2` record.
    pub payload_sql: &'static str,
}

/// A table a signed record depends on: a change to a watched column of a
/// related row takes the record's signature off (migration 1418,
/// `signable_related_guard`). A child (prescription items) has
/// `record_col: "id"`; a parent (the lab order) names the record's column
/// that points at it.
#[derive(Debug)]
pub struct Related {
    pub table: &'static str,
    /// The record's column matched against `key`.
    pub record_col: &'static str,
    /// The related table's column holding the match.
    pub key: &'static str,
}

pub mod table;
pub use table::SIGNABLE;

/// The signable type named `record_type`.
///
/// # Errors
/// `BadRequest` for a type that is not signable here.
pub fn find(record_type: &str) -> Result<&'static SignableType, AppError> {
    SIGNABLE
        .iter()
        .find(|t| t.record_type == record_type)
        .ok_or_else(|| AppError::BadRequest(format!("record_type '{record_type}' is not signable")))
}

/// Refuse a caller whose role does not sign this type.
///
/// A nursing entry takes the nurse signing right or the doctor's (doctors
/// chart too); everything else the doctor's. Co-signers and attestors need
/// the co-sign right. A witness needs the right to sign this type as an
/// author would, or the co-sign right.
///
/// # Errors
/// `Forbidden` without the right.
pub fn require_sign_permission(
    claims: &Claims,
    spec: &SignableType,
    signer_role: &str,
) -> Result<(), AppError> {
    let co_sign = permissions::doctor::signature::CO_SIGN;
    let author_rights: &[&str] = if spec.signer == Signer::Nurse {
        &[
            permissions::nurse::signature::SIGN,
            permissions::doctor::signature::SIGN,
        ]
    } else {
        &[permissions::doctor::signature::SIGN]
    };
    let checked = match signer_role {
        "primary" => require_any_permission(claims, author_rights),
        "witness" => require_any_permission(claims, &[author_rights, &[co_sign]].concat()),
        _ => require_permission(claims, co_sign),
    };
    checked.map_err(AppError::from)
}

/// Refuse a signer with no professional registration for this type.
///
/// NMC: a medical record is signed by a registered practitioner. A doctor
/// needs an active, unrevoked, in-date profile with a registration number
/// (council, state council or HPR id), plus the licence flag the type needs
/// (MLC, death certificate, fitness certificate); a nurse a licence number on
/// the nurse profile. A witness signs as a person, so is not checked. A
/// database fault is returned as a fault, never read as "not registered".
///
/// # Errors
/// `ForbiddenReason` naming what is missing; a database error as itself.
pub async fn require_signer_profile(
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    spec: &SignableType,
    signer_role: &str,
) -> Result<(), AppError> {
    if signer_role == "witness" {
        return Ok(());
    }
    let licence = if signer_role == "primary" {
        spec.licence
    } else {
        Licence::None
    };
    let doctor = doctor_registered(tx, claims, licence).await?;
    let registered =
        doctor || (spec.signer == Signer::Nurse && nurse_registered(tx, claims).await?);
    if registered {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(refusal(spec, licence)))
}

/// Whether the caller has a signing doctor profile with `licence`.
async fn doctor_registered(
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    licence: Licence,
) -> Result<bool, AppError> {
    let flag = match licence {
        Licence::None => "TRUE",
        Licence::Mlc => "can_sign_mlc",
        Licence::DeathCertificate => "can_sign_death_certificate",
        Licence::FitnessCertificate => "can_sign_fitness_certificate",
    };
    // Dynamic only in the flag column, which comes from the fixed match above.
    let sql = format!(
        "SELECT EXISTS (SELECT 1 FROM doctor_profiles \
          WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL \
            AND is_active AND NOT registration_revoked \
            AND (registration_valid_until IS NULL OR registration_valid_until >= CURRENT_DATE) \
            AND COALESCE(NULLIF(btrim(mci_number), ''), NULLIF(btrim(state_council_number), ''), \
                         NULLIF(btrim(hpr_id), '')) IS NOT NULL \
            AND {flag})"
    );
    Ok(sqlx::query_scalar(&sql)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?)
}

/// Whether the caller has an active nurse profile with a licence number.
async fn nurse_registered(tx: &mut sqlx::PgConnection, claims: &Claims) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM nurse_profiles \
          WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL AND is_active \
            AND NULLIF(btrim(license_number), '') IS NOT NULL)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?)
}

/// The words the screen shows a signer who may not sign this type.
fn refusal(spec: &SignableType, licence: Licence) -> String {
    let needs = match (spec.signer, licence) {
        (_, Licence::Mlc) => "a doctor profile allowed to sign medico-legal cases",
        (_, Licence::DeathCertificate) => "a doctor profile allowed to sign death certificates",
        (_, Licence::FitnessCertificate) => "a doctor profile allowed to sign certificates",
        (Signer::Nurse, _) => "a nurse profile with a licence number, or a doctor profile",
        _ => "an active doctor profile with a registration number",
    };
    format!("Signing a {} needs {needs}.", spec.label.to_lowercase())
}

/// The canonical content of a signable record, read from its source table.
///
/// The same for every reader: the signer, the review screen and the public
/// check. `NotFound` when the record is gone.
///
/// # Errors
/// `BadRequest` for an unknown type, `NotFound`, or a database error.
pub(crate) async fn resolve_signable_payload(
    tx: &mut sqlx::PgConnection,
    tenant_id: &Uuid,
    record_type: &str,
    record_id: Uuid,
) -> Result<Value, AppError> {
    let spec = find(record_type)?;
    sqlx::query_scalar::<_, Value>(spec.payload_sql)
        .bind(tenant_id)
        .bind(record_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// The locked record's authorship and signed state, before anything is
/// told to the caller.
struct Locked {
    is_author: bool,
    unnamed: bool,
    signed: bool,
}

/// Lock the record for signing. The row stays locked until the signature
/// commits, so two signings at the same moment cannot both pass, and the
/// content cannot change between being read and being signed.
///
/// # Errors
/// `NotFound` for a missing record, or a database error.
async fn lock_record(
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    spec: &SignableType,
    record_id: Uuid,
) -> Result<Locked, AppError> {
    // Dynamic only in the table name and author expression, both from the
    // fixed table; every value is bound.
    let sql = format!(
        "SELECT ({author}) IS NOT DISTINCT FROM $3, ({author}) IS NULL, r.is_signed \
           FROM {table} r WHERE r.id = $1 AND r.tenant_id = $2 FOR UPDATE OF r",
        author = spec.author,
        table = spec.table
    );
    let row: Option<(bool, bool, bool)> = sqlx::query_as(&sql)
        .bind(record_id)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?;
    let (is_author, unnamed, signed) = row.ok_or(AppError::NotFound)?;
    Ok(Locked {
        is_author,
        unnamed,
        signed,
    })
}

/// Whether this signer may sign the locked record, and whether it is signed.
///
/// A record whose author is not yet named and whose type says why (an
/// unvalidated lab result) is refused to every role with that reason (409).
/// A primary signer must be the record's author ([`SignableType::author`]);
/// to anyone else the record answers `NotFound`, as a missing one does.
///
/// # Errors
/// `Conflict` or `NotFound`.
fn authorise_signer(
    locked: &Locked,
    spec: &SignableType,
    signer_role: &str,
) -> Result<bool, AppError> {
    if let (true, Some(reason)) = (locked.unnamed, spec.unassigned) {
        return Err(AppError::Conflict(reason.to_owned()));
    }
    if locked.is_author || signer_role != "primary" {
        Ok(locked.signed)
    } else {
        Err(AppError::NotFound)
    }
}

/// The patient a payload is about.
///
/// # Errors
/// `Internal` when a payload names no patient, which the table forbids.
pub(crate) fn patient_of(payload: &Value) -> Result<Uuid, AppError> {
    payload
        .pointer("/patient/id")
        .or_else(|| payload.get("patient_id"))
        .and_then(Value::as_str)
        .and_then(|id| id.parse().ok())
        .ok_or_else(|| AppError::Internal("signable payload names no patient".to_owned()))
}

/// A record opened for signing: its payload, the payload's hash, and
/// whether it already carries a signature.
pub(crate) struct Opened {
    pub payload: Value,
    pub hash: [u8; 32],
    pub already_signed: bool,
}

/// Everything the review screen and the signature check before the record
/// is shown or signed. The record is locked and read first; the signer's
/// access to the patient (every role) is checked before anything else is
/// said, so someone who may not see the patient learns nothing about the
/// record; then authorship (an unvalidated report is 409, a non-author 404),
/// then the signer's registration. The record stays locked until the
/// caller's transaction ends.
///
/// # Errors
/// `ForbiddenReason`, `NotFound`, the patient gate's refusal, or a database
/// error.
pub(crate) async fn open_for_signing(
    state: &AppState,
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    spec: &SignableType,
    signer_role: &str,
    record_id: Uuid,
) -> Result<Opened, AppError> {
    let locked = lock_record(tx, claims, spec, record_id).await?;
    let payload =
        resolve_signable_payload(tx, &claims.tenant_id, spec.record_type, record_id).await?;
    require_patient_access(state, claims, patient_of(&payload)?).await?;
    let already_signed = authorise_signer(&locked, spec, signer_role)?;
    require_signer_profile(tx, claims, spec, signer_role).await?;
    let canonical = signing::canonicalize(&payload)
        .map_err(|e| AppError::BadRequest(format!("canonicalize: {e}")))?;
    let hash = signing::payload_hash(&canonical);
    Ok(Opened {
        payload,
        hash,
        already_signed,
    })
}

/// How long a review stands: sign within this many minutes of opening it.
const REVIEW_WINDOW_MINUTES: i32 = 30;

/// Refuse a signature on content the signer has not reviewed (409).
///
/// The review screen records what it showed (`signature_reviews`); the
/// signature must be over that same hash, opened by this signer within
/// [`REVIEW_WINDOW_MINUTES`].
///
/// # Errors
/// `Conflict` without a matching review; a database error as itself.
pub(crate) async fn require_reviewed(
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    spec: &SignableType,
    record_id: Uuid,
    payload_hash: &[u8],
) -> Result<(), AppError> {
    let reviewed: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM signature_reviews \
          WHERE tenant_id = $1 AND record_type = $2 AND record_id = $3 \
            AND reviewer_id = $4 AND payload_hash = $5 AND deleted_at IS NULL \
            AND reviewed_at > now() - make_interval(mins => $6))",
    )
    .bind(claims.tenant_id)
    .bind(spec.record_type)
    .bind(record_id)
    .bind(claims.sub)
    .bind(payload_hash)
    .bind(REVIEW_WINDOW_MINUTES)
    .fetch_one(&mut *tx)
    .await?;
    if reviewed {
        return Ok(());
    }
    Err(AppError::Conflict(
        "Open the document and review it before signing.".to_owned(),
    ))
}

/// The refusal of a second author signature on a signed record (409).
pub(crate) fn already_signed(spec: &SignableType) -> AppError {
    AppError::Conflict(format!(
        "This {} is already signed. Edit it to take the signature off, then sign again.",
        spec.label.to_lowercase()
    ))
}

/// Flag the source row as signed and point it at its signature.
///
/// # Errors
/// A database error, which aborts the signing transaction.
pub(crate) async fn mark_source_signed(
    tx: &mut sqlx::PgConnection,
    tenant_id: &Uuid,
    spec: &SignableType,
    record_id: Uuid,
    signed_record_id: Uuid,
) -> Result<(), AppError> {
    // Dynamic only in the table name, which comes from the fixed table above.
    let sql = format!(
        "UPDATE {} SET is_signed = TRUE, signed_record_id = $1 WHERE id = $2 AND tenant_id = $3",
        spec.table
    );
    sqlx::query(&sql)
        .bind(signed_record_id)
        .bind(record_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
    Ok(())
}

/// One row of `GET /api/signatures/types`.
#[derive(Debug, Serialize)]
pub struct SignableTypeInfo {
    pub record_type: &'static str,
    pub label: &'static str,
    pub signer: Signer,
    pub legal_class: &'static str,
    /// Always true: every signature needs a fresh step-up.
    pub step_up: bool,
}

/// `GET /api/signatures/types` — what the server signs, for the inbox and
/// the Sign control, so the two cannot offer a type the server refuses.
///
/// # Errors
/// `Forbidden` to a caller with no signing or verifying right.
pub async fn list_signable_types(
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<axum::Json<Vec<SignableTypeInfo>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::doctor::signature::SIGN,
            permissions::nurse::signature::SIGN,
            permissions::doctor::signature::VERIFY,
        ],
    )?;
    Ok(axum::Json(
        SIGNABLE
            .iter()
            .map(|t| SignableTypeInfo {
                record_type: t.record_type,
                label: t.label,
                signer: t.signer,
                legal_class: t.legal_class,
                step_up: true,
            })
            .collect(),
    ))
}

#[cfg(test)]
mod tests;
