//! FHIR `Bundle` — a wrapper used to ship multiple resources in one
//! transaction. NHCX expects a `transaction` Bundle for a claim
//! submission with the Patient + Coverage + Encounter + Claim
//! together so the receiver doesn't have to make four API calls to
//! resolve the references.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Bundle {
    #[serde(rename = "resourceType")]
    pub resource_type: BundleResourceType,

    pub r#type: BundleType,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entry: Vec<BundleEntry>,

    pub timestamp: chrono::DateTime<chrono::Utc>,

    /// `Bundle.id`. Reuse the outbox `event_id` so the receiver can
    /// dedup retries naturally.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum BundleResourceType {
    Bundle,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BundleType {
    Document,
    Message,
    Transaction,
    TransactionResponse,
    Batch,
    BatchResponse,
    History,
    Searchset,
    Collection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BundleEntry {
    /// `urn:uuid:...` form to identify the resource within the
    /// bundle so other entries can reference it by that URI.
    #[serde(rename = "fullUrl")]
    pub full_url: String,
    pub resource: serde_json::Value,
}

impl Bundle {
    pub fn transaction(id: impl Into<String>) -> Self {
        Self {
            resource_type: BundleResourceType::Bundle,
            r#type: BundleType::Transaction,
            entry: vec![],
            timestamp: chrono::Utc::now(),
            id: Some(id.into()),
        }
    }

    pub fn add<T: serde::Serialize>(&mut self, full_url: impl Into<String>, resource: &T) -> Result<&mut Self, serde_json::Error> {
        self.entry.push(BundleEntry {
            full_url: full_url.into(),
            resource: serde_json::to_value(resource)?,
        });
        Ok(self)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::Patient;

    #[test]
    fn transaction_bundle_serializes() {
        let mut bundle = Bundle::transaction("txn-1");
        let patient = Patient::new("p1").with_health_id("12-3456-7890-1234");
        bundle.add("urn:uuid:p1", &patient).unwrap();
        let json = serde_json::to_value(&bundle).unwrap();
        assert_eq!(json["resourceType"], "Bundle");
        assert_eq!(json["type"], "transaction");
        assert_eq!(json["entry"][0]["fullUrl"], "urn:uuid:p1");
        assert_eq!(json["entry"][0]["resource"]["resourceType"], "Patient");
    }
}
