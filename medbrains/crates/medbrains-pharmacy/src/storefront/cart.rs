//! The patient's cart: one per patient, kept on the server so it follows
//! them from the portal to the app. It is their store order in status
//! `cart`; checkout moves it on.

use medbrains_core::object_store::ObjectStore;
use medbrains_core::pharmacy_storefront::{
    COUNTER_ONLY, MAX_CART_LINES, MAX_RX_BYTES, RX_CONTENT_TYPES, SaleClass,
};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::catalog::{ItemRow, StoreItem, present, rows_by_ids};
use super::settings::StoreSettings;

#[derive(Debug, Serialize)]
pub struct CartLine {
    pub item: StoreItem,
    pub quantity: i32,
    /// Added from the patient's own hospital prescription.
    pub from_prescription: bool,
    /// Price × quantity; none while the item has no price.
    pub line_total: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct Cart {
    pub lines: Vec<CartLine>,
    pub total: Decimal,
    /// Some line is Schedule H or H1: a pharmacist verifies it.
    pub prescription_needed: bool,
    /// A prescription has been uploaded for this cart.
    pub prescription_uploaded: bool,
    pub max_lines: usize,
}

/// The patient's cart, made if they have none.
pub(crate) async fn ensure_cart(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Uuid, AppError> {
    Ok(sqlx::query_scalar(
        "INSERT INTO pharmacy_store_orders (tenant_id, patient_id) VALUES ($1, $2) \
         ON CONFLICT (tenant_id, patient_id) WHERE status = 'cart' AND deleted_at IS NULL \
         DO UPDATE SET updated_at = now() RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?)
}

/// A cart line as stored.
#[derive(sqlx::FromRow)]
pub(crate) struct StoredLine {
    pub id: Uuid,
    pub catalog_item_id: Uuid,
    pub quantity: i32,
    pub via_prescription: bool,
    pub prescribed_quantity: Option<i32>,
}

pub(crate) async fn stored_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cart: Uuid,
) -> Result<Vec<StoredLine>, AppError> {
    Ok(sqlx::query_as::<_, StoredLine>(
        "SELECT id, catalog_item_id, quantity, via_prescription, prescribed_quantity \
           FROM pharmacy_store_order_lines \
          WHERE tenant_id = $1 AND store_order_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at LIMIT $3",
    )
    .bind(tenant_id)
    .bind(cart)
    .bind(i64::try_from(MAX_CART_LINES).unwrap_or(i64::MAX))
    .fetch_all(&mut **tx)
    .await?)
}

/// Whether a line can still be ordered: listed online (or taken from the
/// patient's own prescription), active, and never counter-only.
pub(crate) fn orderable(row: &ItemRow, via_prescription: bool) -> bool {
    row.active && (row.on_sale || via_prescription) && row.class() != SaleClass::CounterOnly
}

/// The cart as the patient sees it, priced now.
pub async fn view(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Cart, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let (lines, uploaded) = match super::cart_id(tx, tenant_id, patient_id).await? {
        Some(cart) => {
            let uploaded: bool = sqlx::query_scalar(
                "SELECT rx_document_key IS NOT NULL FROM pharmacy_store_orders WHERE id = $1",
            )
            .bind(cart)
            .fetch_one(&mut **tx)
            .await?;
            (stored_lines(tx, tenant_id, cart).await?, uploaded)
        }
        None => (Vec::new(), false),
    };
    let ids: Vec<Uuid> = lines.iter().map(|l| l.catalog_item_id).collect();
    let rows = rows_by_ids(tx, tenant_id, &ids, &settings).await?;
    let lines: Vec<CartLine> = lines
        .iter()
        .filter_map(|l| {
            let row = rows.get(&l.catalog_item_id)?;
            let mut item = present(row, &settings);
            item.on_sale = orderable(row, l.via_prescription);
            item.max_quantity = line_max(row, &settings, l.prescribed_quantity);
            Some(CartLine {
                line_total: item.price.map(|p| p * Decimal::from(l.quantity)),
                quantity: l.quantity,
                from_prescription: l.via_prescription,
                item,
            })
        })
        .collect();
    Ok(Cart {
        total: lines.iter().filter_map(|l| l.line_total).sum(),
        prescription_needed: lines.iter().any(|l| l.item.prescription_needed),
        prescription_uploaded: uploaded,
        max_lines: MAX_CART_LINES,
        lines,
    })
}

#[derive(Debug, Deserialize)]
pub struct SetQuantity {
    /// 0 takes it out of the cart.
    pub quantity: i32,
}

/// Put `quantity` of an item in the cart, or take it out with 0. Refused
/// for anything not orderable, unpriced, past the item's limit (one unit of
/// an H1 or habit-forming drug), or past the cart's.
pub async fn set_quantity(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    catalog_item_id: Uuid,
    quantity: i32,
) -> Result<(), AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let cart = ensure_cart(tx, tenant_id, patient_id).await?;
    if quantity <= 0 {
        sqlx::query(
            "UPDATE pharmacy_store_order_lines SET deleted_at = now() \
              WHERE tenant_id = $1 AND store_order_id = $2 AND catalog_item_id = $3 \
                AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(cart)
        .bind(catalog_item_id)
        .execute(&mut **tx)
        .await?;
        return Ok(());
    }
    // A line from the patient's prescription keeps that prescription's limit.
    let prescribed: Option<i32> = sqlx::query_scalar(
        "SELECT prescribed_quantity FROM pharmacy_store_order_lines WHERE store_order_id = $1 \
            AND catalog_item_id = $2 AND via_prescription AND deleted_at IS NULL",
    )
    .bind(cart)
    .bind(catalog_item_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    let via_prescription = prescribed.is_some();
    let mut rows = rows_by_ids(tx, tenant_id, &[catalog_item_id], &settings).await?;
    let row = rows
        .remove(&catalog_item_id)
        .filter(|r| r.active && (r.on_sale || via_prescription))
        .ok_or(AppError::NotFound)?;
    check_line(&row, quantity, &settings, prescribed)?;
    let lines: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_store_order_lines \
          WHERE store_order_id = $1 AND deleted_at IS NULL AND catalog_item_id <> $2",
    )
    .bind(cart)
    .bind(catalog_item_id)
    .fetch_one(&mut **tx)
    .await?;
    if usize::try_from(lines).unwrap_or(usize::MAX) >= MAX_CART_LINES {
        return Err(AppError::BadRequest(format!(
            "A cart holds at most {MAX_CART_LINES} medicines"
        )));
    }
    put_line(tx, tenant_id, cart, &row, quantity, None).await
}

/// The most of an item one order may take: the item's limit, or from a
/// prescription what it works out to — within the cap on H1 and
/// habit-forming drugs either way.
pub(crate) fn line_max(row: &ItemRow, settings: &StoreSettings, prescribed: Option<i32>) -> i32 {
    prescribed.map_or_else(
        || row.max_units(settings),
        |p| {
            medbrains_core::pharmacy_storefront::max_units(
                p,
                row.restricted(),
                settings.restricted_max_units,
            )
        },
    )
}

/// What stops `quantity` of this item going in an online order.
pub(crate) fn check_line(
    row: &ItemRow,
    quantity: i32,
    settings: &StoreSettings,
    prescribed: Option<i32>,
) -> Result<(), AppError> {
    if row.class() == SaleClass::CounterOnly {
        return Err(AppError::BadRequest(format!(
            "{}: {COUNTER_ONLY}",
            row.name
        )));
    }
    let max = line_max(row, settings, prescribed);
    if quantity > max {
        return Err(AppError::BadRequest(format!(
            "At most {max} of {} in one order",
            row.name
        )));
    }
    if row.price(settings).is_none() {
        return Err(AppError::Conflict(format!(
            "The pharmacy hasn't priced {} yet",
            row.name
        )));
    }
    Ok(())
}

/// Upsert one line of the cart.
pub(crate) async fn put_line(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cart: Uuid,
    row: &ItemRow,
    quantity: i32,
    prescribed: Option<i32>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO pharmacy_store_order_lines \
           (tenant_id, store_order_id, catalog_item_id, drug_name, sale_class, quantity, \
            via_prescription, prescribed_quantity) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::int IS NOT NULL, $7::int) \
         ON CONFLICT (store_order_id, catalog_item_id) WHERE deleted_at IS NULL \
         DO UPDATE SET quantity = EXCLUDED.quantity, sale_class = EXCLUDED.sale_class, \
                       via_prescription = pharmacy_store_order_lines.via_prescription \
                                          OR EXCLUDED.via_prescription, \
                       prescribed_quantity = COALESCE(EXCLUDED.prescribed_quantity, \
                                          pharmacy_store_order_lines.prescribed_quantity)",
    )
    .bind(tenant_id)
    .bind(cart)
    .bind(row.id)
    .bind(&row.name)
    .bind(row.class().as_str())
    .bind(quantity)
    .bind(prescribed)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct PrescriptionUpload {
    /// The file, base64.
    pub data_base64: String,
}

/// What the file's first bytes say it is — never what the client claims.
fn sniff(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some((RX_CONTENT_TYPES[0], "jpg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some((RX_CONTENT_TYPES[1], "png"))
    } else if bytes.starts_with(b"%PDF") {
        Some((RX_CONTENT_TYPES[2], "pdf"))
    } else {
        None
    }
}

/// Attach an uploaded prescription (photo or PDF) to the cart, in the
/// documents store. A new upload replaces the last.
pub async fn attach_prescription(
    tx: &mut Transaction<'_, Postgres>,
    store: &dyn ObjectStore,
    tenant_id: Uuid,
    patient_id: Uuid,
    upload: &PrescriptionUpload,
) -> Result<(), AppError> {
    use base64::Engine as _;
    use sha2::Digest as _;
    super::settings::require_open(tx, tenant_id).await?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(upload.data_base64.trim())
        .map_err(|_| AppError::BadRequest("That file couldn't be read".to_owned()))?;
    if bytes.len() > MAX_RX_BYTES {
        return Err(AppError::BadRequest(format!(
            "The file is too large: at most {} MB",
            MAX_RX_BYTES / (1024 * 1024)
        )));
    }
    let (content_type, ext) = sniff(&bytes)
        .ok_or_else(|| AppError::BadRequest("Upload a photo (JPEG or PNG) or a PDF".to_owned()))?;
    let sha = format!("{:x}", sha2::Sha256::digest(&bytes));
    let cart = ensure_cart(tx, tenant_id, patient_id).await?;
    let key = format!(
        "{tenant_id}/store-prescriptions/{cart}/{}.{ext}",
        Uuid::new_v4()
    );
    store
        .put(&key, bytes, Some(content_type))
        .await
        .map_err(|e| AppError::Internal(format!("prescription upload failed: {e}")))?;
    sqlx::query(
        "UPDATE pharmacy_store_orders \
            SET rx_document_key = $3, rx_document_type = $4, rx_document_sha256 = $5 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(cart)
    .bind(tenant_id)
    .bind(&key)
    .bind(content_type)
    .bind(sha)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sniff;

    #[test]
    fn the_file_says_what_it_is() {
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0]).map(|s| s.1), Some("jpg"));
        assert_eq!(sniff(b"\x89PNG\r\n").map(|s| s.1), Some("png"));
        assert_eq!(sniff(b"%PDF-1.7").map(|s| s.1), Some("pdf"));
        assert_eq!(sniff(b"<html>"), None);
    }
}
