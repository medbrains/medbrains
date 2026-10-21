//! The lab's order worklist names each order's patient. A lab technician is
//! not on the patient's care team and cannot open the patient's record, so a
//! worklist that looked names up record by record read "Unresolved patient"
//! — a sample nobody could match to a person. The list carries the identity.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_lab_technician_sees_who_each_order_is_for() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Meena', 'Worklist', 'female'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-LW-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let visit: Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient, "department_id": department }))
        .send()
        .await
        .expect("visit")
        .json()
        .await
        .expect("visit json");
    let test_id: Uuid = sqlx::query_scalar(
        "SELECT c.id FROM lab_test_catalog c JOIN users u ON u.tenant_id = c.tenant_id \
          WHERE u.username = 'admin' AND c.code = 'CBC' LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("CBC");
    let resp = app
        .client
        .post(app.url("/api/lab/orders"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "encounter_id": visit["encounter"]["id"], "patient_id": patient,
                       "test_id": test_id }),
        )
        .send()
        .await
        .expect("order");
    assert_eq!(resp.status(), StatusCode::OK);

    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("lab_{tag}"), format!("Lab#{tag}Aa9"));
    let created = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "username": username, "email": format!("{username}@example.test"),
                       "password": password, "full_name": "Lab Tech", "role": "lab_technician" }),
        )
        .send()
        .await
        .expect("user");
    assert_eq!(created.status(), StatusCode::OK);
    let lab = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    lab.post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");

    let uhid = format!("UH-LW-{suffix}");
    let list: Value = lab
        .get(app.url(&format!("/api/lab/orders?q={uhid}&per_page=10")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    let names: Vec<&str> = list["patients"]
        .as_array()
        .expect("patients on the list")
        .iter()
        .filter_map(|p| p["full_name"].as_str())
        .collect();
    assert!(names.contains(&"Meena Worklist"), "{list}");

    // And the record itself stays closed to them: the list names, it does
    // not open the chart.
    let record = lab
        .get(app.url(&format!("/api/patients/{patient}")))
        .send()
        .await
        .expect("record");
    assert_eq!(record.status(), StatusCode::NOT_FOUND);
}
