//! FHIR `Claim` and `ClaimResponse`.
//! <https://www.hl7.org/fhir/R4/claim.html>
//! <https://www.hl7.org/fhir/R4/claimresponse.html>
//!
//! These are the resources NHCX exchanges. Submitter is the
//! hospital (HIP); responder is the payer / TPA. We model the
//! intersection NHCX requires — full FHIR R4 surfaces beyond what
//! NHCX specifies are deferred until they're needed.

use serde::{Deserialize, Serialize};

use crate::common::{CodeableConcept, Identifier, Money, Period, Reference};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Claim {
    #[serde(rename = "resourceType")]
    pub resource_type: ClaimType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub identifier: Vec<Identifier>,

    /// `active` | `cancelled` | `draft` | `entered-in-error`.
    pub status: String,

    /// `claim` | `preauthorization` | `predetermination`.
    pub r#use: String,

    pub r#type: CodeableConcept,
    pub patient: Reference,
    pub created: chrono::DateTime<chrono::Utc>,

    /// Provider (hospital) — Organization or Practitioner reference.
    pub provider: Reference,

    /// Coverage information — required by NHCX.
    pub insurance: Vec<ClaimInsurance>,

    pub items: Vec<ClaimItem>,

    pub total: Money,

    #[serde(skip_serializing_if = "Option::is_none", rename = "billablePeriod")]
    pub billable_period: Option<Period>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ClaimType {
    Claim,
}

impl Default for ClaimType {
    fn default() -> Self {
        Self::Claim
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimInsurance {
    pub sequence: i32,
    pub focal: bool,
    pub coverage: Reference,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaimItem {
    pub sequence: i32,
    #[serde(rename = "productOrService")]
    pub product_or_service: CodeableConcept,
    #[serde(skip_serializing_if = "Option::is_none", rename = "unitPrice")]
    pub unit_price: Option<Money>,
    pub quantity: i32,
    pub net: Money,
    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "encounter")]
    pub encounter: Vec<Reference>,
}

impl ClaimItem {
    pub fn line(
        sequence: i32,
        service_code: CodeableConcept,
        quantity: i32,
        unit_price: Money,
    ) -> Self {
        let net = Money {
            value: unit_price.value * f64::from(quantity),
            currency: unit_price.currency.clone(),
        };
        Self {
            sequence,
            product_or_service: service_code,
            unit_price: Some(unit_price),
            quantity,
            net,
            encounter: vec![],
        }
    }
}

impl Claim {
    pub fn institutional(
        id: impl Into<String>,
        patient_id: impl AsRef<str>,
        provider_org_id: impl AsRef<str>,
        coverage_id: impl AsRef<str>,
    ) -> Self {
        let now = chrono::Utc::now();
        Self {
            resource_type: ClaimType::Claim,
            id: Some(id.into()),
            identifier: vec![],
            status: "active".to_owned(),
            r#use: "claim".to_owned(),
            r#type: CodeableConcept::from_coding(crate::common::Coding::new(
                "http://terminology.hl7.org/CodeSystem/claim-type",
                "institutional",
            )),
            patient: Reference::to_resource("Patient", patient_id.as_ref()),
            created: now,
            provider: Reference::to_resource("Organization", provider_org_id.as_ref()),
            insurance: vec![ClaimInsurance {
                sequence: 1,
                focal: true,
                coverage: Reference::to_resource("Coverage", coverage_id.as_ref()),
            }],
            items: vec![],
            total: Money::inr(0.0),
            billable_period: None,
        }
    }

    pub fn add_item(&mut self, item: ClaimItem) -> &mut Self {
        self.total.value += item.net.value;
        self.items.push(item);
        self
    }
}

// ── ClaimResponse ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaimResponse {
    #[serde(rename = "resourceType")]
    pub resource_type: ClaimResponseType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    pub status: String,
    pub r#type: CodeableConcept,
    pub r#use: String,
    pub patient: Reference,
    pub created: chrono::DateTime<chrono::Utc>,
    pub insurer: Reference,
    pub request: Reference,

    /// `queued` | `complete` | `error` | `partial`.
    pub outcome: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub disposition: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "preAuthRef")]
    pub pre_auth_ref: Vec<String>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "payment")]
    pub payment: Option<ClaimResponsePayment>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ClaimResponseType {
    ClaimResponse,
}

impl Default for ClaimResponseType {
    fn default() -> Self {
        Self::ClaimResponse
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClaimResponsePayment {
    pub amount: Money,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::NaiveDate>,
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::common::Coding;

    fn cpt(code: &str, display: &str) -> CodeableConcept {
        CodeableConcept::from_coding(Coding {
            system: Some("http://www.ama-assn.org/go/cpt".to_owned()),
            code: Some(code.to_owned()),
            display: Some(display.to_owned()),
        })
    }

    #[test]
    fn claim_total_aggregates_items() {
        let mut claim = Claim::institutional("c1", "p1", "h1", "cov1");
        claim.add_item(ClaimItem::line(1, cpt("99213", "OPD visit"), 1, Money::inr(500.0)));
        claim.add_item(ClaimItem::line(2, cpt("85025", "CBC"), 2, Money::inr(150.0)));
        // 500 + (150 * 2) = 800
        assert!((claim.total.value - 800.0).abs() < f64::EPSILON);
        assert_eq!(claim.items.len(), 2);
        assert_eq!(claim.insurance.len(), 1);
        assert!(claim.insurance[0].focal);
    }

    #[test]
    fn claim_serializes_with_required_nhcx_fields() {
        let mut claim = Claim::institutional("c1", "p1", "h1", "cov1");
        claim.add_item(ClaimItem::line(1, cpt("99213", "OPD visit"), 1, Money::inr(500.0)));
        let json = serde_json::to_value(&claim).unwrap();
        assert_eq!(json["resourceType"], "Claim");
        assert_eq!(json["status"], "active");
        assert_eq!(json["use"], "claim");
        assert_eq!(json["type"]["coding"][0]["code"], "institutional");
        assert_eq!(json["patient"]["reference"], "Patient/p1");
        assert_eq!(json["insurance"][0]["focal"], true);
        assert_eq!(json["items"][0]["productOrService"]["coding"][0]["code"], "99213");
        assert!((json["total"]["value"].as_f64().unwrap() - 500.0).abs() < f64::EPSILON);
        assert_eq!(json["total"]["currency"], "INR");
    }

    #[test]
    fn claim_response_round_trip() {
        let resp = ClaimResponse {
            resource_type: ClaimResponseType::ClaimResponse,
            id: Some("cr-1".into()),
            status: "active".into(),
            r#type: cpt("institutional", "Institutional"),
            r#use: "claim".into(),
            patient: Reference::to_resource("Patient", "p1"),
            created: chrono::Utc::now(),
            insurer: Reference::to_resource("Organization", "payer-1"),
            request: Reference::to_resource("Claim", "c1"),
            outcome: "complete".into(),
            disposition: Some("Approved in full".into()),
            pre_auth_ref: vec!["PA-100".into()],
            payment: Some(ClaimResponsePayment {
                amount: Money::inr(500.0),
                date: chrono::NaiveDate::from_ymd_opt(2026, 5, 1),
            }),
        };
        let json = serde_json::to_string(&resp).unwrap();
        let back: ClaimResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(back, resp);
    }
}
