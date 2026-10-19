//! Home delivery of pharmacy orders — by the hospital's own runner or a
//! courier, paid before dispatch or, for patients with a good record, at the
//! door. The rules are `medbrains_core::pharmacy_delivery`.

use axum::routing::{get, post};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::state::AppState;

pub mod arrange;
pub mod choice;
pub mod door;
pub mod facts;
pub mod pay;
pub mod release;
pub mod source;
pub mod tracking;

/// A delivery as the screens see it. The code's hash never leaves the server.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Delivery {
    pub id: Uuid,
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub mode: String,
    pub address: String,
    pub landmark: Option<String>,
    pub pincode: Option<String>,
    pub contact_phone: String,
    pub runner_id: Option<Uuid>,
    pub courier_name: Option<String>,
    pub tracking_ref: Option<String>,
    pub payment: String,
    pub delivery_fee: Decimal,
    pub amount_due: Decimal,
    pub status: String,
    #[serde(skip)]
    pub otp_hash: Option<String>,
    #[serde(skip)]
    pub otp_attempts: i32,
    pub dispatched_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub cash_collected: Option<Decimal>,
    pub failure_reason: Option<String>,
    /// The patient's refill request, when they asked for it from the portal.
    pub refill_request_id: Option<Uuid>,
    /// The patient's storefront order, when they ordered it online.
    pub store_order_id: Option<Uuid>,
    /// "morning", "afternoon" or "evening", as the patient preferred.
    pub preferred_slot: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Delivery routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/pharmacy/orders/{id}/delivery-options",
            get(arrange::delivery_options),
        )
        .route(
            "/api/pharmacy/deliveries",
            get(arrange::list).post(arrange::arrange),
        )
        .route("/api/pharmacy/delivery-runners", get(arrange::runners))
        .route(
            "/api/pharmacy/deliveries/{id}/dispatch",
            post(door::dispatch),
        )
        .route(
            "/api/pharmacy/deliveries/{id}/complete",
            post(door::complete),
        )
        .route("/api/pharmacy/deliveries/{id}/fail", post(door::fail))
        .route("/api/pharmacy/deliveries/{id}/cancel", post(door::cancel))
        .route(
            "/api/pharmacy/deliveries/{id}/assign",
            post(arrange::assign),
        )
}
