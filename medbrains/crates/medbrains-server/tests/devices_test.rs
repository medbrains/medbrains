use crate::common;

use reqwest::StatusCode;
use uuid::Uuid;

/// A verified HL7 lab analyzer from the seeded catalog (migration 0950).
const LAB_ADAPTER: &str = "mindray_bs240";

#[tokio::test]
async fn test_list_catalog() {
    let app = common::spawn_app().await;
    app.login_admin().await;

    let resp = app.get(&app.client, "/api/devices/catalog").await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    let adapters = body.as_array().expect("array");
    assert!(
        adapters.len() >= 20,
        "should have at least 20 seeded adapters"
    );

    let has_lab_adapter = adapters.iter().any(|a| a["adapter_code"] == LAB_ADAPTER);
    assert!(has_lab_adapter, "{LAB_ADAPTER} should be in catalog");
}

#[tokio::test]
async fn test_search_catalog() {
    let app = common::spawn_app().await;
    app.login_admin().await;

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
    app.login_admin().await;

    let resp = app
        .get(
            &app.client,
            &format!("/api/devices/catalog/{LAB_ADAPTER}/preview-config"),
        )
        .await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    let confidence = body["confidence"].as_f64().expect("confidence");
    assert!(
        confidence > 0.9,
        "verified adapter should have >0.9 confidence"
    );
    assert!(body["field_mappings"].is_array());
    assert_eq!(body["default_port"], 5100, "the catalog's port for {LAB_ADAPTER}");
}

#[tokio::test]
async fn test_create_device() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .client
        .post(app.url("/api/devices/instances"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "adapter_code": LAB_ADAPTER,
            "name": "Test Analyzer",
            "code": format!("TEST-INT-{}", Uuid::new_v4().simple()),
            "hostname": "10.0.0.100",
            "port": 2575
        }))
        .send()
        .await
        .expect("create device");

    assert_eq!(resp.status(), StatusCode::OK);

    let body: serde_json::Value = resp.json().await.expect("json");
    assert_eq!(body["adapter_code"], LAB_ADAPTER);
    assert_eq!(body["name"], "Test Analyzer");
    assert_eq!(body["config_source"], "ai_auto");
    assert!(body["ai_confidence"].as_f64().unwrap_or(0.0) > 0.0);
}

#[tokio::test]
async fn test_ingest() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // First create a device
    let create_resp = app
        .client
        .post(app.url("/api/devices/instances"))
        .header("x-csrf-token", csrf.clone())
        .json(&serde_json::json!({
            "adapter_code": LAB_ADAPTER,
            "name": "Ingest Test Analyzer",
            "code": format!("TEST-INGEST-{}", Uuid::new_v4().simple()),
        }))
        .send()
        .await
        .expect("create device");
    let device: serde_json::Value = create_resp.json().await.expect("json");
    let device_id = device["id"].as_str().expect("device id");

    // Send ingest data
    let ingest_resp = app
        .client
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

#[tokio::test]
async fn test_heartbeat_rejects_wrong_agent_key() {
    let app = common::spawn_app().await;

    let reg_a = app
        .post_json(
            &app.client,
            "/api/bridge/register",
            &serde_json::json!({
                "agent_key": "key-tenant-a",
                "name": "agent-a",
                "capabilities": ["hl7_v2"],
                "deployment_mode": "on_premise",
            }),
        )
        .await;
    assert_eq!(reg_a.status(), StatusCode::OK);
    let agent_a: serde_json::Value = reg_a.json().await.expect("json");
    let agent_a_id = agent_a["agent_id"].as_str().expect("agent_id");

    // Another agent's key must not be able to update agent A's row.
    let hijack = app
        .post_json(
            &app.client,
            "/api/bridge/heartbeat",
            &serde_json::json!({
                "agent_id": agent_a_id,
                "agent_key": "key-tenant-b",
                "devices_connected": 99,
                "buffer_depth": 0,
            }),
        )
        .await;
    assert_eq!(hijack.status(), StatusCode::UNAUTHORIZED);

    let legit = app
        .post_json(
            &app.client,
            "/api/bridge/heartbeat",
            &serde_json::json!({
                "agent_id": agent_a_id,
                "agent_key": "key-tenant-a",
                "devices_connected": 1,
                "buffer_depth": 0,
            }),
        )
        .await;
    assert_eq!(legit.status(), StatusCode::OK);
}
