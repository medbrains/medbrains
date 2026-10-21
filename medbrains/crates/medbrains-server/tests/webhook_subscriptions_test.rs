//! Outbound webhooks (#224): a subscription must point at public HTTPS and
//! name real events; its secret is shown once; each event it subscribes to
//! is queued for it once, carrying identifiers and never clinical text.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn create(app: &common::TestApp, csrf: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/admin/webhooks"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("create");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn a_subscription_is_told_once_with_ids_only() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let event = "pharmacy.stock.low";

    for (url, why) in [
        ("http://partner.example.com/hook", "plain http"),
        ("https://localhost/hook", "localhost"),
        ("https://10.1.2.3/hook", "an address inside the hospital"),
    ] {
        let (status, _) = create(
            &app,
            &csrf,
            json!({ "name": "LIS", "url": url, "event_types": [event] }),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{why} is refused");
    }
    let (status, _) = create(&app, &csrf, json!({ "name": "LIS", "url": "https://partner.example.com/hook", "event_types": ["made.up"] })).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "an unknown event is refused"
    );

    let (status, created) = create(&app, &csrf, json!({
        "name": "Stock partner", "url": "https://partner.example.com/hook", "event_types": [event],
    }))
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    assert!(
        created["signing_secret"]
            .as_str()
            .unwrap_or_default()
            .starts_with("whsec_")
    );
    let id = created["id"].as_str().expect("id").to_owned();
    let listed: Value = app
        .client
        .get(app.url("/api/admin/webhooks"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let row = listed
        .as_array()
        .and_then(|l| l.iter().find(|w| w["id"] == json!(id)))
        .cloned()
        .unwrap_or_default();
    assert!(
        row.get("signing_secret").is_none(),
        "the secret is never listed"
    );

    let item = Uuid::new_v4();
    let payload = json!({ "catalog_item_id": item, "drug_name": "Morphine 10 mg", "on_hand": 3, "reorder_level": 10 });
    app.dispatch(tenant, event, &payload).await;
    app.dispatch(tenant, event, &payload).await;
    let queued: Vec<Value> = sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE event_type = 'webhook.deliver' AND aggregate_id = $1::uuid",
    )
    .bind(&id)
    .fetch_all(&app.db)
    .await
    .expect("queued");
    assert_eq!(queued.len(), 1, "a redelivered event is sent once");
    assert_eq!(
        queued[0]["data"],
        json!({ "catalog_item_id": item }),
        "ids only: {}",
        queued[0]
    );

    // Switched off, it is told nothing more.
    app.client
        .put(app.url(&format!("/api/admin/webhooks/{id}")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "name": "Stock partner", "url": "https://partner.example.com/hook", "event_types": [event], "is_active": false }))
        .send()
        .await
        .expect("update");
    app.dispatch(
        tenant,
        event,
        &json!({ "catalog_item_id": Uuid::new_v4(), "on_hand": 1, "reorder_level": 5 }),
    )
    .await;
    let after: i64 = sqlx::query_scalar("SELECT count(*) FROM outbox_events WHERE event_type = 'webhook.deliver' AND aggregate_id = $1::uuid")
        .bind(&id)
        .fetch_one(&app.db)
        .await
        .expect("count");
    assert_eq!(after, 1);
}
