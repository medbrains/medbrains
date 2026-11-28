//! A possible medico-legal case, waiting for a doctor.
//!
//! A complaint that reads like one ("road traffic accident", "assault") never
//! blocks the visit or the triage: whoever is at the desk saves, and the visit
//! is marked `suspected` for a doctor to decide. Nothing here registers an MLC
//! from text alone.

use chrono::{DateTime, Utc};
use medbrains_core::emergency::ErVisit;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use serde::Serialize;
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// What a visit carries about a possible medico-legal case. `mlc_suspicion`
/// is `suspected` until a doctor decides, then `confirmed` or `dismissed`;
/// `None` means the complaint never raised the question.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MlcSuspicion {
    pub mlc_suspicion: Option<String>,
    pub mlc_suspected_type: Option<String>,
    pub mlc_suspicion_reason: Option<String>,
    pub mlc_suspicion_decided_by: Option<Uuid>,
    pub mlc_suspicion_decided_at: Option<DateTime<Utc>>,
}

/// An ER visit as the list and the visit page read it: the row and its
/// medico-legal suspicion, as one flat object.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ErVisitView {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub visit: ErVisit,
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub mlc: MlcSuspicion,
}

impl ErVisitView {
    /// The visit as this caller may see it. A caller without the full ER
    /// view still sees that a decision is pending, but not the doctor's
    /// reason or name.
    pub(crate) fn for_caller(mut self, claims: &Claims) -> Self {
        if !super::can_view_full_er_visit(claims) {
            self.mlc.mlc_suspicion_reason = None;
            self.mlc.mlc_suspicion_decided_by = None;
        }
        self.visit = super::filter_er_visit_response(self.visit, claims);
        self
    }
}

/// Writes one row to the hash-chained audit log about a visit's MLC suspicion.
async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    visit_id: Uuid,
    action: &str,
    new_values: serde_json::Value,
) -> Result<(), AppError> {
    let entry = AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "er_visit",
        entity_id: Some(visit_id),
        old_values: None,
        new_values: Some(&new_values),
        ip_address: None,
    };
    Ok(AuditLogger::log(tx, &entry).await?)
}

/// Marks a visit as a possible medico-legal case because its complaint text
/// matched, and records who was saving and that the inference fired. A visit
/// that is already an MLC, or whose suspicion was already raised or decided,
/// is left alone, so a later triage cannot reopen a doctor's dismissal.
pub(crate) async fn flag_suspected(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    visit_id: Uuid,
    case_type: &str,
    source: &str,
) -> Result<(), AppError> {
    let flagged = sqlx::query!(
        "UPDATE er_visits
            SET mlc_suspicion = 'suspected', mlc_suspected_type = $3, updated_at = now()
          WHERE id = $1 AND tenant_id = $2 AND is_mlc = false AND mlc_suspicion IS NULL",
        visit_id,
        claims.tenant_id,
        case_type,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if flagged == 0 {
        return Ok(());
    }
    let new = json!({ "mlc_suspicion": "suspected", "case_type": case_type,
        "inferred_from": "complaint_text", "saved_on": source });
    audit(tx, claims, visit_id, "er_visit.mlc_suspected", new).await
}
