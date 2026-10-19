//! The Schedule H1 register (Drugs Rules, Rule 65(3)): every H1 supply with
//! the prescriber, the patient and their address, the drug, batch, expiry,
//! quantity and bill — kept and shown to an inspector. Built from what was
//! dispensed, whether at the counter, against a hospital prescription or an
//! online order, so it cannot drift from the stock it records. Kept for
//! five years with the dispensing records (Pharmacy Practice Regulations
//! 2015, reg. 13(f)); nothing here is ever deleted.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Entries one page returns.
const PAGE_LIMIT: i64 = 1000;
/// Longest period one view covers.
const MAX_DAYS: i64 = 366;

#[derive(Debug, Deserialize)]
pub struct RegisterQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct H1Entry {
    pub dispensed_at: Option<DateTime<Utc>>,
    pub order_id: Uuid,
    pub drug_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: i32,
    pub patient_name: Option<String>,
    pub patient_address: Option<String>,
    pub prescriber_name: Option<String>,
    pub prescriber_registration: Option<String>,
    pub bill_number: Option<String>,
}

/// `GET /api/pharmacy/h1-register?from=&to=`
pub async fn h1_register(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<RegisterQuery>,
) -> Result<Json<Vec<H1Entry>>, AppError> {
    require_permission(&claims, permissions::pharmacy::h1_register::VIEW)?;
    if q.to < q.from || (q.to - q.from) > Duration::days(MAX_DAYS) {
        return Err(AppError::BadRequest(format!(
            "Choose a period of at most {MAX_DAYS} days"
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, H1Entry>(
        "SELECT o.dispensed_at, o.id AS order_id, i.drug_name, i.batch_number, i.expiry_date, \
                COALESCE(NULLIF(i.quantity_dispensed, 0), i.quantity) AS quantity, \
                NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS patient_name, \
                COALESCE(s.patient_address, ps.rx_patient_address, \
                         NULLIF(concat_ws(', ', NULLIF(p.address->>'line1', ''), \
                                NULLIF(p.address->>'city', ''), \
                                NULLIF(p.address->>'postal_code', '')), '')) AS patient_address, \
                COALESCE(s.prescriber_name, ps.rx_prescriber_name, doc.full_name) AS prescriber_name, \
                COALESCE(s.prescriber_registration, ps.rx_prescriber_registration, \
                         doc.medical_registration_number, doc.registration_number) \
                    AS prescriber_registration, \
                (SELECT inv.invoice_number FROM invoice_items ii \
                   JOIN invoices inv ON inv.id = ii.invoice_id AND inv.tenant_id = ii.tenant_id \
                  WHERE ii.tenant_id = o.tenant_id AND ii.pharmacy_order_id = o.id \
                  ORDER BY ii.created_at LIMIT 1) AS bill_number \
           FROM pharmacy_order_items i \
           JOIN pharmacy_orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id \
           JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
           LEFT JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
           LEFT JOIN pharmacy_store_orders s \
                  ON s.pharmacy_order_id = o.id AND s.tenant_id = o.tenant_id \
           LEFT JOIN pharmacy_pos_sales ps \
                  ON ps.pharmacy_order_id = o.id AND ps.tenant_id = o.tenant_id \
           LEFT JOIN prescriptions rx ON rx.id = o.prescription_id AND rx.tenant_id = o.tenant_id \
           LEFT JOIN users doc ON doc.id = rx.doctor_id \
          WHERE i.tenant_id = $1 AND c.drug_schedule = 'H1' AND i.removed_at IS NULL \
            AND o.dispensed_at >= $2::date AND o.dispensed_at < $3::date + 1 \
          ORDER BY o.dispensed_at, i.created_at LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .bind(PAGE_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
