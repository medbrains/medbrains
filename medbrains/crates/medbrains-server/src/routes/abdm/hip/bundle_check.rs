//! The NRCeS structural check on the HIP send path.
//!
//! Every bundle a transfer is about to send is checked against the profiles
//! it claims (`medbrains_fhir::nrces::conformance`). A failing bundle is
//! still sent — the consent's two-hour window is the patient's, and a held
//! record would fail them silently — but each rule it breaks is kept on its
//! care context, where the ABDM screens list it with the sharing failures
//! until a later transfer sends it clean.

use medbrains_fhir::nrces::conformance::violations;
use serde_json::Value;
use uuid::Uuid;

use crate::error::AppError;

/// What the check found per care context, joined one rule per line; an
/// empty string is a clean bundle. Pure, so the send path's verdict is
/// tested without a database.
#[must_use]
pub fn findings(documents: &[(String, Value)]) -> (Vec<String>, Vec<String>) {
    documents
        .iter()
        .map(|(reference, bundle)| {
            let broken = violations(bundle);
            if !broken.is_empty() {
                tracing::warn!(
                    reference,
                    rules = broken.len(),
                    "abdm: sending a bundle that breaks its NRCeS profile"
                );
            }
            (reference.clone(), broken.join("\n"))
        })
        .unzip()
}

/// Record [`findings`] on the patient's care contexts, in one statement.
///
/// # Errors
/// A database fault.
pub async fn record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    documents: &[(String, Value)],
) -> Result<(), AppError> {
    let (references, issues) = findings(documents);
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_care_contexts c \
            SET conformance_issues = CASE WHEN u.issues = '' THEN '{}'::text[] \
                                          ELSE string_to_array(u.issues, E'\\n') END, \
                conformance_checked_at = now() \
           FROM unnest($3::text[], $4::text[]) AS u(reference_number, issues) \
          WHERE c.tenant_id = $1 AND c.patient_id = $2 \
            AND c.reference_number = u.reference_number AND c.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(&references)
    .bind(&issues)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::findings;
    use serde_json::json;

    /// Given one bundle that is not a document and one with no entries,
    /// When a transfer checks them, Then each care context gets its own
    /// rules, one per line, in the order the bundles were built.
    #[test]
    fn each_care_context_keeps_its_own_broken_rules() {
        let documents = vec![
            (
                "OP-1".to_owned(),
                json!({ "resourceType": "Bundle", "type": "collection" }),
            ),
            (
                "RX-2".to_owned(),
                json!({ "resourceType": "Bundle", "type": "document" }),
            ),
        ];
        let (references, issues) = findings(&documents);
        assert_eq!(references, ["OP-1", "RX-2"]);
        assert!(
            issues[0].contains("Bundle.type is not document"),
            "{}",
            issues[0]
        );
        assert!(
            !issues[1].contains("Bundle.type is not document"),
            "{}",
            issues[1]
        );
        assert!(
            issues[1].contains("first entry is not a Composition"),
            "{}",
            issues[1]
        );
        assert!(issues.iter().all(|i| i.lines().count() > 1));
    }
}
