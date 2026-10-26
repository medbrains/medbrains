//! A check-in after the shift start is marked late (migration 1225).

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

/// Given a 09:00 shift, When a check-in is recorded at 09:30 hospital time,
/// Then it is late by 30 minutes; And at 09:05 it is within the grace and on
/// time; And with no shift known it is not judged.
#[tokio::test]
async fn a_check_in_after_the_shift_start_is_late() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let t = tag();
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name) VALUES ($1, $2, 'Late') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("LT{t}"))
    .fetch_one(&app.db)
    .await
    .expect("employee");
    let shift: Uuid = sqlx::query_scalar(
        "INSERT INTO shift_definitions (tenant_id, code, name, start_time, end_time) \
         VALUES ($1, $2, 'Morning', '09:00', '15:00') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("M{t}"))
    .fetch_one(&app.db)
    .await
    .expect("shift");
    // A wall-clock time on the hospital's calendar, as an instant.
    let at = |date: &'static str, time: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, String>(
                "SELECT to_char(($2::date + $3::time) AT TIME ZONE \
                        COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC'), \
                        'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')",
            )
            .bind(tenant)
            .bind(date)
            .bind(time)
            .fetch_one(&db)
            .await
            .expect("instant")
        }
    };

    for (date, time, shift_id, late, minutes) in [
        ("2026-03-02", "09:30", Some(shift), true, 30),
        ("2026-03-03", "09:05", Some(shift), false, 0),
        ("2026-03-04", "11:00", None, false, 0),
    ] {
        let (status, row) = send(
            &app,
            &csrf,
            reqwest::Method::POST,
            "/api/hr/attendance",
            json!({
                "employee_id": employee, "attendance_date": date, "shift_id": shift_id,
                "check_in": at(date, time).await,
            }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{row}");
        assert_eq!(row["is_late"], late, "{date} {time}: {row}");
        assert_eq!(row["late_minutes"], minutes, "{date} {time}: {row}");
    }
}
