//! Prescription verification — what the QR on a printed script resolves to.
//!
//! # What this is for
//!
//! A pharmacist holding a paper prescription needs to know two things: that the
//! hospital really issued it, and that the paper in front of them has not been
//! altered since. Forgery is rarely a wholly invented script; it is far more
//! often a real one with a quantity or a drug changed. A page that confirms
//! only "this is genuine" cannot catch that, so this returns the prescribed
//! items and lets the pharmacist compare them against the paper.
//!
//! # What it deliberately does not return
//!
//! The patient's full name, phone, address, diagnosis, complaints and vitals.
//! The pharmacist already holds the paper carrying the name — what they need
//! from this page is confirmation that it *matches*, which initials and the
//! last four of the UHID give without the link itself becoming a way to look up
//! a stranger's identity and condition.
//!
//! # Why a token and not the encounter id
//!
//! The QR previously encoded the raw encounter id. That never expires, cannot
//! be revoked, and identifies the encounter to anyone who photographs the
//! paper. A token in its own table can be aged out, and its use can be counted.

use axum::{
    Json,
    extract::{Path, State},
};
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, state::AppState};

/// Long enough to cover a repeat dispense and a query weeks later, short enough
/// that a photographed prescription does not stay resolvable forever.
const VERIFY_LINK_DAYS: i32 = 180;

#[derive(Debug, Serialize)]
pub struct VerifiedMedication {
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
}

#[derive(Debug, Serialize)]
pub struct VerifiedPrescription {
    pub hospital_name: String,
    pub doctor_name: String,
    pub doctor_registration: Option<String>,
    /// Initials only — enough to match the paper, not enough to identify.
    pub patient_initials: String,
    /// Last four characters of the UHID, for the same reason.
    pub uhid_suffix: String,
    pub issued_on: chrono::NaiveDate,
    pub medications: Vec<VerifiedMedication>,
    /// How many times this link has been resolved before now. A script being
    /// checked repeatedly is worth a pharmacist's attention.
    pub previous_checks: i32,
}

fn initials(first: &str, last: &str) -> String {
    let take = |name: &str| {
        name.trim()
            .chars()
            .next()
            .unwrap_or('?')
            .to_uppercase()
            .to_string()
    };
    format!("{}{}", take(first), take(last))
}

fn uhid_suffix(uhid: &str) -> String {
    let chars: Vec<char> = uhid.chars().collect();
    let start = chars.len().saturating_sub(4);
    chars[start..].iter().collect()
}

/// `GET /api/public/prescriptions/verify/{token}`
///
/// Unauthenticated by necessity — the person scanning is a pharmacist at a
/// counter, not a user of this system.
pub async fn verify_prescription(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<VerifiedPrescription>, AppError> {
    // Deliberately the same error for "no such token" and "expired": telling
    // them apart would confirm that a token once existed.
    let expired_or_missing = || AppError::NotFound;

    let link = sqlx::query_as::<_, (Uuid, Uuid, chrono::DateTime<chrono::Utc>, i32)>(
        "SELECT tenant_id, encounter_id, expires_at, accessed_count \
         FROM prescription_verify_links WHERE token = $1",
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(expired_or_missing)?;

    let (tenant_id, encounter_id, expires_at, accessed_count) = link;
    if expires_at < chrono::Utc::now() {
        return Err(expired_or_missing());
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let header = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT p.first_name, p.last_name, p.uhid, \
                u.full_name, COALESCE(t.name, ''), e.created_at \
         FROM encounters e \
         JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         LEFT JOIN users u ON u.id = e.doctor_id \
         LEFT JOIN tenants t ON t.id = e.tenant_id \
         WHERE e.id = $1 AND e.tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(expired_or_missing)?;

    let medications = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT i.drug_name, i.dosage, i.frequency, i.duration \
         FROM prescriptions pr \
         JOIN prescription_items i \
           ON i.prescription_id = pr.id AND i.tenant_id = pr.tenant_id \
         WHERE pr.encounter_id = $1 AND pr.tenant_id = $2 \
         ORDER BY i.drug_name",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE prescription_verify_links \
         SET accessed_count = accessed_count + 1, last_accessed = now() \
         WHERE token = $1",
    )
    .bind(&token)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(VerifiedPrescription {
        hospital_name: header.4,
        doctor_name: header.3.unwrap_or_else(|| "Not recorded".to_owned()),
        doctor_registration: None,
        patient_initials: initials(&header.0, &header.1),
        uhid_suffix: uhid_suffix(&header.2),
        issued_on: header.5.date_naive(),
        medications: medications
            .into_iter()
            .map(
                |(drug_name, dosage, frequency, duration)| VerifiedMedication {
                    drug_name,
                    dosage,
                    frequency,
                    duration,
                },
            )
            .collect(),
        previous_checks: accessed_count,
    }))
}

#[derive(Debug, Serialize)]
pub struct VerifyLink {
    pub token: String,
}

/// `POST /api/opd/encounters/{id}/verify-link`
///
/// Called when a prescription is printed. Reuses a live link for the same
/// encounter rather than minting a new one on every reprint — otherwise the
/// access count, which is the only signal that a script is being checked
/// unusually often, would be split across a pile of tokens.
pub async fn issue_verify_link(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<medbrains_server_core::middleware::auth::Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<VerifyLink>, AppError> {
    // Minting a verify link exposes a prescription to whoever holds the link.
    // Scoped to the encounter permission rather than a pharmacy one: the issuer
    // is the clinic side, and it was previously any authenticated user in the
    // tenant, for any encounter id.
    medbrains_server_core::middleware::authorization::require_permission(
        &claims,
        medbrains_core::permissions::opd::visit::UPDATE,
    )?;
    // …and the permission alone was still not enough. It said the caller may
    // update visits SOMEWHERE; it did not say they may see THIS encounter. The
    // link this mints is public — whoever holds it reads the prescription
    // without authenticating — so issuing one for an encounter you have no
    // relationship with is a disclosure, not a lookup.
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing: Option<String> = sqlx::query_scalar(
        "SELECT token FROM prescription_verify_links \
         WHERE tenant_id = $1 AND encounter_id = $2 AND expires_at > now() \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(token) = existing {
        tx.commit().await?;
        return Ok(Json(VerifyLink { token }));
    }

    // 256 bits from the OS. A guessable token would make every prescription in
    // the hospital enumerable.
    let mut raw = [0u8; 32];
    getrandom::fill(&mut raw)
        .map_err(|e| AppError::Internal(format!("token generation failed: {e}")))?;
    let token = raw.iter().fold(String::with_capacity(64), |mut acc, byte| {
        use std::fmt::Write as _;
        let _ = write!(acc, "{byte:02x}");
        acc
    });

    sqlx::query(
        "INSERT INTO prescription_verify_links \
         (tenant_id, encounter_id, token, expires_at, created_by) \
         VALUES ($1, $2, $3, now() + make_interval(days => $4), $5)",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(&token)
    .bind(VERIFY_LINK_DAYS)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(VerifyLink { token }))
}
