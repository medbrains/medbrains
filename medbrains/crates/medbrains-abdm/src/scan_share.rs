//! ABDM Scan & Share: the counter QR a patient scans with their ABHA app, the
//! profile the gateway then delivers to us, and where we answer it.
//!
//! *Inferred* (no official document could be fetched; confirm in the sandbox
//! before go-live — every one is a constant here so the fix is one line):
//! - the QR is a link to ABDM's PHR web app carrying `hip-id` and
//!   `counter-id`, which ABHA apps recognise and open as "share profile";
//! - the gateway posts the shared profile to [`CB_PROFILE_SHARE`] with the
//!   counter code in `metaData.context`, the patient in `profile.patient`;
//! - we answer at [`ON_SHARE_PATH`] with `acknowledgement.profile.tokenNumber`
//!   and `expiry` (seconds, as a string).
//!
//! Field names fall back to the v1 (`healthId*`) spellings, so a sandbox that
//! still speaks v1 parses too.

use serde::Serialize;
use serde_json::Value;

use crate::abha::AbdmEnvironment;

/// Where the gateway delivers a shared profile (relative to our HIP base URL).
pub const CB_PROFILE_SHARE: &str = "/api/v3/hip/patient/share";
/// Where we answer a profile share with the token number.
pub const ON_SHARE_PATH: &str = "/api/hiecm/patient-share/v3/on-share";
/// The PHR app's "share profile" page a counter QR opens, per environment.
pub const SANDBOX_SHARE_PROFILE_URL: &str = "https://phrsbx.abdm.gov.in/share-profile";
pub const PRODUCTION_SHARE_PROFILE_URL: &str = "https://phr.abdm.gov.in/share-profile";

/// The text a counter's QR encodes: the PHR share link naming the HIP and
/// the counter. `None` only for an empty HIP ID or counter code.
#[must_use]
pub fn counter_qr_payload(env: AbdmEnvironment, hip_id: &str, counter: &str) -> Option<String> {
    let (hip_id, counter) = (hip_id.trim(), counter.trim());
    if hip_id.is_empty() || counter.is_empty() {
        return None;
    }
    let base = match env {
        AbdmEnvironment::Sandbox => SANDBOX_SHARE_PROFILE_URL,
        AbdmEnvironment::Production => PRODUCTION_SHARE_PROFILE_URL,
    };
    reqwest::Url::parse_with_params(base, &[("hip-id", hip_id), ("counter-id", counter)])
        .ok()
        .map(String::from)
}

/// A shared ABHA profile, in our shape.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct SharedProfile {
    /// 14 digits, when the app sent one.
    pub abha_number: Option<String>,
    /// Lower-cased; every share carries one.
    pub abha_address: String,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    /// `male`, `female` or `other` — our patient values.
    pub gender: Option<String>,
    /// `YYYY-MM-DD` when the whole date was shared.
    pub date_of_birth: Option<String>,
    pub year_of_birth: Option<String>,
    pub mobile: Option<String>,
    pub address: Option<String>,
    pub district: Option<String>,
    pub state: Option<String>,
    pub pincode: Option<String>,
    /// The counter's code from the QR (`metaData.context`).
    pub counter: Option<String>,
}

fn text(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|k| {
        match &v[*k] {
            Value::String(s) => Some(s.trim().to_owned()),
            Value::Number(n) => Some(n.to_string()),
            _ => None,
        }
        .filter(|s| !s.is_empty())
    })
}

fn gender(code: &str) -> &'static str {
    match code.trim().to_ascii_uppercase().as_str() {
        "M" | "MALE" => "male",
        "F" | "FEMALE" => "female",
        _ => "other",
    }
}

fn whole_date(p: &Value) -> Option<String> {
    let year = text(p, &["yearOfBirth"])?.parse::<i32>().ok()?;
    let month = text(p, &["monthOfBirth"])?.parse::<u32>().ok()?;
    let day = text(p, &["dayOfBirth"])?.parse::<u32>().ok()?;
    chrono::NaiveDate::from_ymd_opt(year, month, day).map(|d| d.to_string())
}

/// First, middle and last from the parts the app sent, or from the full
/// name split on spaces (first word, last word, the rest in between).
fn name_parts(p: &Value, full: Option<&str>) -> [Option<String>; 3] {
    let first = text(p, &["firstName"]);
    if first.is_some() {
        return [first, text(p, &["middleName"]), text(p, &["lastName"])];
    }
    let words: Vec<&str> = full.unwrap_or_default().split_whitespace().collect();
    match words.as_slice() {
        [] => [None, None, None],
        [one] => [Some((*one).to_owned()), None, None],
        [first, middle @ .., last] => [
            Some((*first).to_owned()),
            Some(middle.join(" ")).filter(|m| !m.is_empty()),
            Some((*last).to_owned()),
        ],
    }
}

fn address_text(a: &Value) -> Option<String> {
    match a {
        Value::String(s) => Some(s.trim().to_owned()).filter(|s| !s.is_empty()),
        Value::Object(_) => text(a, &["line", "addressLine"]),
        _ => None,
    }
}

/// The profile in a share callback, or `None` when it names no ABHA address.
#[must_use]
pub fn parse_share(body: &Value) -> Option<SharedProfile> {
    let p = &body["profile"]["patient"];
    let abha_address = text(p, &["abhaAddress", "healthId", "id"])?.to_lowercase();
    let abha_number = text(p, &["abhaNumber", "healthIdNumber"])
        .map(|n| n.chars().filter(char::is_ascii_digit).collect::<String>())
        .filter(|n| n.len() == 14);
    let full_name = text(p, &["name"]);
    let [first_name, middle_name, last_name] = name_parts(p, full_name.as_deref());
    let address = &p["address"];
    let pick = |keys: &[&str]| text(address, keys).or_else(|| text(p, keys));
    Some(SharedProfile {
        abha_number,
        abha_address,
        first_name,
        middle_name,
        last_name,
        full_name,
        gender: text(p, &["gender"]).map(|g| gender(&g).to_owned()),
        date_of_birth: whole_date(p),
        year_of_birth: text(p, &["yearOfBirth"]),
        mobile: text(p, &["phoneNumber", "mobile"]),
        address: address_text(address),
        district: pick(&["district", "districtName"]),
        state: pick(&["state", "stateName"]),
        pincode: pick(&["pincode"]),
        counter: text(&body["metaData"], &["context", "counterId"]),
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{AbdmEnvironment, counter_qr_payload, parse_share};

    #[test]
    fn a_counter_qr_names_the_hip_and_counter() {
        let qr = counter_qr_payload(AbdmEnvironment::Sandbox, " IN2710001275 ", "REG 1&2");
        assert_eq!(
            qr.as_deref(),
            Some(
                "https://phrsbx.abdm.gov.in/share-profile?hip-id=IN2710001275&counter-id=REG+1%262"
            )
        );
        let live = counter_qr_payload(AbdmEnvironment::Production, "IN1", "R1").unwrap_or_default();
        assert!(live.starts_with("https://phr.abdm.gov.in/share-profile?"));
        assert_eq!(counter_qr_payload(AbdmEnvironment::Sandbox, "", "R1"), None);
        assert_eq!(
            counter_qr_payload(AbdmEnvironment::Sandbox, "IN1", " "),
            None
        );
    }

    #[test]
    fn a_v3_share_parses_into_our_shape() {
        let body = json!({
            "intent": "PROFILE_SHARE",
            "metaData": { "hipId": "IN2710001275", "context": "REG1" },
            "profile": { "patient": {
                "abhaNumber": "91-1234-5678-9012", "abhaAddress": "Priya.V@sbx",
                "name": "Priya  Kumari Varude", "gender": "F",
                "dayOfBirth": "26", "monthOfBirth": "11", "yearOfBirth": "1989",
                "phoneNumber": "9876543210",
                "address": { "line": "12 MG Road", "district": "Pune", "state": "Maharashtra",
                             "pincode": "411001" },
            } },
        });
        let p = parse_share(&body).unwrap_or_default();
        assert_eq!(p.abha_number.as_deref(), Some("91123456789012"));
        assert_eq!(p.abha_address, "priya.v@sbx");
        assert_eq!(
            (
                p.first_name.as_deref(),
                p.middle_name.as_deref(),
                p.last_name.as_deref()
            ),
            (Some("Priya"), Some("Kumari"), Some("Varude"))
        );
        assert_eq!(p.gender.as_deref(), Some("female"));
        assert_eq!(p.date_of_birth.as_deref(), Some("1989-11-26"));
        assert_eq!(p.district.as_deref(), Some("Pune"));
        assert_eq!(p.address.as_deref(), Some("12 MG Road"));
        assert_eq!(p.counter.as_deref(), Some("REG1"));
    }

    /// A partial date stays a year, a bad ABHA number is dropped, v1 names
    /// parse, and a share naming no ABHA address is refused.
    #[test]
    fn partial_and_v1_shares() {
        let body = json!({ "profile": { "patient": {
            "healthId": "ravi@abdm", "healthIdNumber": "123", "name": "Ravi",
            "gender": "M", "yearOfBirth": 1970,
        } } });
        let p = parse_share(&body).unwrap_or_default();
        assert_eq!(p.abha_address, "ravi@abdm");
        assert_eq!(p.abha_number, None);
        assert_eq!(p.first_name.as_deref(), Some("Ravi"));
        assert_eq!(p.last_name, None);
        assert_eq!(p.date_of_birth, None);
        assert_eq!(p.year_of_birth.as_deref(), Some("1970"));
        assert_eq!(p.counter, None);
        assert_eq!(
            parse_share(&json!({ "profile": { "patient": { "name": "X" } } })),
            None
        );
    }
}
