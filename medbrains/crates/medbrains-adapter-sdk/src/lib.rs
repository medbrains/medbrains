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

// ═══════════════════════════════════════════════════════════════
// ── HL7 v2 Utilities (reusable across HL7 adapters) ──────────
// ═══════════════════════════════════════════════════════════════

pub mod hl7 {
    use super::*;

    /// Parse a raw HL7 v2 message into segments.
    /// Handles both \r and \r\n as segment terminators.
    pub fn parse_segments(raw: &str) -> Vec<MessageSegment> {
        let separator = if raw.len() > 3 { &raw[3..4] } else { "|" };

        raw.split(|c| c == '\r' || c == '\n')
            .filter(|line| line.len() >= 3)
            .map(|line| {
                let parts: Vec<&str> = line.split(separator).collect();
                let seg_type = parts.first().unwrap_or(&"???").to_string();
                let mut fields = HashMap::new();

                // MSH is special — field 1 is the separator itself
                let offset = if seg_type == "MSH" { 1 } else { 0 };

                for (i, part) in parts.iter().enumerate().skip(1) {
                    let key = format!("{seg_type}.{}", i + offset);
                    fields.insert(key, serde_json::Value::String(part.to_string()));
                }

                MessageSegment { segment_type: seg_type, fields }
            })
            .collect()
    }

    /// Extract a field value from parsed segments.
    /// Path format: "PID.3" (segment type + field index).
    pub fn get_field(segments: &[MessageSegment], path: &str) -> Option<String> {
        let parts: Vec<&str> = path.splitn(2, '.').collect();
        if parts.len() != 2 { return None; }

        let seg_type = parts[0];
        let field_key = path;

        segments.iter()
            .find(|s| s.segment_type == seg_type)
            .and_then(|s| s.fields.get(field_key))
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned())
    }

    /// Extract all fields from all segments into a flat HashMap.
    pub fn flatten_fields(segments: &[MessageSegment]) -> HashMap<String, serde_json::Value> {
        let mut result = HashMap::new();
        for seg in segments {
            for (key, val) in &seg.fields {
                result.insert(key.clone(), val.clone());
            }
        }
        result
    }

    /// Generate an HL7 ACK message for a received message.
    pub fn generate_ack(message_id: &str, ack_code: &str) -> String {
        let now = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
        format!(
            "MSH|^~\\&|MEDBRAINS|MEDBRAINS|DEVICE|DEVICE|{now}||ACK|{message_id}|P|2.5\r\
             MSA|{ack_code}|{message_id}\r"
        )
    }

    /// MLLP framing: wrap message in start/end bytes.
    /// Start: 0x0B, End: 0x1C 0x0D
    pub fn mllp_wrap(message: &str) -> Vec<u8> {
        let mut buf = Vec::with_capacity(message.len() + 3);
        buf.push(0x0B); // VT (start)
        buf.extend_from_slice(message.as_bytes());
        buf.push(0x1C); // FS (end block)
        buf.push(0x0D); // CR
        buf
    }

    /// MLLP unwrap: extract message from MLLP frame.
    /// Returns None if framing is invalid.
    pub fn mllp_unwrap(data: &[u8]) -> Option<String> {
        if data.len() < 3 { return None; }
        if data[0] != 0x0B { return None; }

        // Find end marker (0x1C)
        let end = data.iter().position(|&b| b == 0x1C)?;
        let message_bytes = &data[1..end];

        String::from_utf8(message_bytes.to_vec()).ok()
    }
}

// Re-export chrono for adapters
pub use chrono;

// ═══════════════════════════════════════════════════════════════
// ── Tests ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── HL7 Segment Parsing ──

    #[test]
    fn parse_segments_basic_oru() {
        let msg = "MSH|^~\\&|COBAS|LAB|MEDBRAINS|HMS|20260422||ORU^R01|MSG001|P|2.5\rPID|||PT-342||Kumar^Rajesh\rOBR|||S-2026-001||CBC\rOBX||NM|WBC||8.2|10^3/uL|4.0-11.0|N";
        let segs = hl7::parse_segments(msg);

        assert_eq!(segs.len(), 4);
        assert_eq!(segs[0].segment_type, "MSH");
        assert_eq!(segs[1].segment_type, "PID");
        assert_eq!(segs[2].segment_type, "OBR");
        assert_eq!(segs[3].segment_type, "OBX");
    }

    #[test]
    fn parse_segments_crlf_terminators() {
        let msg = "MSH|^~\\&|DEV|LAB\r\nPID|||PT-100\r\nOBX||NM|HGB||14.2";
        let segs = hl7::parse_segments(msg);
        assert_eq!(segs.len(), 3);
    }

    #[test]
    fn parse_segments_empty_message() {
        let segs = hl7::parse_segments("");
        assert!(segs.is_empty());
    }

    #[test]
    fn parse_segments_msh_field_offset() {
        // MSH fields start at 1 (field 1 = separator), so MSH.9 = message type
        let msg = "MSH|^~\\&|SEND|FAC|RECV|FAC|20260422||ORU^R01|MSG001|P|2.5";
        let segs = hl7::parse_segments(msg);
        assert_eq!(segs[0].segment_type, "MSH");

        // MSH.9 should be message type (ORU^R01)
        let msg_type = segs[0].fields.get("MSH.9");
        assert!(msg_type.is_some());
        assert_eq!(msg_type.unwrap(), "ORU^R01");
    }

    // ── Field Extraction ──

    #[test]
    fn get_field_existing() {
        let msg = "MSH|^~\\&|DEV||RECV\rPID|||PT-342||Kumar^Rajesh\rOBX||NM|WBC||8.2";
        let segs = hl7::parse_segments(msg);

        assert_eq!(hl7::get_field(&segs, "PID.3"), Some("PT-342".to_owned()));
        assert_eq!(hl7::get_field(&segs, "OBX.5"), Some("8.2".to_owned()));
    }

    #[test]
    fn get_field_missing_segment() {
        let msg = "MSH|^~\\&|DEV\rPID|||PT-100";
        let segs = hl7::parse_segments(msg);

        assert_eq!(hl7::get_field(&segs, "OBR.3"), None);
    }

    #[test]
    fn get_field_missing_index() {
        let msg = "MSH|^~\\&\rPID|||PT-100";
        let segs = hl7::parse_segments(msg);

        assert_eq!(hl7::get_field(&segs, "PID.99"), None);
    }

    #[test]
    fn get_field_invalid_path() {
        let segs = hl7::parse_segments("MSH|^~\\&");
        assert_eq!(hl7::get_field(&segs, "NOPE"), None);
    }

    // ── Flatten Fields ──

    #[test]
    fn flatten_fields_merges_all_segments() {
        let msg = "MSH|^~\\&|DEV\rPID|||PT-342\rOBX||NM|WBC||8.2";
        let segs = hl7::parse_segments(msg);
        let flat = hl7::flatten_fields(&segs);

        assert!(flat.contains_key("PID.3"));
        assert!(flat.contains_key("OBX.5"));
        assert!(flat.contains_key("MSH.2"));
    }

    // ── MLLP Framing ──

    #[test]
    fn mllp_wrap_adds_framing() {
        let msg = "MSH|test";
        let wrapped = hl7::mllp_wrap(msg);

        assert_eq!(wrapped[0], 0x0B); // VT start
        assert_eq!(wrapped[wrapped.len() - 2], 0x1C); // FS end
        assert_eq!(wrapped[wrapped.len() - 1], 0x0D); // CR
        assert_eq!(&wrapped[1..wrapped.len() - 2], msg.as_bytes());
    }

    #[test]
    fn mllp_unwrap_extracts_message() {
        let original = "MSH|^~\\&|TEST\rPID|||PT-001";
        let wrapped = hl7::mllp_wrap(original);
        let unwrapped = hl7::mllp_unwrap(&wrapped);

        assert_eq!(unwrapped, Some(original.to_owned()));
    }

    #[test]
    fn mllp_unwrap_invalid_no_start() {
        let bad = b"MSH|test\x1C\x0D";
        assert_eq!(hl7::mllp_unwrap(bad), None);
    }

    #[test]
    fn mllp_unwrap_too_short() {
        assert_eq!(hl7::mllp_unwrap(&[0x0B, 0x1C]), None);
    }

    #[test]
    fn mllp_roundtrip() {
        let messages = vec![
            "MSH|^~\\&|COBAS|LAB|MB|HMS|20260422||ORU^R01|1|P|2.5\rPID|||PT-001\rOBX||NM|GLU||126|mg/dL",
            "MSH|^~\\&|SYSMEX|HEM|MB|HMS|20260422||ORU^R01|2|P|2.5",
            "",
        ];
        for msg in &messages {
            if msg.is_empty() {
                continue;
            }
            let wrapped = hl7::mllp_wrap(msg);
            let unwrapped = hl7::mllp_unwrap(&wrapped);
            assert_eq!(unwrapped.as_deref(), Some(*msg));
        }
    }

    // ── ACK Generation ──

    #[test]
    fn generate_ack_format() {
        let ack = hl7::generate_ack("MSG001", "AA");
        assert!(ack.contains("MSH|"));
        assert!(ack.contains("MSA|AA|MSG001"));
        assert!(ack.contains("ACK|MSG001"));
    }

    #[test]
    fn generate_ack_nak() {
        let nak = hl7::generate_ack("MSG002", "AE");
        assert!(nak.contains("MSA|AE|MSG002"));
    }

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
