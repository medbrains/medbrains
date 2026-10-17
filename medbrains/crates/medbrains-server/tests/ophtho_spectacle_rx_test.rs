//! Eye OPD (#231): an exam is filed under the patient's own visit, values off
//! the trial set are refused, a prescription cannot be signed without what an
//! optician needs, and once signed it is fixed.

mod common;

use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn an_eye_exam_is_validated_signed_and_then_fixed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let mut patients = Vec::new();
    for n in 0..2 {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
             VALUES ($1, $2, 'Eye', 'Patient', 'female'::gender, '9000000231') RETURNING id",
        )
        .bind(tenant)
        .bind(format!("UH-EY{n}-{tag}"))
        .fetch_one(&app.db)
        .await
        .expect("patient");
        patients.push(id);
    }
    let visit: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patients[0])
    .fetch_one(&app.db)
    .await
    .expect("visit");

    let send = |method: reqwest::Method, path: String, body: Value| {
        app.client
            .request(method, app.url(&path))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let exams = "/api/specialty/ophthalmology/exams".to_owned();

    // Another patient's visit is not this exam's visit.
    let res = send(
        reqwest::Method::POST,
        exams.clone(),
        json!({ "patient_id": patients[1], "encounter_id": visit }),
    )
    .await
    .expect("post");
    assert_eq!(res.status(), 400);
    // A sphere of −1.30 is not on any trial lens.
    let res = send(
        reqwest::Method::POST,
        exams.clone(),
        json!({ "patient_id": patients[0], "sphere_od": "-1.30" }),
    )
    .await
    .expect("post");
    assert_eq!(res.status(), 400);
    assert!(res.text().await.expect("text").contains("0.25 steps"));

    let exam: Value = send(
        reqwest::Method::POST,
        exams.clone(),
        json!({
            "patient_id": patients[0], "encounter_id": visit,
            "visual_acuity_od": "6/18", "visual_acuity_os": "6/24", "bcva_od": "6/6", "bcva_os": "6/6",
            "sphere_od": "-1.25", "sphere_os": "-1.50", "cylinder_od": "-0.50", "axis_od": 180,
            "lens_type": "progressive",
        }),
    )
    .await
    .expect("post")
    .json()
    .await
    .expect("json");
    let id = exam["id"].as_str().expect("id").to_owned();
    assert_eq!(exam["encounter_id"], json!(visit));
    assert_eq!(exam["status"], "draft");

    let sign = format!("{exams}/{id}/sign");
    let res = send(reqwest::Method::POST, sign.clone(), json!({}))
        .await
        .expect("sign");
    assert_eq!(res.status(), 400, "no PD yet");
    assert!(
        res.text()
            .await
            .expect("text")
            .contains("pupillary distance")
    );

    let mut workup = exam.clone();
    workup["pd_mm"] = json!("63");
    workup["add_od"] = json!("2.00");
    workup["add_os"] = json!("2.00");
    let res = send(
        reqwest::Method::PUT,
        format!("{exams}/{id}"),
        workup.clone(),
    )
    .await
    .expect("put");
    assert!(res.status().is_success(), "{}", res.status());

    let signed: Value = send(reqwest::Method::POST, sign.clone(), json!({}))
        .await
        .expect("sign")
        .json()
        .await
        .expect("json");
    assert_eq!(signed["status"], "completed");
    assert!(signed["signed_at"].is_string());
    assert!(signed["signed_by_name"].is_string());
    assert_eq!(signed["pd_mm"], "63.0");

    workup["sphere_od"] = json!("-2.00");
    let res = send(reqwest::Method::PUT, format!("{exams}/{id}"), workup)
        .await
        .expect("put");
    assert_eq!(res.status(), 409, "a signed prescription is fixed");
    let res = send(reqwest::Method::POST, sign, json!({}))
        .await
        .expect("sign");
    assert_eq!(res.status(), 409);

    let listed: Vec<Value> = app
        .client
        .get(app.url(&format!("{exams}?encounter_id={visit}")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0]["sphere_od"], "-1.25");
}
