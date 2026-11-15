//! The locale-profile adapter's database side: which scope a row names, the
//! live values there, the checks that need the database, and the write the
//! migration 1462 guard lets through.

use std::collections::BTreeMap;

use medbrains_country::Field;
use serde_json::Value;
use uuid::Uuid;

use crate::adapter::Tx;
use crate::locale_profile::LocaleProfileRow;

/// Fields the hospital must always have: unset, they would leave every
/// screen without money, a clock or a country.
const HOSPITAL_REQUIRED: [Field; 5] = [
    Field::Country,
    Field::Currency,
    Field::Timezone,
    Field::Locale,
    Field::FiscalYearStart,
];

/// Every profile key, for the queries that read or unset them all at once.
fn keys() -> Vec<String> {
    Field::ALL.iter().map(|f| f.key().to_owned()).collect()
}

/// The scope a row's id names, or the refusal.
pub(crate) async fn scope_of(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    if id == tenant {
        return Ok(Some("hospital".to_owned()));
    }
    let found = sqlx::query_scalar!(
        "SELECT name FROM facilities WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
        tenant,
        id,
    )
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|_| "facility".to_owned()))
}

/// The live values at one scope, locked for the rest of the transaction.
pub(crate) async fn stored(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
) -> Result<BTreeMap<String, Value>, sqlx::Error> {
    let rows = if id == tenant {
        sqlx::query!(
            "SELECT key, value FROM tenant_settings WHERE tenant_id = $1 AND category = 'locale' \
               AND key = ANY($2) AND deleted_at IS NULL FOR UPDATE",
            tenant,
            &keys(),
        )
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|r| (r.key, r.value))
        .collect()
    } else {
        sqlx::query!(
            "SELECT key, value FROM scoped_settings WHERE tenant_id = $1 AND scope = 'facility' \
               AND scope_id = $2 AND category = 'locale' AND deleted_at IS NULL FOR UPDATE",
            tenant,
            id,
        )
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|r| (r.key, r.value))
        .collect()
    };
    Ok(rows)
}

/// The checks that need the database; the inner `Err` is the refusal.
pub(crate) async fn check_row(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    row: &LocaleProfileRow,
) -> Result<Result<(), String>, sqlx::Error> {
    let Some(scope) = scope_of(tx, tenant, row.scope_id).await? else {
        return Ok(Err("No such facility in this hospital".to_owned()));
    };
    for (key, _) in row.set_values() {
        let Some(field) = Field::from_key(key) else {
            continue;
        };
        if !field.settable_at(&scope) {
            return Ok(Err(format!(
                "{key} is set for the whole hospital, not per {scope}"
            )));
        }
    }
    if scope == "hospital" {
        let unset = |f: &&Field| row.values.get(f.key()).is_none_or(Value::is_null);
        if let Some(f) = HOSPITAL_REQUIRED.iter().find(unset) {
            return Ok(Err(format!("The hospital needs a {}", f.key())));
        }
    }
    if let Some(tz) = row.text(Field::Timezone) {
        let known = sqlx::query_scalar!(
            r#"SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1) AS "known!""#,
            tz,
        )
        .fetch_one(&mut **tx)
        .await?;
        if !known {
            return Ok(Err(format!("\"{tz}\" is not an IANA time zone")));
        }
    }
    let live = stored(tx, tenant, tenant).await?;
    let country = row
        .text(Field::Country)
        .or_else(|| live.get("country").and_then(Value::as_str));
    if let Some(region) = row.text(Field::Region)
        && !country.is_some_and(|c| region.starts_with(&format!("{c}-")))
    {
        return Ok(Err(format!(
            "Region {region} is not in the hospital's country"
        )));
    }
    if let Some(version) = row.text(Field::PackVersion) {
        let pack = medbrains_country::pack::for_country(country)
            .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
        if version != pack.pack.version {
            return Ok(Err(format!(
                "This release carries {} pack {}",
                pack.pack.id, pack.pack.version
            )));
        }
    }
    let new_currency = row.text(Field::Currency);
    let old_currency = live.get("currency").and_then(Value::as_str);
    if scope == "hospital" && old_currency.is_some() && new_currency != old_currency {
        let has_money = sqlx::query_scalar!(
            r#"SELECT (EXISTS (SELECT 1 FROM invoices WHERE tenant_id = $1)
                    OR EXISTS (SELECT 1 FROM payments WHERE tenant_id = $1)
                    OR EXISTS (SELECT 1 FROM receipts WHERE tenant_id = $1)
                    OR EXISTS (SELECT 1 FROM patient_advances WHERE tenant_id = $1)
                    OR EXISTS (SELECT 1 FROM journal_entries WHERE tenant_id = $1)) AS "has!""#,
            tenant,
        )
        .fetch_one(&mut **tx)
        .await?;
        if has_money {
            return Ok(Err(
                "The currency cannot change once bills or payments exist: past amounts would be relabelled"
                    .to_owned(),
            ));
        }
    }
    Ok(Ok(()))
}

/// Upsert the set values and unset the rest, at the row's scope.
pub(crate) async fn write_row(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    row: &LocaleProfileRow,
) -> Result<(), sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT set_config('medbrains.locale_profile_writer', 'change_set', true) AS "set!""#
    )
    .fetch_one(&mut **tx)
    .await?;
    let (set_keys, set_values): (Vec<String>, Vec<Value>) = row
        .set_values()
        .filter(|(k, _)| Field::from_key(k).is_some())
        .map(|(k, v)| (k.clone(), v.clone()))
        .unzip();
    let unset: Vec<String> = keys()
        .into_iter()
        .filter(|k| !set_keys.contains(k))
        .collect();
    if row.scope_id == tenant {
        sqlx::query!(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             SELECT $1, 'locale', k, v FROM unnest($2::text[], $3::jsonb[]) AS t(k, v) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
                deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
            tenant,
            &set_keys,
            &set_values,
        )
        .execute(&mut **tx)
        .await?;
        sqlx::query!(
            "UPDATE tenant_settings SET deleted_at = now(), delete_reason = 'locale profile change set' \
              WHERE tenant_id = $1 AND category = 'locale' AND key = ANY($2) AND deleted_at IS NULL",
            tenant,
            &unset,
        )
        .execute(&mut **tx)
        .await?;
    } else {
        sqlx::query!(
            "UPDATE scoped_settings SET deleted_at = now(), delete_reason = 'locale profile change set' \
              WHERE tenant_id = $1 AND scope = 'facility' AND scope_id = $2 AND category = 'locale' \
                AND deleted_at IS NULL",
            tenant,
            row.scope_id,
        )
        .execute(&mut **tx)
        .await?;
        sqlx::query!(
            "INSERT INTO scoped_settings (tenant_id, scope, scope_id, category, key, value) \
             SELECT $1, 'facility', $2, 'locale', k, v FROM unnest($3::text[], $4::jsonb[]) AS t(k, v)",
            tenant,
            row.scope_id,
            &set_keys,
            &set_values,
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
