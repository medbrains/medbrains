//! An online order's lines on the GST tax invoice. A storefront sale is an
//! outpatient retail supply and always taxable (research brief §6: the
//! in-patient composite exemption never applies to it), and the sale is
//! made in the hospital's licensing state, so it is CGST + SGST, half each,
//! with the item's HSN code (CGST Rules 2017, Rule 46).

use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Fill the GST columns of `order_id`'s invoice lines from the catalogue,
/// and say on the invoice that it was ordered online.
pub(crate) async fn tax_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE invoice_items ii \
            SET gst_rate = r.rate, \
                gst_type = CASE WHEN r.rate > 0 THEN 'cgst_sgst'::gst_type \
                                ELSE 'exempt'::gst_type END, \
                cgst_amount = round(ii.unit_price * ii.quantity * r.rate / 200, 2), \
                sgst_amount = round(ii.unit_price * ii.quantity * r.rate / 200, 2), \
                igst_amount = 0, \
                hsn_sac_code = COALESCE(r.hsn, ii.hsn_sac_code) \
           FROM (SELECT oi.id, COALESCE(NULLIF(c.gst_rate, 0), c.tax_percent, 0) AS rate, \
                        NULLIF(c.hsn_code, '') AS hsn \
                   FROM pharmacy_order_items oi \
                   JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
                  WHERE oi.tenant_id = $1 AND oi.order_id = $2) r \
          WHERE ii.tenant_id = $1 AND ii.pharmacy_order_id = $2 AND ii.source_id = r.id \
            AND ii.is_reversal = false",
    )
    .bind(tenant_id)
    .bind(order_id)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE invoices i SET notes = concat_ws(' · ', NULLIF(i.notes, ''), 'Ordered online') \
          WHERE i.tenant_id = $1 AND i.id IN (SELECT invoice_id FROM invoice_items \
                 WHERE tenant_id = $1 AND pharmacy_order_id = $2) \
            AND COALESCE(i.notes, '') NOT LIKE '%Ordered online%'",
    )
    .bind(tenant_id)
    .bind(order_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
