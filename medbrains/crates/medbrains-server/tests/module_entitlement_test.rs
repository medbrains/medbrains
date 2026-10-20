//! The module licensing gate has three outcomes (#4891): a licensed add-on with
//! no row is refused (403), a database fault is unknown (503) — never a free
//! module and never "unlicensed" — and an edition module with no row is on.

mod common;

use axum::http::StatusCode;
use axum::response::IntoResponse;
use medbrains_server_core::middleware::entitlement::require_module_enabled;
use uuid::Uuid;

fn status_of(result: Result<(), medbrains_server_core::error::AppError>) -> Option<StatusCode> {
    result.err().map(|err| err.into_response().status())
}

#[tokio::test]
async fn add_on_without_a_row_is_refused() {
    let app = common::spawn_app().await;
    // A tenant id with no module_config rows at all.
    let tenant = Uuid::new_v4();
    let got = require_module_enabled(&app.db, tenant, "companion").await;
    assert_eq!(status_of(got), Some(StatusCode::FORBIDDEN));
}

#[tokio::test]
async fn core_module_without_a_row_is_on() {
    let app = common::spawn_app().await;
    let tenant = Uuid::new_v4();
    let got = require_module_enabled(&app.db, tenant, "cath_lab").await;
    assert!(got.is_ok(), "an edition module with no row must stay on");
}

#[tokio::test]
async fn database_fault_answers_503_for_core_and_add_on() {
    // A pool of its own, closed: every acquire fails like an outage would.
    // The URL is never dialled.
    let broken = sqlx::postgres::PgPoolOptions::new()
        .connect_lazy("postgres://medbrains:medbrains_dev@localhost:5435/medbrains")
        .expect("lazy pool");
    broken.close().await;

    let tenant = Uuid::new_v4();
    for code in ["cath_lab", "companion"] {
        let got = require_module_enabled(&broken, tenant, code).await;
        assert_eq!(
            status_of(got),
            Some(StatusCode::SERVICE_UNAVAILABLE),
            "{code}: an outage must be neither allow nor 403"
        );
    }
}
