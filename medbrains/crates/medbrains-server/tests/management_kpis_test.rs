//! Management KPIs read a past day against what was usual for it, through the
//! dashboard's own batch call — the path the management dashboard takes.

mod common;

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A day nobody else's data lands on: a random date in 2015–2019.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 1800).unwrap_or(0);
    NaiveDate::from_ymd_opt(2015, 1, 5).unwrap_or_default() + Duration::days(offset)
}

/// Given 5 OPD visits on a day, 3 on the same weekday a week earlier and 1
/// two weeks earlier, and two tokens waiting 10 and 20 minutes, When the
/// management dashboard reads that day, Then visits are 5 against a usual
/// 1.0 (the two quiet weeks count as zero), and the median wait is 15 min.
#[tokio::test]
async fn opd_kpis_are_read_against_the_usual_day() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day();
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Kpi', 'Probe', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-KPI-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    for (weeks_back, visits) in [(0, 5), (1, 3), (2, 1)] {
        sqlx::query(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date) \
             SELECT $1, $2, 'opd', $3 FROM generate_series(1, $4)",
        )
        .bind(tenant)
        .bind(patient)
        .bind(day - Duration::weeks(weeks_back))
        .bind(visits)
        .execute(&app.db)
        .await
        .expect("visits");
    }
    for (seq, wait) in [(1, 10), (2, 20)] {
        sqlx::query(
            "INSERT INTO tokens (tenant_id, module, number, seq, token_date, status, \
                                 created_at, called_at) \
             VALUES ($1, 'opd', $2, $3, $4, 'completed', \
                     $4::timestamp + INTERVAL '10 hours', \
                     $4::timestamp + INTERVAL '10 hours' + make_interval(mins => $5))",
        )
        .bind(tenant)
        .bind(format!("KPI-{seq}"))
        .bind(seq)
        .bind(day)
        .bind(wait)
        .execute(&app.db)
        .await
        .expect("token");
    }

    let widget = |code: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT w.id FROM dashboard_widgets w JOIN dashboards d ON d.id = w.dashboard_id \
                 WHERE d.tenant_id = $1 AND d.code = 'role-admin' AND w.deleted_at IS NULL \
                   AND w.data_source->'params'->>'code' = $2",
            )
            .bind(tenant)
            .bind(code)
            .fetch_one(&db)
            .await
            .expect("a seeded management KPI widget")
        }
    };
    let ids = [widget("opd_visits").await, widget("opd_wait_minutes").await];
    let resp = app
        .client
        .post(app.url("/api/dashboard/widget-data/batch"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "widget_ids": ids, "as_of": day }))
        .send()
        .await
        .expect("batch");
    assert_eq!(resp.status(), StatusCode::OK);
    let answers: Vec<Value> = resp.json().await.expect("json");
    let data = |id: Uuid| {
        answers
            .iter()
            .find(|a| a["widget_id"] == json!(id))
            .map(|a| a["data"].clone())
            .unwrap_or(Value::Null)
    };

    let visits = data(ids[0]);
    assert_eq!(visits["value"], json!(5.0), "{visits}");
    assert_eq!(
        visits["baselines"]["weekday"],
        json!(1.0),
        "(3 + 1 + 0 + 0) / 4"
    );
    assert_eq!(visits["baselines"]["yesterday"], json!(0.0));
    assert_eq!(visits["so_far"], json!(false), "a past day is read whole");
    assert_eq!(visits["series"].as_array().map(Vec::len), Some(29));

    let wait = data(ids[1]);
    assert_eq!(wait["value"], json!(15.0), "{wait}");
    assert_eq!(wait["better"], json!("lower"));
    assert_eq!(
        wait["baselines"]["weekday"],
        Value::Null,
        "no tokens before: unknown, not 0"
    );
}
