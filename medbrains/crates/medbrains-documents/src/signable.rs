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
//! Payload SQL binds `$1` tenant, `$2` record id, `$3` signer role and `$4`
//! signer user (`signable/sql/<type>.sql`, listed in `signable/table.rs`). A primary signer must be the record's author (`$3 <>
//! 'primary' OR <author> = $4`). Content only: workflow state that changes
//! after signing is left out, or the public check would call every signed
//! document altered. Migration 1418 lists the same content columns for the
//! edit guard that takes a signature off an edited record.

use medbrains_core::permissions;
use medbrains_kernel::{require_any_permission, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
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
    /// A doctor named as the case's anaesthetist.
    Anaesthetist,
    /// A doctor who entered or validated the result.
    Pathologist,
    /// A doctor who reported or verified the study.
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
    pub signer: Signer,
    pub licence: Licence,
    /// The legal class a signature takes when the client names none.
    pub legal_class: &'static str,
    pub(crate) payload_sql: &'static str,
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
/// chart too); everything else the doctor's. Co-signers, attestors and
/// witnesses need the co-sign right, as before.
///
/// # Errors
/// `Forbidden` without the right.
pub fn require_sign_permission(
    claims: &Claims,
    spec: &SignableType,
    signer_role: &str,
) -> Result<(), AppError> {
    let checked = if signer_role != "primary" {
        require_permission(claims, permissions::doctor::signature::CO_SIGN)
    } else if spec.signer == Signer::Nurse {
        require_any_permission(
            claims,
            &[
                permissions::nurse::signature::SIGN,
                permissions::doctor::signature::SIGN,
            ],
        )
    } else {
        require_permission(claims, permissions::doctor::signature::SIGN)
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
/// `NotFound` when the record is gone or, for a primary signer, not theirs.
///
/// # Errors
/// `BadRequest` for an unknown type, `NotFound`, or a database error.
pub(crate) async fn resolve_signable_payload(
    tx: &mut sqlx::PgConnection,
    tenant_id: &Uuid,
    signer_user_id: &Uuid,
    signer_role: &str,
    record_type: &str,
    record_id: Uuid,
) -> Result<Value, AppError> {
    let spec = find(record_type)?;
    sqlx::query_scalar::<_, Value>(spec.payload_sql)
        .bind(tenant_id)
        .bind(record_id)
        .bind(signer_role)
        .bind(signer_user_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// Refuse a second author signature on a record already signed (409).
///
/// The row stays locked until the signature commits, so two signings at the
/// same moment cannot both pass. An edit takes the signature off (migration
/// 1418), after which the record can be signed again.
///
/// # Errors
/// `Conflict` when already signed; a database error as itself.
pub(crate) async fn require_unsigned(
    tx: &mut sqlx::PgConnection,
    tenant_id: &Uuid,
    spec: &SignableType,
    record_id: Uuid,
) -> Result<(), AppError> {
    // Dynamic only in the table name, which comes from the fixed table.
    let sql = format!(
        "SELECT is_signed FROM {} WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
        spec.table
    );
    let signed: Option<bool> = sqlx::query_scalar(&sql)
        .bind(record_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    if signed == Some(true) {
        return Err(AppError::Conflict(format!(
            "This {} is already signed. Edit it to take the signature off, then sign again.",
            spec.label.to_lowercase()
        )));
    }
    Ok(())
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
mod tests {
    use super::SIGNABLE;
    use std::collections::HashSet;

    /// Each type is listed once, binds all four parameters, filters a
    /// primary signer to the author, and reads a live row.
    #[test]
    fn every_type_is_unique_and_scoped_to_its_author() {
        let mut seen = HashSet::new();
        for t in SIGNABLE {
            assert!(seen.insert(t.record_type), "{} listed twice", t.record_type);
            for p in ["$1", "$2", "$3", "$4"] {
                assert!(
                    t.payload_sql.contains(p),
                    "{} does not bind {p}",
                    t.record_type
                );
            }
            assert!(
                t.payload_sql.contains("$3 <> 'primary'"),
                "{}: a primary signer must be the author",
                t.record_type
            );
            let flat = t
                .payload_sql
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            assert!(
                flat.contains(&format!("'record_type', '{}'", t.record_type)),
                "{}: the payload names its own type",
                t.record_type
            );
        }
    }

    /// The columns of `table` (under its alias) that a payload reads.
    fn signed_columns(sql: &str, table: &str) -> Vec<String> {
        let from = format!("\nFROM {table} ");
        let Some(at) = sql.find(&from) else {
            return vec![format!("<no FROM {table}>")];
        };
        let alias: String = sql[at + from.len()..]
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect();
        let prefix = format!("{alias}.");
        let select = &sql[..at];
        let mut cols: Vec<String> = select
            .match_indices(&prefix)
            .filter(|(i, _)| {
                *i == 0
                    || !select.as_bytes()[i - 1].is_ascii_alphanumeric()
                        && select.as_bytes()[i - 1] != b'_'
            })
            .map(|(i, _)| {
                select[i + prefix.len()..]
                    .chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                    .collect::<String>()
            })
            .filter(|c| !matches!(c.as_str(), "id" | "tenant_id" | "created_at"))
            .collect();
        cols.sort();
        cols.dedup();
        cols
    }

    /// The edit guard of migration 1418 watches every column a payload
    /// signs; a column added to a payload but not to the guard would let an
    /// edit keep a signature over content it no longer matches.
    #[test]
    fn the_edit_guard_watches_every_signed_column() {
        let migration =
            include_str!("../../medbrains-db-migrations/src/migrations/1418_sign_every_record.sql");
        for t in SIGNABLE {
            let marker = format!("signable_edit_guard('{}',", t.record_type);
            let line = migration
                .lines()
                .find(|l| l.contains(&marker))
                .unwrap_or_default();
            assert!(!line.is_empty(), "{} has no edit guard", t.record_type);
            assert!(
                migration.contains(&format!("ON public.{}\n    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('{}',", t.table, t.record_type)),
                "{}: the guard sits on {}",
                t.record_type,
                t.table
            );
            for col in signed_columns(t.payload_sql, t.table) {
                assert!(
                    line.contains(&format!("'{col}'")),
                    "{}: the edit guard does not watch {col}",
                    t.record_type
                );
            }
        }
    }
}
