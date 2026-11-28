//! The lab technician's phlebotomy-queue tile ordered its rows by
//! `r.created_at`, but the inner row names that time `ordered_at`, so every
//! read answered 500 and the tile never listed a patient.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// When a lab technician's phlebotomy-queue tile is read, Then it answers
/// with a list instead of a 500.
#[tokio::test]
async fn phlebotomy_queue_tile_orders_by_its_own_column() {
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
         VALUES ($1, $2, 'list', 'Phlebotomy probe', $3, false) RETURNING id",
    )
    .bind(tenant)
    .bind(dashboard)
    .bind(json!({"type": "module_query", "module": "lab", "query": "phlebotomy_queue"}))
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
    assert!(body["data"]["items"].is_array(), "a list: {body}");
}
