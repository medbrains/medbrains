//! Issued bills as InvoiceRecord bundles: one Invoice per bill, a line per
//! item with its rate, discount and GST parts.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use medbrains_fhir::nrces::{InvoiceHeader, InvoiceItem, RecordKind, invoice};
use serde_json::Value;
use uuid::Uuid;

use super::bundle_records::{
    Common, ITEM_LIMIT, One, Tx, Who, bundle, clinical, ids, section, who,
};
use super::bundles::ContextRow;
use crate::error::AppError;

#[derive(sqlx::FromRow)]
struct BillRow {
    #[sqlx(flatten)]
    who: Who,
    invoice_number: String,
    paid: bool,
    admission: bool,
    at: DateTime<Utc>,
    currency: String,
    net: f64,
    gross: f64,
}

#[derive(sqlx::FromRow)]
struct LineRow {
    invoice_id: Uuid,
    description: String,
    quantity: i32,
    unit_price: f64,
    discount: f64,
    cgst: f64,
    sgst: f64,
    igst: f64,
}

pub(super) async fn invoices(
    tx: Tx<'_, '_>,
    c: &Common<'_>,
    mine: &[&ContextRow],
    out: &mut Vec<(String, Value)>,
) -> Result<(), AppError> {
    if mine.is_empty() {
        return Ok(());
    }
    let sql = format!(
        "SELECT x.id, x.invoice_number, x.status::text = 'paid' AS paid, \
                x.admission_id IS NOT NULL AS admission, \
                COALESCE(x.issued_at, x.invoice_date, x.created_at) AS at, x.currency::text AS currency, \
                (x.subtotal - x.discount_amount)::float8 AS net, x.total_amount::float8 AS gross, {} \
          WHERE x.tenant_id = $1 AND x.id = ANY($2) AND x.deleted_at IS NULL",
        who("COALESCE(x.doctor_id, x.created_by)", "x.encounter_id")
            .replace("{from}", "invoices x")
    );
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: HashMap<Uuid, BillRow> = sqlx::query_as::<_, BillRow>(&sql)
        .bind(c.tenant_id)
        .bind(ids(mine))
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|r| (r.who.id, r))
        .collect();
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let lines: Vec<LineRow> = sqlx::query_as(
        "SELECT invoice_id, description, quantity, unit_price::float8 AS unit_price, \
                discount_amount::float8 AS discount, COALESCE(cgst_amount, 0)::float8 AS cgst, \
                COALESCE(sgst_amount, 0)::float8 AS sgst, COALESCE(igst_amount, 0)::float8 AS igst \
           FROM invoice_items WHERE tenant_id = $1 AND invoice_id = ANY($2) \
            AND deleted_at IS NULL AND NOT is_reversal ORDER BY created_at LIMIT $3",
    )
    .bind(c.tenant_id)
    .bind(ids(mine))
    .bind(ITEM_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_bill: HashMap<Uuid, Vec<InvoiceItem>> = HashMap::new();
    for l in lines {
        by_bill.entry(l.invoice_id).or_default().push(InvoiceItem {
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: l.discount,
            cgst: l.cgst,
            sgst: l.sgst,
            igst: l.igst,
        });
    }
    for context in mine {
        let Some(r) = rows.get(&context.source_id) else {
            continue;
        };
        let author = r.who.author();
        let ctx = clinical(c, author.as_ref(), r.who.encounter_id, r.at);
        let kind = match (r.admission, r.who.encounter_id) {
            (true, _) => "02",
            (false, Some(_)) => "03",
            (false, None) => "99",
        };
        let bill = invoice(
            &ctx,
            &InvoiceHeader {
                id: r.who.id,
                number: r.invoice_number.clone(),
                paid: r.paid,
                kind,
                date: r.at,
                currency: r.currency.clone(),
                net: r.net,
                gross: r.gross,
            },
            by_bill.get(&r.who.id).map_or(&[][..], Vec::as_slice),
        );
        out.push(bundle(
            c,
            One {
                kind: RecordKind::Invoice,
                context,
                at: r.at,
                author,
                encounter: r.who.encounter(),
                sections: vec![section("Invoice", None, vec![bill])],
            },
        ));
    }
    Ok(())
}
