//! Router assembly and static asset serving. Mirrors `server.ts`.

use crate::config::Config;
use crate::controllers;
use crate::databases::Database;
use crate::webhooks;
use crate::workflow_runner::WorkflowRunner;
use axum::Router;
use axum::body::Body;
use axum::http::{StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, delete, get, patch, post, put};
use include_dir::{Dir, include_dir};
use r8r_core::{CredentialRegistry, NodeRegistry};
use std::sync::Arc;

/// The built editor, baked into the binary so deployment is one file.
static EDITOR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../editor-ui/dist");

#[derive(Debug, Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    /// Who this process is, for telling its runs apart from another worker's.
    pub worker: crate::worker::Worker,
    pub registry: Arc<NodeRegistry>,
    pub credential_types: Arc<CredentialRegistry>,
    pub runner: Arc<WorkflowRunner>,
    pub config: Config,
}

pub fn router(state: AppState) -> Router {
    let rest = credential_routes()
        .merge(workflow_routes())
        .merge(execution_routes())
        .merge(variable_routes())
        .route("/node-types", get(controllers::node_types::list))
        .route("/workers", get(controllers::workers::list));

    Router::new()
        .nest("/rest", rest)
        .route("/webhook/{*path}", any(webhooks::handle))
        .route("/healthz", get(health))
        .fallback(serve_editor)
        // Outermost, so it sees the status every other layer settled on.
        .layer(axum::middleware::from_fn(crate::http_log::log_requests))
        .with_state(state)
}

fn variable_routes() -> Router<AppState> {
    Router::new()
        .route("/variables", get(controllers::variables::list))
        .route(
            "/variables/{key}",
            put(controllers::variables::set).delete(controllers::variables::delete),
        )
}

fn credential_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/credential-types",
            get(controllers::credentials::list_types),
        )
        .route(
            "/credentials",
            get(controllers::credentials::list).post(controllers::credentials::create),
        )
        .route(
            "/credentials/{id}",
            get(controllers::credentials::get)
                .patch(controllers::credentials::update)
                .delete(controllers::credentials::delete),
        )
}

fn workflow_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/workflows",
            get(controllers::workflows::list).post(controllers::workflows::create),
        )
        .route("/workflows/run", post(controllers::workflows::run_unsaved))
        .route(
            "/workflows/{id}",
            get(controllers::workflows::get)
                .patch(controllers::workflows::update)
                .delete(controllers::workflows::delete),
        )
        .route(
            "/workflows/{id}/activate",
            patch(controllers::workflows::set_active),
        )
        .route("/workflows/{id}/run", post(controllers::workflows::run))
        .merge(version_routes())
        .route(
            "/workflows/{id}/state",
            get(controllers::state::get).delete(controllers::state::clear),
        )
        .route(
            "/workflows/{id}/state/{key}",
            axum::routing::delete(controllers::state::forget),
        )
}

fn version_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/workflows/{id}/versions",
            get(controllers::workflows::history),
        )
        // Registered before the `{version}` route so it is not read as a
        // version numbered "compare".
        .route(
            "/workflows/{id}/versions/compare",
            post(controllers::workflows::compare),
        )
        .route(
            "/workflows/{id}/versions/{version}",
            get(controllers::workflows::version),
        )
        .route(
            "/workflows/{id}/versions/{version}/restore",
            post(controllers::workflows::restore),
        )
}

fn execution_routes() -> Router<AppState> {
    Router::new()
        .route("/waiting", get(controllers::waiting::list))
        .route("/waiting/{id}/resume", post(controllers::waiting::resume))
        .route("/waiting/{id}/cancel", post(controllers::waiting::cancel))
        .route("/executions", get(controllers::executions::list))
        .route("/executions/{id}", get(controllers::executions::get))
        .route("/executions/{id}", delete(controllers::executions::delete))
        .route(
            "/executions/{id}/retry",
            post(controllers::executions::retry),
        )
        .route(
            "/executions/{id}/files/{name}",
            get(controllers::executions::binary),
        )
        // Registered as its own path so it is not read as an execution called
        // "retry".
        .route(
            "/executions/retry",
            post(controllers::executions::retry_many),
        )
}

async fn health() -> &'static str {
    "ok"
}

/// Serve the editor. `R8R_UI_DIR` reads from disk instead, so `npm run dev`
/// output can be tried without recompiling.
async fn serve_editor(
    axum::extract::State(state): axum::extract::State<AppState>,
    uri: Uri,
) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(dir) = &state.config.ui_dir {
        return serve_from_disk(dir, path).await;
    }

    match EDITOR
        .get_file(path)
        .or_else(|| EDITOR.get_file("index.html"))
    {
        Some(file) => file_response(path, file.contents().to_vec()),
        None => (
            StatusCode::NOT_FOUND,
            "editor assets are not built — run `npm --prefix editor-ui run build`",
        )
            .into_response(),
    }
}

async fn serve_from_disk(dir: &str, path: &str) -> Response {
    // Reject traversal before touching the filesystem.
    if path.contains("..") {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let root = std::path::Path::new(dir);
    match tokio::fs::read(root.join(path)).await {
        Ok(bytes) => file_response(path, bytes),
        // Unknown paths fall back to index.html so client-side routes work.
        Err(_) => match tokio::fs::read(root.join("index.html")).await {
            Ok(bytes) => file_response("index.html", bytes),
            Err(e) => (StatusCode::NOT_FOUND, format!("{dir}: {e}")).into_response(),
        },
    }
}

fn file_response(path: &str, bytes: Vec<u8>) -> Response {
    Response::builder()
        .header(header::CONTENT_TYPE, content_type(path))
        .body(Body::from(bytes))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or_default() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}
