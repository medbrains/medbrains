mod common;

use uuid::Uuid;

/// Credential expiry aging must surface people who should not be working.
///
/// A lapsed medical-council registration is not administrative untidiness — it
/// means somebody is treating patients without a licence, and the hospital is
/// liable for every hour it goes unnoticed. The report was registered in the
/// catalog and returned `not_wired`.
///
/// The case that matters most is the third credential below: `status` still
/// says `active` while `expiry_date` is in the past. The status column reflects
/// what somebody last typed; the date reflects what is true. A report that
/// filtered on status would call that credential valid and hide exactly the
/// failure it exists to find.
#[tokio::test]
async fn credential_report_counts_expiry_by_date_not_by_status() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let employee_id: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name) \
         VALUES ($1, $2, 'Credential') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("EMP-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert employee");

    let insert = |expiry_offset: i32, status: &'static str, verified: bool| {
        let db = app.db.clone();
        async move {
            sqlx::query(
                "INSERT INTO employee_credentials \
                 (tenant_id, employee_id, credential_type, issuing_body, registration_no, \
                  expiry_date, status, verified_at) \
                 VALUES ($1, $2, 'medical_council'::credential_type, \
                         'State Medical Council', $6, \
                         CURRENT_DATE + $3, $4::credential_status, \
                         CASE WHEN $5 THEN now() ELSE NULL END)",
            )
            .bind(tenant_id)
            .bind(employee_id)
            .bind(expiry_offset)
            .bind(status)
            .bind(verified)
            .bind(Uuid::new_v4().to_string())
            .execute(&db)
            .await
            .expect("insert credential");
        }
    };

    insert(-10, "expired", true).await; // lapsed and marked so
    insert(15, "active", true).await; // renews soon
    // The dangerous one: still marked active, but the date has passed.
    insert(-3, "active", false).await;
    // Revoked — already stood down, must not pad the numbers a manager acts on.
    insert(-40, "revoked", true).await;

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/hr-credential-license-expiry/data",
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
    let medical = rows
        .iter()
        .find(|row| row["credential_type"].as_str() == Some("medical_council"))
        .unwrap_or_else(|| panic!("the medical council row should exist: {report}"));

    // Suites share a database, so assert on the relationships rather than exact
    // totals another test's fixtures could move.
    let expired = medical["expired"].as_i64().expect("expired count");
    let total = medical["total_credentials"].as_i64().expect("total count");

    assert!(
        expired >= 2,
        "both lapsed credentials must count, including the one still marked \
         active — status is what somebody typed, the date is what is true: {medical}"
    );
    assert!(
        total >= 3,
        "revoked is excluded but the other three are counted: {medical}"
    );
    assert!(
        medical["expiring_within_30_days"]
            .as_i64()
            .expect("30 day count")
            >= 1,
        "the credential renewing in 15 days should appear: {medical}"
    );
    assert!(
        medical["unverified"].as_i64().expect("unverified count") >= 1,
        "a credential never verified against the issuing body should be flagged: {medical}"
    );

    for field in [
        "credential_type",
        "total_credentials",
        "expired",
        "expiring_within_30_days",
        "expiring_within_90_days",
        "unverified",
    ] {
        assert!(
            !medical[field].is_null(),
            "{field} should be present: {medical}"
        );
    }

    // Negative once something has lapsed — the soonest deadline is in the past.
    let days = medical["days_to_next_expiry"]
        .as_i64()
        .expect("days to next expiry decodes");
    assert!(
        days <= 15,
        "the nearest deadline drives the number: {medical}"
    );
}
