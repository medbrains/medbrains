//! ABDM error codes in words a desk can act on.
//!
//! ABDM answers with a code and a terse message ("ABDM-1027", "Invalid
//! TransactionId"), in several body shapes, sometimes with a trailing `": "`
//! on the code. [`describe`] turns any of them into one sentence that says
//! what happened and what to do next, with ABDM's code kept at the end for
//! support. A code we have no words for keeps ABDM's own message.
//!
//! Codes and ABDM's meanings: NHA's M2 list ("Sandbox2.0 M2 and M3 API
//! review v2", 21 Sep 2026) and the M1 error notes, as catalogued in
//! nha-in/docs (`catalogue/hiecm/openapi/v3/errors/m2.yaml`,
//! `site/docs/_notes/hiecm/errors/m1.mdx`, MIT). ABDM-1216, ABDM-1308 and
//! ABDM-1114 were observed on the sandbox by OHC care-abdm (MIT,
//! `backend/src/abdm/errors.py`); ABDM-1115 is in NHA's M2 document.
//! The wording is ours.

use serde_json::Value;

/// `(code, what happened and what to do)`. Sorted by code for review.
const PLAIN: &[(&str, &str)] = &[
    (
        "900900",
        "ABDM refused our sign-in. Try again; if it repeats, ask the administrator to check the ABDM keys.",
    ),
    (
        "900901",
        "ABDM did not accept our credentials. Ask the administrator to check the ABDM keys in Settings → ABDM.",
    ),
    (
        "900902",
        "ABDM received no credentials. Ask the administrator to check the ABDM keys in Settings → ABDM.",
    ),
    (
        "ABDM-1001",
        "ABDM found nothing for these details. Check what was entered and try again.",
    ),
    (
        "ABDM-1004",
        "ABDM's SMS service is down, so no SMS could be sent. Try again in a few minutes.",
    ),
    (
        "ABDM-1006",
        "ABDM could not read the request. Check the details entered; if they are right, give this code to support.",
    ),
    ("ABDM-1007", "ABDM timed out. Try again in a minute."),
    (
        "ABDM-1008",
        "ABDM's SMS service is switched off right now. Try again later.",
    ),
    (
        "ABDM-1010",
        "ABDM did not accept the details entered. Check them and try again.",
    ),
    (
        "ABDM-1012",
        "ABDM holds no records for this ABHA address. Check the address with the patient.",
    ),
    (
        "ABDM-1013",
        "ABDM does not recognise this ABHA number. Check the 14 digits with the patient.",
    ),
    (
        "ABDM-1016",
        "Our server clock is out of step with ABDM. Ask the administrator to check the server time.",
    ),
    (
        "ABDM-1017",
        "This ABDM step has expired. Start again from the beginning.",
    ),
    (
        "ABDM-1019",
        "A service ABDM depends on is down. Try again in a few minutes.",
    ),
    (
        "ABDM-1022",
        "ABDM has had too many requests. Wait a minute, then try again.",
    ),
    (
        "ABDM-1023",
        "ABDM does not recognise this person. Check the details with the patient.",
    ),
    (
        "ABDM-1024",
        "A service ABDM depends on is down. Try again in a few minutes.",
    ),
    (
        "ABDM-1025",
        "ABDM does not recognise this hospital's service ID. Ask the administrator to register the bridge in Settings → ABDM.",
    ),
    (
        "ABDM-1026",
        "The patient's linking permission is no longer valid. Link the records again.",
    ),
    (
        "ABDM-1027",
        "ABDM has blocked this ABHA for 24 hours after repeated refusals. Try again tomorrow.",
    ),
    (
        "ABDM-1028",
        "The hospital that holds the records is not answering ABDM. Try again later.",
    ),
    (
        "ABDM-1031",
        "This ABHA address is deactivated. Ask the patient to reactivate it in their ABHA app.",
    ),
    (
        "ABDM-1033",
        "The hospital asking for the records is not answering ABDM. Try again later.",
    ),
    (
        "ABDM-1035",
        "ABDM does not recognise this hospital's HFR facility ID. Ask the administrator to check Settings → ABDM.",
    ),
    (
        "ABDM-1036",
        "The details do not match what ABDM holds. Check them with the patient.",
    ),
    (
        "ABDM-1038",
        "The ABHA address does not match the patient's linking permission. Verify the ABHA again, then link.",
    ),
    (
        "ABDM-1040",
        "ABDM does not recognise this hospital as a records user. Ask the administrator to register the bridge in Settings → ABDM.",
    ),
    (
        "ABDM-1043",
        "The ABHA address does not match the person's Aadhaar details. Check the ABHA with the patient.",
    ),
    (
        "ABDM-1046",
        "ABDM does not accept that purpose. Choose another purpose.",
    ),
    (
        "ABDM-1051",
        "ABDM does not recognise this ABHA number or address. Check it with the patient.",
    ),
    (
        "ABDM-1056",
        "These records are already linked to the patient's ABHA. Nothing more to do.",
    ),
    (
        "ABDM-1057",
        "ABDM did not accept these records. Give this code to support.",
    ),
    (
        "ABDM-1061",
        "The patient's consent has expired. Ask the patient for a new consent.",
    ),
    (
        "ABDM-1062",
        "The patient has not granted consent for this. Ask the patient for consent first.",
    ),
    (
        "ABDM-1063",
        "The dates asked for are outside what the consent allows. Ask for a shorter period.",
    ),
    (
        "ABDM-1065",
        "The patient's ABHA session has ended. Verify the ABHA again.",
    ),
    (
        "ABDM-1066",
        "ABDM refused our sign-in. Try again; if it repeats, ask the administrator to check the ABDM keys.",
    ),
    (
        "ABDM-1084",
        "The ABHA address does not match the patient's ABHA session. Verify the ABHA again.",
    ),
    (
        "ABDM-1085",
        "The ABHA number does not match the patient's ABHA session. Verify the ABHA again.",
    ),
    (
        "ABDM-1092",
        "ABDM refused a second linking request for this patient so soon. Wait about seven minutes, then link again.",
    ),
    (
        "ABDM-1112",
        "The patient's consent was revoked or has expired. Ask the patient for a new consent.",
    ),
    (
        "ABDM-1114",
        "ABDM found no ABHA for these details. Check them with the patient, or create an ABHA.",
    ),
    (
        "ABDM-1115",
        "ABDM needs the patient's details to link the records. Check the patient record, then link again.",
    ),
    (
        "ABDM-1170",
        "ABDM does not recognise this ABHA address. Check the address with the patient.",
    ),
    (
        "ABDM-1201",
        "ABDM's sign-in service is down. Try again in a few minutes.",
    ),
    (
        "ABDM-1216",
        "This ABHA address is deactivated. Ask the patient to reactivate it in their ABHA app.",
    ),
    (
        "ABDM-1308",
        "This ABHA is deactivated. Ask the patient to reactivate it in their ABHA app.",
    ),
    (
        "ABDM-1401",
        "The hospital that holds the records is not answering ABDM. Try again later.",
    ),
    (
        "ABDM-1402",
        "The hospital that holds the records did not reply in time. Try again later.",
    ),
    (
        "ABDM-1407",
        "The ABHA number behind this address is deactivated. Only the patient can reactivate it, in their ABHA app.",
    ),
    (
        "ABDM-2401",
        "The patient's ABHA session is no longer valid. Verify the ABHA again.",
    ),
    (
        "ABDM-2402",
        "Our server clock is out of step with ABDM. Ask the administrator to check the server time.",
    ),
    (
        "ABDM-2403",
        "ABDM did not accept our environment setting. Ask the administrator to check Settings → ABDM.",
    ),
    (
        "ABDM-2406",
        "The ABDM steps were taken out of order. Start again from the beginning.",
    ),
    (
        "ABDM-2429",
        "ABDM has had too many requests. Wait a minute, then try again.",
    ),
    (
        "ABDM-2500",
        "ABDM refused our sign-in. Try again; if it repeats, ask the administrator to check the ABDM keys.",
    ),
];

/// The codes ABDM uses for an ABHA (number or address) that is deactivated
/// or deleted — records cannot be linked to it until the patient acts.
pub const DEACTIVATED_CODES: &[&str] = &["ABDM-1031", "ABDM-1216", "ABDM-1308", "ABDM-1407"];

/// A code without the `": "` ABDM sometimes appends, and upper-cased.
#[must_use]
pub fn normalize(code: &str) -> String {
    code.trim()
        .trim_end_matches(':')
        .trim()
        .to_ascii_uppercase()
}

/// Our words for `code`, when we have them.
#[must_use]
pub fn plain(code: &str) -> Option<&'static str> {
    let code = normalize(code);
    PLAIN
        .binary_search_by(|(c, _)| (*c).cmp(code.as_str()))
        .ok()
        .map(|i| PLAIN[i].1)
}

/// Whether `code` says the ABHA is deactivated or deleted.
#[must_use]
pub fn is_deactivated(code: &str) -> bool {
    DEACTIVATED_CODES.contains(&normalize(code).as_str())
}

/// The code and message out of any ABDM error body: `{error:{code,message}}`,
/// `{code,message}`, `[{code,message}]`, or a field-keyed refusal such as
/// `{"txnId":"Invalid Transaction Id","timestamp":…}` (message only).
#[must_use]
pub fn parse(body: &Value) -> (Option<String>, Option<String>) {
    let node = match body {
        Value::Array(items) => items.first().unwrap_or(&Value::Null),
        other => other,
    };
    let inner = node.get("error").filter(|e| e.is_object()).unwrap_or(node);
    let text = |v: &Value, k: &str| v.get(k).and_then(Value::as_str).map(str::to_owned);
    let code = text(inner, "code")
        .or_else(|| text(node, "code"))
        .map(|c| normalize(&c))
        .filter(|c| !c.is_empty());
    let message = text(inner, "message")
        .or_else(|| text(node, "message"))
        .or_else(|| text(node, "errorMessage"))
        .or_else(|| node.get("error").and_then(Value::as_str).map(str::to_owned))
        .or_else(|| field_refusal(node))
        .map(|m| m.trim().to_owned())
        .filter(|m| !m.is_empty());
    (code, message)
}

/// `{"<field>": "<why>", "timestamp": …}` — ABHA's validation refusals.
fn field_refusal(node: &Value) -> Option<String> {
    node.as_object()?
        .iter()
        .filter(|(k, _)| !matches!(k.as_str(), "timestamp" | "description" | "path" | "status"))
        .find_map(|(_, v)| v.as_str().map(str::to_owned))
}

/// One sentence for staff: our words for the code when we have them, else
/// ABDM's message, else `fallback`; the code is kept for support.
#[must_use]
pub fn describe(code: Option<&str>, message: Option<&str>, fallback: &str) -> String {
    let code = code.map(normalize).filter(|c| !c.is_empty());
    let words = code
        .as_deref()
        .and_then(plain)
        .map(str::to_owned)
        .or_else(|| message.map(str::to_owned))
        .unwrap_or_else(|| fallback.to_owned());
    match code {
        Some(c) => format!("{words} (code {c})"),
        None => words,
    }
}

/// [`describe`] straight from an ABDM body (a response or a callback).
#[must_use]
pub fn describe_body(body: &Value, fallback: &str) -> String {
    let (code, message) = parse(body);
    describe(code.as_deref(), message.as_deref(), fallback)
}

#[cfg(test)]
mod tests {
    use super::{PLAIN, describe, describe_body, is_deactivated, parse, plain};
    use serde_json::json;

    /// The table is searched by halving, so it must stay sorted and unique.
    #[test]
    fn the_table_is_sorted_and_unique() {
        assert!(PLAIN.windows(2).all(|w| w[0].0 < w[1].0));
    }

    /// A code arrives bare, with `": "`, or lower-cased; all read the same.
    #[test]
    fn a_code_is_matched_however_abdm_spells_it() {
        assert!(plain("ABDM-1027").is_some());
        assert_eq!(plain("ABDM-1027: "), plain("abdm-1027"));
        assert!(plain("ABDM-0000").is_none());
    }

    /// Every body shape ABDM uses gives up its code and message.
    #[test]
    fn every_error_shape_is_read() {
        let nested = json!({"error": {"code": "ABDM-1017: ", "message": "Invalid TransactionId"}});
        assert_eq!(
            parse(&nested),
            (
                Some("ABDM-1017".to_owned()),
                Some("Invalid TransactionId".to_owned())
            )
        );
        let flat = json!({"code": "900901", "message": "Invalid Credentials"});
        assert_eq!(parse(&flat).0.as_deref(), Some("900901"));
        let list = json!([{"code": "ABDM-9999: ", "message": "Invalid Transaction Id"}]);
        assert_eq!(parse(&list).0.as_deref(), Some("ABDM-9999"));
        let field =
            json!({"txnId": "Invalid Transaction Id", "timestamp": "2024-12-27T16:14:46.000Z"});
        assert_eq!(
            parse(&field),
            (None, Some("Invalid Transaction Id".to_owned()))
        );
    }

    /// Staff get a fix, with the code for support; an unknown code keeps
    /// ABDM's message; nothing at all gets the fallback, never a raw body.
    #[test]
    fn staff_read_what_to_do_and_the_code() {
        let blocked = describe_body(
            &json!({"error": {"code": "ABDM-1027", "message": "You are blocked"}}),
            "x",
        );
        assert!(blocked.starts_with("ABDM has blocked this ABHA for 24 hours"));
        assert!(blocked.ends_with("(code ABDM-1027)"));
        assert_eq!(
            describe(Some("ABDM-9999"), Some("User not found"), "x"),
            "User not found (code ABDM-9999)"
        );
        assert_eq!(describe(None, None, "ABDM said no"), "ABDM said no");
    }

    #[test]
    fn a_deactivated_abha_is_recognised() {
        assert!(is_deactivated("ABDM-1407: "));
        assert!(is_deactivated("abdm-1031"));
        assert!(!is_deactivated("ABDM-1027"));
    }
}
