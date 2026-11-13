//! `GET /api/pharmacy/orders/{id}/safety-record` — what the medication-safety
//! gate found on one order and what was done about it.
//!
//! Every refusal, override and caution on a dispense is filed in
//! `cpoe_safety_audit`: a blocked Schedule X dispense, a controlled drug handed
//! over without a witness on a reason, a look-alike caution. Filed and unread
//! is not a log anyone can use, so the pharmacy order shows it.

use axum::Extension;
use axum::{
    Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::authz::{Relation, Resource, authorize, authz_context, collapse};
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use uuid::Uuid;

/// The most entries one order's record shows.
const SAFETY_RECORD_LIMIT: i64 = 200;

/// One finding on the order, as filed.
#[derive(Debug, Serialize)]
pub struct SafetyRecordRow {
    pub id: Uuid,
    pub warning_code: String,
    pub severity: String,
    /// `blocked`, `warned` or `overridden`.
    pub action_taken: String,
    pub message: String,
    pub override_reason: Option<String>,
    /// Who the gate checked: the pharmacist at the counter.
    pub checked_by_name: Option<String>,
    pub checked_at: DateTime<Utc>,
}

/// Lists the safety findings filed against one pharmacy order, newest first.
pub async fn order_safety_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SafetyRecordRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;
    // The same per-order gate as the order itself.
    let order = Resource {
        kind: "pharmacy_order",
        id,
    };
    collapse(
        authorize(
            &*state.authz,
            &authz_context(&claims),
            Relation::Viewer,
            order,
        )
        .await,
    )?;

    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as!(
        SafetyRecordRow,
        "SELECT a.id, a.warning_code, a.severity, a.action_taken, a.message, \
                a.override_reason, u.full_name AS \"checked_by_name?\", a.checked_at \
           FROM cpoe_safety_audit a \
           LEFT JOIN users u ON u.id = a.checked_by AND u.tenant_id = a.tenant_id \
          WHERE a.tenant_id = $1 AND a.source_module = 'pharmacy' \
            AND a.source_record_id = $2 AND a.deleted_at IS NULL \
          ORDER BY a.checked_at DESC \
          LIMIT $3",
        claims.tenant_id,
        id,
        SAFETY_RECORD_LIMIT,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
