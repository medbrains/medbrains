use chrono::NaiveDate;
use uuid::Uuid;

use super::{Field, Kind, OTHER, RawRow, age_band, patient_key, pincode_prefix, release, to_csv};

const FIELDS: &[Field] = &[
    Field {
        name: "icd_code",
        kind: Kind::Category,
        description: "ICD-10",
        quasi: false,
    },
    Field {
        name: "length_of_stay_days",
        kind: Kind::Number,
        description: "days",
        quasi: false,
    },
];

fn day(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default()
}

/// `n` patients born the same year in one pincode, each with `icd`.
fn cohort(n: u128, from: u128, icd: &str) -> Vec<RawRow> {
    (from..from + n)
        .map(|i| RawRow {
            patient: Uuid::from_u128(i),
            birth: Some(day("1980-06-01")),
            sex: Some("Female".to_owned()),
            pincode: Some("560020".to_owned()),
            on: day("2026-03-14"),
            values: vec![Some(icd.to_owned()), Some("3".to_owned())],
            hidden: None,
        })
        .collect()
}

#[test]
fn ages_band_by_five_years_and_ninety_plus_is_one_band() {
    let on = day("2026-03-14");
    assert_eq!(age_band(Some(day("1980-03-15")), on), "45-49");
    assert_eq!(age_band(Some(day("1980-03-14")), on), "45-49");
    assert_eq!(age_band(Some(day("1981-03-15")), on), "40-44");
    assert_eq!(age_band(Some(day("1920-01-01")), on), "90+");
    assert_eq!(age_band(None, on), "unknown");
    assert_eq!(pincode_prefix(Some("560020")), "560");
    assert_eq!(pincode_prefix(Some("5600")), "unknown");
}

#[test]
fn identifiers_never_reach_the_file() {
    let mut rows = cohort(6, 1, "E11");
    rows[0].values[0] = Some("E11".to_owned());
    let out = release(FIELDS, rows, b"salt-a", "ab12cd34");
    let csv = to_csv(&out.header, &out.rows);
    assert!(!csv.contains("560020"), "full pincode");
    assert!(!csv.contains("1980-06-01"), "birth date");
    assert!(!csv.contains("2026-03-14"), "event date");
    assert!(!csv.contains(&Uuid::from_u128(1).to_string()), "patient id");
    assert!(csv.contains("\"2026-03\""));
    assert!(csv.lines().skip(1).all(|l| l.starts_with("\"ab12cd34\"")));
}

#[test]
fn every_released_row_stands_among_at_least_five_patients() {
    let mut rows = cohort(6, 1, "E11");
    // Two patients alone in their age band, sex and pincode prefix.
    let mut odd = cohort(2, 100, "E11");
    for r in &mut odd {
        r.pincode = Some("110001".to_owned());
    }
    rows.extend(odd);
    let out = release(FIELDS, rows, b"salt", "x");
    assert_eq!(out.rows.len(), 6);
    assert_eq!(out.suppressed_rows, 2);
    assert_eq!(out.report["patients_suppressed"], 2);
    assert!(out.rows.iter().all(|r| r[4] == "560"));
}

#[test]
fn rare_categories_become_other() {
    let mut rows = cohort(6, 1, "E11");
    rows.extend(cohort(5, 10, "I10"));
    rows.extend(cohort(2, 20, "Q87.4"));
    let out = release(FIELDS, rows, b"salt", "x");
    let codes: Vec<&str> = out.rows.iter().map(|r| r[6].as_str()).collect();
    assert!(codes.contains(&"E11") && codes.contains(&"I10"));
    assert!(!codes.contains(&"Q87.4"));
    assert_eq!(codes.iter().filter(|c| **c == OTHER).count(), 2);
}

#[test]
fn restricted_classes_are_left_out() {
    let mut rows = cohort(6, 1, "E11");
    rows.extend(cohort(6, 10, "B20"));
    rows.extend(cohort(6, 20, "F20.0"));
    let out = release(FIELDS, rows, b"salt", "x");
    let csv = to_csv(&out.header, &out.rows);
    assert!(!csv.contains("B20") && !csv.contains("F20"));
    assert_eq!(out.report["restricted_rows_left_out"], 12);
}

#[test]
fn two_exports_cannot_be_joined_on_the_patient_key() {
    let p = Uuid::from_u128(42);
    assert_eq!(patient_key(b"export-1", p), patient_key(b"export-1", p));
    assert_ne!(patient_key(b"export-1", p), patient_key(b"export-2", p));
    let a = release(FIELDS, cohort(6, 1, "E11"), b"export-1", "a");
    let b = release(FIELDS, cohort(6, 1, "E11"), b"export-2", "b");
    let keys = |r: &super::Released| {
        r.rows
            .iter()
            .map(|x| x[1].clone())
            .collect::<std::collections::HashSet<_>>()
    };
    assert!(keys(&a).is_disjoint(&keys(&b)));
}

#[test]
fn a_restricted_name_beside_an_ordinary_code_is_left_out() {
    let mut rows = cohort(6, 1, "E11");
    let mut named = cohort(6, 10, "ZZ99");
    for r in &mut named {
        r.hidden = Some("Paranoid schizophrenia".to_owned());
    }
    rows.extend(named);
    rows.extend(cohort(6, 20, "6A20"));
    let out = release(FIELDS, rows, b"salt", "x");
    assert_eq!(out.rows.len(), 6);
    assert_eq!(out.report["restricted_rows_left_out"], 12);
}

#[test]
fn numbers_are_released_only_as_their_band() {
    const CUTS: &[(f64, &str)] = &[(120.0, "<120"), (f64::INFINITY, "120+")];
    const BANDED: &[Field] = &[Field {
        name: "systolic_bp_band",
        kind: Kind::Band(CUTS),
        description: "banded",
        quasi: false,
    }];
    let mut rows = cohort(6, 1, "x");
    for (i, r) in rows.iter_mut().enumerate() {
        r.values = vec![Some(if i < 3 { "118" } else { "142" }.to_owned())];
    }
    let out = release(BANDED, rows.clone(), b"salt", "x");
    let csv = to_csv(&out.header, &out.rows);
    assert!(!csv.contains("118") && !csv.contains("142"), "{csv}");
    // Three patients per band is under k: each band is rare, so "Other".
    assert!(out.rows.iter().all(|r| r[6] == OTHER));
    rows.extend(cohort(6, 50, "x").into_iter().map(|mut r| {
        r.values = vec![Some("118".to_owned())];
        r
    }));
    let out = release(BANDED, rows, b"salt", "x");
    assert!(out.rows.iter().any(|r| r[6] == "<120"));
}

#[test]
fn a_quasi_identifying_field_joins_the_k_check() {
    const WITH_DEPT: &[Field] = &[Field {
        name: "department",
        kind: Kind::Category,
        description: "dept",
        quasi: true,
    }];
    let mut rows = cohort(6, 1, "Cardiology");
    // Same age band, sex and pincode, but only 2 in Neurology: below k once
    // the department counts, even though the value itself is not rare here.
    let mut few = cohort(5, 20, "Neurology");
    few.truncate(2);
    rows.extend(few);
    rows.extend(cohort(5, 40, "Neurology").into_iter().map(|mut r| {
        r.sex = Some("Male".to_owned());
        r
    }));
    let out = release(WITH_DEPT, rows, b"salt", "x");
    assert_eq!(out.suppressed_rows, 2);
    assert!(
        out.report["quasi_identifiers"]
            .to_string()
            .contains("department")
    );
}

#[test]
fn a_medicine_that_discloses_a_class_is_left_out_by_its_atc_code() {
    const MEDS: &[Field] = &[
        Field {
            name: "inn",
            kind: Kind::Category,
            description: "inn",
            quasi: false,
        },
        Field {
            name: "atc_code",
            kind: Kind::Category,
            description: "atc",
            quasi: false,
        },
    ];
    let mut rows = cohort(6, 1, "x");
    for r in &mut rows {
        r.values = vec![Some("metformin".to_owned()), Some("A10BA02".to_owned())];
    }
    let mut hidden = cohort(6, 10, "x");
    for r in &mut hidden {
        r.values = vec![Some("a generic".to_owned()), Some("N05AH03".to_owned())];
    }
    rows.extend(hidden);
    let out = release(MEDS, rows, b"salt", "x");
    assert_eq!(out.rows.len(), 6);
    assert_eq!(out.report["restricted_rows_left_out"], 6);
}
