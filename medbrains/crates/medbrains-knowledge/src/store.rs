//! Reading and writing the change-set tables. No decisions here.

use serde_json::Value;
use uuid::Uuid;

use crate::adapter::{Adapter, Planned, Tx};
use crate::model::{KnowledgeChangeItem, KnowledgeChangeSet, KnowledgeChangeSetDetail, Op};
use medbrains_server_core::error::AppError;

const SET_SELECT: &str = "SELECT s.id, s.area, s.title, s.reason, s.status, s.author_id, \
    au.full_name AS author_name, s.approver_id, ap.full_name AS approver_name, s.decision_note, \
    s.rejected_by, s.rejected_at, s.applied_by, s.rollback_of_set_id, s.rolled_back_by_set_id, \
    s.created_at, s.previewed_at, s.approved_at, s.applied_at, s.base_hash, s.proof_hash, s.impact \
    FROM knowledge_change_sets s \
    LEFT JOIN users au ON au.id = s.author_id \
    LEFT JOIN users ap ON ap.id = s.approver_id \
    WHERE s.tenant_id = $1 AND s.deleted_at IS NULL";

/// Most sets one list returns.
const LIST_LIMIT: i64 = 200;

pub(crate) async fn list_sets(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    area: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<KnowledgeChangeSet>, sqlx::Error> {
    sqlx::query_as::<_, KnowledgeChangeSet>(&format!(
        "{SET_SELECT} AND ($2::text IS NULL OR s.area = $2) AND ($3::text IS NULL OR s.status = $3) \
         ORDER BY s.created_at DESC LIMIT $4"
    ))
    .bind(tenant)
    .bind(area)
    .bind(status)
    .bind(LIST_LIMIT)
    .fetch_all(&mut **tx)
    .await
}

/// The set, locked for the rest of the transaction when `lock` is set.
pub(crate) async fn load_set(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
    lock: bool,
) -> Result<KnowledgeChangeSet, AppError> {
    let lock = if lock { " FOR UPDATE OF s" } else { "" };
    sqlx::query_as::<_, KnowledgeChangeSet>(&format!("{SET_SELECT} AND s.id = $2{lock}"))
        .bind(tenant)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

pub(crate) async fn load_items(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    set_id: Uuid,
) -> Result<Vec<KnowledgeChangeItem>, sqlx::Error> {
    sqlx::query_as::<_, KnowledgeChangeItem>(
        "SELECT id, target_kind, target_key, op, before, after, seq FROM knowledge_change_items \
          WHERE tenant_id = $1 AND change_set_id = $2 AND deleted_at IS NULL ORDER BY seq",
    )
    .bind(tenant)
    .bind(set_id)
    .fetch_all(&mut **tx)
    .await
}

pub(crate) async fn detail(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
) -> Result<KnowledgeChangeSetDetail, AppError> {
    let set = load_set(tx, tenant, id, false).await?;
    let items = load_items(tx, tenant, id).await?;
    Ok(KnowledgeChangeSetDetail { set, items })
}

/// Stored items in the adapter's shape.
pub(crate) fn plan<A: Adapter>(
    items: &[KnowledgeChangeItem],
) -> Result<Vec<Planned<A::Row>>, AppError> {
    let bad = |what: &str| AppError::Internal(format!("stored change item has a bad {what}"));
    let row = |v: &Option<Value>| -> Result<Option<A::Row>, AppError> {
        v.clone()
            .map(serde_json::from_value)
            .transpose()
            .map_err(|_| bad("row"))
    };
    items
        .iter()
        .map(|i| {
            Ok(Planned {
                op: Op::parse(&i.op).ok_or_else(|| bad("op"))?,
                target: i
                    .target_key
                    .as_deref()
                    .map(str::parse)
                    .transpose()
                    .map_err(|_| bad("target"))?,
                before: row(&i.before)?,
                after: row(&i.after)?,
            })
        })
        .collect()
}

/// A new set in `draft`, its items in order.
pub(crate) struct NewSet<'a> {
    pub tenant: Uuid,
    pub author: Uuid,
    pub area: &'a str,
    pub kind: &'a str,
    pub title: &'a str,
    pub reason: &'a str,
    pub rollback_of: Option<Uuid>,
    pub items: Vec<(Op, Option<Uuid>, Option<Value>)>,
}

pub(crate) async fn insert_set(tx: &mut Tx<'_>, new: &NewSet<'_>) -> Result<Uuid, AppError> {
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO knowledge_change_sets (tenant_id, area, title, reason, author_id, rollback_of_set_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(new.tenant)
    .bind(new.area)
    .bind(new.title.trim())
    .bind(new.reason.trim())
    .bind(new.author)
    .bind(new.rollback_of)
    .fetch_one(&mut **tx)
    .await?;
    let ops: Vec<&str> = new.items.iter().map(|i| i.0.as_str()).collect();
    let targets: Vec<Option<String>> = new
        .items
        .iter()
        .map(|i| i.1.map(|t| t.to_string()))
        .collect();
    let afters: Vec<Option<Value>> = new.items.iter().map(|i| i.2.clone()).collect();
    // One statement for every item.
    sqlx::query(
        "INSERT INTO knowledge_change_items (tenant_id, change_set_id, target_kind, target_key, op, after, seq) \
         SELECT $1, $2, $3, t.target, t.op, t.after, t.seq::int \
           FROM unnest($4::text[], $5::text[], $6::jsonb[]) WITH ORDINALITY AS t(op, target, after, seq)",
    )
    .bind(new.tenant)
    .bind(id)
    .bind(new.kind)
    .bind(&ops)
    .bind(&targets)
    .bind(&afters)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}
