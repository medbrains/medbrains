//! The HFR onboarding forms, in HFR's own field names (camelCase, as the
//! `v1.5/facility/*-information` calls take them), so a saved form is the
//! request body and the draft the screen resumes from.

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// HFR-009: ten facilities per page, never typed by the user.
const RESULTS_PER_PAGE: u32 = 10;

/// The search form (HFR-001…007). Either the facility ID, or the name with
/// ownership and state.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FacilitySearch {
    pub facility_id: String,
    pub facility_name: String,
    pub ownership_code: String,
    pub state_lgd_code: String,
    pub district_lgd_code: String,
    pub sub_district_lgd_code: String,
    pub pincode: String,
}

impl FacilitySearch {
    /// The request body, with `page` 1 and `resultsPerPage` 10 (HFR-008/009).
    #[must_use]
    pub fn body(&self) -> Value {
        json!({
            "facilityId": self.facility_id.trim(),
            "facilityName": self.facility_name.trim(),
            "ownershipCode": self.ownership_code,
            "stateLGDCode": self.state_lgd_code,
            "districtLGDCode": self.district_lgd_code,
            "subDistrictLGDCode": self.sub_district_lgd_code,
            "pincode": self.pincode.trim(),
            "page": 1,
            "resultsPerPage": RESULTS_PER_PAGE,
        })
    }
}

/// One facility HFR already lists.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct FacilityHit {
    pub facility_id: String,
    pub facility_name: Option<String>,
    pub facility_status: Option<String>,
    pub address: Option<String>,
}

/// One page of HFR search.
#[derive(Clone, Debug, Default, Serialize)]
pub struct SearchPage {
    pub facilities: Vec<FacilityHit>,
    pub total: u64,
}

impl SearchPage {
    /// Read HFR's `{ facilities: [...], totalFacilities }` answer.
    #[must_use]
    pub fn read(value: &Value) -> Self {
        let facilities: Vec<FacilityHit> = value
            .get("facilities")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .take(usize::try_from(RESULTS_PER_PAGE).unwrap_or(10))
                    .filter_map(|f| {
                        Some(FacilityHit {
                            facility_id: text(f, "facilityId")?,
                            facility_name: text(f, "facilityName"),
                            facility_status: text(f, "facilityStatus"),
                            address: text(f, "address"),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        let total = value
            .get("totalFacilities")
            .and_then(Value::as_u64)
            .unwrap_or(facilities.len() as u64);
        Self { facilities, total }
    }
}

/// Address block of basic information (HFR-011…019).
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddressDetails {
    pub country: String,
    #[serde(rename = "stateLGDCode")]
    pub state_lgd_code: String,
    #[serde(rename = "districtLGDCode")]
    pub district_lgd_code: String,
    #[serde(rename = "subDistrictLGDCode")]
    pub sub_district_lgd_code: String,
    pub facility_region: String,
    #[serde(rename = "villageCityTownLGDCode")]
    pub village_city_town_lgd_code: String,
    pub address_line1: String,
    pub address_line2: String,
    pub pincode: String,
    pub latitude: String,
    pub longitude: String,
}

/// Public contact details (HFR-023…026), all optional.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContactInformation {
    pub facility_email_id: String,
    pub facility_contact_number: String,
    pub website_link: String,
    pub facility_landline_number: String,
    pub facility_std_code: String,
}

/// One working day and its hours (HFR-020/021).
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Timing {
    pub working_days: String,
    pub opening_hours: String,
}

/// `facilityInformation` of basic information. Multi-value codes
/// (`systemOfMedicineCode`, `typeOfServiceCode`) are comma-joined, as HFR
/// takes them.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FacilityInformation {
    pub facility_name: String,
    pub facility_address_details: AddressDetails,
    pub facility_contact_information: ContactInformation,
    pub ownership_code: String,
    pub ownership_sub_type_code: String,
    pub ownership_sub_type_code2: String,
    pub system_of_medicine_code: String,
    pub type_of_service_code: String,
    pub facility_type_code: String,
    pub facility_sub_type: String,
    pub facility_operational_status: String,
    pub timings_of_facility: Vec<Timing>,
}

/// `linkedProgramIds` of additional information (HFR-039…046), all optional.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LinkedProgramIds {
    pub nhrr_id: String,
    pub nin: String,
    pub abpmjay_id: String,
    pub rohini_id: String,
    pub echs_id: String,
    pub cghs_id: String,
    pub cea_registration: String,
    pub state_insurance_scheme_id: String,
}

/// Specialities offered under one system of medicine (HFR-047…049).
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SystemSpecialities {
    pub system_of_medicine_code: String,
    /// `Y` or `N` (sic — HFR's spelling).
    pub is_specialization_avalaible: String,
    pub specialities: Vec<String>,
}

/// Bed and chair counts (HFR-050…061). The two totals are computed, never
/// typed: [`MedicalInfrastructure::with_totals`].
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MedicalInfrastructure {
    #[serde(rename = "countIPDBedsWithoutOxygen")]
    pub count_ipd_beds_without_oxygen: u32,
    #[serde(rename = "countIPDBedsWithOxygen")]
    pub count_ipd_beds_with_oxygen: u32,
    #[serde(rename = "countICUBedsWithVentilators")]
    pub count_icu_beds_with_ventilators: u32,
    #[serde(rename = "countICUBedsWithoutVentilators")]
    pub count_icu_beds_without_ventilators: u32,
    #[serde(rename = "countHDUBedsWithFunctionalVentilators")]
    pub count_hdu_beds_with_functional_ventilators: u32,
    #[serde(rename = "countHDUBedsWithVentilators")]
    pub count_hdu_beds_with_ventilators: u32,
    #[serde(rename = "countHDUBedsWithoutVentilators")]
    pub count_hdu_beds_without_ventilators: u32,
    pub count_day_care_beds_without_oxygen: u32,
    pub count_day_care_beds_with_oxygen: u32,
    pub count_dental_chairs: u32,
    pub total_number_of_ventilators: u32,
    pub total_number_of_beds: u32,
}

impl MedicalInfrastructure {
    /// Fill the two read-only totals the workbook defines: ventilators are
    /// the beds with ventilators (HFR-057), beds the beds without (HFR-060).
    #[must_use]
    pub fn with_totals(mut self) -> Self {
        self.total_number_of_ventilators = sum(&[
            self.count_icu_beds_with_ventilators,
            self.count_hdu_beds_with_functional_ventilators,
            self.count_hdu_beds_with_ventilators,
        ]);
        self.total_number_of_beds = sum(&[
            self.count_ipd_beds_without_oxygen,
            self.count_ipd_beds_with_oxygen,
            self.count_icu_beds_without_ventilators,
            self.count_hdu_beds_without_ventilators,
            self.count_day_care_beds_without_oxygen,
            self.count_day_care_beds_with_oxygen,
        ]);
        self
    }
}

/// Detailed information (HFR-047…061).
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetailedInformation {
    pub specialities: Vec<SystemSpecialities>,
    pub medical_infrastructure: MedicalInfrastructure,
}

/// Saturating sum of counts.
fn sum(counts: &[u32]) -> u32 {
    counts.iter().fold(0, |acc, c| acc.saturating_add(*c))
}

/// A non-empty string field.
pub(crate) fn text(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}
