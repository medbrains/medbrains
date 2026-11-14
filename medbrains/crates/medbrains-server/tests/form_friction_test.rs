//! Form friction: a refused save is counted against its route, and only an
//! admin with `admin.form_friction.view` can read the counts.
//!
//! The refusal used is the report's own (`?days=5` is a 400), so the test
//! needs no other module's data. The count goes through the shared error
//! type, the middleware, the in-memory counter and the flush — every step a
//! real refusal takes.

use crate::common;

use reqwest::StatusCode;

const VIEW: &str = "admin.form_friction.view";

/// One server for every step: the counter is process-wide.
#[tokio::test]
async fn a_refused_save_is_counted_and_only_the_permitted_see_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let resp = desk
        .client
        .get(app.url("/api/admin/form-friction?days=30"))
        .send()
        .await
        .expect("request");
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "no permission, no report"
    );

    let quality = common::provision_staff_with(&app, &csrf, "receptionist", &[VIEW], &[]).await;
    let refused = quality
        .client
        .get(app.url("/api/admin/form-friction?days=5&ref=550e8400-e29b-41d4-a716-446655440000"))
        .send()
        .await
        .expect("request");
    assert_eq!(refused.status(), StatusCode::BAD_REQUEST);

    medbrains_server_core::form_friction::flush(&app.db).await;

    let report: serde_json::Value = quality
        .client
        .get(app.url("/api/admin/form-friction?days=7"))
        .send()
        .await
        .expect("request")
        .json()
        .await
        .expect("json");
    let routes = report["routes"].as_array().expect("routes");
    let own = routes
        .iter()
        .find(|r| r["route"] == "/api/admin/form-friction")
        .unwrap_or_else(|| panic!("the refusal is counted: {report}"));
    assert_eq!(own["method"], "GET");
    assert!(own["count"].as_i64().is_some_and(|n| n >= 1), "{own}");
    let reason = &own["messages"][0];
    assert_eq!(reason["message"], "days must be #, # or #", "{own}");
    assert_eq!(
        reason["roles"][0], "receptionist",
        "the role, never the person"
    );
    assert!(
        !report.to_string().contains("550e8400"),
        "no id from the request is kept"
    );
}
