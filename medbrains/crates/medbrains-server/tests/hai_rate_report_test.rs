mod common;

use uuid::Uuid;

/// HAI reporting is about the rate, not the count.
///
/// A raw count of CLABSIs falls when the ICU is empty and rises when it is
/// full, so on its own it describes occupancy rather than infection control.
/// NHSN and NABH both express these per 1,000 device-days because the
/// denominator *is* the metric.
///
/// The case this test cares most about is the second month: infections
/// recorded, no device-days recorded. The rate must come back null, not zero.
/// Zero asserts "we had central lines and no infections"; null says "we cannot
/// tell" — and a ward that quietly stopped recording device-days must not
/// appear to have achieved a perfect record by doing so.
#[tokio::test]
async fn hai_rate_is_null_when_the_denominator_is_missing() {
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
    let location_id: Uuid = sqlx::query_scalar("SELECT id FROM locations LIMIT 1")
        .fetch_optional(&app.db)
        .await
        .expect("locations query")
        .unwrap_or(tenant_id);

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Infection",
            "last_name": "Surveillance",
            "gender": "female",
            "phone": "9990008001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    // Two months far enough back that no other suite shares them.
    let with_denominator = "CURRENT_DATE - 700";
    let without_denominator = "CURRENT_DATE - 640";

    let add_event = |day: &'static str, status: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO infection_surveillance_events \
                 (tenant_id, patient_id, hai_type, infection_status, infection_date, reported_by) \
                 VALUES ($1, $2, 'clabsi'::hai_type, $3::infection_status, {day}, $4)"
            ))
            .bind(tenant_id)
            .bind(patient_id)
            .bind(status)
            .bind(user_id)
            .execute(&db)
            .await
            .expect("insert surveillance event");
        }
    };

    // Device-days are keyed unique on (tenant, location, date), so the fixture
    // upserts — this suite must survive being run twice against one database.
    // Month one: confirmed and suspected events against 500 central-line days.
    add_event(with_denominator, "confirmed").await;
    add_event(with_denominator, "confirmed").await;
    add_event(with_denominator, "suspected").await;

    sqlx::query(&format!(
        "INSERT INTO infection_device_days \
         (tenant_id, location_id, record_date, central_line_days, recorded_by) \
         VALUES ($1, $2, {with_denominator}, 500, $3) \
         ON CONFLICT (tenant_id, location_id, record_date) \
         DO UPDATE SET central_line_days = EXCLUDED.central_line_days"
    ))
    .bind(tenant_id)
    .bind(location_id)
    .bind(user_id)
    .execute(&app.db)
    .await
    .expect("insert device days");

    // Month two: an infection, but nobody recorded device-days.
    add_event(without_denominator, "confirmed").await;

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/infection-hai-trend/data?from=2023-01-01&to=2027-12-31",
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

    // Assert the invariant, not the fixture's counts. This suite may run more
    // than once against the same database, and each run adds to the same month,
    // so an exact count would be a self-inflicted flake. What must always hold
    // is the relationship between the numerator and the denominator.
    let with_days = rows
        .iter()
        .find(|row| row["device_days"].as_i64().unwrap_or(0) > 0)
        .unwrap_or_else(|| panic!("a month with device days should appear: {report}"));

    let confirmed = with_days["confirmed"].as_f64().expect("confirmed count");
    let device_days = with_days["device_days"].as_f64().expect("device days");
    let rate = with_days["rate_per_1000_device_days"]
        .as_f64()
        .expect("rate decodes as a number");
    let expected = confirmed * 1000.0 / device_days;
    assert!(
        (rate - expected).abs() < 0.001,
        "the rate must be confirmed infections per 1000 device-days, not a raw \
         count: got {rate}, expected {expected} from {with_days}"
    );

    assert!(
        with_days["suspected"].as_i64().expect("suspected count") >= 1,
        "suspected is reported apart from confirmed so a case later ruled out \
         cannot inflate the rate: {with_days}"
    );

    let without_days = rows
        .iter()
        .find(|row| {
            row["device_days"].as_i64() == Some(0) && row["confirmed"].as_i64().unwrap_or(0) > 0
        })
        .unwrap_or_else(|| panic!("the month without device days should appear: {report}"));

    assert!(
        without_days["rate_per_1000_device_days"].is_null(),
        "with no device-days the rate is unknown, not zero — a ward that stops \
         recording must not look infection-free: {without_days}"
    );
}
