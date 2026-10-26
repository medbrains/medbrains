//! Put a radiology order on the PACS's modality worklist (#226).
//!
//! Orthanc's worklists plugin (1.12.10+) takes `POST /worklists/create` with
//! the item's DICOM tags; the modality then finds the patient with a C-FIND
//! against Orthanc's DICOM port. Where the PACS is and how to sign in are read
//! at dispatch time from the hospital's own settings, through
//! [`pacs_target`](super::pacs_target) — never from the event payload, and
//! never sent to an address the network policy refuses.

use async_trait::async_trait;
use serde_json::{Value, json};

use super::pacs_target::{self, PacsError, Policy};
use crate::handler::{Handler, HandlerCtx, HandlerError};

#[derive(Debug, Default)]
pub struct WorklistCreateHandler;

#[async_trait]
impl Handler for WorklistCreateHandler {
    fn event_type(&self) -> &'static str {
        "pacs.worklist.create"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let target = pacs_target::load_target(
            &ctx.pool,
            ctx.tenant_id,
            ctx.secret_resolver.as_ref(),
            &Policy::from_env(),
        )
        .await
        .map_err(|e| match e {
            PacsError::Db(_) => HandlerError::Transient(e.to_string()),
            _ => HandlerError::Permanent(e.to_string()),
        })?
        .ok_or_else(|| HandlerError::Permanent("the hospital has no PACS configured".to_owned()))?;
        let response = target
            .post("/worklists/create")
            .json(&json!({ "Tags": payload["tags"] }))
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("PACS unreachable: {e}")))?;
        let status = response.status();
        if status.is_success() {
            let body: Value = response.json().await.unwrap_or(Value::Null);
            return Ok(json!({ "worklist_id": body["ID"] }));
        }
        if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(HandlerError::Transient(format!("PACS answered {status}")));
        }
        let detail = response.text().await.unwrap_or_default();
        Err(HandlerError::Permanent(format!(
            "PACS refused the worklist: {status} {detail}"
        )))
    }
}
