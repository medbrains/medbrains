//! The prescription printed for an outside pharmacy (owner decision 4b):
//! when a line can't be filled here, the patient may take it elsewhere. It is
//! their choice and it is recorded — on the order (the lines leave it) and
//! on the prescription. No pharmacy is ever named unless the hospital has
//! set a disclosed partner, and then only beside its disclosure: steering a
//! patient for benefit is cut practice (NMC Professional Conduct Regulations
//! 2002, 6.4 `[verify]`; `docs/plans/doctor-payouts.md`, referral rules).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::rules::Partner;

/// Said on every print, whatever else is on it.
pub const ANY_PHARMACY: &str =
    "You may buy these medicines at any licensed pharmacy of your choice.";

#[derive(Debug, Deserialize)]
pub struct OutsidePrintRequest {
    /// The lines to print, by the item ordered; every line still open when
    /// empty.
    #[serde(default)]
    pub catalog_item_ids: Vec<Uuid>,
}

/// What the print shows.
#[derive(Debug, Serialize)]
pub struct OutsidePrint {
    pub id: Uuid,
    pub hospital_name: String,
    pub patient_name: String,
    pub uhid: Option<String>,
    pub prescribed_on: Option<chrono::DateTime<chrono::Utc>>,
    pub doctor_name: Option<String>,
    pub doctor_registration: Option<String>,
    /// Name, generic name, strength, form, quantity and directions per line.
    pub items: Value,
    pub any_pharmacy: &'static str,
    /// Only when the hospital has a disclosed partner.
    pub partner: Option<Partner>,
    pub printed_at: chrono::DateTime<chrono::Utc>,
}

type Header = (
    String,
    String,
    Option<String>,
    Option<Uuid>,
    Option<chrono::DateTime<chrono::Utc>>,
    Option<String>,
    Option<String>,
);

/// Print the open lines of `order_id` for an outside pharmacy, and record
/// it. `patient` is set when the patient asks, from the portal; `staff` when
/// the pharmacist prints it at their request.
pub async fn print(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    who: (Option<Uuid>, Option<Uuid>),
    request: &OutsidePrintRequest,
) -> Result<OutsidePrint, AppError> {
    let (patient, staff) = who;
    let (hospital, patient_name, uhid, prescription, prescribed_on, doctor, registration): Header =
        sqlx::query_as(
            "SELECT t.name, concat_ws(' ', p.first_name, p.last_name), p.uhid, o.prescription_id, \
                    rx.created_at, u.full_name, NULLIF(u.registration_number, '') \
               FROM pharmacy_store_orders o \
               JOIN tenants t ON t.id = o.tenant_id \
               JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
               LEFT JOIN prescriptions rx ON rx.id = o.prescription_id AND rx.tenant_id = o.tenant_id \
               LEFT JOIN users u ON u.id = rx.doctor_id \
              WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL \
                AND o.status = 'awaiting_verification' AND ($3::uuid IS NULL OR o.patient_id = $3) \
              FOR UPDATE OF o",
        )
        .bind(order_id)
        .bind(tenant_id)
        .bind(patient)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let items: Value = sqlx::query_scalar(
        "WITH taken AS ( \
           UPDATE pharmacy_store_order_lines l SET status = 'outside_pharmacy', \
                  substitute_item_id = NULL, substitute_name = NULL \
            WHERE l.tenant_id = $1 AND l.store_order_id = $2 AND l.status = 'pending' \
              AND l.deleted_at IS NULL \
              AND (cardinality($3::uuid[]) = 0 OR l.catalog_item_id = ANY($3)) \
           RETURNING l.catalog_item_id, l.drug_name, l.quantity) \
         SELECT COALESCE(jsonb_agg(jsonb_build_object( \
                  'name', t.drug_name, 'generic_name', COALESCE(c.inn_name, c.generic_name), \
                  'strength', c.strength, 'form', c.dosage_form, 'quantity', t.quantity, \
                  'directions', (SELECT concat_ws(' · ', NULLIF(i.dosage, ''), \
                                   NULLIF(i.frequency, ''), NULLIF(i.duration, '')) \
                                   FROM prescription_items i \
                                  WHERE i.tenant_id = $1 AND i.prescription_id = $4 \
                                    AND (i.catalog_item_id = c.id \
                                         OR lower(i.drug_name) = lower(t.drug_name)) LIMIT 1)) \
                ORDER BY t.drug_name), '[]'::jsonb) \
           FROM taken t JOIN pharmacy_catalog c ON c.id = t.catalog_item_id AND c.tenant_id = $1",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(&request.catalog_item_ids)
    .bind(prescription)
    .fetch_one(&mut **tx)
    .await?;
    if items.as_array().is_none_or(Vec::is_empty) {
        return Err(AppError::Conflict(
            "Only lines still waiting can be printed for an outside pharmacy".to_owned(),
        ));
    }
    let partner = super::rules::load(tx, tenant_id).await?.outside_partner;
    let partner_json = partner
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| AppError::Internal(format!("print not recorded: {e}")))?;
    let (id, printed_at): (Uuid, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        "INSERT INTO prescription_outside_prints \
           (tenant_id, prescription_id, store_order_id, items, requested_by_patient, printed_by, \
            partner) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at",
    )
    .bind(tenant_id)
    .bind(prescription)
    .bind(order_id)
    .bind(&items)
    .bind(patient.is_some())
    .bind(staff)
    .bind(partner_json)
    .fetch_one(&mut **tx)
    .await?;
    close_if_done(tx, tenant_id, order_id).await?;
    Ok(OutsidePrint {
        id,
        hospital_name: hospital,
        patient_name,
        uhid,
        prescribed_on,
        doctor_name: doctor,
        doctor_registration: registration,
        items,
        any_pharmacy: ANY_PHARMACY,
        partner,
        printed_at,
    })
}

/// An order with nothing left to send is closed, its holds let go; one with
/// approved lines still goes on through verification.
async fn close_if_done(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let closed = sqlx::query(
        "UPDATE pharmacy_store_orders o SET status = 'closed', \
                decision_note = COALESCE(decision_note, 'Printed for an outside pharmacy') \
          WHERE o.id = $1 AND o.tenant_id = $2 AND NOT EXISTS ( \
                SELECT 1 FROM pharmacy_store_order_lines l WHERE l.store_order_id = o.id \
                   AND l.status IN ('pending', 'approved') AND l.deleted_at IS NULL)",
    )
    .bind(order_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    if closed.rows_affected() > 0 {
        super::holds::release(tx, tenant_id, order_id, "cancelled").await?;
    }
    Ok(())
}

/// `POST /api/pharmacy/storefront/orders/{id}/outside-print` — printed by the
/// pharmacist at the patient's request.
pub async fn staff_print(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<OutsidePrintRequest>,
) -> Result<Json<OutsidePrint>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::VERIFY)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let printed = print(
        &mut tx,
        claims.tenant_id,
        id,
        (None, Some(claims.sub)),
        &body,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(printed))
}
