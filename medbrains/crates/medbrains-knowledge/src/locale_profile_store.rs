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

const HOSPITAL: &str = "hospital";
const FACILITY: &str = "facility";

/// Which scope a row names, and its display name for diffs and impact.
#[derive(Debug, Clone)]
pub(crate) struct Scope {
    pub(crate) kind: &'static str,
    pub(crate) name: String,
}

/// The scope a row's id names: the hospital (the tenant's id) or one of its
/// facilities; `None` for anything else.
pub(crate) async fn scope_of(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
) -> Result<Option<Scope>, sqlx::Error> {
    if id == tenant {
        let name = sqlx::query_scalar!("SELECT name FROM tenants WHERE id = $1", tenant)
            .fetch_one(&mut **tx)
            .await?;
        return Ok(Some(Scope {
            kind: HOSPITAL,
            name,
        }));
    }
    let found = sqlx::query_scalar!(
        "SELECT name FROM facilities WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
        tenant,
        id,
    )
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|name| Scope {
        kind: FACILITY,
        name,
    }))
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

/// A database answer whose inner `Err` is a refusal in words.
type Check = Result<Result<(), String>, sqlx::Error>;

/// The checks that need the database; the inner `Err` is the refusal.
pub(crate) async fn check_row(tx: &mut Tx<'_>, tenant: Uuid, row: &LocaleProfileRow) -> Check {
    let Some(scope) = scope_of(tx, tenant, row.scope_id).await? else {
        return Ok(Err("No such facility in this hospital".to_owned()));
    };
    let live = stored(tx, tenant, tenant).await?;
    let pure = check_fields(row, scope.kind).and_then(|()| check_region_and_pack(row, &live));
    if pure.is_err() {
        return Ok(pure);
    }
    // Whether Postgres knows the zone is the database guard's one check
    // (migration 1462); it runs on preview's trial write and on apply.
    if scope.kind != HOSPITAL {
        return Ok(Ok(()));
    }
    check_currency(tx, tenant, row, &live).await
}

/// Every set field may be set at this scope, and the hospital keeps the
/// fields it cannot do without.
fn check_fields(row: &LocaleProfileRow, scope: &str) -> Result<(), String> {
    for (key, _) in row.set_values() {
        if Field::from_key(key).is_some_and(|f| !f.settable_at(scope)) {
            return Err(format!(
                "{key} is set for the whole hospital, not per {scope}"
            ));
        }
    }
    let unset = |f: &&Field| row.values.get(f.key()).is_none_or(Value::is_null);
    match HOSPITAL_REQUIRED.iter().find(unset) {
        Some(f) if scope == HOSPITAL => Err(format!("The hospital needs a {}", f.key())),
        _ => Ok(()),
    }
}

/// A region lies in the hospital's country; a pack version is the one this
/// release carries for it.
fn check_region_and_pack(
    row: &LocaleProfileRow,
    live: &BTreeMap<String, Value>,
) -> Result<(), String> {
    let country = row
        .text(Field::Country)
        .or_else(|| live.get("country").and_then(Value::as_str));
    if let Some(region) = row.text(Field::Region)
        && !country.is_some_and(|c| region.starts_with(&format!("{c}-")))
    {
        return Err(format!("Region {region} is not in the hospital's country"));
    }
    let Some(version) = row.text(Field::PackVersion) else {
        return Ok(());
    };
    let pack = medbrains_country::pack::for_country(country).map_err(ToString::to_string)?;
    if version == pack.pack.version {
        Ok(())
    } else {
        Err(format!(
            "This release carries {} pack {}",
            pack.pack.id, pack.pack.version
        ))
    }
}

/// The currency is fixed once money has moved: stored amounts carry no
/// currency, so changing it would relabel every past bill.
async fn check_currency(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    row: &LocaleProfileRow,
    live: &BTreeMap<String, Value>,
) -> Check {
    let old = live.get("currency").and_then(Value::as_str);
    if old.is_none() || row.text(Field::Currency) == old {
        return Ok(Ok(()));
    }
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
    Ok(if has_money {
        Err("The currency cannot change once bills or payments exist: past amounts would be relabelled".to_owned())
    } else {
        Ok(())
    })
}

/// The row's profile values as parallel key and value lists, plus the keys it
/// leaves unset (which inherit).
fn split_values(row: &LocaleProfileRow) -> (Vec<String>, Vec<Value>, Vec<String>) {
    let (keys_set, values): (Vec<String>, Vec<Value>) = row
        .set_values()
        .filter(|(k, _)| Field::from_key(k).is_some())
        .map(|(k, v)| (k.clone(), v.clone()))
        .unzip();
    let unset = keys()
        .into_iter()
        .filter(|k| !keys_set.contains(k))
        .collect();
    (keys_set, values, unset)
}

/// Upsert the set values and unset the rest, at the row's scope. Marks the
/// transaction so the migration 1462 guard lets this writer through.
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
    let (set_keys, set_values, unset) = split_values(row);
    if row.scope_id == tenant {
        write_hospital(tx, tenant, (&set_keys, &set_values), &unset).await
    } else {
        write_facility(tx, tenant, row.scope_id, (&set_keys, &set_values)).await
    }
}

/// The hospital scope in `tenant_settings`: upsert what is set, soft-delete
/// what is not (the `tenants` columns follow through the mirror trigger).
async fn write_hospital(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    (set_keys, set_values): (&[String], &[Value]),
    unset: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT $1, 'locale', k, v FROM unnest($2::text[], $3::jsonb[]) AS t(k, v) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
            deleted_at = NULL, deleted_by = NULL, delete_reason = NULL",
        tenant,
        set_keys,
        set_values,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "UPDATE tenant_settings SET deleted_at = now(), delete_reason = 'locale profile change set' \
          WHERE tenant_id = $1 AND category = 'locale' AND key = ANY($2) AND deleted_at IS NULL",
        tenant,
        unset,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One facility's scope in `scoped_settings`: retire its live rows, then
/// insert what is set.
async fn write_facility(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    facility: Uuid,
    (set_keys, set_values): (&[String], &[Value]),
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE scoped_settings SET deleted_at = now(), delete_reason = 'locale profile change set' \
          WHERE tenant_id = $1 AND scope = 'facility' AND scope_id = $2 AND category = 'locale' \
            AND deleted_at IS NULL",
        tenant,
        facility,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "INSERT INTO scoped_settings (tenant_id, scope, scope_id, category, key, value) \
         SELECT $1, 'facility', $2, 'locale', k, v FROM unnest($3::text[], $4::jsonb[]) AS t(k, v)",
        tenant,
        facility,
        set_keys,
        set_values,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
