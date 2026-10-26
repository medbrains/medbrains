//! The OMOP event tables (`visit_occurrence` aside): conditions,
//! measurements and drug exposures, and the CSV writing every table shares.

use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{ConceptMap, EHR, People, VITAL_LOINC, month};
use crate::datasets::fields;
use crate::deid::{self, K, OTHER, RawRow};

/// One row: `(column, value)`; every other column is empty, or `0` for a
/// concept id.
pub(super) type Row = Vec<(&'static str, String)>;

/// A CDM table and its rows.
pub(super) struct Table {
    pub(super) name: &'static str,
    pub(super) rows: Vec<Row>,
}

pub(super) fn columns(table: &str) -> Vec<&'static str> {
    include_str!("columns.txt")
        .lines()
        .find_map(|l| l.strip_prefix(table)?.strip_prefix(": "))
        .map(|c| c.split(',').collect())
        .unwrap_or_default()
}

impl Table {
    pub(super) fn csv(&self) -> String {
        let header = columns(self.name);
        let cell = |set: &Row, col: &str| {
            set.iter().find(|(c, _)| *c == col).map_or_else(
                || {
                    if col.ends_with("_concept_id") {
                        "0".to_owned()
                    } else {
                        String::new()
                    }
                },
                |(_, v)| v.clone(),
            )
        };
        let rows: Vec<Vec<String>> = self
            .rows
            .iter()
            .map(|set| header.iter().map(|col| cell(set, col)).collect())
            .collect();
        deid::to_csv(
            &header.iter().map(|h| (*h).to_owned()).collect::<Vec<_>>(),
            &rows,
        )
    }
}

pub(super) const fn visit_concept(kind: &str) -> i64 {
    match kind.as_bytes() {
        b"opd" => 9202,
        b"ipd" => 9201,
        b"emergency" => 9203,
        b"home_health" => 581_476,
        _ => 0,
    }
}

pub(super) fn value(r: &RawRow, i: usize) -> String {
    r.values.get(i).cloned().flatten().unwrap_or_default()
}

/// Values of column `i` held by fewer than [`K`] of the kept persons.
pub(super) fn rare(rows: &[&RawRow], i: usize) -> HashSet<String> {
    let mut holders: HashMap<String, HashSet<Uuid>> = HashMap::new();
    for r in rows {
        holders.entry(value(r, i)).or_default().insert(r.patient);
    }
    holders
        .into_iter()
        .filter(|(_, p)| p.len() < K)
        .map(|(v, _)| v)
        .collect()
}

/// `(standard concept, source concept)` for a code, `0` when not loaded.
pub(super) fn concept(map: &ConceptMap, vocabulary: &str, code: &str) -> (String, String) {
    map.get(&(vocabulary.to_owned(), code.to_owned()))
        .map_or_else(
            || ("0".to_owned(), "0".to_owned()),
            |(source, standard)| (standard.unwrap_or(0).to_string(), source.to_string()),
        )
}

pub(super) fn dated(
    person: String,
    date_col: &'static str,
    on: NaiveDate,
    type_col: &'static str,
) -> Row {
    vec![
        ("person_id", person),
        (date_col, month(on)),
        (type_col, EHR.to_string()),
    ]
}

pub(super) fn conditions(rows: &[&RawRow], map: &ConceptMap, p: &People) -> (Vec<Row>, Value) {
    let (rare10, rare11) = (rare(rows, 0), rare(rows, 1));
    let out = rows
        .iter()
        .map(|r| {
            let (icd10, icd11) = (value(r, 0), value(r, 1));
            let (source, (standard, source_id)) = if !icd10.is_empty() && !rare10.contains(&icd10) {
                (icd10.clone(), concept(map, "ICD10", &icd10))
            } else if !icd11.is_empty() && !rare11.contains(&icd11) {
                (format!("ICD11:{icd11}"), ("0".to_owned(), "0".to_owned()))
            } else {
                (OTHER.to_owned(), ("0".to_owned(), "0".to_owned()))
            };
            let status = if value(r, 2) == "true" { "primary" } else { "" };
            let mut row = dated(
                p.id[&r.patient].to_string(),
                "condition_start_date",
                r.on,
                "condition_type_concept_id",
            );
            row.extend([
                ("condition_concept_id", standard),
                ("condition_source_value", source),
                ("condition_source_concept_id", source_id),
                ("condition_status_source_value", status.to_owned()),
            ]);
            row
        })
        .collect();
    (out, json!({"icd10": rare10.len(), "icd11": rare11.len()}))
}

pub(super) fn measurements(
    labs: &[&RawRow],
    vitals: &[&RawRow],
    map: &ConceptMap,
    p: &People,
) -> (Vec<Row>, usize) {
    let rare_loinc = rare(labs, 0);
    let mut out: Vec<Row> = labs
        .iter()
        .map(|r| {
            let loinc = value(r, 0);
            let (code, (standard, source_id)) = if loinc.is_empty() || rare_loinc.contains(&loinc) {
                (OTHER.to_owned(), ("0".to_owned(), "0".to_owned()))
            } else {
                (loinc.clone(), concept(map, "LOINC", &loinc))
            };
            let mut row = dated(
                p.id[&r.patient].to_string(),
                "measurement_date",
                r.on,
                "measurement_type_concept_id",
            );
            row.extend([
                ("measurement_concept_id", standard),
                ("value_as_number", value(r, 3)),
                ("measurement_source_value", code),
                ("measurement_source_concept_id", source_id),
                ("unit_source_value", value(r, 4)),
                ("value_source_value", value(r, 5)),
            ]);
            row
        })
        .collect();
    let vital_fields = fields("vitals").unwrap_or_default();
    for r in vitals {
        for ((f, raw), code) in vital_fields.iter().zip(&r.values).zip(VITAL_LOINC) {
            let band = deid::shown(f.kind, raw.as_deref());
            if band.is_empty() {
                continue;
            }
            let (standard, source_id) = concept(map, "LOINC", code);
            let mut row = dated(
                p.id[&r.patient].to_string(),
                "measurement_date",
                r.on,
                "measurement_type_concept_id",
            );
            row.extend([
                ("measurement_concept_id", standard),
                ("measurement_source_value", (*code).to_owned()),
                ("measurement_source_concept_id", source_id),
                ("value_source_value", band),
            ]);
            out.push(row);
        }
    }
    (out, rare_loinc.len())
}

pub(super) fn drugs(rows: &[&RawRow], map: &ConceptMap, p: &People) -> (Vec<Row>, usize) {
    let rare_inn = rare(rows, 0);
    let out = rows
        .iter()
        .map(|r| {
            let (inn, atc) = (value(r, 0), value(r, 1));
            let (inn, atc_source) = if inn.is_empty() || rare_inn.contains(&inn) {
                (OTHER.to_owned(), "0".to_owned())
            } else if atc.is_empty() {
                (inn, "0".to_owned())
            } else {
                (inn, concept(map, "ATC", &atc).1)
            };
            let mut row = dated(
                p.id[&r.patient].to_string(),
                "drug_exposure_start_date",
                r.on,
                "drug_type_concept_id",
            );
            row.extend([
                ("drug_exposure_end_date", month(r.on)),
                ("quantity", value(r, 4)),
                ("drug_source_value", inn),
                ("drug_source_concept_id", atc_source),
                ("route_source_value", value(r, 2)),
            ]);
            row
        })
        .collect();
    (out, rare_inn.len())
}

pub(super) fn numbered(key: &'static str, rows: Vec<Row>) -> Vec<Row> {
    rows.into_iter()
        .enumerate()
        .map(|(i, mut r)| {
            r.insert(0, (key, (i + 1).to_string()));
            r
        })
        .collect()
}
