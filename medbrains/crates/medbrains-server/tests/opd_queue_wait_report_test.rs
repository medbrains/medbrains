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
    let department_id = depts
        .as_array()
        .and_then(|a| a.first())
        .and_then(|d| d.get("id"))
        .and_then(serde_json::Value::as_str)
        .expect("a seeded department")
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
    // Rows bucket by (date, hour, department), so calling one more patient in the
    // same hour raises `patients_seen` rather than adding a row. Count patients,
    // not rows.
    let seen_before: i64 = before["rows"]
        .as_array()
        .expect("rows array")
        .iter()
        .filter_map(|row| row["patients_seen"].as_i64())
        .sum();

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
    let seen_after: i64 = rows
        .iter()
        .filter_map(|row| row["patients_seen"].as_i64())
        .sum();
    assert!(
        seen_after > seen_before,
        "a called patient should be counted in the wait report: {after}"
    );

    let row = rows.last().expect("at least one row");
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
