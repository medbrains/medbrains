//! FHIR `Patient` resource. <https://www.hl7.org/fhir/R4/patient.html>

use serde::{Deserialize, Serialize};

use crate::common::{Address, ContactPoint, HumanName, Identifier};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Patient {
    #[serde(rename = "resourceType")]
    pub resource_type: PatientType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub identifier: Vec<Identifier>,

    /// FHIR demands `name: Vec<HumanName>`. We leave it non-Option to
    /// surface omissions at compile time.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub name: Vec<HumanName>,

    /// `male` | `female` | `other` | `unknown` per FHIR
    /// AdministrativeGender code-system.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,

    /// FHIR `date` type — YYYY-MM-DD; we keep it as a NaiveDate
    /// string to avoid TZ-shift bugs on a date-only field.
    #[serde(skip_serializing_if = "Option::is_none", rename = "birthDate")]
    pub birth_date: Option<chrono::NaiveDate>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub telecom: Vec<ContactPoint>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub address: Vec<Address>,
}

/// Tagged-union discriminator. Exists so resources can never be
/// confused at deserialize time.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PatientType {
    Patient,
}

impl Default for PatientType {
    fn default() -> Self {
        Self::Patient
    }
}

impl Patient {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            resource_type: PatientType::Patient,
            id: Some(id.into()),
            identifier: vec![],
            name: vec![],
            gender: None,
            birth_date: None,
            telecom: vec![],
            address: vec![],
        }
    }

    pub fn with_full_name(mut self, given: impl Into<String>, family: impl Into<String>) -> Self {
        self.name.push(HumanName {
            r#use: Some("official".to_owned()),
            given: vec![given.into()],
            family: Some(family.into()),
            text: None,
        });
        self
    }

    pub fn with_health_id(mut self, abha: impl Into<String>) -> Self {
        self.identifier
            .push(Identifier::new("https://abdm.gov.in/health-id", abha));
        self
    }

    pub fn with_gender(mut self, gender: impl Into<String>) -> Self {
        self.gender = Some(gender.into());
        self
    }

    pub fn with_birth_date(mut self, dob: chrono::NaiveDate) -> Self {
        self.birth_date = Some(dob);
        self
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn serialized_patient_has_resource_type_field() {
        let p = Patient::new("abc")
            .with_full_name("Aditi", "Kumar")
            .with_health_id("12-3456-7890-1234")
            .with_gender("female")
            .with_birth_date(NaiveDate::from_ymd_opt(1990, 5, 1).unwrap());
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["resourceType"], "Patient");
        assert_eq!(json["id"], "abc");
        assert_eq!(json["birthDate"], "1990-05-01");
        assert_eq!(json["gender"], "female");
        assert_eq!(json["identifier"][0]["value"], "12-3456-7890-1234");
        assert_eq!(json["name"][0]["family"], "Kumar");
        assert_eq!(json["name"][0]["given"][0], "Aditi");
    }

    #[test]
    fn empty_arrays_are_omitted() {
        let p = Patient::new("abc");
        let json = serde_json::to_value(&p).unwrap();
        assert!(json.get("name").is_none(), "empty name array must omit");
        assert!(json.get("identifier").is_none());
    }

    #[test]
    fn round_trip() {
        let original = Patient::new("abc")
            .with_full_name("Test", "User")
            .with_health_id("11-1111-1111-1111");
        let json = serde_json::to_string(&original).unwrap();
        let back: Patient = serde_json::from_str(&json).unwrap();
        assert_eq!(back, original);
    }
}
