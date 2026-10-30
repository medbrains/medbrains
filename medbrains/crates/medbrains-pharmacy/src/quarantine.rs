//! Returned stock that may not go back on the shelf, from the counter or an
//! online order, held apart until it is destroyed on record
//! (`medbrains_core::pharmacy_returns` decides which; the legal basis is
//! `docs/compliance/pharmacy-returns.md`):
//!
//! * **Biomedical waste.** Bio-Medical Waste Management Rules 2016,
//!   Schedule I, Yellow category (d) "expired or discarded medicines", in a
//!   yellow bag, handed to an authorised Common Bio-medical Waste Treatment
//!   Facility; the occupier keeps the record and files the annual report
//!   (Rule 4 and Rule 13 `[verify]` numbering). The certificate names the
//!   facility and its manifest.
//! * **Controlled drugs.** NDPS Act 1985 and NDPS Rules 1985: received back
//!   into the register on return, then destroyed before a second person as
//!   witness with a register entry; any state procedure (prior intimation to
//!   the Drugs Controller) is the hospital's `[verify]`.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::pharmacy_returns::{BMW_BAG_COLOUR, BMW_CATEGORY};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Rows one screen lists, at most.
const LIST_LIMIT: i64 = 500;
/// Rows one certificate destroys, at most.
const DESTROY_LIMIT: usize = 200;

/// A pack going to quarantine.
pub(crate) struct Quarantine<'a> {
    pub source: &'a str,
    pub store_return_line_id: Option<Uuid>,
    pub pos_sale_item_id: Option<Uuid>,
    pub catalog_item_id: Uuid,
    pub drug_name: &'a str,
    pub batch_id: Option<Uuid>,
    pub quantity: i32,
    pub reasons: Vec<&'static str>,
    /// `bmw` or `ndps`.
    pub route: &'static str,
}

/// Put a pack in quarantine. A controlled drug is entered back into the
/// NDPS register as it comes in, so the register's balance holds it until
/// its witnessed destruction.
pub(crate) async fn put(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    by: Uuid,
    q: &Quarantine<'_>,
) -> Result<Uuid, AppError> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_return_quarantine \
           (tenant_id, source, store_return_line_id, pos_sale_item_id, catalog_item_id, \
            drug_name, batch_id, batch_number, expiry_date, quantity, reasons, route, \
            quarantined_by) \
         SELECT $1, $2, $3, $4, $5, $6, $7, b.batch_number, b.expiry_date, $8, $9, $10, $11 \
           FROM (SELECT 1) one \
           LEFT JOIN pharmacy_batches b ON b.id = $7 AND b.tenant_id = $1 \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(q.source)
    .bind(q.store_return_line_id)
    .bind(q.pos_sale_item_id)
    .bind(q.catalog_item_id)
    .bind(q.drug_name)
    .bind(q.batch_id)
    .bind(q.quantity)
    .bind(&q.reasons)
    .bind(q.route)
    .bind(by)
    .fetch_one(&mut **tx)
    .await?;
    if q.route == "ndps" {
        ndps_entry(
            tx,
            tenant_id,
            &NdpsEntry {
                item: q.catalog_item_id,
                action: "adjustment",
                quantity: q.quantity,
                by,
                witness: None,
                note: "Returned by the patient: quarantined, never re-issued",
            },
        )
        .await?;
    }
    Ok(id)
}

struct NdpsEntry<'a> {
    item: Uuid,
    action: &'a str,
    quantity: i32,
    by: Uuid,
    witness: Option<Uuid>,
    note: &'a str,
}

/// One NDPS register line, with the running balance.
async fn ndps_entry(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    e: &NdpsEntry<'_>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO pharmacy_ndps_register \
           (tenant_id, catalog_item_id, action, quantity, balance_after, dispensed_by, \
            witnessed_by, notes, requires_dual_sign) \
         SELECT $1, $2, $3::ndps_register_action, $4, \
                GREATEST(COALESCE((SELECT SUM(CASE WHEN action IN ('receipt', 'adjustment') \
                                                   THEN quantity ELSE -quantity END) \
                                     FROM pharmacy_ndps_register \
                                    WHERE tenant_id = $1 AND catalog_item_id = $2 \
                                      AND deleted_at IS NULL), 0) \
                         + CASE WHEN $3 IN ('receipt', 'adjustment') THEN $4::int ELSE -$4::int END, 0), \
                $5, $6, $7, true",
    )
    .bind(tenant_id)
    .bind(e.item)
    .bind(e.action)
    .bind(e.quantity)
    .bind(e.by)
    .bind(e.witness)
    .bind(e.note)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QuarantineRow {
    pub id: Uuid,
    pub source: String,
    pub drug_name: String,
    pub batch_number: Option<String>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub quantity: i32,
    pub reasons: Vec<String>,
    pub route: String,
    pub status: String,
    pub certificate_number: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/pharmacy/quarantine` — what waits for destruction, then the
/// most recently destroyed.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QuarantineRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::quarantine::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, QuarantineRow>(
        "SELECT q.id, q.source, q.drug_name, q.batch_number, q.expiry_date, q.quantity, \
                q.reasons, q.route, q.status, d.certificate_number, q.created_at \
           FROM pharmacy_return_quarantine q \
           LEFT JOIN pharmacy_destruction_log d ON d.id = q.destruction_id \
          WHERE q.tenant_id = $1 AND q.deleted_at IS NULL \
          ORDER BY q.status = 'quarantined' DESC, q.created_at DESC LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct DestroyRequest {
    pub ids: Vec<Uuid>,
    /// A second person who saw it destroyed; required for controlled drugs.
    pub witness_user_id: Option<Uuid>,
    pub witness_name: String,
    /// The CBMWTF it was handed to, and its manifest; required for BMW.
    pub cbmwtf_name: Option<String>,
    pub cbmwtf_manifest_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Destroyed {
    pub certificate_number: String,
    pub route: String,
    pub quantity: i64,
}

/// A quarantined pack about to be destroyed.
#[derive(sqlx::FromRow)]
struct Held {
    id: Uuid,
    catalog_item_id: Uuid,
    drug_name: String,
    quantity: i32,
    route: String,
    batch_number: Option<String>,
    expired: bool,
}

fn filled(v: Option<&str>) -> Option<&str> {
    v.map(str::trim).filter(|s| !s.is_empty())
}

/// `POST /api/pharmacy/quarantine/destroy` — destroy quarantined packs on one
/// certificate in the destruction register: through a CBMWTF (BMW), or for
/// controlled drugs before a second person with NDPS register entries.
pub async fn destroy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DestroyRequest>,
) -> Result<Json<Destroyed>, AppError> {
    require_permission(&claims, permissions::pharmacy::quarantine::MANAGE)?;
    if body.ids.is_empty() || body.ids.len() > DESTROY_LIMIT {
        return Err(AppError::BadRequest(format!(
            "Choose 1 to {DESTROY_LIMIT} packs to destroy"
        )));
    }
    let witness_name = filled(Some(&body.witness_name))
        .ok_or_else(|| AppError::BadRequest("Name the witness".to_owned()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Held>(
        "SELECT id, catalog_item_id, drug_name, quantity, route, batch_number, \
                'expired' = ANY(reasons) AS expired \
           FROM pharmacy_return_quarantine \
          WHERE tenant_id = $1 AND id = ANY($2) AND status = 'quarantined' AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(claims.tenant_id)
    .bind(&body.ids)
    .fetch_all(&mut *tx)
    .await?;
    if rows.len() != body.ids.len() {
        return Err(AppError::Conflict(
            "Some of those are no longer waiting for destruction".to_owned(),
        ));
    }
    let route = rows.first().map(|r| r.route.clone()).unwrap_or_default();
    if rows.iter().any(|r| r.route != route) {
        return Err(AppError::BadRequest(
            "Destroy controlled drugs and other medicines on separate certificates".to_owned(),
        ));
    }
    let ndps = route == "ndps";
    if ndps && body.witness_user_id.is_none_or(|w| w == claims.sub) {
        return Err(AppError::BadRequest(
            "A controlled drug is destroyed before a second person: choose the witness".to_owned(),
        ));
    }
    let (cbmwtf, manifest) = (
        filled(body.cbmwtf_name.as_deref()),
        filled(body.cbmwtf_manifest_number.as_deref()),
    );
    if !ndps && (cbmwtf.is_none() || manifest.is_none()) {
        return Err(AppError::BadRequest(
            "Name the biomedical waste facility and its manifest number".to_owned(),
        ));
    }
    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({"quarantine_id": r.id, "catalog_item_id": r.catalog_item_id,
                               "drug_name": r.drug_name, "quantity": r.quantity,
                               "batch_number": r.batch_number})
        })
        .collect();
    let total: i64 = rows.iter().map(|r| i64::from(r.quantity)).sum();
    let certificate = format!("DEST-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let destruction: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_destruction_log \
           (tenant_id, certificate_number, destruction_date, method, items, total_quantity, \
            total_value, reason, witnessed_by, witness_name, created_by, notes, route, \
            bmw_category, bmw_bag_colour, cbmwtf_name, cbmwtf_manifest_number) \
         VALUES ($1, $2, CURRENT_DATE, 'incineration', $3, $4, 0, $5, $6, $7, $8, $9, $10, \
                 $11, $12, $13, $14) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&certificate)
    .bind(serde_json::Value::Array(items))
    .bind(i32::try_from(total).unwrap_or(i32::MAX))
    .bind(if rows.iter().all(|r| r.expired) {
        "expired"
    } else {
        "other"
    })
    .bind(body.witness_user_id)
    .bind(witness_name)
    .bind(claims.sub)
    .bind(filled(body.notes.as_deref()))
    .bind(&route)
    .bind((!ndps).then_some(BMW_CATEGORY))
    .bind((!ndps).then_some(BMW_BAG_COLOUR))
    .bind(cbmwtf)
    .bind(manifest)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE pharmacy_return_quarantine SET status = 'destroyed', destruction_id = $3 \
          WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.ids)
    .bind(destruction)
    .execute(&mut *tx)
    .await?;
    if ndps {
        for r in &rows {
            let note = format!("Destroyed on certificate {certificate}");
            ndps_entry(
                &mut tx,
                claims.tenant_id,
                &NdpsEntry {
                    item: r.catalog_item_id,
                    action: "destroyed",
                    quantity: r.quantity,
                    by: claims.sub,
                    witness: body.witness_user_id,
                    note: &note,
                },
            )
            .await?;
        }
    }
    tx.commit().await?;
    Ok(Json(Destroyed {
        certificate_number: certificate,
        route,
        quantity: total,
    }))
}
