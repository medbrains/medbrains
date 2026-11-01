//! Adapter: `critical_value_rules`, rows joined to results by test code/name.
//!
//! Impact judges the last 30 days of results with the same functions result
//! entry uses (`medbrains_lab::critical_rule`), once with the rules as they
//! are and once as the change would leave them, and reports what flips.

use chrono::Utc;
use medbrains_core::permissions;
use medbrains_lab::critical_rule::{self, CriticalRule};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::critical_impact::{
    RESULT_BOUND, flip, open_orders, recent_results, results_entry, weakens,
};
use crate::model::{KnowledgeImpactEntry, Op, Severity};

pub(crate) struct CriticalValues;

const fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
pub(crate) struct CriticalRuleRow {
    pub(crate) test_code: String,
    pub(crate) test_name: String,
    pub(crate) low_critical: Option<f64>,
    pub(crate) high_critical: Option<f64>,
    pub(crate) unit: Option<String>,
    pub(crate) age_min: Option<i32>,
    pub(crate) age_max: Option<i32>,
    pub(crate) gender: Option<String>,
    pub(crate) alert_message: String,
    #[serde(default = "yes")]
    pub(crate) is_active: bool,
}

#[derive(sqlx::FromRow)]
struct WithId {
    id: Uuid,
    #[sqlx(flatten)]
    row: CriticalRuleRow,
}

const COLUMNS: &str = "test_code, test_name, low_critical::float8 AS low_critical, \
    high_critical::float8 AS high_critical, unit, age_min, age_max, gender, alert_message, is_active";

impl Adapter for CriticalValues {
    const KIND: &'static str = "critical_value_rules";
    const MANAGE: &'static [&'static str] = &[
        permissions::lab::catalog::MANAGE,
        permissions::admin::settings::general::MANAGE,
    ];
    type Row = CriticalRuleRow;
    type State = Vec<CriticalRule>;

    fn validate(row: &CriticalRuleRow) -> Result<(), String> {
        if row.test_code.trim().is_empty() || row.test_name.trim().is_empty() {
            return Err("Test code and test name are required".to_owned());
        }
        if row.alert_message.trim().is_empty() {
            return Err("Write the alert message staff will see".to_owned());
        }
        match (row.low_critical, row.high_critical) {
            (None, None) => return Err("Set a low limit, a high limit, or both".to_owned()),
            (Some(l), Some(h)) if l >= h => {
                return Err("The low limit must be below the high limit".to_owned());
            }
            _ => {}
        }
        if [row.low_critical, row.high_critical]
            .iter()
            .flatten()
            .any(|v| !v.is_finite())
        {
            return Err("Limits must be numbers".to_owned());
        }
        let ages_ok = [row.age_min, row.age_max]
            .iter()
            .flatten()
            .all(|a| (0..=150).contains(a));
        if !ages_ok || row.age_min.zip(row.age_max).is_some_and(|(lo, hi)| lo > hi) {
            return Err("Ages run 0–150 and the minimum may not exceed the maximum".to_owned());
        }
        if row
            .gender
            .as_deref()
            .is_some_and(|g| g != "male" && g != "female")
        {
            return Err("Sex is male, female, or left empty for both".to_owned());
        }
        Ok(())
    }

    fn deactivated(row: &CriticalRuleRow) -> CriticalRuleRow {
        CriticalRuleRow {
            is_active: false,
            ..row.clone()
        }
    }

    async fn list(
        tx: &mut Tx<'_>,
        tenant: Uuid,
    ) -> Result<Vec<(Uuid, CriticalRuleRow)>, sqlx::Error> {
        let rows = sqlx::query_as::<_, WithId>(&format!(
            "SELECT id, {COLUMNS} FROM critical_value_rules \
              WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
              ORDER BY test_name LIMIT 5000"
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
        after: Option<&CriticalRuleRow>,
    ) -> Result<Option<CriticalRuleRow>, sqlx::Error> {
        if let Some(id) = target {
            let found = sqlx::query_as::<_, CriticalRuleRow>(&format!(
                "SELECT {COLUMNS} FROM critical_value_rules \
                  WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE"
            ))
            .bind(id)
            .bind(tenant)
            .fetch_optional(&mut **tx)
            .await?;

            return Ok(found);
        }
        let Some(row) = after else { return Ok(None) };
        // The same test, age band and sex: a second rule there would race the
        // first for which one result entry picks.
        sqlx::query_as::<_, CriticalRuleRow>(&format!(
            "SELECT {COLUMNS} FROM critical_value_rules \
              WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
                AND lower(test_code) = lower($2) \
                AND age_min IS NOT DISTINCT FROM $3::int AND age_max IS NOT DISTINCT FROM $4::int \
                AND gender IS NOT DISTINCT FROM $5::text \
              ORDER BY created_at LIMIT 1 FOR UPDATE"
        ))
        .bind(tenant)
        .bind(row.test_code.trim())
        .bind(row.age_min)
        .bind(row.age_max)
        .bind(row.gender.as_deref())
        .fetch_optional(&mut **tx)
        .await
    }

    async fn write(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        op: Op,
        target: Option<Uuid>,
        after: Option<&CriticalRuleRow>,
    ) -> Result<Uuid, sqlx::Error> {
        let sql = match (op, after) {
            (Op::Delete, _) => {
                let found = sqlx::query_scalar::<_, Uuid>(
                    "UPDATE critical_value_rules SET is_active = false \
                      WHERE id = $1 AND tenant_id = $2 RETURNING id",
                )
                .bind(target)
                .bind(tenant)
                .fetch_one(&mut **tx)
                .await?;

                return Ok(found);
            }
            (Op::Create, Some(_)) => {
                "INSERT INTO critical_value_rules (id, tenant_id, test_code, test_name, low_critical, \
                 high_critical, unit, age_min, age_max, gender, alert_message, is_active) \
                 VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
                 RETURNING id"
            }
            (Op::Update, Some(_)) => {
                "UPDATE critical_value_rules SET test_code = $3, test_name = $4, low_critical = $5, \
                 high_critical = $6, unit = $7, age_min = $8, age_max = $9, gender = $10, \
                 alert_message = $11, is_active = $12 WHERE id = $1 AND tenant_id = $2 RETURNING id"
            }
            _ => {
                return Err(sqlx::Error::Protocol(
                    "create and update carry a row".to_owned(),
                ));
            }
        };
        let Some(r) = after else {
            return Err(sqlx::Error::Protocol(
                "create and update carry a row".to_owned(),
            ));
        };
        sqlx::query_scalar::<_, Uuid>(sql)
            .bind(target)
            .bind(tenant)
            .bind(r.test_code.trim())
            .bind(r.test_name.trim())
            .bind(r.low_critical)
            .bind(r.high_critical)
            .bind(r.unit.as_deref())
            .bind(r.age_min)
            .bind(r.age_max)
            .bind(r.gender.as_deref())
            .bind(r.alert_message.trim())
            .bind(r.is_active)
            .fetch_one(&mut **tx)
            .await
    }

    async fn observe(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<CriticalRuleRow>],
    ) -> Result<Vec<CriticalRule>, sqlx::Error> {
        critical_rule::load_rules(tx, tenant, &keys(items)).await
    }

    async fn impact(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<CriticalRuleRow>],
        before: Vec<CriticalRule>,
        after: Vec<CriticalRule>,
    ) -> Result<Vec<KnowledgeImpactEntry>, sqlx::Error> {
        let keys = keys(items);
        let results = recent_results(tx, tenant, &keys).await?;
        let truncated = results.len() > usize::try_from(RESULT_BOUND).unwrap_or(usize::MAX);
        let today = Utc::now().date_naive();
        let mut lost = Vec::new();
        let mut gained = Vec::new();
        for r in results
            .iter()
            .take(usize::try_from(RESULT_BOUND).unwrap_or(usize::MAX))
        {
            match flip(r, &before, &after, today) {
                Some(true) => lost.push(r),
                Some(false) => gained.push(r),
                None => {}
            }
        }
        let weakens = items.iter().any(weakens);
        let mut entries = Vec::new();
        if weakens || !lost.is_empty() {
            entries.push(results_entry(
                Severity::Safety,
                "recent_results_no_longer_critical",
                "would no longer be flagged critical by the hospital's rule (shared reference \
                 ranges may still flag some)",
                &lost,
                truncated,
            ));
        }
        if !gained.is_empty() {
            entries.push(results_entry(
                Severity::Info,
                "recent_results_newly_critical",
                "would newly be flagged critical",
                &gained,
                truncated,
            ));
        }
        if let Some(e) = open_orders(tx, tenant, &keys, weakens).await? {
            entries.push(e);
        }
        Ok(entries)
    }
}

/// Lower-cased test codes and names the items' rows name.
fn keys(items: &[Planned<CriticalRuleRow>]) -> Vec<String> {
    let mut keys: Vec<String> = items
        .iter()
        .flat_map(|i| [i.before.as_ref(), i.after.as_ref()])
        .flatten()
        .flat_map(|r| {
            [
                r.test_code.trim().to_lowercase(),
                r.test_name.trim().to_lowercase(),
            ]
        })
        .collect();
    keys.sort();
    keys.dedup();
    keys
}
