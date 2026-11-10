//! The pharmacy's side of online returns: the queue with its grievance
//! deadlines, acknowledging within 48 hours, and receiving the packs —
//! where the law, not the pharmacist, decides restock or quarantine
//! (`pharmacy_returns::disposition`) — then the refund owed and the GST
//! credit note. A return that isn't ours to take is refused with a reason,
//! which resolves the grievance too.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy_returns::{Disposition, ReturnedPack, disposition};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    middleware::field_access::resolve_restricted_fields, state::AppState,
};
use medbrains_server_services::patient_identity::{PatientIdentity, patient_identities};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::refunds::{Owed, owe};

/// Returns one screen lists, at most.
const LIST_LIMIT: i64 = 100;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReturnLineRow {
    pub id: Uuid,
    #[serde(skip)]
    pub return_id: Uuid,
    pub drug_name: String,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub sealed: Option<bool>,
    /// `restocked` or `quarantined`, once received.
    pub disposition: Option<String>,
    pub reasons: Vec<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReturnRow {
    pub id: Uuid,
    pub store_order_id: Uuid,
    pub patient_id: Uuid,
    pub reason: String,
    pub note: Option<String>,
    pub status: String,
    pub complaint_code: Option<String>,
    pub ack_due_at: chrono::DateTime<chrono::Utc>,
    pub resolve_due_at: chrono::DateTime<chrono::Utc>,
    pub acknowledged_at: Option<chrono::DateTime<chrono::Utc>>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub resolution_note: Option<String>,
    pub credit_note_number: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[sqlx(skip)]
    pub lines: Vec<ReturnLineRow>,
}

#[derive(Debug, Serialize)]
pub struct ReturnQueue {
    pub returns: Vec<ReturnRow>,
    pub patients: Vec<PatientIdentity>,
}

/// `GET /api/pharmacy/storefront/returns` — open returns first, by their
/// acknowledgement deadline, then the latest resolved.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReturnQueue>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let restricted =
        resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut rows = sqlx::query_as::<_, ReturnRow>(
        "SELECT r.id, r.store_order_id, r.patient_id, r.reason, r.note, r.status, \
                c.complaint_code, r.ack_due_at, r.resolve_due_at, r.acknowledged_at, \
                r.resolved_at, r.resolution_note, r.credit_note_number, r.created_at \
           FROM pharmacy_store_returns r \
           LEFT JOIN comm_complaints c ON c.id = r.complaint_id AND c.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
          ORDER BY r.status IN ('requested', 'acknowledged') DESC, r.ack_due_at, \
                   r.resolved_at DESC LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
    let lines = sqlx::query_as::<_, ReturnLineRow>(
        "SELECT id, return_id, drug_name, quantity, unit_price, sealed, disposition, reasons \
           FROM pharmacy_store_return_lines \
          WHERE tenant_id = $1 AND return_id = ANY($2) AND deleted_at IS NULL ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;
    let mut by_return: std::collections::HashMap<Uuid, Vec<ReturnLineRow>> =
        std::collections::HashMap::new();
    for l in lines {
        by_return.entry(l.return_id).or_default().push(l);
    }
    for r in &mut rows {
        r.lines = by_return.remove(&r.id).unwrap_or_default();
    }
    let patient_ids: Vec<Uuid> = rows.iter().map(|r| r.patient_id).collect();
    let patients = patient_identities(&mut tx, claims.tenant_id, &patient_ids, &restricted).await?;
    tx.commit().await?;
    Ok(Json(ReturnQueue {
        returns: rows,
        patients,
    }))
}

/// `POST /api/pharmacy/storefront/returns/{id}/acknowledge`
pub async fn acknowledge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let complaint: Option<Uuid> = sqlx::query_scalar(
        "UPDATE pharmacy_store_returns \
            SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND status = 'requested' RETURNING complaint_id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    set_complaint(&mut tx, claims.tenant_id, complaint, "in_progress", None).await?;
    tx.commit().await?;
    Ok(Json(
        serde_json::json!({ "id": id, "status": "acknowledged" }),
    ))
}

async fn set_complaint(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    complaint: Option<Uuid>,
    status: &str,
    resolution: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE comm_complaints \
            SET status = $3::comm_complaint_status, resolution_notes = COALESCE($4, resolution_notes), \
                resolved_at = CASE WHEN $3 = 'resolved' THEN now() ELSE resolved_at END, \
                updated_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(complaint)
    .bind(tenant_id)
    .bind(status)
    .bind(resolution)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ReceivedLine {
    pub line_id: Uuid,
    /// The manufacturer's seal is unbroken.
    pub sealed: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReceiveRequest {
    pub lines: Vec<ReceivedLine>,
    pub note: Option<String>,
}

#[derive(sqlx::FromRow)]
struct LineFacts {
    id: Uuid,
    catalog_item_id: Uuid,
    drug_name: String,
    quantity: i32,
    unit_price: Decimal,
    batch_id: Option<Uuid>,
    expiry_date: Option<chrono::NaiveDate>,
    cold_chain: bool,
    controlled: bool,
    received_on: chrono::NaiveDate,
    asked_on: chrono::NaiveDate,
    store_order_id: Uuid,
    invoice_id: Option<Uuid>,
}

/// `POST /api/pharmacy/storefront/returns/{id}/receive` — the packs are in:
/// each restocked or quarantined by the law, the refund owed, the credit
/// note numbered, the grievance resolved.
pub async fn receive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReceiveRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let settings = super::settings::load(&mut tx, claims.tenant_id).await?;
    let lines = sqlx::query_as::<_, LineFacts>(
        "SELECT rl.id, rl.catalog_item_id, rl.drug_name, rl.quantity, rl.unit_price, rl.batch_id, \
                b.expiry_date, c.needs_cold_chain AS cold_chain, \
                (c.is_controlled OR COALESCE(c.drug_schedule IN ('X', 'NDPS'), false)) AS controlled, \
                COALESCE((SELECT tenant_local_date(d.tenant_id, d.delivered_at) \
                            FROM pharmacy_deliveries d WHERE d.tenant_id = s.tenant_id \
                             AND d.order_id = s.pharmacy_order_id AND d.status = 'delivered' \
                           ORDER BY d.delivered_at DESC LIMIT 1), \
                         tenant_local_date(o.tenant_id, o.dispensed_at), \
                         tenant_local_date(r.tenant_id, r.created_at)) AS received_on, \
                tenant_local_date(r.tenant_id, r.created_at) AS asked_on, r.store_order_id, \
                (SELECT ii.invoice_id FROM invoice_items ii WHERE ii.tenant_id = s.tenant_id \
                  AND ii.pharmacy_order_id = s.pharmacy_order_id LIMIT 1) AS invoice_id \
           FROM pharmacy_store_returns r \
           JOIN pharmacy_store_return_lines rl ON rl.return_id = r.id AND rl.tenant_id = r.tenant_id \
           JOIN pharmacy_store_orders s ON s.id = r.store_order_id AND s.tenant_id = r.tenant_id \
           JOIN pharmacy_orders o ON o.id = s.pharmacy_order_id AND o.tenant_id = s.tenant_id \
           JOIN pharmacy_catalog c ON c.id = rl.catalog_item_id AND c.tenant_id = rl.tenant_id \
           LEFT JOIN pharmacy_batches b ON b.id = rl.batch_id AND b.tenant_id = rl.tenant_id \
          WHERE r.id = $1 AND r.tenant_id = $2 AND r.status IN ('requested', 'acknowledged') \
            AND rl.deleted_at IS NULL \
          FOR UPDATE OF r",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let Some(first) = lines.first() else {
        return Err(AppError::NotFound);
    };
    let (store_order_id, invoice_id) = (first.store_order_id, first.invoice_id);
    let mut outcome = Vec::with_capacity(lines.len());
    for line in &lines {
        let sealed = body
            .lines
            .iter()
            .find(|l| l.line_id == line.id)
            .map(|l| l.sealed)
            .ok_or_else(|| {
                AppError::BadRequest("Say for every pack whether it is sealed".to_owned())
            })?;
        let pack = ReturnedPack {
            sealed,
            expiry: line.batch_id.and(line.expiry_date),
            cold_chain: line.cold_chain,
            controlled: line.controlled,
            sold_on: line.received_on,
            returned_on: line.asked_on,
            window_days: settings.return_window_days,
            shelf_life_floor_days: i64::from(settings.min_shelf_life_days),
        };
        let reasons = put_away(&mut tx, &claims, line, &disposition(&pack)).await?;
        outcome.push((line.id, sealed, reasons));
    }
    record_lines(&mut tx, claims.tenant_id, &outcome).await?;
    let amount: Decimal = lines
        .iter()
        .map(|l| l.unit_price * Decimal::from(l.quantity))
        .sum();
    let credit_note =
        crate::credit_notes::next_number(&mut tx, claims.tenant_id, invoice_id).await?;
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    let complaint: Option<Uuid> = sqlx::query_scalar(
        "UPDATE pharmacy_store_returns \
            SET status = 'received', resolved_at = now(), resolved_by = $3, \
                resolution_note = $4, credit_note_number = $5, \
                acknowledged_at = COALESCE(acknowledged_at, now()), \
                acknowledged_by = COALESCE(acknowledged_by, $3) \
          WHERE id = $1 AND tenant_id = $2 RETURNING complaint_id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(note)
    .bind(&credit_note)
    .fetch_one(&mut *tx)
    .await?;
    set_complaint(
        &mut tx,
        claims.tenant_id,
        complaint,
        "resolved",
        Some("Return received; refund owed"),
    )
    .await?;
    let refund = owe(
        &mut tx,
        claims.tenant_id,
        &Owed {
            store_order_id,
            store_return_id: Some(id),
            cause: "returned",
            amount,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "id": id, "status": "received", "credit_note_number": credit_note, "refund_id": refund,
    })))
}

/// Restock or quarantine one returned line; the reasons when quarantined.
async fn put_away(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    line: &LineFacts,
    decided: &Disposition,
) -> Result<Vec<&'static str>, AppError> {
    match decided {
        Disposition::Restock => {
            crate::credit_notes::restock(
                tx,
                claims,
                &crate::credit_notes::Restock {
                    catalog_item_id: line.catalog_item_id,
                    batch_id: line.batch_id,
                    quantity: line.quantity,
                    reference_id: line.id,
                    note: "Online order return: sealed and in date",
                },
            )
            .await?;
            Ok(Vec::new())
        }
        Disposition::Quarantine { reasons, route } => {
            let reasons: Vec<&'static str> = reasons.iter().map(|r| r.as_str()).collect();
            crate::quarantine::put(
                tx,
                claims.tenant_id,
                claims.sub,
                &crate::quarantine::Quarantine {
                    source: "online",
                    store_return_line_id: Some(line.id),
                    pos_sale_item_id: None,
                    catalog_item_id: line.catalog_item_id,
                    drug_name: &line.drug_name,
                    batch_id: line.batch_id,
                    quantity: line.quantity,
                    reasons: reasons.clone(),
                    route: route.as_str(),
                },
            )
            .await?;
            Ok(reasons)
        }
    }
}

/// Each line's seal, where it went and why, in one statement.
async fn record_lines(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    outcome: &[(Uuid, bool, Vec<&'static str>)],
) -> Result<(), AppError> {
    let ids: Vec<Uuid> = outcome.iter().map(|o| o.0).collect();
    let sealed: Vec<bool> = outcome.iter().map(|o| o.1).collect();
    let reasons: Vec<String> = outcome.iter().map(|o| o.2.join(",")).collect();
    sqlx::query(
        "UPDATE pharmacy_store_return_lines l \
            SET sealed = v.sealed, \
                disposition = CASE WHEN v.reasons = '' THEN 'restocked' ELSE 'quarantined' END, \
                reasons = CASE WHEN v.reasons = '' THEN '{}'::text[] \
                               ELSE string_to_array(v.reasons, ',') END \
           FROM unnest($2::uuid[], $3::bool[], $4::text[]) AS v(id, sealed, reasons) \
          WHERE l.id = v.id AND l.tenant_id = $1",
    )
    .bind(tenant_id)
    .bind(&ids)
    .bind(&sealed)
    .bind(&reasons)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct RefuseRequest {
    pub note: String,
}

/// `POST /api/pharmacy/storefront/returns/{id}/refuse` — not taken back,
/// with the reason the patient is told; the grievance is resolved with it.
pub async fn refuse(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RefuseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let note = body.note.trim();
    if note.is_empty() {
        return Err(AppError::BadRequest("Tell the patient why".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let complaint: Option<Uuid> = sqlx::query_scalar(
        "UPDATE pharmacy_store_returns \
            SET status = 'refused', resolved_at = now(), resolved_by = $3, resolution_note = $4 \
          WHERE id = $1 AND tenant_id = $2 AND status IN ('requested', 'acknowledged') \
         RETURNING complaint_id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(note)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    set_complaint(&mut tx, claims.tenant_id, complaint, "resolved", Some(note)).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id, "status": "refused" })))
}
