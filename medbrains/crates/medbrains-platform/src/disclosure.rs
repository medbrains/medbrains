//! Statutory disclosures of patient data to public-health authorities.
//!
//! Notifying TB to Ni-kshay, a case to IDSP/IHIP, or a birth or death to the
//! civil registrar needs no consent: DPDP Act 2023 s.7(d) allows processing to
//! meet a legal obligation to disclose to the State. It does need a record of
//! who disclosed whose data, to whom, and under what law -- in the audit chain,
//! where it cannot be quietly edited away.

use chrono::NaiveDate;
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The DPDP ground every statutory disclosure rests on.
pub const LEGAL_BASIS: &str = "DPDP Act 2023 s.7(d): disclosure required by law";

/// One statutory disclosure: what was handed over, and to whom.
#[derive(Debug)]
pub struct Disclosure<'a> {
    /// `prepared` (a sheet made for submission) or `submitted`.
    pub stage: &'a str,
    /// The authority: `Ni-kshay`, `IDSP/IHIP`, `CRS`.
    pub recipient: &'a str,
    /// The law that requires it.
    pub statute: &'a str,
    pub entity_type: &'a str,
    /// The records disclosed.
    pub record_ids: &'a [Uuid],
    /// The authority's acknowledgement, once submitted.
    pub reference: Option<&'a str>,
}

/// Write the disclosure to the audit chain, in the caller's transaction.
///
/// # Errors
/// A database fault; the caller's transaction then rolls back, so nothing is
/// disclosed without its record.
pub async fn record(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    d: &Disclosure<'_>,
) -> Result<(), AppError> {
    let detail = json!({
        "stage": d.stage,
        "recipient": d.recipient,
        "statute": d.statute,
        "legal_basis": LEGAL_BASIS,
        "record_ids": d.record_ids,
        "reference": d.reference,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "statutory_disclosure",
            entity_type: d.entity_type,
            entity_id: match d.record_ids {
                [one] => Some(*one),
                _ => None,
            },
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// A worklist row (`r`) that is a TB notification: TB (A15-A19), or a
/// disease the hospital's list sends to Ni-kshay. TB goes to Ni-kshay, never
/// on an IDSP list.
#[macro_export]
macro_rules! is_tb_sql {
    () => {
        "(r.icd10_code ~ '^A1[5-9]' OR r.reporting_body ILIKE '%ni-kshay%')"
    };
}

/// The patient's (`p`) residential address and PIN, as one line each: the
/// primary structured address (`pa`, joined by [`patient_address_join`]),
/// else the registration address.
#[macro_export]
macro_rules! patient_address_sql {
    () => {
        "COALESCE(NULLIF(concat_ws(', ', pa.address_line1, pa.address_line2, pa.village_town, \
                                   pa.city), ''), \
                  NULLIF(concat_ws(', ', p.address->>'line1', p.address->>'line2', \
                                   p.address->>'city', p.address->>'state'), ''), \
                  p.address_line1) AS address, \
         COALESCE(pa.postal_code, p.address->>'pincode') AS pin"
    };
}

/// The lateral join [`patient_address_sql`] reads.
#[macro_export]
macro_rules! patient_address_join {
    () => {
        "LEFT JOIN LATERAL ( \
             SELECT address_line1, address_line2, village_town, city, postal_code \
               FROM patient_addresses \
              WHERE patient_id = p.id AND deleted_at IS NULL \
              ORDER BY is_primary DESC, created_at DESC LIMIT 1) pa ON true"
    };
}

/// Sex as the government forms write it.
pub fn sex_code(gender: Option<&str>) -> &'static str {
    match gender {
        Some("male") => "M",
        Some("female") => "F",
        Some("other") => "O",
        _ => "",
    }
}

/// A date as the government forms write it: dd/mm/yyyy.
pub fn form_date(d: Option<NaiveDate>) -> String {
    d.map(|d| d.format("%d/%m/%Y").to_string())
        .unwrap_or_default()
}
