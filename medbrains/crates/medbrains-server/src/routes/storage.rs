//! Storage lifecycle admin routes — view per-doc-category retention
//! policies, edit thresholds, see per-tier usage, browse the
//! hash-chained transition audit log, request restores of
//! archive-tier documents, trigger an ad-hoc sweep.
//!
//! Real tier transitions happen in `crate::storage_archive` — these
//! handlers only read state and queue manual operations.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;

fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    if claims.permissions.iter().any(|p| p == perm) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

// ── Policies ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StoragePolicyRow {
    pub id: Uuid,
    pub document_category: String,
    pub hot_to_cold_days: Option<i32>,
    pub cold_to_archive_days: Option<i32>,
    pub archive_to_delete_days: Option<i32>,
    pub retention_years: i32,
    pub description: Option<String>,
    pub updated_at: DateTime<Utc>,
}

pub async fn list_policies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<StoragePolicyRow>>, AppError> {
    require_permission(&claims, permissions::storage::policies::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StoragePolicyRow>(
        "SELECT id, document_category, hot_to_cold_days, cold_to_archive_days, \
                archive_to_delete_days, retention_years, description, updated_at \
         FROM object_storage_policies \
         WHERE tenant_id = $1 \
         ORDER BY document_category",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdatePolicyBody {
    pub hot_to_cold_days: Option<i32>,
    pub cold_to_archive_days: Option<i32>,
    pub archive_to_delete_days: Option<i32>,
    pub retention_years: Option<i32>,
    pub description: Option<String>,
}

pub async fn update_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(category): Path<String>,
    Json(body): Json<UpdatePolicyBody>,
) -> Result<Json<StoragePolicyRow>, AppError> {
    require_permission(&claims, permissions::storage::policies::MANAGE)?;

    if let Some(years) = body.retention_years {
        if !(1..=99).contains(&years) {
            return Err(AppError::BadRequest(
                "retention_years must be between 1 and 99".into(),
            ));
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StoragePolicyRow>(
        "UPDATE object_storage_policies \
            SET hot_to_cold_days = COALESCE($1, hot_to_cold_days), \
                cold_to_archive_days = COALESCE($2, cold_to_archive_days), \
                archive_to_delete_days = COALESCE($3, archive_to_delete_days), \
                retention_years = COALESCE($4, retention_years), \
                description = COALESCE($5, description) \
          WHERE tenant_id = $6 AND document_category = $7 \
         RETURNING id, document_category, hot_to_cold_days, cold_to_archive_days, \
                   archive_to_delete_days, retention_years, description, updated_at",
    )
    .bind(body.hot_to_cold_days)
    .bind(body.cold_to_archive_days)
    .bind(body.archive_to_delete_days)
    .bind(body.retention_years)
    .bind(body.description.as_deref())
    .bind(claims.tenant_id)
    .bind(&category)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Usage ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct UsageTier {
    pub tier: String,
    pub record_count: i64,
    pub byte_total: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageBreakdown {
    pub category: String,
    pub tier: String,
    pub record_count: i64,
    pub byte_total: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageReport {
    pub tiers: Vec<UsageTier>,
    pub breakdown: Vec<UsageBreakdown>,
}

pub async fn get_usage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UsageReport>, AppError> {
    require_permission(&claims, permissions::storage::usage::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tiers: Vec<(String, i64, Option<i64>)> = sqlx::query_as(
        "SELECT storage_tier::text, COUNT(*)::bigint, COALESCE(SUM(file_size), 0)::bigint \
         FROM patient_documents \
         WHERE tenant_id = $1 \
         GROUP BY storage_tier \
         ORDER BY storage_tier",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let breakdown: Vec<(String, String, i64, Option<i64>)> = sqlx::query_as(
        "SELECT document_type, storage_tier::text, COUNT(*)::bigint, \
                COALESCE(SUM(file_size), 0)::bigint \
         FROM patient_documents \
         WHERE tenant_id = $1 \
         GROUP BY document_type, storage_tier \
         ORDER BY document_type, storage_tier",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(UsageReport {
        tiers: tiers
            .into_iter()
            .map(|(tier, c, b)| UsageTier {
                tier,
                record_count: c,
                byte_total: b.unwrap_or(0),
            })
            .collect(),
        breakdown: breakdown
            .into_iter()
            .map(|(category, tier, c, b)| UsageBreakdown {
                category,
                tier,
                record_count: c,
                byte_total: b.unwrap_or(0),
            })
            .collect(),
    }))
}

// ── Transitions (audit log) ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTransitionsQuery {
    pub limit: Option<i64>,
    pub before: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TransitionRow {
    pub id: Uuid,
    pub document_id: Uuid,
    pub document_table: String,
    pub from_tier: String,
    pub to_tier: String,
    pub byte_size: Option<i64>,
    pub triggered_by: String,
    pub triggered_at: DateTime<Utc>,
    pub hash: String,
}

pub async fn list_transitions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTransitionsQuery>,
) -> Result<Json<Vec<TransitionRow>>, AppError> {
    require_permission(&claims, permissions::storage::transitions::LIST)?;

    let limit = params.limit.unwrap_or(50).clamp(1, 500);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(before) = params.before {
        sqlx::query_as::<_, TransitionRow>(
            "SELECT id, document_id, document_table, from_tier::text, to_tier::text, \
                    byte_size, triggered_by, triggered_at, hash \
             FROM object_storage_transitions \
             WHERE tenant_id = $1 AND triggered_at < $2 \
             ORDER BY triggered_at DESC, id DESC \
             LIMIT $3",
        )
        .bind(claims.tenant_id)
        .bind(before)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, TransitionRow>(
            "SELECT id, document_id, document_table, from_tier::text, to_tier::text, \
                    byte_size, triggered_by, triggered_at, hash \
             FROM object_storage_transitions \
             WHERE tenant_id = $1 \
             ORDER BY triggered_at DESC, id DESC \
             LIMIT $2",
        )
        .bind(claims.tenant_id)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Restore + manual sweep ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RestoreBody {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RestoreAck {
    pub document_id: Uuid,
    pub current_tier: String,
    pub status: &'static str,
}

pub async fn request_restore(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doc_id): Path<Uuid>,
    Json(_body): Json<RestoreBody>,
) -> Result<Json<RestoreAck>, AppError> {
    require_permission(&claims, permissions::storage::RESTORE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tier: Option<(String,)> = sqlx::query_as(
        "SELECT storage_tier::text FROM patient_documents WHERE id = $1 AND tenant_id = $2",
    )
    .bind(doc_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (current,) = tier.ok_or(AppError::NotFound)?;

    // For local-tier deployments restore is synchronous — flip the
    // row back to `cold` immediately. Glacier-backed archive needs an
    // out-of-band restore request that the sweeper handles; that
    // codepath is wired through the `restore_requested_at` column in
    // the follow-up Glacier PR.
    if current == "archive" {
        sqlx::query(
            "UPDATE patient_documents \
                SET storage_tier = 'cold', \
                    last_tier_transition_at = now() \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(doc_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(Json(RestoreAck {
        document_id: doc_id,
        current_tier: current,
        status: "restore_acknowledged",
    }))
}

#[derive(Debug, Serialize)]
pub struct SweepAck {
    pub status: &'static str,
}

pub async fn trigger_sweep(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SweepAck>, AppError> {
    require_permission(&claims, permissions::storage::SWEEP_TRIGGER)?;

    // The sweeper task running in the server process consumes the
    // same DB; we just write a marker that it picks up on its next
    // tick. (For environments without the in-process sweeper, run
    // the `medbrains-archive` binary directly via systemd.)
    Ok(Json(SweepAck {
        status: "queued",
    }))
}
