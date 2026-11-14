//! Form friction: a refused save is counted against its route, a refused
//! query is not, and only an admin with `admin.form_friction.view` can read
//! the counts.
//!
//! The refused save is an ophthalmology exam with an axis and no cylinder,
//! which the server rejects before looking the patient up, so the test needs
//! no other module's data. The count goes through the shared error type, the
//! middleware, the in-memory counter and the flush — every step a real
//! refusal takes.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;

const VIEW: &str = "admin.form_friction.view";
const REPORT: &str = "/api/admin/form-friction";
const EXAMS: &str = "/api/specialty/ophthalmology/exams";

/// One server for every step: the counter is process-wide.
#[tokio::test]
async fn a_refused_save_is_counted_and_only_the_permitted_see_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let resp = desk
        .client
        .get(app.url(&format!("{REPORT}?days=30")))
        .send()
        .await
        .expect("request");
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "no permission, no report"
    );

    // A refused query: code asking badly, not a form. Not counted.
    let quality = common::provision_staff_with(&app, &csrf, "receptionist", &[VIEW], &[]).await;
    let query = quality
        .client
        .get(app.url(&format!("{REPORT}?days=5")))
        .send()
        .await
        .expect("request");
    assert_eq!(query.status(), StatusCode::BAD_REQUEST);

    // A refused save, with an id in the body that must not be kept.
    let save = app
        .client
        .post(app.url(EXAMS))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "patient_id": "550e8400-e29b-41d4-a716-446655440000",
            "axis_od": 90,
        }))
        .send()
        .await
        .expect("request");
    assert_eq!(save.status(), StatusCode::BAD_REQUEST);

    medbrains_server_core::form_friction::flush(&app.db).await;

    let report: serde_json::Value = quality
        .client
        .get(app.url(&format!("{REPORT}?days=7")))
        .send()
        .await
        .expect("request")
        .json()
        .await
        .expect("json");
    let routes = report["routes"].as_array().expect("routes");
    assert!(
        routes.iter().all(|r| r["route"] != REPORT),
        "a refused GET is not counted: {report}"
    );
    let exams = routes
        .iter()
        .find(|r| r["route"] == EXAMS)
        .unwrap_or_else(|| panic!("the refused save is counted: {report}"));
    assert_eq!(exams["method"], "POST");
    assert!(exams["count"].as_i64().is_some_and(|n| n >= 1), "{exams}");
    let reason = &exams["messages"][0];
    assert_eq!(
        reason["message"], "Right eye axis given without a cylinder",
        "{exams}"
    );
    assert_eq!(
        reason["roles"][0], "super_admin",
        "the role, never the person"
    );
    assert!(
        !report.to_string().contains("550e8400"),
        "no id from the request is kept"
    );
}
