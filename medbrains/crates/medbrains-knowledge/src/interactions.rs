//! Adapter: `drug_interactions`, rows joined to patients by drug name.
//!
//! The readers (`cds::interaction_alerts_for_drugs`, `rx_safety`) match a rule
//! on `lower(drug name)` against a patient's medicines by their written name,
//! generic name and INN. Impact matches the same way.

use std::collections::{BTreeSet, HashMap};

use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::interaction_impact::{
    Change, PENDING_ORDERS, PRESCRIPTIONS, classify, entry_for, relation_hits,
};
use crate::model::{KnowledgeImpactEntry, Op};

pub(crate) struct DrugInteractions;

const fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub(crate) struct InteractionRow {
    pub(crate) drug_a_name: String,
    pub(crate) drug_b_name: String,
    pub(crate) severity: String,
    pub(crate) description: String,
    pub(crate) mechanism: Option<String>,
    pub(crate) management: Option<String>,
    #[serde(default = "yes")]
    pub(crate) is_active: bool,
}

#[derive(sqlx::FromRow)]
struct WithId {
    id: Uuid,
    #[sqlx(flatten)]
    row: InteractionRow,
}

pub(crate) const SEVERITIES: [&str; 4] = ["minor", "moderate", "major", "contraindicated"];
const COLUMNS: &str =
    "drug_a_name, drug_b_name, severity, description, mechanism, management, is_active";

fn rank(severity: &str) -> usize {
    SEVERITIES.iter().position(|s| *s == severity).unwrap_or(0)
}

/// An unordered pair of lower-cased names, as the reader compares them.
pub(crate) type Pair = (String, String);

pub(crate) fn pair(a: &str, b: &str) -> Pair {
    let (a, b) = (a.to_lowercase(), b.to_lowercase());
    if a <= b { (a, b) } else { (b, a) }
}

impl Adapter for DrugInteractions {
    const KIND: &'static str = "drug_interactions";
    const MANAGE: &'static [&'static str] = &[
        permissions::pharmacy::interactions::MANAGE,
        permissions::admin::settings::general::MANAGE,
    ];
    type Row = InteractionRow;
    /// Active pair → highest severity among its active rules.
    type State = HashMap<Pair, usize>;

    fn validate(row: &InteractionRow) -> Result<(), String> {
        let (a, b) = (row.drug_a_name.trim(), row.drug_b_name.trim());
        if a.is_empty() || b.is_empty() {
            return Err("Both drug names are required".to_owned());
        }
        if a.eq_ignore_ascii_case(b) {
            return Err("An interaction needs two different drugs".to_owned());
        }
        if a.len() > 200 || b.len() > 200 {
            return Err("Drug names are at most 200 characters".to_owned());
        }
        if !SEVERITIES.contains(&row.severity.as_str()) {
            return Err(format!("Severity must be one of {}", SEVERITIES.join(", ")));
        }
        if row.description.trim().is_empty() {
            return Err("Describe the interaction".to_owned());
        }
        Ok(())
    }

    fn deactivated(row: &InteractionRow) -> InteractionRow {
        InteractionRow {
            is_active: false,
            ..row.clone()
        }
    }

    async fn list(
        tx: &mut Tx<'_>,
        tenant: Uuid,
    ) -> Result<Vec<(Uuid, InteractionRow)>, sqlx::Error> {
        let rows = sqlx::query_as::<_, WithId>(&format!(
            "SELECT id, {COLUMNS} FROM drug_interactions \
              WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
              ORDER BY drug_a_name, drug_b_name LIMIT 5000"
        ))
        .bind(tenant)
        .fetch_all(&mut **tx)
        .await?;
        Ok(rows.into_iter().map(|r| (r.id, r.row)).collect())
    }

    async fn current(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        target: Option<Uuid>,
        after: Option<&InteractionRow>,
    ) -> Result<Option<InteractionRow>, sqlx::Error> {
        if let Some(id) = target {
            let found = sqlx::query_as::<_, InteractionRow>(&format!(
                "SELECT {COLUMNS} FROM drug_interactions \
                  WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE"
            ))
            .bind(id)
            .bind(tenant)
            .fetch_optional(&mut **tx)
            .await?;

            return Ok(found);
        }
        let Some(row) = after else { return Ok(None) };
        sqlx::query_as::<_, InteractionRow>(&format!(
            "SELECT {COLUMNS} FROM drug_interactions \
              WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
                AND ((lower(drug_a_name) = lower($2) AND lower(drug_b_name) = lower($3)) \
                  OR (lower(drug_a_name) = lower($3) AND lower(drug_b_name) = lower($2))) \
              ORDER BY created_at LIMIT 1 FOR UPDATE"
        ))
        .bind(tenant)
        .bind(row.drug_a_name.trim())
        .bind(row.drug_b_name.trim())
        .fetch_optional(&mut **tx)
        .await
    }

    async fn write(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        op: Op,
        target: Option<Uuid>,
        after: Option<&InteractionRow>,
    ) -> Result<Uuid, sqlx::Error> {
        let query = match (op, after) {
            (Op::Delete, _) => sqlx::query_scalar::<_, Uuid>(
                "UPDATE drug_interactions SET is_active = false \
                  WHERE id = $1 AND tenant_id = $2 RETURNING id",
            )
            .bind(target)
            .bind(tenant),
            (Op::Create, Some(r)) => bind_row(
                sqlx::query_scalar::<_, Uuid>(
                    "INSERT INTO drug_interactions (tenant_id, drug_a_name, drug_b_name, severity, \
                     description, mechanism, management, is_active, source) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'change_set') RETURNING id",
                )
                .bind(tenant),
                r,
            ),
            (Op::Update, Some(r)) => bind_row(
                sqlx::query_scalar::<_, Uuid>(
                    "UPDATE drug_interactions SET drug_a_name = $3, drug_b_name = $4, severity = $5, \
                     description = $6, mechanism = $7, management = $8, is_active = $9 \
                     WHERE id = $1 AND tenant_id = $2 RETURNING id",
                )
                .bind(target)
                .bind(tenant),
                r,
            ),
            _ => return Err(sqlx::Error::Protocol("create and update carry a row".to_owned())),
        };
        query.fetch_one(&mut **tx).await
    }

    async fn observe(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<InteractionRow>],
    ) -> Result<HashMap<Pair, usize>, sqlx::Error> {
        let touched = touched_pairs(items);
        let names: Vec<String> = touched
            .iter()
            .flat_map(|(a, b)| [a.clone(), b.clone()])
            .collect();
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT drug_a_name, drug_b_name, severity FROM drug_interactions \
              WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
                AND (lower(drug_a_name) = ANY($2) OR lower(drug_b_name) = ANY($2))",
        )
        .bind(tenant)
        .bind(&names)
        .fetch_all(&mut **tx)
        .await?;
        let mut state = HashMap::new();
        for (a, b, severity) in rows {
            let key = pair(&a, &b);
            if touched.contains(&key) {
                let r = state.entry(key).or_insert(0);
                *r = (*r).max(rank(&severity));
            }
        }
        Ok(state)
    }

    async fn impact(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<InteractionRow>],
        before: HashMap<Pair, usize>,
        after: HashMap<Pair, usize>,
    ) -> Result<Vec<KnowledgeImpactEntry>, sqlx::Error> {
        let changes: Vec<(Pair, Change)> = touched_pairs(items)
            .into_iter()
            .filter_map(|p| {
                classify(before.get(&p).copied(), after.get(&p).copied()).map(|c| (p, c))
            })
            .collect();
        if changes.is_empty() {
            return Ok(Vec::new());
        }
        let a: Vec<String> = changes.iter().map(|(p, _)| p.0.clone()).collect();
        let b: Vec<String> = changes.iter().map(|(p, _)| p.1.clone()).collect();
        let mut entries = Vec::new();
        for relation in [&PRESCRIPTIONS, &PENDING_ORDERS] {
            let hits = relation_hits(tx, tenant, relation, &a, &b).await?;
            for (k, (p, change)) in changes.iter().enumerate() {
                let found = hits.get(&(i64::try_from(k).unwrap_or(i64::MAX) + 1));
                let name = display(items, p);
                if let Some(entry) = entry_for(relation, &name, *change, found) {
                    entries.push(entry);
                }
            }
        }
        Ok(entries)
    }
}

fn bind_row<'q>(
    q: sqlx::query::QueryScalar<'q, sqlx::Postgres, Uuid, sqlx::postgres::PgArguments>,
    r: &'q InteractionRow,
) -> sqlx::query::QueryScalar<'q, sqlx::Postgres, Uuid, sqlx::postgres::PgArguments> {
    q.bind(r.drug_a_name.trim())
        .bind(r.drug_b_name.trim())
        .bind(&r.severity)
        .bind(r.description.trim())
        .bind(r.mechanism.as_deref())
        .bind(r.management.as_deref())
        .bind(r.is_active)
}

/// The pair as the rule writes it ("Warfarin + Aspirin"), not sorted.
fn display(items: &[Planned<InteractionRow>], p: &Pair) -> String {
    items
        .iter()
        .flat_map(|i| [i.before.as_ref(), i.after.as_ref()])
        .flatten()
        .find(|r| pair(r.drug_a_name.trim(), r.drug_b_name.trim()) == *p)
        .map_or_else(
            || format!("{} + {}", p.0, p.1),
            |r| format!("{} + {}", r.drug_a_name.trim(), r.drug_b_name.trim()),
        )
}

/// Every pair an item's before or after row names, active or not.
fn touched_pairs(items: &[Planned<InteractionRow>]) -> BTreeSet<Pair> {
    items
        .iter()
        .flat_map(|i| [i.before.as_ref(), i.after.as_ref()])
        .flatten()
        .map(|r| pair(r.drug_a_name.trim(), r.drug_b_name.trim()))
        .collect()
}
