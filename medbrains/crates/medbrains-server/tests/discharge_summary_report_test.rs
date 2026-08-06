mod common;

use uuid::Uuid;

/// Discharge summary completion must count the discharges, not the summaries.
///
/// A patient discharged with no summary written is the failure this report
/// exists to find — and it is invisible to any query that starts from the
/// summary table, because there is no row to start from. Completion would read
/// 100% precisely because the missing ones do not exist to be counted.
///
/// The third admission below is exactly that case: discharged, no summary at
/// all. If it does not appear in `missing`, the report is lying in the most
/// flattering possible direction.
#[tokio::test]
async fn discharge_summary_report_counts_missing_summaries() {
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

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let doctor_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded user");

    // Discharge a day clear of other suites so the counts are this test's own.
    let discharge_day = "CURRENT_DATE - 400";

    let admit = |summary: Option<bool>, idx: u32| {
        let db = app.db.clone();
        let client = app.client.clone();
        let url = app.url("/api/patients");
        let csrf = csrf.clone();
        let department_id = department_id.clone();
        async move {
            let patient: serde_json::Value = client
                .post(url)
                .header("x-csrf-token", &csrf)
                .json(&serde_json::json!({
                    "first_name": "Discharge",
                    "last_name": "Summary",
                    "gender": "male",
                    "phone": format!("99900070{idx:02}"),
                }))
                .send()
                .await
                .expect("create patient")
                .json()
                .await
                .expect("patient json");
            let patient_id =
                Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

            let encounter_id: Uuid = sqlx::query_scalar(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
                 VALUES ($1, $2, 'ipd'::encounter_type, $3::uuid) RETURNING id",
            )
            .bind(tenant_id)
            .bind(patient_id)
            .bind(&department_id)
            .fetch_one(&db)
            .await
            .expect("insert encounter");

            let admission_id: Uuid = sqlx::query_scalar(&format!(
                "INSERT INTO admissions \
                 (tenant_id, encounter_id, patient_id, admitting_doctor, discharged_at) \
                 VALUES ($1, $2, $3, $4, {discharge_day} + INTERVAL '9 hours') RETURNING id"
            ))
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(patient_id)
            .bind(doctor_id)
            .fetch_one(&db)
            .await
            .expect("insert admission");

            // `None` means no summary row at all — the case that matters.
            if let Some(finalized) = summary {
                sqlx::query(&format!(
                    "INSERT INTO ipd_discharge_summaries \
                     (tenant_id, admission_id, status, finalized_at) \
                     VALUES ($1, $2, $3::discharge_summary_status, \
                             CASE WHEN $4 THEN {discharge_day} + INTERVAL '13 hours' \
                                  ELSE NULL END)"
                ))
                .bind(tenant_id)
                .bind(admission_id)
                .bind(if finalized { "finalized" } else { "draft" })
                .bind(finalized)
                .execute(&db)
                .await
                .expect("insert discharge summary");
            }
        }
    };

    admit(Some(true), 1).await; // finalised 4 hours after discharge
    admit(Some(false), 2).await; // drafted, never finalised
    admit(None, 3).await; // discharged with nothing written

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/mrd-discharge-summary-completion/data?from=2025-01-01&to=2027-12-31",
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
        .find(|row| row["discharges"].as_i64().unwrap_or(0) >= 3)
        .unwrap_or_else(|| panic!("this test's discharge day should appear: {report}"));

    assert!(
        row["missing"].as_i64().expect("missing count") >= 1,
        "a patient discharged with no summary must be counted — starting from \
         the summary table would hide it entirely: {row}"
    );
    assert!(
        row["draft_only"].as_i64().expect("draft count") >= 1,
        "a draft is not something a patient can take to their next doctor: {row}"
    );
    assert!(
        row["finalized"].as_i64().expect("finalized count") >= 1,
        "the finalised summary should count: {row}"
    );
    assert!(
        row["finalized_within_24h"].as_i64().expect("24h count") >= 1,
        "finalised four hours after discharge is inside the day: {row}"
    );

    for field in [
        "discharge_date",
        "discharges",
        "finalized",
        "draft_only",
        "missing",
        "finalized_within_24h",
        "median_hours_to_finalize",
    ] {
        assert!(!row[field].is_null(), "{field} should be present: {row}");
    }

    assert!(
        row["median_hours_to_finalize"]
            .as_f64()
            .expect("median decodes as a number")
            >= 0.0,
        "a summary cannot be finalised before the discharge it describes: {row}"
    );
}
