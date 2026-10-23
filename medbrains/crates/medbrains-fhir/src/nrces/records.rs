//! The resources of ABDM's four later HI types, each with its NRCeS IG 6.5.0
//! profile: Immunization (ImmunizationRecord), the vital-sign and body
//! measurement Observations (WellnessRecord), DocumentReference
//! (HealthDocumentRecord) and Invoice (InvoiceRecord).
//!
//! Shapes follow the IG's own examples in the pinned `ndhm.in#6.5.0`
//! package (`Bundle-ImmunizationRecord-example-07`, `Bundle-WellnessRecord-
//! example-01`, `Bundle-HealthDocumentRecord-example-01`,
//! `Bundle-InvoiceRecord-example-01`); codes are LOINC for vital signs, SNOMED
//! CT for routes and vaccines, and NRCeS's billing and price-component code
//! systems for invoices.

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{patient_reference, profile, resources::Clinical};
use crate::mapper::{LOINC_SYSTEM, SNOMED_SYSTEM, UCUM_SYSTEM};

const OBSERVATION_CATEGORY: &str = "http://terminology.hl7.org/CodeSystem/observation-category";
const BILLING_CODES: &str = "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-billing-codes";
const PRICE_COMPONENTS: &str = "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-price-components";
const INVOICE_SYSTEM: &str = "https://medbrains.health/invoice";

fn encounter_of(ctx: &Clinical) -> Option<Value> {
    ctx.encounter_id
        .map(|id| json!({ "reference": format!("urn:uuid:{id}"), "type": "Encounter" }))
}

// ── Immunization ──────────────────────────────────────────────────────

/// One dose, as recorded on the chart.
#[derive(Debug, Clone)]
pub struct ImmunizationLine {
    pub id: Uuid,
    pub vaccine: String,
    /// SNOMED CT code of the vaccine, when known.
    pub code: Option<String>,
    pub on: NaiveDate,
    pub dose: Option<i32>,
    pub lot: Option<String>,
    /// `intramuscular` | `subcutaneous` | `intradermal` | `oral` | `intranasal`.
    pub route: Option<String>,
    /// Read off the patient's card, not given here: not a primary source,
    /// and no performer here.
    pub given_elsewhere: bool,
}

/// SNOMED CT routes of administration (the profile fixes the system).
fn route(name: &str) -> Option<(&'static str, &'static str)> {
    Some(match name {
        "intramuscular" => ("78421000", "Intramuscular route"),
        "subcutaneous" => ("34206005", "Subcutaneous route"),
        "intradermal" => ("372464004", "Intradermal route"),
        "oral" => ("26643006", "Oral route"),
        "intranasal" => ("46713006", "Nasal route"),
        _ => return None,
    })
}

/// An `Immunization` for one dose.
#[must_use]
pub fn immunization(ctx: &Clinical, i: &ImmunizationLine) -> Value {
    let vaccine = i.code.as_deref().map_or_else(
        || json!({ "text": i.vaccine }),
        |code| json!({ "coding": [{ "system": SNOMED_SYSTEM, "code": code, "display": i.vaccine }], "text": i.vaccine }),
    );
    let mut r = json!({
        "resourceType": "Immunization", "id": i.id.to_string(), "meta": profile("Immunization"),
        "status": "completed", "vaccineCode": vaccine,
        "patient": patient_reference(ctx.patient_id),
        "occurrenceDateTime": i.on.to_string(),
        "primarySource": !i.given_elsewhere,
    });
    if let Some(e) = encounter_of(ctx) {
        r["encounter"] = e;
    }
    if let Some(lot) = i.lot.as_deref().filter(|l| !l.trim().is_empty()) {
        r["lotNumber"] = json!(lot.trim());
    }
    if let Some((code, display)) = i.route.as_deref().and_then(route) {
        r["route"] =
            json!({ "coding": [{ "system": SNOMED_SYSTEM, "code": code, "display": display }] });
    }
    if !i.given_elsewhere {
        r["performer"] = json!([{ "actor": ctx.practitioner }]);
    }
    if let Some(dose) = i.dose.filter(|d| *d > 0) {
        r["protocolApplied"] = json!([{ "doseNumberPositiveInt": dose }]);
    }
    r
}

// ── Vital signs and body measurements ─────────────────────────────────

/// One `vitals` row.
#[derive(Debug, Clone, Default)]
pub struct VitalsLine {
    pub at: Option<DateTime<Utc>>,
    pub temperature_c: Option<f64>,
    pub pulse: Option<f64>,
    pub systolic: Option<f64>,
    pub diastolic: Option<f64>,
    pub respiratory_rate: Option<f64>,
    pub spo2: Option<f64>,
    pub weight_kg: Option<f64>,
    pub height_cm: Option<f64>,
    pub bmi: Option<f64>,
}

/// `(LOINC, display, UCUM code, unit shown)`.
type Measure = (&'static str, &'static str, &'static str, &'static str);

const TEMPERATURE: Measure = ("8310-5", "Body temperature", "Cel", "°C");
const HEART_RATE: Measure = ("8867-4", "Heart rate", "/min", "beats/minute");
const RESPIRATORY_RATE: Measure = ("9279-1", "Respiratory rate", "/min", "breaths/minute");
const SPO2: Measure = (
    "59408-5",
    "Oxygen saturation in Arterial blood by Pulse oximetry",
    "%",
    "%",
);
const SYSTOLIC: Measure = ("8480-6", "Systolic blood pressure", "mm[Hg]", "mmHg");
const DIASTOLIC: Measure = ("8462-4", "Diastolic blood pressure", "mm[Hg]", "mmHg");
const WEIGHT: Measure = ("29463-7", "Body weight", "kg", "kg");
const HEIGHT: Measure = ("8302-2", "Body height", "cm", "cm");
const BMI: Measure = ("39156-5", "Body mass index (BMI) [Ratio]", "kg/m2", "kg/m2");
const BP_PANEL: (&str, &str) = ("85354-9", "Blood pressure panel with all children optional");

fn loinc(code: &str, display: &str) -> Value {
    json!({ "coding": [{ "system": LOINC_SYSTEM, "code": code, "display": display }], "text": display })
}

fn quantity(value: f64, (_, _, ucum, unit): Measure) -> Value {
    json!({ "value": value, "unit": unit, "system": UCUM_SYSTEM, "code": ucum })
}

fn vital(ctx: &Clinical, profile_name: &str, at: DateTime<Utc>, code: &Value) -> Value {
    let mut r = json!({
        "resourceType": "Observation", "id": Uuid::new_v4().to_string(),
        "meta": profile(profile_name), "status": "final",
        "category": [{ "coding": [{ "system": OBSERVATION_CATEGORY, "code": "vital-signs", "display": "Vital Signs" }] }],
        "code": code, "subject": patient_reference(ctx.patient_id),
        "effectiveDateTime": at.to_rfc3339(),
        "performer": [ctx.practitioner],
    });
    if let Some(e) = encounter_of(ctx) {
        r["encounter"] = e;
    }
    r
}

fn measured(ctx: &Clinical, profile_name: &str, at: DateTime<Utc>, m: Measure, v: f64) -> Value {
    let mut r = vital(ctx, profile_name, at, &loinc(m.0, m.1));
    r["valueQuantity"] = quantity(v, m);
    r
}

/// A visit's readings: `(vital signs, body measurements)`, newest first as
/// given. Blood pressure goes as the LOINC panel with both parts.
#[must_use]
pub fn vital_observations(ctx: &Clinical, rows: &[VitalsLine]) -> (Vec<Value>, Vec<Value>) {
    const VITALS: &str = "ObservationVitalSigns";
    const BODY: &str = "ObservationBodyMeasurement";
    let (mut vitals, mut body) = (Vec::new(), Vec::new());
    for row in rows {
        let at = row.at.unwrap_or(ctx.at);
        let mut push = |m: Measure, v: Option<f64>, into_body: bool| {
            if let Some(v) = v {
                let (list, name) = if into_body {
                    (&mut body, BODY)
                } else {
                    (&mut vitals, VITALS)
                };
                list.push(measured(ctx, name, at, m, v));
            }
        };
        push(TEMPERATURE, row.temperature_c, false);
        push(HEART_RATE, row.pulse, false);
        push(RESPIRATORY_RATE, row.respiratory_rate, false);
        push(WEIGHT, row.weight_kg, true);
        push(HEIGHT, row.height_cm, true);
        push(BMI, row.bmi, true);
        if let Some(v) = row.spo2 {
            // FHIR's vital-signs profile requires LOINC 2708-6 on every
            // oxygen saturation; the pulse-oximetry code goes beside it.
            let mut o = measured(ctx, VITALS, at, SPO2, v);
            o["code"]["coding"] = json!([
                { "system": LOINC_SYSTEM, "code": "2708-6", "display": "Oxygen saturation in Arterial blood" },
                { "system": LOINC_SYSTEM, "code": SPO2.0, "display": SPO2.1 },
            ]);
            vitals.push(o);
        }
        if row.systolic.is_some() || row.diastolic.is_some() {
            let mut bp = vital(ctx, VITALS, at, &loinc(BP_PANEL.0, BP_PANEL.1));
            let parts: Vec<Value> = [(SYSTOLIC, row.systolic), (DIASTOLIC, row.diastolic)]
                .into_iter()
                .filter_map(|(m, v)| {
                    v.map(|v| json!({ "code": loinc(m.0, m.1), "valueQuantity": quantity(v, m) }))
                })
                .collect();
            bp["component"] = Value::Array(parts);
            vitals.push(bp);
        }
    }
    (vitals, body)
}

// ── Health documents ──────────────────────────────────────────────────

/// An uploaded clinical document, with its bytes.
#[derive(Debug, Clone)]
pub struct DocumentLine {
    pub id: Uuid,
    pub title: String,
    pub content_type: String,
    /// Base64 of the file.
    pub data: String,
    pub created: DateTime<Utc>,
}

/// A `DocumentReference` carrying the document inline (the profile
/// requires `content.attachment.data`).
#[must_use]
pub fn document_reference(ctx: &Clinical, d: &DocumentLine) -> Value {
    json!({
        "resourceType": "DocumentReference", "id": d.id.to_string(),
        "meta": profile("DocumentReference"), "status": "current", "docStatus": "final",
        "type": { "text": d.title }, "subject": patient_reference(ctx.patient_id),
        "date": d.created.to_rfc3339(), "author": [ctx.practitioner],
        "content": [{ "attachment": {
            "contentType": d.content_type, "language": "en-IN", "data": d.data,
            "title": d.title, "creation": d.created.to_rfc3339(),
        } }],
    })
}

// ── Invoices ──────────────────────────────────────────────────────────

/// An issued bill.
#[derive(Debug, Clone)]
pub struct InvoiceHeader {
    pub id: Uuid,
    pub number: String,
    pub paid: bool,
    /// NRCeS billing code: `00` consultation, `01` pharmacy, `02` IPD,
    /// `03` OPD, `99` others.
    pub kind: &'static str,
    pub date: DateTime<Utc>,
    pub currency: String,
    /// After discounts, before tax.
    pub net: f64,
    /// What the patient pays.
    pub gross: f64,
}

/// One line of the bill.
#[derive(Debug, Clone)]
pub struct InvoiceItem {
    pub description: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub discount: f64,
    pub cgst: f64,
    pub sgst: f64,
    pub igst: f64,
}

const KIND_DISPLAY: &[(&str, &str)] = &[
    ("00", "Consultation"),
    ("01", "Pharmacy"),
    ("02", "IPD"),
    ("03", "OPD"),
    ("99", "Others"),
];

fn price(kind: &str, (code, display): (&str, &str), value: f64, currency: &str) -> Value {
    json!({ "type": kind,
            "code": { "coding": [{ "system": PRICE_COMPONENTS, "code": code, "display": display }] },
            "amount": { "value": value, "currency": currency } })
}

/// An `Invoice`: one line per item, its rate, discount and GST parts.
/// IGST, which NRCeS's price components do not name, travels as an
/// uncoded tax component.
#[must_use]
pub fn invoice(ctx: &Clinical, h: &InvoiceHeader, items: &[InvoiceItem]) -> Value {
    let cur = h.currency.as_str();
    let display = KIND_DISPLAY
        .iter()
        .find(|(c, _)| *c == h.kind)
        .map_or("Others", |(_, d)| d);
    // A bill always has a line; one with none is sent as a single charge.
    let whole = [InvoiceItem {
        description: "Charges".to_owned(),
        quantity: 1,
        unit_price: h.net,
        discount: 0.0,
        cgst: 0.0,
        sgst: 0.0,
        igst: 0.0,
    }];
    let items = if items.is_empty() { &whole[..] } else { items };
    let lines: Vec<Value> = items
        .iter()
        .enumerate()
        .map(|(n, i)| {
            let mut parts = vec![price("base", ("01", "Rate"), i.unit_price, cur)];
            if i.discount > 0.0 {
                parts.push(price("discount", ("02", "Discount"), i.discount, cur));
            }
            if i.cgst > 0.0 {
                parts.push(price("tax", ("03", "CGST"), i.cgst, cur));
            }
            if i.sgst > 0.0 {
                parts.push(price("tax", ("04", "SGST"), i.sgst, cur));
            }
            if i.igst > 0.0 {
                parts.push(json!({ "type": "tax", "code": { "text": "IGST" },
                                   "amount": { "value": i.igst, "currency": cur } }));
            }
            json!({ "sequence": n + 1,
                    "chargeItemCodeableConcept": { "text": format!("{} × {}", i.description, i.quantity) },
                    "priceComponent": parts })
        })
        .collect();
    json!({
        "resourceType": "Invoice", "id": h.id.to_string(), "meta": profile("Invoice"),
        "identifier": [{ "system": INVOICE_SYSTEM, "value": h.number }],
        "status": if h.paid { "balanced" } else { "issued" },
        "type": { "coding": [{ "system": BILLING_CODES, "code": h.kind, "display": display }] },
        "subject": patient_reference(ctx.patient_id), "date": h.date.to_rfc3339(),
        "participant": [{ "actor": ctx.practitioner }],
        "lineItem": lines,
        "totalNet": { "value": h.net, "currency": cur },
        "totalGross": { "value": h.gross, "currency": cur },
    })
}
