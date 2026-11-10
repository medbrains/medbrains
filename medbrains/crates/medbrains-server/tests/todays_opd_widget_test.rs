//! "Today's OPD" counts OPD visits only (migration 1216).
//!
//! It counted every encounter dated today, so admissions and ER visits made a
//! demo hospital's 12 OPD visits read 17.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

/// Runs in a hospital of its own: the count is of today's visits, and other
/// tests open visits in the shared one while this runs.
#[tokio::test]
async fn todays_opd_does_not_count_admissions() {
    let app = common::spawn_app().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("TO{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Todays OPD Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    let mut ids = Vec::new();
    for role in ["hospital_admin", "doctor"] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
             SELECT $1, $2, $2 || '@todays-opd.example.org', 'Todays Opd', $3::user_role, password_hash \
               FROM users WHERE username = 'admin' RETURNING id",
        )
        .bind(tenant)
        .bind(format!("to{role}_{}", suffix.to_lowercase()))
        .bind(role)
        .fetch_one(&app.db)
        .await
        .expect("user");
        ids.push(id);
    }
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GM', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let client = reqwest::Client::builder().cookie_store(true).build().expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": format!("tohospital_admin_{}", suffix.to_lowercase()), "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    let send = |path: String, body: Value| {
        let req = if path.contains("/widgets/") { client.put(app.url(&path)) } else { client.post(app.url(&path)) };
        req.header("x-csrf-token", &csrf).json(&body).send()
    };
    let ok = |resp: reqwest::Response| async move {
        let status = resp.status();
        let body: Value = resp.json().await.unwrap_or(Value::Null);
        assert!(status.is_success(), "{status}: {body}");
        body
    };

    ok(send("/api/dashboards/my/widgets/opd_today_count".into(), json!({ "visible": true }))
        .await
        .expect("place widget"))
    .await;
    let dashboard: Value = client
        .get(app.url("/api/dashboards/my"))
        .send()
        .await
        .expect("dashboard")
        .json()
        .await
        .expect("dashboard json");
    let widget_id = dashboard["widgets"]
        .as_array()
        .and_then(|w| {
            w.iter()
                .find(|w| w["title"] == "Today's OPD" && w["data_source"]["type"] == "sql_count")
        })
        .and_then(|w| w["id"].as_str())
        .expect("the Today's OPD card")
        .to_owned();
    let count = || async {
        let answer = ok(send(
            "/api/dashboard/widget-data/batch".into(),
            json!({ "widget_ids": [widget_id] }),
        )
        .await
        .expect("batch"))
        .await;
        answer[0]["data"]["value"]
            .as_i64()
            .unwrap_or_else(|| panic!("a count: {answer}"))
    };
    assert_eq!(count().await, 0, "a new hospital has seen nobody today");

    let patient = ok(send(
        "/api/patients".into(),
        json!({ "first_name": "Opd", "last_name": "Count", "gender": "male", "date_of_birth": "1990-01-01", "phone": "9990000415" }),
    )
    .await
    .expect("patient"))
    .await;
    ok(send(
        "/api/opd/encounters".into(),
        json!({ "patient_id": patient["id"], "department_id": department, "encounter_type": "opd" }),
    )
    .await
    .expect("visit"))
    .await;
    assert_eq!(count().await, 1, "one OPD visit");

    // An admission opens an IPD encounter dated today; it is not an OPD visit.
    ok(send(
        "/api/ipd/admissions".into(),
        json!({ "patient_id": patient["id"], "department_id": department, "doctor_id": ids[1] }),
    )
    .await
    .expect("admit"))
    .await;
    assert_eq!(count().await, 1, "an admission is not an OPD visit");
}
