mod common;

use uuid::Uuid;

/// Critical-value notification compliance must be a real number.
///
/// NABH judges a lab on whether somebody was told about a dangerous result and
/// how fast — not on whether the result was produced. The report was registered
/// in the catalog and returned `not_wired`, so the one question the standard
/// actually asks had no answer on the screen.
///
/// The row is inserted directly because raising a genuine critical value needs a
/// full order/result chain that this test does not need to prove the reporting
/// path. What matters here is that the query runs, decodes, and counts the
/// stages correctly.
#[tokio::test]
async fn critical_value_report_counts_notification_stages() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Critical",
            "last_name": "Value",
            "gender": "female",
            "phone": "9990006001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");
    let tenant_id =
        Uuid::parse_str(patient["tenant_id"].as_str().expect("tenant id")).expect("uuid");

    // A critical alert hangs off a real order, so build the minimum chain it
    // needs: an encounter to attach to and a test from the seeded catalog.
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

    let encounter: serde_json::Value = app
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
    let encounter_id =
        Uuid::parse_str(encounter["encounter"]["id"].as_str().expect("encounter id"))
            .expect("uuid");

    let test_id: Uuid = sqlx::query_scalar("SELECT id FROM lab_test_catalog LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded lab test");

    // `ordered_by` is a user, not a patient.
    let ordering_user: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
            .bind(tenant_id)
            .fetch_one(&app.db)
            .await
            .expect("a seeded user");

    let order_id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(patient_id)
    .bind(test_id)
    .bind(ordering_user)
    .fetch_one(&app.db)
    .await
    .expect("insert lab order");

    // An alert points at the result that triggered it.
    let make_result = |parameter: &'static str, value: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value) \
                 VALUES ($1, $2, $3, $4) RETURNING id",
            )
            .bind(tenant_id)
            .bind(order_id)
            .bind(parameter)
            .bind(value)
            .fetch_one(&db)
            .await
            .expect("insert lab result")
        }
    };
    let handled_result_id = make_result("Potassium", "6.9").await;
    let missed_result_id = make_result("Sodium", "112").await;

    // Notified 20 minutes after the alert, acknowledged, read back, not escalated.
    sqlx::query(
        "INSERT INTO lab_critical_alerts \
         (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag, \
          created_at, notified_at, acknowledged_at, readback_verified) \
         VALUES ($1, $2, $3, $4, 'Potassium', '6.9', 'critical_high'::lab_result_flag, \
                 now(), now() + INTERVAL '20 minutes', now() + INTERVAL '25 minutes', true)",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(handled_result_id)
    .bind(patient_id)
    .execute(&app.db)
    .await
    .expect("insert a handled critical value");

    // Raised and never notified — the failure the report exists to surface.
    sqlx::query(
        "INSERT INTO lab_critical_alerts \
         (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag, created_at) \
         VALUES ($1, $2, $3, $4, 'Sodium', '112', 'critical_low'::lab_result_flag, now())",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(missed_result_id)
    .bind(patient_id)
    .execute(&app.db)
    .await
    .expect("insert an unnotified critical value");

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/lab-critical-value-notification/data",
        )
        .await
        .json()
        .await
        .expect("report json");

    assert_eq!(
        report["summary"]["status"].as_str(),
        Some("live"),
        "the report must be wired, not 'not_wired': {report}"
    );

    let rows = report["rows"].as_array().expect("rows array");
    // Suites share a database, so assert on totals across today's rows rather
    // than on a single row's exact counts.
    let critical: i64 = rows
        .iter()
        .filter_map(|row| row["critical_values"].as_i64())
        .sum();
    let notified: i64 = rows.iter().filter_map(|row| row["notified"].as_i64()).sum();
    let readback: i64 = rows
        .iter()
        .filter_map(|row| row["readback_verified"].as_i64())
        .sum();

    assert!(critical >= 2, "both inserted alerts should count: {report}");
    assert!(notified >= 1, "the handled alert should count as notified");
    assert!(
        critical > notified,
        "an alert nobody was told about must not be counted as notified — that is \
         the gap this report exists to show: {report}"
    );
    assert!(readback >= 1, "read-back verification should be counted");

    let row = rows.last().expect("at least one row");
    for field in [
        "alert_date",
        "critical_values",
        "notified",
        "acknowledged",
        "readback_verified",
        "escalated",
        "notified_within_60_min",
        "median_minutes_to_notify",
        "p90_minutes_to_notify",
    ] {
        assert!(!row[field].is_null(), "{field} should be present: {row}");
    }

    // The percentiles decode as numbers rather than failing on a numeric/double
    // mismatch, which an empty table would have hidden.
    let median = row["median_minutes_to_notify"]
        .as_f64()
        .expect("median decodes as a number");
    assert!(
        median >= 0.0,
        "a notification delay cannot be negative: {row}"
    );
}
