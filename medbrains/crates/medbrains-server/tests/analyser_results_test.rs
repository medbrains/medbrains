//! Analyser results over HL7 v2: every OBX posted, matched only by the
//! sample's barcode, corrections replacing rather than duplicating, and
//! everything uncertain held for review on the lab's analyser review tab.
//!
//! Payloads are built with the bridge's own parser from real-shaped ORU^R01
//! messages, so the test covers what an analyser actually sends.

use crate::common;

use medbrains_adapter_sdk::hl7;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    (
        status,
        serde_json::from_str(&text).unwrap_or(Value::String(text)),
    )
}

async fn ok(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let (status, body) = send(app, csrf, path, body).await;
    assert!(status.is_success(), "{path} → {status}: {body}");
    body
}

/// A collected lab order labelled `barcode`; returns (order id, patient UHID).
async fn collected_order(app: &common::TestApp, csrf: &str, barcode: &str) -> (String, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..7];
    let patient = ok(
        app,
        csrf,
        "/api/patients",
        json!({ "first_name": "Analyser", "last_name": tag, "gender": "male",
                "date_of_birth": "1980-01-01", "phone": format!("98{}", &Uuid::new_v4().as_u128().to_string()[..8]) }),
    )
    .await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let uhid = patient["uhid"].as_str().expect("uhid").to_owned();
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let visit = ok(
        app,
        csrf,
        "/api/opd/encounters",
        json!({ "patient_id": patient_id, "department_id": depts[0]["id"], "encounter_type": "opd" }),
    )
    .await;
    let tests: Value = app
        .get(&app.client, "/api/lab/catalog")
        .await
        .json()
        .await
        .expect("catalog");
    let order = ok(
        app,
        csrf,
        "/api/lab/orders",
        json!({ "patient_id": patient_id, "encounter_id": visit["encounter"]["id"], "test_id": tests[0]["id"] }),
    )
    .await;
    let order_id = order["id"].as_str().expect("order id").to_owned();
    let resp = app
        .client
        .put(app.url(&format!("/api/lab/orders/{order_id}/collect")))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_identifier": uhid, "sample_barcode": barcode }))
        .send()
        .await
        .expect("collect");
    assert!(
        resp.status().is_success(),
        "collect: {}",
        resp.text().await.unwrap_or_default()
    );
    (order_id, uhid)
}

async fn analyser(app: &common::TestApp, csrf: &str) -> String {
    let device = ok(
        app,
        csrf,
        "/api/devices/instances",
        json!({ "adapter_code": "mindray_bs240", "name": "XN-1000",
                "code": format!("XN-{}", Uuid::new_v4().simple()) }),
    )
    .await;
    device["id"].as_str().expect("device id").to_owned()
}

/// Ingest `raw` the way the bridge does: one delivery per order group.
async fn ingest(app: &common::TestApp, csrf: &str, device: &str, raw: &str) -> Value {
    let msg = hl7::parse(raw).expect("hl7");
    let group = hl7::oru::observation_groups(&msg)
        .into_iter()
        .next()
        .unwrap_or_default();
    ok(
        app,
        csrf,
        "/api/device-ingest/lab",
        json!({
            "device_instance_id": device,
            "protocol": "hl7_v2",
            "parsed_payload": { "message_type": "ORU^R01", "raw": raw },
            "mapped_data": {
                "identifiers": { "patient_id": group.patient_id, "sample_barcode": group.sample_barcode,
                                 "placer_order": group.placer_order },
                "results": group.results,
            },
            "processing_duration_ms": 3
        }),
    )
    .await
}

fn oru(uhid: &str, obr3: &str, obx: &[&str]) -> String {
    let mut m = format!(
        "MSH|^~\\&|XN-1000|HAEM|MEDBRAINS|LAB|20261026101500||ORU^R01|{}|P|2.5.1\r\
         PID|1||{uhid}^^^MB^MR||Test^Patient\rOBR|1||{obr3}|CBC^Complete blood count\r",
        Uuid::new_v4().simple()
    );
    for line in obx {
        m.push_str(line);
        m.push('\r');
    }
    m
}

async fn live_results(
    app: &common::TestApp,
    order_id: &str,
) -> Vec<(String, String, Option<String>, Option<String>)> {
    sqlx::query_as(
        "SELECT parameter_name, value, unit, flag::text FROM lab_results \
          WHERE order_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at, parameter_name",
    )
    .bind(order_id)
    .fetch_all(&app.db)
    .await
    .expect("results")
}

#[tokio::test]
async fn a_cbc_over_hl7_posts_every_parameter_and_corrections_replace() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let device = analyser(&app, &csrf).await;
    let barcode = format!("SB{}", &Uuid::new_v4().simple().to_string()[..8]);
    let (order_id, uhid) = collected_order(&app, &csrf, &barcode).await;
    let cbc = [
        "OBX|1|NM|WBC^White blood cells||12.4|10*3/uL|4.0-11.0|H|||F",
        "NTE|1||Smear reviewed",
        "OBX|2|NM|RBC^Red blood cells||4.82|10*6/uL|4.50-5.90|N|||F",
        "OBX|3|NM|HGB^Haemoglobin||6.1|g/dL|13.0-17.0|LL|||F",
        "OBX|4|NM|PLT^Platelets||250|10*3/uL|150-450||||F",
        "OBX|5|NM|HCT^Haematocrit||44.1|%|40-52|N|||F",
    ];
    // OBR-3 as an EI with components: only the first is the barcode.
    let body = ingest(
        &app,
        &csrf,
        &device,
        &oru(&uhid, &format!("{barcode}^XN-1000"), &cbc),
    )
    .await;
    assert_eq!(body["status"], "delivered", "{body}");
    assert_eq!(body["routed_entity_id"], order_id.as_str());

    let rows = live_results(&app, &order_id).await;
    let names: Vec<&str> = rows.iter().map(|r| r.0.as_str()).collect();
    assert_eq!(
        rows.len(),
        5,
        "one result per OBX, not one per message: {names:?}"
    );
    let hgb = rows.iter().find(|r| r.0 == "HGB").expect("HGB");
    assert_eq!((hgb.1.as_str(), hgb.2.as_deref()), ("6.1", Some("g/dL")));
    assert_eq!(
        hgb.3.as_deref(),
        Some("critical_low"),
        "the analyser's LL is a panic value"
    );
    let alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM lab_critical_alerts WHERE order_id = $1::uuid AND parameter_name = 'HGB'",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("alerts");
    assert_eq!(
        alerts, 1,
        "an analyser critical raises the same alert as a typed one"
    );
    let auto: bool = sqlx::query_scalar(
        "SELECT bool_or(is_auto_validated) FROM lab_results WHERE order_id = $1::uuid AND parameter_name = 'RBC'",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("auto");
    assert!(
        !auto,
        "an analyser's own N is not a technologist's judgement"
    );

    // The analyser retransmits: nothing is duplicated.
    let again = ingest(&app, &csrf, &device, &oru(&uhid, &barcode, &cbc)).await;
    assert_eq!(again["status"], "delivered");
    assert_eq!(live_results(&app, &order_id).await.len(), 5);

    // A correction (OBX-11 = C) replaces the value; the old one is kept, superseded.
    let fix = ["OBX|1|NM|HGB^Haemoglobin||6.4|g/dL|13.0-17.0|LL|||C"];
    assert_eq!(
        ingest(&app, &csrf, &device, &oru(&uhid, &barcode, &fix)).await["status"],
        "delivered"
    );
    let rows = live_results(&app, &order_id).await;
    assert_eq!(rows.len(), 5);
    assert_eq!(
        rows.iter().find(|r| r.0 == "HGB").map(|r| r.1.as_str()),
        Some("6.4")
    );
    let superseded: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM lab_results WHERE order_id = $1::uuid AND deleted_at IS NOT NULL",
    )
    .bind(&order_id)
    .fetch_one(&app.db)
    .await
    .expect("superseded");
    assert_eq!(superseded, 1);

    // A different final value without the correction status is held, not added.
    let conflict = ["OBX|1|NM|PLT^Platelets||90|10*3/uL|150-450|L|||F"];
    let held = ingest(&app, &csrf, &device, &oru(&uhid, &barcode, &conflict)).await;
    assert_eq!(held["status"], "needs_review", "{held}");
    let rows = live_results(&app, &order_id).await;
    assert_eq!(rows.len(), 5);
    assert_eq!(
        rows.iter().find(|r| r.0 == "PLT").map(|r| r.1.as_str()),
        Some("250")
    );
}

#[tokio::test]
async fn results_without_a_certain_match_are_held_and_resolved_on_review() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let device = analyser(&app, &csrf).await;
    let barcode = format!("SB{}", &Uuid::new_v4().simple().to_string()[..8]);
    let (order_id, uhid) = collected_order(&app, &csrf, &barcode).await;
    let glu = ["OBX|1|NM|GLU^Glucose||126|mg/dL|70-110|H|||F"];

    // No barcode: the patient has an open order, and the results must NOT
    // land on it by guesswork.
    let held = ingest(&app, &csrf, &device, &oru(&uhid, "", &glu)).await;
    assert_eq!(held["status"], "needs_review", "{held}");
    assert!(
        live_results(&app, &order_id).await.is_empty(),
        "no wrong-order attachment"
    );

    // The right barcode with a different patient's id is held too (2-ID).
    let wrong = ingest(
        &app,
        &csrf,
        &device,
        &oru("UHID-SOMEONE-ELSE", &barcode, &glu),
    )
    .await;
    assert_eq!(wrong["status"], "needs_review", "{wrong}");
    assert!(live_results(&app, &order_id).await.is_empty());

    // Both are on the lab's review queue with their reasons.
    let queue: Value = app
        .get(&app.client, "/api/lab/analyser-review")
        .await
        .json()
        .await
        .expect("queue");
    let ids: Vec<&str> = [&held, &wrong]
        .iter()
        .map(|b| b["message_id"].as_str().unwrap_or_default())
        .collect();
    let mine: Vec<&Value> = queue
        .as_array()
        .expect("array")
        .iter()
        .filter(|m| ids.contains(&m["id"].as_str().unwrap_or_default()))
        .collect();
    assert_eq!(mine.len(), 2);
    assert!(mine.iter().any(|m| {
        m["reason"]
            .as_str()
            .unwrap_or_default()
            .contains("no sample barcode")
    }));
    assert!(mine.iter().any(|m| {
        m["reason"]
            .as_str()
            .unwrap_or_default()
            .contains("UHID-SOMEONE-ELSE")
    }));

    // The technologist sees the patient's order as a candidate and attaches.
    let held_id = ids[0];
    let candidates: Value = app
        .get(
            &app.client,
            &format!("/api/lab/analyser-review/{held_id}/candidates"),
        )
        .await
        .json()
        .await
        .expect("candidates");
    assert!(
        candidates
            .as_array()
            .expect("array")
            .iter()
            .any(|c| c["order_id"] == order_id.as_str())
    );
    let attached = ok(
        &app,
        &csrf,
        &format!("/api/lab/analyser-review/{held_id}/attach"),
        json!({ "order_id": order_id }),
    )
    .await;
    assert_eq!(attached["posted"], 1);
    assert_eq!(live_results(&app, &order_id).await.len(), 1);

    // Attaching the wrong-patient message to that order is still refused.
    let (status, body) = send(
        &app,
        &csrf,
        &format!("/api/lab/analyser-review/{}/attach", ids[1]),
        json!({ "order_id": order_id }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");

    // Dismissing needs a reason, then closes it with the reason on record.
    let path = format!("/api/lab/analyser-review/{}/dismiss", ids[1]);
    assert_eq!(
        send(&app, &csrf, &path, json!({ "reason": " " })).await.0,
        StatusCode::BAD_REQUEST
    );
    ok(
        &app,
        &csrf,
        &path,
        json!({ "reason": "Sample relabelled; rerun" }),
    )
    .await;
    let (status, note): (String, Option<String>) = sqlx::query_as(
        "SELECT processing_status::text, review_note FROM device_messages WHERE id = $1::uuid",
    )
    .bind(ids[1])
    .fetch_one(&app.db)
    .await
    .expect("message");
    assert_eq!(
        (status.as_str(), note.as_deref()),
        ("rejected", Some("Sample relabelled; rerun"))
    );
}

#[tokio::test]
async fn a_barcode_on_two_orders_is_held_as_ambiguous() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let device = analyser(&app, &csrf).await;
    let barcode = format!("SB{}", &Uuid::new_v4().simple().to_string()[..8]);
    let (first, uhid) = collected_order(&app, &csrf, &barcode).await;
    let (second, _) = collected_order(&app, &csrf, &barcode).await;
    let body = ingest(
        &app,
        &csrf,
        &device,
        &oru(&uhid, &barcode, &["OBX|1|NM|NA||140|mmol/L"]),
    )
    .await;
    assert_eq!(body["status"], "needs_review", "{body}");
    assert!(live_results(&app, &first).await.is_empty());
    assert!(live_results(&app, &second).await.is_empty());
}

#[tokio::test]
async fn only_holders_of_the_review_permission_see_the_queue() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tech = common::provision_staff(&app, &csrf, "lab_technician", &[]).await;
    assert_eq!(
        app.get(&tech.client, "/api/lab/analyser-review")
            .await
            .status(),
        StatusCode::OK
    );
    let denied = common::provision_staff(
        &app,
        &csrf,
        "lab_technician",
        &["lab.results.analyser_review"],
    )
    .await;
    assert_eq!(
        app.get(&denied.client, "/api/lab/analyser-review")
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
}
