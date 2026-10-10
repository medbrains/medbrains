//! The refill terms a prescriber writes on a prescription, checked before it
//! is saved. The rules themselves live in `medbrains_core::rx_refills`, shared
//! with the pharmacy that issues the refills.

use chrono::Utc;
use medbrains_core::permissions;
use medbrains_core::rx_refills::{RefillTerms, terms_problem};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Refuse refill terms the prescriber may not write. Refills are the
/// doctor's to authorise — a verbal order or a nurse's draft carries none —
/// and never on a Schedule X, H1 or NDPS line.
pub async fn check_refill_terms(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    terms: RefillTerms,
    catalog_ids: &[Uuid],
    is_verbal: bool,
) -> Result<(), AppError> {
    if terms.refills > 0 {
        if is_verbal {
            return Err(AppError::BadRequest(
                "Refills are authorised by the doctor, not on a verbal order".to_owned(),
            ));
        }
        require_permission(claims, permissions::opd::visit::UPDATE)?;
    }
    let controlled: Vec<String> = if terms.refills > 0 && !catalog_ids.is_empty() {
        sqlx::query_scalar(
            "SELECT name FROM pharmacy_catalog \
             WHERE tenant_id = $1 AND id = ANY($2) \
               AND (is_controlled OR drug_schedule IN ('X', 'H1', 'NDPS')) \
             ORDER BY name",
        )
        .bind(claims.tenant_id)
        .bind(catalog_ids)
        .fetch_all(&mut **tx)
        .await?
    } else {
        Vec::new()
    };
    terms_problem(terms, Utc::now().date_naive(), &controlled)
        .map_or(Ok(()), |problem| Err(AppError::BadRequest(problem)))
}
