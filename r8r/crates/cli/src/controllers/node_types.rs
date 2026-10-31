use crate::server::AppState;
use axum::Json;
use axum::extract::State;
use r8r_workflow::NodeTypeDescription;

/// The palette. The editor renders every node's parameter panel from this, so
/// a new node type needs no frontend change.
pub async fn list(State(state): State<AppState>) -> Json<Vec<NodeTypeDescription>> {
    Json(state.registry.descriptions())
}
