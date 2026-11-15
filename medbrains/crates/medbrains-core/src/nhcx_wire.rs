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

// ── Workflow codes (`x-hcx-workflow_id`) ────────────────────────────────────
//
// Source: docs.abdm.gov.in/docs/nhcx/v1/concepts/workflow-codes, which
// renders NHA's Workflow Status Sheet from `nha-in/nhcx-package`
// `workflow.yaml`. Every code MedBrains sends is a constant here and a row of
// [`SENT_WORKFLOW_CODES`]; a test holds the producers to that table.

/// A claim (cashless), "Claim Request Initiated".
pub const WF_CLAIM: &str = "15";
/// The answer to a pre-auth query (24), "Preauth Query Response Submitted".
pub const WF_PREAUTH_QUERY_ANSWER: &str = "19";
/// The answer to an enhancement query (241), "Enhancement Query Response
/// Submitted".
pub const WF_ENHANCEMENT_QUERY_ANSWER: &str = "131";
/// The answer to a discharge query (263), "Discharge Query Response
/// Submitted".
pub const WF_DISCHARGE_QUERY_ANSWER: &str = "141";
/// The answer to a claim query (27), "Claim Query Response Submitted".
pub const WF_CLAIM_QUERY_ANSWER: &str = "151";
/// The answer to a claim query asking for documents, "Claim Doc Query
/// Response" (PMJAY takes only this one for a claim query).
pub const WF_CLAIM_DOC_QUERY_ANSWER: &str = "161";
/// The answer to a final-bill query (47), "Final Bill Query Response".
pub const WF_FINAL_BILL_QUERY_ANSWER: &str = "181";
/// The answer to a reimbursement claim query (R27).
pub const WF_REIMBURSEMENT_QUERY_ANSWER: &str = "R151";
/// Withdrawing a pre-authorisation, "Preauthorization Cancellation", sent as
/// a `cancel` Task.
pub const WF_PREAUTH_CANCEL: &str = "PC01";
/// The payer's "Preauthorization Cancellation Accomplished".
pub const WF_PREAUTH_CANCELLED: &str = "PC02";
/// A claim reprocess Task.
///
/// The sheet's stage name for 36 is "Claim Arbitration Intimation", but NHA's
/// own `workflow.yaml` (the source the docs page is built from) files 36 under
/// `use_case: Reprocess`: "Reprocess/Erroneous request, with input
/// `intimationNumber`; acknowledged on 37". Its "Cancel, reprocess and
/// shortfall" reference sends the reprocess Task "on /v1/task/submit, workflow
/// 36". 121 is a pre-auth resubmission and R122 a reimbursement reprocess;
/// neither fits a cashless claim. One constant, so a sheet change is one edit.
pub const WF_CLAIM_REPROCESS: &str = "36";

/// Every code this hospital sends, with the stage the Workflow Status Sheet
/// names for it (spelling as published on docs.abdm.gov.in).
pub const SENT_WORKFLOW_CODES: [(&str, &str); 17] = [
    ("12", "Preauth Request Initiated"),
    ("121", "Preauth Reprocess (Resubmission) Intimation"),
    ("13", "Enhancement Request Initiated"),
    ("14", "Discharge Submitted"),
    (WF_CLAIM, "Claim Request Initiated"),
    (WF_PREAUTH_QUERY_ANSWER, "Preauth Query Response Submitted"),
    (
        WF_ENHANCEMENT_QUERY_ANSWER,
        "Enhancement Query Response Submitted",
    ),
    (
        WF_DISCHARGE_QUERY_ANSWER,
        "Discharge Query Response Submitted",
    ),
    (WF_CLAIM_QUERY_ANSWER, "Claim Query Response Submitted"),
    (WF_CLAIM_DOC_QUERY_ANSWER, "Claim Doc Query Response"),
    (WF_FINAL_BILL_QUERY_ANSWER, "Final Bill Query Response"),
    (
        WF_REIMBURSEMENT_QUERY_ANSWER,
        "Reimbursement Claim Query Response Submitted",
    ),
    (WF_PREAUTH_CANCEL, "Preauthorization Cancellation"),
    (WF_CLAIM_REPROCESS, "Claim Arbitration Intimation"),
    ("30", "Payment Notice Ack Success"),
    ("31", "Payment Processed"),
    (WORKFLOW_PAYMENT_SETTLED, "Payment Settled"),
];

/// What the payer's query is about, where its own code is missing.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueryAbout {
    Preauth,
    Claim,
}

/// The code an answer to a payer's query goes under.
///
/// It is the sheet's response code for the payer's query code (24 → 19,
/// 241 → 131, 263 → 141, 27 → 151, 47 → 181, R27 → R151), never the payer's
/// own code echoed. A claim query that asks for documents is answered as a claim document query (161).
/// A query with no code, or one the sheet does not pair, is answered by what
/// it is about: 19 on a pre-auth, 151/161 on a claim.
#[must_use]
pub fn query_answer_code(
    payer_code: Option<&str>,
    about: QueryAbout,
    asks_documents: bool,
) -> &'static str {
    let claim_answer = if asks_documents {
        WF_CLAIM_DOC_QUERY_ANSWER
    } else {
        WF_CLAIM_QUERY_ANSWER
    };
    match payer_code.map(str::trim) {
        Some("24") => WF_PREAUTH_QUERY_ANSWER,
        Some("241") => WF_ENHANCEMENT_QUERY_ANSWER,
        Some("263") => WF_DISCHARGE_QUERY_ANSWER,
        Some("47") => WF_FINAL_BILL_QUERY_ANSWER,
        Some("R27") => WF_REIMBURSEMENT_QUERY_ANSWER,
        Some("27") => claim_answer,
        _ if about == QueryAbout::Claim => claim_answer,
        _ => WF_PREAUTH_QUERY_ANSWER,
    }
}

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
    /// The sheet's stage for a code MedBrains sends, if it is in the table.
    fn stage(code: &str) -> Option<&'static str> {
        SENT_WORKFLOW_CODES
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, s)| *s)
    }

    #[test]
    fn every_code_sent_is_in_the_sheet_table() {
        let stages = ["initial", "enhancement", "discharge"];
        let mut produced: Vec<&str> = stages
            .iter()
            .flat_map(|s| {
                [
                    preauth_workflow_code(s, false),
                    preauth_workflow_code(s, true),
                ]
            })
            .collect();
        for code in [
            None,
            Some("24"),
            Some("241"),
            Some("263"),
            Some("27"),
            Some("47"),
        ]
        .into_iter()
        .chain([Some("R27"), Some("99")])
        {
            for about in [QueryAbout::Preauth, QueryAbout::Claim] {
                produced.push(query_answer_code(code, about, false));
                produced.push(query_answer_code(code, about, true));
            }
        }
        for code in produced {
            assert!(
                stage(code).is_some(),
                "{code} is not in SENT_WORKFLOW_CODES"
            );
        }
        let mut codes: Vec<&str> = SENT_WORKFLOW_CODES.iter().map(|(c, _)| *c).collect();
        codes.sort_unstable();
        codes.dedup();
        assert_eq!(
            codes.len(),
            SENT_WORKFLOW_CODES.len(),
            "a code appears twice"
        );
    }

    #[test]
    fn a_query_is_answered_with_the_sheets_response_code_not_its_own() {
        let pa = QueryAbout::Preauth;
        let claim = QueryAbout::Claim;
        assert_eq!(query_answer_code(Some("24"), pa, false), "19");
        assert_eq!(query_answer_code(Some("241"), pa, true), "131");
        assert_eq!(query_answer_code(Some("27"), claim, false), "151");
        assert_eq!(query_answer_code(Some("27"), claim, true), "161");
        assert_eq!(query_answer_code(Some("263"), pa, false), "141");
        assert_eq!(query_answer_code(Some("47"), claim, false), "181");
        assert_eq!(query_answer_code(Some("R27"), claim, false), "R151");
        // No code from the payer: by what the query is about.
        assert_eq!(query_answer_code(None, pa, true), "19");
        assert_eq!(query_answer_code(None, claim, false), "151");
        assert_eq!(query_answer_code(Some(" "), claim, true), "161");
        assert_eq!(stage("19"), Some("Preauth Query Response Submitted"));
        assert_eq!(stage("161"), Some("Claim Doc Query Response"));
        assert_eq!(stage("PC01"), Some("Preauthorization Cancellation"));
    }
}
