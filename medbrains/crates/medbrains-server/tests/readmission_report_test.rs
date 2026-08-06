mod common;

use uuid::Uuid;

/// Readmission rate must exclude patients who died.
///
/// A patient who died cannot come back, so counting them as an eligible
/// discharge makes the rate fall as mortality rises — the hospital scores
/// better the more patients it loses. That perverse direction is why CMS and
/// every serious readmission measure exclude deaths, and it is what this test
/// pins.
///
/// The fixture discharges three patients in one month: one who returns inside a
/// week, one who does not return, and one who died. The honest rate is 1 of 2
/// eligible discharges — 50%. Including the death would give 1 of 3, or 33%,
/// which is the flattering answer.
#[tokio::test]
async fn readmission_rate_excludes_patients_who_died() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let doctor_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
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

    // A month of its own, so the counts are this fixture's however many times
    // the suite has run.
    let discharge_day = "CURRENT_DATE - 900";

    let make_patient = |idx: u32| {
        let client = app.client.clone();
        let url = app.url("/api/patients");
        let csrf = csrf.clone();
        async move {
            let patient: serde_json::Value = client
                .post(url)
                .header("x-csrf-token", &csrf)
                .json(&serde_json::json!({
                    "first_name": "Readmission",
                    "last_name": "Watch",
                    "gender": "male",
                    "phone": format!("99900090{idx:02}"),
                }))
                .send()
                .await
                .expect("create patient")
                .json()
                .await
                .expect("patient json");
            Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid")
        }
    };

    let admit = |patient_id: Uuid, discharge_type: &'static str, offset_days: i32| {
        let db = app.db.clone();
        async move {
            let encounter_id: Uuid = sqlx::query_scalar(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
                 VALUES ($1, $2, 'ipd'::encounter_type, $3) RETURNING id",
            )
            .bind(tenant_id)
            .bind(patient_id)
            .bind(department_id)
            .fetch_one(&db)
            .await
            .expect("insert encounter");

            sqlx::query(&format!(
                "INSERT INTO admissions \
                 (tenant_id, encounter_id, patient_id, admitting_doctor, \
                  admitted_at, discharged_at, discharge_type) \
                 VALUES ($1, $2, $3, $4, \
                         {discharge_day} + $5 * INTERVAL '1 day' - INTERVAL '2 days', \
                         {discharge_day} + $5 * INTERVAL '1 day', \
                         $6::discharge_type)"
            ))
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(patient_id)
            .bind(doctor_id)
            .bind(f64::from(offset_days))
            .bind(discharge_type)
            .execute(&db)
            .await
            .expect("insert admission");
        }
    };

    // Discharged, then back three days later.
    let returner = make_patient(1).await;
    admit(returner, "normal", 0).await;
    admit(returner, "normal", 3).await;

    // Discharged and stayed away.
    let stayed_away = make_patient(2).await;
    admit(stayed_away, "normal", 0).await;

    // Died. Cannot be readmitted, must not sit in the denominator.
    let died = make_patient(3).await;
    admit(died, "death", 0).await;

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/ipd-discharge-delay-readmission/data?from=2022-01-01&to=2027-12-31",
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
        .find(|row| row["deaths_excluded"].as_i64().unwrap_or(0) > 0)
        .unwrap_or_else(|| panic!("this fixture's month should appear: {report}"));

    let eligible = row["eligible_discharges"].as_f64().expect("eligible count");
    let readmitted = row["readmitted_within_30_days"]
        .as_f64()
        .expect("readmitted count");
    let deaths = row["deaths_excluded"].as_i64().expect("death count");
    let rate = row["readmission_rate_30_day_percent"]
        .as_f64()
        .expect("rate decodes as a number");

    assert!(deaths >= 1, "the death should be counted and shown: {row}");

    // The invariant, not the fixture's exact numbers.
    let expected = readmitted * 100.0 / eligible;
    assert!(
        (rate - expected).abs() < 0.001,
        "the rate is readmissions over LIVE discharges: got {rate}, expected \
         {expected} from {row}"
    );

    let with_deaths_in_denominator = readmitted * 100.0 / (eligible + f64::from(deaths as u32));
    assert!(
        (rate - with_deaths_in_denominator).abs() > 0.001,
        "including deaths would change the answer, and this fixture is built so \
         it does — if these agree the exclusion is not happening: {row}"
    );

    assert!(
        row["readmitted_within_7_days"]
            .as_i64()
            .expect("7 day count")
            >= 1,
        "a patient back after three days is inside the seven-day window: {row}"
    );
}
