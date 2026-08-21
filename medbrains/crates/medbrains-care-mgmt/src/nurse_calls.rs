//! The ward call board.
//!
//! A patient's bedside tablet could raise a call from the first day the module
//! shipped, and the only way to read one back was
//! `GET /api/bedside/{admission_id}/nurse-requests` — one admission at a time,
//! which requires already knowing who is calling. Nothing anywhere answered
//! "who is waiting right now". The schema had been ready for it the whole
//! time: `idx_bedside_req_pending` is a partial index on
//! `(tenant_id, status) WHERE status IN ('pending','acknowledged')`, built for
//! exactly the query nobody had written.
//!
//! # Why no per-record check
//!
//! This is a place's worklist, not a person's record, and the distinction is
//! the whole point: a nurse coming on shift answers the call from the bed that
//! is ringing, not from the patients they already hold a care-team tuple for.
//! Filtering by permitted patients would empty the board for the exact person
//! it exists to serve. It is scoped instead by `bedside.calls.board`, a
//! permission created for this and held by `nurse` alone, and optionally
//! narrowed to one ward.
//!
//! # What is deliberately not here
//!
//! Escalation is computed and displayed; it is not *routed*. There is no
//! `charge_nurse` or `nursing_supervisor` role in `roles.rs` to route it to,
//! and inventing one to satisfy a checklist row would create an unheld role
//! that looks like coverage. Raising the level where a human is already
//! looking is the honest half of the feature.
//!
//! No patient name is projected. A bed number is what answers a call, and a
//! nursing-station screen is visible to more people than the nurse in front of
//! it.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState, tenant_config,
};

/// Two minutes to the charge nurse, five to the supervisor — the NABH nursing
/// checklist's numbers, overridable per tenant.
const DEFAULT_ESCALATE_SECS: i32 = 120;
const DEFAULT_SUPERVISOR_SECS: i32 = 300;

/// A board is read at a glance; past a couple of hundred rows it has stopped
/// being one and the ward has a bigger problem than pagination.
const MAX_ROWS: i64 = 200;

#[derive(Debug, Deserialize)]
pub struct ActiveCallsQuery {
    pub ward_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ActiveNurseCall {
    pub id: Uuid,
    pub admission_id: Uuid,
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub request_type: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
    pub waiting_seconds: i32,
}

/// What the board shows, and the thresholds it was judged against.
///
/// The thresholds travel with the rows so a screen renders the same colours
/// the server used to pick them, instead of hard-coding two numbers that a
/// hospital is entitled to change.
#[derive(Debug, Serialize)]
pub struct NurseCallBoard {
    pub calls: Vec<BoardCall>,
    pub escalate_secs: i32,
    pub supervisor_secs: i32,
}

#[derive(Debug, Serialize)]
pub struct BoardCall {
    #[serde(flatten)]
    pub call: ActiveNurseCall,
    pub escalation: &'static str,
}

/// `normal` → `charge_nurse` → `supervisor`, by how long the patient has been
/// waiting for someone to arrive.
///
/// Measured from `created_at`, not from `acknowledged_at`: acknowledging a call
/// is a nurse saying "seen", and a call that has been seen for eleven minutes
/// and not answered is the one that needs escalating most. Letting the
/// acknowledgement restart the clock would make the board quietest exactly when
/// it should be loudest.
const fn escalation_of(waiting_seconds: i32, escalate: i32, supervisor: i32) -> &'static str {
    if waiting_seconds >= supervisor {
        "supervisor"
    } else if waiting_seconds >= escalate {
        "charge_nurse"
    } else {
        "normal"
    }
}

/// GET /api/bedside/nurse-calls/active
pub async fn active_nurse_calls(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ActiveCallsQuery>,
) -> Result<Json<NurseCallBoard>, AppError> {
    require_permission(&claims, permissions::bedside::calls::BOARD)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let escalate_secs = tenant_config::setting_i32(
        &mut tx,
        &claims.tenant_id,
        tenant_config::keys::NURSE_CALL_ESCALATE_SECS,
        DEFAULT_ESCALATE_SECS,
    )
    .await?;
    let supervisor_secs = tenant_config::setting_i32(
        &mut tx,
        &claims.tenant_id,
        tenant_config::keys::NURSE_CALL_SUPERVISOR_SECS,
        DEFAULT_SUPERVISOR_SECS,
    )
    .await?;

    // One statement, three tables. The bed and ward are what make a call
    // answerable, and fetching them per row would turn a board refresh into
    // 3N round trips on the busiest screen in the ward.
    let rows = sqlx::query_as::<_, ActiveNurseCall>(
        "SELECT r.id, r.admission_id, \
                w.id AS ward_id, w.name AS ward_name, b.bed_number, \
                r.request_type::text AS request_type, \
                r.status::text AS status, \
                r.notes, r.created_at, r.acknowledged_at, \
                GREATEST(0, EXTRACT(EPOCH FROM (now() - r.created_at))::int) AS waiting_seconds \
           FROM bedside_nurse_requests r \
           JOIN admissions a ON a.id = r.admission_id AND a.tenant_id = r.tenant_id \
           LEFT JOIN beds b ON b.id = a.bed_id AND b.deleted_at IS NULL \
           LEFT JOIN wards w ON w.id = b.ward_id \
          WHERE r.tenant_id = $1 \
            AND r.status IN ('pending', 'acknowledged') \
            AND r.deleted_at IS NULL \
            AND ($2::uuid IS NULL OR w.id = $2) \
          ORDER BY r.created_at \
          LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(params.ward_id)
    .bind(MAX_ROWS)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(NurseCallBoard {
        calls: rows
            .into_iter()
            .map(|call| BoardCall {
                escalation: escalation_of(call.waiting_seconds, escalate_secs, supervisor_secs),
                call,
            })
            .collect(),
        escalate_secs,
        supervisor_secs,
    }))
}

#[cfg(test)]
mod tests {
    use super::escalation_of;

    #[test]
    fn escalates_by_how_long_the_patient_waited() {
        assert_eq!(escalation_of(0, 120, 300), "normal");
        assert_eq!(escalation_of(119, 120, 300), "normal");
        // The threshold is the moment it escalates, not the second after.
        assert_eq!(escalation_of(120, 120, 300), "charge_nurse");
        assert_eq!(escalation_of(299, 120, 300), "charge_nurse");
        assert_eq!(escalation_of(300, 120, 300), "supervisor");
    }

    #[test]
    fn a_tenant_that_answers_faster_escalates_sooner() {
        // An ICU set to 30s/60s must not inherit the ward's two minutes.
        assert_eq!(escalation_of(45, 30, 60), "charge_nurse");
        assert_eq!(escalation_of(45, 120, 300), "normal");
    }

    #[test]
    fn misconfigured_thresholds_never_skip_the_top_level() {
        // supervisor below escalate is a settings mistake, not a crash: the
        // longest wait must still read as the most urgent thing on the board.
        assert_eq!(escalation_of(400, 300, 120), "supervisor");
    }
}
