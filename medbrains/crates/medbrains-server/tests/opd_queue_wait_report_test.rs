mod common;

use uuid::Uuid;

/// The queue-wait heatmap was registered in the catalog but returned
/// `not_wired` — a report tile that renders an apology instead of a number.
///
/// Wait is measured token-issued to token-called: what the patient experienced
/// sitting in the corridor. Only called entries count, because a patient still
/// waiting has no wait yet and a no-show never waited — counting either would
/// report a shorter queue than the clinic actually ran, which is the wrong
/// direction for a number used to decide staffing.
#[tokio::test]
async fn queue_wait_report_returns_live_rows_for_called_patients() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let depts: serde_json::Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments json");
    let department = depts
        .as_array()
        .and_then(|a| a.first())
        .expect("a seeded department")
        .clone();
    let department_id = department["id"].as_str().expect("department id").to_owned();
    let department_name = department["name"]
        .as_str()
        .expect("department name")
        .to_owned();

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Queue",
            "last_name": "Wait",
            "gender": "male",
            "phone": "9990004001",
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
        .json(&serde_json::json!({
            "patient_id": patient_id,
            "department_id": department_id,
        }))
        .send()
        .await
        .expect("encounter request")
        .json()
        .await
        .expect("encounter json");
    let queue_id = created["queue"]["id"]
        .as_str()
        .expect("queue id")
        .to_owned();

    // Before the token is called there is no wait to report.
    let before: serde_json::Value = app
        .get(&app.client, "/api/reports/opd-queue-wait-heatmap/data")
        .await
        .json()
        .await
        .expect("report json");
    assert_eq!(
        before["summary"]["status"].as_str(),
        Some("live"),
        "the report must be wired, not 'not_wired': {before}"
    );
    // Deliberately no before/after count. Suites share one database and run
    // concurrently, so any global total races whatever else is calling tokens.
    // Assert on the department this test actually queued into instead.
    let _ = &before;

    let called = app
        .client
        .put(app.url(&format!("/api/opd/queue/{queue_id}/call")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("call request");
    let status = called.status();
    let body = called.text().await.unwrap_or_default();
    assert!(
        status.is_success(),
        "calling the token should succeed: {status} {body}"
    );

    let after: serde_json::Value = app
        .get(&app.client, "/api/reports/opd-queue-wait-heatmap/data")
        .await
        .json()
        .await
        .expect("report json");
    let rows = after["rows"].as_array().expect("rows array");

    // The patient this test called must be counted somewhere in its own
    // department's buckets — true no matter what other suites are doing.
    let row = rows
        .iter()
        .find(|row| {
            row["department_name"].as_str() == Some(department_name.as_str())
                && row["patients_seen"].as_i64().unwrap_or(0) >= 1
        })
        .unwrap_or_else(|| {
            panic!("the called patient's department should appear in the wait report: {after}")
        });
    for field in [
        "queue_date",
        "hour_of_day",
        "department_name",
        "patients_seen",
        "median_wait_minutes",
        "p90_wait_minutes",
        "longest_wait_minutes",
    ] {
        assert!(!row[field].is_null(), "{field} should be present: {row}");
    }
    assert!(
        row["median_wait_minutes"]
            .as_f64()
            .expect("median is a number")
            >= 0.0,
        "a wait cannot be negative: {row}"
    );
}
