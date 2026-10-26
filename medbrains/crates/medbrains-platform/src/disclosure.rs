//! Statutory disclosures of patient data to public-health authorities.
//!
//! Notifying TB to Ni-kshay, a case to IDSP/IHIP, or a birth or death to the
//! civil registrar needs no consent: DPDP Act 2023 s.7(d) allows processing to
//! meet a legal obligation to disclose to the State. It does need a record of
//! who disclosed whose data, to whom, and under what law -- in the audit chain,
//! where it cannot be quietly edited away.

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
