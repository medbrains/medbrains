mod common;

use uuid::Uuid;

/// Cancelled surgery reporting must count postponements and unrecorded reasons.
///
/// Two ways this metric flatters if written the obvious way:
///
/// Counting only `cancelled` and ignoring `postponed` rewards relabelling. To
/// the patient the two are identical — fasted since midnight, sent home — and
/// to the theatre they are the same empty slot. A unit can halve its
/// cancellation rate by changing a dropdown.
///
/// `GROUP BY cancellation_reason` silently drops the cases where nobody wrote
/// down why. Those are the most actionable rows a Pareto can have, and they are
/// exactly the ones that disappear.
#[tokio::test]
async fn ot_cancellations_count_postponed_and_unrecorded() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let surgeon_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded user");
    let room_id: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_rooms (tenant_id, name, code) \
         VALUES ($1, 'Parity Theatre', $2) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("OT-{}", &Uuid::new_v4().to_string()[..6]))
    .fetch_one(&app.db)
    .await
    .expect("insert ot room");

    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Theatre",
            "last_name": "Cancellation",
            "gender": "female",
            "phone": "9990010001",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("patient id")).expect("uuid");

    // A window of its own so this fixture owns its denominator.
    let day = "CURRENT_DATE - 1000";
    let reason = format!("test-{}", &Uuid::new_v4().to_string()[..8]);

    let book = |status: &'static str, cancel_reason: Option<String>| {
        let db = app.db.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO ot_bookings \
                 (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
                  scheduled_date, scheduled_start, scheduled_end, procedure_name, \
                  status, cancellation_reason) \
                 VALUES ($1, $2, $3, $4, {day}, {day} + INTERVAL '9 hours', \
                         {day} + INTERVAL '11 hours', 'Parity Procedure', \
                         $5::ot_booking_status, $6)"
            ))
            .bind(tenant_id)
            .bind(patient_id)
            .bind(room_id)
            .bind(surgeon_id)
            .bind(status)
            .bind(cancel_reason)
            .execute(&db)
            .await
            .expect("insert ot booking");
        }
    };

    book("cancelled", Some(reason.clone())).await;
    // Same reason, relabelled as a postponement. Must still count.
    book("postponed", Some(reason.clone())).await;
    // Lost with nobody recording why.
    book("cancelled", None).await;
    // A case that actually happened, so the denominator is not all losses.
    book("completed", None).await;

    let report: serde_json::Value = app
        .get(
            &app.client,
            "/api/reports/ot-cancelled-surgery-pareto/data?from=2022-01-01&to=2027-12-31",
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

    let named = rows
        .iter()
        .find(|row| row["reason"].as_str() == Some(reason.as_str()))
        .unwrap_or_else(|| panic!("this fixture's reason should appear: {report}"));

    assert_eq!(named["cancelled"].as_i64(), Some(1));
    assert_eq!(
        named["postponed"].as_i64(),
        Some(1),
        "a postponement is the same lost slot as a cancellation — counting only \
         the 'cancelled' label would let a unit improve by relabelling: {named}"
    );
    assert_eq!(
        named["slots_lost"].as_i64(),
        Some(2),
        "both are theatre time nobody operated in: {named}"
    );

    let unrecorded = rows
        .iter()
        .find(|row| row["reason"].as_str() == Some("not recorded"))
        .unwrap_or_else(|| panic!("cases with no reason must get their own row: {report}"));
    assert!(
        unrecorded["slots_lost"].as_i64().unwrap_or(0) >= 1,
        "a cancellation nobody explained must not vanish from the Pareto — it is \
         the most actionable row on it: {unrecorded}"
    );

    for field in [
        "reason",
        "cancelled",
        "postponed",
        "slots_lost",
        "late_losses",
        "percent_of_scheduled",
    ] {
        assert!(
            !named[field].is_null(),
            "{field} should be present: {named}"
        );
    }

    // The completed case sits in the denominator, so the share must be under
    // 100% — a denominator of losses only would always read 100%.
    let percent = named["percent_of_scheduled"]
        .as_f64()
        .expect("share decodes as a number");
    assert!(
        percent > 0.0 && percent < 100.0,
        "the denominator is every scheduled case, not just the lost ones: {named}"
    );
}
