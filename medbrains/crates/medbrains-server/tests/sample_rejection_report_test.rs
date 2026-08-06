mod common;

use uuid::Uuid;

/// Sample rejection reporting must surface the samples never re-drawn.
///
/// A rejection count on its own measures tidiness in the lab. The number that
/// matters clinically is `never_recollected`: a sample rejected with no result
/// posted afterwards means the test never happened. Nothing raises its hand —
/// the order simply sits incomplete while everyone assumes it was repeated.
///
/// The fixture also rejects one order twice, to pin that rejections and
/// affected orders are counted separately. One order rejected twice is one
/// patient stuck twice, not two patients.
#[tokio::test]
async fn sample_rejections_count_orders_never_recollected() {
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
    let test_id: Uuid = sqlx::query_scalar("SELECT id FROM lab_test_catalog LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded lab test");
    let department_id: Uuid =
        sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
            .bind(tenant_id)
            .fetch_one(&app.db)
            .await
            .expect("a seeded department");

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Sample",
            "last_name": "Rejection",
            "gender": "male",
            "phone": "9990011001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    // Reasons of this run's own, so the rows belong to this fixture.
    let lost_reason = format!("never-redrawn-{}", &Uuid::new_v4().to_string()[..8]);
    let redrawn_reason = format!("redrawn-{}", &Uuid::new_v4().to_string()[..8]);
    let rejected_day = "CURRENT_DATE - 1100";

    let make_order = || {
        let db = app.db.clone();
        async move {
            let encounter_id: Uuid = sqlx::query_scalar(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
                 VALUES ($1, $2, 'opd'::encounter_type, $3) RETURNING id",
            )
            .bind(tenant_id)
            .bind(patient_id)
            .bind(department_id)
            .fetch_one(&db)
            .await
            .expect("insert encounter");

            sqlx::query_scalar::<_, Uuid>(&format!(
                "INSERT INTO lab_orders \
                 (tenant_id, encounter_id, patient_id, test_id, ordered_by, created_at) \
                 VALUES ($1, $2, $3, $4, $5, {rejected_day}) RETURNING id"
            ))
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(patient_id)
            .bind(test_id)
            .bind(user_id)
            .fetch_one(&db)
            .await
            .expect("insert lab order")
        }
    };

    let reject = |order_id: Uuid, reason: String| {
        let db = app.db.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO lab_sample_rejections \
                 (tenant_id, order_id, rejected_by, rejection_reason, rejected_at) \
                 VALUES ($1, $2, $3, $4, {rejected_day} + INTERVAL '1 hour')"
            ))
            .bind(tenant_id)
            .bind(order_id)
            .bind(user_id)
            .bind(reason)
            .execute(&db)
            .await
            .expect("insert rejection");
        }
    };

    // Rejected twice, never re-drawn. One patient, two sticks, no result.
    let lost = make_order().await;
    reject(lost, lost_reason.clone()).await;
    reject(lost, lost_reason.clone()).await;

    // Rejected, then re-drawn and resulted.
    let redrawn = make_order().await;
    reject(redrawn, redrawn_reason.clone()).await;
    sqlx::query(&format!(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, created_at) \
         VALUES ($1, $2, 'Haemoglobin', '13.2', {rejected_day} + INTERVAL '5 hours')"
    ))
    .bind(tenant_id)
    .bind(redrawn)
    .execute(&app.db)
    .await
    .expect("insert result");

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/lab-sample-rejection-recollection/data?from=2022-01-01&to=2027-12-31",
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

    let lost_row = rows
        .iter()
        .find(|row| row["rejection_reason"].as_str() == Some(lost_reason.as_str()))
        .unwrap_or_else(|| panic!("the never-redrawn reason should appear: {report}"));

    assert_eq!(
        lost_row["rejections"].as_i64(),
        Some(2),
        "both rejections of the same order count: {lost_row}"
    );
    assert_eq!(
        lost_row["orders_affected"].as_i64(),
        Some(1),
        "one order rejected twice is one patient, not two: {lost_row}"
    );
    assert_eq!(
        lost_row["never_recollected"].as_i64(),
        Some(1),
        "a sample rejected and never re-drawn means the test never happened, \
         which a plain rejection count would never show: {lost_row}"
    );

    let redrawn_row = rows
        .iter()
        .find(|row| row["rejection_reason"].as_str() == Some(redrawn_reason.as_str()))
        .unwrap_or_else(|| panic!("the recollected reason should appear: {report}"));

    assert_eq!(
        redrawn_row["never_recollected"].as_i64(),
        Some(0),
        "a rejection followed by a result was recollected and must not be \
         reported as a lost test: {redrawn_row}"
    );

    for field in [
        "rejection_reason",
        "rejections",
        "orders_affected",
        "never_recollected",
        "percent_of_orders",
    ] {
        assert!(
            !lost_row[field].is_null(),
            "{field} should be present: {lost_row}"
        );
    }
}
