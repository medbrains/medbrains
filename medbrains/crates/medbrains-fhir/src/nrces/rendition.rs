//! The PDF rendition every shared structured record carries (ABDM M2,
//! `HIP_INIT_SHARE_CARECONTEXT`): what the printed copy says, read from the
//! bundle itself so it can never disagree with the structured data, and
//! where the IG 6.5.0 profile lets the PDF go.
//!
//! Placement, per profile:
//! - `OPConsultRecord`, `DischargeSummaryRecord`: their `DocumentReference`
//!   section slice (371530004 / 373942005), before the trailing narratives
//!   no slice covers (`openAtEnd`).
//! - `WellnessRecord`: its `Document Reference` titled slice.
//! - `PrescriptionRecord`: a `Binary` section entry (its only non-drug slice).
//! - `DiagnosticReportRecord`, `ImmunizationRecord`: a `DocumentReference`
//!   section entry.
//! - `HealthDocumentRecord` already is a document; `InvoiceRecord` stays
//!   structured only. Neither gets one.

use std::collections::HashMap;

use chrono::NaiveDate;
use serde_json::{Value, json};
use uuid::Uuid;

use super::sections::{self, SectionCode};
use super::{RecordKind, entry, profile, reference};
use crate::mapper::{ABHA_SYSTEM, UHID_SYSTEM};

/// The kind a bundle's Composition claims, from its profile.
fn kind_of(bundle: &Value) -> Option<RecordKind> {
    let name = bundle["entry"][0]["resource"]["meta"]["profile"][0]
        .as_str()?
        .rsplit('/')
        .next()?;
    RecordKind::ALL
        .into_iter()
        .find(|k| k.profile_name() == name)
}

/// Whether a record of this kind is shared with a PDF rendition.
#[must_use]
pub const fn has_rendition(kind: RecordKind) -> bool {
    !matches!(kind, RecordKind::HealthDocument | RecordKind::Invoice)
}

/// Each bundle entry's resource by its `fullUrl`.
fn resources(bundle: &Value) -> HashMap<&str, &Value> {
    bundle["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| Some((e["fullUrl"].as_str()?, &e["resource"])))
        .collect()
}

/// The paragraphs of a narrative `div` our builder wrote (`<p>` per line),
/// unescaped back to the words.
fn paragraphs(div: &str) -> Vec<String> {
    div.split("<p>")
        .skip(1)
        .filter_map(|p| p.split("</p>").next())
        .map(|p| {
            p.replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
        })
        .collect()
}

/// A concept's words: its text, else its first coding's display.
fn words(concept: &Value) -> String {
    concept["text"]
        .as_str()
        .or_else(|| concept["coding"][0]["display"].as_str())
        .unwrap_or_default()
        .to_owned()
}

/// `value unit` of a Quantity, or a string value.
fn value_of(r: &Value) -> Option<String> {
    let q = &r["valueQuantity"];
    if let Some(n) = q["value"].as_f64() {
        let unit = q["unit"].as_str().unwrap_or_default();
        return Some(format!("{n} {unit}").trim_end().to_owned());
    }
    r["valueString"].as_str().map(str::to_owned)
}

/// One Observation as a line: name, value (blood pressure from its
/// components) and reference range.
fn observation_line(r: &Value) -> String {
    let value = value_of(r).or_else(|| {
        let parts: Vec<String> = r["component"]
            .as_array()?
            .iter()
            .filter_map(value_of)
            .collect();
        (!parts.is_empty()).then(|| parts.join(" / "))
    });
    let mut line = format!("{}: {}", words(&r["code"]), value.unwrap_or_default());
    if let Some(range) = r["referenceRange"][0]["text"].as_str() {
        line = format!("{line} (range {range})");
    }
    line
}

/// The printed lines of one section entry; a lab report brings its results.
fn entry_lines(r: &Value, by_url: &HashMap<&str, &Value>) -> Vec<String> {
    match r["resourceType"].as_str().unwrap_or_default() {
        "Condition" => vec![words(&r["code"])],
        "MedicationRequest" => {
            let how = r["dosageInstruction"][0]["text"]
                .as_str()
                .unwrap_or_default();
            vec![format!(
                "{} — {how}",
                words(&r["medicationCodeableConcept"])
            )]
        }
        "Observation" => vec![observation_line(r)],
        "DiagnosticReport" => {
            let mut out: Vec<String> = r["result"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|x| by_url.get(x["reference"].as_str()?))
                .map(|o| observation_line(o))
                .collect();
            if let Some(c) = r["conclusion"].as_str() {
                out.push(format!("Conclusion: {c}"));
            }
            out
        }
        "Immunization" => {
            let mut line = format!(
                "{} on {}",
                words(&r["vaccineCode"]),
                r["occurrenceDateTime"].as_str().unwrap_or_default()
            );
            if let Some(dose) = r["protocolApplied"][0]["doseNumberPositiveInt"].as_u64() {
                line = format!("{line}, dose {dose}");
            }
            if let Some(lot) = r["lotNumber"].as_str() {
                line = format!("{line}, lot {lot}");
            }
            vec![line]
        }
        _ => Vec::new(),
    }
}

/// The identifier value under `system`, if the resource has one.
fn identifier<'a>(r: &'a Value, system: &str) -> Option<&'a str> {
    r["identifier"]
        .as_array()?
        .iter()
        .find(|i| i["system"] == system)?["value"]
        .as_str()
}

/// The patient block: name, age on `today`, gender, mobile, ABHA number.
fn patient_block(p: &Value, today: NaiveDate) -> Value {
    let age = p["birthDate"]
        .as_str()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .and_then(|dob| today.years_since(dob))
        .map(|y| format!("{y} years"));
    let phone = p["telecom"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|t| t["system"] == "phone")
        .and_then(|t| t["value"].as_str());
    json!({
        "name": p["name"][0]["text"], "gender": p["gender"], "age": age, "mobile": phone,
        "uhid": identifier(p, UHID_SYSTEM), "abha_number": identifier(p, ABHA_SYSTEM),
    })
}

/// What a record's printed copy shows, as the print template's `record`
/// context: patient (name, age, gender, mobile, ABHA number; the caller
/// adds `abha_address`), the doctor (`id`, `name`; the caller adds
/// `speciality`), the hospital and each section's lines. `None` for a kind
/// shared without a rendition.
#[must_use]
pub fn rendition(bundle: &Value, today: NaiveDate) -> Option<Value> {
    let kind = kind_of(bundle).filter(|k| has_rendition(*k))?;
    let by_url = resources(bundle);
    let c = &bundle["entry"][0]["resource"];
    let get = |r: &Value| by_url.get(r["reference"].as_str()?).copied();
    let patient = get(&c["subject"]).map_or(Value::Null, |p| patient_block(p, today));
    let doctor = get(&c["author"][0])
        .filter(|a| a["resourceType"] == "Practitioner")
        .map_or(
            Value::Null,
            |a| json!({ "id": a["id"], "name": a["name"][0]["text"] }),
        );
    let section_lines = |s: &Value| -> Vec<String> {
        let mut lines = paragraphs(s["text"]["div"].as_str().unwrap_or_default());
        let entries = s["entry"].as_array().into_iter().flatten();
        lines.extend(
            entries
                .filter_map(get)
                .flat_map(|r| entry_lines(r, &by_url)),
        );
        lines
    };
    let sections: Vec<Value> = c["section"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|s| json!({ "title": s["title"], "lines": section_lines(s) }))
        .collect();
    let date: String = c["date"]
        .as_str()
        .unwrap_or_default()
        .chars()
        .take(10)
        .collect();
    Some(json!({ "record": {
        "kind": kind.type_display(), "title": c["title"], "date": date, "patient": patient,
        "doctor": doctor, "hospital": get(&c["custodian"]).map_or(Value::Null, |o| o["name"].clone()),
        "sections": sections,
    } }))
}

/// The section a PDF opens in `OPConsultRecord` / `DischargeSummaryRecord`.
const fn document_slice(kind: RecordKind) -> Option<SectionCode> {
    match kind {
        RecordKind::OpConsult => Some(sections::OP_DOCUMENT),
        RecordKind::DischargeSummary => Some(sections::DISCHARGE_DOCUMENT),
        _ => None,
    }
}

/// The resource the PDF travels in: a `Binary` for a prescription (its
/// profile's slice), a `DocumentReference` for the rest, typed and dated as
/// the record is.
fn pdf_resource(kind: RecordKind, c: &Value, pdf_base64: &str) -> Value {
    let id = Uuid::new_v4().to_string();
    if kind == RecordKind::Prescription {
        return json!({ "resourceType": "Binary", "id": id, "contentType": "application/pdf",
                       "data": pdf_base64 });
    }
    json!({
        "resourceType": "DocumentReference", "id": id, "meta": profile("DocumentReference"),
        "status": "current", "docStatus": "final", "type": c["type"], "subject": c["subject"],
        "date": c["date"], "author": c["author"],
        "content": [{ "attachment": {
            "contentType": "application/pdf", "language": "en-IN", "data": pdf_base64,
            "title": c["title"], "creation": c["date"],
        } }],
    })
}

/// Put the PDF rendition in the bundle where its profile takes one (see the
/// module docs). Returns `false`, changing nothing, for a kind shared
/// without one or a bundle that is not one of ours.
pub fn attach_pdf(bundle: &mut Value, pdf_base64: &str) -> bool {
    let Some(kind) = kind_of(bundle).filter(|k| has_rendition(*k)) else {
        return false;
    };
    let resource = pdf_resource(kind, &bundle["entry"][0]["resource"], pdf_base64);
    let link = reference(&resource);
    let Some(list) = bundle["entry"][0]["resource"]["section"].as_array_mut() else {
        return false;
    };
    match (kind, document_slice(kind)) {
        (_, Some(SectionCode(system, code, display))) => {
            // Before the first trailing narrative: sliced sections come first.
            let at = list
                .iter()
                .position(|s| {
                    sections::UNSLICED
                        .iter()
                        .any(|u| s["code"]["coding"][0]["code"] == u.1)
                })
                .unwrap_or(list.len());
            list.insert(
                at,
                json!({ "title": display, "entry": [link],
                "code": { "coding": [{ "system": system, "code": code, "display": display }] } }),
            );
        }
        (RecordKind::Wellness, None) => {
            list.push(json!({ "title": sections::WELLNESS_DOCUMENT_TITLE, "entry": [link] }));
        }
        _ => {
            let Some(only) = list.first_mut() else {
                return false;
            };
            if !only["entry"].is_array() {
                only["entry"] = json!([]);
            }
            if let Some(entries) = only["entry"].as_array_mut() {
                entries.push(link);
            }
        }
    }
    if let Some(entries) = bundle["entry"].as_array_mut() {
        entries.push(entry(&resource));
    }
    true
}
