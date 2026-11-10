//! Reading and writing `flow_track_drafts` rows, and the tenant lists the
//! builder shows (roles, departments). No decisions here.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::checks::Roles;
use crate::model::Station;
use crate::registry::Tx;

/// A designer's working copy of a flow's track.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Draft {
    pub id: Uuid,
    pub flow_code: String,
    pub base_template_id: Option<Uuid>,
    pub stations: Value,
    pub revision: i32,
    pub dry_run_revision: Option<i32>,
    pub dry_run_at: Option<DateTime<Utc>>,
    pub status: String,
    pub updated_at: DateTime<Utc>,
    pub updated_by_name: Option<String>,
}

impl Draft {
    /// # Errors
    /// Internal when the stored stations do not parse.
    pub fn track(&self) -> Result<Vec<Station>, AppError> {
        serde_json::from_value(self.stations.clone())
            .map_err(|e| AppError::Internal(format!("bad draft stations: {e}")))
    }
}

const DRAFT: &str = "SELECT d.id, d.flow_code, d.base_template_id, d.stations, d.revision, \
     d.dry_run_revision, d.dry_run_at, d.status, d.updated_at, u.full_name AS updated_by_name \
     FROM flow_track_drafts d LEFT JOIN users u ON u.id = d.updated_by \
     WHERE d.tenant_id = $1 AND d.deleted_at IS NULL";

/// The open draft for a flow.
pub async fn open(tx: &mut Tx<'_>, tenant: Uuid, code: &str) -> Result<Option<Draft>, AppError> {
    Ok(sqlx::query_as::<_, Draft>(&format!(
        "{DRAFT} AND d.flow_code = $2 AND d.status = 'draft'"
    ))
    .bind(tenant)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?)
}

/// A draft by id, locked for the caller's transaction.
pub async fn by_id(tx: &mut Tx<'_>, tenant: Uuid, id: Uuid) -> Result<Option<Draft>, AppError> {
    sqlx::query("SELECT 1 FROM flow_track_drafts WHERE tenant_id = $1 AND id = $2 FOR UPDATE")
        .bind(tenant)
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(
        sqlx::query_as::<_, Draft>(&format!("{DRAFT} AND d.id = $2"))
            .bind(tenant)
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?,
    )
}

pub(crate) struct Save<'a> {
    pub tenant: Uuid,
    pub code: &'a str,
    pub base: Uuid,
    /// The revision the screen last saw; 0 starts a new draft.
    pub revision: i32,
    pub stations: Value,
    pub user: Uuid,
}

/// Save a draft. A save from a screen that has not seen the latest
/// revision is refused, so two designers never overwrite each other.
pub(crate) async fn save(tx: &mut Tx<'_>, s: &Save<'_>) -> Result<Uuid, AppError> {
    let stale = || {
        AppError::Conflict(
            "Someone else changed this draft since you opened it; reload to see their changes"
                .to_owned(),
        )
    };
    if s.revision == 0 {
        return sqlx::query_scalar(
            "INSERT INTO flow_track_drafts (tenant_id, flow_code, base_template_id, stations, \
                    created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5) \
             ON CONFLICT DO NOTHING RETURNING id",
        )
        .bind(s.tenant)
        .bind(s.code)
        .bind(s.base)
        .bind(&s.stations)
        .bind(s.user)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(stale);
    }
    sqlx::query_scalar(
        "UPDATE flow_track_drafts SET stations = $4, revision = revision + 1, updated_by = $5 \
          WHERE tenant_id = $1 AND flow_code = $2 AND status = 'draft' AND deleted_at IS NULL \
            AND revision = $3 RETURNING id",
    )
    .bind(s.tenant)
    .bind(s.code)
    .bind(s.revision)
    .bind(&s.stations)
    .bind(s.user)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(stale)
}

/// Record that the server dry-ran `revision`.
pub(crate) async fn mark_dry_run(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
    revision: i32,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE flow_track_drafts SET dry_run_revision = $3, dry_run_at = now() \
          WHERE tenant_id = $1 AND id = $2 AND revision = $3 AND status = 'draft'",
    )
    .bind(tenant)
    .bind(id)
    .bind(revision)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Conflict(
            "The draft changed while the test drive ran; run it again".to_owned(),
        ));
    }
    Ok(())
}

/// Close a draft: `published` (with the version it became) or `discarded`.
pub async fn close(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    id: Uuid,
    published: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE flow_track_drafts SET status = CASE WHEN $3::uuid IS NULL THEN 'discarded' \
                ELSE 'published' END, published_template_id = $3 \
          WHERE tenant_id = $1 AND id = $2 AND status = 'draft'",
    )
    .bind(tenant)
    .bind(id)
    .bind(published)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The hospital's active roles and what each may do; bypass roles hold all.
pub async fn roles(tx: &mut Tx<'_>, tenant: Uuid) -> Result<Roles, AppError> {
    let rows: Vec<(String, Value)> = sqlx::query_as(
        "SELECT code, permissions FROM roles \
          WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL LIMIT 500",
    )
    .bind(tenant)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(code, perms)| {
            let held = (!matches!(code.as_str(), "super_admin" | "hospital_admin")).then(|| {
                perms
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect::<HashSet<_>>()
            });
            (code, held)
        })
        .collect())
}

/// A code and its name, for the builder's pickers.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Named {
    pub code: String,
    pub name: String,
}

pub(crate) async fn role_names(tx: &mut Tx<'_>, tenant: Uuid) -> Result<Vec<Named>, AppError> {
    Ok(sqlx::query_as::<_, Named>(
        "SELECT code, name FROM roles WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
          ORDER BY name LIMIT 500",
    )
    .bind(tenant)
    .fetch_all(&mut **tx)
    .await?)
}

pub(crate) async fn departments(tx: &mut Tx<'_>, tenant: Uuid) -> Result<Vec<Named>, AppError> {
    Ok(sqlx::query_as::<_, Named>(
        "SELECT code, name FROM departments WHERE tenant_id = $1 AND is_active \
            AND deleted_at IS NULL ORDER BY name LIMIT 500",
    )
    .bind(tenant)
    .fetch_all(&mut **tx)
    .await?)
}

/// Whether `track` was this flow's published track at some version.
///
/// Rolling back to it then needs no new dry run (its checks still run).
/// Compared as parsed stations, so a snapshot written before a field was
/// added still matches. Bounded to the last 100 versions.
pub async fn was_published(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    code: &str,
    track: &[Station],
) -> Result<bool, AppError> {
    let steps: Vec<Value> = sqlx::query_scalar(
        "SELECT steps FROM workflow_templates WHERE tenant_id = $1 AND code = $2 \
            AND status IN ('published', 'retired') AND deleted_at IS NULL \
          ORDER BY version DESC LIMIT 100",
    )
    .bind(tenant)
    .bind(code)
    .fetch_all(&mut **tx)
    .await?;
    Ok(steps
        .into_iter()
        .any(|v| serde_json::from_value::<Vec<Station>>(v).is_ok_and(|t| t.as_slice() == track)))
}
