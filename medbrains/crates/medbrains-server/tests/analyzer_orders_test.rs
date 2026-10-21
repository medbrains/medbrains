//! Bidirectional analyzer flow (#227): a collected sample is on its
//! analyzer's worklist with what the analyzer needs to run it; once the
//! analyzer acknowledges it, it leaves the worklist and the send is on record;
//! a refusal keeps it offered; the analyzer's ASTM results come back onto the
//! order by barcode; another hospital's device cannot be fed.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_collected_sample_goes_to_its_analyzer_and_its_results_come_back() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let dept: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, department_id) \
         VALUES ($1, $2, 'Complete blood count', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CBC{tag}"))
    .bind(dept)
    .fetch_one(&app.db)
    .await
    .expect("test");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Lakshmi', 'Devi', 'female'::gender, '9000000227', '1980-03-09') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-AN-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let barcode = format!("SB{tag}");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, status, \
             sample_barcode, sample_type, collected_at) \
         VALUES ($1, $2, $3, $4, $5, 'sample_collected', $6, 'EDTA blood', now()) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test)
    .bind(admin)
    .bind(&barcode)
    .fetch_one(&app.db)
    .await
    .expect("order");
    let device: Uuid = sqlx::query_scalar(
        "INSERT INTO device_instances (tenant_id, adapter_code, name, code, department_id, hostname, port, status) \
         VALUES ($1, 'mindray_bs240', $2, $3, $4, '10.0.0.40', 5100, 'active') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("Analyzer {tag}"))
    .bind(format!("AN{tag}"))
    .bind(dept)
    .fetch_one(&app.db)
    .await
    .expect("device");

    let worklist = |app: &common::TestApp| {
        let url = app.url(&format!("/api/devices/instances/{device}/analyzer-orders"));
        let client = app.client.clone();
        async move {
            let res = client.get(url).send().await.expect("worklist");
            assert!(res.status().is_success(), "{}", res.status());
            res.json::<Value>().await.expect("worklist json")
        }
    };
    let ours = |list: &Value| {
        list["orders"]
            .as_array()
            .expect("orders")
            .iter()
            .find(|o| o["sample_barcode"] == json!(barcode))
            .cloned()
    };
    let report = |delivered: bool, error: Option<&str>| {
        app.client
            .post(app.url(&format!("/api/devices/instances/{device}/analyzer-orders/sent")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "sent": [{ "order_id": order, "control_id": "C1", "delivered": delivered, "error": error }] }))
            .send()
    };

    let list = worklist(&app).await;
    assert_eq!(list["analyzer"]["host"], "10.0.0.40");
    assert_eq!(list["analyzer"]["port"], 5100);
    let offered = ours(&list).expect("the collected sample is on the worklist");
    assert_eq!(offered["test_code"], json!(format!("CBC{tag}")));
    assert_eq!(offered["uhid"], json!(format!("UH-AN-{tag}")));
    assert_eq!(offered["date_of_birth"], "1980-03-09");
    assert_eq!(offered["gender"], "female");

    let res = report(false, Some("Unknown test")).await.expect("report");
    assert!(res.status().is_success());
    assert!(
        ours(&worklist(&app).await).is_some(),
        "a refusal is offered again"
    );
    let res = report(true, None).await.expect("report");
    assert_eq!(res.json::<Value>().await.expect("json")["recorded"], 1);
    assert!(
        ours(&worklist(&app).await).is_none(),
        "delivered: off the worklist"
    );

    let sent: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT direction, processing_status::text, error_message FROM device_messages \
          WHERE device_instance_id = $1 AND target_entity_id = $2 ORDER BY created_at",
    )
    .bind(device)
    .bind(order)
    .fetch_all(&app.db)
    .await
    .expect("messages");
    assert_eq!(
        sent,
        vec![
            (
                "outbound".into(),
                "failed".into(),
                Some("Unknown test".into())
            ),
            ("outbound".into(), "delivered".into(), None),
        ]
    );

    // The analyzer's run comes back, as the bridge's ASTM parser shapes it.
    let res = app
        .client
        .post(app.url("/api/device-ingest/lab"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "device_instance_id": device, "protocol": "astm",
            "parsed_payload": { "message_type": "ASTM" },
            "mapped_data": {
                "identifiers": { "sample_barcode": barcode },
                "results": [
                    { "test_code": "WBC", "value": "12.4", "unit": "10*3/uL", "abnormal_flag": "H" },
                    { "test_code": "HGB", "value": "13.1", "unit": "g/dL", "reference_range": "12.0-15.5" },
                ],
            },
        }))
        .send()
        .await
        .expect("ingest");
    assert!(res.status().is_success(), "{}", res.status());
    let results: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT parameter_name, value, flag::text FROM lab_results WHERE order_id = $1 ORDER BY parameter_name",
    )
    .bind(order)
    .fetch_all(&app.db)
    .await
    .expect("results");
    assert_eq!(results.len(), 2);
    assert_eq!(
        results[1],
        ("WBC".into(), "12.4".into(), Some("high".into()))
    );

    // A device that is not this hospital's cannot be fed.
    let res = app
        .client
        .post(app.url("/api/device-ingest/lab"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "device_instance_id": Uuid::new_v4(), "protocol": "astm",
                       "parsed_payload": {}, "mapped_data": {} }),
        )
        .send()
        .await
        .expect("ingest");
    assert_eq!(res.status(), 404);
}
