//! Responses two screens could not render. The robustness crawler found both
//! tabs crashing for every role: the server answered a different shape from
//! the one the screen read.

mod common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

async fn admin_tenant(app: &common::TestApp) -> (Uuid, Uuid, String) {
    sqlx::query_as(
        "SELECT u.tenant_id, u.id, t.timezone FROM users u JOIN tenants t ON t.id = u.tenant_id \
         WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("admin tenant")
}

async fn get_json(app: &common::TestApp, csrf: &str, path: &str) -> (StatusCode, Value) {
    let resp = app
        .client
        .get(app.url(path))
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a visitor checked in at 10:15 hospital time on a named ward, Then the
/// analytics count them under that ward's name and under hour 10, not under a
/// ward UUID and a UTC hour.
#[tokio::test]
async fn visitor_analytics_names_the_ward_and_uses_the_hospitals_hour() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, _, _) = admin_tenant(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let ward_name = format!("Ward {suffix}");

    let today: chrono::NaiveDate = sqlx::query_scalar(
        "WITH ward AS ( \
           INSERT INTO locations (tenant_id, code, name, level) \
           VALUES ($1, $2, $3, 'wing') RETURNING id), \
         reg AS ( \
           INSERT INTO visitor_registrations (tenant_id, visitor_name, ward_id) \
           SELECT $1, 'Analytics Visitor', id FROM ward RETURNING id), \
         pass AS ( \
           INSERT INTO visitor_passes (tenant_id, registration_id, pass_number, valid_until) \
           SELECT $1, id, $2, now() + interval '1 day' FROM reg RETURNING id) \
         INSERT INTO visitor_logs (tenant_id, pass_id, check_in_at) \
         SELECT $1, pass.id, \
                ((now() AT TIME ZONE t.timezone)::date + time '10:15') AT TIME ZONE t.timezone \
         FROM pass, tenants t WHERE t.id = $1 \
         RETURNING (check_in_at AT TIME ZONE (SELECT timezone FROM tenants WHERE id = $1))::date",
    )
    .bind(tenant)
    .bind(format!("V{}", suffix.to_uppercase()))
    .bind(&ward_name)
    .fetch_one(&app.db)
    .await
    .expect("visitor fixture");

    let (status, body) =
        get_json(&app, &csrf, &format!("/api/front-office/analytics?from={today}&to={today}"))
            .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["total_visitors"].as_i64() >= Some(1), "{body}");
    let wards = body["by_ward"].as_array().expect("by_ward is a list");
    assert!(
        wards.iter().any(|w| w["ward"] == ward_name.as_str() && w["visitors"] == 1),
        "the ward is named: {body}"
    );
    let hours = body["by_hour"].as_array().expect("by_hour is a list");
    assert!(hours.iter().any(|h| h["hour"] == 10), "10:15 local is hour 10: {body}");

    let (status, _) =
        get_json(&app, &csrf, "/api/front-office/analytics?from=2026-02-02&to=2026-02-01").await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a backwards range is refused");
}

/// Given an open imaging order scheduled today, Then the day list is a list
/// (not an object wrapping one) naming the patient and study.
#[tokio::test]
async fn radiology_day_list_is_a_list_of_named_orders() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin, _) = admin_tenant(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];

    let (order_id, today): (Uuid, chrono::NaiveDate) = sqlx::query_as(
        "WITH p AS ( \
           INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
           VALUES ($1, $2, 'Imaging', 'Fixture', 'other'::gender, $3) RETURNING id), \
         m AS ( \
           INSERT INTO radiology_modalities (tenant_id, code, name) \
           VALUES ($1, $2, 'CT Fixture') RETURNING id) \
         INSERT INTO radiology_orders \
           (tenant_id, patient_id, modality_id, ordered_by, body_part, scheduled_at) \
         SELECT $1, p.id, m.id, $4, 'Chest', now() FROM p, m \
         RETURNING id, (scheduled_at AT TIME ZONE (SELECT timezone FROM tenants WHERE id = $1))::date",
    )
    .bind(tenant)
    .bind(format!("UH-RAD-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("imaging fixture");

    let (status, body) =
        get_json(&app, &csrf, &format!("/api/radiology/appointments?date={today}")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let rows = body.as_array().expect("the day list is a JSON array");
    let row = rows
        .iter()
        .find(|r| r["id"] == order_id.to_string().as_str())
        .expect("today's order is on today's list");
    assert_eq!(row["patient_name"], "Imaging Fixture");
    assert_eq!(row["uhid"], format!("UH-RAD-{suffix}").as_str());
    assert_eq!(row["modality"], "CT Fixture");
    assert_eq!(row["body_part"], "Chest");
}
