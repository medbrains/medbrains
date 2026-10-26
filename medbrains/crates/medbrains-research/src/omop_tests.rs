use std::collections::HashMap;
use std::io::Read as _;

use chrono::NaiveDate;
use uuid::Uuid;

use super::{ConceptMap, Sources, bundle};
use crate::deid::RawRow;

fn day(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default()
}

fn row(patient: u128, pincode: &str, on: &str, values: &[Option<&str>]) -> RawRow {
    RawRow {
        patient: Uuid::from_u128(patient),
        birth: Some(day("1980-06-01")),
        sex: Some("Female".to_owned()),
        pincode: Some(pincode.to_owned()),
        on: day(on),
        values: values.iter().map(|v| v.map(str::to_owned)).collect(),
        hidden: None,
    }
}

/// Six women in 560xxx (k is met) and one in 110xxx (alone: left out).
fn sources() -> Sources {
    let people = (1..=6).map(|p| (p, "560020")).chain([(99, "110001")]);
    let mut s = Sources {
        visits: vec![],
        diagnoses: vec![],
        labs: vec![],
        medicines: vec![],
        vitals: vec![],
    };
    for (p, pin) in people {
        s.visits.push(row(
            p,
            pin,
            "2026-03-14",
            &[Some("opd"), Some("new"), Some("General Medicine")],
        ));
        s.diagnoses.push(row(
            p,
            pin,
            "2026-03-14",
            &[
                Some("E11.9"),
                None,
                Some("true"),
                Some("opd"),
                Some("General Medicine"),
            ],
        ));
        s.diagnoses.push(row(
            p,
            pin,
            "2026-03-15",
            &[
                None,
                Some("BA00"),
                Some("false"),
                Some("opd"),
                Some("General Medicine"),
            ],
        ));
        s.diagnoses.push(row(
            p,
            pin,
            "2026-03-15",
            &[
                None,
                Some("6A20"),
                Some("false"),
                Some("opd"),
                Some("General Medicine"),
            ],
        ));
        s.labs.push(row(
            p,
            pin,
            "2026-03-16",
            &[
                Some("718-7"),
                Some("CBC"),
                Some("Haemoglobin"),
                Some("11.2"),
                Some("g/dL"),
                Some("low"),
                None,
            ],
        ));
        s.medicines.push(row(
            p,
            pin,
            "2026-03-17",
            &[
                Some("metformin"),
                Some("A10BA02"),
                Some("oral"),
                Some("30"),
                Some("60"),
                Some("opd"),
            ],
        ));
        s.medicines.push(row(
            p,
            pin,
            "2026-03-17",
            &[
                Some("a generic"),
                Some("N05AH03"),
                Some("oral"),
                Some("30"),
                Some("30"),
                Some("opd"),
            ],
        ));
        s.vitals.push(row(
            p,
            pin,
            "2026-03-18",
            &[
                Some("148"),
                Some("92"),
                Some("88"),
                Some("37.1"),
                Some("97"),
                Some("16"),
                Some("24.1"),
            ],
        ));
    }
    s
}

fn files(zip: &[u8]) -> HashMap<String, String> {
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(zip.to_vec())).unwrap_or_else(|e| panic!("{e}"));
    let mut out: HashMap<String, String> = HashMap::new();
    for i in 0..archive.len() {
        let mut f = archive.by_index(i).unwrap_or_else(|e| panic!("{e}"));
        let mut body = String::new();
        f.read_to_string(&mut body).unwrap_or_default();
        out.insert(f.name().map(|n| n.to_string()).unwrap_or_default(), body);
    }
    out
}

fn map() -> ConceptMap {
    HashMap::from([
        (
            ("ICD10".to_owned(), "E11.9".to_owned()),
            (45_591_356, Some(201_826)),
        ),
        (
            ("LOINC".to_owned(), "718-7".to_owned()),
            (3_000_963, Some(3_000_963)),
        ),
    ])
}

#[test]
fn the_bundle_has_every_cdm_table_and_a_readme_of_its_deviations() {
    let b = bundle(
        &sources(),
        &map(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    let f = files(&b.zip);
    for name in [
        "README.txt",
        "person.csv",
        "location.csv",
        "observation_period.csv",
        "visit_occurrence.csv",
        "condition_occurrence.csv",
        "measurement.csv",
        "drug_exposure.csv",
        "cdm_source.csv",
    ] {
        assert!(f.contains_key(name), "{name}");
    }
    assert!(f["README.txt"].contains("first day of its month"));
    assert!(f["cdm_source.csv"].contains("v5.4"));
}

#[test]
fn a_person_alone_in_their_group_is_left_out_with_all_their_records() {
    let b = bundle(
        &sources(),
        &map(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    let f = files(&b.zip);
    assert_eq!(f["person.csv"].lines().count(), 1 + 6);
    assert!(!f["location.csv"].contains("\"110\""));
    assert_eq!(b.report["persons_suppressed"], 1);
    assert_eq!(f["visit_occurrence.csv"].lines().count(), 1 + 6);
}

#[test]
fn dates_are_months_and_no_identifier_is_released() {
    let b = bundle(
        &sources(),
        &map(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    let all: String = files(&b.zip).values().cloned().collect();
    for exact in [
        "2026-03-14",
        "2026-03-15",
        "2026-03-16",
        "2026-03-17",
        "2026-03-18",
        "1980-06-01",
        "560020",
    ] {
        assert!(!all.contains(exact), "{exact}");
    }
    assert!(all.contains("\"2026-03-01\""));
    assert!(!all.contains(&Uuid::from_u128(1).to_string()));
}

#[test]
fn codes_map_where_licence_free_and_stay_source_codes_otherwise() {
    let b = bundle(
        &sources(),
        &map(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    let f = files(&b.zip);
    let conditions = &f["condition_occurrence.csv"];
    assert!(
        conditions.contains("\"201826\"") && conditions.contains("\"45591356\""),
        "ICD-10 mapped"
    );
    assert!(
        conditions.contains("\"ICD11:BA00\""),
        "ICD-11 kept as source"
    );
    assert!(f["measurement.csv"].contains("\"3000963\""), "LOINC mapped");
    let unmapped = bundle(
        &sources(),
        &ConceptMap::new(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    assert!(!files(&unmapped.zip)["condition_occurrence.csv"].contains("201826"));
}

#[test]
fn restricted_classes_are_left_out_and_vitals_stay_banded() {
    let b = bundle(
        &sources(),
        &map(),
        b"salt",
        (day("2026-03-01"), day("2026-03-31")),
        "ref1",
    );
    let f = files(&b.zip);
    assert!(!f["condition_occurrence.csv"].contains("6A20"));
    assert!(
        !f["drug_exposure.csv"].contains("N05AH03")
            && !f["drug_exposure.csv"].contains("a generic")
    );
    let m = &f["measurement.csv"];
    assert!(m.contains("\"140-159\"") && m.contains("\"8480-6\""));
    assert!(!m.contains("\"148\"") && !m.contains("\"24.1\""));
}
