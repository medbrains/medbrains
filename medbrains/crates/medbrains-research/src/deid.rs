//! De-identification of one research extract, pure and testable.
//!
//! In: rows with the patient, birth date, sex, pincode, the event's date and
//! the dataset's own fields. Out: rows a study may hold —
//! * `patient_key`: HMAC-SHA256 of the patient under this export's salt, so
//!   the same patient matches within the export and nowhere else;
//! * `age_band` in five-year bands, 90 and over grouped; `month` instead of
//!   the date; `pincode_prefix` (first three digits) instead of the address;
//! * a category held by fewer than [`K`] patients becomes `Other`;
//! * a row whose age band, sex and pincode prefix are shared by fewer than
//!   [`K`] patients is suppressed and counted (k-anonymity, k = [`K`]);
//! * a row whose fields name a restricted clinical class is left out.

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{Datelike, NaiveDate};
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{Value, json};
use sha2::Sha256;
use uuid::Uuid;

/// Smallest group of patients a released value or row may stand for.
pub const K: usize = 5;
/// Ages at or over this are one band.
const TOP_BAND: i32 = 90;
/// Width of an age band, in years.
const BAND_YEARS: i32 = 5;
/// What a rare category is released as.
pub const OTHER: &str = "Other";
const UNKNOWN: &str = "unknown";

/// How a dataset field is released.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Kind {
    /// A label: rare values become [`OTHER`].
    Category,
    /// A number, released as it is.
    Number,
    /// A number released only as its band: the label of the first
    /// `(below, label)` it is under. Rare bands become [`OTHER`] too.
    Band(&'static [(f64, &'static str)]),
}

/// One dataset field: its column name, kind and dictionary description.
/// A quasi-identifier is counted with age band, sex and pincode prefix in
/// the k-anonymity check.
#[derive(Debug, Clone, Copy)]
pub struct Field {
    pub name: &'static str,
    pub kind: Kind,
    pub description: &'static str,
    pub quasi: bool,
}

impl Field {
    /// A label that is not a quasi-identifier.
    #[must_use]
    pub const fn category(name: &'static str, description: &'static str) -> Self {
        Self {
            name,
            kind: Kind::Category,
            description,
            quasi: false,
        }
    }
}

/// `value` as `kind` releases it, before rare values are folded.
fn shown(kind: Kind, value: Option<&str>) -> String {
    let value = value.map(str::trim).unwrap_or_default();
    match kind {
        Kind::Band(cuts) => value.parse::<f64>().ok().map_or_else(String::new, |n| {
            cuts.iter()
                .find(|(below, _)| n < *below)
                .map_or_else(String::new, |(_, label)| (*label).to_owned())
        }),
        Kind::Category | Kind::Number => value.to_owned(),
    }
}

/// A row as read from the database, before anything is released.
#[derive(Debug, Clone)]
pub struct RawRow {
    pub patient: Uuid,
    pub birth: Option<NaiveDate>,
    pub sex: Option<String>,
    pub pincode: Option<String>,
    pub on: NaiveDate,
    pub values: Vec<Option<String>>,
    /// Text checked for a restricted class but never released (a
    /// diagnosis's name beside its code).
    pub hidden: Option<String>,
}

/// The released rows and what was held back.
#[derive(Debug)]
pub struct Released {
    pub header: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub report: Value,
    pub suppressed_rows: usize,
}

/// `0-4`, `5-9`, … `85-89`, `90+`, or `unknown`.
#[must_use]
pub fn age_band(birth: Option<NaiveDate>, on: NaiveDate) -> String {
    let Some(birth) = birth else {
        return UNKNOWN.to_owned();
    };
    let mut age = on.year() - birth.year();
    if (on.month(), on.day()) < (birth.month(), birth.day()) {
        age -= 1;
    }
    if age < 0 {
        UNKNOWN.to_owned()
    } else if age >= TOP_BAND {
        format!("{TOP_BAND}+")
    } else {
        let low = age / BAND_YEARS * BAND_YEARS;
        format!("{low}-{}", low + BAND_YEARS - 1)
    }
}

/// The first three digits of a six-digit Indian pincode.
#[must_use]
pub fn pincode_prefix(pincode: Option<&str>) -> String {
    match pincode.map(str::trim) {
        Some(p) if p.len() == 6 && p.bytes().all(|b| b.is_ascii_digit()) => p[..3].to_owned(),
        _ => UNKNOWN.to_owned(),
    }
}

/// The patient's key in one export: HMAC-SHA256 under that export's salt.
#[must_use]
pub fn patient_key(salt: &[u8], patient: Uuid) -> String {
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(salt) else {
        return UNKNOWN.to_owned(); // unreachable: HMAC takes a key of any length
    };
    mac.update(patient.as_bytes());
    hex::encode(mac.finalize().into_bytes())[..16].to_owned()
}

/// Whether a row's fields name a restricted clinical class (the same rule
/// that keeps them from the assistant).
fn restricted(fields: &[Field], row: &RawRow) -> bool {
    let mut record = serde_json::Map::new();
    for (f, v) in fields.iter().zip(&row.values) {
        record.insert(f.name.to_owned(), json!(v));
    }
    record.insert("hidden".to_owned(), json!(row.hidden));
    let mut record = Value::Object(record);
    // A fault in the rule is treated as restricted: leave the row out.
    medbrains_core::ai_redact::sensitive::withhold_in_json(&mut record).map_or(true, |n| n > 0)
}

/// Values of each category or band field held by fewer than [`K`] patients.
fn rare_values(fields: &[Field], rows: &[(&RawRow, Vec<String>)]) -> Vec<HashSet<String>> {
    fields
        .iter()
        .enumerate()
        .map(|(i, f)| {
            if f.kind == Kind::Number {
                return HashSet::new();
            }
            let mut holders: HashMap<&str, HashSet<Uuid>> = HashMap::new();
            for (raw, shown) in rows {
                if let Some(v) = shown.get(i).filter(|v| !v.is_empty()) {
                    holders.entry(v.as_str()).or_default().insert(raw.patient);
                }
            }
            holders
                .into_iter()
                .filter(|(_, p)| p.len() < K)
                .map(|(v, _)| v.to_owned())
                .collect()
        })
        .collect()
}

/// Age band, sex, pincode prefix, then every quasi-identifying field.
fn quasi_key(fields: &[Field], (r, shown): &(&RawRow, Vec<String>)) -> Vec<String> {
    let mut key = vec![
        age_band(r.birth, r.on),
        r.sex
            .as_deref()
            .map_or_else(|| UNKNOWN.to_owned(), str::to_lowercase),
        pincode_prefix(r.pincode.as_deref()),
    ];
    key.extend(
        fields
            .iter()
            .zip(shown)
            .filter(|(f, _)| f.quasi)
            .map(|(_, v)| v.clone()),
    );
    key
}

/// The patients behind each combination of quasi-identifiers.
fn patients_per_group(
    fields: &[Field],
    rows: &[(&RawRow, Vec<String>)],
) -> HashMap<Vec<String>, HashSet<Uuid>> {
    let mut groups: HashMap<Vec<String>, HashSet<Uuid>> = HashMap::new();
    for row in rows {
        groups
            .entry(quasi_key(fields, row))
            .or_default()
            .insert(row.0.patient);
    }
    groups
}

/// Release `rows` of a dataset with `fields`, keyed under `salt`, each row
/// stamped with `export_ref`.
#[must_use]
pub fn release(fields: &[Field], rows: Vec<RawRow>, salt: &[u8], export_ref: &str) -> Released {
    let before = rows.len();
    let kept: Vec<RawRow> = rows
        .into_iter()
        .filter(|r| !restricted(fields, r))
        .collect();
    let restricted_rows = before - kept.len();
    let mut rows: Vec<(&RawRow, Vec<String>)> = kept
        .iter()
        .map(|r| {
            let shown = fields
                .iter()
                .zip(&r.values)
                .map(|(f, v)| shown(f.kind, v.as_deref()))
                .collect();
            (r, shown)
        })
        .collect();
    let rare = rare_values(fields, &rows);
    for (_, shown) in &mut rows {
        for (v, rare) in shown.iter_mut().zip(&rare) {
            if rare.contains(v.as_str()) {
                OTHER.clone_into(v);
            }
        }
    }
    let groups = patients_per_group(fields, &rows);
    let small: HashSet<&Vec<String>> = groups
        .iter()
        .filter(|(_, p)| p.len() < K)
        .map(|(g, _)| g)
        .collect();
    let mut out = Vec::with_capacity(rows.len());
    let mut suppressed_patients = HashSet::new();
    for row in &rows {
        let key = quasi_key(fields, row);
        if small.contains(&key) {
            suppressed_patients.insert(row.0.patient);
            continue;
        }
        let (r, shown) = row;
        let mut line = vec![export_ref.to_owned(), patient_key(salt, r.patient)];
        line.extend(key.into_iter().take(3));
        line.push(format!("{:04}-{:02}", r.on.year(), r.on.month()));
        line.extend(shown.iter().cloned());
        out.push(line);
    }
    let suppressed = rows.len() - out.len();
    let mut header: Vec<String> = [
        "export_ref",
        "patient_key",
        "age_band",
        "sex",
        "pincode_prefix",
        "month",
    ]
    .map(str::to_owned)
    .to_vec();
    header.extend(fields.iter().map(|f| f.name.to_owned()));
    let rare_report: BTreeMap<&str, usize> = fields
        .iter()
        .zip(&rare)
        .filter(|(_, r)| !r.is_empty())
        .map(|(f, r)| (f.name, r.len()))
        .collect();
    let mut quasi_names = vec!["age_band", "sex", "pincode_prefix"];
    quasi_names.extend(fields.iter().filter(|f| f.quasi).map(|f| f.name));
    Released {
        header,
        report: json!({
            "k": K,
            "quasi_identifiers": quasi_names,
            "rows_read": before,
            "rows_released": out.len(),
            "restricted_rows_left_out": restricted_rows,
            "rows_suppressed_small_groups": suppressed,
            "patients_suppressed": suppressed_patients.len(),
            "groups_suppressed": small.len(),
            "rare_values_released_as_other": rare_report,
        }),
        rows: out,
        suppressed_rows: suppressed,
    }
}

/// RFC 4180 CSV: every field quoted, quotes doubled.
#[must_use]
pub fn to_csv(header: &[String], rows: &[Vec<String>]) -> String {
    let line = |cells: &[String]| {
        cells
            .iter()
            .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(",")
    };
    let mut out = line(header);
    out.push_str("\r\n");
    for r in rows {
        out.push_str(&line(r));
        out.push_str("\r\n");
    }
    out
}

#[cfg(test)]
#[path = "deid_tests.rs"]
mod tests;
