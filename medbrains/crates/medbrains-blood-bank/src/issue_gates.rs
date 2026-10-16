//! The refusals that stand between a unit and a vein.
//!
//! Issue: a red-cell unit goes to a patient only on a compatible crossmatch
//! for that patient and that unit, grouped on the crossmatch sample to match
//! the record, except an uncrossmatched O-negative unit released in an
//! emergency by someone holding the override permission, with a reason, on
//! the audit log. The donor's side of the needle is `donor_eligibility`.
//!
//! Every refusal is audited too — a blocked attempt is the near miss the
//! haemovigilance committee wants to see.

use serde_json::json;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

/// Write a refusal to the audit log in its own transaction (the request's
/// own one is rolled back) and hand the error back. A failure to audit is
/// logged, never allowed to turn the safety refusal into something else.
pub(crate) async fn audited(
    state: &AppState,
    claims: &Claims,
    action: &str,
    entity_id: Option<Uuid>,
    err: AppError,
) -> AppError {
    let message = err.to_string();
    let written = async {
        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id: claims.tenant_id,
                user_id: Some(claims.sub),
                action,
                entity_type: "blood_bank",
                entity_id,
                old_values: None,
                new_values: Some(&json!({ "refused": message })),
                ip_address: None,
            },
        )
        .await?;
        tx.commit().await?;
        Ok::<(), AppError>(())
    }
    .await;
    if let Err(audit_err) = written {
        tracing::error!(action, error = %audit_err, "blood bank refusal could not be audited");
    }
    err
}

/// Red-cell-containing components are crossmatched; plasma, platelets and
/// cryoprecipitate are issued on ABO group alone.
#[must_use]
pub fn requires_crossmatch(component_type: &str) -> bool {
    matches!(component_type, "whole_blood" | "prbc" | "granulocytes")
}

/// A compatible crossmatch for this patient and this unit, tested within the
/// last 72 hours (antibodies can form after that).
pub(crate) async fn find_valid_crossmatch(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    component_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM crossmatch_requests \
          WHERE tenant_id = $1 AND patient_id = $2 AND component_id = $3 \
            AND status IN ('compatible', 'issued') \
            AND tested_at >= now() - interval '72 hours' AND deleted_at IS NULL \
          ORDER BY tested_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(component_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Why an emergency uncrossmatched release cannot go ahead, or `None`.
/// The permission is checked by the caller; this is the clinical rule.
#[must_use]
pub fn emergency_release_refusal(unit_group: &str, reason: Option<&str>) -> Option<String> {
    if reason.is_none_or(|r| r.trim().is_empty()) {
        return Some(
            "An emergency uncrossmatched release needs a written reason (the clinical emergency \
             and the requesting doctor)."
                .to_owned(),
        );
    }
    (unit_group != "o_negative").then(|| {
        "Emergency uncrossmatched release is O-negative only. Choose an O-negative unit, or \
         wait for the crossmatch."
            .to_owned()
    })
}

/// One spelling for a group: "A+" from a label, "a_positive" from the enum.
fn canonical_group(group: &str) -> Option<&'static str> {
    match group.trim().to_ascii_lowercase().replace(' ', "").as_str() {
        "a+" | "a_positive" => Some("a_positive"),
        "a-" | "a_negative" => Some("a_negative"),
        "b+" | "b_positive" => Some("b_positive"),
        "b-" | "b_negative" => Some("b_negative"),
        "ab+" | "ab_positive" => Some("ab_positive"),
        "ab-" | "ab_negative" => Some("ab_negative"),
        "o+" | "o_positive" => Some("o_positive"),
        "o-" | "o_negative" => Some("o_negative"),
        _ => None,
    }
}

/// Re-grouping before red cells (AABB/NABH): the ABO/Rh found on the
/// crossmatch sample must be a real group and must match the patient's
/// recorded group. A discrepancy is a wrong-blood-in-tube until proved
/// otherwise.
#[must_use]
pub fn regrouping_refusal(sample_group: &str, recorded_group: &str) -> Option<String> {
    let Some(sample) = canonical_group(sample_group) else {
        return Some(
            "The crossmatch sample has no ABO/Rh grouping. Group the patient on the crossmatch \
             sample before issuing red cells."
                .to_owned(),
        );
    };
    (canonical_group(recorded_group) != Some(sample)).then(|| {
        format!(
            "Group discrepancy: the crossmatch sample groups as {sample_group}, the patient's \
             record says {recorded_group}. Do not issue. Draw a fresh sample and regroup."
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{emergency_release_refusal, regrouping_refusal, requires_crossmatch};

    #[test]
    fn emergency_release_is_o_negative_with_a_reason_only() {
        assert!(emergency_release_refusal("o_negative", Some("PPH, Dr Rao")).is_none());
        assert!(emergency_release_refusal("o_positive", Some("PPH")).is_some());
        assert!(emergency_release_refusal("o_negative", Some("  ")).is_some());
        assert!(requires_crossmatch("prbc") && !requires_crossmatch("ffp"));
    }

    #[test]
    fn regrouping_blocks_a_discrepancy_or_an_ungrouped_sample() {
        assert!(regrouping_refusal("a_positive", "A+").is_none());
        assert!(regrouping_refusal("b_positive", "a_positive").is_some());
        assert!(regrouping_refusal("unknown", "a_positive").is_some());
    }
}
