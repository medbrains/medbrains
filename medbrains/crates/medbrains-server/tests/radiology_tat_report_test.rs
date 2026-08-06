mod common;

use uuid::Uuid;

/// Radiology turnaround must be read next to the backlog it excludes.
///
/// Percentiles can only be computed over studies that were reported — an
/// unreported study has no turnaround yet. That is correct, and it is exactly
/// what makes the statistic dangerous: the unreported studies are the slow
/// ones, so a department falling further behind shows an *improving* median.
///
/// This fixture is that situation in miniature. Two studies reported in two
/// hours, and one ordered a year ago that nobody has read. The median says two
/// hours and is not wrong; `still_pending` and `oldest_pending_days` are what
/// stop that number being believed on its own.
#[tokio::test]
async fn radiology_tat_reports_the_backlog_beside_the_median() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded user");
    // No modalities are seeded, so the fixture creates its own.
    let modality_id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) \
         VALUES ($1, $2, 'Parity CT') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("CT-{}", &Uuid::new_v4().to_string()[..6]))
    .fetch_one(&app.db)
    .await
    .expect("insert modality");

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Radiology",
            "last_name": "Backlog",
            "gender": "female",
            "phone": "9990012001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    // A month of its own so the fixture owns its row.
    let order_day = "CURRENT_DATE - 1200";

    let order = |reported: bool| {
        let db = app.db.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO radiology_orders \
                 (tenant_id, patient_id, modality_id, ordered_by, priority, status, \
                  created_at, completed_at) \
                 VALUES ($1, $2, $3, $4, 'routine'::radiology_priority, \
                         $5::radiology_order_status, {order_day}, \
                         CASE WHEN $6 THEN {order_day} + INTERVAL '2 hours' ELSE NULL END)"
            ))
            .bind(tenant_id)
            .bind(patient_id)
            .bind(modality_id)
            .bind(user_id)
            .bind(if reported { "reported" } else { "ordered" })
            .bind(reported)
            .execute(&db)
            .await
            .expect("insert radiology order");
        }
    };

    order(true).await; // read in 2 hours
    order(true).await; // read in 2 hours
    order(false).await; // never read — the backlog

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/radiology-order-report-tat-backlog/data?from=2022-01-01&to=2027-12-31",
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
    let row = rows
        .iter()
        .find(|row| row["still_pending"].as_i64().unwrap_or(0) > 0)
        .unwrap_or_else(|| panic!("this fixture's backlog row should appear: {report}"));

    let ordered = row["ordered"].as_i64().expect("ordered count");
    let reported = row["reported"].as_i64().expect("reported count");
    let pending = row["still_pending"].as_i64().expect("pending count");

    assert!(
        ordered > reported,
        "an unreported study must still be counted as ordered — otherwise the \
         backlog leaves the report entirely: {row}"
    );
    assert!(pending >= 1, "the unread study is the backlog: {row}");

    // The median is fast and honest. It is only safe to read because the
    // pending count sits next to it.
    let median = row["median_hours_to_report"]
        .as_f64()
        .expect("median decodes as a number");
    assert!(
        (median - 2.0).abs() < 0.01,
        "the reported studies took two hours, and the unreported one must not \
         be counted as zero: {row}"
    );

    assert!(
        row["oldest_pending_days"]
            .as_i64()
            .expect("oldest pending decodes")
            > 300,
        "the depth of the backlog is what the fast median hides: {row}"
    );
}
