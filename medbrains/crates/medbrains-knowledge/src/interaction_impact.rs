//! Impact of a drug-interaction change: which prescriptions and pending
//! pharmacy orders would stop (or start) warning. One query per relation for
//! every pair in the set.

use std::collections::HashMap;

use serde::Deserialize;
use uuid::Uuid;

use crate::adapter::{Tx, plural};
use crate::interactions::SEVERITIES;
use crate::model::{KnowledgeImpactEntry, KnowledgeImpactExample, MAX_EXAMPLES, Severity};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Change {
    /// No active rule for the pair remains: warnings stop.
    Lost,
    /// The pair warns at a lower severity (from, to).
    Weakened(usize, usize),
    /// A pair that did not warn now does.
    Gained,
    Strengthened(usize, usize),
}

pub(crate) const fn classify(before: Option<usize>, after: Option<usize>) -> Option<Change> {
    match (before, after) {
        (Some(_), None) => Some(Change::Lost),
        (None, Some(_)) => Some(Change::Gained),
        (Some(x), Some(y)) if y < x => Some(Change::Weakened(x, y)),
        (Some(x), Some(y)) if y > x => Some(Change::Strengthened(x, y)),
        _ => None,
    }
}

/// One population a warning reaches, and how to name its records.
pub(crate) struct Relation {
    key: &'static str,
    one: &'static str,
    many: &'static str,
    /// Yields `(record_id, patient_id, name, pending)` for each medicine name.
    meds_sql: &'static str,
    href: fn(Uuid, Uuid) -> String,
}

/// Active prescription items, by written, generic and INN name — the 30-day
/// window the dispensing check (`rx_safety::other_active_med_names`) uses.
pub(crate) const PRESCRIPTIONS: Relation = Relation {
    key: "active_prescriptions",
    one: "active prescription",
    many: "active prescriptions",
    meds_sql: "SELECT p.id AS record_id, p.patient_id, n.name, true AS pending \
                 FROM prescriptions p \
                 JOIN prescription_items pi ON pi.prescription_id = p.id AND pi.tenant_id = p.tenant_id \
                 LEFT JOIN pharmacy_catalog c ON c.id = pi.catalog_item_id AND c.tenant_id = pi.tenant_id \
                 CROSS JOIN LATERAL (VALUES (lower(trim(pi.drug_name))), (lower(trim(c.generic_name))), \
                                            (lower(trim(c.inn_name)))) AS n(name) \
                WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND pi.deleted_at IS NULL \
                  AND p.patient_id IS NOT NULL AND pi.item_status = 'active' \
                  AND (pi.end_date IS NULL OR pi.end_date >= current_date) \
                  AND p.created_at >= now() - interval '30 days' \
                  AND n.name = ANY($2::text[] || $3::text[])",
    href: |_, patient| format!("/patients/{patient}"),
};

/// Pharmacy orders still to be dispensed, where the dispensing check runs;
/// the patient's other medicines are their 30-day orders, as `rx_safety` reads.
pub(crate) const PENDING_ORDERS: Relation = Relation {
    key: "pending_pharmacy_orders",
    one: "pending pharmacy order",
    many: "pending pharmacy orders",
    meds_sql: "SELECT o.id AS record_id, o.patient_id, n.name, \
                      o.status IN ('ordered', 'partially_dispensed') AS pending \
                 FROM pharmacy_orders o \
                 JOIN pharmacy_order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id \
                  AND oi.removed_at IS NULL AND oi.deleted_at IS NULL \
                 LEFT JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
                 CROSS JOIN LATERAL (VALUES (lower(trim(oi.drug_name))), (lower(trim(c.generic_name))), \
                                            (lower(trim(c.inn_name)))) AS n(name) \
                WHERE o.tenant_id = $1 AND o.deleted_at IS NULL AND o.patient_id IS NOT NULL \
                  AND o.status IN ('ordered', 'partially_dispensed', 'dispensed') \
                  AND o.created_at >= now() - interval '30 days' \
                  AND n.name = ANY($2::text[] || $3::text[])",
    href: |order, _| format!("/pharmacy/orders/{order}"),
};

/// Per pair (1-based `k`): records of patients who take both drugs, counted,
/// with the number of wards and at most [`MAX_EXAMPLES`] examples. One query
/// for all pairs.
const HITS_TAIL: &str = "), \
    pairs AS (SELECT t.k, t.a, t.b FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS t(a, b, k)), \
    on_both AS ( \
      SELECT pr.k, m.patient_id FROM pairs pr JOIN meds m ON m.name IN (pr.a, pr.b) \
       GROUP BY pr.k, m.patient_id \
      HAVING bool_or(m.name = pr.a) AND bool_or(m.name = pr.b)), \
    hits AS ( \
      SELECT DISTINCT ob.k, m.record_id, m.patient_id \
        FROM on_both ob JOIN pairs pr ON pr.k = ob.k \
        JOIN meds m ON m.patient_id = ob.patient_id AND m.name IN (pr.a, pr.b) AND m.pending), \
    placed AS ( \
      SELECT h.k, h.record_id, h.patient_id, pt.uhid, w.name AS ward, \
             concat_ws(' ', pt.first_name, pt.last_name) AS patient_name, \
             row_number() OVER (PARTITION BY h.k ORDER BY h.record_id) AS rn \
        FROM hits h \
        JOIN patients pt ON pt.id = h.patient_id AND pt.tenant_id = $1 \
        LEFT JOIN LATERAL (SELECT a.ward_id FROM admissions a \
                            WHERE a.tenant_id = $1 AND a.patient_id = h.patient_id \
                              AND a.status = 'admitted' AND a.deleted_at IS NULL \
                            ORDER BY a.admitted_at DESC LIMIT 1) adm ON true \
        LEFT JOIN wards w ON w.id = adm.ward_id) \
    SELECT k, count(*)::int8, count(DISTINCT ward)::int8, \
           COALESCE(jsonb_agg(jsonb_build_object('record_id', record_id, 'patient_id', patient_id, \
                    'uhid', uhid, 'patient_name', patient_name, 'ward', ward) ORDER BY rn) \
                    FILTER (WHERE rn <= 20), '[]'::jsonb) \
      FROM placed GROUP BY k";

#[derive(Debug, Deserialize)]
struct HitExample {
    record_id: Uuid,
    patient_id: Uuid,
    uhid: Option<String>,
    patient_name: Option<String>,
    ward: Option<String>,
}

pub(crate) struct Hits {
    count: i64,
    wards: i64,
    examples: Vec<HitExample>,
}

pub(crate) async fn relation_hits(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    relation: &Relation,
    a: &[String],
    b: &[String],
) -> Result<HashMap<i64, Hits>, sqlx::Error> {
    let sql = format!("WITH meds AS ({}{HITS_TAIL}", relation.meds_sql);
    let rows = sqlx::query_as::<_, (i64, i64, i64, serde_json::Value)>(&sql)
        .bind(tenant)
        .bind(a)
        .bind(b)
        .fetch_all(&mut **tx)
        .await?;
    rows.into_iter()
        .map(|(k, count, wards, examples)| {
            let mut examples: Vec<HitExample> =
                serde_json::from_value(examples).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
            examples.truncate(MAX_EXAMPLES);
            Ok((
                k,
                Hits {
                    count,
                    wards,
                    examples,
                },
            ))
        })
        .collect()
}

pub(crate) fn entry_for(
    relation: &Relation,
    name: &str,
    change: Change,
    hits: Option<&Hits>,
) -> Option<KnowledgeImpactEntry> {
    let count = hits.map_or(0, |h| h.count);
    let what = match change {
        Change::Lost => format!("would stop warning about {name}"),
        Change::Gained => format!("would start warning about {name}"),
        Change::Weakened(from, to) | Change::Strengthened(from, to) => format!(
            "would warn about {name} as {} instead of {}",
            SEVERITIES[to], SEVERITIES[from]
        ),
    };
    let safety = matches!(change, Change::Lost | Change::Weakened(..));
    // A lost or weakened warning is reported even when nobody is on both drugs
    // today: every future prescription is affected. An added one with nobody
    // affected says nothing worth reading.
    if count == 0 && !safety {
        return None;
    }
    let wards = hits.map_or(0, |h| h.wards);
    let on_wards = if wards > 0 {
        format!(" on {}", plural(wards, "ward", "wards"))
    } else {
        String::new()
    };
    let summary = if count == 0 {
        format!("No {} today, but future ones {what}", relation.many)
    } else {
        format!(
            "{}{on_wards} {what}",
            plural(count, relation.one, relation.many)
        )
    };
    let examples = hits.map_or_else(Vec::new, |h| {
        h.examples
            .iter()
            .map(|e| KnowledgeImpactExample {
                label: format!(
                    "{} ({}){}",
                    e.patient_name.as_deref().unwrap_or("Unnamed patient"),
                    e.uhid.as_deref().unwrap_or("no UHID"),
                    e.ward
                        .as_deref()
                        .map(|w| format!(", {w}"))
                        .unwrap_or_default()
                ),
                href: Some((relation.href)(e.record_id, e.patient_id)),
            })
            .collect()
    });
    Some(KnowledgeImpactEntry {
        severity: if safety {
            Severity::Safety
        } else {
            Severity::Info
        },
        relation: relation.key.to_owned(),
        summary,
        count,
        examples,
        truncated: false,
    })
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use crate::interactions::pair;

    #[test]
    fn removing_the_last_rule_for_a_pair_loses_the_warning() {
        assert_eq!(classify(Some(3), None), Some(Change::Lost));
        assert_eq!(classify(Some(3), Some(1)), Some(Change::Weakened(3, 1)));
        assert_eq!(classify(None, Some(2)), Some(Change::Gained));
        assert_eq!(classify(Some(2), Some(2)), None);
    }

    #[test]
    fn pairs_are_unordered_and_case_blind() {
        assert_eq!(pair("Warfarin", "aspirin"), pair("ASPIRIN", "warfarin"));
    }

    #[test]
    fn a_lost_warning_is_reported_even_with_nobody_affected() {
        let e =
            entry_for(&PRESCRIPTIONS, "Warfarin + Aspirin", Change::Lost, None).expect("reported");
        assert_eq!(e.severity, Severity::Safety);
        assert_eq!(e.count, 0);
        assert!(entry_for(&PRESCRIPTIONS, "Warfarin + Aspirin", Change::Gained, None).is_none());
    }
}
