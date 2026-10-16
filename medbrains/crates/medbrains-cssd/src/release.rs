//! Pack release and load recall.
//!
//! A sterile pack may leave CSSD only when its load finished its cycle, every
//! indicator read on that load passed (and at least one was read), the load
//! has not been recalled, and the pack is inside its expiry date. Anything else
//! is a non-sterile instrument on its way to an open wound.
//!
//! When a biological indicator fails after packs have gone out (a BI is read
//! hours after the cycle), the whole load is recalled: every pack from it is
//! barred from issue, and every issuance already made is flagged so the packs
//! can be fetched back from the departments that hold them.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::cssd::{CssdLoadItem, CssdSterilizationLoad};
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Why a pack may not be issued, `NULL` when it may. Aliases: `li` is the
/// `cssd_load_items` row, `l` its `cssd_sterilization_loads` row. The first
/// matching rule wins, so the message names the most serious problem.
const PACK_BLOCK_REASON_SQL: &str = "CASE \
    WHEN l.recalled_at IS NOT NULL THEN 'Load ' || l.load_number || ' was recalled' \
        || COALESCE(' (' || l.recall_reason || ')', '') \
        || '. Do not issue this pack; send it back for reprocessing.' \
    WHEN l.status = 'failed' THEN 'Load ' || l.load_number \
        || ' failed its sterilisation cycle. Reprocess this pack.' \
    WHEN EXISTS (SELECT 1 FROM cssd_indicator_results ir \
                 WHERE ir.load_id = l.id AND ir.deleted_at IS NULL AND NOT ir.result_pass) \
        THEN 'Load ' || l.load_number || ' has a failed sterilisation indicator. \
Quarantine this pack and recall the load.' \
    WHEN l.status <> 'completed' THEN 'Load ' || l.load_number \
        || ' has not finished its cycle (' || l.status::text || '). Wait for it to complete.' \
    WHEN NOT EXISTS (SELECT 1 FROM cssd_indicator_results ir \
                     WHERE ir.load_id = l.id AND ir.deleted_at IS NULL AND ir.result_pass) \
        THEN 'Load ' || l.load_number || ' is not released: no indicator result is recorded. \
Read and record the indicator first.' \
    WHEN li.pack_expiry_date IS NULL THEN 'This pack has no expiry date recorded. \
Relabel and reprocess it before issue.' \
    WHEN li.pack_expiry_date < CURRENT_DATE THEN 'This pack expired on ' \
        || to_char(li.pack_expiry_date, 'DD Mon YYYY') || '. Reprocess it before use.' \
    WHEN (SELECT COUNT(*) FROM cssd_issuances i \
          WHERE i.load_item_id = li.id AND i.deleted_at IS NULL) >= li.quantity \
        THEN 'All ' || li.quantity || ' pack(s) on this line have already been issued.' \
    END";

/// A load item with the reason it may not be issued (`None` = issuable).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CssdPack {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub item: CssdLoadItem,
    pub block_reason: Option<String>,
}

/// Where one pack from a load went.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CssdLoadIssuance {
    pub issuance_id: Uuid,
    pub load_item_id: Uuid,
    pub set_name: Option<String>,
    pub issued_to_department: String,
    pub issued_to_patient_id: Option<Uuid>,
    pub issued_at: DateTime<Utc>,
    pub returned_at: Option<DateTime<Utc>>,
    pub is_recalled: bool,
}

#[derive(Debug, Deserialize)]
pub struct RecallLoadRequest {
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct CssdLoadRecallResponse {
    pub load: CssdSterilizationLoad,
    pub issuances: Vec<CssdLoadIssuance>,
}

/// The packs of one load, each with its block reason.
pub(crate) async fn list_packs(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    load_id: Uuid,
) -> Result<Vec<CssdPack>, AppError> {
    let sql = format!(
        "SELECT li.id, li.tenant_id, li.load_id, li.set_id, li.instrument_id, \
                li.quantity, li.pack_expiry_date, {PACK_BLOCK_REASON_SQL} AS block_reason \
         FROM cssd_load_items li \
         JOIN cssd_sterilization_loads l ON l.id = li.load_id \
         WHERE li.load_id = $1 AND li.tenant_id = $2 AND li.deleted_at IS NULL \
         ORDER BY li.pack_expiry_date NULLS LAST, li.id \
         LIMIT 2000"
    );
    Ok(sqlx::query_as::<_, CssdPack>(&sql)
        .bind(load_id)
        .bind(tenant_id)
        .fetch_all(&mut **tx)
        .await?)
}

/// The block reason for one pack, locking its row so two clerks cannot both
/// issue the last pack on a line. `Err(NotFound)` when the pack does not exist.
pub(crate) async fn pack_block_reason(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    load_item_id: Uuid,
) -> Result<Option<String>, AppError> {
    let sql = format!(
        "SELECT {PACK_BLOCK_REASON_SQL} \
         FROM cssd_load_items li \
         JOIN cssd_sterilization_loads l ON l.id = li.load_id \
         WHERE li.id = $1 AND li.tenant_id = $2 \
           AND li.deleted_at IS NULL AND l.deleted_at IS NULL \
         FOR UPDATE OF li"
    );
    sqlx::query_scalar::<_, Option<String>>(&sql)
        .bind(load_item_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

async fn load_issuances(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    load_id: Uuid,
) -> Result<Vec<CssdLoadIssuance>, AppError> {
    Ok(sqlx::query_as::<_, CssdLoadIssuance>(
        "SELECT i.id AS issuance_id, li.id AS load_item_id, s.set_name, \
                i.issued_to_department, i.issued_to_patient_id, i.issued_at, \
                i.returned_at, i.is_recalled \
         FROM cssd_issuances i \
         JOIN cssd_load_items li ON li.id = i.load_item_id \
         LEFT JOIN cssd_instrument_sets s ON s.id = li.set_id \
         WHERE li.load_id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL \
         ORDER BY i.issued_at DESC \
         LIMIT 2000",
    )
    .bind(load_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// GET /api/cssd/loads/{id}/issuances — where the packs of a load went.
pub async fn list_load_issuances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(load_id): Path<Uuid>,
) -> Result<Json<Vec<CssdLoadIssuance>>, AppError> {
    require_permission(&claims, permissions::cssd::issuance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = load_issuances(&mut tx, claims.tenant_id, load_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cssd/loads/{id}/recall — recall a whole load.
///
/// Bars every pack of the load from issue, flags every issuance already made
/// from it, and answers with where those packs went so they can be fetched.
pub async fn recall_load(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(load_id): Path<Uuid>,
    Json(body): Json<RecallLoadRequest>,
) -> Result<Json<CssdLoadRecallResponse>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::RECALL)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Give the reason for the recall, e.g. \"biological indicator failed\".".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let load = sqlx::query_as::<_, CssdSterilizationLoad>(
        "UPDATE cssd_sterilization_loads \
         SET recalled_at = now(), recalled_by = $3, recall_reason = $4 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND recalled_at IS NULL \
         RETURNING *",
    )
    .bind(load_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(reason)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(load) = load else {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM cssd_sterilization_loads \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
        )
        .bind(load_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        return Err(if exists {
            AppError::Conflict("This load has already been recalled.".to_owned())
        } else {
            AppError::NotFound
        });
    };

    let flagged: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE cssd_issuances i SET is_recalled = TRUE, recall_reason = $3 \
         FROM cssd_load_items li \
         WHERE i.load_item_id = li.id AND li.load_id = $1 AND i.tenant_id = $2 \
           AND i.deleted_at IS NULL AND NOT i.is_recalled \
         RETURNING i.id",
    )
    .bind(load_id)
    .bind(claims.tenant_id)
    .bind(format!("Load {} recalled: {reason}", load.load_number))
    .fetch_all(&mut *tx)
    .await?;

    let values = serde_json::json!({
        "load_number": load.load_number,
        "reason": reason,
        "issuances_flagged": flagged,
    });
    audit(
        &mut tx,
        &claims,
        ("cssd.load.recall", "cssd_sterilization_load"),
        load_id,
        &values,
    )
    .await?;

    let issuances = load_issuances(&mut tx, claims.tenant_id, load_id).await?;
    tx.commit().await?;
    Ok(Json(CssdLoadRecallResponse { load, issuances }))
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    (action, entity_type): (&str, &str),
    entity_id: Uuid,
    values: &serde_json::Value,
) -> Result<(), AppError> {
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type,
            entity_id: Some(entity_id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// Record a refused issue in the audit trail. The caller commits.
pub(crate) async fn audit_blocked_issue(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    load_item_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    let values = serde_json::json!({ "load_item_id": load_item_id, "reason": reason });
    audit(
        tx,
        claims,
        ("cssd.issue.blocked", "cssd_load_item"),
        load_item_id,
        &values,
    )
    .await
}

/// Record the recall of one issued pack. The caller commits.
pub(crate) async fn audit_issuance_recall(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    issuance_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    let values = serde_json::json!({ "reason": reason });
    audit(
        tx,
        claims,
        ("cssd.issuance.recall", "cssd_issuance"),
        issuance_id,
        &values,
    )
    .await
}
