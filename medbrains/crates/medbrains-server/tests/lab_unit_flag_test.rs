//! Result flagging converts the reported unit to the reference's unit.
//!
//! The reference table writes platelets in lakh/cumm and WBC in cells/cumm;
//! analysers report both in 10^3/uL. Comparing bare numbers flagged every
//! normal platelet count critical and called a true critical low "high".

use crate::common;

use serde_json::{Value, json};

async fn send(app: &common::TestApp, csrf: &str, put: bool, path: &str, body: Value) -> Value {
    let req = if put {
        app.client.put(app.url(path))
    } else {
        app.client.post(app.url(path))
    };
    let resp = req
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

/// A processed lab order on a fresh adult patient, ready for results.
async fn processed_order(app: &common::TestApp, csrf: &str) -> String {
    let patient = send(
        app,
        csrf,
        false,
        "/api/patients",
        json!({ "first_name": "Unit", "last_name": "Flag", "gender": "male", "date_of_birth": "1980-01-01", "phone": "9990000177" }),
    )
    .await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let uhid = patient["uhid"].as_str().expect("uhid").to_owned();
    let depts: Value =
        app.get(&app.client, "/api/setup/departments").await.json().await.expect("departments");
    let visit = send(
        app,
        csrf,
        false,
        "/api/opd/encounters",
        json!({ "patient_id": patient_id, "department_id": depts[0]["id"], "encounter_type": "opd" }),
    )
    .await;
    let encounter_id = visit["encounter"]["id"].clone();
    let tests: Value = app.get(&app.client, "/api/lab/catalog").await.json().await.expect("catalog");
    let order = send(
        app,
        csrf,
        false,
        "/api/lab/orders",
        json!({ "patient_id": patient_id, "encounter_id": encounter_id, "test_id": tests[0]["id"] }),
    )
    .await;
    let order_id = order["id"].as_str().expect("order id").to_owned();
    let collect = format!("/api/lab/orders/{order_id}/collect");
    send(app, csrf, true, &collect, json!({ "patient_identifier": uhid })).await;
    send(app, csrf, true, &format!("/api/lab/orders/{order_id}/process"), json!({})).await;
    order_id
}

#[tokio::test]
async fn platelet_and_wbc_counts_are_judged_in_the_reference_unit() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    // The shared reference rows as seeded (global table, no tenant).
    sqlx::query(
        "INSERT INTO cds_lab_reference (analyte, test, unit, normal_low, normal_high, critical_low, critical_high) \
         VALUES ('platelet count', 'CBC', 'lakh/cumm', 1.5, 4.5, 0.2, 10), \
                ('total wbc', 'CBC', 'cells/cumm', 4000, 11000, 2000, 30000) \
         ON CONFLICT (analyte) DO NOTHING",
    )
    .execute(&app.db)
    .await
    .expect("reference rows");

    let order_id = processed_order(&app, &csrf).await;
    let results = send(
        &app,
        &csrf,
        false,
        &format!("/api/lab/orders/{order_id}/results"),
        json!({ "results": [
            { "parameter_name": "Platelet count", "value": "250", "unit": "10^3/uL" },
            { "parameter_name": "Platelet count", "value": "16", "unit": "10^3/uL" },
            { "parameter_name": "Platelet count", "value": "120", "unit": "10³/µL" },
            { "parameter_name": "Total WBC", "value": "7.5", "unit": "10^3/uL" },
            { "parameter_name": "Total WBC", "value": "45", "unit": "10^3/uL" },
            { "parameter_name": "Total WBC", "value": "7.5", "unit": "mg/dL" }
        ] }),
    )
    .await;
    let flags: Vec<Value> = results
        .as_array()
        .expect("results array")
        .iter()
        .map(|r| r["flag"].clone())
        .collect();
    assert_eq!(
        flags,
        vec![
            Value::Null,           // 2.5 lakh: in range, no false critical
            json!("critical_low"), // 0.16 lakh: below the 0.2 panic limit
            json!("low"),          // 1.2 lakh: low, not critical
            Value::Null,           // 7,500 cells/cumm: in range
            json!("critical_high"),
            Value::Null, // a unit that is not a count is not judged at all
        ]
    );
    // Only the judged in-range values are autoverified; the incomparable one
    // waits for a human.
    let auto: Vec<bool> = results
        .as_array()
        .expect("results array")
        .iter()
        .map(|r| r["is_auto_validated"].as_bool().unwrap_or(false))
        .collect();
    assert_eq!(auto, vec![true, false, false, true, false, false]);
}
