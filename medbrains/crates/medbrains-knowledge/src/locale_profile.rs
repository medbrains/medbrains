//! Adapter: the locale profile (RFC-WORLD-READY §2.4), one row per scope.
//!
//! The hospital row's id is the tenant's id and is stored in
//! `tenant_settings`; each facility row's id is the facility's and is stored
//! in `scoped_settings`. A row maps profile keys to their stored JSON; a key
//! left out is unset at that scope and inherits. Applying a set is the only
//! way a value already set changes: the write marks its transaction for the
//! database guard (migration 1462), which refuses every other writer.

use std::collections::BTreeMap;

use medbrains_core::permissions;
use medbrains_country::Field;
use medbrains_country::validate::check_value;
use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::locale_profile_impact::impact_of;
use crate::locale_profile_store::{check_row, scope_of, stored, write_row};
use crate::model::{KnowledgeImpactEntry, Op};

pub(crate) struct LocaleProfile;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct LocaleProfileRow {
    /// The tenant's id for the hospital, else the facility's.
    pub(crate) scope_id: Uuid,
    /// For lists and diffs; never written.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) scope_name: Option<String>,
    #[serde(flatten)]
    pub(crate) values: BTreeMap<String, Value>,
}

impl LocaleProfileRow {
    /// The values without nulls: `null` and absent both mean "inherit".
    pub(crate) fn set_values(&self) -> impl Iterator<Item = (&String, &Value)> {
        self.values.iter().filter(|(_, v)| !v.is_null())
    }

    /// The row's value for a text field, if it sets one.
    pub(crate) fn text(&self, field: Field) -> Option<&str> {
        self.values.get(field.key()).and_then(Value::as_str)
    }
}

/// Equal when every profile value is; the display name is not content.
impl PartialEq for LocaleProfileRow {
    fn eq(&self, other: &Self) -> bool {
        self.scope_id == other.scope_id && self.set_values().eq(other.set_values())
    }
}

impl Adapter for LocaleProfile {
    const KIND: &'static str = "locale_profile";
    const MANAGE: &'static [&'static str] = &[permissions::admin::locale_profile::UPDATE];
    type Row = LocaleProfileRow;
    type State = ();

    fn validate(row: &LocaleProfileRow) -> Result<(), String> {
        for (key, value) in row.set_values() {
            let field = Field::from_key(key)
                .ok_or_else(|| format!("\"{key}\" is not part of the locale profile"))?;
            check_value(field, value)?;
        }
        Ok(())
    }

    async fn check(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        row: &LocaleProfileRow,
    ) -> Result<Result<(), String>, AppError> {
        Ok(check_row(tx, tenant, row).await?)
    }

    /// A scope's profile is changed, never removed.
    fn deactivated(row: &LocaleProfileRow) -> LocaleProfileRow {
        row.clone()
    }

    async fn list(
        tx: &mut Tx<'_>,
        tenant: Uuid,
    ) -> Result<Vec<(Uuid, LocaleProfileRow)>, sqlx::Error> {
        let hospital = sqlx::query_scalar!("SELECT name FROM tenants WHERE id = $1", tenant)
            .fetch_one(&mut **tx)
            .await?;
        let mut out = vec![(
            tenant,
            LocaleProfileRow {
                scope_id: tenant,
                scope_name: Some(hospital),
                values: stored(tx, tenant, tenant).await?,
            },
        )];
        // One query for every facility's values, not one per facility.
        let rows = sqlx::query!(
            "SELECT f.id, f.name, s.key AS \"key?\", s.value AS \"value?\" FROM facilities f \
               LEFT JOIN scoped_settings s ON s.tenant_id = f.tenant_id AND s.scope = 'facility' \
                AND s.scope_id = f.id AND s.category = 'locale' AND s.deleted_at IS NULL \
              WHERE f.tenant_id = $1 AND f.deleted_at IS NULL ORDER BY f.name, f.id LIMIT 2000",
            tenant,
        )
        .fetch_all(&mut **tx)
        .await?;
        for r in rows {
            if out.last().is_none_or(|(id, _)| *id != r.id) {
                out.push((
                    r.id,
                    LocaleProfileRow {
                        scope_id: r.id,
                        scope_name: Some(r.name.clone()),
                        values: BTreeMap::new(),
                    },
                ));
            }
            if let (Some((_, row)), Some(key), Some(value)) = (out.last_mut(), r.key, r.value) {
                row.values.insert(key, value);
            }
        }
        Ok(out)
    }

    async fn current(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        target: Option<Uuid>,
        _after: Option<&LocaleProfileRow>,
    ) -> Result<Option<LocaleProfileRow>, sqlx::Error> {
        let Some(id) = target else {
            return Ok(None);
        };
        let Some(scope) = scope_of(tx, tenant, id).await? else {
            return Ok(None);
        };
        // The name labels the diff and the impact; equality ignores it.
        Ok(Some(LocaleProfileRow {
            scope_id: id,
            scope_name: Some(scope.name),
            values: stored(tx, tenant, id).await?,
        }))
    }

    async fn write(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        op: Op,
        target: Option<Uuid>,
        after: Option<&LocaleProfileRow>,
    ) -> Result<Uuid, sqlx::Error> {
        let (Op::Update, Some(id), Some(row)) = (op, target, after) else {
            return Err(sqlx::Error::Protocol(
                "a locale profile is only ever updated".to_owned(),
            ));
        };
        if row.scope_id != id {
            return Err(sqlx::Error::Protocol(
                "the row names a different scope than its target".to_owned(),
            ));
        }
        write_row(tx, tenant, row).await?;
        Ok(id)
    }

    // The trait is async; impact compares the rows the items already carry.
    #[allow(clippy::unused_async_trait_impl)]
    async fn observe(
        _tx: &mut Tx<'_>,
        _tenant: Uuid,
        _items: &[Planned<LocaleProfileRow>],
    ) -> Result<(), sqlx::Error> {
        Ok(())
    }

    async fn impact(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<LocaleProfileRow>],
        _before: (),
        _after: (),
    ) -> Result<Vec<KnowledgeImpactEntry>, sqlx::Error> {
        let schedules = sqlx::query_scalar!(
            r#"SELECT count(*) AS "n!" FROM doctor_schedules WHERE tenant_id = $1 AND deleted_at IS NULL"#,
            tenant,
        )
        .fetch_one(&mut **tx)
        .await?;
        Ok(items
            .iter()
            .filter_map(|i| Some(impact_of(i.before.as_ref()?, i.after.as_ref()?, schedules)))
            .flatten()
            .collect())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use serde_json::json;

    use super::*;

    fn row(values: Value) -> LocaleProfileRow {
        let mut v = values;
        v["scope_id"] = json!(Uuid::nil());
        serde_json::from_value(v).unwrap()
    }

    #[test]
    fn null_and_absent_both_mean_inherit() {
        assert_eq!(
            row(json!({"region": null, "locale": "en-IN"})),
            row(json!({"locale": "en-IN"}))
        );
        assert_ne!(
            row(json!({"locale": "en-IN"})),
            row(json!({"locale": "ar-AE"}))
        );
    }

    #[test]
    fn unknown_keys_and_bad_values_are_refused() {
        assert!(LocaleProfile::validate(&row(json!({"shoe_size": "9"}))).is_err());
        assert!(LocaleProfile::validate(&row(json!({"currency": "rupees"}))).is_err());
        assert!(
            LocaleProfile::validate(&row(json!({"currency": "AED", "locale": "ar-AE"}))).is_ok()
        );
    }
}
