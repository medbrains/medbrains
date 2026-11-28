//! A statutory register prints every entry of its period. The MLC, birth,
//! death and biomedical-waste registers stopped at 5,000 rows without a word,
//! and the MLC totals were counted from the rows that made it.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn the_mlc_register_prints_all_5001_cases_of_its_quarter() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Register', 'Case', 'other'::gender, '9000000001' \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-RG-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    // A quarter nobody else's test writes MLC cases in; emptied for a rerun.
    sqlx::query(
        "UPDATE mlc_cases SET deleted_at = now() WHERE registration_date >= '2031-01-01' \
           AND registration_date < '2031-04-01' AND deleted_at IS NULL",
    )
    .execute(&app.db)
    .await
    .expect("empty the quarter");
    sqlx::query(
        "INSERT INTO mlc_cases (tenant_id, patient_id, mlc_number, registration_date) \
         SELECT p.tenant_id, p.id, $2 || '-' || n, DATE '2031-01-01' + (n % 90) \
           FROM patients p, generate_series(1, 5001) AS n WHERE p.id = $1",
    )
    .bind(patient)
    .bind(format!("MLC-RG-{suffix}"))
    .execute(&app.db)
    .await
    .expect("5,001 cases");

    let resp = app
        .get(&app.client, "/api/print-data/mlc-register-summary/2031-Q1")
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let register: Value = resp.json().await.expect("json");
    let entries = register["entries"].as_array().expect("entries");
    assert_eq!(entries.len(), 5001, "rows printed");
    assert_eq!(register["total_cases"], 5001);
    assert_eq!(entries[5000]["serial_number"], 5001);
}
