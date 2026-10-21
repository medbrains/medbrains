//! A viewer chooses the widgets on their own dashboard from the catalogue —
//! only those their permissions allow, and always as the catalogue defines
//! them: the client names a code, never a data source or a permission.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A signed-in user of `role`, provisioned by the admin; returns the client
/// and its CSRF token.
async fn user(app: &common::TestApp, admin_csrf: &str, role: &str) -> (Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("w{role}_{tag}"), format!("Widget#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Widget {role}"),
            "role": role,
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    (client, csrf)
}

async fn set(
    app: &common::TestApp,
    who: &(Client, String),
    code: &str,
    visible: bool,
) -> StatusCode {
    who.0
        .put(app.url(&format!("/api/dashboards/my/widgets/{code}")))
        .header("x-csrf-token", &who.1)
        .json(&json!({ "visible": visible }))
        .send()
        .await
        .expect("set widget")
        .status()
}

async fn my_widget(app: &common::TestApp, who: &(Client, String), code: &str) -> Option<Value> {
    let dashboard: Value = who
        .0
        .get(app.url("/api/dashboards/my"))
        .send()
        .await
        .expect("my dashboard")
        .json()
        .await
        .expect("json");
    dashboard["widgets"].as_array().and_then(|ws| {
        ws.iter()
            .find(|w| w["template_code"] == json!(code))
            .cloned()
    })
}

/// Given a nurse, who does not hold analytics.management.view, When she asks
/// for the mortality KPI, Then the catalogue does not offer it and placing it
/// answers as if it did not exist; a widget she may have is placed with the
/// catalogue's own data source and permission.
#[tokio::test]
async fn a_viewer_places_only_what_their_permissions_allow() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let nurse = user(&app, &admin_csrf, "nurse").await;

    let offered: Vec<Value> = nurse
        .0
        .get(app.url("/api/widget-templates"))
        .send()
        .await
        .expect("templates")
        .json()
        .await
        .expect("json");
    assert!(
        !offered.iter().any(|t| t["code"] == json!("mortality_pct")),
        "management KPIs are not offered to a nurse"
    );
    assert_eq!(
        set(&app, &nurse, "mortality_pct", true).await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        set(&app, &nurse, "no_such_widget", true).await,
        StatusCode::NOT_FOUND
    );

    assert_eq!(
        set(&app, &nurse, "total_patients", true).await,
        StatusCode::OK
    );
    let placed = my_widget(&app, &nurse, "total_patients")
        .await
        .expect("placed");
    assert_eq!(
        placed["data_source"],
        json!({ "type": "sql_count", "table": "patients" })
    );
    assert_eq!(placed["permission_code"], json!("patients.list"));
}

/// Given a hospital admin whose dashboard shows mortality, When they untick
/// it, Then it leaves their dashboard — and comes back when ticked again,
/// once, not twice.
#[tokio::test]
async fn a_widget_is_hidden_and_shown_again_on_my_dashboard() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let manager = user(&app, &admin_csrf, "hospital_admin").await;

    assert!(
        my_widget(&app, &manager, "mortality_pct").await.is_some(),
        "on the role dashboard"
    );
    assert_eq!(
        set(&app, &manager, "mortality_pct", false).await,
        StatusCode::OK
    );
    assert!(
        my_widget(&app, &manager, "mortality_pct").await.is_none(),
        "hidden"
    );

    assert_eq!(
        set(&app, &manager, "mortality_pct", true).await,
        StatusCode::OK
    );
    assert_eq!(
        set(&app, &manager, "mortality_pct", true).await,
        StatusCode::OK
    );
    let dashboard: Value = manager
        .0
        .get(app.url("/api/dashboards/my"))
        .send()
        .await
        .expect("my dashboard")
        .json()
        .await
        .expect("json");
    let copies = dashboard["widgets"].as_array().map_or(0, |ws| {
        ws.iter()
            .filter(|w| w["template_code"] == json!("mortality_pct"))
            .count()
    });
    assert_eq!(copies, 1, "shown again, not placed twice");
}
