//! The per-adapter steps: check a draft, preview it, apply it, invert it.
//! Generic over [`Adapter`]; `engine` picks the adapter and checks permissions.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use serde_json::{Value, json};
use sqlx::Acquire;
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::model::{
    KnowledgeChangeItem, KnowledgeChangeSet, KnowledgeImpactReport, MAX_ITEMS,
    NewKnowledgeChangeItem, Op,
};
use crate::proof::{canonical, sha256_hex};
use crate::store::{load_items, plan};

type Items = Vec<(Op, Option<Uuid>, Option<Value>)>;

fn to_json<T: serde::Serialize>(v: &T) -> Result<Value, AppError> {
    serde_json::to_value(v).map_err(|e| AppError::Internal(e.to_string()))
}

/// Check a draft's items against the live rows; returns them normalised.
pub(crate) async fn check_new<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    items: &[NewKnowledgeChangeItem],
) -> Result<Items, AppError> {
    if items.is_empty() || items.len() > MAX_ITEMS {
        return Err(AppError::BadRequest(format!(
            "A change set holds 1 to {MAX_ITEMS} items"
        )));
    }
    let mut targets = HashSet::new();
    let mut out = Vec::with_capacity(items.len());
    for (n, item) in items.iter().enumerate() {
        let n = n + 1;
        let fail = |why: &str| AppError::BadRequest(format!("Item {n}: {why}"));
        let after = match (item.op, &item.after) {
            (Op::Delete, None) => None,
            (Op::Delete, Some(_)) => return Err(fail("a removal carries no new row")),
            (_, Some(v)) => {
                let row: A::Row =
                    serde_json::from_value(v.clone()).map_err(|e| fail(&format!("{e}")))?;
                A::validate(&row).map_err(|e| fail(&e))?;
                A::check(tx, tenant, &row).await?.map_err(|e| fail(&e))?;
                Some(row)
            }
            (_, None) => return Err(fail("the new row is missing")),
        };
        match (item.op, item.target_id) {
            (Op::Create, Some(_)) => return Err(fail("a new row has no target")),
            (Op::Create, None) => {}
            (_, None) => return Err(fail("which row to change is missing")),
            (_, Some(t)) if !targets.insert(t) => {
                return Err(fail("the row is already in this set"));
            }
            _ => {}
        }
        let current = A::current(tx, tenant, item.target_id, after.as_ref()).await?;
        live_matches_op::<A>(item.op, current.as_ref()).map_err(|e| fail(&e))?;
        out.push((
            item.op,
            item.target_id,
            after.as_ref().map(to_json).transpose()?,
        ));
    }
    Ok(out)
}

/// Whether the live row (or its absence) is one this op can act on.
fn live_matches_op<A: Adapter>(op: Op, current: Option<&A::Row>) -> Result<(), String> {
    match (op, current) {
        (Op::Create, Some(_)) => {
            Err("an active rule for this already exists; change that one".to_owned())
        }
        (Op::Update | Op::Delete, None) => Err("the row no longer exists".to_owned()),
        (Op::Delete, Some(row)) if A::deactivated(row) == *row => {
            Err("the row is already removed".to_owned())
        }
        _ => Ok(()),
    }
}

/// Capture `before`, apply in a savepoint, measure impact, roll back, store.
pub(crate) async fn preview<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    set: &KnowledgeChangeSet,
) -> Result<(), AppError> {
    let stored = load_items(tx, tenant, set.id).await?;
    let mut items = plan::<A>(&stored)?;
    for (n, item) in items.iter_mut().enumerate() {
        let current = A::current(tx, tenant, item.target, item.after.as_ref()).await?;
        live_matches_op::<A>(item.op, current.as_ref())
            .map_err(|e| AppError::BadRequest(format!("Item {}: {e}", n + 1)))?;
        item.before = current;
        if let Some(after) = &item.after {
            A::check(tx, tenant, after)
                .await?
                .map_err(|e| AppError::BadRequest(format!("Item {}: {e}", n + 1)))?;
        }
    }
    let before = A::observe(tx, tenant, &items).await?;
    let after = {
        let mut sp = (&mut *tx).begin().await?;
        for item in &items {
            A::write(&mut sp, tenant, item.op, item.target, item.after.as_ref()).await?;
        }
        let after = A::observe(&mut sp, tenant, &items).await?;
        // Nothing of the edits survives the preview.
        sp.rollback().await?;
        after
    };
    let mut entries = A::impact(tx, tenant, &items, before, after).await?;
    entries.sort_by_key(|e| e.severity);
    let report = KnowledgeImpactReport {
        entries,
        computed_at: Utc::now(),
    };

    let befores: Vec<Value> = items
        .iter()
        .map(|i| to_json(&i.before))
        .collect::<Result<_, _>>()?;
    let ids: Vec<Uuid> = stored.iter().map(|i| i.id).collect();
    sqlx::query(
        "UPDATE knowledge_change_items i SET before = t.before \
           FROM unnest($2::uuid[], $3::jsonb[]) AS t(id, before) \
          WHERE i.tenant_id = $1 AND i.id = t.id",
    )
    .bind(tenant)
    .bind(&ids)
    .bind(&befores)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE knowledge_change_sets SET status = 'previewed', previewed_at = now(), impact = $3, \
                base_hash = $4, approver_id = NULL, approved_at = NULL, decision_note = NULL, \
                approver_role = NULL, second_approver_id = NULL, second_approver_role = NULL, \
                second_approved_at = NULL \
          WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant)
    .bind(set.id)
    .bind(to_json(&report)?)
    .bind(sha256_hex(&canonical(&Value::Array(befores))))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn recheck<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    items: &[Planned<A::Row>],
    stored: &[KnowledgeChangeItem],
) -> Result<(), AppError> {
    for (item, row) in items.iter().zip(stored) {
        if let Some(after) = &item.after {
            A::check(tx, tenant, after)
                .await?
                .map_err(|e| AppError::Conflict(format!("Item {}: {e}", row.seq)))?;
        }
    }
    Ok(())
}

pub(crate) enum Applied {
    Done,
    /// Items (by number) whose live row moved since preview.
    Stale(Vec<i32>),
}

/// Re-check every `before`, then write, audit and prove — or report drift
/// having written nothing.
pub(crate) async fn apply<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    user: Uuid,
    set: &KnowledgeChangeSet,
) -> Result<Applied, AppError> {
    let stored = load_items(tx, tenant_id, set.id).await?;
    let items = plan::<A>(&stored)?;
    let mut drifted = Vec::new();
    for (item, row) in items.iter().zip(&stored) {
        let current = A::current(tx, tenant_id, item.target, item.after.as_ref()).await?;
        if current != item.before {
            drifted.push(row.seq);
        }
    }
    if !drifted.is_empty() {
        return Ok(Applied::Stale(drifted));
    }
    // Checked again at apply: a role may have lost a permission since.
    recheck::<A>(tx, tenant_id, &items, &stored).await?;
    let mut proven = Vec::with_capacity(items.len());
    for (item, row) in items.iter().zip(&stored) {
        let id = A::write(tx, tenant_id, item.op, item.target, item.after.as_ref()).await?;
        sqlx::query(
            "UPDATE knowledge_change_items SET target_key = $3 WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(row.id)
        .bind(id.to_string())
        .execute(&mut **tx)
        .await?;
        let entry = json!({ "id": row.id, "seq": row.seq, "op": row.op, "target_kind": row.target_kind,
                            "target_key": id.to_string(), "before": row.before, "after": row.after });
        AuditLogger::log(
            tx,
            &AuditEntry {
                tenant_id,
                user_id: Some(user),
                action: "knowledge_change.apply_item",
                entity_type: "knowledge_change_item",
                entity_id: Some(row.id),
                old_values: row.before.as_ref(),
                new_values: Some(&entry),
                ip_address: None,
            },
        )
        .await?;
        proven.push(entry);
    }
    let applied_at: DateTime<Utc> = sqlx::query_scalar("SELECT now()")
        .fetch_one(&mut **tx)
        .await?;
    let input = json!({
        "set": { "id": set.id, "tenant_id": tenant_id, "area": set.area, "title": set.title,
                 "reason": set.reason, "author_id": set.author_id, "approver_id": set.approver_id,
                 "approved_at": set.approved_at, "decision_note": set.decision_note,
                 "approver_role": set.approver_role, "second_approver_id": set.second_approver_id,
                 "second_approver_role": set.second_approver_role,
                 "second_approved_at": set.second_approved_at,
                 "applied_by": user, "applied_at": applied_at,
                 "rollback_of_set_id": set.rollback_of_set_id },
        "items": proven, "impact": set.impact, "base_hash": set.base_hash,
    });
    let text = canonical(&input);
    let proof_hash = sha256_hex(&text);
    let summary = json!({ "proof_hash": proof_hash, "area": set.area, "items": proven.len(),
                          "rollback_of_set_id": set.rollback_of_set_id });
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id,
            user_id: Some(user),
            action: "knowledge_change.apply",
            entity_type: "knowledge_change_set",
            entity_id: Some(set.id),
            old_values: None,
            new_values: Some(&summary),
            ip_address: None,
        },
    )
    .await?;
    sqlx::query(
        "UPDATE knowledge_change_sets SET status = 'applied', applied_by = $3, applied_at = $4, \
                proof_hash = $5, proof_canonical = $6 WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(set.id)
    .bind(user)
    .bind(applied_at)
    .bind(&proof_hash)
    .bind(&text)
    .execute(&mut **tx)
    .await?;
    if let Some(original) = set.rollback_of_set_id {
        sqlx::query(
            "UPDATE knowledge_change_sets SET status = 'rolled_back', rolled_back_by_set_id = $3 \
              WHERE tenant_id = $1 AND id = $2 AND status = 'applied'",
        )
        .bind(tenant_id)
        .bind(original)
        .bind(set.id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(Applied::Done)
}

/// The items that undo `original`, or the items (by number) that drifted.
pub(crate) async fn inverse<A: Adapter>(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    original: Uuid,
) -> Result<Result<Items, Vec<i32>>, AppError> {
    let stored = load_items(tx, tenant, original).await?;
    let items: Vec<Planned<A::Row>> = plan::<A>(&stored)?;
    let mut drifted = Vec::new();
    let mut out = Vec::with_capacity(items.len());
    for (item, row) in items.iter().zip(&stored) {
        let expected = match item.op {
            Op::Create | Op::Update => item.after.clone(),
            Op::Delete => item.before.as_ref().map(A::deactivated),
        };
        let current = A::current(tx, tenant, item.target, None).await?;
        if current != expected {
            drifted.push(row.seq);
            continue;
        }
        out.push(match item.op {
            Op::Create => (Op::Delete, item.target, None),
            Op::Update | Op::Delete => (
                Op::Update,
                item.target,
                item.before.as_ref().map(to_json).transpose()?,
            ),
        });
    }
    Ok(if drifted.is_empty() {
        Ok(out)
    } else {
        Err(drifted)
    })
}
