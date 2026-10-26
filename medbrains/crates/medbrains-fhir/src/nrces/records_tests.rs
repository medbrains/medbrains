//! The four later HI types build bundles their NRCeS profiles accept, and
//! the checker catches what those profiles refuse.

use chrono::{NaiveDate, Utc};
use serde_json::Value;
use uuid::Uuid;

use super::conformance::violations;
use super::sections::{HEALTH_DOCUMENT, IMMUNIZATION};
use super::{
    Clinical, DocumentInput, DocumentLine, EncounterInfo, ImmunizationLine, InvoiceHeader,
    InvoiceItem, Party, RecordKind, Section, VitalsLine, author_reference, document_bundle,
    document_reference, immunization, invoice, vital_observations,
};
use crate::mapper::PatientView;

fn patient() -> PatientView {
    PatientView {
        id: Uuid::new_v4(),
        uhid: "UH-9".into(),
        abha_id: Some("91-1111-2222-3333".into()),
        prefix: None,
        first_name: "Asha".into(),
        middle_name: None,
        last_name: "Rao".into(),
        gender: "female".into(),
        date_of_birth: None,
        phone: None,
        email: None,
        is_active: true,
    }
}

struct Record {
    patient: PatientView,
    nurse: Party,
    hospital: Party,
    visit: Option<EncounterInfo>,
}

impl Record {
    fn new(visit: bool) -> Self {
        Self {
            patient: patient(),
            nurse: Party {
                id: Uuid::new_v4(),
                name: "Sr Meena".into(),
                registry_id: None,
            },
            hospital: Party {
                id: Uuid::new_v4(),
                name: "Main hospital".into(),
                registry_id: Some("IN2410000001".into()),
            },
            visit: visit.then(|| EncounterInfo {
                id: Uuid::new_v4(),
                inpatient: false,
                start: Some(Utc::now()),
                end: None,
            }),
        }
    }

    fn ctx(&self) -> Clinical {
        Clinical {
            patient_id: self.patient.id,
            encounter_id: self.visit.as_ref().map(|v| v.id),
            at: Utc::now(),
            practitioner: author_reference(Some(&self.nurse), &self.hospital),
        }
    }

    fn bundle(&self, kind: RecordKind, sections: Vec<Section>) -> Value {
        document_bundle(&DocumentInput {
            kind,
            id: Uuid::new_v4(),
            date: Utc::now(),
            title: kind.type_display().into(),
            patient: &self.patient,
            author: Some(self.nurse.clone()),
            custodian: self.hospital.clone(),
            encounter: self.visit.clone(),
            sections,
            resources: Vec::new(),
        })
    }
}

fn one(title: &str, code: Option<super::sections::SectionCode>, entries: Vec<Value>) -> Section {
    Section {
        title: title.into(),
        code,
        lines: Vec::new(),
        entries,
    }
}

fn dose(given_elsewhere: bool) -> ImmunizationLine {
    ImmunizationLine {
        id: Uuid::new_v4(),
        vaccine: "Hepatitis B vaccine".into(),
        code: Some("836374004".into()),
        on: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap_or_default(),
        dose: Some(2),
        lot: Some("HB-2231".into()),
        route: Some("intramuscular".into()),
        given_elsewhere,
    }
}

#[test]
fn an_immunization_record_meets_its_profile() {
    let r = Record::new(false);
    let shots = vec![
        immunization(&r.ctx(), &dose(false)),
        immunization(&r.ctx(), &dose(true)),
    ];
    assert_eq!(shots[0]["performer"][0]["actor"]["type"], "Practitioner");
    assert!(
        shots[1].get("performer").is_none(),
        "a dose given elsewhere has no performer here"
    );
    assert_eq!(shots[1]["primarySource"], false);
    let b = r.bundle(
        RecordKind::Immunization,
        vec![one("Immunization record", Some(IMMUNIZATION), shots)],
    );
    super::golden::assert_conformant(&b);
    assert!(
        b["entry"][0]["resource"].get("encounter").is_none(),
        "no visit, no encounter"
    );
}

#[test]
fn a_wellness_record_puts_each_reading_in_its_titled_section() {
    let r = Record::new(true);
    let row = VitalsLine {
        at: Some(Utc::now()),
        temperature_c: Some(37.2),
        pulse: Some(84.0),
        systolic: Some(128.0),
        diastolic: Some(84.0),
        spo2: Some(97.0),
        weight_kg: Some(61.5),
        height_cm: Some(158.0),
        ..VitalsLine::default()
    };
    let (vitals, body) = vital_observations(&r.ctx(), &[row]);
    assert_eq!((vitals.len(), body.len()), (4, 2));
    let bp = vitals
        .iter()
        .find(|o| o["code"]["coding"][0]["code"] == "85354-9");
    assert_eq!(
        bp.map(|o| o["component"].as_array().map_or(0, Vec::len)),
        Some(2)
    );
    let b = r.bundle(
        RecordKind::Wellness,
        vec![
            one("Vital Signs", None, vitals),
            one("Body Measurement", None, body.clone()),
        ],
    );
    super::golden::assert_conformant(&b);
    let wrong = r.bundle(RecordKind::Wellness, vec![one("Vital Signs", None, body)]);
    assert!(
        violations(&wrong)
            .iter()
            .any(|v| v.contains("cannot hold ObservationBodyMeasurement")),
        "a weight is not a vital sign"
    );
}

#[test]
fn a_health_document_record_carries_the_document_inline() {
    let r = Record::new(false);
    let doc = document_reference(
        &r.ctx(),
        &DocumentLine {
            id: Uuid::new_v4(),
            title: "Referral letter".into(),
            content_type: "application/pdf".into(),
            data: "JVBERi0xLjc=".into(),
            created: Utc::now(),
        },
    );
    assert_eq!(doc["content"][0]["attachment"]["data"], "JVBERi0xLjc=");
    let b = r.bundle(
        RecordKind::HealthDocument,
        vec![one("Referral letter", Some(HEALTH_DOCUMENT), vec![doc])],
    );
    super::golden::assert_conformant(&b);
}

#[test]
fn an_invoice_record_itemises_rate_discount_and_gst() {
    let r = Record::new(true);
    let header = InvoiceHeader {
        id: Uuid::new_v4(),
        number: "INV-1042".into(),
        paid: true,
        kind: "03",
        date: Utc::now(),
        currency: "INR".into(),
        net: 1000.0,
        gross: 1120.0,
    };
    let item = InvoiceItem {
        description: "Consultation".into(),
        quantity: 1,
        unit_price: 1000.0,
        discount: 0.0,
        cgst: 60.0,
        sgst: 60.0,
        igst: 0.0,
    };
    let bill = invoice(&r.ctx(), &header, &[item]);
    assert_eq!(bill["status"], "balanced", "a paid bill");
    let parts = &bill["lineItem"][0]["priceComponent"];
    assert_eq!(parts.as_array().map(Vec::len), Some(3), "rate, CGST, SGST");
    assert_eq!(
        invoice(&r.ctx(), &header, &[])["lineItem"]
            .as_array()
            .map(Vec::len),
        Some(1),
        "a bill always has a line"
    );
    let b = r.bundle(RecordKind::Invoice, vec![one("Invoice", None, vec![bill])]);
    super::golden::assert_conformant(&b);
    assert_eq!(b["entry"][0]["resource"]["type"]["text"], "Invoice Record");
}
