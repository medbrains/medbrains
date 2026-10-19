//! Linking a patient to an ABHA that was verified against ABDM at the desk.
//!
//! The only way a link becomes "verified" is by pointing at a verified
//! `abha_verifications` row — a server-side record of the OTP check — for the
//! same ABHA number, made by the same member of staff, not yet used, not
//! expired. A browser claiming "verified" carries no weight.

use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Demographics staff chose to take from ABHA on an existing patient.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AbhaField {
    Name,
    DateOfBirth,
    Gender,
}

#[derive(sqlx::FromRow)]
struct Verified {
    abha_number: String,
    abha_address: Option<String>,
    method: String,
    otp_system: String,
    profile: serde_json::Value,
}

/// Mark `patient_id` as linked to the ABHA verified in `verification_id`.
///
/// `expected_abha` is the number the registration form submitted; it must be
/// the one ABDM verified. `apply` copies the chosen ABHA demographics onto
/// the patient (existing patients only — a new registration already carries
/// the values staff picked).
///
/// # Errors
/// 400 when the verification is unknown, unfinished, expired, already used,
/// someone else's, or for a different ABHA number; 404 when the patient is
/// not one of this hospital's; 409 when that ABHA is already linked to
/// another patient here, or the patient already carries a different ABHA.
pub async fn link_verified_abha(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    link: AbhaLinkRequest<'_>,
) -> Result<(), AppError> {
    let verified = sqlx::query_as::<_, Verified>(
        "SELECT abha_number, abha_address, method, otp_system, profile \
         FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND stage = 'verified' \
           AND linked_patient_id IS NULL AND expires_at > now() AND deleted_at IS NULL \
         FOR UPDATE",
    )
    .bind(link.verification_id)
    .bind(link.tenant_id)
    .bind(link.user_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest(
            "this ABHA verification has expired or was already used — verify again".to_owned(),
        )
    })?;
    if link
        .expected_abha
        .is_some_and(|n| n != verified.abha_number)
    {
        return Err(AppError::BadRequest(
            "the ABHA number on the form is not the one that was verified".to_owned(),
        ));
    }

    // A person has one ABHA number. Overwriting the one on record would
    // silently re-point their health records at someone else's account.
    let current: Option<Option<String>> = sqlx::query_scalar(
        "SELECT (SELECT l.abha_number FROM patient_abha_links l \
                  WHERE l.tenant_id = p.tenant_id AND l.patient_id = p.id \
                    AND l.deleted_at IS NULL) \
           FROM patients p WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL",
    )
    .bind(link.patient_id)
    .bind(link.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    match current {
        None => return Err(AppError::NotFound),
        Some(Some(n)) if n != verified.abha_number => {
            let tail: String = n
                .chars()
                .skip(n.chars().count().saturating_sub(4))
                .collect();
            return Err(AppError::Conflict(format!(
                "this patient already has a different ABHA (ending {tail}) — \
                 check you have the right patient"
            )));
        }
        Some(_) => {}
    }

    let elsewhere: Option<String> = sqlx::query_scalar(
        "SELECT p.uhid FROM patient_abha_links l JOIN patients p ON p.id = l.patient_id \
         WHERE l.tenant_id = $1 AND l.abha_number = $2 AND l.patient_id <> $3 \
           AND l.deleted_at IS NULL",
    )
    .bind(link.tenant_id)
    .bind(&verified.abha_number)
    .bind(link.patient_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(uhid) = elsewhere {
        return Err(AppError::Conflict(format!(
            "this ABHA is already linked to patient {uhid} — open that record instead"
        )));
    }

    let kyc = verified.profile["kyc_verified"].as_bool().unwrap_or(false);
    let method = match (verified.method.as_str(), verified.otp_system.as_str()) {
        ("abha_number", "aadhaar") => "abha_aadhaar_otp",
        ("abha_number", _) => "abha_mobile_otp",
        ("aadhaar_enrol", _) => "created_aadhaar_otp",
        ("abha_address", _) => "abha_address_otp",
        // Shared from the patient's ABHA app through ABDM Scan & Share.
        ("scan_share", _) => "scan_share",
        _ => "mobile_otp",
    };
    sqlx::query(
        "INSERT INTO patient_abha_links \
           (tenant_id, patient_id, abha_number, abha_address, kyc_verified, status, \
            verified_at, verified_by, verification_id, verification_method, kyc_status, kyc_checked_at) \
         VALUES ($1, $2, $3, $4, $5, 'linked', now(), $6, $7, $8, $9, now()) \
         ON CONFLICT (tenant_id, patient_id) DO UPDATE SET \
           deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
           abha_number = EXCLUDED.abha_number, abha_address = EXCLUDED.abha_address, \
           kyc_verified = EXCLUDED.kyc_verified, status = 'linked', \
           verified_at = EXCLUDED.verified_at, verified_by = EXCLUDED.verified_by, \
           verification_id = EXCLUDED.verification_id, \
           verification_method = EXCLUDED.verification_method, \
           kyc_status = EXCLUDED.kyc_status, kyc_checked_at = EXCLUDED.kyc_checked_at",
    )
    .bind(link.tenant_id)
    .bind(link.patient_id)
    .bind(&verified.abha_number)
    .bind(&verified.abha_address)
    .bind(kyc)
    .bind(link.user_id)
    .bind(link.verification_id)
    .bind(method)
    .bind(if kyc { "verified" } else { "not_verified" })
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE patient_identifiers SET is_verified = true \
         WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
           AND ((id_type = 'abha'::identifier_type AND id_number = $3) \
             OR (id_type = 'abha_address'::identifier_type AND id_number = $4))",
    )
    .bind(link.tenant_id)
    .bind(link.patient_id)
    .bind(&verified.abha_number)
    .bind(&verified.abha_address)
    .execute(&mut **tx)
    .await?;

    apply_demographics(tx, &link, &verified.profile).await?;

    sqlx::query("UPDATE abha_verifications SET linked_patient_id = $2 WHERE id = $1")
        .bind(link.verification_id)
        .bind(link.patient_id)
        .execute(&mut **tx)
        .await?;
    let audit = serde_json::json!({
        "verification_id": link.verification_id,
        "verification_method": method,
        "applied": link.apply,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: link.tenant_id,
            user_id: Some(link.user_id),
            action: "patient.abha.linked",
            entity_type: "patient",
            entity_id: Some(link.patient_id),
            old_values: None,
            new_values: Some(&audit),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

#[derive(Debug)]
pub struct AbhaLinkRequest<'a> {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub patient_id: Uuid,
    pub verification_id: Uuid,
    pub expected_abha: Option<&'a str>,
    pub apply: &'a [AbhaField],
}

/// Copy the fields staff chose from the verified (server-held) profile —
/// never from anything the browser sent.
async fn apply_demographics(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    link: &AbhaLinkRequest<'_>,
    profile: &serde_json::Value,
) -> Result<(), AppError> {
    let text = |key: &str| {
        profile[key]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .map(str::trim)
    };
    let take = |field| link.apply.contains(&field);
    let (first, last) = if take(AbhaField::Name) {
        (text("first_name"), text("last_name"))
    } else {
        (None, None)
    };
    let middle = take(AbhaField::Name).then(|| text("middle_name")).flatten();
    let dob = take(AbhaField::DateOfBirth)
        .then(|| text("date_of_birth"))
        .flatten();
    let gender = take(AbhaField::Gender).then(|| text("gender")).flatten();
    if first.is_none() && dob.is_none() && gender.is_none() {
        return Ok(());
    }
    sqlx::query(
        "UPDATE patients SET \
           first_name = COALESCE($3, first_name), \
           middle_name = CASE WHEN $3 IS NULL THEN middle_name ELSE $4 END, \
           last_name = COALESCE($5, last_name), \
           date_of_birth = COALESCE($6::date, date_of_birth), \
           gender = COALESCE($7::gender, gender) \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(link.patient_id)
    .bind(link.tenant_id)
    .bind(first)
    .bind(middle)
    .bind(last)
    .bind(dob)
    .bind(gender)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
