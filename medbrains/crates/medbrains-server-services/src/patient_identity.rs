//! Who a worklist row is about: name, UHID and sex for many patients at once.
//!
//! A worklist the caller may read (lab orders, a pharmacy queue) names the
//! patient on every row. Fetching each patient's record per row was one
//! request per row, and the record itself needs care-team access the lab or
//! pharmacy does not hold, so rows read "Unresolved patient". The list
//! carries the identity instead: one query for the page, masked per the
//! caller's field access exactly as the patient record is.

use std::collections::HashMap;

use medbrains_core::form::FieldAccessLevel;
use medbrains_core::privacy::{mask_identifier_keep_last, mask_name};
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct PatientIdentity {
    pub id: Uuid,
    pub uhid: String,
    pub full_name: String,
    pub gender: String,
}

#[derive(sqlx::FromRow)]
struct Row {
    id: Uuid,
    uhid: String,
    prefix: Option<String>,
    first_name: String,
    middle_name: Option<String>,
    last_name: String,
    gender: String,
}

fn level(restricted: &HashMap<String, FieldAccessLevel>, field: &str) -> FieldAccessLevel {
    restricted
        .get(field)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

/// One name part as this caller may see it: whole, masked or not at all.
fn part(value: &str, access: FieldAccessLevel) -> Option<String> {
    match access {
        FieldAccessLevel::Hidden => None,
        FieldAccessLevel::Mask => Some(mask_name(value)),
        FieldAccessLevel::View | FieldAccessLevel::Edit => Some(value.to_owned()),
    }
}

fn identity(row: Row, restricted: &HashMap<String, FieldAccessLevel>) -> PatientIdentity {
    let first = part(&row.first_name, level(restricted, "patients.first_name"));
    let middle = row
        .middle_name
        .as_deref()
        .and_then(|m| part(m, level(restricted, "patients.middle_name")));
    let last = part(&row.last_name, level(restricted, "patients.last_name"));
    let names: Vec<String> = [row.prefix, first, middle, last]
        .into_iter()
        .flatten()
        .filter(|s| !s.trim().is_empty())
        .collect();
    let uhid = match level(restricted, "patients.uhid") {
        FieldAccessLevel::Hidden => "Restricted".to_owned(),
        FieldAccessLevel::Mask => mask_identifier_keep_last(&row.uhid, 4),
        FieldAccessLevel::View | FieldAccessLevel::Edit => row.uhid,
    };
    PatientIdentity {
        id: row.id,
        uhid,
        full_name: if names.is_empty() {
            "Restricted".to_owned()
        } else {
            names.join(" ")
        },
        gender: row.gender,
    }
}

/// The identities of `ids`, one query, masked for the caller. The caller
/// has already decided these rows are theirs to see.
#[allow(clippy::implicit_hasher)]
pub async fn patient_identities(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    ids: &[Uuid],
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<Vec<PatientIdentity>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT id, uhid, prefix, first_name, middle_name, last_name, gender::text AS gender \
           FROM patients WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| identity(r, restricted)).collect())
}

#[cfg(test)]
mod tests {
    use super::{FieldAccessLevel, HashMap, Row, Uuid, identity};

    fn row() -> Row {
        Row {
            id: Uuid::nil(),
            uhid: "ACMS-2026-04925".into(),
            prefix: None,
            first_name: "Asha".into(),
            middle_name: None,
            last_name: "Rao".into(),
            gender: "female".into(),
        }
    }

    #[test]
    fn an_unrestricted_caller_reads_the_name_whole() {
        let id = identity(row(), &HashMap::new());
        assert_eq!(
            (id.full_name.as_str(), id.uhid.as_str()),
            ("Asha Rao", "ACMS-2026-04925")
        );
    }

    #[test]
    fn a_restricted_caller_gets_it_masked_or_withheld() {
        let restricted = HashMap::from([
            ("patients.first_name".to_owned(), FieldAccessLevel::Mask),
            ("patients.last_name".to_owned(), FieldAccessLevel::Hidden),
            ("patients.uhid".to_owned(), FieldAccessLevel::Mask),
        ]);
        let id = identity(row(), &restricted);
        assert!(
            !id.full_name.contains("Asha") && !id.full_name.contains("Rao"),
            "{}",
            id.full_name
        );
        assert!(
            id.uhid.ends_with("4925") && !id.uhid.contains("ACMS"),
            "{}",
            id.uhid
        );
    }
}
