//! Boundary filter — strip PHI from outbound events before they leave
//! the on-prem boundary in `hybrid` deploy mode.
//!
//! Used by:
//! - on-prem outbox worker, before dispatching events to the cloud
//!   event bus over the bridge tailnet
//! - on-prem audit forwarder, before shipping access_log entries to a
//!   cloud SIEM
//! - any handler that builds a payload destined for cloud egress
//!
//! Failure mode: **fail-closed**. If a payload references a field
//! whose classification is unknown, the filter refuses to release it.
//! Better to drop an event than leak Aadhaar.
//!
//! Why a runtime list and not a compile-time const: PHI columns shift
//! over time (new specialty modules add new fields) and we want to
//! drive the filter from the same `column_classification` table CI
//! lints against (`scripts/check_phi_redaction.py`). Until that
//! table lands, callers pass the list explicitly via `BoundaryFilter::new`.

use serde_json::Value;

/// Outcome of running the filter on a single payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilterDecision {
    /// Payload is safe to release as-is (no PHI fields touched).
    Pass,
    /// Payload was redacted; the cleaned `Value` is what may leave.
    /// The list contains the dotted paths of fields that were redacted.
    Redacted { redacted_paths: Vec<String> },
    /// Payload contains a field whose classification is unknown.
    /// Refuse to release. The unknown paths are reported.
    BlockUnknown { unknown_paths: Vec<String> },
}

/// Field classification tag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Classification {
    /// Personal health information — strip on cloud egress.
    Phi,
    /// Tenant metadata (counts, ids, status enums) — safe to send.
    Metadata,
    /// Non-PHI free-text or identifiers safe to forward.
    None,
}

#[derive(Debug, Clone, Default)]
pub struct BoundaryFilter {
    /// Field-name (case-insensitive) → classification.
    classifications: std::collections::HashMap<String, Classification>,
    /// If a field is not in `classifications`, treat it as PHI by
    /// default (fail-closed). Set false in dev to behave permissively.
    fail_closed: bool,
}

impl BoundaryFilter {
    pub fn new(fail_closed: bool) -> Self {
        Self {
            classifications: std::collections::HashMap::new(),
            fail_closed,
        }
    }

    pub fn with_classification(mut self, field: impl Into<String>, c: Classification) -> Self {
        self.classifications.insert(field.into().to_lowercase(), c);
        self
    }

    pub fn with_phi_fields<I, S>(mut self, fields: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        for f in fields {
            self.classifications.insert(f.into().to_lowercase(), Classification::Phi);
        }
        self
    }

    pub fn with_safe_fields<I, S>(mut self, fields: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        for f in fields {
            self.classifications.insert(f.into().to_lowercase(), Classification::None);
        }
        self
    }

    /// Default ruleset for a typical hospital event payload. PHI list
    /// covers the columns flagged by NABH IMS-10 + HIPAA + DPDP. Add
    /// site-specific entries via `with_phi_fields`.
    pub fn defaults() -> Self {
        let phi = [
            "aadhaar_number",
            "abha_id",
            "abha_address",
            "pan_number",
            "passport_number",
            "voter_id",
            "driving_license",
            "phone",
            "mobile",
            "email",
            "address",
            "address_line_1",
            "address_line_2",
            "pincode",
            "date_of_birth",
            "dob",
            "ssn",
            "mlc_details",
            "psychiatric_notes",
            "hiv_status",
            "tb_status",
            "genetic_test_result",
            "biometric_template",
            "guardian_name",
            "guardian_phone",
            "first_name",
            "last_name",
            "full_name",
            "name",
        ];
        let safe = [
            "id",
            "tenant_id",
            "patient_id",
            "encounter_id",
            "visit_id",
            "admission_id",
            "order_id",
            "invoice_id",
            "amount",
            "currency",
            "status",
            "created_at",
            "updated_at",
            "deleted_at",
            "completed_at",
            "department_id",
            "ward_id",
            "bed_id",
            "doctor_id",
            "user_id",
            "role",
            "event_type",
            "event_code",
            "correlation_id",
        ];
        Self::new(true)
            .with_phi_fields(phi)
            .with_safe_fields(safe)
    }

    /// Apply to a JSON payload. Returns the decision.
    pub fn apply(&self, payload: &Value) -> FilterDecision {
        let mut redacted: Vec<String> = Vec::new();
        let mut unknown: Vec<String> = Vec::new();
        let mut cloned = payload.clone();
        Self::walk(
            &mut cloned,
            "",
            &self.classifications,
            self.fail_closed,
            &mut redacted,
            &mut unknown,
        );

        if !unknown.is_empty() {
            return FilterDecision::BlockUnknown {
                unknown_paths: unknown,
            };
        }
        if redacted.is_empty() {
            FilterDecision::Pass
        } else {
            FilterDecision::Redacted {
                redacted_paths: redacted,
            }
        }
    }

    /// Apply and return the cleaned payload directly. Returns Err if
    /// any unknown classifications were encountered.
    pub fn redact(&self, payload: &Value) -> Result<Value, BoundaryFilterError> {
        let mut redacted: Vec<String> = Vec::new();
        let mut unknown: Vec<String> = Vec::new();
        let mut cloned = payload.clone();
        Self::walk(
            &mut cloned,
            "",
            &self.classifications,
            self.fail_closed,
            &mut redacted,
            &mut unknown,
        );
        if !unknown.is_empty() {
            return Err(BoundaryFilterError::UnknownFields(unknown));
        }
        Ok(cloned)
    }

    fn walk(
        value: &mut Value,
        path: &str,
        classifications: &std::collections::HashMap<String, Classification>,
        fail_closed: bool,
        redacted: &mut Vec<String>,
        unknown: &mut Vec<String>,
    ) {
        match value {
            Value::Object(map) => {
                let keys: Vec<String> = map.keys().cloned().collect();
                for key in keys {
                    let dotted = if path.is_empty() {
                        key.clone()
                    } else {
                        format!("{path}.{key}")
                    };
                    let class = classifications.get(&key.to_lowercase()).copied();
                    match class {
                        Some(Classification::Phi) => {
                            map.insert(key, Value::Null);
                            redacted.push(dotted);
                        }
                        Some(Classification::Metadata) | Some(Classification::None) => {
                            // Safe; recurse for nested objects
                            if let Some(child) = map.get_mut(&key) {
                                Self::walk(child, &dotted, classifications, fail_closed, redacted, unknown);
                            }
                        }
                        None => {
                            if fail_closed {
                                // Recurse into nested values to surface ALL unknowns
                                // before bailing — better diagnostics for the
                                // CI lint that drives the classification table.
                                unknown.push(dotted.clone());
                                if let Some(child) = map.get_mut(&key) {
                                    Self::walk(child, &dotted, classifications, fail_closed, redacted, unknown);
                                }
                            } else if let Some(child) = map.get_mut(&key) {
                                Self::walk(child, &dotted, classifications, fail_closed, redacted, unknown);
                            }
                        }
                    }
                }
            }
            Value::Array(arr) => {
                for (i, child) in arr.iter_mut().enumerate() {
                    let dotted = format!("{path}[{i}]");
                    Self::walk(child, &dotted, classifications, fail_closed, redacted, unknown);
                }
            }
            _ => {} // primitives — nothing to do
        }
    }
}

#[derive(Debug)]
pub enum BoundaryFilterError {
    UnknownFields(Vec<String>),
}

impl std::fmt::Display for BoundaryFilterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownFields(v) => {
                write!(
                    f,
                    "boundary filter blocked egress: {} unknown field(s): {}",
                    v.len(),
                    v.join(", ")
                )
            }
        }
    }
}

impl std::error::Error for BoundaryFilterError {}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn redacts_known_phi_field() {
        let f = BoundaryFilter::new(false)
            .with_phi_fields(["aadhaar_number"])
            .with_safe_fields(["patient_id"]);
        let payload = json!({
            "patient_id": "abc",
            "aadhaar_number": "1234-5678-9012",
        });
        match f.apply(&payload) {
            FilterDecision::Redacted { redacted_paths } => {
                assert_eq!(redacted_paths, vec!["aadhaar_number".to_string()]);
            }
            other => panic!("expected Redacted, got {other:?}"),
        }
    }

    #[test]
    fn redact_returns_clean_payload() {
        let f = BoundaryFilter::new(false)
            .with_phi_fields(["aadhaar_number"])
            .with_safe_fields(["patient_id"]);
        let payload = json!({"patient_id":"abc","aadhaar_number":"1234"});
        let cleaned = f.redact(&payload).unwrap();
        assert_eq!(cleaned["aadhaar_number"], Value::Null);
        assert_eq!(cleaned["patient_id"], "abc");
    }

    #[test]
    fn pass_through_when_no_phi_fields() {
        let f = BoundaryFilter::new(false).with_safe_fields(["status", "amount"]);
        let payload = json!({"status":"paid","amount":1000});
        assert_eq!(f.apply(&payload), FilterDecision::Pass);
    }

    #[test]
    fn fail_closed_blocks_unknown_field() {
        let f = BoundaryFilter::new(true).with_safe_fields(["patient_id"]);
        let payload = json!({"patient_id":"abc","mystery_field":"surprise"});
        match f.apply(&payload) {
            FilterDecision::BlockUnknown { unknown_paths } => {
                assert!(unknown_paths.iter().any(|p| p == "mystery_field"));
            }
            other => panic!("expected BlockUnknown, got {other:?}"),
        }
    }

    #[test]
    fn redacts_nested_phi() {
        let f = BoundaryFilter::new(false)
            .with_phi_fields(["aadhaar_number", "name"])
            .with_safe_fields(["patient_id", "demographics"]);
        let payload = json!({
            "patient_id":"x",
            "demographics":{
                "name":"Aravind",
                "aadhaar_number":"1234"
            }
        });
        let cleaned = f.redact(&payload).unwrap();
        assert_eq!(cleaned["demographics"]["name"], Value::Null);
        assert_eq!(cleaned["demographics"]["aadhaar_number"], Value::Null);
        assert_eq!(cleaned["patient_id"], "x");
    }

    #[test]
    fn redacts_inside_arrays() {
        let f = BoundaryFilter::new(false)
            .with_phi_fields(["phone"])
            .with_safe_fields(["contacts"]);
        let payload = json!({
            "contacts":[
                {"phone":"+91-1"},
                {"phone":"+91-2"}
            ]
        });
        let cleaned = f.redact(&payload).unwrap();
        assert_eq!(cleaned["contacts"][0]["phone"], Value::Null);
        assert_eq!(cleaned["contacts"][1]["phone"], Value::Null);
    }

    #[test]
    fn defaults_redact_aadhaar() {
        let f = BoundaryFilter::defaults();
        let payload = json!({
            "id": "abc",
            "tenant_id": "t1",
            "aadhaar_number": "1234",
            "status": "active"
        });
        let cleaned = f.redact(&payload).unwrap();
        assert_eq!(cleaned["aadhaar_number"], Value::Null);
        assert_eq!(cleaned["id"], "abc");
        assert_eq!(cleaned["status"], "active");
    }

    #[test]
    fn defaults_block_unknown_when_fail_closed() {
        let f = BoundaryFilter::defaults();
        let payload = json!({
            "id":"x",
            "totally_new_field":"something"
        });
        let err = f.redact(&payload).unwrap_err();
        match err {
            BoundaryFilterError::UnknownFields(paths) => {
                assert!(paths.iter().any(|p| p == "totally_new_field"));
            }
        }
    }

    #[test]
    fn case_insensitive_field_match() {
        let f = BoundaryFilter::new(false).with_phi_fields(["Aadhaar_Number"]);
        let payload = json!({"AADHAAR_NUMBER":"1234"});
        let cleaned = f.redact(&payload).unwrap();
        assert_eq!(cleaned["AADHAAR_NUMBER"], Value::Null);
    }
}
