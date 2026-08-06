mod common;

use uuid::Uuid;

/// CAPA aging has to separate "done" from "checked".
///
/// A corrective action exists because something already went wrong. NABH treats
/// effectiveness verification as a distinct step from completion for a reason:
/// an action nobody verified is a promise, not a fix. A report that folded the
/// two together would let a hospital close its CAPA log without improving
/// anything.
///
/// Overdue is computed from `due_date` and `completed_at`, not from `status` —
/// the same trap as credential expiry. The second row below is past due while
/// still labelled `in_progress`, which is what an auditor would call overdue
/// whatever the column says.
#[tokio::test]
async fn capa_report_separates_completed_from_verified() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let capa_type = format!("test-{}", &Uuid::new_v4().to_string()[..8]);

    let insert = |due_offset: i32, status: &'static str, completed: bool, verified: bool| {
        let db = app.db.clone();
        let capa_type = capa_type.clone();
        async move {
            sqlx::query(
                "INSERT INTO quality_capa \
                 (tenant_id, capa_number, capa_type, status, due_date, completed_at, verified_at) \
                 VALUES ($1, $2, $3, $4::capa_status, CURRENT_DATE + $5, \
                         CASE WHEN $6 THEN now() ELSE NULL END, \
                         CASE WHEN $7 THEN now() ELSE NULL END)",
            )
            .bind(tenant_id)
            .bind(Uuid::new_v4().to_string())
            .bind(capa_type)
            .bind(status)
            .bind(due_offset)
            .bind(completed)
            .bind(verified)
            .execute(&db)
            .await
            .expect("insert capa");
        }
    };

    // Done and checked — the only genuinely closed one.
    insert(-30, "verified", true, true).await;
    // Past due, nothing done, still labelled in_progress. Overdue regardless.
    insert(-12, "in_progress", false, false).await;
    // Marked completed, never verified. Closed on paper only.
    insert(-5, "completed", true, false).await;
    // Still has time.
    insert(20, "open", false, false).await;

    let report: serde_json::Value = app
        .get(&app.client, "/api/reports/quality-capa-audit-aging/data")
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
        .find(|row| row["capa_type"].as_str() == Some(capa_type.as_str()))
        .unwrap_or_else(|| panic!("this test's capa type should appear: {report}"));

    assert_eq!(
        row["total_capas"].as_i64(),
        Some(4),
        "all four belong to this type: {row}"
    );
    assert_eq!(
        row["overdue"].as_i64(),
        Some(1),
        "past due with nothing done counts as overdue even though its status \
         still reads in_progress: {row}"
    );
    assert_eq!(
        row["completed_unverified"].as_i64(),
        Some(1),
        "completed but unverified must not be reported as closed — that is the \
         difference between a promise and a fix: {row}"
    );
    assert_eq!(row["verified"].as_i64(), Some(1));
    assert_eq!(
        row["open_on_time"].as_i64(),
        Some(1),
        "the one still within its due date is open, not overdue: {row}"
    );

    for field in [
        "capa_type",
        "total_capas",
        "overdue",
        "open_on_time",
        "completed_unverified",
        "verified",
        "median_days_to_verify",
    ] {
        assert!(!row[field].is_null(), "{field} should be present: {row}");
    }

    assert!(
        row["max_days_overdue"].as_i64().expect("max days overdue") >= 12,
        "the worst still-open action drives the number: {row}"
    );
    assert!(
        row["median_days_to_verify"]
            .as_f64()
            .expect("median decodes as a number")
            >= 0.0,
        "verification cannot take negative time: {row}"
    );
}
