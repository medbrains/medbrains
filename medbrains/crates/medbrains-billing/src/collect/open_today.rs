//! `GET /api/billing/counter/open-today` — the patients the counter is waiting
//! for: everyone with an open bill charged today.
//!
//! The cashier counter was a blank page until a name was typed, and the cashier
//! seldom knows the name: OPD, lab and pharmacy each post their own charges, and
//! the patient walks up holding a token. This is the list they pick from.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{is_bypass_role, require_any_permission},
    },
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use super::lanes::ANY_COLLECT;

/// A counter is a shift's list, not a ledger; the cap bounds a runaway day.
const MAX_PATIENTS: i64 = 200;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OpenTodayRow {
    pub patient_id: Uuid,
    /// Present only for a caller who may see patient names.
    pub patient_name: Option<String>,
    pub uhid: String,
    pub bill_count: i64,
    pub balance: Decimal,
    pub last_charged_at: chrono::DateTime<chrono::Utc>,
}

pub async fn open_today(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OpenTodayRow>>, AppError> {
    let mut allowed = ANY_COLLECT.to_vec();
    allowed.push(permissions::billing::invoices::VIEW);
    require_any_permission(&claims, &allowed)?;
    let can_see_names = is_bypass_role(&claims)
        || claims.permissions.iter().any(|p| p == permissions::patients::VIEW);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // "Today" is the hospital's day. A bill is on today's list when something
    // was charged to it today, however old the bill.
    let mut rows = sqlx::query_as::<_, OpenTodayRow>(
        "SELECT p.id AS patient_id, \
                CASE WHEN $2::bool THEN CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) END \
                  AS patient_name, \
                p.uhid, COUNT(DISTINCT i.id) AS bill_count, \
                SUM(i.total_amount - i.paid_amount) AS balance, \
                MAX(i.updated_at) AS last_charged_at \
           FROM invoices i \
           JOIN patients p ON p.id = i.patient_id AND p.tenant_id = i.tenant_id \
          WHERE i.tenant_id = $1 AND i.deleted_at IS NULL \
            AND i.status IN ('draft', 'issued', 'partially_paid') \
            AND i.total_amount > i.paid_amount \
            AND tenant_local_date($1, i.updated_at) = tenant_local_date($1, now()) \
          GROUP BY p.id \
          ORDER BY MAX(i.updated_at) DESC \
          LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(can_see_names)
    .bind(MAX_PATIENTS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let restricted = crate::resolve_billing_restricted_fields(&state, &claims).await?;
    if crate::should_scrub_billing_amount(&restricted) {
        for row in &mut rows {
            row.balance = Decimal::ZERO;
        }
    }
    Ok(Json(rows))
}
