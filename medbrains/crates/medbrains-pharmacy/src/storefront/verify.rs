//! The pharmacist's queue of online orders with prescription lines: the
//! hospital prescription or the uploaded file beside the lines, then a
//! verdict per line — approve, approve fewer, or refuse with a reason.
//! Whatever is approved is released to fulfilment; who decided each line
//! and when is kept on it, and the tables carry the audit trigger.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::header,
    response::{IntoResponse, Response},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy_storefront::{LineVerdict, h1_record_problem, line_verdict_problem};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    middleware::field_access::resolve_restricted_fields, state::AppState,
};
use medbrains_server_services::patient_identity::{PatientIdentity, patient_identities};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::orders::{StoreOrderView, with_lines};

/// Orders one page of the queue shows.
const QUEUE_LIMIT: i64 = 100;

#[derive(Debug, Deserialize)]
pub struct QueueQuery {
    /// `awaiting_verification` (default), `released` or `rejected`.
    pub status: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QueueRow {
    pub patient_id: Uuid,
    pub has_prescription: bool,
    /// The same uploaded file is on another patient's order.
    pub prescription_reused: bool,
    /// The hospital prescription chosen, when not an upload.
    pub prescription_id: Option<Uuid>,
    /// Patient's address on record, prefilled for Schedule H1.
    pub record_address: Option<String>,
    pub prescriber_name: Option<String>,
    pub prescriber_registration: Option<String>,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub order: StoreOrderView,
}

#[derive(Debug, Serialize)]
pub struct Queue {
    pub orders: Vec<QueueRow>,
    pub patients: Vec<PatientIdentity>,
}

/// `GET /api/pharmacy/storefront/orders`
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<QueueQuery>,
) -> Result<Json<Queue>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::VERIFY)?;
    let status = q.status.as_deref().unwrap_or("awaiting_verification");
    if !["awaiting_verification", "released", "rejected"].contains(&status) {
        return Err(AppError::BadRequest("Unknown status".to_owned()));
    }
    let restricted =
        resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut rows = sqlx::query_as::<_, QueueRow>(
        "SELECT s.patient_id, s.rx_document_key IS NOT NULL AS has_prescription, \
                EXISTS (SELECT 1 FROM pharmacy_store_orders o2 \
                         WHERE o2.tenant_id = s.tenant_id AND o2.patient_id <> s.patient_id \
                           AND o2.rx_document_sha256 = s.rx_document_sha256 \
                           AND o2.deleted_at IS NULL) AS prescription_reused, \
                s.prescription_id, \
                COALESCE(s.patient_address, \
                         NULLIF(concat_ws(', ', NULLIF(p.address->>'line1', ''), \
                                NULLIF(p.address->>'city', ''), \
                                NULLIF(p.address->>'postal_code', '')), '')) AS record_address, \
                s.prescriber_name, s.prescriber_registration, s.verified_at, \
                s.id, s.status, s.rx_source, s.fulfilment, s.delivery_payment, s.placed_at, \
                s.decision_note, o.status AS pharmacy_stage \
           FROM pharmacy_store_orders s \
           JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
           LEFT JOIN pharmacy_orders o ON o.id = s.pharmacy_order_id \
          WHERE s.tenant_id = $1 AND s.status = $2 AND s.deleted_at IS NULL \
            AND ($2 <> 'released' OR s.verified_at IS NOT NULL) \
          ORDER BY s.placed_at LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(status)
    .bind(QUEUE_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let views = with_lines(
        &mut tx,
        claims.tenant_id,
        rows.iter_mut()
            .map(|r| std::mem::take(&mut r.order))
            .collect(),
    )
    .await?;
    for (row, view) in rows.iter_mut().zip(views) {
        row.order = view;
    }
    let ids: Vec<Uuid> = rows.iter().map(|r| r.patient_id).collect();
    let patients = patient_identities(&mut tx, claims.tenant_id, &ids, &restricted).await?;
    tx.commit().await?;
    Ok(Json(Queue {
        orders: rows,
        patients,
    }))
}

/// `GET /api/pharmacy/storefront/orders/{id}/prescription` — the uploaded
/// file, for the pharmacist to read. Never cached.
pub async fn prescription_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::VERIFY)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (key, content_type): (String, Option<String>) = sqlx::query_as(
        "SELECT rx_document_key, rx_document_type FROM pharmacy_store_orders \
          WHERE id = $1 AND tenant_id = $2 AND status <> 'cart' \
            AND rx_document_key IS NOT NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let bytes = state
        .documents_store
        .get(&key)
        .await
        .map_err(|e| AppError::Internal(format!("prescription unavailable: {e}")))?;
    Ok((
        [
            (
                header::CONTENT_TYPE,
                content_type.unwrap_or_else(|| "application/octet-stream".to_owned()),
            ),
            (header::CACHE_CONTROL, "no-store".to_owned()),
        ],
        bytes,
    )
        .into_response())
}

/// The pharmacist's verdict on one prescription line.
#[derive(Debug, Deserialize)]
pub struct LineDecision {
    pub catalog_item_id: Uuid,
    pub approve: bool,
    /// Fewer units than asked, when approving; all of them when absent.
    pub quantity: Option<i32>,
    /// One of `REJECT_REASONS`, when refusing.
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    /// A verdict for every prescription line waiting.
    pub lines: Vec<LineDecision>,
    /// For the patient, when anything is refused or reduced.
    pub note: Option<String>,
    /// Schedule H1: from the prescription, and the patient's address.
    pub prescriber_name: Option<String>,
    pub prescriber_registration: Option<String>,
    pub patient_address: Option<String>,
}

#[derive(sqlx::FromRow)]
struct Pending {
    catalog_item_id: Uuid,
    quantity: i32,
    h1: bool,
}

/// `POST /api/pharmacy/storefront/orders/{id}/verify` — a verdict per line.
/// Whatever is approved goes to fulfilment; nothing approved rejects the
/// order. Who decided each line, and when, is kept on it.
pub async fn decide(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VerifyRequest>,
) -> Result<Json<StoreOrderView>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::VERIFY)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM pharmacy_store_orders \
          WHERE id = $1 AND tenant_id = $2 AND status = 'awaiting_verification' \
            AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let pending = sqlx::query_as::<_, Pending>(
        "SELECT l.catalog_item_id, l.quantity, COALESCE(c.drug_schedule = 'H1', false) AS h1 \
           FROM pharmacy_store_order_lines l \
           JOIN pharmacy_catalog c ON c.id = l.catalog_item_id AND c.tenant_id = l.tenant_id \
          WHERE l.tenant_id = $1 AND l.store_order_id = $2 AND l.status = 'pending' \
            AND l.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let verdicts = verdicts(&pending, &body)?;
    let approved_h1 = pending
        .iter()
        .zip(&verdicts)
        .any(|(p, v)| p.h1 && matches!(v, LineVerdict::Approve { .. }));
    if approved_h1 {
        h1_record_problem(
            body.prescriber_name.as_deref(),
            body.prescriber_registration.as_deref(),
            body.patient_address.as_deref(),
        )
        .map_err(AppError::BadRequest)?;
    }
    let left = record_verdicts(&mut tx, &claims, id, &pending, &verdicts).await?;
    record_order(&mut tx, &claims, id, &body, left == 0).await?;
    let order_id = if left == 0 {
        None
    } else {
        Some(super::release::release(&mut tx, claims.tenant_id, id, Some(claims.sub)).await?)
    };
    let view = super::orders::patient_order(&mut tx, claims.tenant_id, patient_id, id).await?;
    tx.commit().await?;
    if let Some(order_id) = order_id {
        crate::hand_order_to_pharmacy(&state, &claims, order_id).await?;
    }
    Ok(Json(view))
}

/// One verdict per waiting line, each complete.
fn verdicts(pending: &[Pending], body: &VerifyRequest) -> Result<Vec<LineVerdict>, AppError> {
    pending
        .iter()
        .map(|p| {
            let d = body
                .lines
                .iter()
                .find(|d| d.catalog_item_id == p.catalog_item_id)
                .ok_or_else(|| AppError::BadRequest("Decide every line".to_owned()))?;
            let verdict = if d.approve {
                LineVerdict::Approve {
                    quantity: d.quantity.unwrap_or(p.quantity),
                }
            } else {
                LineVerdict::Reject {
                    reason: d.reason.clone().unwrap_or_default(),
                }
            };
            line_verdict_problem(&verdict, p.quantity).map_err(AppError::BadRequest)?;
            Ok(verdict)
        })
        .collect()
}

/// Mark each line approved (perhaps reduced) or refused, with who and when.
/// Returns the lines the order still has.
async fn record_verdicts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
    pending: &[Pending],
    verdicts: &[LineVerdict],
) -> Result<i64, AppError> {
    let items: Vec<Uuid> = pending.iter().map(|p| p.catalog_item_id).collect();
    let quantities: Vec<Option<i32>> = verdicts
        .iter()
        .map(|v| match v {
            LineVerdict::Approve { quantity } => Some(*quantity),
            LineVerdict::Reject { .. } => None,
        })
        .collect();
    let reasons: Vec<Option<String>> = verdicts
        .iter()
        .map(|v| match v {
            LineVerdict::Reject { reason } => Some(reason.clone()),
            LineVerdict::Approve { .. } => None,
        })
        .collect();
    sqlx::query(
        "UPDATE pharmacy_store_order_lines l \
            SET status = CASE WHEN v.qty IS NULL THEN 'rejected' ELSE 'approved' END, \
                approved_quantity = v.qty, reject_reason = v.reason, \
                decided_by = $3, decided_at = now() \
           FROM unnest($4::uuid[], $5::int[], $6::text[]) AS v(item, qty, reason) \
          WHERE l.tenant_id = $1 AND l.store_order_id = $2 AND l.catalog_item_id = v.item \
            AND l.status = 'pending' AND l.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(&items)
    .bind(&quantities)
    .bind(&reasons)
    .execute(&mut **tx)
    .await?;
    Ok(sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_store_order_lines \
          WHERE store_order_id = $1 AND status = 'approved' AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await?)
}

/// The order's verdict: who verified it, when, the note for the patient and
/// the H1 record; rejected when nothing is left to send.
async fn record_order(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
    body: &VerifyRequest,
    rejected: bool,
) -> Result<(), AppError> {
    let text = |v: Option<&str>| {
        v.map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    };
    sqlx::query(
        "UPDATE pharmacy_store_orders \
            SET verified_by = $3, verified_at = now(), decision_note = $4, \
                prescriber_name = $5, prescriber_registration = $6, patient_address = $7, \
                status = CASE WHEN $8 THEN 'rejected' ELSE status END \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(text(body.note.as_deref()))
    .bind(text(body.prescriber_name.as_deref()))
    .bind(text(body.prescriber_registration.as_deref()))
    .bind(text(body.patient_address.as_deref()))
    .bind(rejected)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
