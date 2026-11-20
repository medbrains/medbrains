//! The field rules of NHA's HFR workbook, one function per form step.
//!
//! The screen enforces the same rules first (the workbook's "nothing sent");
//! these run again on the server because the browser is not a trust
//! boundary. Each refusal names the workbook case it comes from, so a tester
//! can match the message to the sheet.
//!
//! Rules that depend on the name of a master entry — which facility types
//! need no type of service (HFR-037) or specialisation (HFR-038), and whether
//! a facility type has subtypes (HFR-036) — are enforced on the screen only:
//! the server sees codes, and HFR publishes no fixed code list for them.

use serde::Serialize;

#[path = "hfr_values.rs"]
mod values;

pub use values::{codes, is_code, is_hfr_id};
use values::{
    digits, is_address, is_coordinate, is_email, is_facility_name, is_link, is_opening_hours,
    optional,
};

use crate::hfr_forms::{
    AddressDetails, ContactInformation, DetailedInformation, FacilityInformation, FacilitySearch,
    LinkedProgramIds,
};

/// Ownership code HFR uses for government (`get-master-data?type=OWNER`).
pub const OWNERSHIP_GOVERNMENT: &str = "G";
/// Government subtype code for central government (`get-owner-subtype`).
pub const SUBTYPE_CENTRAL: &str = "C";
/// Operational status code for a functional facility (`FAC-STATUS`).
pub const STATUS_FUNCTIONAL: &str = "F";
/// HFR-050…061: each count is at most two digits.
pub const MAX_COUNT: u32 = 99;

/// One refused field and the workbook case behind the rule.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct FieldError {
    pub field: &'static str,
    pub case: &'static str,
    pub message: &'static str,
}

/// Collects refusals for one step.
#[derive(Default)]
struct Refusals(Vec<FieldError>);

impl Refusals {
    /// Refuse `field` under `case` unless `ok`.
    fn require(
        &mut self,
        ok: bool,
        (field, case): (&'static str, &'static str),
        message: &'static str,
    ) {
        if !ok {
            self.0.push(FieldError {
                field,
                case,
                message,
            });
        }
    }
}

/// HFR-001…007: the facility ID alone, or name, ownership and state.
#[must_use]
pub fn check_search(q: &FacilitySearch) -> Vec<FieldError> {
    let mut r = Refusals::default();
    let id = q.facility_id.trim();
    if id.is_empty() {
        r.require(
            !q.facility_name.trim().is_empty(),
            ("facilityName", "HFR-002"),
            "Enter the facility name, in full or in part",
        );
        r.require(
            !q.ownership_code.is_empty(),
            ("ownershipCode", "HFR-003"),
            "Choose the ownership",
        );
        r.require(
            is_code(&q.state_lgd_code),
            ("stateLGDCode", "HFR-004"),
            "Choose the state or UT",
        );
    } else {
        r.require(
            is_hfr_id(id),
            ("facilityId", "HFR-001"),
            "A facility ID is IN followed by 10 letters or digits",
        );
    }
    r.require(
        optional(&q.district_lgd_code, is_code),
        ("districtLGDCode", "HFR-005"),
        "Choose a district from the list",
    );
    r.require(
        optional(&q.sub_district_lgd_code, is_code),
        ("subDistrictLGDCode", "HFR-006"),
        "Choose a sub-district from the list",
    );
    r.require(
        optional(q.pincode.trim(), |p| p.len() <= 6 && digits(p)),
        ("pincode", "HFR-007"),
        "A pincode is at most 6 digits",
    );
    r.0
}

/// HFR-010…035 (and HFR-064…089 on update): basic information.
#[must_use]
pub fn check_basic(b: &FacilityInformation) -> Vec<FieldError> {
    let mut r = Refusals::default();
    r.require(
        is_facility_name(&b.facility_name),
        ("facilityName", "HFR-010"),
        "Start with a letter, use letters, digits and spaces only, more than 4 characters",
    );
    check_address(&mut r, &b.facility_address_details);
    check_timings(&mut r, b);
    r.require(
        !b.facility_operational_status.is_empty(),
        ("facilityOperationalStatus", "HFR-022"),
        "Choose the operational status",
    );
    check_contact(&mut r, &b.facility_contact_information);
    check_ownership(&mut r, b);
    r.0
}

/// HFR-011…019: coordinates, LGD codes, address lines and pincode.
fn check_address(r: &mut Refusals, a: &AddressDetails) {
    r.require(
        is_coordinate(&a.latitude, 90.0),
        ("latitude", "HFR-011"),
        "Latitude is -90 to 90 with 1 to 6 decimal places",
    );
    r.require(
        is_coordinate(&a.longitude, 180.0),
        ("longitude", "HFR-012"),
        "Longitude is -180 to 180 with 1 to 6 decimal places",
    );
    r.require(
        is_code(&a.state_lgd_code),
        ("stateLGDCode", "HFR-014"),
        "Choose the state or UT",
    );
    r.require(
        is_code(&a.district_lgd_code),
        ("districtLGDCode", "HFR-015"),
        "Choose the district",
    );
    r.require(
        is_code(&a.sub_district_lgd_code),
        ("subDistrictLGDCode", "HFR-016"),
        "Choose the sub-district",
    );
    r.require(
        !a.address_line1.trim().is_empty() && is_address(&a.address_line1),
        ("addressLine1", "HFR-017"),
        "Letters, digits and . - , / ( ) _ only",
    );
    r.require(
        optional(&a.address_line2, is_address),
        ("addressLine2", "HFR-018"),
        "Letters, digits and . - , / ( ) _ only",
    );
    r.require(
        a.pincode.len() == 6 && digits(&a.pincode),
        ("pincode", "HFR-019"),
        "A pincode is 6 digits",
    );
}

/// HFR-023…026: optional public contacts, checked when given.
fn check_contact(r: &mut Refusals, c: &ContactInformation) {
    r.require(
        optional(&c.facility_landline_number, |n| {
            (6..=8).contains(&n.len()) && digits(n)
        }),
        ("facilityLandlineNumber", "HFR-023"),
        "A landline number is 6 to 8 digits",
    );
    r.require(
        optional(&c.facility_contact_number, |n| n.len() == 10 && digits(n)),
        ("facilityContactNumber", "HFR-024"),
        "A mobile number is 10 digits",
    );
    r.require(
        optional(&c.facility_email_id, is_email),
        ("facilityEmailId", "HFR-025"),
        "Enter an email such as desk@example.org",
    );
    r.require(
        optional(&c.website_link, is_link),
        ("websiteLink", "HFR-026"),
        "Enter a web address such as example.org",
    );
}

/// HFR-031…035: ownership with its conditional subtypes, system of medicine
/// and facility type.
fn check_ownership(r: &mut Refusals, b: &FacilityInformation) {
    r.require(
        !b.ownership_code.is_empty(),
        ("ownershipCode", "HFR-031"),
        "Choose the ownership",
    );
    let government = b.ownership_code == OWNERSHIP_GOVERNMENT;
    r.require(
        !government || !b.ownership_sub_type_code.is_empty(),
        ("ownershipSubTypeCode", "HFR-032"),
        "Choose the government subtype",
    );
    let central = government && b.ownership_sub_type_code == SUBTYPE_CENTRAL;
    r.require(
        !central || !b.ownership_sub_type_code2.is_empty(),
        ("ownershipSubTypeCode2", "HFR-033"),
        "Choose the central government ministry",
    );
    r.require(
        !codes(&b.system_of_medicine_code).is_empty(),
        ("systemOfMedicineCode", "HFR-034"),
        "Choose at least one system of medicine",
    );
    r.require(
        !b.facility_type_code.is_empty(),
        ("facilityTypeCode", "HFR-035"),
        "Choose the facility type",
    );
}

/// HFR-020/021: a functional facility names its days, and each chosen day
/// has hours as `9:00 AM - 6:00 PM` or `24*7`.
fn check_timings(r: &mut Refusals, b: &FacilityInformation) {
    let functional = b.facility_operational_status == STATUS_FUNCTIONAL;
    r.require(
        !functional || !b.timings_of_facility.is_empty(),
        ("workingDays", "HFR-020"),
        "Choose the working days of a functional facility",
    );
    let hours_ok = b
        .timings_of_facility
        .iter()
        .all(|t| !t.working_days.is_empty() && is_opening_hours(&t.opening_hours));
    r.require(
        hours_ok,
        ("openingHours", "HFR-021"),
        "Give a From and a To time for each chosen day, or 24*7",
    );
}

/// HFR-039…046 (HFR-093…100): program IDs are optional; the state scheme
/// ID is alphanumeric.
#[must_use]
pub fn check_additional(ids: &LinkedProgramIds) -> Vec<FieldError> {
    let mut r = Refusals::default();
    let alnum = |v: &str| v.chars().all(|c| c.is_ascii_alphanumeric());
    r.require(
        optional(&ids.state_insurance_scheme_id, alnum),
        ("stateInsuranceSchemeId", "HFR-046"),
        "Letters and digits only",
    );
    r.0
}

/// HFR-047…061 (HFR-101…115): one entry per system of medicine chosen in
/// basic information; specialities only when offered; counts of two digits.
#[must_use]
pub fn check_detailed(d: &DetailedInformation, systems_in_basic: &str) -> Vec<FieldError> {
    let mut r = Refusals::default();
    let mut chosen = codes(systems_in_basic);
    chosen.sort_unstable();
    let mut given: Vec<&str> = d
        .specialities
        .iter()
        .map(|s| s.system_of_medicine_code.as_str())
        .collect();
    given.sort_unstable();
    r.require(
        !chosen.is_empty() && chosen == given,
        ("systemOfMedicineCode", "HFR-047"),
        "Give one entry for each system of medicine chosen in basic information",
    );
    let yes_no = d
        .specialities
        .iter()
        .all(|s| matches!(s.is_specialization_avalaible.as_str(), "Y" | "N"));
    r.require(
        yes_no,
        ("isSpecializationAvalaible", "HFR-048"),
        "Say whether specialisations are offered, yes or no",
    );
    let listed = d
        .specialities
        .iter()
        .all(|s| match s.is_specialization_avalaible.as_str() {
            "Y" => !s.specialities.is_empty(),
            _ => s.specialities.is_empty(),
        });
    r.require(
        listed,
        ("specialities", "HFR-049"),
        "Choose the specialisations offered, only where offered",
    );
    let m = &d.medical_infrastructure;
    let counts = [
        m.count_ipd_beds_without_oxygen,
        m.count_ipd_beds_with_oxygen,
        m.count_icu_beds_with_ventilators,
        m.count_icu_beds_without_ventilators,
        m.count_hdu_beds_with_functional_ventilators,
        m.count_hdu_beds_with_ventilators,
        m.count_hdu_beds_without_ventilators,
        m.count_day_care_beds_without_oxygen,
        m.count_day_care_beds_with_oxygen,
        m.count_dental_chairs,
    ];
    r.require(
        counts.iter().all(|c| *c <= MAX_COUNT),
        ("medicalInfrastructure", "HFR-050"),
        "Each count is at most 2 digits",
    );
    r.0
}

#[cfg(test)]
#[path = "hfr_rules_tests.rs"]
mod tests;
