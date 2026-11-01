//! The service layer for change sets.
//!
//! Every operation checks its own permission, so HTTP is not the only guard
//! (RFC-AUTHZ rule 4). Each opens one transaction with the tenant context set
//! and picks the adapter for the set's area.

use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::adapter::{Adapter, Tx};
use crate::critical_values::CriticalValues;
use crate::flow_switches::FlowSwitches;
use crate::flows::{self, Applied};
use crate::interactions::DrugInteractions;
use crate::model::{
    Area, KnowledgeChangeSet, KnowledgeChangeSetDetail, KnowledgeLiveRow, NewKnowledgeChangeSet, Op,
};
use crate::offices::{approve_as_office, offices};
use crate::store::{self, NewSet};

/// Run `$f::<Adapter>(args)` for the adapter that owns `$area`.
macro_rules! by_area {
    ($area:expr, $($f:ident)::+, $($arg:expr),*) => {
        match $area {
            Area::DrugInteractions => $($f)::+::<DrugInteractions>($($arg),*).await,
            Area::CriticalValueRules => $($f)::+::<CriticalValues>($($arg),*).await,
            Area::FlowSwitches => $($f)::+::<FlowSwitches>($($arg),*).await,
        }
    };
}

/// The area's manage permissions, for the area-level check.
const fn manage(area: Area) -> &'static [&'static str] {
    match area {
        Area::DrugInteractions => DrugInteractions::MANAGE,
        Area::CriticalValueRules => CriticalValues::MANAGE,
        Area::FlowSwitches => FlowSwitches::MANAGE,
    }
}

const fn kind(area: Area) -> &'static str {
    match area {
        Area::DrugInteractions => DrugInteractions::KIND,
        Area::CriticalValueRules => CriticalValues::KIND,
        Area::FlowSwitches => FlowSwitches::KIND,
    }
}

pub(crate) fn area_of(set: &KnowledgeChangeSet) -> Result<Area, AppError> {
    Area::parse(&set.area).ok_or_else(|| AppError::Internal(format!("unknown area {}", set.area)))
}

pub(crate) async fn begin<'a>(pool: &'a PgPool, claims: &Claims) -> Result<Tx<'a>, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// Draft and preview need `create` plus the area's manage permission; a
/// rollback set may also be previewed by whoever may start rollbacks.
fn require_drafting(claims: &Claims, area: Area, is_rollback: bool) -> Result<(), AppError> {
    if is_rollback
        && require_permission(claims, permissions::knowledge::change_sets::ROLLBACK).is_ok()
    {
        return Ok(());
    }
    require_permission(claims, permissions::knowledge::change_sets::CREATE)?;
    require_any_permission(claims, manage(area))
}

/// # Errors
/// Forbidden without `list`.
pub async fn list(
    pool: &PgPool,
    claims: &Claims,
    area: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<KnowledgeChangeSet>, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::LIST)?;
    let mut tx = begin(pool, claims).await?;
    let sets = store::list_sets(&mut tx, claims.tenant_id, area, status).await?;
    tx.commit().await?;
    Ok(sets)
}

/// # Errors
/// Forbidden without `list`; not found.
pub async fn get(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::LIST)?;
    let mut tx = begin(pool, claims).await?;
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

async fn live_rows<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant: Uuid,
) -> Result<Vec<KnowledgeLiveRow>, AppError> {
    A::list(tx, tenant)
        .await?
        .into_iter()
        .map(|(id, row)| {
            let fields =
                serde_json::to_value(row).map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(KnowledgeLiveRow { id, fields })
        })
        .collect()
}

/// The area's live rows, for the editor.
///
/// # Errors
/// Forbidden without `create` and the area's manage permission.
pub async fn live(
    pool: &PgPool,
    claims: &Claims,
    area: Area,
) -> Result<Vec<KnowledgeLiveRow>, AppError> {
    require_drafting(claims, area, false)?;
    let mut tx = begin(pool, claims).await?;
    let rows = by_area!(area, live_rows, &mut tx, claims.tenant_id)?;
    tx.commit().await?;
    Ok(rows)
}

/// # Errors
/// Forbidden, or a bad item.
pub async fn create(
    pool: &PgPool,
    claims: &Claims,
    body: &NewKnowledgeChangeSet,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    require_drafting(claims, body.area, false)?;
    if body.area == Area::FlowSwitches && body.items.iter().any(|i| i.op != Op::Update) {
        return Err(AppError::BadRequest(
            "Switch settings are changed, never added or removed".to_owned(),
        ));
    }
    if body.title.trim().is_empty() || body.reason.trim().is_empty() {
        return Err(AppError::BadRequest(
            "A title and a reason are required".to_owned(),
        ));
    }
    let mut tx = begin(pool, claims).await?;
    let items = by_area!(
        body.area,
        flows::check_new,
        &mut tx,
        claims.tenant_id,
        &body.items
    )?;
    let id = store::insert_set(
        &mut tx,
        &NewSet {
            tenant: claims.tenant_id,
            author: claims.sub,
            area: body.area.as_str(),
            kind: kind(body.area),
            title: &body.title,
            reason: &body.reason,
            rollback_of: None,
            items,
        },
    )
    .await?;
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

/// # Errors
/// Forbidden; conflict unless the set is a draft, previewed or stale.
pub async fn preview(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    let mut tx = begin(pool, claims).await?;
    let set = store::load_set(&mut tx, claims.tenant_id, id, true).await?;
    let area = area_of(&set)?;
    require_drafting(claims, area, set.rollback_of_set_id.is_some())?;
    if !matches!(set.status.as_str(), "draft" | "previewed" | "stale") {
        return Err(AppError::Conflict(format!(
            "A {} change cannot be previewed again",
            set.status
        )));
    }
    by_area!(area, flows::preview, &mut tx, claims.tenant_id, &set)?;
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

async fn audit_decision(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Uuid,
    action: &str,
    note: Option<&str>,
) -> Result<(), AppError> {
    let values = json!({ "note": note });
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "knowledge_change_set",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// # Errors
/// Forbidden without `approve` or for the set's own author; conflict unless
/// previewed.
pub async fn approve(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
    note: Option<&str>,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::APPROVE)?;
    let mut tx = begin(pool, claims).await?;
    let set = store::load_set(&mut tx, claims.tenant_id, id, true).await?;
    if set.author_id == claims.sub {
        return Err(AppError::ForbiddenReason(
            "You drafted this change; someone else must approve it".to_owned(),
        ));
    }
    if set.status != "previewed" {
        return Err(AppError::Conflict(format!(
            "Only a previewed change can be approved; this one is {}",
            set.status
        )));
    }
    let offices = offices(&mut tx, claims, &set).await?;
    if offices.is_empty() {
        sqlx::query(
            "UPDATE knowledge_change_sets SET status = 'approved', approver_id = $3, approved_at = now(), \
                    decision_note = $4 WHERE tenant_id = $1 AND id = $2",
        )
        .bind(claims.tenant_id).bind(id).bind(claims.sub).bind(note)
        .execute(&mut *tx)
        .await?;
    } else {
        approve_as_office(&mut tx, claims, &set, offices, note).await?;
    }
    audit_decision(&mut tx, claims, id, "knowledge_change.approve", note).await?;
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

/// Reject, or for the author withdraw, a change that is not yet applied.
///
/// # Errors
/// Forbidden unless the author or an approver; conflict once applied.
pub async fn reject(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
    note: Option<&str>,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    let mut tx = begin(pool, claims).await?;
    let set = store::load_set(&mut tx, claims.tenant_id, id, true).await?;
    if set.author_id != claims.sub {
        require_permission(claims, permissions::knowledge::change_sets::APPROVE)?;
    }
    if !matches!(
        set.status.as_str(),
        "draft" | "previewed" | "stale" | "approved"
    ) {
        return Err(AppError::Conflict(format!(
            "A {} change cannot be rejected",
            set.status
        )));
    }
    sqlx::query(
        "UPDATE knowledge_change_sets SET status = 'rejected', rejected_by = $3, rejected_at = now(), \
                decision_note = $4 WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id).bind(id).bind(claims.sub).bind(note)
    .execute(&mut *tx)
    .await?;
    audit_decision(&mut tx, claims, id, "knowledge_change.reject", note).await?;
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

/// Apply an approved set, all items or none.
///
/// # Errors
/// Forbidden without `apply`; conflict unless approved, and conflict (with the
/// set left `stale`) when a live row moved since preview.
pub async fn apply(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::APPLY)?;
    let mut tx = begin(pool, claims).await?;
    let set = store::load_set(&mut tx, claims.tenant_id, id, true).await?;
    if area_of(&set)? == Area::FlowSwitches {
        require_permission(claims, permissions::flows::PUBLISH)?;
    }
    if set.status != "approved" {
        return Err(AppError::Conflict(format!(
            "Only an approved change can be applied; this one is {}",
            set.status
        )));
    }
    let outcome = by_area!(
        area_of(&set)?,
        flows::apply,
        &mut tx,
        claims.tenant_id,
        claims.sub,
        &set
    )?;
    if let Applied::Stale(items) = outcome {
        // Nothing was written; record why, so the screen can say so.
        sqlx::query(
            "UPDATE knowledge_change_sets SET status = 'stale' WHERE tenant_id = $1 AND id = $2",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        let list = items
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join(", ");
        return Err(AppError::Conflict(format!(
            "Live data changed since preview (item {list}). Nothing was applied; preview again"
        )));
    }
    let detail = store::detail(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(detail)
}

/// Start a rollback: a new draft set holding the inverse items.
///
/// # Errors
/// Forbidden without `rollback`; conflict unless applied and not already being
/// rolled back, or when a live row drifted since the change was applied.
pub async fn rollback(
    pool: &PgPool,
    claims: &Claims,
    id: Uuid,
    reason: &str,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    require_permission(claims, permissions::knowledge::change_sets::ROLLBACK)?;
    if reason.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Say why the change is being rolled back".to_owned(),
        ));
    }
    let mut tx = begin(pool, claims).await?;
    let original = store::load_set(&mut tx, claims.tenant_id, id, true).await?;
    if original.status != "applied" {
        return Err(AppError::Conflict(format!(
            "Only an applied change can be rolled back; this one is {}",
            original.status
        )));
    }
    let pending: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM knowledge_change_sets WHERE tenant_id = $1 \
           AND rollback_of_set_id = $2 AND status <> 'rejected' AND deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    if pending {
        return Err(AppError::Conflict(
            "A rollback of this change is already in progress".to_owned(),
        ));
    }
    let area = area_of(&original)?;
    let items = match by_area!(area, flows::inverse, &mut tx, claims.tenant_id, id)? {
        Ok(items) => items,
        Err(drifted) => {
            let list = drifted
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join(", ");
            return Err(AppError::Conflict(format!(
                "Item {list} was changed after this set was applied, so it cannot simply be reversed. \
                 Draft a new change instead"
            )));
        }
    };
    let title = format!("Roll back: {}", original.title);
    let new_id = store::insert_set(
        &mut tx,
        &NewSet {
            tenant: claims.tenant_id,
            author: claims.sub,
            area: area.as_str(),
            kind: kind(area),
            title: &title,
            reason,
            rollback_of: Some(id),
            items,
        },
    )
    .await?;
    let detail = store::detail(&mut tx, claims.tenant_id, new_id).await?;
    tx.commit().await?;
    Ok(detail)
}
