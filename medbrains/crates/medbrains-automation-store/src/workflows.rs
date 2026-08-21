//! Workflows, and the authority each one runs with.

use crate::{Result, StoreError, scope_to_tenant};
use medbrains_automation::RunAs;
use medbrains_automation::prelude::Workflow;
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// A stored workflow: the graph, plus who it acts on behalf of.
#[derive(Debug, Clone)]
pub struct StoredWorkflow {
    pub workflow: Workflow,
    pub run_as: RunAs,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

const COLUMNS: &str = "id, tenant_id, name, active, nodes, connections, settings, \
                       run_as_user_id, run_as_permissions, created_at, updated_at";

pub async fn list(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<StoredWorkflow>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let sql = format!(
        "SELECT {COLUMNS} FROM public.automation_workflows \
         WHERE tenant_id = $1 ORDER BY updated_at DESC"
    );
    let rows = sqlx::query(&sql).bind(tenant_id).fetch_all(&mut *tx).await?;
    tx.commit().await?;

    rows.iter().map(from_row).collect()
}

/// Every active workflow in every tenant.
///
/// The scheduler is the one caller with no tenant of its own — it is a
/// background task, not a request — so this deliberately reads across tenants
/// and hands each workflow's own `RunAs` back with it. Callers must execute
/// with that authority and not their own.
pub async fn all_active(pool: &PgPool) -> Result<Vec<StoredWorkflow>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM public.automation_workflows WHERE active ORDER BY tenant_id"
    );
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    rows.iter().map(from_row).collect()
}

pub async fn find(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<Option<StoredWorkflow>> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let sql = format!(
        "SELECT {COLUMNS} FROM public.automation_workflows WHERE id = $1 AND tenant_id = $2"
    );
    let row = sqlx::query(&sql).bind(id).bind(tenant_id).fetch_optional(&mut *tx).await?;
    tx.commit().await?;

    row.as_ref().map(from_row).transpose()
}

pub async fn insert(
    pool: &PgPool,
    tenant_id: Uuid,
    created_by: Uuid,
    workflow: &Workflow,
) -> Result<Uuid> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    // A new workflow is inactive and holds no authority. It gets one only when
    // somebody activates it, and only as much as that person has.
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO public.automation_workflows
             (tenant_id, name, active, nodes, connections, settings, created_by)
         VALUES ($1, $2, FALSE, $3, $4, $5, $6)
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&workflow.name)
    .bind(serde_json::to_value(&workflow.nodes).unwrap_or_default())
    .bind(serde_json::to_value(&workflow.connections).unwrap_or_default())
    .bind(workflow.settings.clone())
    .bind(created_by)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

/// Save an edit.
///
/// Editing the graph deactivates the workflow and drops its authority: the
/// permissions were granted for the workflow somebody reviewed, and a changed
/// graph is not that workflow. Re-activating re-checks against whoever does it.
pub async fn update(pool: &PgPool, tenant_id: Uuid, id: Uuid, workflow: &Workflow) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE public.automation_workflows
            SET name = $3, nodes = $4, connections = $5, settings = $6,
                active = FALSE, run_as_permissions = '{}', updated_at = now()
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .bind(&workflow.name)
    .bind(serde_json::to_value(&workflow.nodes).unwrap_or_default())
    .bind(serde_json::to_value(&workflow.connections).unwrap_or_default())
    .bind(workflow.settings.clone())
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

/// Arm a workflow with the authority the activating user holds.
pub async fn activate(pool: &PgPool, id: Uuid, run_as: &RunAs) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &run_as.tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE public.automation_workflows
            SET active = TRUE, run_as_user_id = $3, run_as_permissions = $4, updated_at = now()
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(run_as.tenant_id)
    .bind(run_as.user_id)
    .bind(run_as.permissions())
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

/// Disarm a workflow, and take its authority away with it.
pub async fn deactivate(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected = sqlx::query(
        "UPDATE public.automation_workflows
            SET active = FALSE, run_as_permissions = '{}', updated_at = now()
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

pub async fn delete(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<u64> {
    let mut tx = pool.begin().await?;
    scope_to_tenant(&mut tx, &tenant_id).await?;

    let affected =
        sqlx::query("DELETE FROM public.automation_workflows WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

    tx.commit().await?;
    Ok(affected)
}

fn from_row(row: &sqlx::postgres::PgRow) -> Result<StoredWorkflow> {
    let id: Uuid = row.try_get("id")?;
    let tenant_id: Uuid = row.try_get("tenant_id")?;

    let nodes = serde_json::from_value(row.try_get("nodes")?)
        .map_err(|e| StoreError::Corrupt(format!("workflow {id} has unreadable nodes: {e}")))?;
    let connections = serde_json::from_value(row.try_get("connections")?).map_err(|e| {
        StoreError::Corrupt(format!("workflow {id} has unreadable connections: {e}"))
    })?;

    Ok(StoredWorkflow {
        workflow: Workflow {
            id: id.to_string(),
            name: row.try_get("name")?,
            active: row.try_get("active")?,
            nodes,
            connections,
            settings: row.try_get("settings")?,
        },
        run_as: RunAs::restore(
            tenant_id,
            row.try_get("run_as_user_id")?,
            row.try_get("run_as_permissions")?,
        ),
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}
