//! NHCX envelope details that both the outbox (sending) and the callback
//! receiver (reading) need: step codes, `x-hcx-use_case`, the ABHA header
//! form, and timestamps.
//!
//! Source: NHA's NHCX package (docs.abdm.gov.in, `nha-in/nhcx-package`) —
//! "Workflow Codes" and "Envelope Fields", which rule where the base HCX
//! protocol differs.

use chrono::{DateTime, FixedOffset, SecondsFormat, Utc};

/// India Standard Time, UTC+05:30.
const IST_OFFSET_SECONDS: i32 = 5 * 3600 + 30 * 60;

/// The payer's "payment settled" notice — the only one that carries money
/// (30 initiated and 31 processed are status only; the UTR rides on 33).
pub const WORKFLOW_PAYMENT_SETTLED: &str = "33";

/// The step code a pre-authorisation goes under: 12 new, 121 resubmitted
/// after a rejection, 13 enhancement, 14 discharge.
#[must_use]
pub fn preauth_workflow_code(stage: &str, after_rejection: bool) -> &'static str {
    match stage {
        "enhancement" => "13",
        "discharge" => "14",
        _ if after_rejection => "121",
        _ => "12",
    }
}

/// `x-hcx-use_case` for a step code, where the workbook defines one:
/// `New`, `Enhancement` or `Resubmit`.
#[must_use]
pub fn use_case(workflow_code: &str) -> Option<&'static str> {
    match workflow_code {
        "12" | "15" => Some("New"),
        "13" => Some("Enhancement"),
        "121" | "19" | "131" | "151" | "161" => Some("Resubmit"),
        _ => None,
    }
}

/// An ABHA number in the only form `x-hcx-ben-abha-id` takes,
/// `XX-XXXX-XXXX-XXXX`; anything that is not 14 digits is `None` (NHCX
/// refuses other forms with `NHCX-1018`).
#[must_use]
pub fn hyphenated_abha(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(char::is_ascii_digit).collect();
    let other = raw
        .chars()
        .any(|c| !c.is_ascii_digit() && c != '-' && c != ' ');
    if digits.len() != 14 || other {
        return None;
    }
    Some(format!(
        "{}-{}-{}-{}",
        &digits[..2],
        &digits[2..6],
        &digits[6..10],
        &digits[10..]
    ))
}

fn ist(at: DateTime<Utc>) -> DateTime<FixedOffset> {
    // ponytail: the offset is a constant; `east_opt` only fails out of range.
    FixedOffset::east_opt(IST_OFFSET_SECONDS)
        .map_or_else(|| at.fixed_offset(), |offset| at.with_timezone(&offset))
}

/// ISO 8601 in IST, `2026-10-23T14:05:09+05:30` — what every NHA sample
/// carries in `x-hcx-timestamp` and the bundle timestamps. The same instant
/// as the UTC form, so a reader honouring the offset reads it the same.
#[must_use]
pub fn ist_timestamp(at: DateTime<Utc>) -> String {
    ist(at).to_rfc3339_opts(SecondsFormat::Secs, false)
}

/// The receipt's timestamp, day first: `23/10/2026 14:05:09:305` (IST).
#[must_use]
pub fn receipt_timestamp(at: DateTime<Utc>) -> String {
    ist(at).format("%d/%m/%Y %H:%M:%S:%3f").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn timestamps_are_ist() {
        let at = Utc.with_ymd_and_hms(2026, 10, 23, 8, 35, 9).single();
        let at = at.unwrap_or_default();
        assert_eq!(ist_timestamp(at), "2026-10-23T14:05:09+05:30");
        assert_eq!(receipt_timestamp(at), "23/10/2026 14:05:09:000");
    }

    #[test]
    fn abha_is_hyphenated_or_left_out() {
        assert_eq!(
            hyphenated_abha("91711234567890").as_deref(),
            Some("91-7112-3456-7890")
        );
        assert_eq!(
            hyphenated_abha("91-7112-3456-7890").as_deref(),
            Some("91-7112-3456-7890")
        );
        assert_eq!(hyphenated_abha("someone@abdm"), None);
        assert_eq!(hyphenated_abha("1234"), None);
    }

    #[test]
    fn step_codes_follow_the_stage() {
        assert_eq!(preauth_workflow_code("initial", false), "12");
        assert_eq!(preauth_workflow_code("initial", true), "121");
        assert_eq!(preauth_workflow_code("enhancement", true), "13");
        assert_eq!(preauth_workflow_code("discharge", false), "14");
        assert_eq!(use_case("121"), Some("Resubmit"));
        assert_eq!(use_case("1"), None);
    }
}
