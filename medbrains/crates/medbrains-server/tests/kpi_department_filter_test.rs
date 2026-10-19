//! A reader narrows an OPD-visits tile to one department, and the figure,
//! its baselines and its series are that department's alone. A KPI that has
//! no department — new patients — says so, and is not narrowed.

mod common;

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A day nobody else's data lands on: this file's own years, 1990-1995, and
/// never a future day, which a reading would cap to today.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 1800).unwrap_or(0);
    NaiveDate::from_ymd_opt(1990, 2, 1).unwrap_or_default() + Duration::days(offset)
}

async fn department(app: &common::TestApp, code: &str) -> Uuid {
    sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $1",
    )
    .bind(code)
    .fetch_one(&app.db)
    .await
    .expect("department")
}

#[tokio::test]
async fn an_opd_tile_narrows_to_one_department() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let day = quiet_day();
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let medicine = department(&app, "GEN-MEDICINE").await;
    let anaesthesia = department(&app, "ANESTHESIOLOGY").await;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Dept', 'Filter', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-KD-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    for (dept, visits) in [(medicine, 3), (anaesthesia, 2)] {
        sqlx::query(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, encounter_date, \
                                     department_id) \
             SELECT $1, $2, 'opd', $3, $4 FROM generate_series(1, $5)",
        )
        .bind(tenant)
        .bind(patient)
        .bind(day)
        .bind(dept)
        .bind(visits)
        .execute(&app.db)
        .await
        .expect("visits");
    }
    let widget = |code: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT w.id FROM dashboard_widgets w JOIN dashboards d ON d.id = w.dashboard_id \
                 WHERE d.tenant_id = $1 AND d.user_id IS NULL AND w.deleted_at IS NULL \
                   AND w.data_source->'params'->>'code' = $2 LIMIT 1",
            )
            .bind(tenant)
            .bind(code)
            .fetch_one(&db)
            .await
            .expect("a seeded KPI widget")
        }
    };
    let opd = widget("opd_visits").await;
    let patients = widget("patient_registrations").await;

    let read = |filters: Value| {
        let app = &app;
        let csrf = csrf.clone();
        async move {
            let resp = app
                .client
                .post(app.url("/api/dashboard/widget-data/batch"))
                .header("x-csrf-token", &csrf)
                .json(&json!({ "widget_ids": [opd, patients], "as_of": day, "filters": filters }))
                .send()
                .await
                .expect("batch");
            assert_eq!(resp.status(), StatusCode::OK);
            let answers: Vec<Value> = resp.json().await.expect("json");
            let of = |id: Uuid| {
                answers
                    .iter()
                    .find(|a| a["widget_id"] == json!(id))
                    .map(|a| a["data"].clone())
                    .unwrap_or(Value::Null)
            };
            (of(opd), of(patients))
        }
    };

    let (all, _) = read(json!({})).await;
    assert_eq!(all["value"], json!(5.0), "every department: {all}");
    assert_eq!(
        all["filters"],
        json!(["department"]),
        "OPD visits can be narrowed"
    );

    let (medicine_only, registrations) =
        read(json!({ opd.to_string(): { "department_id": medicine },
                     patients.to_string(): { "department_id": medicine } }))
        .await;
    assert_eq!(medicine_only["value"], json!(3.0), "{medicine_only}");
    assert_eq!(medicine_only["department_id"], json!(medicine));
    assert_eq!(
        registrations["filters"],
        json!([]),
        "new patients have no department"
    );
    assert_eq!(
        registrations["department_id"],
        Value::Null,
        "and are not narrowed by one"
    );

    let (anaesthesia_only, _) =
        read(json!({ opd.to_string(): { "department_id": anaesthesia } })).await;
    assert_eq!(anaesthesia_only["value"], json!(2.0), "{anaesthesia_only}");
}
