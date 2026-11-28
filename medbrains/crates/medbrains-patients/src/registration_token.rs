//! The token a registration issues: the start of the patient's visit.

use medbrains_core::patient::Patient;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use uuid::Uuid;

/// Issue the registration token, skipped when the token module is off.
///
/// Registration is where a visit starts, so it mints the id the rest of the
/// journey shares: the lab and pharmacy tokens raised later carry the same
/// number, and the patient holds one slip instead of three.
pub(crate) async fn issue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient: &Patient,
) -> Result<(), AppError> {
    let patient_label = format!("{} {}", patient.first_name, patient.last_name);
    medbrains_tokens::issue_token_in_tx(
        tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            visit_id: Some(Uuid::new_v4()),
            module: "registration",
            scope: "global",
            scope_id: None,
            scope_label: Some("Registration"),
            priority: "normal",
            patient_id: Some(patient.id),
            patient_name: Some(patient_label.trim()),
            entity_type: Some("patient"),
            entity_id: Some(patient.id),
            issued_by: Some(claims.sub),
        },
    )
    .await?;
    Ok(())
}
