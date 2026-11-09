//! Billing payment settings have their own endpoint, and provider credentials
//! stay out of generic settings.
//!
//! Scenarios:
//! - a user holding only the generic settings read gets no provider
//!   credentials from the generic settings route, the provider settings route
//!   or the billing payment-settings route;
//! - the provider settings read reports a stored secret as set, never its value;
//! - the billing screen reads its UPI ID and link terms with
//!   `billing.payment_settings.view`, saves them only with `.manage`, and a
//!   malformed UPI ID or out-of-range terms are refused;
//! - the config export leaves `payments` out and an import naming it is refused.

use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

/// Read the admin tenant's raw `payments/<key>` row, for restoring it.
async fn stored(app: &common::TestApp, key: &str) -> Option<Value> {
    sqlx::query_scalar(
        "SELECT value FROM tenant_settings t JOIN users u ON u.tenant_id = t.tenant_id \
          WHERE u.username = 'admin' AND t.category = 'payments' AND t.key = $1 \
            AND t.deleted_at IS NULL",
    )
    .bind(key)
    .fetch_optional(&app.db)
    .await
    .expect("stored")
}

/// Put the admin tenant's `payments/<key>` back as it was (`None` = absent).
async fn restore(app: &common::TestApp, key: &str, value: Option<Value>) {
    match value {
        Some(v) => sqlx::query(
            "UPDATE tenant_settings t SET value = $2 FROM users u \
              WHERE u.username = 'admin' AND u.tenant_id = t.tenant_id \
                AND t.category = 'payments' AND t.key = $1",
        )
        .bind(key)
        .bind(v),
        None => sqlx::query(
            "DELETE FROM tenant_settings t USING users u \
              WHERE u.username = 'admin' AND u.tenant_id = t.tenant_id \
                AND t.category = 'payments' AND t.key = $1",
        )
        .bind(key),
    }
    .execute(&app.db)
    .await
    .expect("restore");
}

#[tokio::test]
async fn provider_credentials_are_not_part_of_generic_settings() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let before = stored(&app, "cashfree_config").await;
    let secret = format!("cf-secret-{}", Uuid::new_v4().simple());
    let saved = app
        .client
        .put(app.url("/api/payments/online-settings/keys/cashfree"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "values": { "client_id": "cf-app-id", "client_secret": secret },
                       "mode": "test" }),
        )
        .send()
        .await
        .expect("keys");
    assert!(saved.status().is_success(), "{}", saved.status());
    let saved = saved.text().await.expect("text");
    assert!(
        !saved.contains(&secret),
        "the save answer carries no secret"
    );

    // The provider settings read says the secret is set, never what it is.
    let view = app
        .get(&app.client, "/api/payments/online-settings")
        .await
        .text()
        .await
        .expect("view");
    assert!(!view.contains(&secret));
    let view: Value = serde_json::from_str(&view).expect("json");
    let cashfree = view["providers"]
        .as_array()
        .and_then(|p| p.iter().find(|p| p["provider"] == "cashfree"))
        .expect("cashfree");
    let field = cashfree["fields"]
        .as_array()
        .and_then(|f| f.iter().find(|f| f["name"] == "client_secret"))
        .expect("field");
    assert_eq!(field["set"], true);
    assert!(field["value"].is_null());

    // A user with only the generic settings read reaches none of it.
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    for path in [
        "/api/setup/settings?category=payments",
        "/api/payments/online-settings",
        "/api/billing/payment-settings",
        "/api/setup/config-export",
    ] {
        let resp = app.get(&nurse.client, path).await;
        let status = resp.status();
        assert!(status.is_client_error(), "{path}: {status}");
        assert!(
            !resp.text().await.expect("text").contains(&secret),
            "{path}"
        );
    }

    // The generic writer refuses the category.
    let put = nurse
        .client
        .put(app.url("/api/setup/settings"))
        .header("x-csrf-token", &nurse.csrf)
        .json(&json!({ "category": "payments", "key": "cashfree_config", "value": {} }))
        .send()
        .await
        .expect("put");
    assert!(put.status().is_client_error());
    restore(&app, "cashfree_config", before).await;
}

#[tokio::test]
async fn the_billing_screen_reads_and_saves_its_payment_settings() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (upi_before, link_before) = (
        stored(&app, "upi_vpa").await,
        stored(&app, "balance_link").await,
    );
    let put = |client: &reqwest::Client, csrf: &str, body: Value| {
        client
            .put(app.url("/api/billing/payment-settings"))
            .header("x-csrf-token", csrf)
            .json(&body)
            .send()
    };
    let terms = json!({ "accept_partial": true, "min_part_amount": 250, "expiry_days": 10,
                        "reminders": true });

    let saved: Value = put(
        &app.client,
        &csrf,
        json!({ "upi_vpa": "hospital@okaxis", "balance_link": terms }),
    )
    .await
    .expect("put")
    .json()
    .await
    .expect("json");
    assert_eq!(saved["upi_vpa"], "hospital@okaxis");
    assert_eq!(saved["balance_link"]["expiry_days"], 10);

    for bad in [
        json!({ "upi_vpa": "not a upi id" }),
        json!({ "balance_link": { "accept_partial": true, "min_part_amount": 1, "expiry_days": 400, "reminders": false } }),
        json!({ "provider_keys": {} }),
    ] {
        let status = put(&app.client, &csrf, bad.clone())
            .await
            .expect("put")
            .status();
        assert!(status.is_client_error(), "{bad}: {status}");
    }

    // The billing clerk sees them and cannot change them.
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let seen: Value = app
        .get(&clerk.client, "/api/billing/payment-settings")
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(seen["upi_vpa"], "hospital@okaxis");
    assert_eq!(seen["balance_link"]["min_part_amount"], 250.0);
    let refused = put(&clerk.client, &clerk.csrf, json!({ "upi_vpa": "x@ybl" }))
        .await
        .expect("put");
    assert_eq!(refused.status(), 403);

    // Clearing the UPI ID stores nothing for the counter QR to show.
    let cleared: Value = put(&app.client, &csrf, json!({ "upi_vpa": "" }))
        .await
        .expect("put")
        .json()
        .await
        .expect("json");
    assert!(cleared["upi_vpa"].is_null());

    restore(&app, "upi_vpa", upi_before).await;
    restore(&app, "balance_link", link_before).await;
}

#[tokio::test]
async fn config_transfer_leaves_payments_out() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let export: Value = app
        .get(&app.client, "/api/setup/config-export")
        .await
        .json()
        .await
        .expect("json");
    let carries_payments = export["settings"]
        .as_array()
        .expect("settings")
        .iter()
        .any(|s| s["category"] == "payments");
    assert!(!carries_payments);

    let bundle = json!({ "dry_run": true, "bundle": {
        "bundle_version": 1, "exported_at": "2026-11-08T00:00:00Z", "document_templates": [],
        "settings": [{ "category": "payments", "key": "upi_vpa", "value": "x@ybl" }] } });
    let resp = app
        .client
        .post(app.url("/api/setup/config-import"))
        .header("x-csrf-token", &csrf)
        .json(&bundle)
        .send()
        .await
        .expect("import");
    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn a_payment_settings_change_tells_management_what_who_and_when() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let upi_before = stored(&app, "upi_vpa").await;
    // The medical superintendent holds the notice permission by default.
    let by_default: bool = sqlx::query_scalar(
        "SELECT bool_and(permissions ? 'billing.payment_settings.notified') FROM roles \
          WHERE code = 'medical_superintendent'",
    )
    .fetch_one(&app.db)
    .await
    .expect("role");
    assert!(by_default);
    // A role a hospital chooses (here a nurse granted it) is told the same way.
    let holder = common::provision_staff_with(
        &app,
        &csrf,
        "nurse",
        &["billing.payment_settings.notified"],
        &[],
    )
    .await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let (old, new) = (format!("old{tag}@okaxis"), format!("new{tag}@ybl"));
    for vpa in [&old, &new] {
        let resp = app
            .client
            .put(app.url("/api/billing/payment-settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "upi_vpa": vpa }))
            .send()
            .await
            .expect("put");
        assert!(resp.status().is_success(), "{}", resp.status());
    }

    let told = |user: Uuid| {
        sqlx::query_scalar::<_, String>(
            "SELECT body FROM notifications WHERE user_id = $1 \
              AND kind = 'payment_settings_changed' AND body LIKE '%' || $2 || '%'",
        )
        .bind(user)
        .bind(new.clone())
        .fetch_all(&app.db)
    };
    let bodies = told(holder.user_id).await.expect("notifications");
    assert_eq!(bodies.len(), 1, "one notice for the change");
    let body = &bodies[0];
    assert!(body.contains(&old) && body.contains(&new), "{body}");
    assert!(
        body.contains("Changed by") && body.contains(" on "),
        "{body}"
    );
    // Billing staff without the notice permission are not told.
    assert!(told(clerk.user_id).await.expect("notifications").is_empty());
    // An email is queued under a registered handler.
    let emails = app
        .outbox_rows("email.payment_settings_changed", &new)
        .await;
    assert!(!emails.is_empty(), "the notice is also emailed");

    // Saving the same value again changes nothing and tells nobody.
    let again = app
        .client
        .put(app.url("/api/billing/payment-settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "upi_vpa": new }))
        .send()
        .await
        .expect("put");
    assert!(again.status().is_success());
    assert_eq!(told(holder.user_id).await.expect("n").len(), 1);
    restore(&app, "upi_vpa", upi_before).await;
}
