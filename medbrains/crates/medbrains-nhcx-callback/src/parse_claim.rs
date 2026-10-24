//! Reading a payer's claim answers and payments out of a decrypted NHCX
//! message (NRCeS NHCX IG 6.5.0):
//!
//! - a `ClaimResponse`'s adjudication — submitted, approved and deducted,
//!   overall and per line, with the payer's reasons;
//! - a Task reply (status, search, cancel, reprocess) — its status, outcome,
//!   and the claim responses it carries;
//! - a payment notice — the `PaymentReconciliation`'s UTR, date and amount,
//!   and per claim the approved amount and the TDS withheld.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::parse::find_resource;

/// Adjudication categories that carry the payer's approved amount, best
/// first. `eligpercent` carries an amount in the NRCeS examples.
const APPROVED: &[&str] = &["benefit", "eligible", "approved", "eligpercent"];
const SUBMITTED: &[&str] = &["submitted"];
/// NRCeS reason code for a line paid in full — not a deduction reason.
const COVERED: &str = "covered";
/// NRCeS payment-type detail codes.
const PAYMENT_APPROVED: &str = "approvedamount";
const PAYMENT_NET: &str = "payment";
const PAYMENT_TDS: &str = "tds";
/// `ndhm-identifier-type-code` placer identifier: names a payment line.
const PLACER_IDENTIFIER: &str = "PLAC";
/// The most claims one payment notice may settle.
const MAX_PAYMENT_LINES: usize = 200;
/// The most claims one search answer is read for.
const MAX_FOUND: usize = 200;

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .map(str::to_owned)
}

fn array<'a>(v: &'a Value, key: &str) -> impl Iterator<Item = &'a Value> {
    v.get(key).and_then(Value::as_array).into_iter().flatten()
}

/// A JSON number read exactly as a decimal.
fn decimal(v: Option<&Value>) -> Option<Decimal> {
    let v = v?;
    v.as_str()
        .map_or_else(|| v.to_string(), str::to_owned)
        .parse()
        .ok()
}

fn money(v: &Value, key: &str) -> Option<Decimal> {
    decimal(v.get(key)?.get("value"))
}

fn codes(concept: Option<&Value>) -> Vec<String> {
    concept
        .map(|c| array(c, "coding").filter_map(|c| text(c, "code")).collect())
        .unwrap_or_default()
}

/// A CodeableConcept in words: its text, else the first coding's display
/// or code.
fn words(concept: Option<&Value>) -> Option<String> {
    let concept = concept?;
    text(concept, "text").or_else(|| {
        let first = concept.get("coding")?.as_array()?.first()?;
        text(first, "display").or_else(|| text(first, "code"))
    })
}

/// The amount of the first adjudication whose category is one of `wanted`,
/// in `wanted`'s order.
fn category_amount(adjudications: &[&Value], wanted: &[&str]) -> Option<Decimal> {
    wanted.iter().find_map(|w| {
        adjudications.iter().find_map(|a| {
            codes(a.get("category"))
                .iter()
                .any(|c| c == w)
                .then(|| money(a, "amount"))
                .flatten()
        })
    })
}

/// One adjudicated line, by the sequence the claim sent it under.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct AdjudicationLine {
    pub(crate) sequence: u64,
    pub(crate) submitted: Option<Decimal>,
    pub(crate) approved: Option<Decimal>,
    /// Submitted less approved, when both are known.
    pub(crate) deducted: Option<Decimal>,
    /// The payer's reasons, in its words; a fully covered line has none.
    pub(crate) reasons: Vec<String>,
}

/// The payer's adjudication of a claim, as stored on it.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Adjudication {
    /// `ClaimResponse.use` — `claim` or `preauthorization`.
    pub(crate) use_: Option<String>,
    pub(crate) outcome: Option<String>,
    pub(crate) disposition: Option<String>,
    pub(crate) pre_auth_ref: Option<String>,
    pub(crate) submitted: Option<Decimal>,
    pub(crate) approved: Option<Decimal>,
    pub(crate) deducted: Option<Decimal>,
    pub(crate) lines: Vec<AdjudicationLine>,
}

fn deducted(submitted: Option<Decimal>, approved: Option<Decimal>) -> Option<Decimal> {
    Some((submitted? - approved?).max(Decimal::ZERO))
}

fn line(item: &Value) -> Option<AdjudicationLine> {
    let sequence = item.get("itemSequence")?.as_u64()?;
    let adjudications: Vec<&Value> = array(item, "adjudication").collect();
    let submitted = category_amount(&adjudications, SUBMITTED);
    let approved = category_amount(&adjudications, APPROVED);
    let mut reasons: Vec<String> = Vec::new();
    for a in &adjudications {
        let reason = a.get("reason");
        if codes(reason).iter().any(|c| c == COVERED) {
            continue;
        }
        if let Some(r) = words(reason).filter(|r| !reasons.contains(r)) {
            reasons.push(r);
        }
    }
    Some(AdjudicationLine {
        sequence,
        submitted,
        approved,
        deducted: deducted(submitted, approved),
        reasons,
    })
}

/// Read a `ClaimResponse` — the payload itself or the first in its bundle.
pub(crate) fn adjudication(payload: &Value) -> Option<Adjudication> {
    let r = find_resource(payload, &["ClaimResponse"])?;
    Some(claim_response(r))
}

fn claim_response(r: &Value) -> Adjudication {
    let totals: Vec<&Value> = array(r, "total").collect();
    let lines: Vec<AdjudicationLine> = array(r, "item").filter_map(line).collect();
    let line_sum = |pick: fn(&AdjudicationLine) -> Option<Decimal>| {
        let parts: Option<Vec<Decimal>> = lines.iter().map(pick).collect();
        parts.filter(|p| !p.is_empty()).map(|p| p.into_iter().sum())
    };
    let submitted = category_amount(&totals, SUBMITTED).or_else(|| line_sum(|l| l.submitted));
    let approved = category_amount(&totals, APPROVED).or_else(|| line_sum(|l| l.approved));
    Adjudication {
        use_: text(r, "use"),
        outcome: text(r, "outcome"),
        disposition: text(r, "disposition"),
        pre_auth_ref: text(r, "preAuthRef"),
        submitted,
        approved,
        deducted: deducted(submitted, approved),
        lines,
    }
}

/// A claim a payer's search or status answer names.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct FoundClaim {
    /// How the payer names the claim: its Claim identifier, else the
    /// ClaimResponse's.
    pub(crate) claim_ref: Option<String>,
    pub(crate) outcome: Option<String>,
    pub(crate) disposition: Option<String>,
    pub(crate) submitted: Option<Decimal>,
    pub(crate) approved: Option<Decimal>,
    /// The claim here it is, when one matches.
    pub(crate) matched_claim_id: Option<Uuid>,
}

/// A Task reply, as stored on the Task.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct TaskResult {
    /// FHIR `Task.status` — `completed`, `rejected`, `failed`, `in-progress`…
    pub(crate) task_status: Option<String>,
    /// The Task's output or business status, in words.
    pub(crate) outcome: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) claims: Vec<FoundClaim>,
    /// A protocol error, when the payer or gateway sent one instead.
    pub(crate) error: Option<String>,
}

fn entries(payload: &Value) -> Vec<&Value> {
    let inner: Vec<&Value> = array(payload, "entry")
        .filter_map(|e| e.get("resource"))
        .collect();
    if inner.is_empty() {
        vec![payload]
    } else {
        inner
    }
}

/// The Claim a ClaimResponse answers, found in the same bundle.
fn claim_ref(all: &[&Value], response: &Value) -> Option<String> {
    let request = response.get("request");
    let reference = request.and_then(|r| text(r, "reference"));
    let claim = reference.and_then(|reference| {
        all.iter().find(|r| {
            r.get("resourceType").and_then(Value::as_str) == Some("Claim")
                && text(r, "id").is_some_and(|id| reference.ends_with(&id))
        })
    });
    claim
        .copied()
        .and_then(first_identifier)
        .or_else(|| {
            request
                .and_then(|r| r.get("identifier"))
                .and_then(|i| text(i, "value"))
        })
        .or_else(|| first_identifier(response))
}

fn first_identifier(r: &Value) -> Option<String> {
    array(r, "identifier").find_map(|i| text(i, "value"))
}

/// Read a Task reply.
pub(crate) fn task_result(payload: &Value) -> TaskResult {
    let all = entries(payload);
    let task = all
        .iter()
        .find(|r| r.get("resourceType").and_then(Value::as_str) == Some("Task"));
    let outcome = task.and_then(|t| {
        array(t, "output")
            .find_map(|o| words(o.get("valueCodeableConcept")).or_else(|| text(o, "valueString")))
            .or_else(|| words(t.get("businessStatus")))
    });
    let claims = all
        .iter()
        .filter(|r| r.get("resourceType").and_then(Value::as_str) == Some("ClaimResponse"))
        .take(MAX_FOUND)
        .map(|r| {
            let a = claim_response(r);
            FoundClaim {
                claim_ref: claim_ref(&all, r),
                outcome: a.outcome,
                disposition: a.disposition,
                submitted: a.submitted,
                approved: a.approved,
                matched_claim_id: None,
            }
        })
        .collect();
    TaskResult {
        task_status: task.and_then(|t| text(t, "status")),
        outcome,
        description: task.and_then(|t| text(t, "description")),
        claims,
        error: crate::parse::protocol_error(payload),
    }
}

/// One claim a payment pays.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PaymentLine {
    pub(crate) claim_ref: Option<String>,
    /// The approved amount paid against the claim, before TDS.
    pub(crate) gross: Decimal,
    pub(crate) tds: Decimal,
}

/// A payer's payment notice.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct PaymentNotice {
    pub(crate) identifier: Option<String>,
    /// UTR / bank reference (`PaymentReconciliation.paymentIdentifier`).
    pub(crate) reference: Option<String>,
    pub(crate) date: Option<NaiveDate>,
    /// What reached the bank.
    pub(crate) amount: Option<Decimal>,
    pub(crate) disposition: Option<String>,
    pub(crate) lines: Vec<PaymentLine>,
}

fn date(v: &Value, key: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(text(v, key)?.get(..10)?, "%Y-%m-%d").ok()
}

/// How a detail line names its claim. A placer identifier (`PLAC`, as in
/// NHA's samples, `PAY-2026-0009/TDS`) names the payment line, not the
/// claim; the reconciliation's own claim number (`CLN`) does.
fn detail_claim_ref(d: &Value, recon_ref: Option<&String>) -> Option<String> {
    let id = d.get("identifier");
    let is_placer = codes(id.and_then(|i| i.get("type")))
        .iter()
        .any(|c| c == PLACER_IDENTIFIER);
    match id.and_then(|i| text(i, "value")) {
        Some(v) if !is_placer => Some(v),
        _ => recon_ref.cloned(),
    }
}

/// Per claim: the approved amount, the net payment and the TDS a detail
/// line carries.
#[derive(Default)]
struct Money {
    approved: Decimal,
    payment: Decimal,
    tds: Decimal,
}

/// The reconciliation's detail lines, grouped by the claim they name, in
/// the order they first appear. Gross is the approved amount when the payer
/// gives one (NRCeS `approvedAmount`), else the net payment plus the TDS
/// (NHA: "net plus the deductions equals the adjudicated benefit"). Type
/// codes are read case-blind — NRCeS writes `tds`, NHA's samples `TDS`.
fn payment_lines(recon: &Value) -> Vec<PaymentLine> {
    let recon_ref = first_identifier(recon);
    let mut lines: Vec<(Option<String>, Money)> = Vec::new();
    for d in array(recon, "detail") {
        let claim_ref = detail_claim_ref(d, recon_ref.as_ref());
        let kinds: Vec<String> = codes(d.get("type"))
            .iter()
            .map(|k| k.to_lowercase())
            .collect();
        let Some(amount) = money(d, "amount") else {
            continue;
        };
        let at = match lines.iter().position(|l| l.0 == claim_ref) {
            Some(i) => i,
            None if lines.len() < MAX_PAYMENT_LINES => {
                lines.push((claim_ref, Money::default()));
                lines.len() - 1
            }
            None => continue,
        };
        let m = &mut lines[at].1;
        if kinds.iter().any(|k| k == PAYMENT_APPROVED) {
            m.approved += amount;
        } else if kinds.iter().any(|k| k == PAYMENT_NET) {
            m.payment += amount;
        } else if kinds.iter().any(|k| k == PAYMENT_TDS) {
            m.tds += amount;
        }
    }
    lines
        .into_iter()
        .map(|(claim_ref, m)| PaymentLine {
            claim_ref,
            gross: if m.approved > Decimal::ZERO {
                m.approved
            } else {
                m.payment + m.tds
            },
            tds: m.tds,
        })
        .filter(|l| l.gross > Decimal::ZERO || l.tds > Decimal::ZERO)
        .collect()
}

/// Read a `paymentnotice/request`: a TaskBundle with a PaymentNotice and a
/// PaymentReconciliation (or either alone).
pub(crate) fn payment_notice(payload: &Value) -> PaymentNotice {
    let notice = find_resource(payload, &["PaymentNotice"]);
    let recon = find_resource(payload, &["PaymentReconciliation"]);
    let mut lines = recon.map(payment_lines).unwrap_or_default();
    let amount = recon
        .and_then(|r| money(r, "paymentAmount"))
        .or_else(|| notice.and_then(|n| money(n, "amount")));
    if lines.is_empty()
        && let Some(gross) = amount
    {
        lines.push(PaymentLine {
            claim_ref: recon.or(notice).and_then(first_identifier),
            gross,
            tds: Decimal::ZERO,
        });
    }
    let reference = recon
        .and_then(|r| r.get("paymentIdentifier"))
        .and_then(|i| text(i, "value"));
    PaymentNotice {
        identifier: notice.and_then(first_identifier),
        reference,
        date: recon
            .and_then(|r| date(r, "paymentDate"))
            .or_else(|| notice.and_then(|n| date(n, "paymentDate"))),
        amount,
        disposition: recon.and_then(|r| text(r, "disposition")),
        lines,
    }
}

#[cfg(test)]
#[path = "parse_claim_tests.rs"]
mod tests;
