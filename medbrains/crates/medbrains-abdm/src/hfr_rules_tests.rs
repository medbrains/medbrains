//! One test per mandatory HFR workbook rule, using the refusal examples the
//! NHA M4 test matrix gives for each case.

use super::*;
use crate::hfr_forms::{AddressDetails, SystemSpecialities, Timing};

/// A basic information form that passes every rule.
fn valid_basic() -> FacilityInformation {
    FacilityInformation {
        facility_name: "Sahyadri Hospital".to_owned(),
        facility_address_details: AddressDetails {
            country: "India".to_owned(),
            state_lgd_code: "27".to_owned(),
            district_lgd_code: "521".to_owned(),
            sub_district_lgd_code: "4242".to_owned(),
            address_line1: "Townhall Road, Pune (East)".to_owned(),
            pincode: "411001".to_owned(),
            latitude: "18.520430".to_owned(),
            longitude: "73.856743".to_owned(),
            ..AddressDetails::default()
        },
        ownership_code: "P".to_owned(),
        system_of_medicine_code: "M,D".to_owned(),
        facility_type_code: "5".to_owned(),
        facility_operational_status: STATUS_FUNCTIONAL.to_owned(),
        timings_of_facility: vec![Timing {
            working_days: "MON".to_owned(),
            opening_hours: "9:00 AM - 6:00 PM".to_owned(),
        }],
        ..FacilityInformation::default()
    }
}

/// `form` passes every basic rule.
fn passes(form: &FacilityInformation) -> bool {
    check_basic(form).is_empty()
}

/// The workbook cases `check_basic` refuses for `form`.
fn basic_cases(form: &FacilityInformation) -> Vec<&'static str> {
    check_basic(form).into_iter().map(|e| e.case).collect()
}

/// Every refusal of `values` written into one field names `case`.
fn refuses(case: &str, values: &[&str], set: impl Fn(&mut FacilityInformation, &str)) {
    for v in values {
        let mut form = valid_basic();
        set(&mut form, v);
        assert_eq!(basic_cases(&form), vec![case], "{case} should refuse {v:?}");
    }
}

#[test]
fn a_complete_basic_form_passes() {
    assert!(passes(&valid_basic()));
}

#[test]
fn hfr_010_name_starts_with_a_letter_has_no_specials_and_is_over_four() {
    refuses("HFR-010", &["1City", "City@Care", "Clin", ""], |f, v| {
        v.clone_into(&mut f.facility_name);
    });
}

#[test]
fn hfr_011_012_coordinates_in_range_with_one_to_six_decimals() {
    refuses("HFR-011", &["91.5", "18.1234567", "18", ""], |f, v| {
        v.clone_into(&mut f.facility_address_details.latitude);
    });
    refuses("HFR-012", &["181.0", "73.1234567", "abc"], |f, v| {
        v.clone_into(&mut f.facility_address_details.longitude);
    });
    let mut form = valid_basic();
    "-90.0".clone_into(&mut form.facility_address_details.latitude);
    "+180.000000".clone_into(&mut form.facility_address_details.longitude);
    assert!(passes(&form));
}

#[test]
fn hfr_014_016_lgd_codes_are_chosen() {
    refuses("HFR-014", &["", "27; DROP"], |f, v| {
        v.clone_into(&mut f.facility_address_details.state_lgd_code);
    });
    refuses("HFR-015", &[""], |f, v| {
        v.clone_into(&mut f.facility_address_details.district_lgd_code);
    });
    refuses("HFR-016", &[""], |f, v| {
        v.clone_into(&mut f.facility_address_details.sub_district_lgd_code);
    });
}

#[test]
fn hfr_017_018_address_allows_only_listed_specials() {
    refuses("HFR-017", &["12 Main Road #4", ""], |f, v| {
        v.clone_into(&mut f.facility_address_details.address_line1);
    });
    refuses("HFR-018", &["Near Gate @2"], |f, v| {
        v.clone_into(&mut f.facility_address_details.address_line2);
    });
}

#[test]
fn hfr_019_pincode_is_six_digits() {
    refuses("HFR-019", &["4110011", "41100A", ""], |f, v| {
        v.clone_into(&mut f.facility_address_details.pincode);
    });
}

#[test]
fn hfr_020_021_functional_facility_has_days_and_hours() {
    let mut form = valid_basic();
    form.timings_of_facility.clear();
    assert_eq!(basic_cases(&form), vec!["HFR-020"]);
    "C".clone_into(&mut form.facility_operational_status);
    assert!(
        check_basic(&form).is_empty(),
        "a closed facility needs no working days"
    );
    for hours in ["- 6:00 PM", "9:00 - 6:00", "13:00 AM - 6:00 PM", "24x7"] {
        let mut form = valid_basic();
        hours.clone_into(&mut form.timings_of_facility[0].opening_hours);
        assert_eq!(basic_cases(&form), vec!["HFR-021"], "{hours}");
    }
    let mut form = valid_basic();
    "24*7".clone_into(&mut form.timings_of_facility[0].opening_hours);
    assert!(passes(&form));
}

#[test]
fn hfr_022_operational_status_is_chosen() {
    let mut form = valid_basic();
    form.facility_operational_status.clear();
    form.timings_of_facility.clear();
    assert_eq!(basic_cases(&form), vec!["HFR-022"]);
}

#[test]
fn hfr_023_026_optional_contacts_are_checked_when_given() {
    refuses("HFR-023", &["12345", "123456789"], |f, v| {
        v.clone_into(&mut f.facility_contact_information.facility_landline_number);
    });
    refuses("HFR-024", &["987654321", "98765abc12"], |f, v| {
        v.clone_into(&mut f.facility_contact_information.facility_contact_number);
    });
    refuses("HFR-025", &["clinic@", "clinic.example.com"], |f, v| {
        v.clone_into(&mut f.facility_contact_information.facility_email_id);
    });
    refuses("HFR-026", &["not a link"], |f, v| {
        v.clone_into(&mut f.facility_contact_information.website_link);
    });
    let mut form = valid_basic();
    let c = &mut form.facility_contact_information;
    "2026123".clone_into(&mut c.facility_landline_number);
    "9876543210".clone_into(&mut c.facility_contact_number);
    "desk@example.org".clone_into(&mut c.facility_email_id);
    "nha.abdm.gov.in".clone_into(&mut c.website_link);
    assert!(passes(&form));
}

#[test]
fn hfr_031_033_ownership_and_its_conditional_subtypes() {
    refuses("HFR-031", &[""], |f, v| v.clone_into(&mut f.ownership_code));
    let mut form = valid_basic();
    OWNERSHIP_GOVERNMENT.clone_into(&mut form.ownership_code);
    assert_eq!(basic_cases(&form), vec!["HFR-032"]);
    SUBTYPE_CENTRAL.clone_into(&mut form.ownership_sub_type_code);
    assert_eq!(basic_cases(&form), vec!["HFR-033"]);
    "MOHF".clone_into(&mut form.ownership_sub_type_code2);
    assert!(passes(&form));
}

#[test]
fn hfr_034_035_system_of_medicine_and_type_are_chosen() {
    refuses("HFR-034", &["", " , "], |f, v| {
        v.clone_into(&mut f.system_of_medicine_code);
    });
    refuses("HFR-035", &[""], |f, v| {
        v.clone_into(&mut f.facility_type_code);
    });
}

#[test]
fn hfr_001_007_search_by_id_or_by_name_ownership_and_state() {
    let by_id = FacilitySearch {
        facility_id: "IN2810002702".to_owned(),
        ..FacilitySearch::default()
    };
    assert_eq!(check_search(&by_id), Vec::<FieldError>::new());
    let bad_id = FacilitySearch {
        facility_id: "XX2810002702".to_owned(),
        ..FacilitySearch::default()
    };
    assert_eq!(check_search(&bad_id)[0].case, "HFR-001");
    let cases: Vec<_> = check_search(&FacilitySearch::default())
        .into_iter()
        .map(|e| e.case)
        .collect();
    assert_eq!(cases, vec!["HFR-002", "HFR-003", "HFR-004"]);
    let by_name = FacilitySearch {
        facility_name: "sahya".to_owned(),
        ownership_code: "P".to_owned(),
        state_lgd_code: "27".to_owned(),
        pincode: "4110011".to_owned(),
        ..FacilitySearch::default()
    };
    assert_eq!(check_search(&by_name)[0].case, "HFR-007");
}

#[test]
fn hfr_046_state_scheme_id_is_alphanumeric() {
    let mut ids = LinkedProgramIds::default();
    assert_eq!(check_additional(&ids), Vec::<FieldError>::new());
    "MH-01".clone_into(&mut ids.state_insurance_scheme_id);
    assert_eq!(check_additional(&ids)[0].case, "HFR-046");
}

/// A detailed form matching `valid_basic`'s systems M and D.
fn valid_detailed() -> DetailedInformation {
    let entry = |code: &str, yn: &str, s: &[&str]| SystemSpecialities {
        system_of_medicine_code: code.to_owned(),
        is_specialization_avalaible: yn.to_owned(),
        specialities: s.iter().map(|x| (*x).to_owned()).collect(),
    };
    DetailedInformation {
        specialities: vec![entry("M", "Y", &["S29"]), entry("D", "N", &[])],
        ..DetailedInformation::default()
    }
}

#[test]
fn hfr_047_049_specialities_follow_the_systems_of_medicine() {
    assert_eq!(
        check_detailed(&valid_detailed(), "M,D"),
        Vec::<FieldError>::new()
    );
    let case = |d: &DetailedInformation, s: &str| check_detailed(d, s).first().map(|e| e.case);
    assert_eq!(case(&valid_detailed(), "M"), Some("HFR-047"));
    let mut d = valid_detailed();
    "maybe".clone_into(&mut d.specialities[0].is_specialization_avalaible);
    assert_eq!(case(&d, "M,D"), Some("HFR-048"));
    let mut d = valid_detailed();
    d.specialities[0].specialities.clear();
    assert_eq!(case(&d, "M,D"), Some("HFR-049"));
    let mut d = valid_detailed();
    d.specialities[1].specialities.push("S50".to_owned());
    assert_eq!(case(&d, "M,D"), Some("HFR-049"));
}

#[test]
fn hfr_050_counts_are_two_digits() {
    let mut d = valid_detailed();
    d.medical_infrastructure.count_dental_chairs = 100;
    assert_eq!(check_detailed(&d, "M,D")[0].case, "HFR-050");
}

#[test]
fn codes_are_safe_for_a_query_string() {
    assert!(is_code("CENTRAL-GOVERNMENT"));
    assert!(!is_code("27&type=x"));
    assert!(!is_code(""));
}
