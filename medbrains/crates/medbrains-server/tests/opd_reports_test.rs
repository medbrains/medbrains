//! The OPD reports screen counts what the daily report email counts: OPD
//! visits by encounter date (not cancelled), registrations by the hospital's
//! day, a patient new on their first-ever visit and repeat after it, visits by
//! doctor. Another hospital's rows never appear; only holders of
//! `opd.reports.view` may ask; a backwards or over-long range is refused.

use crate::common;

use chrono::{Duration, NaiveDate};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// Staff in `role` with a login: their user id and signed-in client.
async fn staff(app: &common::TestApp, admin_csrf: &str, role: &str) -> (Uuid, Client) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("or_{tag}"), format!("Rep#{tag}Aa9"));
    let user: Value = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Dr {tag}"), "role": role,
        }))
        .send()
        .await
        .expect("create user")
        .json()
        .await
        .expect("user json");
    let id: Uuid = user["id"].as_str().expect("id").parse().expect("uuid");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    (id, client)
}

/// A patient of `tenant` registered at noon, hospital time, on `day`.
async fn patient(app: &common::TestApp, tenant: Uuid, day: NaiveDate) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string();
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, created_at) \
         SELECT id, $2, 'Report', 'Count', 'other'::gender, $3, \
                timezone(timezone, $4::date + time '12:00') \
           FROM tenants WHERE id = $1 RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-OR-{}", &suffix[..10]))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .bind(day)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// An OPD visit on `day`, seen by `doctor`.
async fn visit(app: &common::TestApp, p: Uuid, doctor: Option<Uuid>, day: NaiveDate, status: &str) {
    sqlx::query(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, encounter_date, doctor_id) \
         SELECT tenant_id, $1, 'opd', $2::encounter_status, $3, $4 FROM patients WHERE id = $1",
    )
    .bind(p)
    .bind(status)
    .bind(day)
    .bind(doctor)
    .execute(&app.db)
    .await
    .expect("visit");
}

async fn summary(
    app: &common::TestApp,
    client: &Client,
    from: NaiveDate,
    to: NaiveDate,
) -> (StatusCode, Value) {
    let resp = client
        .get(app.url(&format!("/api/opd/reports/summary?from={from}&to={to}")))
        .send()
        .await
        .expect("summary");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn opd_reports_count_like_the_daily_report() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    // A random two days long ago, so earlier runs on the same database count nothing here.
    let d1 = NaiveDate::from_ymd_opt(1950, 1, 1).expect("date")
        + Duration::days(i64::try_from(Uuid::new_v4().as_u128() % 14_000).expect("days") * 2);
    let d2 = d1 + Duration::days(1);
    let (x, _) = staff(&app, &csrf, "doctor").await;
    let (y, _) = staff(&app, &csrf, "doctor").await;
    let (_, superintendent) = staff(&app, &csrf, "medical_superintendent").await;
    let (_, desk) = staff(&app, &csrf, "receptionist").await;

    let a = patient(&app, tenant, d1).await; // first visit d1 (new), back d2 (repeat)
    visit(&app, a, Some(x), d1, "completed").await;
    visit(&app, a, Some(y), d2, "completed").await;
    let b = patient(&app, tenant, d2).await; // new on d2; a cancelled visit does not count
    visit(&app, b, Some(y), d2, "open").await;
    visit(&app, b, Some(x), d2, "cancelled").await;
    let c = patient(&app, tenant, d1 - Duration::days(400)).await; // seen before the range
    visit(&app, c, Some(x), d1 - Duration::days(30), "completed").await;
    visit(&app, c, Some(x), d1, "completed").await;

    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other', 'multi_specialty') RETURNING id",
    )
    .bind(format!("OR{}", Uuid::new_v4().simple().to_string()[..8].to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("other tenant");
    let stranger = patient(&app, other, d1).await;
    visit(&app, stranger, None, d1, "completed").await;

    let (status, body) = summary(&app, &superintendent, d1, d2).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let data = &body["data"];
    assert_eq!(
        data["totals"],
        json!({"visits": 4, "registrations": 2, "new_patients": 2, "repeat_patients": 2}),
        "the other hospital and the cancelled visit are not counted: {body}"
    );
    assert_eq!(
        data["by_day"],
        json!([
            {"date": d1.to_string(), "visits": 2, "registrations": 1, "new": 1, "repeat": 1},
            {"date": d2.to_string(), "visits": 2, "registrations": 1, "new": 1, "repeat": 1},
        ])
    );
    let doctors = data["by_doctor"].as_array().expect("by_doctor");
    let seen_by = |id: Uuid| {
        doctors
            .iter()
            .find(|d| d["doctor_id"] == json!(id))
            .map(|d| d["visits"].clone())
    };
    assert_eq!(
        (doctors.len(), seen_by(x), seen_by(y)),
        (2, Some(json!(2)), Some(json!(2))),
        "{body}"
    );

    let (status, _) = summary(&app, &desk, d1, d2).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "the front desk does not see reports"
    );
    let (status, _) = summary(&app, &superintendent, d2, d1).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a backwards range is refused"
    );
    let (status, _) = summary(&app, &superintendent, d1, d1 + Duration::days(366)).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "more than a year is refused"
    );
}
