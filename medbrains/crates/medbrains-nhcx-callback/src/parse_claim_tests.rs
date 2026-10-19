#![allow(clippy::unwrap_used, clippy::expect_used)]

use super::*;
use serde_json::json;

fn d(s: &str) -> Decimal {
    s.parse().expect("decimal")
}

fn adj(code: &str, amount: u32, reason: Option<(&str, &str)>) -> Value {
    let mut a = json!({
        "category": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/adjudication", "code": code }] },
        "amount": { "value": amount, "currency": "INR" }
    });
    if let Some((code, display)) = reason {
        a["reason"] = json!({ "coding": [{ "code": code, "display": display }] });
    }
    a
}

#[test]
fn a_claim_response_reads_into_submitted_approved_and_deducted_per_line() {
    // Shaped like NRCeS ClaimResponse-settlement-example-01, with one line cut.
    let bundle = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "ClaimResponse", "use": "claim", "outcome": "complete",
        "disposition": "Room rent capped.", "preAuthRef": "123456",
        "item": [
            { "itemSequence": 1, "adjudication": [
                adj("submitted", 20000, None),
                adj("eligpercent", 20000, Some(("covered", "Covered by the policy.")))
            ]},
            { "itemSequence": 2, "adjudication": [
                adj("submitted", 50000, None),
                adj("benefit", 42000, Some(("roomcap", "Room rent above the policy limit")))
            ]}
        ],
        "total": [ adj("submitted", 70000, None), adj("benefit", 62000, None) ]
    }}]});
    let a = adjudication(&bundle).expect("a ClaimResponse");
    assert_eq!(a.use_.as_deref(), Some("claim"));
    assert_eq!(a.submitted, Some(d("70000")));
    assert_eq!(a.approved, Some(d("62000")));
    assert_eq!(a.deducted, Some(d("8000")));
    assert_eq!(a.pre_auth_ref.as_deref(), Some("123456"));
    assert_eq!(a.lines.len(), 2);
    assert_eq!(a.lines[0].deducted, Some(d("0")));
    assert!(
        a.lines[0].reasons.is_empty(),
        "a covered line has no deduction reason"
    );
    assert_eq!(a.lines[1].approved, Some(d("42000")));
    assert_eq!(a.lines[1].deducted, Some(d("8000")));
    assert_eq!(
        a.lines[1].reasons,
        vec!["Room rent above the policy limit".to_owned()]
    );
}

#[test]
fn totals_fall_back_to_the_sum_of_the_lines_and_nothing_is_not_zero() {
    let r = json!({ "resourceType": "ClaimResponse", "outcome": "complete", "item": [
        { "itemSequence": 1, "adjudication": [adj("submitted", 100, None), adj("eligible", 60, None)] },
        { "itemSequence": 2, "adjudication": [adj("submitted", 50, None), adj("eligible", 50, None)] }
    ]});
    let a = adjudication(&r).expect("response");
    assert_eq!(a.submitted, Some(d("150")));
    assert_eq!(a.approved, Some(d("110")));
    assert_eq!(a.deducted, Some(d("40")));
    let queued = adjudication(&json!({ "resourceType": "ClaimResponse", "outcome": "queued" }))
        .expect("response");
    assert_eq!(
        queued.approved, None,
        "an answer without amounts is not an approval of 0"
    );
    assert_eq!(queued.deducted, None);
    assert!(adjudication(&json!({ "resourceType": "Task" })).is_none());
}

#[test]
fn a_search_answer_lists_each_claim_by_the_payers_claim_number() {
    // Shaped like NRCeS TaskBundleForSearchResponse-example-01.
    let bundle = json!({ "resourceType": "Bundle", "entry": [
        { "resource": { "resourceType": "Task", "status": "completed",
            "description": "search result for the Claim No. - 761234674365",
            "output": [{ "valueReference": { "reference": "urn:uuid:cr-1" } }] } },
        { "resource": { "resourceType": "ClaimResponse", "id": "cr-1", "outcome": "complete",
            "request": { "reference": "urn:uuid:claim-1" },
            "total": [adj("submitted", 90000, None), adj("eligpercent", 90000, None)] } },
        { "resource": { "resourceType": "Claim", "id": "claim-1",
            "identifier": [{ "value": "761234674365" }, { "value": "344536545" }] } }
    ]});
    let r = task_result(&bundle);
    assert_eq!(r.task_status.as_deref(), Some("completed"));
    assert_eq!(r.claims.len(), 1);
    assert_eq!(r.claims[0].claim_ref.as_deref(), Some("761234674365"));
    assert_eq!(r.claims[0].approved, Some(d("90000")));
    assert_eq!(r.claims[0].outcome.as_deref(), Some("complete"));
}

#[test]
fn a_task_reply_reads_its_status_output_in_words() {
    let r = task_result(&json!({ "resourceType": "Task", "status": "rejected",
        "output": [{ "valueCodeableConcept": { "coding": [{ "code": "x", "display": "Already settled" }] } }] }));
    assert_eq!(r.task_status.as_deref(), Some("rejected"));
    assert_eq!(r.outcome.as_deref(), Some("Already settled"));
    assert!(r.claims.is_empty());
}

#[test]
fn a_payment_notice_reads_utr_and_per_claim_approved_amount_and_tds() {
    // Shaped like NRCeS TaskBundleForPaymentNoticeRequest-example-01.
    let detail = |claim: &str, code: &str, amount: u32| {
        json!({
            "identifier": { "value": claim },
            "type": { "coding": [{ "system": "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-payment-type", "code": code }] },
            "amount": { "value": amount, "currency": "INR" }
        })
    };
    let bundle = json!({ "resourceType": "Bundle", "entry": [
        { "resource": { "resourceType": "Task", "status": "requested" } },
        { "resource": { "resourceType": "PaymentNotice", "identifier": [{ "value": "776543" }],
            "paymentDate": "2025-03-07", "amount": { "value": 180000 } } },
        { "resource": { "resourceType": "PaymentReconciliation", "paymentDate": "2025-03-07",
            "paymentAmount": { "value": 180000, "currency": "INR" },
            "paymentIdentifier": { "value": "UTRNUMBER2920287229" },
            "detail": [
                detail("CLAIMREFNUM7612345", "approvedAmount", 90000),
                detail("CLAIMREFNUM7612345", "tds", 9000),
                detail("CLAIMREFNUM6789054", "approvedAmount", 110000),
                detail("CLAIMREFNUM6789054", "tds", 11000)
            ] } }
    ]});
    let n = payment_notice(&bundle);
    assert_eq!(n.reference.as_deref(), Some("UTRNUMBER2920287229"));
    assert_eq!(n.identifier.as_deref(), Some("776543"));
    assert_eq!(n.date, NaiveDate::from_ymd_opt(2025, 3, 7));
    assert_eq!(n.amount, Some(d("180000")));
    assert_eq!(
        n.lines,
        vec![
            PaymentLine {
                claim_ref: Some("CLAIMREFNUM7612345".into()),
                gross: d("90000"),
                tds: d("9000")
            },
            PaymentLine {
                claim_ref: Some("CLAIMREFNUM6789054".into()),
                gross: d("110000"),
                tds: d("11000")
            },
        ]
    );
    let net: Decimal = n.lines.iter().map(|l| l.gross - l.tds).sum();
    assert_eq!(
        Some(net),
        n.amount,
        "the transfer is the approved amounts less TDS"
    );
}

#[test]
fn a_notice_without_details_is_one_payment_naming_no_claim() {
    let n = payment_notice(&json!({ "resourceType": "PaymentNotice", "amount": { "value": 500 } }));
    assert_eq!(
        n.lines,
        vec![PaymentLine {
            claim_ref: None,
            gross: d("500"),
            tds: d("0")
        }]
    );
    assert!(payment_notice(&json!({})).lines.is_empty());
}
