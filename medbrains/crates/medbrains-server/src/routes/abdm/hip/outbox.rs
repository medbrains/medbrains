//! `abdm.care_context.link` — queued by the capture trigger (migration 1110)
//! when a finalised record belongs to a patient with a verified ABHA.
//! `abdm.care_context.notify` — queued a minute after a link succeeds
//! (`linking::mark_linked`), and again after ABDM-1006 (`context_notify`).
//! `abdm.patient.sms_link` — queued once per patient by the capture
//! trigger (migration 1205) when a record belongs to a patient with a
//! mobile and no ABHA here (`sms_link`).

use async_trait::async_trait;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use serde_json::{Value, json};
use uuid::Uuid;

use super::context_notify::notify_context;
use super::linking::request_link;
use crate::{error::AppError, routes::abdm::abha::configured_in};

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

#[derive(Debug)]
pub struct SmsLinkHandler;

#[async_trait]
impl Handler for SmsLinkHandler {
    fn event_type(&self) -> &'static str {
        "abdm.patient.sms_link"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let patient_id = payload["patient_id"]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| HandlerError::Permanent("payload.patient_id missing".to_owned()))?;
        // A hospital not on ABDM sends nothing, and nothing waits to retry.
        match configured_in(&ctx.pool, ctx.tenant_id).await {
            Ok(true) => {}
            Ok(false) => return Ok(json!({ "skipped": "ABDM is not set up" })),
            Err(e) => return Err(HandlerError::Transient(e.to_string())),
        }
        let who = (ctx.tenant_id, patient_id);
        match super::sms_link::send(&ctx.pool, ctx.secret_resolver.as_ref(), who, None).await {
            Ok(()) => Ok(json!({ "patient_id": patient_id })),
            // An ABHA since, no mobile, a text just sent: nothing to retry.
            Err(AppError::BadRequest(m) | AppError::TooManyRequests(m)) => {
                Err(HandlerError::Permanent(m))
            }
            Err(AppError::NotFound) => Err(HandlerError::Permanent("patient not found".to_owned())),
            Err(e) => Err(HandlerError::Transient(e.to_string())),
        }
    }
}
