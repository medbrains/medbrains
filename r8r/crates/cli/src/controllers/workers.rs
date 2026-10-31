//! Who is running, and which of them is leading.

use crate::databases::{SCHEDULER_LEASE, Worker};
use crate::response_helper::ApiResult;
use crate::server::AppState;
use axum::Json;
use axum::extract::State;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fleet {
    /// Which worker answered this request.
    pub this: String,
    /// Which worker is firing schedule triggers, if any is right now.
    pub scheduler: Option<String>,
    pub workers: Vec<Worker>,
}

/// Everything an operator needs to answer "is my second instance working".
///
/// Worth having as an endpoint rather than only a log line: the interesting
/// question is usually asked from somewhere that is not the worker in trouble.
pub async fn list(State(state): State<AppState>) -> ApiResult<Json<Fleet>> {
    Ok(Json(Fleet {
        this: state.worker.id.clone(),
        scheduler: state.db.workers().lease_holder(SCHEDULER_LEASE)?,
        workers: state.db.workers().list()?,
    }))
}
