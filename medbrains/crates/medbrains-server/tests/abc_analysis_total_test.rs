//! ABC analysis shares are of the store's whole issue value, not of the
//! 5,000 items the list shows. Summed in Rust over the list, the last listed
//! item always read 100% once a store had more items.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn shares_are_of_every_item_when_the_store_has_more_than_the_list() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    // 5,001 items issued once each at ₹1: more items with value than the list holds.
    sqlx::query(
        "WITH u AS (SELECT id, tenant_id FROM users WHERE username = 'admin'), \
              c AS (INSERT INTO store_catalog (tenant_id, code, name, base_price) \
                    SELECT u.tenant_id, $1 || '-' || n, 'ABC item ' || n, 1 \
                      FROM u, generate_series(1, 5001) AS n RETURNING id, tenant_id) \
         INSERT INTO store_stock_movements (tenant_id, catalog_item_id, movement_type, quantity, created_by) \
         SELECT c.tenant_id, c.id, 'issue', 1, u.id FROM c, u",
    )
    .bind(format!("ABC-{tag}"))
    .execute(&app.db)
    .await
    .expect("5,001 issued items");

    let resp = app.get(&app.client, "/api/indent/analytics/abc").await;
    assert_eq!(resp.status(), StatusCode::OK);
    let rows: Value = resp.json().await.expect("json");
    let rows = rows.as_array().expect("rows");
    assert_eq!(rows.len(), 5000, "the list shows the top 5,000");
    let last = rows[4999]["cumulative_pct"].as_f64().expect("pct");
    assert!(
        last < 100.0,
        "last listed item at {last}%, but one more item has value"
    );
}
