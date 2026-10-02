//! The default dashboards' OPD Queue, Recent Admissions and Revenue widgets
//! resolve through the batch resolver — they were seeded with an `api` source
//! nothing resolved, and every tenant saw them as "unavailable".

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Given the admin's tenant dashboards, When the dashboard batch-fetches the
/// three widgets, Then each answers with rows, none with an error.
#[tokio::test]
async fn the_default_queue_admissions_and_revenue_widgets_resolve() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let ids: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT w.id, w.data_source->>'query' FROM dashboard_widgets w \
         JOIN dashboards d ON d.id = w.dashboard_id \
         JOIN users u ON u.tenant_id = d.tenant_id AND u.username = 'admin' \
         WHERE w.deleted_at IS NULL \
           AND w.data_source->>'query' IN ('active_tokens', 'recent_admissions', 'revenue_trend')",
    )
    .fetch_all(&app.db)
    .await
    .expect("widgets");
    for query in ["active_tokens", "recent_admissions", "revenue_trend"] {
        assert!(
            ids.iter().any(|(_, q)| q == query),
            "a seeded {query} widget"
        );
    }

    let resp = app
        .client
        .post(app.url("/api/dashboard/widget-data/batch"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "widget_ids": ids.iter().map(|(id, _)| id).collect::<Vec<_>>() }))
        .send()
        .await
        .expect("batch");
    assert_eq!(resp.status(), StatusCode::OK);
    let answers: Vec<Value> = resp.json().await.expect("json");
    for answer in &answers {
        let data = &answer["data"];
        assert!(data.get("error").is_none(), "{answer}");
        let list = data.get("items").or_else(|| data.get("trend"));
        assert!(
            list.is_some_and(Value::is_array),
            "rows, not a scalar: {answer}"
        );
    }
}
