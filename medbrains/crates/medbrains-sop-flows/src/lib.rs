//! SOP flows (RFCs/RFC-SOP-FLOWS.md), phase 1: the discharge flow; phase 1b:
//! the track builder.
//!
//! Library flows are defined in code ([`discharge`]) as the default a
//! hospital starts from; a hospital flips their switches, and its flow
//! designers build their own track from registered blocks ([`builder`],
//! checked by [`checks`]), through knowledge change sets (area
//! `flow_switches`, adapter in `medbrains-knowledge`). The engine walks a patient through the stations by
//! reading the domain's own records and calling its existing actions; it
//! never writes a domain status itself.
//!
//! Handlers only read identity and translate; the service functions check
//! permissions.

// `unreachable_pub` is denied workspace-wide, so module-private items are
// `pub(crate)`; clippy's nursery `redundant_pub_crate` asks for the opposite.
#![allow(clippy::redundant_pub_crate)]

use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    routing::{get, post, put},
};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use uuid::Uuid;

pub mod blocks;
pub mod builder;
pub mod catalog;
pub mod checks;
pub mod condition;
pub mod control_room;
pub mod discharge;
pub mod drafts;
pub mod engine;
pub mod model;
pub mod paths;
pub mod registry;
pub mod replay;
pub mod route;
pub mod shape;
pub mod store;
mod walk;

use builder::{BuilderView, DryRunRequest, SaveDraft, TestDrive};
use control_room::ControlRoom;
use model::{FlowDetail, FlowSummary, ImpactReport, ImpactRequest, RunRequest, Ticket};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/flows", get(list))
        .route("/api/flows/{code}", get(detail))
        .route("/api/flows/{code}/impact", post(impact))
        .route("/api/flows/{code}/control-room", get(control))
        .route("/api/flows/{code}/build", get(build))
        .route(
            "/api/flows/{code}/build/draft",
            put(save_draft).delete(discard_draft),
        )
        .route("/api/flows/{code}/build/dry-run", post(dry_run))
        .route("/api/flows/{code}/subjects/{subject_id}/start", post(start))
        .route(
            "/api/flows/{code}/subjects/{subject_id}/ticket",
            get(ticket),
        )
        .route("/api/flows/{code}/subjects/{subject_id}/run", post(run))
        .route(
            "/api/flows/{code}/subjects/{subject_id}/tasks/{station}/complete",
            post(complete),
        )
}

async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FlowSummary>>, AppError> {
    catalog::list(&state.db, &claims).await.map(Json)
}

async fn detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<FlowDetail>, AppError> {
    catalog::detail(&state.db, &claims, &code).await.map(Json)
}

async fn impact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<ImpactRequest>,
) -> Result<Json<ImpactReport>, AppError> {
    catalog::impact(&state.db, &claims, &code, &body.switches)
        .await
        .map(Json)
}

async fn control(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<ControlRoom>, AppError> {
    control_room::control_room(&state.db, &claims, &code)
        .await
        .map(Json)
}

async fn start(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, subject)): Path<(String, Uuid)>,
) -> Result<Json<Ticket>, AppError> {
    engine::start(&state, &claims, &code, subject)
        .await
        .map(Json)
}

async fn ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, subject)): Path<(String, Uuid)>,
) -> Result<Json<Option<Ticket>>, AppError> {
    engine::ticket(&state, &claims, &code, subject)
        .await
        .map(Json)
}

async fn run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, subject)): Path<(String, Uuid)>,
    Json(body): Json<RunRequest>,
) -> Result<Json<Ticket>, AppError> {
    engine::run(&state, &claims, &code, subject, &body)
        .await
        .map(Json)
}

async fn complete(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((code, subject, station)): Path<(String, Uuid, String)>,
) -> Result<Json<Ticket>, AppError> {
    engine::complete_task(&state, &claims, &code, subject, &station)
        .await
        .map(Json)
}

async fn build(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<BuilderView>, AppError> {
    builder::get(&state.db, &claims, &code).await.map(Json)
}

async fn save_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<SaveDraft>,
) -> Result<Json<BuilderView>, AppError> {
    builder::save(&state.db, &claims, &code, body)
        .await
        .map(Json)
}

async fn discard_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<BuilderView>, AppError> {
    builder::discard(&state.db, &claims, &code).await.map(Json)
}

async fn dry_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<DryRunRequest>,
) -> Result<Json<TestDrive>, AppError> {
    builder::dry_run(&state.db, &claims, &code, &body)
        .await
        .map(Json)
}
