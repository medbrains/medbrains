//! The one-time backfill files a pending posting for each claim settled
//! before postings existed and approves none; and staff without the
//! settlement permissions get 403.

use crate::claim_settlement_test::{bill, call, dec, seed, settlement};
use crate::common;

use reqwest::StatusCode;
use rust_decimal::Decimal;
use serde_json::json;

#[tokio::test]
async fn the_backfill_files_pending_postings_for_settled_claims_and_approves_none() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let s = seed(&app, 4000, 0, 3000).await;
    sqlx::query("UPDATE insurance_claims SET status = 'settled', settled_amount = 3000, settled_at = now() WHERE id = $1")
        .bind(s.claim)
        .execute(&app.db)
        .await
        .expect("settle the old way");
    let count = || {
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM claim_settlement_postings WHERE insurance_claim_id = $1",
        )
        .bind(s.claim)
        .fetch_one(&app.db)
    };
    let (status, dry) = call(
        &app.client,
        &csrf,
        &app,
        "/api/billing/claim-settlements/backfill",
        &json!({ "dry_run": true }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{dry}");
    assert!(dry["claims"].as_i64().expect("claims") >= 1);
    assert_eq!(
        (dry["filed"].as_i64(), count().await.expect("n")),
        (Some(0), 0),
        "a dry run files nothing"
    );

    let (_, run) = call(
        &app.client,
        &csrf,
        &app,
        "/api/billing/claim-settlements/backfill",
        &json!({ "dry_run": false }),
    )
    .await;
    assert!(run["filed"].as_i64().expect("filed") >= 1);
    let (status, _) = call(
        &app.client,
        &csrf,
        &app,
        "/api/billing/claim-settlements/backfill",
        &json!({ "dry_run": false }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "a second run files nothing new for this claim"
    );
    let (st, amount): (String, Decimal) = sqlx::query_as(
        "SELECT status, settled_amount FROM claim_settlement_postings WHERE insurance_claim_id = $1",
    )
    .bind(s.claim)
    .fetch_one(&app.db)
    .await
    .expect("posting");
    assert_eq!(
        (st.as_str(), amount, count().await.expect("n")),
        ("pending", dec("3000"), 1)
    );
    assert_eq!(
        bill(&app, s.invoice).await,
        (dec("0"), dec("0"), "issued".into()),
        "the backfill posts nothing"
    );
}

#[tokio::test]
async fn staff_without_the_settlement_permissions_are_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let desk = common::provision_staff(&app, &csrf, "front_office_staff", &[]).await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let s = seed(&app, 2000, 0, 2000).await;
    let list = desk
        .client
        .get(app.url("/api/billing/claim-settlements"))
        .send()
        .await
        .expect("list");
    assert_eq!(list.status(), StatusCode::FORBIDDEN);
    let (status, _) = call(
        &desk.client,
        &desk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &settlement(s.claim, 2000, "UTR-DESK", &json!([])),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements/backfill",
        &json!({ "dry_run": true }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "the backfill is an administrator's"
    );
}
