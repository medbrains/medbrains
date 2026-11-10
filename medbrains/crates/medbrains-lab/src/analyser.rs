//! Results an analyser sends, matched to the order they belong to -- or held
//! for a technologist when that cannot be done with certainty.
//!
//! The rule is that a result is attached only to the order its sample names.
//! A message with no barcode used to land on the patient's most recent
//! pending order, which is how a sodium from this morning's tube becomes the
//! sodium on this afternoon's order. Now every message that cannot be matched
//! exactly -- no barcode, a barcode on two orders, a patient that does not
//! match, a closed order, a value that conflicts with one already recorded --
//! is held, with the reason, on the analyser review screen.
//!
//! Corrections follow HL7 table 0085 (ASTM uses the same letters): `C`
//! replaces the recorded value, `P` may be replaced by a later result, and a
//! `F` that disagrees with a recorded value is held rather than duplicated.

use std::collections::{HashMap, HashSet};

use medbrains_core::lab::LabOrder;
use medbrains_server_core::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

use crate::hl7_flag::map_hl7_flag;
use crate::{AddResultInput, ResultSource, closed_reason, post_results_in_tx};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// What became of one analyser message.
#[derive(Debug, PartialEq, Eq)]
pub enum Routed {
    /// Posted against `order_id`. `skipped` names observations deliberately
    /// not posted (duplicates, "cannot obtain"), for the message log.
    Posted {
        order_id: Uuid,
        posted: usize,
        skipped: Vec<String>,
    },
    /// Held for review, and why.
    Held(String),
}

#[derive(Debug, Default, Deserialize)]
struct Mapped {
    #[serde(default)]
    identifiers: Identifiers,
    #[serde(default)]
    results: Vec<Observation>,
}

#[derive(Debug, Default, Deserialize)]
struct Identifiers {
    sample_barcode: Option<String>,
    patient_id: Option<String>,
    placer_order: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Observation {
    test_code: Option<String>,
    value: Option<String>,
    unit: Option<String>,
    reference_range: Option<String>,
    abnormal_flag: Option<String>,
    status: Option<String>,
    notes: Option<String>,
}

fn present(s: Option<&String>) -> Option<&str> {
    s.map(|v| v.trim()).filter(|v| !v.is_empty())
}

/// Post `mapped` (the bridge's HL7 or ASTM payload), or say why it is held.
///
/// `chosen` is the order a reviewer picked; without it the
/// order must be named unambiguously by the message itself. Nothing is
/// written unless the whole message can be posted.
pub async fn route_analyser_results(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    actor: Uuid,
    mapped: &serde_json::Value,
    chosen: Option<Uuid>,
) -> Result<Routed, AppError> {
    let mapped: Mapped = match serde_json::from_value(mapped.clone()) {
        Ok(m) => m,
        Err(e) => return Ok(Routed::Held(format!("the message could not be read: {e}"))),
    };
    if mapped.results.is_empty() {
        return Ok(Routed::Held("the message carried no results".to_owned()));
    }
    let order = match chosen {
        Some(id) => order_by_id(tx, tenant_id, id)
            .await?
            .ok_or(AppError::NotFound)?,
        None => match match_order(tx, tenant_id, &mapped.identifiers).await? {
            Ok(order) => order,
            Err(why) => return Ok(Routed::Held(why)),
        },
    };
    if let Some(why) = patient_mismatch(tx, &order, &mapped.identifiers).await? {
        return Ok(Routed::Held(why));
    }
    if let Some(reason) = closed_reason(order.status) {
        return Ok(Routed::Held(format!("the matched lab order is {reason}")));
    }
    let existing = existing_results(tx, &order).await?;
    let plan = match plan(&mapped.results, &existing) {
        Ok(plan) => plan,
        Err(why) => return Ok(Routed::Held(why)),
    };
    if plan.post.is_empty() && plan.skipped.iter().any(|s| !s.ends_with(DUPLICATE)) {
        return Ok(Routed::Held(format!(
            "nothing to post: {}",
            plan.skipped.join("; ")
        )));
    }
    if !plan.post.is_empty() {
        execute(tx, &order, actor, &plan).await?;
    }
    Ok(Routed::Posted {
        order_id: order.id,
        posted: plan.post.len(),
        skipped: plan.skipped,
    })
}

async fn order_by_id(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<LabOrder>, AppError> {
    Ok(sqlx::query_as::<_, LabOrder>(
        "SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The one live order the message names by barcode (or by the placer order
/// number `MedBrains` sent in its ORM), or why there is not exactly one.
async fn match_order(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    ids: &Identifiers,
) -> Result<Result<LabOrder, String>, AppError> {
    let barcode = present(ids.sample_barcode.as_ref());
    let placer = present(ids.placer_order.as_ref()).and_then(|p| Uuid::parse_str(p).ok());
    if barcode.is_none() && placer.is_none() {
        return Ok(Err(
            "the message has no sample barcode — results are never matched by \
                       patient alone"
                .to_owned(),
        ));
    }
    // ponytail: a tube shared by two orders (CBC + ESR on one EDTA label) is
    // held as ambiguous; matching OBX codes to each order's test would clear
    // most of those automatically.
    let found = sqlx::query_as::<_, LabOrder>(
        "SELECT * FROM lab_orders \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND status <> 'cancelled' \
            AND (sample_barcode = $2 OR id = $3) \
          ORDER BY created_at LIMIT 3",
    )
    .bind(tenant_id)
    .bind(barcode)
    .bind(placer)
    .fetch_all(&mut **tx)
    .await?;
    let label = barcode.unwrap_or("(none)");
    Ok(match found.len() {
        0 => Err(format!("no open lab order has sample barcode {label}")),
        1 => found
            .into_iter()
            .next()
            .filter(|o| match (barcode, o.sample_barcode.as_deref()) {
                (Some(sent), Some(on_order)) => sent == on_order,
                _ => true,
            })
            .ok_or_else(|| format!("the order the analyser named is not labelled {label}")),
        n => Err(format!(
            "sample barcode {label} matches {n} lab orders — choose the right one"
        )),
    })
}

/// The message names a patient and it is not this order's patient.
async fn patient_mismatch(
    tx: &mut Tx<'_>,
    order: &LabOrder,
    ids: &Identifiers,
) -> Result<Option<String>, AppError> {
    let Some(sent) = present(ids.patient_id.as_ref()) else {
        return Ok(None);
    };
    let uhid: Option<String> =
        sqlx::query_scalar("SELECT uhid FROM patients WHERE id = $1 AND tenant_id = $2")
            .bind(order.patient_id)
            .bind(order.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
    Ok(match uhid {
        Some(u) if u.eq_ignore_ascii_case(sent) => None,
        Some(u) => Some(format!(
            "the message is for patient {sent} but the order is for {u}"
        )),
        None => Some(format!(
            "the order's patient could not be found to check against {sent}"
        )),
    })
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct Existing {
    id: Uuid,
    parameter_name: String,
    value: String,
    unit: Option<String>,
    is_signed: bool,
    analyser_status: Option<String>,
}

async fn existing_results(tx: &mut Tx<'_>, order: &LabOrder) -> Result<Vec<Existing>, AppError> {
    Ok(sqlx::query_as::<_, Existing>(
        "SELECT id, parameter_name, value, unit, is_signed, analyser_status FROM lab_results \
          WHERE order_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(order.id)
    .bind(order.tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

const DUPLICATE: &str = "already recorded";

#[derive(Debug, Default)]
struct Plan {
    post: Vec<(AddResultInput, &'static str)>,
    supersede: Vec<Uuid>,
    skipped: Vec<String>,
}

/// Decide every observation before anything is written; any one that needs
/// a person holds the whole message.
fn plan(observations: &[Observation], existing: &[Existing]) -> Result<Plan, String> {
    let mut by_name: HashMap<String, Vec<&Existing>> = HashMap::new();
    for e in existing {
        by_name
            .entry(e.parameter_name.trim().to_lowercase())
            .or_default()
            .push(e);
    }
    let mut seen = HashSet::new();
    let mut out = Plan::default();
    for o in observations {
        let code = present(o.test_code.as_ref()).ok_or("an observation has no test code")?;
        if !seen.insert(code.to_lowercase()) {
            return Err(format!("the message reports {code} twice"));
        }
        let status = present(o.status.as_ref())
            .unwrap_or("F")
            .to_ascii_uppercase();
        // HL7 table 0085, and the ASTM E1394 letters where they differ (V
        // operator-verified, Q query response, M MIC). `R` is HL7's "entered,
        // not verified", so it is treated as preliminary.
        let status: &'static str = match status.as_str() {
            "F" | "U" | "V" | "Q" | "M" => "F",
            "P" | "R" | "S" => "P",
            "C" => "C",
            "X" | "I" | "N" | "O" => {
                out.skipped
                    .push(format!("{code}: not reported (status {status})"));
                continue;
            }
            "D" | "W" => {
                return Err(format!(
                    "the analyser asked to {} the {code} result — a technologist must decide",
                    if status == "D" { "delete" } else { "withdraw" }
                ));
            }
            other => return Err(format!("{code} has an unknown result status {other}")),
        };
        let Some(value) = present(o.value.as_ref()) else {
            out.skipped.push(format!("{code}: no value"));
            continue;
        };
        let input = AddResultInput {
            parameter_name: code.to_owned(),
            value: value.to_owned(),
            unit: present(o.unit.as_ref()).map(str::to_owned),
            normal_range: present(o.reference_range.as_ref()).map(str::to_owned),
            flag: map_hl7_flag(o.abnormal_flag.as_deref()).map(str::to_owned),
            notes: present(o.notes.as_ref()).map(str::to_owned),
        };
        match by_name.get(&code.to_lowercase()).map(Vec::as_slice) {
            None | Some([]) => {}
            Some([prev]) => {
                if let Some(why) = against_existing(prev, &input, status, &mut out)? {
                    out.skipped.push(why);
                    continue;
                }
            }
            Some(_) => {
                return Err(format!(
                    "{code} already has more than one result on this order"
                ));
            }
        }
        out.post.push((input, status));
    }
    Ok(out)
}

/// How a new observation meets the one already recorded: `Some(why)` to
/// skip it, `None` to post it (after superseding `prev` if that was planned),
/// `Err` to hold the message.
fn against_existing(
    prev: &Existing,
    input: &AddResultInput,
    status: &str,
    out: &mut Plan,
) -> Result<Option<String>, String> {
    let code = &input.parameter_name;
    let same = prev.value.trim() == input.value
        && prev
            .unit
            .as_deref()
            .unwrap_or("")
            .eq_ignore_ascii_case(input.unit.as_deref().unwrap_or(""));
    if same && status != "C" {
        return Ok(Some(format!("{code}: {DUPLICATE}")));
    }
    if prev.is_signed {
        return Err(format!(
            "{code} is already signed — correct it through an amendment"
        ));
    }
    if status == "C" || prev.analyser_status.as_deref() == Some("P") {
        out.supersede.push(prev.id);
        return Ok(None);
    }
    Err(format!(
        "{code} already has {} and the analyser sent {} without marking it a correction",
        prev.value, input.value
    ))
}

async fn execute(
    tx: &mut Tx<'_>,
    order: &LabOrder,
    actor: Uuid,
    plan: &Plan,
) -> Result<(), AppError> {
    if !plan.supersede.is_empty() {
        // Kept, not deleted: the replaced value stays on record beside the
        // correction that replaced it.
        sqlx::query(
            "UPDATE lab_results SET deleted_at = now(), deleted_by = $2, \
                    delete_reason = 'superseded by an analyser correction' \
              WHERE id = ANY($1) AND tenant_id = $3",
        )
        .bind(&plan.supersede)
        .bind(actor)
        .bind(order.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    let inputs: Vec<AddResultInput> = plan.post.iter().map(|(i, _)| i.clone()).collect();
    let posted = post_results_in_tx(tx, order, actor, &inputs, ResultSource::Analyser).await?;
    let ids: Vec<Uuid> = posted.iter().map(|r| r.id).collect();
    let statuses: Vec<&str> = plan.post.iter().map(|(_, s)| *s).collect();
    sqlx::query(
        "UPDATE lab_results r SET analyser_status = v.status \
           FROM unnest($1::uuid[], $2::text[]) AS v(id, status) WHERE r.id = v.id",
    )
    .bind(&ids)
    .bind(&statuses)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE lab_orders SET status = 'processing' WHERE id = $1 AND status = 'sample_collected'",
    )
    .bind(order.id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{Existing, Observation, plan};
    use uuid::Uuid;

    fn obs(code: &str, value: &str, status: Option<&str>) -> Observation {
        Observation {
            test_code: Some(code.to_owned()),
            value: Some(value.to_owned()),
            unit: Some("g/dL".to_owned()),
            reference_range: None,
            abnormal_flag: Some("HH".to_owned()),
            status: status.map(str::to_owned),
            notes: None,
        }
    }

    fn prev(code: &str, value: &str, status: Option<&str>, signed: bool) -> Existing {
        Existing {
            id: Uuid::nil(),
            parameter_name: code.to_owned(),
            value: value.to_owned(),
            unit: Some("g/dL".to_owned()),
            is_signed: signed,
            analyser_status: status.map(str::to_owned),
        }
    }

    #[test]
    fn every_observation_is_planned_in_order_with_its_flag() {
        let p = plan(&[obs("WBC", "12", None), obs("HGB", "6", Some("F"))], &[]).expect("plan");
        let names: Vec<&str> = p
            .post
            .iter()
            .map(|(i, _)| i.parameter_name.as_str())
            .collect();
        assert_eq!(names, ["WBC", "HGB"]);
        assert_eq!(p.post[0].0.flag.as_deref(), Some("critical_high"));
    }

    #[test]
    fn a_correction_supersedes_rather_than_duplicates() {
        let p = plan(
            &[obs("HGB", "7", Some("C"))],
            &[prev("HGB", "6", Some("F"), false)],
        )
        .expect("plan");
        assert_eq!(p.supersede.len(), 1);
        assert_eq!(p.post.len(), 1);
    }

    #[test]
    fn a_final_replaces_a_preliminary() {
        let p = plan(
            &[obs("HGB", "7", Some("F"))],
            &[prev("hgb", "6", Some("P"), false)],
        )
        .expect("plan");
        assert_eq!(p.supersede.len(), 1);
    }

    #[test]
    fn a_conflicting_final_is_held_not_duplicated() {
        let err = plan(
            &[obs("HGB", "7", Some("F"))],
            &[prev("HGB", "6", Some("F"), false)],
        )
        .unwrap_err();
        assert!(err.contains("without marking it a correction"), "{err}");
        // A manually entered value (no analyser status) is treated the same.
        assert!(plan(&[obs("HGB", "7", None)], &[prev("HGB", "6", None, false)]).is_err());
    }

    #[test]
    fn a_retransmission_is_skipped() {
        let p = plan(
            &[obs("HGB", "6", Some("F"))],
            &[prev("HGB", "6", Some("F"), false)],
        )
        .expect("plan");
        assert!(p.post.is_empty());
        assert_eq!(p.skipped, ["HGB: already recorded"]);
    }

    #[test]
    fn a_signed_result_is_never_overwritten() {
        let err = plan(
            &[obs("HGB", "7", Some("C"))],
            &[prev("HGB", "6", Some("F"), true)],
        )
        .unwrap_err();
        assert!(err.contains("amendment"), "{err}");
    }

    #[test]
    fn delete_and_withdraw_need_a_person() {
        assert!(plan(&[obs("HGB", "6", Some("D"))], &[]).is_err());
        assert!(plan(&[obs("HGB", "6", Some("W"))], &[]).is_err());
        assert!(
            plan(&[obs("HGB", "6", Some("?"))], &[]).is_err(),
            "unknown status"
        );
    }

    #[test]
    fn cannot_obtain_and_empty_values_are_named_not_posted() {
        let p = plan(
            &[
                obs("HGB", "", Some("F")),
                obs("PLT", "250", Some("X")),
                obs("WBC", "9", None),
            ],
            &[],
        )
        .expect("plan");
        assert_eq!(p.post.len(), 1);
        assert_eq!(p.skipped, ["HGB: no value", "PLT: not reported (status X)"]);
    }

    #[test]
    fn the_same_code_twice_is_held() {
        assert!(plan(&[obs("HGB", "6", None), obs("hgb", "7", None)], &[]).is_err());
    }
}
