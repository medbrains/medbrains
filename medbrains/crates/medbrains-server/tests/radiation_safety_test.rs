//! The RSO's registers: each unit's AERB licence and QA with what is
//! expired or due, and staff TLD readings held to the occupational limits.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(req: reqwest::RequestBuilder, csrf: &str) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn admin(app: &common::TestApp) -> (Uuid, Uuid) {
    sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin")
}

#[tokio::test]
async fn a_unit_says_what_is_expired_and_staff_doses_are_held_to_the_limits() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, _) = admin(&app).await;

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    for path in [
        "/api/radiology/radiation-equipment",
        "/api/radiology/dosimetry",
    ] {
        let (status, _) = send(nurse.client.get(app.url(path)), &nurse.csrf).await;
        assert_eq!(
            status,
            StatusCode::FORBIDDEN,
            "{path}: staff doses are not for everyone"
        );
    }

    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let unit: Uuid = sqlx::query_scalar(
        "INSERT INTO bme_equipment (tenant_id, name, serial_number) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CT scanner {tag}"))
    .bind(format!("SN-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("unit");
    let save = |body: Value| {
        send(
            app.client
                .put(app.url("/api/radiology/radiation-equipment"))
                .json(&body),
            &csrf,
        )
    };
    let (status, _) = save(json!({
        "bme_equipment_id": unit, "last_qa_date": "2026-05-01", "qa_due_date": "2026-01-01",
    }))
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "next QA before the last");
    let (status, body) = save(json!({
        "bme_equipment_id": unit, "aerb_licence_number": "AERB/CT/42",
        "licence_valid_until": "2020-01-01", "qa_due_date": "2099-01-01",
    }))
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (_, list) = send(
        app.client
            .get(app.url("/api/radiology/radiation-equipment")),
        &csrf,
    )
    .await;
    let row = list
        .as_array()
        .and_then(|l| l.iter().find(|u| u["bme_equipment_id"] == json!(unit)))
        .expect("listed")
        .clone();
    let messages: Vec<&str> = row["alerts"]
        .as_array()
        .expect("alerts")
        .iter()
        .filter_map(|a| a["message"].as_str())
        .collect();
    assert!(
        messages
            .iter()
            .any(|m| m.contains("Licence expired on 2020-01-01")),
        "{row}"
    );

    // A second save updates the same unit, not a second row.
    let (status, _) = save(
        json!({ "bme_equipment_id": unit, "aerb_licence_number": "AERB/CT/42",
        "licence_valid_until": "2099-01-01", "qa_due_date": "2099-01-01" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM radiation_equipment WHERE bme_equipment_id = $1 AND deleted_at IS NULL",
    )
    .bind(unit)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(rows, 1);

    // A fresh person, so the year's total is only what this test records.
    let wearer = common::provision_staff(&app, &csrf, "radiology_tech", &[]).await;
    let admin_id = wearer.user_id;
    let badge = format!("TLD-{tag}");
    let record = |start: &str, end: &str, dose: f64| {
        send(
            app.client
                .post(app.url("/api/radiology/dosimetry"))
                .json(&json!({
                    "staff_id": admin_id, "badge_number": badge, "period_start": start,
                    "period_end": end, "dose_value": dose,
                })),
            &csrf,
        )
    };
    let (status, _) = record("2099-01-01", "2099-03-31", 1.0).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a period that has not ended"
    );
    let (status, _) = record("2025-01-01", "2025-03-31", 12.0).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = record("2025-03-01", "2025-05-31", 1.0).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "overlapping readings would count twice"
    );
    let (status, second) = record("2025-04-01", "2025-06-30", 9.5).await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(
        second["alerts"][0]["level"], "warning",
        "21.5 mSv is over the 20 mSv average: {second}"
    );

    let (_, year) = send(
        app.client
            .get(app.url("/api/radiology/dosimetry?year=2025")),
        &csrf,
    )
    .await;
    let me = year["staff"]
        .as_array()
        .and_then(|s| s.iter().find(|p| p["staff_id"] == json!(admin_id)))
        .expect("summed")
        .clone();
    assert!(
        (me["year_msv"].as_f64().expect("msv") - 21.5).abs() < 1e-9,
        "{me}"
    );

    let reading = year["readings"]
        .as_array()
        .and_then(|r| r.iter().find(|x| x["badge_number"] == json!(badge)))
        .and_then(|x| x["id"].as_str())
        .expect("reading")
        .to_owned();
    let (status, _) = send(
        app.client
            .delete(app.url(&format!("/api/radiology/dosimetry/{reading}"))),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (_, year) = send(
        app.client
            .get(app.url("/api/radiology/dosimetry?year=2025")),
        &csrf,
    )
    .await;
    let total = year["staff"]
        .as_array()
        .and_then(|s| s.iter().find(|p| p["staff_id"] == json!(admin_id)))
        .and_then(|p| p["year_msv"].as_f64())
        .unwrap_or_default();
    assert!(
        total < 21.5,
        "a reading entered in error leaves the total: {total}"
    );
}

/// A hospital of the test's own and its signed-in administrator, so its
/// doses and levels are only what the test records.
async fn own_hospital(app: &common::TestApp) -> (Uuid, reqwest::Client, String) {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("RS{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Radiation Safety Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    let username = format!("rsadmin_{}", suffix.to_lowercase());
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@rs-check.example.org', 'RS Admin', 'hospital_admin', password_hash \
           FROM users WHERE username = 'admin'",
    )
    .bind(tenant)
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("admin");
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    (
        tenant,
        client,
        login["csrf_token"].as_str().unwrap_or_default().to_owned(),
    )
}

async fn patient(app: &common::TestApp, tenant: Uuid, gender: &str, dob: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Asha', 'Nair', $3::gender, '9000000231', $4::date) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-RS-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(gender)
    .bind(dob)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

#[tokio::test]
async fn an_x_ray_of_a_woman_who_may_be_pregnant_waits_for_the_answer() {
    let app = common::spawn_app().await;
    let (tenant, client, csrf) = own_hospital(&app).await;
    let (status, modality) = send(
        client
            .post(app.url("/api/radiology/modalities"))
            .json(&json!({ "code": "CTX", "name": "CT second scanner" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{modality}");
    assert_eq!(
        modality["is_ionising"], true,
        "a CT is ionising unless told otherwise"
    );
    let order_for = |p: Uuid| {
        send(
            client.post(app.url("/api/radiology/orders")).json(&json!({
                "patient_id": p, "modality_id": modality["id"], "body_part": "Chest" })),
            &csrf,
        )
    };
    let woman = patient(&app, tenant, "female", "1996-05-01").await;
    let (_, order) = order_for(woman).await;
    let id = order["id"].as_str().expect("order").to_owned();
    let (_, detail) = send(
        client.get(app.url(&format!("/api/radiology/orders/{id}"))),
        &csrf,
    )
    .await;
    assert_eq!(detail["pregnancy_check_required"], true, "{detail}");

    let start = app.url(&format!("/api/radiology/orders/{id}/status"));
    let (status, _) = send(
        client.put(&start).json(&json!({ "status": "in_progress" })),
        &csrf,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "not before the pregnancy question"
    );

    let check = app.url(&format!("/api/radiology/orders/{id}/pregnancy-check"));
    let (status, _) = send(
        client
            .post(&check)
            .json(&json!({ "status": "cannot_rule_out", "method": "lmp" })),
        &csrf,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a possible pregnancy needs a reason to go ahead"
    );
    let (status, recorded) = send(
        client
            .post(&check)
            .json(&json!({ "status": "cannot_rule_out", "method": "lmp",
            "justification": "Suspected pulmonary embolism; benefit outweighs the fetal dose" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{recorded}");
    assert_eq!(recorded["pregnancy_status"], "cannot_rule_out");
    let (status, _) = send(
        client.put(&start).json(&json!({ "status": "in_progress" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // A man, or a woman of 60, is not asked.
    for p in [
        patient(&app, tenant, "male", "1990-01-01").await,
        patient(&app, tenant, "female", "1960-01-01").await,
    ] {
        let (_, order) = order_for(p).await;
        let url = app.url(&format!(
            "/api/radiology/orders/{}/status",
            order["id"].as_str().expect("id")
        ));
        let (status, _) = send(
            client.put(&url).json(&json!({ "status": "in_progress" })),
            &csrf,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
    }
}

#[tokio::test]
async fn a_hospital_starts_with_regional_levels_and_audits_its_median_against_them() {
    let app = common::spawn_app().await;
    let (tenant, client, csrf) = own_hospital(&app).await;
    let (_, levels) = send(client.get(app.url("/api/radiology/drls")), &csrf).await;
    let levels = levels.as_array().expect("levels").clone();
    assert_eq!(levels.len(), 6, "seeded for a new hospital: {levels:?}");
    assert!(levels.iter().all(|l| {
        l["source"]
            .as_str()
            .is_some_and(|s| s.contains("not a national DRL"))
    }));

    let (status, _) = send(
        client.put(app.url("/api/radiology/drls")).json(&json!({
            "region": "knee", "metric": "dlp", "value": 100, "source": "x" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(
        client.put(app.url("/api/radiology/drls")).json(&json!({
            "region": "head", "metric": "dlp", "value": 900, "source": "Physicist, 2026" })),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (_, modality) = send(
        client
            .post(app.url("/api/radiology/modalities"))
            .json(&json!({ "code": "CTX", "name": "CT second scanner" })),
        &csrf,
    )
    .await;
    let adult = patient(&app, tenant, "male", "1970-01-01").await;
    for i in 0..10 {
        let (_, order) = send(
            client.post(app.url("/api/radiology/orders")).json(&json!({
                "patient_id": adult, "modality_id": modality["id"], "body_part": "Head" })),
            &csrf,
        )
        .await;
        let (status, _) = send(
            client
                .post(app.url(&format!(
                    "/api/radiology/orders/{}/dose",
                    order["id"].as_str().expect("id")
                )))
                .json(&json!({ "dlp": 1000 + i * 10 })),
            &csrf,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
    }
    let today = chrono::Utc::now().date_naive();
    let (status, report) = send(
        client.get(app.url(&format!("/api/radiology/drl-audit?from={today}&to={today}"))),
        &csrf,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{report}");
    let head = report["rows"]
        .as_array()
        .and_then(|r| {
            r.iter()
                .find(|x| x["region"] == "head" && x["metric"] == "dlp")
        })
        .expect("head dlp")
        .clone();
    assert_eq!(
        (head["exams"].as_i64(), head["verdict"].as_str()),
        (Some(10), Some("above")),
        "{head}"
    );
    assert!((head["median"].as_f64().expect("median") - 1045.0).abs() < 1e-6);
    let chest = report["rows"]
        .as_array()
        .and_then(|r| {
            r.iter()
                .find(|x| x["region"] == "chest" && x["metric"] == "dlp")
        })
        .expect("chest");
    assert_eq!(chest["verdict"], "too_few");
}
