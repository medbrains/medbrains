//! Golden tests: NHA's own sample payer messages (`nha-in/nhcx-package`,
//! `fhir/C5`, `C7`, `C9`, `C10`, copied unchanged into `nha_samples/`) read
//! into the decision the desk sees. Each is read with the step code NHA
//! files it under, and — where the sample carries a claim-level status
//! reason — without it, as a payer that leaves the optional header out.

use rust_decimal::Decimal;
use serde_json::Value;

use crate::parse::{Decision, approved_amount, decision};
use crate::parse_claim::payment_notice;

fn sample(json: &str) -> Value {
    serde_json::from_str(json).unwrap_or(Value::Null)
}

macro_rules! nha {
    ($file:literal) => {
        sample(include_str!(concat!("../nha_samples/", $file)))
    };
}

fn dec(v: i64) -> Option<Decimal> {
    Some(Decimal::from(v))
}

#[test]
fn every_nha_preauth_and_claim_answer_reads_as_nha_means_it() {
    let cases: [(&str, Value, &str, Decision); 12] = [
        (
            "C5 received",
            nha!("C5-received-wf20.json"),
            "20",
            Decision::Received,
        ),
        (
            "C5 approved",
            nha!("C5-approved-wf21.json"),
            "21",
            Decision::Approved,
        ),
        (
            "C5 approved PMJAY",
            nha!("C5-approved-wf21-pmjay.json"),
            "21",
            Decision::Approved,
        ),
        (
            "C5 queried",
            nha!("C5-queried-wf24.json"),
            "24",
            Decision::Queried,
        ),
        (
            "C5 queried, generic",
            nha!("preauth-queried.json"),
            "24",
            Decision::Queried,
        ),
        (
            "C5 rejected",
            nha!("C5-rejected-wf23.json"),
            "23",
            Decision::Rejected,
        ),
        (
            "C5 rejected PMJAY",
            nha!("C5-rejected-wf23-pmjay.json"),
            "23",
            Decision::Rejected,
        ),
        (
            "C7 received",
            nha!("C7-received-wf25.json"),
            "25",
            Decision::Received,
        ),
        (
            "C7 approved",
            nha!("C7-approved-wf26.json"),
            "26",
            Decision::Approved,
        ),
        (
            "C7 queried",
            nha!("C7-queried-wf27.json"),
            "27",
            Decision::Queried,
        ),
        (
            "C7 rejected",
            nha!("C7-rejected-wf291.json"),
            "291",
            Decision::Rejected,
        ),
        (
            "C10 cancelled",
            nha!("C10-cancelled-wfPC02.json"),
            "PC02",
            Decision::Cancelled,
        ),
    ];
    for (name, payload, workflow, want) in &cases {
        let got = decision(payload, Some(workflow), "response.complete", None);
        assert_eq!(got, *want, "{name} under {workflow}");
    }
}

#[test]
fn without_the_step_code_the_status_reason_still_decides() {
    let cases: [(&str, Value, Decision); 6] = [
        (
            "C5 queried",
            nha!("C5-queried-wf24.json"),
            Decision::Queried,
        ),
        (
            "C5 rejected",
            nha!("C5-rejected-wf23.json"),
            Decision::Rejected,
        ),
        (
            "C5 approved",
            nha!("C5-approved-wf21.json"),
            Decision::Approved,
        ),
        (
            "C7 queried",
            nha!("C7-queried-wf27.json"),
            Decision::Queried,
        ),
        (
            "C7 rejected",
            nha!("C7-rejected-wf291.json"),
            Decision::Rejected,
        ),
        (
            "C10 cancelled",
            nha!("C10-cancelled-wfPC02.json"),
            Decision::Cancelled,
        ),
    ];
    for (name, payload, want) in &cases {
        assert_eq!(
            decision(payload, None, "response.complete", None),
            *want,
            "{name}"
        );
    }
    // Outcome partial, no step code, no reason: not an approval, not a
    // query either — unreadable, and shown as such.
    let bare = nha!("preauth-queried.json");
    assert_eq!(
        decision(&bare, None, "response.complete", None),
        Decision::Unknown
    );
}

#[test]
fn a_query_is_never_an_approval_even_with_a_benefit_total() {
    let queried = nha!("C5-queried-wf24.json");
    assert_eq!(
        approved_amount(&queried),
        dec(2070),
        "the sample carries a benefit"
    );
    let got = decision(&queried, Some("24"), "request.initiated", dec(1725));
    assert!(!got.is_approval());
}

#[test]
fn the_approval_is_the_benefit_never_the_plan_eligible() {
    // PMJAY: benefit 1725, eligible 3795.
    assert_eq!(
        approved_amount(&nha!("C5-approved-wf21-pmjay.json")),
        dec(1725)
    );
    let asked_more = decision(
        &nha!("C5-approved-wf21.json"),
        Some("21"),
        "response.complete",
        dec(200_000),
    );
    assert_eq!(asked_more, Decision::PartiallyApproved);
}

#[test]
fn nhas_payment_notice_reads_as_net_plus_tds_on_its_claim_number() {
    let n = payment_notice(&nha!("C9-notice-wf30.json"));
    assert_eq!(n.reference.as_deref(), Some("UTR1789064619092"));
    assert_eq!(n.lines.len(), 1, "the TDS and Payment lines are one claim");
    let line = &n.lines[0];
    assert_eq!(line.claim_ref.as_deref(), Some("NM-26-0SE00002L"));
    assert_eq!(
        line.gross,
        Decimal::from(150_000),
        "135,000 paid + 15,000 TDS"
    );
    assert_eq!(line.tds, Decimal::from(15_000));
}
