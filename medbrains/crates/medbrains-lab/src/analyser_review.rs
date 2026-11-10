//! The analyser review queue: results an analyser sent that could not be
//! matched to exactly one order, waiting for a technologist to attach them
//! to the right order or dismiss them with a reason.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::analyser::{Routed, route_analyser_results};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

const PAGE_SIZE: i64 = 50;
const MAX_CANDIDATES: i64 = 20;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct HeldAnalyserMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub device_name: String,
    pub protocol: String,
    pub reason: Option<String>,
    pub mapped_data: Option<serde_json::Value>,
    /// The message as the analyser sent it.
    pub raw: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PageParams {
    pub page: Option<i64>,
}

pub(crate) async fn list_held(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PageParams>,
) -> Result<Json<Vec<HeldAnalyserMessage>>, AppError> {
    require_permission(&claims, permissions::lab::results::ANALYSER_REVIEW)?;
    let offset = (params.page.unwrap_or(1).max(1) - 1) * PAGE_SIZE;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HeldAnalyserMessage>(
        "SELECT m.id, m.created_at, d.name AS device_name, m.protocol, \
                m.error_message AS reason, m.mapped_data, \
                COALESCE(m.parsed_payload->>'raw', m.parsed_payload->>'records') AS raw \
           FROM device_messages m JOIN device_instances d ON d.id = m.device_instance_id \
          WHERE m.tenant_id = $1 AND m.processing_status = 'needs_review' \
            AND m.deleted_at IS NULL \
          ORDER BY m.created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(PAGE_SIZE)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct CandidateOrder {
    pub order_id: Uuid,
    pub sample_barcode: Option<String>,
    pub test_name: String,
    pub status: String,
    pub uhid: String,
    pub patient_name: String,
    pub collected_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CandidateParams {
    /// Search a different barcode than the one the message carried.
    pub barcode: Option<String>,
}

/// Open orders the held message could belong to: those with its barcode
/// (or the one searched), and the open orders of the patient it names.
pub(crate) async fn list_candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(params): Query<CandidateParams>,
) -> Result<Json<Vec<CandidateOrder>>, AppError> {
    require_permission(&claims, permissions::lab::results::ANALYSER_REVIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mapped = held_mapped(&mut tx, claims.tenant_id, id, false).await?;
    let ids = &mapped["identifiers"];
    let searched = params
        .barcode
        .as_deref()
        .map(str::trim)
        .filter(|b| !b.is_empty());
    let barcode = searched.or_else(|| ids["sample_barcode"].as_str());
    let rows = sqlx::query_as::<_, CandidateOrder>(
        "SELECT lo.id AS order_id, lo.sample_barcode, t.name AS test_name, \
                lo.status::text AS status, p.uhid, \
                concat_ws(' ', p.first_name, p.last_name) AS patient_name, lo.collected_at \
           FROM lab_orders lo \
           JOIN patients p ON p.id = lo.patient_id \
           JOIN lab_test_catalog t ON t.id = lo.test_id \
          WHERE lo.tenant_id = $1 AND lo.deleted_at IS NULL \
            AND lo.status IN ('sample_collected', 'processing', 'completed') \
            AND (lo.sample_barcode = $2 OR lower(p.uhid) = lower($3)) \
          ORDER BY lo.collected_at DESC NULLS LAST LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(barcode)
    .bind(ids["patient_id"].as_str())
    .bind(MAX_CANDIDATES)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// The held message's mapped payload, locked when about to be resolved.
async fn held_mapped(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
    lock: bool,
) -> Result<serde_json::Value, AppError> {
    let sql = if lock {
        "SELECT mapped_data FROM device_messages WHERE id = $1 AND tenant_id = $2 \
           AND processing_status = 'needs_review' AND deleted_at IS NULL FOR UPDATE"
    } else {
        "SELECT mapped_data FROM device_messages WHERE id = $1 AND tenant_id = $2 \
           AND processing_status = 'needs_review' AND deleted_at IS NULL"
    };
    let mapped: Option<Option<serde_json::Value>> = sqlx::query_scalar(sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(mapped.ok_or(AppError::NotFound)?.unwrap_or_default())
}

#[derive(Debug, Deserialize)]
pub(crate) struct AttachRequest {
    pub order_id: Uuid,
}

/// Post the held results against the order the technologist chose. The same
/// checks run as for an automatic match except the barcode: a different
/// patient, a closed order or a conflicting value still refuse.
pub(crate) async fn attach(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AttachRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::results::ANALYSER_REVIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        body.order_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mapped = held_mapped(&mut tx, claims.tenant_id, id, true).await?;
    let routed = route_analyser_results(
        &mut tx,
        claims.tenant_id,
        claims.sub,
        &mapped,
        Some(body.order_id),
    )
    .await?;
    let posted = match routed {
        Routed::Held(reason) => {
            return Err(AppError::Conflict(format!(
                "These results cannot go on that order: {reason}."
            )));
        }
        Routed::Posted { posted, .. } => posted,
    };
    resolve(&mut tx, &claims, id, Resolution::Attached(body.order_id)).await?;
    tx.commit().await?;
    Ok(Json(
        serde_json::json!({ "status": "delivered", "order_id": body.order_id, "posted": posted }),
    ))
}

#[derive(Debug, Deserialize)]
pub(crate) struct DismissRequest {
    pub reason: String,
}

/// Close a held message without posting it -- a QC run, a sample rerun
/// under a new barcode -- with the reason on record.
pub(crate) async fn dismiss(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DismissRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::results::ANALYSER_REVIEW)?;
    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Say why these results are not being posted.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    held_mapped(&mut tx, claims.tenant_id, id, true).await?;
    resolve(&mut tx, &claims, id, Resolution::Dismissed(reason)).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "rejected" })))
}

enum Resolution<'a> {
    Attached(Uuid),
    Dismissed(&'a str),
}

async fn resolve(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Uuid,
    how: Resolution<'_>,
) -> Result<(), AppError> {
    let (status, order, note, action) = match how {
        Resolution::Attached(order) => (
            "delivered",
            Some(order),
            None,
            "lab.analyser_results_attached",
        ),
        Resolution::Dismissed(why) => (
            "rejected",
            None,
            Some(why),
            "lab.analyser_results_dismissed",
        ),
    };
    sqlx::query(
        "UPDATE device_messages SET processing_status = $2::device_message_status, \
                target_entity_id = COALESCE($3, target_entity_id), review_note = $4, \
                reviewed_by = $5, reviewed_at = now() \
          WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(order)
    .bind(note)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    let values = serde_json::json!({ "order_id": order, "reason": note });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "device_messages",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}
