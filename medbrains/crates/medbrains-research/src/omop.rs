//! A research extract as an OMOP CDM v5.4 bundle.
//!
//! The same rows the flat exports read ([`super::datasets`]), de-identified
//! the same way, laid out as OMOP tables (`omop/columns.txt`): `person`,
//! `location`, `observation_period`, `visit_occurrence`,
//! `condition_occurrence`, `measurement` (lab results, and vitals as bands),
//! `drug_exposure` and `cdm_source`, zipped with a README of where this
//! departs from a usual OMOP extract (`omop/README.txt`).
//!
//! * **Persons, not rows, are the unit of k-anonymity.** A person whose age
//!   band (at the period's start), sex and pincode prefix are shared by fewer
//!   than [`K`] people is left out with all their records.
//! * **Dates are months.** Every date is the first day of its month. OMOP
//!   extracts usually shift each person's dates by a random offset instead;
//!   ours are truncated, as in the flat exports, so the two agree.
//! * **Concepts only from licence-free vocabularies** (`omop_concept_map`:
//!   ICD10, LOINC, ATC, `RxNorm`, UCUM). ICD-11 codes, Indian brands and
//!   anything not loaded keep their source value with concept id 0.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::io::Write as _;

use chrono::{Datelike, NaiveDate};
use serde_json::{Value, json};
use uuid::Uuid;

mod tables;

use super::datasets::fields;
use super::deid::{self, K, RawRow};
use tables::{Row, Table, conditions, dated, drugs, measurements, numbered, value, visit_concept};

/// Concept ids of the CDM itself (gender, visit kind, record type), not of a
/// licensed vocabulary.
const MALE: i64 = 8507;
const FEMALE: i64 = 8532;
const EHR: i64 = 32817;
const CDM_V54: i64 = 756_265;

/// `(vocabulary, code)` → `(source concept, standard concept)`.
pub type ConceptMap = HashMap<(String, String), (i64, Option<i64>)>;

/// The rows of each source dataset, as [`super::datasets::read`] returns them.
#[derive(Debug)]
pub struct Sources {
    pub visits: Vec<RawRow>,
    pub diagnoses: Vec<RawRow>,
    pub labs: Vec<RawRow>,
    pub medicines: Vec<RawRow>,
    pub vitals: Vec<RawRow>,
}

/// The zipped bundle, its README and what was held back. An empty `zip`
/// means it could not be written.
#[derive(Debug)]
pub struct Bundle {
    pub zip: Vec<u8>,
    pub readme: String,
    pub report: Value,
    pub rows: usize,
    pub suppressed: usize,
}

/// Vital-sign bands as measurements, by LOINC code, in the vitals dataset's
/// field order.
const VITAL_LOINC: &[&str] = &[
    "8480-6", "8462-4", "8867-4", "8310-5", "59408-5", "9279-1", "39156-5",
];

/// The `(vocabulary, code)` pairs a bundle would look up.
#[must_use]
pub fn codes(s: &Sources) -> Vec<(String, String)> {
    let at = |rows: &[RawRow], i: usize, vocabulary: &str| -> Vec<(String, String)> {
        rows.iter()
            .filter_map(|r| r.values.get(i).cloned().flatten())
            .map(|c| (vocabulary.to_owned(), c))
            .collect()
    };
    let mut out: BTreeSet<(String, String)> = BTreeSet::new();
    out.extend(at(&s.diagnoses, 0, "ICD10"));
    out.extend(at(&s.labs, 0, "LOINC"));
    out.extend(at(&s.medicines, 1, "ATC"));
    out.extend(
        VITAL_LOINC
            .iter()
            .map(|c| ("LOINC".to_owned(), (*c).to_owned())),
    );
    out.into_iter().collect()
}

fn month(d: NaiveDate) -> String {
    format!("{:04}-{:02}-01", d.year(), d.month())
}

/// A year of birth from a five-year age band at `on`: the band's middle.
fn year_of_birth(band: &str, on: NaiveDate) -> String {
    let low = band
        .split(['-', '+'])
        .next()
        .and_then(|n| n.parse::<i32>().ok());
    low.map_or_else(String::new, |low| (on.year() - low - 2).to_string())
}

/// The released persons: their ids, in keyed-hash order, with age band,
/// sex and pincode prefix; and how many were left out for k.
struct People {
    id: HashMap<Uuid, usize>,
    kept: Vec<(String, Uuid, (String, String, String))>,
    dropped: usize,
}

fn people(rows: &[&RawRow], from: NaiveDate, salt: &[u8]) -> People {
    let mut person: BTreeMap<Uuid, (String, String, String)> = BTreeMap::new();
    for r in rows {
        person.entry(r.patient).or_insert_with(|| {
            (
                deid::age_band(r.birth, from),
                r.sex
                    .as_deref()
                    .map_or_else(|| "unknown".to_owned(), str::to_lowercase),
                deid::pincode_prefix(r.pincode.as_deref()),
            )
        });
    }
    let mut groups: HashMap<&(String, String, String), usize> = HashMap::new();
    for q in person.values() {
        *groups.entry(q).or_default() += 1;
    }
    let mut kept: Vec<_> = person
        .iter()
        .filter(|(_, q)| groups[q] >= K)
        .map(|(p, q)| (deid::patient_key(salt, *p), *p, q.clone()))
        .collect();
    kept.sort();
    let id = kept
        .iter()
        .enumerate()
        .map(|(i, (_, p, _))| (*p, i + 1))
        .collect();
    People {
        id,
        dropped: person.len() - kept.len(),
        kept,
    }
}

fn person_tables(p: &People, from: NaiveDate) -> [Table; 2] {
    let zips: BTreeSet<&String> = p.kept.iter().map(|(_, _, q)| &q.2).collect();
    let loc: HashMap<&String, usize> = zips.iter().enumerate().map(|(i, z)| (*z, i + 1)).collect();
    let mut location: Vec<Row> = loc
        .iter()
        .map(|(z, id)| {
            vec![
                ("location_id", id.to_string()),
                ("zip", (*z).clone()),
                ("country_source_value", "IN".to_owned()),
            ]
        })
        .collect();
    location.sort();
    let person = p
        .kept
        .iter()
        .map(|(key, uuid, (band, sex, zip))| {
            let gender = match sex.as_str() {
                "male" => MALE,
                "female" => FEMALE,
                _ => 0,
            };
            vec![
                ("person_id", p.id[uuid].to_string()),
                ("gender_concept_id", gender.to_string()),
                ("year_of_birth", year_of_birth(band, from)),
                ("location_id", loc[zip].to_string()),
                ("person_source_value", key.clone()),
                ("gender_source_value", sex.clone()),
            ]
        })
        .collect();
    [
        Table {
            name: "location",
            rows: location,
        },
        Table {
            name: "person",
            rows: person,
        },
    ]
}

/// `rows` of dataset `name` without those in a restricted class.
fn unrestricted<'a>(name: &str, rows: &'a [RawRow]) -> Vec<&'a RawRow> {
    let f = fields(name).unwrap_or_default();
    rows.iter().filter(|r| !deid::restricted(f, r)).collect()
}

/// Build the bundle for `period` from `sources`, keyed under `salt`.
#[must_use]
#[expect(clippy::too_many_lines, reason = "the CDM tables in order, each a few lines")]
pub fn bundle(
    sources: &Sources,
    map: &ConceptMap,
    salt: &[u8],
    (from, to): (NaiveDate, NaiveDate),
    export_ref: &str,
) -> Bundle {
    let named = [
        ("visits", &sources.visits),
        ("diagnoses", &sources.diagnoses),
        ("labs", &sources.labs),
        ("medicines", &sources.medicines),
        ("vitals", &sources.vitals),
    ];
    let read: usize = named.iter().map(|(_, rows)| rows.len()).sum();
    let parts: Vec<Vec<&RawRow>> = named
        .iter()
        .map(|(n, rows)| unrestricted(n, rows))
        .collect();
    let kept_count: usize = parts.iter().map(Vec::len).sum();
    let every: Vec<&RawRow> = parts.iter().flatten().copied().collect();
    let p = people(&every, from, salt);
    let live = |i: usize| -> Vec<&RawRow> {
        parts
            .get(i)
            .map(|rows| {
                rows.iter()
                    .copied()
                    .filter(|r| p.id.contains_key(&r.patient))
                    .collect()
            })
            .unwrap_or_default()
    };
    let mut span: HashMap<Uuid, (NaiveDate, NaiveDate)> = HashMap::new();
    for r in every.iter().filter(|r| p.id.contains_key(&r.patient)) {
        let e = span.entry(r.patient).or_insert((r.on, r.on));
        *e = (e.0.min(r.on), e.1.max(r.on));
    }
    let observation = p
        .kept
        .iter()
        .map(|(_, u, _)| {
            let (a, b) = span[u];
            vec![
                ("observation_period_id", p.id[u].to_string()),
                ("person_id", p.id[u].to_string()),
                ("observation_period_start_date", month(a)),
                ("observation_period_end_date", month(b)),
                ("period_type_concept_id", EHR.to_string()),
            ]
        })
        .collect();
    let visits = live(0)
        .iter()
        .map(|r| {
            let kind = value(r, 0);
            let mut row = dated(
                p.id[&r.patient].to_string(),
                "visit_start_date",
                r.on,
                "visit_type_concept_id",
            );
            row.extend([
                ("visit_concept_id", visit_concept(&kind).to_string()),
                ("visit_end_date", month(r.on)),
                ("visit_source_value", kind),
            ]);
            row
        })
        .collect();
    let (condition_rows, rare_icd) = conditions(&live(1), map, &p);
    let (measurement_rows, rare_loinc) = measurements(&live(2), &live(4), map, &p);
    let (drug_rows, rare_inn) = drugs(&live(3), map, &p);
    let [location, person] = person_tables(&p, from);
    let mapped = map.values().filter(|(_, s)| s.is_some()).count();
    let vocabulary = if map.is_empty() {
        "none loaded".to_owned()
    } else {
        format!("{mapped} standard concepts from omop_concept_map")
    };
    let today = chrono::Utc::now().date_naive().to_string();
    let cdm_source = vec![vec![
        (
            "cdm_source_name",
            format!("MedBrains research export {export_ref}"),
        ),
        ("cdm_source_abbreviation", "MB".to_owned()),
        (
            "source_description",
            format!("De-identified extract, {from} to {to}; see README.txt"),
        ),
        ("cdm_etl_reference", "medbrains-research omop".to_owned()),
        ("source_release_date", today.clone()),
        ("cdm_release_date", today),
        ("cdm_version", "v5.4".to_owned()),
        ("cdm_version_concept_id", CDM_V54.to_string()),
        ("vocabulary_version", vocabulary),
    ]];
    let tables = [
        location,
        person,
        Table {
            name: "observation_period",
            rows: observation,
        },
        Table {
            name: "visit_occurrence",
            rows: numbered("visit_occurrence_id", visits),
        },
        Table {
            name: "condition_occurrence",
            rows: numbered("condition_occurrence_id", condition_rows),
        },
        Table {
            name: "measurement",
            rows: numbered("measurement_id", measurement_rows),
        },
        Table {
            name: "drug_exposure",
            rows: numbered("drug_exposure_id", drug_rows),
        },
        Table {
            name: "cdm_source",
            rows: cdm_source,
        },
    ];
    let counts: BTreeMap<&str, usize> = tables.iter().map(|t| (t.name, t.rows.len())).collect();
    let released = every
        .iter()
        .filter(|r| p.id.contains_key(&r.patient))
        .count();
    let report = json!({
        "k": K,
        "unit_of_k_anonymity": "person",
        "quasi_identifiers": ["age_band", "sex", "pincode_prefix"],
        "persons_released": p.kept.len(),
        "persons_suppressed": p.dropped,
        "restricted_rows_left_out": read - kept_count,
        "rows_per_table": counts,
        "rare_values_released_as_other": {
            "condition": rare_icd, "measurement_loinc": rare_loinc, "drug_inn": rare_inn
        },
        "concepts_from_map": mapped,
    });
    let readme = format!(
        "{}\nExport {export_ref}: OMOP CDM v5.4, {from} to {to}.\n\nSuppression report\n{}\n",
        include_str!("omop/README.txt"),
        serde_json::to_string_pretty(&report).unwrap_or_default()
    );
    let zip = zip(&tables, &readme);
    Bundle {
        zip,
        readme,
        report,
        rows: tables.iter().map(|t| t.rows.len()).sum(),
        suppressed: every.len() - released,
    }
}

fn zip(tables: &[Table], readme: &str) -> Vec<u8> {
    let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    let mut put = |name: &str, body: &str| -> zip::result::ZipResult<()> {
        writer.start_file(name, options)?;
        writer.write_all(body.as_bytes())?;
        Ok(())
    };
    let mut ok = put("README.txt", readme).is_ok();
    for t in tables {
        ok &= put(&format!("{}.csv", t.name), &t.csv()).is_ok();
    }
    match (ok, writer.finish()) {
        (true, Ok(cursor)) => cursor.into_inner(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
#[path = "omop_tests.rs"]
mod tests;
