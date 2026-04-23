use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Device Categories ──────────────────────────────────────

/// All supported device categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceCategory {
    LabAnalyzer,
    LabHematology,
    LabChemistry,
    LabImmunoassay,
    LabCoagulation,
    LabUrinalysis,
    LabBloodGas,
    LabMicrobiology,
    PatientMonitor,
    Ventilator,
    InfusionPump,
    SyringePump,
    CtScanner,
    MriScanner,
    Xray,
    Ultrasound,
    Mammography,
    EcgMachine,
    Defibrillator,
    PulseOximeter,
    Glucometer,
    BloodBankAnalyzer,
    BloodGasAnalyzer,
    BarcodeScanner,
    RfidReader,
    LabelPrinter,
    WristbandPrinter,
    ColdChainSensor,
    EnvironmentSensor,
    WeighingScale,
    BiometricReader,
    AccessControl,
    PacsServer,
    RisServer,
    LisServer,
    Generic,
    Other,
}

/// Communication protocols supported by adapters
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceProtocol {
    Hl7V2,
    AstmE1381,
    Dicom,
    SerialRs232,
    RestJson,
    Mqtt,
    TcpRaw,
    FileDrop,
    UsbHid,
}

/// Transport layer
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceTransport {
    Tcp,
    Serial,
    Usb,
    Http,
    Mqtt,
    File,
}

/// Device instance lifecycle status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "device_instance_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeviceInstanceStatus {
    PendingSetup,
    Configuring,
    Testing,
    Active,
    Degraded,
    Disconnected,
    Maintenance,
    Decommissioned,
}

/// Device message processing status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "device_message_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DeviceMessageStatus {
    Received,
    Parsed,
    Mapped,
    Validated,
    Delivered,
    Failed,
    Rejected,
    DeadLetter,
}

// ── Adapter Catalog (global) ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceAdapterCatalogRow {
    pub id: Uuid,
    pub adapter_code: String,
    pub manufacturer: String,
    pub manufacturer_code: String,
    pub model: String,
    pub model_code: String,
    pub device_category: String,
    pub device_subcategory: Option<String>,
    pub data_direction: String,
    pub protocol: String,
    pub transport: String,
    pub default_port: Option<i32>,
    pub default_baud_rate: Option<i32>,
    pub default_config: serde_json::Value,
    pub field_mappings: serde_json::Value,
    pub data_transforms: serde_json::Value,
    pub qc_recommendations: serde_json::Value,
    pub known_quirks: serde_json::Value,
    pub supported_tests: serde_json::Value,
    pub adapter_version: String,
    pub sdk_version: String,
    pub wasm_hash: Option<String>,
    pub wasm_size_bytes: Option<i32>,
    pub is_verified: bool,
    pub contributed_by: String,
    pub documentation_url: Option<String>,
    pub is_active: bool,
}

// ── Device Instance (per-tenant) ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceInstanceRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub adapter_code: String,
    pub facility_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub name: String,
    pub code: String,
    pub serial_number: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<i32>,
    pub protocol_config: serde_json::Value,
    pub field_mappings: serde_json::Value,
    pub data_transforms: serde_json::Value,
    pub qc_config: serde_json::Value,
    pub ai_config_version: i32,
    pub ai_confidence: Option<f32>,
    pub human_overrides: serde_json::Value,
    pub config_source: String,
    pub status: DeviceInstanceStatus,
    pub last_heartbeat: Option<chrono::DateTime<chrono::Utc>>,
    pub last_message_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_error: Option<String>,
    pub error_count_24h: i32,
    pub message_count_24h: i32,
    pub bridge_agent_id: Option<Uuid>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ── Bridge Agent ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeAgentRow {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub name: String,
    pub deployment_mode: String,
    pub version: Option<String>,
    pub hostname: Option<String>,
    pub capabilities: Vec<String>,
    pub status: String,
    pub last_heartbeat: Option<chrono::DateTime<chrono::Utc>>,
    pub devices_connected: i32,
    pub buffer_depth: i32,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── Device Message ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceMessageRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub device_instance_id: Uuid,
    pub direction: String,
    pub protocol: String,
    pub parsed_payload: Option<serde_json::Value>,
    pub mapped_data: Option<serde_json::Value>,
    pub processing_status: DeviceMessageStatus,
    pub target_module: Option<String>,
    pub target_entity_id: Option<Uuid>,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub processing_duration_ms: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── Config History ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceConfigHistoryRow {
    pub id: Uuid,
    pub device_instance_id: Uuid,
    pub change_type: String,
    pub previous_config: serde_json::Value,
    pub new_config: serde_json::Value,
    pub changed_fields: Vec<String>,
    pub changed_by: Option<Uuid>,
    pub change_reason: Option<String>,
    pub ai_confidence: Option<f32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── Routing Rules ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DeviceRoutingRuleRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub device_instance_id: Option<Uuid>,
    pub adapter_code: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub target_module: String,
    pub match_strategy: String,
    pub match_field: String,
    pub target_entity: String,
    pub field_mappings: serde_json::Value,
    pub transform_rules: serde_json::Value,
    pub auto_verify: bool,
    pub notify_on_critical: bool,
    pub reject_duplicates: bool,
    pub trigger_pipeline: Option<Uuid>,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoutingRuleRequest {
    pub device_instance_id: Option<Uuid>,
    pub adapter_code: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub target_module: String,
    pub match_strategy: String,
    pub match_field: String,
    pub target_entity: String,
    pub field_mappings: Option<serde_json::Value>,
    pub transform_rules: Option<serde_json::Value>,
    pub auto_verify: Option<bool>,
    pub notify_on_critical: Option<bool>,
    pub reject_duplicates: Option<bool>,
    pub priority: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoutingRuleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub target_module: Option<String>,
    pub match_strategy: Option<String>,
    pub match_field: Option<String>,
    pub target_entity: Option<String>,
    pub field_mappings: Option<serde_json::Value>,
    pub transform_rules: Option<serde_json::Value>,
    pub auto_verify: Option<bool>,
    pub notify_on_critical: Option<bool>,
    pub reject_duplicates: Option<bool>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

// ── AI Config Generator ────────────────────────────────────

/// Result of auto-generating device config from adapter catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedDeviceConfig {
    pub protocol_config: serde_json::Value,
    pub field_mappings: serde_json::Value,
    pub data_transforms: serde_json::Value,
    pub qc_config: serde_json::Value,
    pub applied_quirks: Vec<String>,
    pub confidence: f32,
    pub warnings: Vec<String>,
    pub suggested_name: String,
    pub suggested_code: String,
    pub default_port: Option<i32>,
}

/// Generate device config from adapter catalog entry.
/// This is the "AI" — deterministic lookup + rule application.
pub fn generate_device_config(adapter: &DeviceAdapterCatalogRow, department_code: Option<&str>) -> GeneratedDeviceConfig {
    let mut protocol_config = adapter.default_config.clone();

    // Apply known quirks as protocol config overrides
    let mut applied_quirks = Vec::new();
    if let serde_json::Value::Array(quirks) = &adapter.known_quirks {
        for quirk in quirks {
            if quirk.get("auto_fix").and_then(serde_json::Value::as_bool).unwrap_or(false) {
                if let Some(config) = quirk.get("config") {
                    if let (serde_json::Value::Object(base), serde_json::Value::Object(patch)) =
                        (&mut protocol_config, config)
                    {
                        for (k, v) in patch {
                            base.insert(k.clone(), v.clone());
                        }
                    }
                }
                if let Some(id) = quirk.get("id").and_then(serde_json::Value::as_str) {
                    applied_quirks.push(id.to_owned());
                }
            }
        }
    }

    // Set default port in protocol config
    if let (Some(port), serde_json::Value::Object(cfg)) = (adapter.default_port, &mut protocol_config) {
        cfg.entry("port").or_insert(serde_json::Value::Number(port.into()));
    }

    // Confidence: verified adapters get 0.95, unverified 0.7
    let confidence = if adapter.is_verified { 0.95 } else { 0.7 };

    // Generate suggested name and code
    let dept_suffix = department_code.unwrap_or("GEN");
    let suggested_name = format!("{} {} - {}", adapter.manufacturer, adapter.model, dept_suffix);
    let suggested_code = format!("{}-{}-001", adapter.model_code.to_uppercase(), dept_suffix.to_uppercase());

    let mut warnings = Vec::new();
    if !adapter.is_verified {
        warnings.push("This adapter profile has not been verified by MedBrains. Review config carefully.".to_owned());
    }
    if adapter.known_quirks != serde_json::Value::Array(vec![]) {
        warnings.push(format!("{} known quirk(s) auto-applied.", applied_quirks.len()));
    }

    GeneratedDeviceConfig {
        protocol_config,
        field_mappings: adapter.field_mappings.clone(),
        data_transforms: adapter.data_transforms.clone(),
        qc_config: adapter.qc_recommendations.clone(),
        applied_quirks,
        confidence,
        warnings,
        suggested_name,
        suggested_code,
        default_port: adapter.default_port,
    }
}

// ── Request/Response types ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDeviceInstanceRequest {
    pub adapter_code: String,
    pub name: String,
    pub code: String,
    pub facility_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub serial_number: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<i32>,
    pub credentials: Option<serde_json::Value>,
    pub protocol_config: Option<serde_json::Value>,
    pub field_mappings: Option<serde_json::Value>,
    pub data_transforms: Option<serde_json::Value>,
    pub qc_config: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDeviceInstanceRequest {
    pub name: Option<String>,
    pub facility_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub serial_number: Option<String>,
    pub hostname: Option<String>,
    pub port: Option<i32>,
    pub credentials: Option<serde_json::Value>,
    pub protocol_config: Option<serde_json::Value>,
    pub field_mappings: Option<serde_json::Value>,
    pub data_transforms: Option<serde_json::Value>,
    pub qc_config: Option<serde_json::Value>,
    pub status: Option<DeviceInstanceStatus>,
    pub bridge_agent_id: Option<Uuid>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct BridgeRegisterRequest {
    pub agent_key: String,
    pub name: String,
    pub version: Option<String>,
    pub hostname: Option<String>,
    pub capabilities: Vec<String>,
    pub deployment_mode: String,
}

#[derive(Debug, Deserialize)]
pub struct BridgeHeartbeatRequest {
    pub agent_id: Uuid,
    pub devices_connected: i32,
    pub devices_errored: Option<i32>,
    pub messages_processed: Option<i64>,
    pub buffer_depth: i32,
    pub memory_usage_mb: Option<i32>,
    pub uptime_seconds: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceIngestRequest {
    pub device_instance_id: Uuid,
    pub protocol: String,
    pub parsed_payload: serde_json::Value,
    pub mapped_data: serde_json::Value,
    pub processing_duration_ms: Option<i32>,
}
