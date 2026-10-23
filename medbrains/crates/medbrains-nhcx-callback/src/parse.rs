//! Reading the payer's answer out of a decrypted NHCX message —
//! `CoverageEligibilityResponse`, `ClaimResponse` and `CommunicationRequest`
//! (`NRCeS` NHCX IG profiles), found as the payload itself or inside its bundle.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The first resource of one of `types`: the payload itself, or an entry of
/// its bundle.
pub(crate) fn find_resource<'a>(payload: &'a Value, types: &[&str]) -> Option<&'a Value> {
    let is_wanted = |r: &Value| {
        r.get("resourceType")
            .and_then(Value::as_str)
            .is_some_and(|t| types.contains(&t))
    };
    if is_wanted(payload) {
        return Some(payload);
    }
    payload
        .get("entry")?
        .as_array()?
        .iter()
        .filter_map(|e| e.get("resource"))
        .find(|r| is_wanted(r))
}

const RESPONSES: &[&str] = &["ClaimResponse", "CoverageEligibilityResponse"];

fn text_of(resource: &Value, key: &str) -> Option<String> {
    resource
        .get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .map(str::to_owned)
}

/// FHIR `outcome` — `queued`, `complete`, `error` or `partial`.
pub(crate) fn outcome(payload: &Value) -> Option<String> {
    text_of(find_resource(payload, RESPONSES)?, "outcome")
}

/// The payer's own words about its decision.
pub(crate) fn disposition(payload: &Value) -> Option<String> {
    text_of(find_resource(payload, RESPONSES)?, "disposition")
}

/// `ClaimResponse.preAuthRef` — the payer's authorisation number.
pub(crate) fn pre_auth_ref(payload: &Value) -> Option<String> {
    text_of(find_resource(payload, &["ClaimResponse"])?, "preAuthRef")
}

/// A protocol error's message (`x-hcx-error_details`), when the payer or the
/// gateway sent one instead of a FHIR answer.
pub(crate) fn protocol_error(payload: &Value) -> Option<String> {
    let details = payload.get("x-hcx-error_details")?;
    text_of(details, "message").or_else(|| text_of(details, "code"))
}

/// The payer's approved amount — `ClaimResponse.total` with category
/// `benefit`, read from the JSON number exactly. `eligible` names what the
/// member's plan allows and can differ (NHA C5: 1725 benefit, 3795
/// eligible), so it is never read as the approval.
pub(crate) fn approved_amount(payload: &Value) -> Option<Decimal> {
    let resource = find_resource(payload, RESPONSES)?;
    resource.get("total")?.as_array()?.iter().find_map(|total| {
        let is_benefit = total
            .get("category")?
            .get("coding")?
            .as_array()?
            .iter()
            .filter_map(|c| c.get("code").and_then(Value::as_str))
            .any(|code| code == "benefit");
        let value = total.get("amount")?.get("value")?;
        is_benefit
            .then(|| value.to_string().parse::<Decimal>().ok())
            .flatten()
    })
}

/// What the payer decided, read from the step code, the claim-level
/// adjudication status and the FHIR outcome together — never from the
/// outcome alone (NHA "Preauthorisation Response", rule 1).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Decision {
    /// Acknowledged, under review (20, 25, 28, 29, 251, 37).
    Received,
    Approved,
    PartiallyApproved,
    Rejected,
    /// The payer asked for more (24, 241, 27, 254, 263) — no approval at all.
    Queried,
    Cancelled,
    /// A protocol error instead of an answer.
    Error,
    /// An answer this cannot read safely; shown as such, never as success.
    Unknown,
}

impl Decision {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Received => "received",
            Self::Approved => "approved",
            Self::PartiallyApproved => "partially_approved",
            Self::Rejected => "rejected",
            Self::Queried => "queried",
            Self::Cancelled => "cancelled",
            Self::Error => "error",
            Self::Unknown => "unknown",
        }
    }

    /// A decision that closes the question (an approval, a refusal or a
    /// cancellation); a late acknowledgement never reopens it.
    pub(crate) const fn is_final(self) -> bool {
        matches!(
            self,
            Self::Approved | Self::PartiallyApproved | Self::Rejected | Self::Cancelled
        )
    }

    pub(crate) const fn is_approval(self) -> bool {
        matches!(self, Self::Approved | Self::PartiallyApproved)
    }
}

/// The step code's meaning (NHA Workflow Status Sheet).
fn by_workflow(code: &str) -> Option<Decision> {
    Some(match code {
        "24" | "241" | "27" | "254" | "263" | "R27" | "R254" => Decision::Queried,
        "23" | "231" | "291" | "253" | "262" | "491" | "R291" | "R253" => Decision::Rejected,
        "PC02" => Decision::Cancelled,
        "21" | "22" | "26" | "252" | "261" | "46" | "R26" | "R252" => Decision::Approved,
        "20" | "25" | "28" | "29" | "251" | "37" | "18" | "R28" => Decision::Received,
        _ => return None,
    })
}

/// The claim-level `adjudication` with category `status`: its reason
/// (`queried`, `rejected`, `approved`, `cancelled`, `submitted`).
fn by_reason(resource: &Value) -> Option<Decision> {
    let reason = resource
        .get("adjudication")?
        .as_array()?
        .iter()
        .filter(|a| {
            a.pointer("/category/coding")
                .and_then(Value::as_array)
                .is_some_and(|c| {
                    c.iter()
                        .any(|c| c.get("code") == Some(&Value::from("status")))
                })
        })
        .find_map(|a| a.pointer("/reason/coding/0/code").and_then(Value::as_str))?;
    Some(match reason.to_ascii_lowercase().as_str() {
        "queried" => Decision::Queried,
        "rejected" | "denied" => Decision::Rejected,
        "cancelled" => Decision::Cancelled,
        "approved" => Decision::Approved,
        "submitted" | "requested" | "received" => Decision::Received,
        _ => return None,
    })
}

/// An approval carries its amount: less than asked is a partial approval;
/// an "approval" of nothing cannot be read as one.
fn approval(approved: Option<Decimal>, requested: Option<Decimal>) -> Decision {
    match (approved, requested) {
        (Some(a), _) if a <= Decimal::ZERO => Decision::Unknown,
        (None, _) => Decision::Unknown,
        (Some(a), Some(r)) if a < r => Decision::PartiallyApproved,
        _ => Decision::Approved,
    }
}

/// Read the payer's decision. A query wins over everything (a queried
/// pre-auth carries a benefit total, and is not approved); a refusal over
/// an approval; an answer with no step code and no status reason falls back
/// to the FHIR outcome, where only `complete` decides.
pub(crate) fn decision(
    payload: &Value,
    workflow: Option<&str>,
    hcx_status: &str,
    requested: Option<Decimal>,
) -> Decision {
    let Some(resource) = find_resource(payload, &["ClaimResponse"]) else {
        return if hcx_status == "response.error" {
            Decision::Error
        } else {
            Decision::Unknown
        };
    };
    let signals = [workflow.and_then(by_workflow), by_reason(resource)];
    let has = |d: Decision| signals.contains(&Some(d));
    let approved = approved_amount(payload);
    for d in [Decision::Queried, Decision::Rejected, Decision::Cancelled] {
        if has(d) {
            return d;
        }
    }
    if has(Decision::Approved) {
        return approval(approved, requested);
    }
    if has(Decision::Received) {
        return Decision::Received;
    }
    match text_of(resource, "outcome").as_deref() {
        Some("queued") => Decision::Received,
        Some("complete") if approved.is_none_or(|a| a <= Decimal::ZERO) => Decision::Rejected,
        Some("complete") => approval(approved, requested),
        _ if hcx_status == "response.error" => Decision::Error,
        _ => Decision::Unknown,
    }
}

/// A `CodeableConcept` in words: its text, else the first coding's display or
/// code.
fn concept_text(concept: Option<&Value>) -> Option<String> {
    let concept = concept?;
    text_of(concept, "text").or_else(|| {
        let coding = concept.get("coding")?.as_array()?.first()?;
        text_of(coding, "display").or_else(|| text_of(coding, "code"))
    })
}

/// One benefit line of an eligibility answer.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub(crate) struct NhcxBenefitLine {
    /// `item.category` — e.g. medical care, room rent.
    pub(crate) category: Option<String>,
    /// `item.name` or `item.productOrService`.
    pub(crate) name: Option<String>,
    /// `benefit.type` — e.g. benefit, copay, room-limit.
    pub(crate) benefit_type: Option<String>,
    /// Allowed: a number for money or units, else the payer's words.
    pub(crate) allowed: Option<Value>,
    /// Used so far, in the same form.
    pub(crate) used: Option<Value>,
    pub(crate) currency: Option<String>,
}

/// The payer's eligibility answer, as stored on the check.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub(crate) struct NhcxEligibilityResult {
    pub(crate) outcome: Option<String>,
    /// `insurance.inforce`; `None` when the payer did not say.
    pub(crate) in_force: Option<bool>,
    pub(crate) coverage_start: Option<String>,
    pub(crate) coverage_end: Option<String>,
    pub(crate) disposition: Option<String>,
    pub(crate) benefits: Vec<NhcxBenefitLine>,
    /// The payer's or gateway's errors, in their words.
    pub(crate) errors: Vec<String>,
}

/// `allowed[x]` / `used[x]`: Money, unsignedInt or string.
fn benefit_value(benefit: &Value, prefix: &str) -> (Option<Value>, Option<String>) {
    if let Some(money) = benefit.get(format!("{prefix}Money")) {
        return (money.get("value").cloned(), text_of(money, "currency"));
    }
    let value = benefit
        .get(format!("{prefix}UnsignedInt"))
        .or_else(|| benefit.get(format!("{prefix}String")))
        .cloned();
    (value, None)
}

fn benefit_lines(item: &Value) -> Vec<NhcxBenefitLine> {
    let category = concept_text(item.get("category"));
    let name = text_of(item, "name").or_else(|| concept_text(item.get("productOrService")));
    let benefits = item.get("benefit").and_then(Value::as_array);
    benefits
        .into_iter()
        .flatten()
        .map(|b| {
            let (allowed, allowed_currency) = benefit_value(b, "allowed");
            let (used, used_currency) = benefit_value(b, "used");
            NhcxBenefitLine {
                category: category.clone(),
                name: name.clone(),
                benefit_type: concept_text(b.get("type")),
                allowed,
                used,
                currency: allowed_currency.or(used_currency),
            }
        })
        .collect()
}

/// Read an `on_check` reply into in force / benefits / period / errors.
pub(crate) fn eligibility_result(payload: &Value) -> NhcxEligibilityResult {
    let mut result = NhcxEligibilityResult {
        errors: protocol_error(payload).into_iter().collect(),
        ..NhcxEligibilityResult::default()
    };
    let Some(resource) = find_resource(payload, &["CoverageEligibilityResponse"]) else {
        return result;
    };
    result.outcome = text_of(resource, "outcome");
    result.disposition = text_of(resource, "disposition");
    let insurance = resource.get("insurance").and_then(Value::as_array);
    for ins in insurance.into_iter().flatten() {
        if let Some(inforce) = ins.get("inforce").and_then(Value::as_bool) {
            result.in_force = Some(result.in_force.unwrap_or(false) || inforce);
        }
        if let Some(period) = ins.get("benefitPeriod") {
            result.coverage_start = result.coverage_start.or_else(|| text_of(period, "start"));
            result.coverage_end = result.coverage_end.or_else(|| text_of(period, "end"));
        }
        let items = ins.get("item").and_then(Value::as_array);
        result
            .benefits
            .extend(items.into_iter().flatten().flat_map(benefit_lines));
    }
    let errors = resource.get("error").and_then(Value::as_array);
    result.errors.extend(
        errors
            .into_iter()
            .flatten()
            .filter_map(|e| concept_text(e.get("code"))),
    );
    result
}

/// `insurance_verifications.status` for the answer. A payer still working on
/// it leaves the check pending; an answer that does not say whether the
/// policy is in force is `unknown`, never `inactive`.
pub(crate) fn verification_status(result: &NhcxEligibilityResult) -> &'static str {
    match (result.in_force, result.outcome.as_deref()) {
        (Some(true), _) => "active",
        (Some(false), _) => "inactive",
        (None, Some("queued")) => "pending",
        (None, Some("error")) => "error",
        (None, _) if !result.errors.is_empty() => "error",
        (None, _) => "unknown",
    }
}

/// What a payer asked for in a `communication/request`.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct PayerQuestion {
    pub(crate) question: String,
    pub(crate) requested_items: Vec<String>,
    pub(crate) due_at: Option<DateTime<Utc>>,
}

/// Read a `CommunicationRequest`: its text payloads are the question, its
/// attachment titles and reason codes the documents asked for, and
/// `occurrenceDateTime` the due time.
pub(crate) fn payer_question(payload: &Value) -> PayerQuestion {
    let resource = find_resource(payload, &["CommunicationRequest"]).unwrap_or(&Value::Null);
    let parts = resource.get("payload").and_then(Value::as_array);
    let mut texts = Vec::new();
    let mut items = Vec::new();
    for part in parts.into_iter().flatten() {
        if let Some(t) = text_of(part, "contentString") {
            texts.push(t);
        }
        if let Some(t) = part
            .get("contentAttachment")
            .and_then(|a| text_of(a, "title"))
        {
            items.push(t);
        }
    }
    let reasons = resource.get("reasonCode").and_then(Value::as_array);
    items.extend(
        reasons
            .into_iter()
            .flatten()
            .filter_map(|r| concept_text(Some(r))),
    );
    let question = if texts.is_empty() {
        "The payer asked for more information.".to_owned()
    } else {
        texts.join("\n")
    };
    let due_at = text_of(resource, "occurrenceDateTime")
        .and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
        .map(|d| d.with_timezone(&Utc));
    PayerQuestion {
        question,
        requested_items: items,
        due_at,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_the_benefit_total_of_a_claim_response_in_a_bundle() {
        let bundle = json!({ "entry": [{ "resource": {
            "resourceType": "ClaimResponse", "outcome": "complete", "preAuthRef": "PA-77",
            "total": [
                { "category": { "coding": [{ "code": "submitted" }] }, "amount": { "value": 900 } },
                { "category": { "coding": [{ "code": "benefit" }] }, "amount": { "value": 812.5 } }
            ]
        }}]});
        assert_eq!(approved_amount(&bundle), "812.5".parse().ok());
        assert_eq!(outcome(&bundle).as_deref(), Some("complete"));
        assert_eq!(pre_auth_ref(&bundle).as_deref(), Some("PA-77"));
        assert_eq!(
            approved_amount(&json!({ "x-hcx-status": "response.error" })),
            None
        );
    }

    #[test]
    fn without_a_step_code_or_reason_only_a_complete_outcome_decides() {
        let d = |s: &str| s.parse::<Decimal>().ok();
        let answer = |outcome: &str, benefit: i64| {
            json!({ "resourceType": "ClaimResponse",
            "outcome": outcome,
            "total": [{ "category": { "coding": [{ "code": "benefit" }] },
                        "amount": { "value": benefit } }] })
        };
        let read = |p: &Value| decision(p, None, "response.complete", d("900"));
        assert_eq!(read(&answer("complete", 900)), Decision::Approved);
        assert_eq!(read(&answer("complete", 500)), Decision::PartiallyApproved);
        assert_eq!(read(&answer("complete", 0)), Decision::Rejected);
        assert_eq!(read(&answer("queued", 0)), Decision::Received);
        assert_eq!(read(&answer("partial", 900)), Decision::Unknown);
        assert_eq!(read(&answer("error", 0)), Decision::Unknown);
        let protocol_error = json!({ "x-hcx-status": "response.error" });
        assert_eq!(
            decision(&protocol_error, None, "response.error", None),
            Decision::Error
        );
        assert_eq!(
            decision(&json!({}), None, "unknown", None),
            Decision::Unknown
        );
    }

    #[test]
    fn an_eligibility_answer_reads_into_in_force_benefits_and_period() {
        let bundle = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
            "resourceType": "CoverageEligibilityResponse", "outcome": "complete",
            "insurance": [{
                "inforce": true,
                "benefitPeriod": { "start": "2026-04-01", "end": "2027-03-31" },
                "item": [{
                    "category": { "coding": [{ "code": "1", "display": "Medical Care" }] },
                    "name": "Hospitalisation",
                    "benefit": [
                        { "type": { "text": "benefit" },
                          "allowedMoney": { "value": 500000, "currency": "INR" },
                          "usedMoney": { "value": 120000, "currency": "INR" } },
                        { "type": { "text": "room-days" }, "allowedUnsignedInt": 30 }
                    ]
                }]
            }]
        }}]});
        let r = eligibility_result(&bundle);
        assert_eq!(r.in_force, Some(true));
        assert_eq!(r.coverage_end.as_deref(), Some("2027-03-31"));
        assert_eq!(r.benefits.len(), 2);
        assert_eq!(r.benefits[0].category.as_deref(), Some("Medical Care"));
        assert_eq!(r.benefits[0].allowed, Some(json!(500_000)));
        assert_eq!(r.benefits[0].used, Some(json!(120_000)));
        assert_eq!(r.benefits[0].currency.as_deref(), Some("INR"));
        assert_eq!(r.benefits[1].allowed, Some(json!(30)));
        assert_eq!(verification_status(&r), "active");
    }

    #[test]
    fn an_answer_that_does_not_say_is_never_read_as_not_covered() {
        let silent = eligibility_result(&json!({
            "resourceType": "CoverageEligibilityResponse", "outcome": "complete"
        }));
        assert_eq!(verification_status(&silent), "unknown");
        let queued = eligibility_result(&json!({
            "resourceType": "CoverageEligibilityResponse", "outcome": "queued"
        }));
        assert_eq!(verification_status(&queued), "pending");
        let failed = eligibility_result(&json!({
            "x-hcx-status": "response.error",
            "x-hcx-error_details": { "code": "ERR_INVALID_PAYLOAD", "message": "bad bundle" }
        }));
        assert_eq!(failed.errors, vec!["bad bundle".to_owned()]);
        assert_eq!(verification_status(&failed), "error");
        let lapsed = eligibility_result(&json!({
            "resourceType": "CoverageEligibilityResponse", "outcome": "complete",
            "insurance": [{ "inforce": false }]
        }));
        assert_eq!(verification_status(&lapsed), "inactive");
    }

    #[test]
    fn a_communication_request_reads_into_a_question_with_its_documents_and_due_time() {
        let q = payer_question(&json!({ "resourceType": "Bundle", "entry": [{ "resource": {
            "resourceType": "CommunicationRequest",
            "occurrenceDateTime": "2026-10-19T12:00:00+05:30",
            "reasonCode": [{ "text": "Investigation reports" }],
            "payload": [
                { "contentString": "Please send the CT report." },
                { "contentAttachment": { "title": "Discharge summary" } }
            ]
        }}]}));
        assert_eq!(q.question, "Please send the CT report.");
        assert_eq!(
            q.requested_items,
            vec![
                "Discharge summary".to_owned(),
                "Investigation reports".to_owned()
            ]
        );
        assert_eq!(
            q.due_at.map(|d| d.to_rfc3339()),
            Some("2026-10-19T06:30:00+00:00".to_owned())
        );
        assert_eq!(
            payer_question(&json!({})).question,
            "The payer asked for more information."
        );
    }
}
