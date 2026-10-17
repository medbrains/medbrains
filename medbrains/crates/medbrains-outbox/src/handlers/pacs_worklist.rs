//! Put a radiology order on the PACS's modality worklist (#226).
//!
//! Orthanc's worklists plugin (1.12.10+) takes `POST /worklists/create` with
//! the item's DICOM tags; the modality then finds the patient with a C-FIND
//! against Orthanc's DICOM port. The PACS is the hospital's own, on its own
//! network, so this posts wherever the hospital configured it. Credentials:
//! the configured username, and the `ORTHANC_PASSWORD` secret when set.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

#[derive(Debug, Default)]
pub struct WorklistCreateHandler;

#[async_trait]
impl Handler for WorklistCreateHandler {
    fn event_type(&self) -> &'static str {
        "pacs.worklist.create"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let url = payload["orthanc_url"]
            .as_str()
            .filter(|u| !u.is_empty())
            .ok_or_else(|| HandlerError::Permanent("payload.orthanc_url missing".to_owned()))?;
        let mut request = ctx
            .http_client
            .post(format!("{}/worklists/create", url.trim_end_matches('/')))
            .timeout(std::time::Duration::from_secs(15))
            .json(&json!({ "Tags": payload["tags"] }));
        let username = payload["orthanc_username"].as_str().unwrap_or_default();
        if !username.is_empty() {
            let password = ctx
                .secret_resolver
                .get("ORTHANC_PASSWORD")
                .await
                .unwrap_or_default();
            request = request.basic_auth(username, Some(password));
        }
        let response = request
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
