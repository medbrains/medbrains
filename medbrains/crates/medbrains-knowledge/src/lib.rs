//! Knowledge change sets (RFCs/RFC-KNOWLEDGE-CHANGE-SETS.md).
//!
//! Draft edits to drug interactions or critical-value rules, preview who they
//! affect, have a second person approve, apply all-or-nothing (refused as
//! `stale` if the live rows moved), roll back as a new set, and download a
//! proof an auditor can verify offline.
//!
//! Phase 1 leaves the direct CDS write routes (`/api/cds/drug-interactions`,
//! `/api/cds/critical-value-rules`) open; they close once every screen that
//! writes these areas proposes through here (RFC §3.6).
//!
//! Handlers only read identity and translate; `engine` checks permissions.

// `unreachable_pub` is denied workspace-wide, so module-private items are
// `pub(crate)`; clippy's nursery `redundant_pub_crate` asks for the opposite.
#![allow(clippy::redundant_pub_crate)]

use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    routing::{get, post},
};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Deserialize;
use uuid::Uuid;

mod adapter;
mod critical_impact;
mod critical_values;
pub mod engine;
mod flows;
mod interaction_impact;
mod interactions;
pub mod model;
pub mod proof;
pub mod proof_file;
mod store;

use model::{
    Area, DecisionBody, KnowledgeChangeSet, KnowledgeChangeSetDetail, KnowledgeLiveRow,
    KnowledgeProof, NewKnowledgeChangeSet, RollbackBody,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/knowledge/change-sets", get(list).post(create))
        .route("/api/knowledge/change-sets/{id}", get(detail))
        .route("/api/knowledge/change-sets/{id}/preview", post(preview))
        .route("/api/knowledge/change-sets/{id}/approve", post(approve))
        .route("/api/knowledge/change-sets/{id}/reject", post(reject))
        .route("/api/knowledge/change-sets/{id}/apply", post(apply))
        .route("/api/knowledge/change-sets/{id}/rollback", post(rollback))
        .route("/api/knowledge/change-sets/{id}/proof", get(proof))
        .route("/api/knowledge/areas/{area}/rows", get(live_rows))
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub area: Option<String>,
    pub status: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<KnowledgeChangeSet>>, AppError> {
    engine::list(&state.db, &claims, q.area.as_deref(), q.status.as_deref())
        .await
        .map(Json)
}

async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<NewKnowledgeChangeSet>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::create(&state.db, &claims, &body).await.map(Json)
}

async fn detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::get(&state.db, &claims, id).await.map(Json)
}

async fn preview(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::preview(&state.db, &claims, id).await.map(Json)
}

async fn approve(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecisionBody>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::approve(&state.db, &claims, id, body.note.as_deref())
        .await
        .map(Json)
}

async fn reject(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecisionBody>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::reject(&state.db, &claims, id, body.note.as_deref())
        .await
        .map(Json)
}

async fn apply(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::apply(&state.db, &claims, id).await.map(Json)
}

async fn rollback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RollbackBody>,
) -> Result<Json<KnowledgeChangeSetDetail>, AppError> {
    engine::rollback(&state.db, &claims, id, &body.reason)
        .await
        .map(Json)
}

async fn proof(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<KnowledgeProof>, AppError> {
    proof_file::proof(&state.db, &claims, id).await.map(Json)
}

async fn live_rows(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(area): Path<String>,
) -> Result<Json<Vec<KnowledgeLiveRow>>, AppError> {
    let area = Area::parse(&area).ok_or(AppError::NotFound)?;
    engine::live(&state.db, &claims, area).await.map(Json)
}
