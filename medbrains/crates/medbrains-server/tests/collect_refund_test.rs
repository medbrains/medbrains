//! Collect anywhere (#4885): the refunds screen's action is its own grant,
//! `billing.refunds.create` — never `billing.invoices.create`.

use crate::collect_world;
use crate::pos_world;

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::json;

use collect_world::{bill, bill_state, collect, collect_body, desk, key, patient};

/// The refunds screen's action is its own grant: a cashier without
/// `billing.refunds.create` is refused, one with it refunds.
#[tokio::test]
async fn raising_a_refund_needs_the_refund_grant() {
    let w = pos_world::world().await;
    let p = patient(&w).await;
    let inv = bill(&w, p, "manual", 200, true).await;
    collect(
        &w,
        collect_body(
            p,
            json!({ "scope": "all" }),
            json!([{ "mode": "cash", "amount": 200 }]),
            &key(),
        ),
    )
    .await;
    let refund =
        json!({ "invoice_id": inv, "amount": 50, "reason": "Test not done", "mode": "cash" });
    let without = desk(&w, "billing_clerk", &["billing.refunds.create"], &[p]).await;
    let (code, why) =
        collect_world::as_staff(&w, &without, "POST", "/api/billing/refunds", refund.clone()).await;
    assert_eq!(code, StatusCode::FORBIDDEN, "{why}");
    let with = desk(&w, "billing_clerk", &[], &[p]).await;
    let (code, done) =
        collect_world::as_staff(&w, &with, "POST", "/api/billing/refunds", refund).await;
    assert_eq!(code, StatusCode::OK, "{done}");
    assert_eq!(bill_state(&w, inv).await.0, Decimal::from(150));
}
