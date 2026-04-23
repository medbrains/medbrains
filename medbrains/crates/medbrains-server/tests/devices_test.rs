mod common;

use reqwest::StatusCode;

#[tokio::test]
async fn test_list_catalog() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app.get(&app.client, "/api/devices/catalog").await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    let adapters = body.as_array().expect("array");
    assert!(adapters.len() >= 20, "should have at least 20 seeded adapters");

    // Check roche cobas exists
    let has_cobas = adapters
        .iter()
        .any(|a| a["adapter_code"] == "roche_cobas_6000");
    assert!(has_cobas, "roche_cobas_6000 should be in catalog");
}

#[tokio::test]
async fn test_search_catalog() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app.get(&app.client, "/api/devices/catalog?q=sysmex").await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    let adapters = body.as_array().expect("array");
    assert!(!adapters.is_empty(), "sysmex search should return results");

    for a in adapters {
        let mfr = a["manufacturer"].as_str().unwrap_or("");
        let model = a["model"].as_str().unwrap_or("");
        assert!(
            mfr.to_lowercase().contains("sysmex") || model.to_lowercase().contains("sysmex"),
            "result should match sysmex"
        );
    }
}

#[tokio::test]
async fn test_preview_config() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .get(&app.client, "/api/devices/catalog/roche_cobas_6000/preview-config")
        .await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    let confidence = body["confidence"].as_f64().expect("confidence");
    assert!(confidence > 0.9, "verified adapter should have >0.9 confidence");
    assert!(body["field_mappings"].is_array());
    assert_eq!(body["default_port"], 2575);
}

#[tokio::test]
async fn test_create_device() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app.client
        .post(app.url("/api/devices/instances"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "adapter_code": "roche_cobas_6000",
            "name": "Test Analyzer",
            "code": "TEST-INT-001",
            "hostname": "10.0.0.100",
            "port": 2575
        }))
        .send()
        .await
        .expect("create device");

    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    assert_eq!(body["adapter_code"], "roche_cobas_6000");
    assert_eq!(body["name"], "Test Analyzer");
    assert_eq!(body["config_source"], "ai_auto");
    assert!(body["ai_confidence"].as_f64().unwrap_or(0.0) > 0.0);
}

#[tokio::test]
async fn test_ingest() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // First create a device
    let create_resp = app.client
        .post(app.url("/api/devices/instances"))
        .header("x-csrf-token", csrf.clone())
        .json(&serde_json::json!({
            "adapter_code": "roche_cobas_6000",
            "name": "Ingest Test Analyzer",
            "code": "TEST-INGEST-001",
        }))
        .send()
        .await
        .expect("create device");
    let device: serde_json::Value = create_resp.json().await.expect("json");
    let device_id = device["id"].as_str().expect("device id");

    // Send ingest data
    let ingest_resp = app.client
        .post(app.url("/api/device-ingest/lab"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "device_instance_id": device_id,
            "protocol": "hl7_v2",
            "parsed_payload": {"message_type": "ORU^R01", "fields": {"OBX.3": "WBC"}},
            "mapped_data": {
                "identifiers": {"sample_barcode": "S-NOEXIST"},
                "fields": {"OBX.3": "WBC", "OBX.5": "8.2"}
            },
            "processing_duration_ms": 5
        }))
        .send()
        .await
        .expect("ingest");

    assert_eq!(ingest_resp.status(), StatusCode::OK);

    let body: serde_json::Value = ingest_resp.json().await.expect("json");
    // No matching lab order → status should be "mapped" (stored but not routed)
    assert!(
        body["status"] == "mapped" || body["status"] == "delivered",
        "status should be mapped or delivered, got: {}",
        body["status"]
    );
    assert!(body["message_id"].is_string());
}
