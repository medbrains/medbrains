//! The pharmacist's stock-alerts tile read `generic_name` and `quantity` from
//! `pharmacy_batches`, which has neither (the name is on the catalogue row,
//! the count is `quantity_on_hand`), so every read answered 500 and no
//! expiring batch was ever flagged.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Given a batch in stock that expires tomorrow, among more than twenty
/// low-stock drugs, When the pharmacist's
/// stock-alerts tile is read, Then it answers 200 and names that drug as
/// expiring.
#[tokio::test]
async fn stock_alerts_tile_names_an_expiring_batch() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let drug = format!("Expiry Probe {suffix}");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, current_stock) \
         VALUES ($1, $2, $3, $3, 100) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("EXP-{suffix}"))
    .bind(&drug)
    .fetch_one(&app.db)
    .await
    .expect("catalogue item");
    sqlx::query(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
                                       quantity_received, quantity_on_hand) \
         VALUES ($1, $2, $3, CURRENT_DATE + 1, 10, 10)",
    )
    .bind(tenant)
    .bind(item)
    .bind(format!("B-{suffix}"))
    .execute(&app.db)
    .await
    .expect("batch");
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
         VALUES ($1, $2, 'list', 'Stock alerts probe', $3, false) RETURNING id",
    )
    .bind(tenant)
    .bind(dashboard)
    .bind(json!({"type": "module_query", "module": "pharmacy", "query": "stock_alerts"}))
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
    let items = body["data"]["items"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert!(
        items
            .iter()
            .any(|i| i["label"] == json!(drug) && i["icon"] == json!("clock")),
        "the expiring batch is flagged: {body}"
    );
}
