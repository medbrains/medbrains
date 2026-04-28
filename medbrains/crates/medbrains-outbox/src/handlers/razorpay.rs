//! Razorpay handlers — typed, real (no pipeline JSON in the path).
//!
//! Covers:
//! - `payment.create_order`  → POST /v1/orders with `receipt = internal_payment_id`
//! - `payment.refund`        → POST /v1/payments/{id}/refund
//!
//! Idempotency: Razorpay deduplicates orders by `receipt`. We pass our
//! internal_payment_id as the receipt so a worker retry after a network
//! blip never creates a second order.
//!
//! Sprint A spec: `RFCs/sprints/SPRINT-A-outbox.md` §6.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `payment.create_order` handler. Phase 1 stub: logs the intent, marks
/// the linked `payment_gateway_transactions.status = 'created'` with a
/// synthetic gateway_order_id. Phase 1.1 wires real Razorpay HTTPS.
#[derive(Debug)]
pub struct CreateOrderHandler;

#[async_trait]
impl Handler for CreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.create_order"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        // Phase 1: stub. Real implementation will:
        //   1. Resolve Razorpay key + secret from SecretResolver (per-tenant).
        //   2. POST https://api.razorpay.com/v1/orders with
        //      Authorization: Basic + body { amount, currency, receipt, notes }.
        //   3. On 2xx: update payment_gateway_transactions.status='created' +
        //      gateway_order_id from response.
        //   4. On 4xx: HandlerError::Permanent (validation; DLQ).
        //   5. On 5xx / timeout: HandlerError::Transient (retry).
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            attempts = ctx.attempts,
            payload = ?payload,
            "razorpay.create_order STUB — Phase 1.1 will wire real HTTPS"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}

/// `payment.refund` handler. Same shape — stub for Phase 1.
#[derive(Debug)]
pub struct RefundHandler;

#[async_trait]
impl Handler for RefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.refund"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            payload = ?payload,
            "razorpay.refund STUB — Phase 1.1 will wire real HTTPS"
        );
        Ok(serde_json::json!({ "stub": true, "phase": 1 }))
    }
}
