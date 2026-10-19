//! Matching a supplier's product to our catalogue (#4861). A confirmed
//! per-supplier alias is the only thing that fills a line by itself; below
//! it, candidates are ranked by trigram similarity on the name, boosted on
//! INN, strength, dosage form, pack and manufacturer. A wrong strength is a
//! dispensing error, so a suggestion is only ever a suggestion.

use std::collections::HashMap;

use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::grn_scan_contract::DraftLine;

/// Candidates shown per line.
pub const SUGGESTIONS_PER_LINE: i64 = 5;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Suggestion {
    /// Index of the draft line this candidate is for.
    pub line: i32,
    pub catalog_item_id: Uuid,
    pub code: String,
    pub name: String,
    pub strength: Option<String>,
    pub dosage_form: Option<String>,
    pub pack_size: Option<i32>,
    pub manufacturer: Option<String>,
    pub drug_schedule: Option<String>,
    pub is_controlled: Option<bool>,
    pub score: f64,
}

fn col<F: Fn(&DraftLine) -> Option<&String>>(lines: &[&DraftLine], f: F) -> Vec<Option<String>> {
    lines
        .iter()
        .map(|l| f(l).map(|s| s.trim().to_lowercase()))
        .collect()
}

/// Top candidates for every line, in one round trip.
pub async fn suggest(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    lines: &[&DraftLine],
    per_line: i64,
) -> Result<Vec<Suggestion>, AppError> {
    Ok(sqlx::query_as::<_, Suggestion>(
        "SELECT (u.ord - 1)::int AS line, c.* FROM UNNEST($2::text[], $3::text[], $4::text[], \
                $5::text[], $6::text[], $7::text[]) WITH ORDINALITY \
                AS u(name, strength, form, mfr, inn, pack, ord) \
         CROSS JOIN LATERAL ( \
            SELECT sc.id AS catalog_item_id, sc.code, sc.name, pc.strength, pc.dosage_form, \
                   pc.pack_size, pc.manufacturer, pc.drug_schedule, pc.is_controlled, \
                   (similarity(lower(sc.name), u.name) \
                    + CASE WHEN u.inn IS NOT NULL AND lower(pc.inn_name) = u.inn THEN 0.2 ELSE 0 END \
                    + CASE WHEN u.strength IS NOT NULL AND regexp_replace(lower(pc.strength), '\\s', '', 'g') \
                                = regexp_replace(u.strength, '\\s', '', 'g') THEN 0.2 ELSE 0 END \
                    + CASE WHEN u.form IS NOT NULL AND lower(pc.dosage_form) = u.form THEN 0.1 ELSE 0 END \
                    + CASE WHEN u.mfr IS NOT NULL AND lower(pc.manufacturer) % u.mfr THEN 0.1 ELSE 0 END \
                    + CASE WHEN u.pack IS NOT NULL AND pc.pack_size IS NOT NULL \
                                AND u.pack ~ ('(^|[^0-9])' || pc.pack_size || '$') THEN 0.05 ELSE 0 END \
                   )::float8 AS score \
              FROM store_catalog sc \
              LEFT JOIN pharmacy_catalog pc ON pc.store_catalog_id = sc.id \
                    AND pc.tenant_id = sc.tenant_id AND pc.deleted_at IS NULL \
                    AND pc.merged_into_id IS NULL \
             WHERE sc.tenant_id = $1 AND sc.deleted_at IS NULL AND sc.is_active \
               AND (lower(sc.name) % u.name OR (u.inn IS NOT NULL AND lower(pc.inn_name) = u.inn)) \
             ORDER BY score DESC, sc.name LIMIT $8) c \
         WHERE u.name IS NOT NULL \
         ORDER BY u.ord, c.score DESC",
    )
    .bind(tenant_id)
    .bind(col(lines, |l| l.product_name.as_ref()))
    .bind(col(lines, |l| l.strength.as_ref()))
    .bind(col(lines, |l| l.dosage_form.as_ref()))
    .bind(col(lines, |l| l.manufacturer.as_ref()))
    .bind(col(lines, |l| l.inn_name.as_ref()))
    .bind(col(lines, |l| l.pack.as_ref()))
    .bind(per_line)
    .fetch_all(&mut **tx)
    .await?)
}

/// Confirmed aliases for these lines: line index → catalogue item.
pub async fn aliases_for(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    vendor_id: Uuid,
    lines: &[DraftLine],
) -> Result<HashMap<usize, Uuid>, AppError> {
    let names: Vec<Option<String>> = lines.iter().map(|l| l.product_name.clone()).collect();
    let rows: Vec<(i64, Uuid)> = sqlx::query_as(
        "SELECT u.ord - 1, a.catalog_item_id \
           FROM UNNEST($3::text[]) WITH ORDINALITY AS u(name, ord) \
           JOIN supplier_item_aliases a ON a.tenant_id = $1 AND a.vendor_id = $2 \
                AND a.deleted_at IS NULL \
                AND a.supplier_name_norm = supplier_item_name_norm(u.name) \
           JOIN store_catalog sc ON sc.id = a.catalog_item_id \
                AND sc.deleted_at IS NULL AND sc.is_active",
    )
    .bind(tenant_id)
    .bind(vendor_id)
    .bind(names)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(i, id)| usize::try_from(i).ok().map(|i| (i, id)))
        .collect())
}

/// Remember every confirmed (supplier name → item) pair on a committed bill.
pub async fn learn_aliases(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    vendor_id: Uuid,
    user_id: Uuid,
    lines: &[DraftLine],
) -> Result<(), AppError> {
    let pairs: Vec<&DraftLine> = lines
        .iter()
        .filter(|l| l.product_name.is_some() && l.catalog_item_id.is_some())
        .collect();
    sqlx::query(
        "INSERT INTO supplier_item_aliases \
             (tenant_id, vendor_id, supplier_name_norm, supplier_code, catalog_item_id, confirmed_by) \
         SELECT DISTINCT ON (supplier_item_name_norm(u.name)) \
                $1, $2, supplier_item_name_norm(u.name), u.code, u.item, $3 \
           FROM UNNEST($4::text[], $5::text[], $6::uuid[]) WITH ORDINALITY AS u(name, code, item, ord) \
          WHERE supplier_item_name_norm(u.name) IS NOT NULL \
          ORDER BY supplier_item_name_norm(u.name), u.ord DESC \
         ON CONFLICT (tenant_id, vendor_id, supplier_name_norm) WHERE deleted_at IS NULL \
         DO UPDATE SET catalog_item_id = EXCLUDED.catalog_item_id, \
                supplier_code = COALESCE(EXCLUDED.supplier_code, supplier_item_aliases.supplier_code), \
                times_used = supplier_item_aliases.times_used + 1, \
                confirmed_by = EXCLUDED.confirmed_by, last_used_at = now()",
    )
    .bind(tenant_id)
    .bind(vendor_id)
    .bind(user_id)
    .bind(pairs.iter().map(|l| l.product_name.clone()).collect::<Vec<_>>())
    .bind(pairs.iter().map(|l| l.supplier_code.clone()).collect::<Vec<_>>())
    .bind(pairs.iter().map(|l| l.catalog_item_id).collect::<Vec<_>>())
    .execute(&mut **tx)
    .await?;
    Ok(())
}
