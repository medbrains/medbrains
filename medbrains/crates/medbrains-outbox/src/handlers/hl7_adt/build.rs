//! HL7 v2.5 ADT messages, built purely so every event has a golden test.
//! Fields are escaped with the standard encoding characters (`^~\&`); the
//! in-house parser (`medbrains_adapter_sdk::hl7`) reads them back in the
//! tests, so what we write is what a receiver reads.

use chrono::{DateTime, FixedOffset, NaiveDate, Utc};

/// The ADT triggers a destination may subscribe to.
pub const EVENTS: [&str; 7] = ["A01", "A02", "A03", "A04", "A08", "A11", "A13"];

/// India Standard Time, which every timestamp is sent in.
const IST_SECONDS: i32 = 19_800;

/// HL7 2.5 message structure for each trigger (MSH-9.3).
fn structure(event: &str) -> &'static str {
    match event {
        "A02" => "ADT_A02",
        "A03" => "ADT_A03",
        "A11" => "ADT_A09",
        _ => "ADT_A01",
    }
}

/// Who sends to whom (MSH-4, -5, -6), and the message's id and time.
#[derive(Debug)]
pub struct Header<'a> {
    pub sending_facility: &'a str,
    pub receiving_application: &'a str,
    pub receiving_facility: &'a str,
    pub control_id: &'a str,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Default, Clone)]
pub struct Patient {
    pub uhid: String,
    pub first_name: String,
    pub middle_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    /// `male` / `female` / `other`; anything else is sent as `U`.
    pub gender: String,
    pub address_line: String,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub phone: String,
}

/// A ward and bed, as PV1-3 and PV1-6 carry them.
#[derive(Debug, Default, Clone)]
pub struct Location {
    pub ward: String,
    pub bed: String,
}

#[derive(Debug, Default, Clone)]
pub struct Visit {
    /// `I` inpatient, `O` outpatient, `E` emergency.
    pub class: String,
    pub visit_number: String,
    pub location: Option<Location>,
    /// A02: where the patient was before the move.
    pub prior_location: Option<Location>,
    /// The attending doctor's id and name.
    pub attending: Option<(String, String)>,
    pub admitted_at: Option<DateTime<Utc>>,
    pub discharged_at: Option<DateTime<Utc>>,
}

/// HL7 escapes for text placed inside a field; line breaks become spaces.
#[must_use]
pub fn esc(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\E\\"),
            '|' => out.push_str("\\F\\"),
            '^' => out.push_str("\\S\\"),
            '~' => out.push_str("\\R\\"),
            '&' => out.push_str("\\T\\"),
            '\r' | '\n' => out.push(' '),
            c => out.push(c),
        }
    }
    out
}

/// `YYYYMMDDHHMMSS+0530`.
fn ts(at: DateTime<Utc>) -> String {
    FixedOffset::east_opt(IST_SECONDS).map_or_else(
        || at.format("%Y%m%d%H%M%S+0000").to_string(),
        |ist| at.with_timezone(&ist).format("%Y%m%d%H%M%S%z").to_string(),
    )
}

fn location(l: Option<&Location>) -> String {
    l.map(|l| format!("{}^^{}", esc(&l.ward), esc(&l.bed)))
        .unwrap_or_default()
}

fn sex(gender: &str) -> &'static str {
    match gender {
        "male" => "M",
        "female" => "F",
        "other" => "O",
        _ => "U",
    }
}

fn pid(p: &Patient, facility: &str) -> String {
    let dob = p
        .date_of_birth
        .map(|d| d.format("%Y%m%d").to_string())
        .unwrap_or_default();
    let address = if [&p.address_line, &p.city, &p.state, &p.postal_code]
        .iter()
        .all(|s| s.is_empty())
    {
        String::new()
    } else {
        format!(
            "{}^^{}^{}^{}^IND",
            esc(&p.address_line),
            esc(&p.city),
            esc(&p.state),
            esc(&p.postal_code)
        )
    };
    format!(
        "PID|1||{}^^^{}^MR||{}^{}^{}||{dob}|{}|||{address}||{}",
        esc(&p.uhid),
        esc(facility),
        esc(&p.last_name),
        esc(&p.first_name),
        esc(&p.middle_name),
        sex(&p.gender),
        esc(&p.phone),
    )
}

fn pv1(v: &Visit) -> String {
    // PV1 fields 1..=45; index 0 is the segment name.
    let mut f = vec![String::new(); 46];
    f[0] = "PV1".to_owned();
    f[1] = "1".to_owned();
    f[2] = esc(&v.class);
    f[3] = location(v.location.as_ref());
    f[6] = location(v.prior_location.as_ref());
    f[7] = v
        .attending
        .as_ref()
        .map(|(id, name)| format!("{}^{}", esc(id), esc(name)))
        .unwrap_or_default();
    f[19] = esc(&v.visit_number);
    f[44] = v.admitted_at.map(ts).unwrap_or_default();
    f[45] = v.discharged_at.map(ts).unwrap_or_default();
    let mut s = f.join("|");
    while s.ends_with('|') {
        s.pop();
    }
    s
}

/// The ADT message for `event`, segments separated by carriage returns.
#[must_use]
pub fn build(event: &str, h: &Header<'_>, p: &Patient, v: &Visit) -> String {
    let now = ts(h.at);
    format!(
        "MSH|^~\\&|MEDBRAINS|{}|{}|{}|{now}||ADT^{event}^{}|{}|P|2.5\r\
         EVN|{event}|{now}\r\
         {}\r\
         {}\r",
        esc(h.sending_facility),
        esc(h.receiving_application),
        esc(h.receiving_facility),
        structure(event),
        esc(h.control_id),
        pid(p, h.sending_facility),
        pv1(v),
    )
}
