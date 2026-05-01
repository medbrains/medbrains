use serde::{Deserialize, Serialize};

use super::Resource;

/// FHIR R4 `Bundle` — used for batch reads, searchsets, and transaction
/// writes (NHCX claim payloads, ABDM HIE care contexts).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bundle {
    pub id: String,

    pub r#type: BundleType,

    pub timestamp: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u32>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub entry: Vec<BundleEntry>,
}

/// FHIR Bundle types we use:
///   - `searchset`: paginated read result
///   - `transaction`: atomic multi-resource write (ABDM, NHCX)
///   - `collection`: any grouping
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BundleType {
    Searchset,
    Transaction,
    Collection,
    Document,
    Message,
    History,
    #[serde(rename = "transaction-response")]
    TransactionResponse,
    #[serde(rename = "batch-response")]
    BatchResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleEntry {
    /// Full URL of the contained resource — typically the FHIR-relative
    /// `Patient/{id}` or absolute server URL.
    #[serde(skip_serializing_if = "Option::is_none", rename = "fullUrl")]
    pub full_url: Option<String>,

    pub resource: Resource,
}
