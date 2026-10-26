//! MedBrains Adapter SDK
//!
//! Build WASM adapter plugins for medical devices.
//! Each adapter handles one device model's protocol parsing and field mapping.
//!
//! # Usage
//! ```toml
//! [dependencies]
//! medbrains-adapter-sdk = { path = "../medbrains-adapter-sdk" }
//! ```
//!
//! Build for WASM:
//! ```sh
//! cargo build --target wasm32-wasip1 --release
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ═══════════════════════════════════════════════════════════════
// ── Adapter Manifest (exported once at load time) ────────────
// ═══════════════════════════════════════════════════════════════

/// Metadata baked into every adapter — tells the bridge what this adapter does.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterManifest {
    pub adapter_code: String,
    pub adapter_version: String,
    pub sdk_version: String,
    pub manufacturer: String,
    pub manufacturer_code: String,
    pub model: String,
    pub model_code: String,
    pub device_category: String,
    pub protocol: String,
    pub transport: String,
    pub data_direction: String,
    pub default_port: Option<u16>,
    pub default_baud_rate: Option<u32>,
    pub default_config: serde_json::Value,
    pub field_mappings: Vec<FieldMapping>,
    pub known_quirks: Vec<KnownQuirk>,
}

// ═══════════════════════════════════════════════════════════════
// ── Field Mapping ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

/// Maps a device protocol field to a MedBrains entity field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMapping {
    /// Path in device message (e.g., "OBX.5", "PID.3", "PatientID")
    pub device_field: String,
    /// Target in MedBrains (e.g., "lab_results.value", "vitals.heart_rate")
    pub target: String,
    /// Data type hint
    pub data_type: FieldType,
    /// Optional context (e.g., "heart_rate" to disambiguate multiple OBX.5 fields)
    pub context: Option<String>,
    /// Is this field required?
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FieldType {
    String,
    Numeric,
    Integer,
    Boolean,
    DateTime,
    Binary,
}

// ═══════════════════════════════════════════════════════════════
// ── Known Quirks ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

/// A known device quirk with an optional auto-fix.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownQuirk {
    pub id: String,
    pub description: String,
    pub auto_fix: bool,
    pub config_override: Option<serde_json::Value>,
    pub affected_firmware: Option<Vec<String>>,
    pub fixed_in_firmware: Option<String>,
}

// ═══════════════════════════════════════════════════════════════
// ── Parsed Message (output of adapter.parse()) ───────────────
// ═══════════════════════════════════════════════════════════════

/// A parsed device message — protocol-agnostic structured representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedMessage {
    /// Message type identifier (e.g., "ORU^R01" for HL7 results, "C-STORE" for DICOM)
    pub message_type: String,
    /// Unique message ID from the device (MSH.10 in HL7, MessageID in DICOM)
    pub message_id: Option<String>,
    /// Timestamp from the device message
    pub timestamp: Option<String>,
    /// All extracted fields as key-value pairs
    pub fields: HashMap<String, serde_json::Value>,
    /// Structured segments (for multi-segment protocols like HL7)
    pub segments: Vec<MessageSegment>,
    /// Raw text representation (for debugging)
    pub raw_text: Option<String>,
}

/// A single segment from a structured protocol message (e.g., one HL7 segment).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSegment {
    /// Segment identifier (e.g., "MSH", "PID", "OBR", "OBX")
    pub segment_type: String,
    /// Fields within this segment, indexed by position (1-based like HL7)
    pub fields: HashMap<String, serde_json::Value>,
}

// ═══════════════════════════════════════════════════════════════
// ── Mapped Data (output of adapter.map_fields()) ─────────────
// ═══════════════════════════════════════════════════════════════

/// Data mapped to MedBrains schema, ready for ingest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MappedData {
    /// Which MedBrains module this data targets
    pub target_module: String,
    /// Which entity type to create/update
    pub target_entity: String,
    /// Identifiers extracted for record matching
    pub identifiers: MessageIdentifiers,
    /// The mapped field values
    pub data: serde_json::Value,
    /// Unmapped fields that the adapter couldn't place
    pub unmapped_fields: Vec<String>,
}

/// Identifiers extracted from the message for matching to existing records.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MessageIdentifiers {
    pub patient_id: Option<String>,
    pub uhid: Option<String>,
    pub order_id: Option<String>,
    pub sample_barcode: Option<String>,
    pub accession_number: Option<String>,
    pub encounter_id: Option<String>,
}

// ═══════════════════════════════════════════════════════════════
// ── Validation Result ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<String>,
    /// Critical values detected (e.g., potassium > 6.0)
    pub critical_values: Vec<CriticalValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub severity: ErrorSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalValue {
    pub field: String,
    pub value: String,
    pub normal_range: Option<String>,
    pub message: String,
}

// ═══════════════════════════════════════════════════════════════
// ── Adapter Error ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AdapterError {}

pub mod hl7;

// Re-export chrono for adapters
pub use chrono;

// ═══════════════════════════════════════════════════════════════
// ── Tests ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── Type Serialization ──

    #[test]
    fn field_mapping_serialization() {
        let mapping = FieldMapping {
            device_field: "OBX.5".to_owned(),
            target: "lab_results.value".to_owned(),
            data_type: FieldType::Numeric,
            context: None,
            required: true,
        };
        let json = serde_json::to_string(&mapping).unwrap();
        assert!(json.contains("OBX.5"));
        assert!(json.contains("numeric"));

        let parsed: FieldMapping = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.data_type, FieldType::Numeric);
    }

    #[test]
    fn adapter_manifest_serialization() {
        let manifest = AdapterManifest {
            adapter_code: "test_device".to_owned(),
            adapter_version: "1.0.0".to_owned(),
            sdk_version: "0.1.0".to_owned(),
            manufacturer: "Test Corp".to_owned(),
            manufacturer_code: "test".to_owned(),
            model: "Model X".to_owned(),
            model_code: "model_x".to_owned(),
            device_category: "lab_analyzer".to_owned(),
            protocol: "hl7_v2".to_owned(),
            transport: "tcp".to_owned(),
            data_direction: "producer".to_owned(),
            default_port: Some(2575),
            default_baud_rate: None,
            default_config: serde_json::json!({}),
            field_mappings: vec![],
            known_quirks: vec![],
        };
        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: AdapterManifest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.adapter_code, "test_device");
        assert_eq!(parsed.default_port, Some(2575));
    }

    #[test]
    fn validation_result_with_critical_values() {
        let result = ValidationResult {
            is_valid: true,
            errors: vec![],
            warnings: vec!["Value near upper limit".to_owned()],
            critical_values: vec![CriticalValue {
                field: "potassium".to_owned(),
                value: "6.2".to_owned(),
                normal_range: Some("3.5-5.0".to_owned()),
                message: "Critical high potassium".to_owned(),
            }],
        };
        assert!(!result.critical_values.is_empty());
        assert_eq!(result.critical_values[0].field, "potassium");
    }
}
