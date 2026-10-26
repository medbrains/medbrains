//! ABDM error codes in words a desk can act on.
//!
//! ABDM answers with a code and a terse message ("ABDM-1027", "Invalid
//! TransactionId"), in several body shapes, sometimes with a trailing `": "`
//! on the code. [`describe`] turns any of them into one sentence that says
//! what happened and what to do next, with ABDM's code kept at the end for
//! support. A code we have no words for keeps ABDM's own message.
//!
//! Each code also says whether to send again ([`Retry`]): an outage clears
//! by itself, a refusal needs something changed first, and a duplicate
//! means ABDM already has the request.
//!
//! Codes and ABDM's meanings: NHA's M2 list ("Sandbox2.0 M2 and M3 API
//! review v2", 21 Sep 2026) and the M1 error notes, as catalogued in
//! nha-in/docs 2026.09.16 (`catalogue/hiecm/openapi/v3/errors/m2.yaml`,
//! `site/docs/_notes/hiecm/errors/m1.mdx`, and the per-endpoint notes and
//! M1 OpenAPI examples under `catalogue/hiecm/` for ABDM-1021, 1039, 1054,
//! 1080, 1101, 1124, 1138, 1140, 1157, 1160, 1204, 1207, 1211 and 1224;
//! MIT). Every one of NHA's 118 codes is here. ABDM-1216, ABDM-1308 and
//! ABDM-1114 were observed on the sandbox by OHC care-abdm (MIT,
//! `backend/src/abdm/errors.py`); ABDM-1115 is in NHA's M2 document.
//! Where NHA gives one code two meanings (ABDM-1064, 1108, 1109) the words
//! cover both and the retry is the safe one. The wording is ours.

use serde_json::Value;

use crate::error_codes::PLAIN;

/// Whether a call ABDM refused with this code should be sent again.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Retry {
    /// An outage, a timeout or a rate limit: send the same request again
    /// later, with backoff.
    Later,
    /// The request itself is wrong, or the patient or setup must change
    /// first: sending it again unchanged gets the same answer.
    Fix,
    /// ABDM already has this request (or its answer): do not send it again.
    Duplicate,
}

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

fn entry(code: &str) -> Option<&'static (&'static str, Retry, &'static str)> {
    let code = normalize(code);
    PLAIN
        .binary_search_by(|(c, _, _)| (*c).cmp(code.as_str()))
        .ok()
        .map(|i| &PLAIN[i])
}

/// Our words for `code`, when we have them.
#[must_use]
pub fn plain(code: &str) -> Option<&'static str> {
    entry(code).map(|e| e.2)
}

/// Whether to send again after ABDM refused with `code`; `None` for a code
/// we do not know (the HTTP status decides then).
#[must_use]
pub fn retry(code: &str) -> Option<Retry> {
    entry(code).map(|e| e.1)
}

/// The code [`describe`] put at the end of its sentence, when there is one.
fn code_of(described: &str) -> Option<&str> {
    described
        .strip_suffix(')')?
        .rsplit_once("(code ")
        .map(|(_, code)| code)
}

/// Whether a refusal, as [`describe`] worded it, is an outage to send again
/// later — ABDM reports some (ABDM-1022, ABDM-1048) with a 4xx status.
#[must_use]
pub fn retry_later(described: &str) -> bool {
    code_of(described).and_then(retry) == Some(Retry::Later)
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
    use super::{
        PLAIN, Retry, describe, describe_body, is_deactivated, parse, plain, retry, retry_later,
    };
    use serde_json::json;

    /// The table is searched by halving, so it must stay sorted and unique.
    #[test]
    fn the_table_is_sorted_and_unique() {
        assert!(PLAIN.windows(2).all(|w| w[0].0 < w[1].0));
    }

    /// Every code in NHA's catalogue (nha-in/docs 2026.09.16: the M2 list,
    /// M1 notes and endpoint notes) has our words and a retry rule.
    #[test]
    fn every_nha_code_is_explained() {
        const NHA: &str = include_str!("nha_error_codes.txt");
        let missing: Vec<&str> = NHA
            .lines()
            .filter(|c| !c.is_empty() && plain(c).is_none())
            .collect();
        assert_eq!(missing, Vec::<&str>::new());
        assert_eq!(NHA.lines().filter(|c| !c.is_empty()).count(), 118);
    }

    /// An outage is retried, a refusal waits for a fix, a duplicate is never
    /// resent — including codes NHA gives two meanings.
    #[test]
    fn retry_follows_what_the_code_means() {
        assert_eq!(retry("ABDM-1022"), Some(Retry::Later), "too many requests");
        assert_eq!(retry("ABDM-1000: "), Some(Retry::Later), "database down");
        assert_eq!(retry("ABDM-1013"), Some(Retry::Fix), "wrong ABHA number");
        assert_eq!(retry("ABDM-1027"), Some(Retry::Fix), "blocked for a day");
        assert_eq!(retry("ABDM-1090"), Some(Retry::Duplicate));
        assert_eq!(retry("ABDM-1056"), Some(Retry::Duplicate), "already linked");
        assert_eq!(
            retry("ABDM-1108"),
            Some(Retry::Later),
            "outage or duplicate"
        );
        assert_eq!(retry("ABDM-0000"), None);
    }

    /// The code survives the trip through [`describe`], so a caller that
    /// holds only the sentence still knows an outage from a refusal.
    #[test]
    fn an_outage_is_told_from_a_refusal_by_the_sentence() {
        assert!(retry_later(&describe(
            Some("ABDM-1048"),
            Some("Timeout"),
            "x"
        )));
        assert!(!retry_later(&describe(Some("ABDM-1013"), None, "x")));
        assert!(!retry_later("ABDM said no"));
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
            describe(Some("ABDM-0001"), Some("User not found"), "x"),
            "User not found (code ABDM-0001)"
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
