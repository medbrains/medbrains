//! Expired stock, kept apart from "expiring soon".
//!
//! A batch past its date may not be dispensed at all: it is quarantined and
//! destroyed. Listing it among batches that are merely expiring soon told a
//! pharmacist the shelf was still usable. Controlled drugs (NDPS) are listed
//! but never destroyed by the bulk write-off: their destruction is an NDPS
//! register entry with a second witness.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::pharmacy_phase2::ExpiredBatchRow;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::{
    PHARMACY_BATCH_NUMBER_FIELD, resolve_pharmacy_restricted_fields, should_scrub_pharmacy_field,
};

/// Listed per screen, oldest first; a pharmacy with more has a bigger problem
/// than paging.
const EXPIRED_LIST_LIMIT: i64 = 500;

/// `GET /api/pharmacy/batches/expired` — batches past their date with stock left.
pub(crate) async fn list_expired(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ExpiredBatchRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;
    let restricted = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let scrub_batch = should_scrub_pharmacy_field(&restricted, PHARMACY_BATCH_NUMBER_FIELD);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, ExpiredBatchRow>(
        "SELECT b.id AS batch_id, c.name AS drug_name, b.batch_number, b.expiry_date, \
         b.quantity_on_hand, (CURRENT_DATE - b.expiry_date)::int AS days_expired, \
         c.is_controlled \
         FROM pharmacy_batches b \
         JOIN pharmacy_catalog c ON c.id = b.catalog_item_id AND c.tenant_id = b.tenant_id \
         WHERE b.tenant_id = $1 AND b.deleted_at IS NULL AND c.deleted_at IS NULL \
         AND b.quantity_on_hand > 0 AND b.expiry_date < CURRENT_DATE \
         ORDER BY b.expiry_date ASC LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(EXPIRED_LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(
        rows.into_iter()
            .map(|mut row| {
                if scrub_batch {
                    "Restricted".clone_into(&mut row.batch_number);
                }
                row
            })
            .collect(),
    ))
}
