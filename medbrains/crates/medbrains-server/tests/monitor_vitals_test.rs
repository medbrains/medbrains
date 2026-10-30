//! Bedside monitor readings into the nursing chart: bound to the patient on
//! the monitor's bed, thinned to one normal reading per 15 minutes, held when
//! the patient is in doubt, and charted (and scored) only when a nurse
//! confirms them.

use crate::common::{self, TestApp};
use crate::ews_auto_score_test::{SERIAL, admit, send};

use chrono::{Duration, Utc};
use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// HL7 timestamp with an explicit UTC offset.
fn ts(minutes_ago: i64) -> String {
    (Utc::now() - Duration::minutes(minutes_ago))
        .format("%Y%m%d%H%M%S+0000")
        .to_string()
}

/// What the bridge forwards for a monitor ORU: PID-3 and every OBX.
fn mapped(uhid: &str, at: &str, hr: i32, spo2: i32) -> Value {
    json!({
        "identifiers": { "patient_id": uhid, "sample_barcode": null, "placer_order": null },
        "results": [
            { "test_code": "150456", "test_name": "MDC_PULS_OXIM_SAT_O2", "value": spo2.to_string(), "unit": "262688", "observed_at": at },
            { "test_code": "147842", "test_name": "MDC_ECG_HEART_RATE", "value": hr.to_string(), "unit": "264864", "observed_at": at },
            { "test_code": "151562", "test_name": "MDC_RESP_RATE", "value": "16", "observed_at": at },
            { "test_code": "150021", "test_name": "MDC_PRESS_BLD_NONINV_SYS", "value": "124", "observed_at": at },
            { "test_code": "150022", "test_name": "MDC_PRESS_BLD_NONINV_DIA", "value": "78", "observed_at": at },
            { "test_code": "150344", "test_name": "MDC_TEMP", "value": "37.0", "unit": "268192", "observed_at": at },
        ],
    })
}

async fn post(app: &TestApp, csrf: &str, path: &str, body: &Value) -> (StatusCode, Value) {
    let r = app
        .client
        .request(Method::POST, app.url(path))
        .header("x-csrf-token", csrf)
        .json(body)
        .send()
        .await
        .expect("post");
    let s = r.status();
    (s, r.json().await.unwrap_or(Value::Null))
}

async fn monitor(app: &TestApp, csrf: &str, bed: Option<Uuid>) -> String {
    let (s, d) = post(
        app,
        csrf,
        "/api/devices/instances",
        &json!({ "adapter_code": "philips_intellivue_mx450",
        "name": "Bed monitor", "code": format!("MX-{}", Uuid::new_v4().simple()) }),
    )
    .await;
    assert!(s.is_success(), "{d}");
    let id = d["id"].as_str().expect("id").to_owned();
    let r = app
        .client
        .put(app.url(&format!("/api/devices/instances/{id}/bed")))
        .header("x-csrf-token", csrf)
        .json(&json!({ "bed_location_id": bed }))
        .send()
        .await
        .expect("bed");
    assert_eq!(r.status(), StatusCode::OK);
    id
}

async fn ingest(app: &TestApp, csrf: &str, device: &str, m: Value) -> Value {
    let (s, b) = post(
        app,
        csrf,
        "/api/device-ingest/lab",
        &json!({ "device_instance_id": device,
        "protocol": "hl7_v2", "parsed_payload": { "message_type": "ORU^R01" }, "mapped_data": m,
        "processing_duration_ms": 1 }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{b}");
    b
}

async fn bed(app: &TestApp, admission: Option<Uuid>) -> Uuid {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO locations (tenant_id, level, code, name) VALUES ($1, 'bed', $2, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("B-{}", tag.to_uppercase()))
    .bind(format!("Bed {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("bed");
    if let Some(a) = admission {
        sqlx::query("UPDATE admissions SET bed_id = $1 WHERE id = $2")
            .bind(id)
            .bind(a)
            .execute(&app.db)
            .await
            .expect("admit to bed");
    }
    id
}

#[tokio::test]
async fn monitor_readings_reach_the_patient_on_the_bed_and_are_charted_when_a_nurse_confirms() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let ward = admit(&app, "40 years", &nurse, &doctor).await;
    let uhid: String = sqlx::query_scalar(
        "SELECT p.uhid FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = $1",
    )
    .bind(ward.admission)
    .fetch_one(&app.db)
    .await
    .expect("uhid");
    let device = monitor(&app, &csrf, Some(bed(&app, Some(ward.admission)).await)).await;

    // A normal reading is kept; another 5 minutes later is thinned; an abnormal one is kept.
    let first = ingest(&app, &csrf, &device, mapped(&uhid, &ts(20), 82, 97)).await;
    assert_eq!(first["status"], "delivered", "{first}");
    let thinned = ingest(&app, &csrf, &device, mapped(&uhid, &ts(15), 84, 96)).await;
    assert_eq!(thinned["status"], "delivered");
    assert!(thinned["routed_entity_id"].is_null(), "not kept: {thinned}");
    let low = ingest(&app, &csrf, &device, mapped(&uhid, &ts(14), 128, 88)).await;
    assert!(
        low["routed_entity_id"].is_string(),
        "abnormal readings are always kept"
    );

    let path = format!("/api/nurse/encounters/{}/monitor-readings", ward.encounter);
    let (s, drafts) = send(&nurse, &app, (Method::GET, &path), &Value::Null).await;
    assert_eq!(s, StatusCode::OK, "{drafts}");
    let drafts = drafts.as_array().expect("drafts").clone();
    assert_eq!(drafts.len(), 2);
    assert_eq!(
        (
            drafts[0]["spo2"].as_i64(),
            drafts[0]["is_abnormal"].as_bool()
        ),
        (Some(88), Some(true))
    );
    let charted: i64 = sqlx::query_scalar("SELECT count(*) FROM vitals WHERE encounter_id = $1")
        .bind(ward.encounter)
        .fetch_one(&app.db)
        .await
        .expect("n");
    assert_eq!(charted, 0, "nothing is charted before a nurse confirms");

    // Confirming charts it at the time measured, from the device, scored.
    let id = drafts[0]["id"].as_str().expect("id");
    let (s, row) = send(
        &nurse,
        &app,
        (
            Method::POST,
            &format!("/api/nurse/monitor-readings/{id}/confirm"),
        ),
        &json!({ "consciousness": "A", "oxygen_device": "room_air" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{row}");
    let source: String = sqlx::query_scalar("SELECT source FROM vitals WHERE id = $1::uuid")
        .bind(row["id"].as_str().expect("vital id"))
        .fetch_one(&app.db)
        .await
        .expect("source");
    assert_eq!(source, "device");
    assert_eq!(row["spo2"], 88);
    assert!(
        row["ews"]["total"].as_i64().unwrap_or(0) >= 3,
        "NEWS2 scored: {row}"
    );
    let (status, vid): (String, Option<Uuid>) =
        sqlx::query_as("SELECT status, vital_id FROM device_vital_readings WHERE id = $1::uuid")
            .bind(id)
            .fetch_one(&app.db)
            .await
            .expect("draft");
    assert_eq!(status, "confirmed");
    assert!(vid.is_some());

    // Discarding needs a reason.
    let other = drafts[1]["id"].as_str().expect("id");
    let discard = format!("/api/nurse/monitor-readings/{other}/discard");
    assert_eq!(
        send(
            &nurse,
            &app,
            (Method::POST, &discard),
            &json!({ "reason": "" })
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        send(
            &nurse,
            &app,
            (Method::POST, &discard),
            &json!({ "reason": "probe off" })
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, left) = send(&nurse, &app, (Method::GET, &path), &Value::Null).await;
    assert_eq!(left.as_array().map(Vec::len), Some(0));

    // A message naming someone else is held, not charted to the bed's patient.
    let wrong = ingest(
        &app,
        &csrf,
        &device,
        mapped("UHID-NOT-HERE", &ts(1), 80, 97),
    )
    .await;
    assert_eq!(wrong["status"], "needs_review", "{wrong}");
    // A monitor with no bed holds its readings.
    let loose = monitor(&app, &csrf, None).await;
    let held = ingest(&app, &csrf, &loose, mapped(&uhid, &ts(1), 80, 97)).await;
    assert_eq!(held["status"], "needs_review");
    // An empty bed holds them too.
    let empty = monitor(&app, &csrf, Some(bed(&app, None).await)).await;
    assert_eq!(
        ingest(&app, &csrf, &empty, mapped(&uhid, &ts(1), 80, 97)).await["status"],
        "needs_review"
    );
}

#[tokio::test]
async fn confirming_a_monitor_reading_needs_the_right_to_chart_vitals() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &["nurse.vitals.record"]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let ward = admit(&app, "40 years", &nurse, &doctor).await;
    let uhid: String = sqlx::query_scalar(
        "SELECT p.uhid FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.id = $1",
    )
    .bind(ward.admission)
    .fetch_one(&app.db)
    .await
    .expect("uhid");
    let device = monitor(&app, &csrf, Some(bed(&app, Some(ward.admission)).await)).await;
    let r = ingest(&app, &csrf, &device, mapped(&uhid, &ts(2), 80, 97)).await;
    let id = r["routed_entity_id"].as_str().expect("draft");
    let (s, _) = send(
        &nurse,
        &app,
        (
            Method::POST,
            &format!("/api/nurse/monitor-readings/{id}/confirm"),
        ),
        &json!({}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}
