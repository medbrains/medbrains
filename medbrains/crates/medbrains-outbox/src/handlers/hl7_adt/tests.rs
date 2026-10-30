use chrono::{NaiveDate, TimeZone, Utc};
use medbrains_adapter_sdk::hl7;

use super::build::{Header, Location, Patient, Visit, build};

fn header() -> Header<'static> {
    Header {
        sending_facility: "SUNRISE",
        receiving_application: "PACS",
        receiving_facility: "RADIOLOGY",
        control_id: "MB0001",
        at: Utc
            .with_ymd_and_hms(2026, 10, 30, 4, 30, 0)
            .single()
            .unwrap_or_default(),
    }
}

fn patient() -> Patient {
    Patient {
        uhid: "UH-1042".into(),
        first_name: "Lakshmi".into(),
        last_name: "Iyer".into(),
        date_of_birth: NaiveDate::from_ymd_opt(1984, 3, 12),
        gender: "female".into(),
        address_line: "9 Fort Rd".into(),
        city: "Karaikudi".into(),
        state: "TN".into(),
        postal_code: "630001".into(),
        phone: "9840012345".into(),
        ..Patient::default()
    }
}

fn ward(w: &str, b: &str) -> Option<Location> {
    Some(Location {
        ward: w.into(),
        bed: b.into(),
    })
}

fn inpatient() -> Visit {
    Visit {
        class: "I".into(),
        visit_number: "IP-77".into(),
        location: ward("MW2", "12"),
        attending: Some(("DR9".into(), "Ravi Kumar".into())),
        admitted_at: Utc.with_ymd_and_hms(2026, 10, 29, 9, 15, 0).single(),
        ..Visit::default()
    }
}

/// Given Lakshmi Iyer admitted to bed 12 of MW2, When the feed sends A01,
/// Then the message is exactly this — MSH, EVN, PID with UHID and address,
/// PV1 with class, location, attending, visit number and admit time (IST).
#[test]
fn an_admission_is_this_a01() {
    let msg = build("A01", &header(), &patient(), &inpatient());
    assert_eq!(
        msg,
        "MSH|^~\\&|MEDBRAINS|SUNRISE|PACS|RADIOLOGY|20261030100000+0530||ADT^A01^ADT_A01|MB0001|P|2.5\r\
         EVN|A01|20261030100000+0530\r\
         PID|1||UH-1042^^^SUNRISE^MR||Iyer^Lakshmi^||19840312|F|||9 Fort Rd^^Karaikudi^TN^630001^IND||9840012345\r\
         PV1|1|I|MW2^^12||||DR9^Ravi Kumar||||||||||||IP-77|||||||||||||||||||||||||20261029144500+0530\r"
    );
}

/// A move carries the prior bed in PV1-6, and the A02 structure.
#[test]
fn a_transfer_names_where_the_patient_was() {
    let mut v = inpatient();
    v.location = ward("ICU", "3");
    v.prior_location = ward("MW2", "12");
    let msg = build("A02", &header(), &patient(), &v);
    let parsed = hl7::parse(&msg).expect("parses");
    let pv1 = parsed.first("PV1").expect("PV1");
    assert_eq!(parsed.component(pv1, 3, 1), "ICU");
    assert_eq!(parsed.component(pv1, 6, 1), "MW2");
    assert_eq!(parsed.component(pv1, 6, 3), "12");
    let msh = parsed.first("MSH").expect("MSH");
    assert_eq!(parsed.component(msh, 9, 3), "ADT_A02");
}

/// Discharge time is PV1-45; cancel-admit uses the A09 structure; a
/// registration (A04) is an outpatient visit with no bed.
#[test]
fn discharge_cancel_and_registration_carry_their_shape() {
    let mut v = inpatient();
    v.discharged_at = Utc.with_ymd_and_hms(2026, 11, 2, 6, 0, 0).single();
    let a03 = hl7::parse(&build("A03", &header(), &patient(), &v)).expect("A03");
    let pv1 = a03.first("PV1").expect("PV1");
    assert_eq!(a03.text(pv1, 45), "20261102113000+0530");
    let a11 = hl7::parse(&build("A11", &header(), &patient(), &v)).expect("A11");
    assert_eq!(
        a11.component(a11.first("MSH").expect("MSH"), 9, 3),
        "ADT_A09"
    );
    let opd = Visit {
        class: "O".into(),
        visit_number: "OP-5".into(),
        ..Visit::default()
    };
    let a04 = build("A04", &header(), &patient(), &opd);
    assert!(a04.contains("\rPV1|1|O|||||||||||||||||OP-5\r"), "{a04:?}");
}

/// A name with HL7's own separators cannot break the message: it is
/// escaped, and the parser gives back the name as typed.
#[test]
fn separators_in_a_name_are_escaped_and_read_back() {
    let mut p = patient();
    p.last_name = "D'Souza|Pinto^&".into();
    let msg = build("A08", &header(), &p, &inpatient());
    assert!(msg.contains("D'Souza\\F\\Pinto\\S\\\\T\\"), "{msg:?}");
    let parsed = hl7::parse(&msg).expect("parses");
    let pid = parsed.first("PID").expect("PID");
    assert_eq!(parsed.component(pid, 5, 1), "D'Souza|Pinto^&");
    assert_eq!(parsed.all("PID").count(), 1);
}

/// The ACK decides retry: AA done, AR final, AE or no MSA retried.
#[test]
fn the_ack_decides_whether_to_send_again() {
    use super::judge;
    use crate::handler::HandlerError;
    let ack =
        |code: &str| format!("MSH|^~\\&|PACS|RAD|MB|X|20261030||ACK|1|P|2.5\rMSA|{code}|1|why\r");
    assert!(judge(&ack("AA")).is_ok());
    assert!(matches!(judge(&ack("AR")), Err(HandlerError::Permanent(m)) if m.contains("why")));
    assert!(matches!(judge(&ack("AE")), Err(HandlerError::Transient(_))));
    assert!(matches!(judge("not hl7"), Err(HandlerError::Transient(_))));
}
