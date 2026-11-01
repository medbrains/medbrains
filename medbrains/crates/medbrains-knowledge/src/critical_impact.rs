//! Impact of a critical-value rule change: recent results that would flip in
//! or out of critical, and open orders the changed rule will judge.

use chrono::NaiveDate;
use medbrains_lab::critical_rule::{self, CriticalRule, TenantCritical};
use serde::Deserialize;
use uuid::Uuid;

use crate::adapter::{Planned, Tx, plural};
use crate::critical_values::CriticalRuleRow;
use crate::model::{KnowledgeImpactEntry, KnowledgeImpactExample, MAX_EXAMPLES, Severity};

/// Most recent results judged per preview. Past it, counts are floors.
pub(crate) const RESULT_BOUND: i64 = 5_000;

/// Whether an item could stop a value being flagged: a removal, a limit
/// loosened or dropped, or the rule moved to another test, unit or band.
pub(crate) fn weakens(item: &Planned<CriticalRuleRow>) -> bool {
    let Some(b) = item.before.as_ref().filter(|b| b.is_active) else {
        return false;
    };
    let Some(a) = item.after.as_ref().filter(|a| a.is_active) else {
        return true;
    };
    let low_loosened = b
        .low_critical
        .is_some_and(|bl| a.low_critical.is_none_or(|al| al < bl));
    let high_loosened = b
        .high_critical
        .is_some_and(|bh| a.high_critical.is_none_or(|ah| ah > bh));
    let moved = (
        &b.test_code,
        &b.test_name,
        &b.unit,
        b.age_min,
        b.age_max,
        &b.gender,
    ) != (
        &a.test_code,
        &a.test_name,
        &a.unit,
        a.age_min,
        a.age_max,
        &a.gender,
    );
    low_loosened || high_loosened || moved
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct RecentResult {
    order_id: Uuid,
    parameter_name: String,
    value: String,
    unit: Option<String>,
    date_of_birth: Option<NaiveDate>,
    sex: Option<String>,
    uhid: Option<String>,
    patient_name: Option<String>,
}

pub(crate) async fn recent_results(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    keys: &[String],
) -> Result<Vec<RecentResult>, sqlx::Error> {
    sqlx::query_as::<_, RecentResult>(
        "SELECT r.order_id, r.parameter_name, r.value, r.unit, p.date_of_birth, \
                p.biological_sex::text AS sex, p.uhid, \
                concat_ws(' ', p.first_name, p.last_name) AS patient_name \
           FROM lab_results r \
           JOIN lab_orders o ON o.id = r.order_id AND o.tenant_id = r.tenant_id AND o.deleted_at IS NULL \
           JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
            AND r.created_at >= now() - interval '30 days' \
            AND lower(trim(r.parameter_name)) = ANY($2) \
          ORDER BY r.created_at DESC LIMIT $3",
    )
    .bind(tenant)
    .bind(keys)
    .bind(RESULT_BOUND + 1)
    .fetch_all(&mut **tx)
    .await
}

/// `Some(true)`: flagged before, not after. `Some(false)`: the reverse.
pub(crate) fn flip(
    r: &RecentResult,
    before: &[CriticalRule],
    after: &[CriticalRule],
    today: NaiveDate,
) -> Option<bool> {
    let value = r.value.trim().parse::<f64>().ok()?;
    let patient = (
        r.date_of_birth
            .and_then(|d| critical_rule::age_years(d, today)),
        r.sex.as_deref(),
    );
    let judge = |rules: &[CriticalRule]| {
        matches!(
            critical_rule::evaluate(rules, &r.parameter_name, value, r.unit.as_deref(), patient),
            TenantCritical::Flagged(_)
        )
    };
    match (judge(before), judge(after)) {
        (true, false) => Some(true),
        (false, true) => Some(false),
        _ => None,
    }
}

pub(crate) fn results_entry(
    severity: Severity,
    relation: &str,
    what: &str,
    hits: &[&RecentResult],
    truncated: bool,
) -> KnowledgeImpactEntry {
    let count = i64::try_from(hits.len()).unwrap_or(i64::MAX);
    let summary = if count == 0 {
        format!("No results from the last 30 days, but future results {what}")
    } else {
        format!(
            "{} from the last 30 days {what}",
            plural(count, "result", "results")
        )
    };
    KnowledgeImpactEntry {
        severity,
        relation: relation.to_owned(),
        summary,
        count,
        examples: hits
            .iter()
            .take(MAX_EXAMPLES)
            .map(|r| KnowledgeImpactExample {
                label: format!(
                    "{} ({}): {} {}{}",
                    r.patient_name.as_deref().unwrap_or("Unnamed patient"),
                    r.uhid.as_deref().unwrap_or("no UHID"),
                    r.parameter_name,
                    r.value,
                    r.unit
                        .as_deref()
                        .map(|u| format!(" {u}"))
                        .unwrap_or_default()
                ),
                href: Some(format!("/lab/orders/{}", r.order_id)),
            })
            .collect(),
        truncated,
    }
}

/// An open order as the impact query returns it.
#[derive(Deserialize)]
struct Open {
    id: Uuid,
    test: String,
    patient_name: Option<String>,
    uhid: Option<String>,
}

pub(crate) async fn open_orders(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    keys: &[String],
    weakens: bool,
) -> Result<Option<KnowledgeImpactEntry>, sqlx::Error> {
    let (count, examples) = sqlx::query_as::<_, (i64, serde_json::Value)>(
        "WITH open AS ( \
           SELECT o.id, t.name AS test, concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, \
                  row_number() OVER (ORDER BY o.created_at DESC) AS rn \
             FROM lab_orders o \
             JOIN lab_test_catalog t ON t.id = o.test_id AND t.tenant_id = o.tenant_id \
             JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
            WHERE o.tenant_id = $1 AND o.deleted_at IS NULL \
              AND o.status IN ('ordered', 'sample_collected', 'processing') \
              AND (lower(t.code) = ANY($2) OR lower(t.name) = ANY($2))) \
         SELECT count(*)::int8, COALESCE(jsonb_agg(jsonb_build_object('id', id, 'test', test, \
                'patient_name', patient_name, 'uhid', uhid) ORDER BY rn) FILTER (WHERE rn <= 20), '[]'::jsonb) \
           FROM open",
    )
    .bind(tenant)
    .bind(keys)
    .fetch_one(&mut **tx)
    .await?;
    if count == 0 {
        return Ok(None);
    }
    let open: Vec<Open> =
        serde_json::from_value(examples).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
    Ok(Some(KnowledgeImpactEntry {
        severity: if weakens {
            Severity::Safety
        } else {
            Severity::Info
        },
        relation: "open_lab_orders".to_owned(),
        summary: format!(
            "{} for these tests will be judged by the changed rule when results arrive",
            plural(count, "open lab order", "open lab orders")
        ),
        count,
        examples: open
            .into_iter()
            .map(|o| KnowledgeImpactExample {
                label: format!(
                    "{} ({}): {}",
                    o.patient_name.as_deref().unwrap_or("Unnamed patient"),
                    o.uhid.as_deref().unwrap_or("no UHID"),
                    o.test
                ),
                href: Some(format!("/lab/orders/{}", o.id)),
            })
            .collect(),
        truncated: false,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapter::Adapter;
    use crate::critical_values::CriticalValues;
    use crate::model::Op;

    fn row(low: Option<f64>, high: Option<f64>) -> CriticalRuleRow {
        CriticalRuleRow {
            test_code: "K".to_owned(),
            test_name: "Potassium".to_owned(),
            low_critical: low,
            high_critical: high,
            unit: None,
            age_min: None,
            age_max: None,
            gender: None,
            alert_message: "Call the doctor".to_owned(),
            is_active: true,
        }
    }

    fn item(
        op: Op,
        before: Option<CriticalRuleRow>,
        after: Option<CriticalRuleRow>,
    ) -> Planned<CriticalRuleRow> {
        Planned {
            op,
            target: None,
            before,
            after,
        }
    }

    #[test]
    fn loosening_or_removing_a_limit_weakens_and_tightening_does_not() {
        let base = row(Some(2.5), Some(6.5));
        assert!(weakens(&item(Op::Delete, Some(base.clone()), None)));
        assert!(weakens(&item(
            Op::Update,
            Some(base.clone()),
            Some(row(Some(2.0), Some(6.5)))
        )));
        assert!(weakens(&item(
            Op::Update,
            Some(base.clone()),
            Some(row(Some(2.5), None))
        )));
        assert!(!weakens(&item(
            Op::Update,
            Some(base.clone()),
            Some(row(Some(3.0), Some(6.0)))
        )));
        assert!(!weakens(&item(Op::Create, None, Some(base))));
    }

    #[test]
    fn a_rule_needs_a_limit_and_an_ordered_pair() {
        assert!(CriticalValues::validate(&row(None, None)).is_err());
        assert!(CriticalValues::validate(&row(Some(7.0), Some(6.0))).is_err());
        assert!(CriticalValues::validate(&row(Some(2.5), None)).is_ok());
    }
}
