//! Who may cancel a clinical order.
//!
//! Viewing the patient is not enough: a second doctor on the case could
//! otherwise cancel the first doctor's tests. An order is cancelled by the
//! person who placed it — schema.zed's `cancel = ordering_provider`, whose
//! source is the order's `ordered_by` column — or by the department that runs
//! it (a duplicate, a rejected sample, a study it cannot perform), marked by a
//! `*.orders.cancel_any` permission.

use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};

/// Allow the ordering provider, the department team (`team_permission`) or a
/// bypass role. Anyone else gets 404, like every per-record denial, so the
/// endpoint is not an oracle for which orders exist.
pub fn require_order_cancel(
    claims: &Claims,
    ordered_by: Uuid,
    team_permission: &str,
) -> Result<(), AppError> {
    if ordered_by == claims.sub || is_bypass_role(claims) {
        return Ok(());
    }
    require_permission(claims, team_permission).map_err(|_| AppError::NotFound)
}
