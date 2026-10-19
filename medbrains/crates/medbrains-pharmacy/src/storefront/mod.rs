//! The patient storefront (#4849): the hospital's own pharmacy, ordered from
//! online like an e-pharmacy. Anyone may browse what the pharmacist has put
//! online; ordering needs a sign-in (a patient, or a light pharmacy-customer
//! record made at sign-in). Rules are `medbrains_core::pharmacy_storefront`;
//! delivery and payment are part 3's (`medbrains_pharmacy_delivery`).
//!
//! The patient-facing functions here take the patient from the caller, who
//! binds it from the patient's token; the staff handlers are routed below.

pub mod cart;
pub mod catalog;
pub mod checkout;
pub mod orders;
pub mod prescription;
mod release;
pub mod settings;
pub mod verify;

use axum::routing::{get, post, put};
use medbrains_server_core::state::AppState;
use uuid::Uuid;

/// Staff routes: the verification queue, the prescription beside it, and
/// running the storefront.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/pharmacy/storefront/orders", get(verify::list))
        .route(
            "/api/pharmacy/storefront/orders/{id}/prescription",
            get(verify::prescription_document),
        )
        .route(
            "/api/pharmacy/storefront/orders/{id}/verify",
            post(verify::decide),
        )
        .route(
            "/api/pharmacy/storefront/catalog/{id}",
            put(catalog::set_listing),
        )
        .route(
            "/api/pharmacy/storefront/settings",
            get(settings::get_settings).put(settings::put_settings),
        )
}

/// The patient's cart, if they have one.
pub(crate) async fn cart_id(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<Uuid>, medbrains_server_core::error::AppError> {
    Ok(sqlx::query_scalar(
        "SELECT id FROM pharmacy_store_orders \
          WHERE tenant_id = $1 AND patient_id = $2 AND status = 'cart' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?)
}
