//! Cancelling and returning online orders (owner decision 5; the law is
//! `docs/compliance/pharmacy-returns.md`).
//!
//! * A patient cancels free until the order is dispensed and on its way;
//!   whatever they paid is refunded the way they paid.
//! * Within the return window (7 days by default) a patient may return a
//!   wrong, damaged, short-dated or excess medicine. Each request is a
//!   grievance in the hospital's complaints register: acknowledged within 48
//!   hours, resolved within 30 days (E-Commerce Rules 2020).
//! * The pharmacist receives the packs and records whether each is sealed;
//!   `pharmacy_returns::disposition` decides restock or quarantine — never the
//!   pharmacist's preference — and the refund and GST credit note follow.

use medbrains_core::pharmacy_returns::{
    GRIEVANCE_ACK_HOURS, GRIEVANCE_RESOLVE_DAYS, ONLINE_RETURN_REASONS, within_window,
};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::refunds::{Owed, owe};

/// Lines one return may name, at most.
const MAX_RETURN_LINES: usize = 20;

/// The pharmacy order behind a released store order, and where it is.
#[derive(sqlx::FromRow)]
struct Placed {
    status: String,
    pharmacy_order_id: Option<Uuid>,
    pharmacy_status: Option<String>,
    on_its_way: bool,
}

/// `POST /api/portal/store/orders/{id}/cancel` — the patient cancels before
/// dispatch. Free; the holds let go, the pharmacy order and its charges
/// reversed, and anything paid owed back.
pub async fn cancel(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let placed = sqlx::query_as::<_, Placed>(
        "SELECT s.status, s.pharmacy_order_id, o.status::text AS pharmacy_status, \
                EXISTS (SELECT 1 FROM pharmacy_deliveries d WHERE d.tenant_id = s.tenant_id \
                         AND d.store_order_id = s.id AND d.deleted_at IS NULL \
                         AND d.status IN ('out_for_delivery', 'delivered')) AS on_its_way \
           FROM pharmacy_store_orders s \
           LEFT JOIN pharmacy_orders o ON o.id = s.pharmacy_order_id AND o.tenant_id = s.tenant_id \
          WHERE s.id = $1 AND s.tenant_id = $2 AND s.patient_id = $3 AND s.deleted_at IS NULL \
            AND s.status <> 'cart' \
          FOR UPDATE OF s",
    )
    .bind(order_id)
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let cancellable = match placed.status.as_str() {
        "awaiting_verification" => true,
        "released" => placed.pharmacy_status.as_deref() == Some("ordered") && !placed.on_its_way,
        _ => false,
    };
    if !cancellable {
        return Err(AppError::Conflict(
            "This order has already been dispensed or sent: you can return it within the \
             return window instead"
                .to_owned(),
        ));
    }
    if let Some(pharmacy_order) = placed.pharmacy_order_id {
        undo_pharmacy_order(tx, tenant_id, pharmacy_order).await?;
    }
    super::holds::release(tx, tenant_id, order_id, "cancelled").await?;
    sqlx::query(
        "UPDATE pharmacy_store_orders SET status = 'cancelled', cancelled_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    let total: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(unit_price * COALESCE(approved_quantity, quantity)), 0) \
           FROM pharmacy_store_order_lines \
          WHERE tenant_id = $1 AND store_order_id = $2 AND status IN ('pending', 'approved') \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(&mut **tx)
    .await?;
    owe(
        tx,
        tenant_id,
        &Owed {
            store_order_id: order_id,
            store_return_id: None,
            cause: "cancelled",
            amount: total,
        },
    )
    .await?;
    Ok(())
}

/// Cancel the pharmacy order and reverse its charges, under the pharmacist
/// in charge — the licensed person answerable for the storefront.
async fn undo_pharmacy_order(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    pharmacy_order: Uuid,
) -> Result<(), AppError> {
    let actor = super::settings::load(tx, tenant_id)
        .await?
        .pharmacist_in_charge
        .ok_or_else(|| {
            AppError::Conflict("The storefront has no pharmacist in charge".to_owned())
        })?;
    let items: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE pharmacy_orders SET status = 'cancelled', updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'ordered' RETURNING \
          COALESCE((SELECT array_agg(i.id) FROM pharmacy_order_items i \
            WHERE i.order_id = $1 AND i.tenant_id = $2 AND i.removed_at IS NULL), '{}')",
    )
    .bind(pharmacy_order)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("The pharmacy has already dispensed this order".to_owned())
    })?;
    // ponytail: one reversal per line through billing's shared path; an
    // order holds at most MAX_CART_LINES lines.
    for item in items {
        medbrains_server_services::billing::reverse_auto_charge_for_source(
            tx,
            &tenant_id,
            "pharmacy",
            item,
            actor,
            "Online order cancelled by the patient",
        )
        .await?;
    }
    sqlx::query(
        "UPDATE pharmacy_deliveries SET status = 'cancelled' \
          WHERE tenant_id = $1 AND order_id = $2 AND status = 'arranged' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(pharmacy_order)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ReturnLine {
    pub catalog_item_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct ReturnRequest {
    pub lines: Vec<ReturnLine>,
    /// `wrong_item`, `damaged`, `short_dated` or `excess`.
    pub reason: String,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReturnTicket {
    pub id: Uuid,
    pub complaint_code: Option<String>,
    pub status: String,
    pub ack_due_at: chrono::DateTime<chrono::Utc>,
    pub resolve_due_at: chrono::DateTime<chrono::Utc>,
}

/// What can still come back of one dispensed line.
#[derive(sqlx::FromRow)]
struct Dispensed {
    catalog_item_id: Uuid,
    drug_name: String,
    order_item_id: Uuid,
    batch_id: Option<Uuid>,
    left: i32,
    unit_price: Decimal,
}

/// When the patient had the medicines, and who they are.
#[derive(sqlx::FromRow)]
struct Received {
    pharmacy_order: Uuid,
    received_on: Option<chrono::NaiveDate>,
    today: chrono::NaiveDate,
    name: String,
    phone: Option<String>,
}

/// `POST /api/portal/store/orders/{id}/returns` — ask to return medicines
/// from a delivered or collected order, within the window.
pub async fn request_return(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    order_id: Uuid,
    body: &ReturnRequest,
) -> Result<ReturnTicket, AppError> {
    if !ONLINE_RETURN_REASONS.contains(&body.reason.as_str()) {
        return Err(AppError::BadRequest(
            "Returns are for a wrong, damaged, short-dated or excess medicine".to_owned(),
        ));
    }
    if body.lines.is_empty() || body.lines.len() > MAX_RETURN_LINES {
        return Err(AppError::BadRequest(
            "Choose what is coming back".to_owned(),
        ));
    }
    let settings = super::settings::load(tx, tenant_id).await?;
    let Received {
        pharmacy_order,
        received_on,
        today,
        name,
        phone,
    } = sqlx::query_as::<_, Received>(
        "SELECT s.pharmacy_order_id AS pharmacy_order, \
                COALESCE((SELECT tenant_local_date(d.tenant_id, d.delivered_at) \
                            FROM pharmacy_deliveries d WHERE d.tenant_id = s.tenant_id \
                             AND d.order_id = s.pharmacy_order_id AND d.status = 'delivered' \
                           ORDER BY d.delivered_at DESC LIMIT 1), \
                         tenant_local_date(o.tenant_id, o.dispensed_at)) AS received_on, \
                tenant_local_date(s.tenant_id, now()) AS today, \
                concat_ws(' ', p.first_name, p.last_name) AS name, p.phone \
           FROM pharmacy_store_orders s \
           JOIN pharmacy_orders o ON o.id = s.pharmacy_order_id AND o.tenant_id = s.tenant_id \
           JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
          WHERE s.id = $1 AND s.tenant_id = $2 AND s.patient_id = $3 AND s.status = 'released' \
            AND o.status::text IN ('dispensed', 'partially_dispensed', 'collected') \
          FOR UPDATE OF s",
    )
    .bind(order_id)
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let received_on = received_on.unwrap_or(today);
    if !within_window(received_on, today, settings.return_window_days) {
        return Err(AppError::Conflict(format!(
            "Returns close {} days after the medicines reach you",
            settings.return_window_days
        )));
    }
    let lines = returnable(tx, tenant_id, pharmacy_order, order_id).await?;
    let mut chosen: Vec<(&Dispensed, i32)> = Vec::with_capacity(body.lines.len());
    for want in &body.lines {
        let line = lines
            .iter()
            .find(|l| l.catalog_item_id == want.catalog_item_id)
            .ok_or_else(|| AppError::BadRequest("That medicine isn't on this order".to_owned()))?;
        if want.quantity < 1 || want.quantity > line.left {
            return Err(AppError::BadRequest(format!(
                "Up to {} of {} can come back",
                line.left, line.drug_name
            )));
        }
        chosen.push((line, want.quantity));
    }
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    let complaint = grievance(
        tx,
        tenant_id,
        patient_id,
        (name.as_str(), phone.as_deref()),
        note,
    )
    .await?;
    let ticket = sqlx::query_as::<_, ReturnTicket>(
        "WITH r AS ( \
           INSERT INTO pharmacy_store_returns \
             (tenant_id, store_order_id, patient_id, reason, note, complaint_id, ack_due_at, \
              resolve_due_at) \
           VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(hours => $7), \
                   now() + make_interval(days => $8)) \
           RETURNING id, status, ack_due_at, resolve_due_at, complaint_id) \
         SELECT r.id, c.complaint_code, r.status, r.ack_due_at, r.resolve_due_at \
           FROM r LEFT JOIN comm_complaints c ON c.id = r.complaint_id",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(patient_id)
    .bind(&body.reason)
    .bind(note)
    .bind(complaint)
    .bind(i32::try_from(GRIEVANCE_ACK_HOURS).unwrap_or(i32::MAX))
    .bind(i32::try_from(GRIEVANCE_RESOLVE_DAYS).unwrap_or(i32::MAX))
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(d) if d.is_unique_violation() => {
            AppError::Conflict("A return for this order is already with the pharmacy".to_owned())
        }
        other => AppError::from(other),
    })?;
    sqlx::query(
        "INSERT INTO pharmacy_store_return_lines \
           (tenant_id, return_id, catalog_item_id, drug_name, quantity, unit_price, \
            pharmacy_order_item_id, batch_id) \
         SELECT $1, $2, v.item, v.name, v.qty, v.price, v.order_item, v.batch \
           FROM unnest($3::uuid[], $4::text[], $5::int[], $6::numeric[], $7::uuid[], $8::uuid[]) \
                AS v(item, name, qty, price, order_item, batch)",
    )
    .bind(tenant_id)
    .bind(ticket.id)
    .bind(
        chosen
            .iter()
            .map(|(l, _)| l.catalog_item_id)
            .collect::<Vec<_>>(),
    )
    .bind(
        chosen
            .iter()
            .map(|(l, _)| l.drug_name.clone())
            .collect::<Vec<_>>(),
    )
    .bind(chosen.iter().map(|(_, q)| *q).collect::<Vec<_>>())
    .bind(chosen.iter().map(|(l, _)| l.unit_price).collect::<Vec<_>>())
    .bind(
        chosen
            .iter()
            .map(|(l, _)| l.order_item_id)
            .collect::<Vec<_>>(),
    )
    .bind(chosen.iter().map(|(l, _)| l.batch_id).collect::<Vec<_>>())
    .execute(&mut **tx)
    .await?;
    Ok(ticket)
}

/// What can still come back of each dispensed line, at the price paid.
async fn returnable(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    pharmacy_order: Uuid,
    store_order: Uuid,
) -> Result<Vec<Dispensed>, AppError> {
    Ok(sqlx::query_as::<_, Dispensed>(
        "SELECT i.catalog_item_id, i.drug_name, i.id AS order_item_id, i.batch_stock_id AS batch_id, \
                (COALESCE(i.quantity_dispensed, 0) - COALESCE((SELECT SUM(rl.quantity) \
                    FROM pharmacy_store_return_lines rl \
                    JOIN pharmacy_store_returns r ON r.id = rl.return_id \
                   WHERE rl.tenant_id = i.tenant_id AND rl.pharmacy_order_item_id = i.id \
                     AND r.status <> 'refused' AND rl.deleted_at IS NULL), 0))::int AS left, \
                COALESCE((SELECT l.unit_price FROM pharmacy_store_order_lines l \
                   WHERE l.tenant_id = i.tenant_id AND l.store_order_id = $3 \
                     AND COALESCE(l.substitute_item_id, l.catalog_item_id) = i.catalog_item_id \
                     AND l.deleted_at IS NULL LIMIT 1), i.unit_price) AS unit_price \
           FROM pharmacy_order_items i \
          WHERE i.tenant_id = $1 AND i.order_id = $2 AND i.catalog_item_id IS NOT NULL \
            AND i.removed_at IS NULL",
    )
    .bind(tenant_id)
    .bind(pharmacy_order)
    .bind(store_order)
    .fetch_all(&mut **tx)
    .await?)
}

/// The return as a grievance in the hospital's complaints register, with
/// its 30-day deadline.
async fn grievance(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    who: (&str, Option<&str>),
    note: Option<&str>,
) -> Result<Uuid, AppError> {
    let code = format!(
        "GRV-{}",
        Uuid::new_v4().simple().to_string()[..12].to_uppercase()
    );
    Ok(sqlx::query_scalar(
        "INSERT INTO comm_complaints \
           (tenant_id, complaint_code, source, patient_id, complainant_name, complainant_phone, \
            category, subject, description, severity, sla_hours, sla_deadline) \
         VALUES ($1, $2, 'portal', $3, $4, $5, 'pharmacy_return', 'Online medicine return', \
                 COALESCE($6, 'Return requested from the online pharmacy'), 'medium', $7, \
                 now() + make_interval(days => $8)) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(code)
    .bind(patient_id)
    .bind(who.0)
    .bind(who.1)
    .bind(note)
    .bind(i32::try_from(GRIEVANCE_RESOLVE_DAYS * 24).unwrap_or(i32::MAX))
    .bind(i32::try_from(GRIEVANCE_RESOLVE_DAYS).unwrap_or(i32::MAX))
    .fetch_one(&mut **tx)
    .await?)
}
