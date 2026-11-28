//! The billing desk's "Today's Collections" tile read `payments.payment_date`,
//! a column that table never had (it is `paid_at`), so every read answered
//! 500 and the tile never showed a number.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Given a payment received now, When the billing desk reads its Today's
/// Collections tile, Then it answers with a total instead of a 500.
#[tokio::test]
async fn todays_collections_tile_reads_paid_at() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let dashboard: Uuid = sqlx::query_scalar(
        "SELECT id FROM dashboards WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("a dashboard");
    // Hidden, so the probe never shows on anyone's dashboard.
    let widget: Uuid = sqlx::query_scalar(
        "INSERT INTO dashboard_widgets (tenant_id, dashboard_id, widget_type, title, \
                                        data_source, is_visible) \
         VALUES ($1, $2, 'stat_card', 'Collections probe', $3, false) RETURNING id",
    )
    .bind(tenant)
    .bind(dashboard)
    .bind(json!({"type": "module_query", "module": "billing", "query": "today_collections"}))
    .fetch_one(&app.db)
    .await
    .expect("widget");

    let resp = app
        .client
        .get(app.url(&format!("/api/dashboard/widget-data/{widget}")))
        .send()
        .await
        .expect("widget data");
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["data"]["label"],
        json!("Today's Collections"),
        "{body}"
    );
    assert!(body["data"]["value"].is_string(), "a total: {body}");
}
