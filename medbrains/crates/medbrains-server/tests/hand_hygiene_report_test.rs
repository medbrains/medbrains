mod common;

use uuid::Uuid;

/// Hand hygiene compliance must be a ratio of sums, not a mean of ratios.
///
/// The fixture is chosen so the two calculations disagree loudly. One audit
/// observes 10 moments with 10 compliant (100%); another observes 190 with 95
/// compliant (50%). Averaging the two rates gives 75%. Summing first gives
/// 105/200 = 52.5%, which is what actually happened on the ward.
///
/// The naive average is the flattering one, and it is what `AVG(compliance_rate)`
/// over the stored column would produce. A five-observation spot check must not
/// weigh the same as a two-hundred-observation round.
#[tokio::test]
async fn hand_hygiene_compliance_weights_by_observations() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let auditor_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded user");
    let department_id: Uuid =
        sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
            .bind(tenant_id)
            .fetch_one(&app.db)
            .await
            .expect("a seeded department");

    // Its own staff category so the row belongs to this test alone, however
    // many times the suite has run before.
    let staff_category = format!("test-{}", &Uuid::new_v4().to_string()[..8]);
    let audit_day = "CURRENT_DATE - 800";

    let add_audit = |observations: i32, compliant: i32| {
        let db = app.db.clone();
        let staff_category = staff_category.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO hand_hygiene_audits \
                 (tenant_id, audit_date, department_id, auditor_id, \
                  observations, compliant, non_compliant, compliance_rate, staff_category) \
                 VALUES ($1, {audit_day}, $2, $3, $4, $5, $6, $7, $8)"
            ))
            .bind(tenant_id)
            .bind(department_id)
            .bind(auditor_id)
            .bind(observations)
            .bind(compliant)
            .bind(observations - compliant)
            // Deliberately store a rate the query must ignore in favour of
            // recomputing from the observations.
            .bind(rust_decimal::Decimal::from(999))
            .bind(&staff_category)
            .execute(&db)
            .await
            .expect("insert hand hygiene audit");
        }
    };

    add_audit(10, 10).await; // 100% over 10 observations
    add_audit(190, 95).await; // 50% over 190 observations

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/infection-hygiene-outbreak-signal/data?from=2023-01-01&to=2027-12-31",
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
        .find(|row| row["staff_category"].as_str() == Some(staff_category.as_str()))
        .unwrap_or_else(|| panic!("this test's staff category should appear: {report}"));

    assert_eq!(row["audits"].as_i64(), Some(2));
    assert_eq!(row["observations"].as_i64(), Some(200));
    assert_eq!(row["compliant"].as_i64(), Some(105));

    let percent = row["compliance_percent"]
        .as_f64()
        .expect("compliance decodes as a number");
    assert!(
        (percent - 52.5).abs() < 0.001,
        "105 compliant of 200 observed is 52.5%. A mean of the two audit rates \
         would give 75%, and the stored compliance_rate column says 999 — the \
         query must trust the observations: {row}"
    );
}
