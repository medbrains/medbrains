//! FHIR `Coverage` resource. <https://www.hl7.org/fhir/R4/coverage.html>
//!
//! Used by NHCX to identify the patient's insurance policy on a claim.

use serde::{Deserialize, Serialize};

use crate::common::{Identifier, Period, Reference};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Coverage {
    #[serde(rename = "resourceType")]
    pub resource_type: CoverageType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    /// `active` | `cancelled` | `draft` | `entered-in-error`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub identifier: Vec<Identifier>,

    /// FHIR uses `subscriber` for the policy holder; we always set to
    /// the same Patient reference for individual policies.
    pub beneficiary: Reference,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<Period>,

    /// Reference to the payer Organization.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub payor: Vec<Reference>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CoverageType {
    Coverage,
}

impl Default for CoverageType {
    fn default() -> Self {
        Self::Coverage
    }
}

impl Coverage {
    pub fn active_for_patient(
        id: impl Into<String>,
        patient_id: impl AsRef<str>,
    ) -> Self {
        Self {
            resource_type: CoverageType::Coverage,
            id: Some(id.into()),
            status: "active".to_owned(),
            identifier: vec![],
            beneficiary: Reference::to_resource("Patient", patient_id.as_ref()),
            subscriber_id: None,
            period: None,
            payor: vec![],
        }
    }

    pub fn with_payor(mut self, organization_id: impl AsRef<str>) -> Self {
        self.payor
            .push(Reference::to_resource("Organization", organization_id.as_ref()));
        self
    }

    pub fn with_subscriber_id(mut self, sub_id: impl Into<String>) -> Self {
        self.subscriber_id = Some(sub_id.into());
        self
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn coverage_minimum_fields_serialize() {
        let c = Coverage::active_for_patient("cov-1", "pat-abc")
            .with_payor("org-payor-1")
            .with_subscriber_id("POL-100");
        let json = serde_json::to_value(&c).unwrap();
        assert_eq!(json["resourceType"], "Coverage");
        assert_eq!(json["status"], "active");
        assert_eq!(json["beneficiary"]["reference"], "Patient/pat-abc");
        assert_eq!(json["payor"][0]["reference"], "Organization/org-payor-1");
        assert_eq!(json["subscriber_id"], "POL-100");
    }
}
