use serde::{Deserialize, Serialize};

use super::coding::CodeableConcept;
use super::reference::Reference;

/// FHIR R4 `Observation` (vitals, lab values).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub id: String,

    /// `registered` | `preliminary` | `final` | `amended` | `corrected` |
    /// `cancelled` | `entered-in-error` | `unknown`.
    pub status: String,

    /// Lab category, e.g. `vital-signs`, `laboratory`, `imaging`.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub category: Vec<CodeableConcept>,

    /// LOINC-coded what was measured.
    pub code: CodeableConcept,

    pub subject: Reference,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub encounter: Option<Reference>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "effectiveDateTime")]
    pub effective_date_time: Option<String>,

    /// Numeric value with unit. FHIR has many `value[x]` variants; we
    /// use `valueQuantity` for numeric and `valueString` for text.
    #[serde(skip_serializing_if = "Option::is_none", rename = "valueQuantity")]
    pub value_quantity: Option<Quantity>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "valueString")]
    pub value_string: Option<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default, rename = "interpretation")]
    pub interpretation: Vec<CodeableConcept>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quantity {
    pub value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    /// UCUM system: "http://unitsofmeasure.org"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}
