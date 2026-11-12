//! Front office › Queue Metrics answered 500 ("This didn't load") on any day a
//! token had been called: the longest-wait column came back from Postgres as
//! `numeric` and the row type reads `f64`.

use crate::common;

use uuid::Uuid;

/// Given a patient whose token has been called today, When the front desk
/// opens Queue Metrics, Then it answers 200 with that hour's longest wait.
#[tokio::test]
async fn queue_metrics_load_once_a_token_is_called() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let depts: serde_json::Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments json");
    let department_id = depts
        .as_array()
        .and_then(|a| a.first())
        .and_then(|d| d["id"].as_str())
        .expect("a seeded department")
        .to_owned();

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Queue",
            "last_name": "Metrics",
            "gender": "female",
            "date_of_birth": "1990-03-12",
            "phone": "9990004002",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    let created: serde_json::Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "patient_id": patient_id, "department_id": department_id }))
        .send()
        .await
        .expect("encounter request")
        .json()
        .await
        .expect("encounter json");
    let queue_id = created["queue"]["id"].as_str().expect("queue id").to_owned();

    let called = app
        .client
        .put(app.url(&format!("/api/opd/queue/{queue_id}/call")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("call request");
    assert!(called.status().is_success(), "calling the token: {}", called.status());

    let response = app
        .get(
            &app.client,
            &format!("/api/front-office/queue/metrics?department_id={department_id}"),
        )
        .await;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    assert_eq!(status, 200, "queue metrics: {body}");

    let rows: serde_json::Value = serde_json::from_str(&body).expect("metrics json");
    let longest = rows
        .as_array()
        .expect("rows")
        .iter()
        .find_map(|r| r["max_wait_minutes"].as_f64());
    assert!(longest.is_some(), "the called token's hour reports a longest wait: {body}");
}
