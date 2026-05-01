//! NHCX (National Health Claims Exchange) handlers — pre-auth + claim
//! submission with JWE+JWS envelope.
//!
//! NHCX is the IRDAI-mandated gateway for cashless+claim flows in
//! India. Each hospital and payer is registered with a `participant_code`
//! and an RSA keypair. Outbound flow:
//!
//!   1. Build the FHIR R4 Bundle (built elsewhere; passed in payload).
//!   2. Sign with our private key (RS256 JWS).
//!   3. Encrypt for the recipient payer's public key (RSA-OAEP-256 + A256GCM JWE).
//!   4. POST `{nhcx_base}/coverageeligibility/check` (or preauth/submit, claim/submit).
//!   5. NHCX returns a `correlation_id`; the actual response arrives as
//!      a webhook to `/api/integrations/nhcx/callback` (separate handler).
//!
//! Credentials per tenant via `secret_resolver`:
//!   - `NHCX_BASE_URL`              — e.g. https://apisbx.abdm.gov.in/hcx/v1 (sandbox)
//!   - `NHCX_PARTICIPANT_CODE`      — issued by NHCX onboarding
//!   - `NHCX_PRIVATE_KEY_PEM`       — hospital's RS256 signing key
//!   - `NHCX_RECIPIENT_PUBLIC_KEY`  — payer's RSA pubkey (PEM, fetched from NHCX directory)
//!   - `NHCX_BEARER_TOKEN`          — short-lived gateway token from /sessions API
//!
//! Missing credentials → graceful stub mode (logs + returns Ok).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `tpa.preauth_submit` — cashless preauth submission via NHCX.
#[derive(Debug)]
pub struct PreauthSubmitHandler;

#[async_trait]
impl Handler for PreauthSubmitHandler {
    fn event_type(&self) -> &'static str {
        "tpa.preauth_submit"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        submit_to_nhcx(ctx, payload, "preauth/submit", "preauth").await
    }
}

/// `tpa.claim_submit` — final claim submission post-discharge.
#[derive(Debug)]
pub struct ClaimSubmitHandler;

#[async_trait]
impl Handler for ClaimSubmitHandler {
    fn event_type(&self) -> &'static str {
        "tpa.claim_submit"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        submit_to_nhcx(ctx, payload, "claim/submit", "claim").await
    }
}

/// `tpa.coverage_eligibility_check` — pre-encounter eligibility query.
#[derive(Debug)]
pub struct CoverageEligibilityHandler;

#[async_trait]
impl Handler for CoverageEligibilityHandler {
    fn event_type(&self) -> &'static str {
        "tpa.coverage_eligibility_check"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        submit_to_nhcx(ctx, payload, "coverageeligibility/check", "coverage_eligibility").await
    }
}

async fn submit_to_nhcx(
    ctx: &HandlerCtx,
    payload: &Value,
    path: &str,
    label: &str,
) -> Result<Value, HandlerError> {
    let base = match ctx.secret_resolver.get("NHCX_BASE_URL").await {
        Ok(v) if !v.is_empty() => v,
        _ => {
            tracing::warn!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                label,
                "nhcx: NHCX_BASE_URL unset — running as stub"
            );
            return Ok(json!({ "provider": "nhcx", "stub": true, "reason": "creds_unset" }));
        }
    };
    let participant_code = ctx
        .secret_resolver
        .get("NHCX_PARTICIPANT_CODE")
        .await
        .map_err(|e| HandlerError::Permanent(format!("NHCX_PARTICIPANT_CODE: {e}")))?;
    let private_key_pem = ctx
        .secret_resolver
        .get("NHCX_PRIVATE_KEY_PEM")
        .await
        .map_err(|e| HandlerError::Permanent(format!("NHCX_PRIVATE_KEY_PEM: {e}")))?;
    let recipient_pub_pem = ctx
        .secret_resolver
        .get("NHCX_RECIPIENT_PUBLIC_KEY")
        .await
        .map_err(|e| HandlerError::Permanent(format!("NHCX_RECIPIENT_PUBLIC_KEY: {e}")))?;
    let bearer = ctx
        .secret_resolver
        .get("NHCX_BEARER_TOKEN")
        .await
        .map_err(|e| HandlerError::Permanent(format!("NHCX_BEARER_TOKEN: {e}")))?;

    // Recipient_code from payload — which payer this submission is for.
    let recipient_code = payload
        .get("recipient_code")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            HandlerError::Permanent("payload.recipient_code missing".to_owned())
        })?;
    let bundle = payload
        .get("bundle")
        .ok_or_else(|| HandlerError::Permanent("payload.bundle missing".to_owned()))?;

    // 1. Sign with our private key (RS256 JWS).
    let jws = medbrains_crypto::jws::sign_rs256(bundle, &participant_code, private_key_pem.as_bytes())
        .map_err(|e| HandlerError::Permanent(format!("nhcx jws: {e}")))?;

    // 2. Encrypt the JWS for the payer (RSA-OAEP-256 + A256GCM JWE).
    let jws_value = json!({ "jws": jws });
    let jwe = medbrains_crypto::jwe::encrypt_for_payer(
        &jws_value,
        recipient_code,
        recipient_pub_pem.as_bytes(),
    )
    .map_err(|e| HandlerError::Permanent(format!("nhcx jwe: {e}")))?;

    // 3. NHCX envelope. Headers + payload field carry routing metadata
    //    plus the JWE. correlation_id ties future webhook responses to
    //    our local claim row.
    let correlation_id = uuid::Uuid::new_v4().to_string();
    let api_call_id = uuid::Uuid::new_v4().to_string();
    let envelope = json!({
        "payload": jwe,
        "@context": format!("{}/contexts/{}", base, label),
        "x-hcx-sender_code": participant_code,
        "x-hcx-recipient_code": recipient_code,
        "x-hcx-correlation_id": correlation_id,
        "x-hcx-api_call_id": api_call_id,
        "x-hcx-timestamp": chrono::Utc::now().to_rfc3339(),
    });

    // 4. POST to NHCX gateway.
    let url = format!("{base}/{path}");
    let resp = ctx
        .http_client
        .post(&url)
        .bearer_auth(bearer)
        .json(&envelope)
        .send()
        .await
        .map_err(|e| HandlerError::Transient(format!("nhcx http: {e}")))?;

    let status = resp.status();
    let body_text = resp
        .text()
        .await
        .unwrap_or_else(|_| "<unreadable>".to_owned());

    if status.is_success() {
        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id = %ctx.event_id,
            correlation_id = %correlation_id,
            label,
            "nhcx: submitted; awaiting async webhook response"
        );
        Ok(json!({
            "provider": "nhcx",
            "label": label,
            "correlation_id": correlation_id,
            "api_call_id": api_call_id,
            "status": "accepted",
        }))
    } else if status.is_client_error() {
        Err(HandlerError::Permanent(format!(
            "nhcx {} {label}: {body_text}",
            status.as_u16()
        )))
    } else {
        Err(HandlerError::Transient(format!(
            "nhcx {} {label}: {body_text}",
            status.as_u16()
        )))
    }
}
