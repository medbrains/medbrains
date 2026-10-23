//! `abdm.care_context.link` — queued by the capture trigger (migration 1110)
//! when a finalised record belongs to a patient with a verified ABHA.
//! `abdm.care_context.notify` — queued a minute after a link succeeds
//! (`linking::mark_linked`), and again after ABDM-1006 (`context_notify`).

use async_trait::async_trait;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use serde_json::{Value, json};
use uuid::Uuid;

use super::context_notify::notify_context;
use super::linking::request_link;
use crate::error::AppError;

#[derive(Debug)]
pub struct LinkCareContextHandler;

#[async_trait]
impl Handler for LinkCareContextHandler {
    fn event_type(&self) -> &'static str {
        "abdm.care_context.link"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let id = care_context_id(payload)?;
        match request_link(&ctx.pool, ctx.secret_resolver.as_ref(), ctx.tenant_id, id).await {
            Ok(()) => Ok(json!({ "care_context_id": id })),
            // ABDM's refusal is recorded on the care context; retrying will not change it.
            Err(AppError::NotFound) => {
                Err(HandlerError::Permanent("care context not found".to_owned()))
            }
            Err(AppError::BadRequest(m)) => Err(HandlerError::Permanent(m)),
            Err(e) => Err(HandlerError::Transient(e.to_string())),
        }
    }
}

/// Payload `care_context_id`, or a permanent failure.
fn care_context_id(payload: &Value) -> Result<Uuid, HandlerError> {
    payload["care_context_id"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| HandlerError::Permanent("payload.care_context_id missing".to_owned()))
}

#[derive(Debug)]
pub struct NotifyCareContextHandler;

#[async_trait]
impl Handler for NotifyCareContextHandler {
    fn event_type(&self) -> &'static str {
        "abdm.care_context.notify"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let id = care_context_id(payload)?;
        match notify_context(&ctx.pool, ctx.secret_resolver.as_ref(), ctx.tenant_id, id).await {
            Ok(()) => Ok(json!({ "care_context_id": id })),
            Err(AppError::NotFound) => {
                Err(HandlerError::Permanent("care context not found".to_owned()))
            }
            Err(AppError::BadRequest(m)) => Err(HandlerError::Permanent(m)),
            Err(e) => Err(HandlerError::Transient(e.to_string())),
        }
    }
}
