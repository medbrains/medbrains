//! Writing GRN lines: every line of a bill in one statement.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::grn::CreateGrnItemInput;
use crate::grn_validate::{LineFacts, accepted_value};

fn trimmed(s: Option<&String>) -> Option<String> {
    s.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

/// Insert the lines in bill order (`created_at` steps a microsecond a line).
pub async fn insert_lines(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    grn_id: Uuid,
    items: &[CreateGrnItemInput],
    facts: &[LineFacts],
) -> Result<(), AppError> {
    let ord: Vec<i32> = (0..items.len())
        .filter_map(|i| i32::try_from(i).ok())
        .collect();
    let totals: Vec<_> = facts.iter().map(accepted_value).collect();
    sqlx::query(
        "INSERT INTO grn_items \
         (tenant_id, grn_id, po_item_id, catalog_item_id, item_name, quantity_received, \
          quantity_accepted, quantity_rejected, batch_number, expiry_date, manufacture_date, \
          unit_price, total_amount, rejection_reason, notes, mrp, ptr, free_quantity, \
          discount_amount, gst_rate, hsn_code, created_at) \
         SELECT $1, $2, u.po, u.cat, u.name, u.rec, u.acc, u.rej, u.batch, u.exp, u.mfg, \
                u.rate, u.total, u.reason, u.notes, u.mrp, u.ptr, u.free, u.disc, u.gst, u.hsn, \
                now() + u.ord * interval '1 microsecond' \
           FROM UNNEST($3::uuid[], $4::uuid[], $5::text[], $6::int[], $7::int[], $8::int[], \
                       $9::text[], $10::date[], $11::date[], $12::numeric[], $13::numeric[], \
                       $14::text[], $15::text[], $16::numeric[], $17::numeric[], $18::int[], \
                       $19::numeric[], $20::numeric[], $21::text[], $22::int[]) \
                AS u(po, cat, name, rec, acc, rej, batch, exp, mfg, rate, total, reason, notes, \
                     mrp, ptr, free, disc, gst, hsn, ord)",
    )
    .bind(tenant_id)
    .bind(grn_id)
    .bind(items.iter().map(|i| i.po_item_id).collect::<Vec<_>>())
    .bind(items.iter().map(|i| i.catalog_item_id).collect::<Vec<_>>())
    .bind(
        items
            .iter()
            .map(|i| i.item_name.trim().to_owned())
            .collect::<Vec<_>>(),
    )
    .bind(
        items
            .iter()
            .map(|i| i.quantity_received)
            .collect::<Vec<_>>(),
    )
    .bind(
        items
            .iter()
            .map(|i| i.quantity_accepted)
            .collect::<Vec<_>>(),
    )
    .bind(
        items
            .iter()
            .map(|i| i.quantity_rejected.unwrap_or(0))
            .collect::<Vec<_>>(),
    )
    .bind(
        items
            .iter()
            .map(|i| trimmed(i.batch_number.as_ref()))
            .collect::<Vec<_>>(),
    )
    .bind(items.iter().map(|i| i.expiry_date).collect::<Vec<_>>())
    .bind(items.iter().map(|i| i.manufacture_date).collect::<Vec<_>>())
    .bind(items.iter().map(|i| i.unit_price).collect::<Vec<_>>())
    .bind(totals)
    .bind(
        items
            .iter()
            .map(|i| i.rejection_reason.clone())
            .collect::<Vec<_>>(),
    )
    .bind(items.iter().map(|i| i.notes.clone()).collect::<Vec<_>>())
    .bind(items.iter().map(|i| i.mrp).collect::<Vec<_>>())
    .bind(items.iter().map(|i| i.ptr).collect::<Vec<_>>())
    .bind(
        items
            .iter()
            .map(|i| i.free_quantity.unwrap_or(0))
            .collect::<Vec<_>>(),
    )
    .bind(
        items
            .iter()
            .map(|i| i.discount_amount.unwrap_or_default())
            .collect::<Vec<_>>(),
    )
    .bind(items.iter().map(|i| i.gst_rate).collect::<Vec<_>>())
    .bind(
        items
            .iter()
            .map(|i| trimmed(i.hsn_code.as_ref()))
            .collect::<Vec<_>>(),
    )
    .bind(ord)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
