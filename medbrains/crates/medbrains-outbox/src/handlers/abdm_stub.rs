//! ABDM (Ayushman Bharat Digital Mission) handlers — real outbound
//! to NHA gateway. Two flows:
//!
//! 1. **`abdm.verify_abha`** — verify a patient's ABHA ID against NHA's
//!    `/v1/account/profile` endpoint. Returns demographic data we
//!    cross-check with our local patient row.
//!
//! 2. **`abdm.hie_bundle_push`** — push a FHIR R4 Bundle (typically
//!    discharge summary or OPD consultation note) to a connected HIU
//!    via ABDM HIE-CM. The Bundle is wrapped in an AES-256-GCM blob
//!    keyed via ECDH-P256 with the HIU's published public key
//!    (`medbrains_crypto::hie::encrypt_bundle`).
//!
//! Credentials per tenant (via `secret_resolver`):
//!   - `ABDM_BASE_URL`        — e.g. `https://abhasbx.abdm.gov.in`
//!   - `ABDM_HIE_GATEWAY_URL` — e.g. `https://dev.abdm.gov.in/gateway/v0.5`
//!   - `ABDM_BEARER_TOKEN`    — short-lived token from `/sessions` login
//!   - `ABDM_HIP_ID`          — our HIP id registered with NHA
//!
//! Missing credentials → graceful stub mode.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::handler::{Handler, HandlerCtx, HandlerError};

/// `abdm.verify_abha` — verify ABHA ID with NHA on patient registration.
#[derive(Debug)]
pub struct VerifyAbhaHandler;

#[async_trait]
impl Handler for VerifyAbhaHandler {
    fn event_type(&self) -> &'static str {
        "abdm.verify_abha"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        let abha_id = payload
            .get("abha_id")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.abha_id missing".to_owned()))?;

        let base = match ctx.secret_resolver.get("ABDM_BASE_URL").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    "abdm: ABDM_BASE_URL unset — running as stub"
                );
                return Ok(json!({ "provider": "abdm", "stub": true, "reason": "creds_unset" }));
            }
        };
        let bearer = ctx
            .secret_resolver
            .get("ABDM_BEARER_TOKEN")
            .await
            .map_err(|e| HandlerError::Permanent(format!("ABDM_BEARER_TOKEN: {e}")))?;

        let url = format!("{base}/v1/account/profile");
        let resp = ctx
            .http_client
            .get(&url)
            .bearer_auth(bearer)
            .header("X-HIP-ID", "medbrains")
            .header("X-ABHA-ID", abha_id)
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("abdm http: {e}")))?;

        let status = resp.status();
        let body_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "<unreadable>".to_owned());

        if status.is_success() {
            let parsed: Value = serde_json::from_str(&body_text).unwrap_or(Value::Null);
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                abha_id = %abha_id,
                "abdm: ABHA verified"
            );
            Ok(json!({
                "provider": "abdm",
                "abha_id": abha_id,
                "profile": parsed,
                "status": "verified",
            }))
        } else if status.is_client_error() {
            Err(HandlerError::Permanent(format!(
                "abdm verify {}: {body_text}",
                status.as_u16()
            )))
        } else {
            Err(HandlerError::Transient(format!(
                "abdm verify {}: {body_text}",
                status.as_u16()
            )))
        }
    }
}

/// `abdm.hie_bundle_push` — push FHIR R4 bundle to HIU on consent.
#[derive(Debug)]
pub struct HieBundlePushHandler;

#[async_trait]
impl Handler for HieBundlePushHandler {
    fn event_type(&self) -> &'static str {
        "abdm.hie_bundle_push"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        let bundle = payload
            .get("bundle")
            .ok_or_else(|| HandlerError::Permanent("payload.bundle missing".to_owned()))?;
        let consent_id = payload
            .get("consent_id")
            .and_then(Value::as_str)
            .ok_or_else(|| HandlerError::Permanent("payload.consent_id missing".to_owned()))?;
        let hiu_public_key = payload
            .get("hiu_public_key")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                HandlerError::Permanent("payload.hiu_public_key missing".to_owned())
            })?;
        let care_context_reference = payload
            .get("care_context_reference")
            .and_then(Value::as_str)
            .unwrap_or("opd-discharge");

        let gateway = match ctx.secret_resolver.get("ABDM_HIE_GATEWAY_URL").await {
            Ok(v) if !v.is_empty() => v,
            _ => {
                tracing::warn!(
                    tenant_id = %ctx.tenant_id,
                    event_id = %ctx.event_id,
                    "abdm: ABDM_HIE_GATEWAY_URL unset — running as stub"
                );
                return Ok(json!({
                    "provider": "abdm_hie",
                    "stub": true,
                    "reason": "creds_unset",
                }));
            }
        };
        let bearer = ctx
            .secret_resolver
            .get("ABDM_BEARER_TOKEN")
            .await
            .map_err(|e| HandlerError::Permanent(format!("ABDM_BEARER_TOKEN: {e}")))?;
        let hip_id = ctx
            .secret_resolver
            .get("ABDM_HIP_ID")
            .await
            .map_err(|e| HandlerError::Permanent(format!("ABDM_HIP_ID: {e}")))?;

        // Encrypt the bundle for the HIU via ECDH→AES-256-GCM. The KDF
        // info string ties the encryption to this consent artefact —
        // accidental key reuse across consents fails decryption.
        let encrypted = medbrains_crypto::hie::encrypt_bundle(
            bundle,
            hiu_public_key,
            &format!("medbrains:hie:{consent_id}"),
        )
        .map_err(|e| HandlerError::Permanent(format!("hie encrypt: {e}")))?;

        let request_id = uuid::Uuid::new_v4().to_string();
        let envelope = json!({
            "requestId": request_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "notification": {
                "consentId": consent_id,
                "transactionId": uuid::Uuid::new_v4().to_string(),
                "doneAt": chrono::Utc::now().to_rfc3339(),
                "notifier": { "type": "HIP", "id": hip_id },
                "statusNotification": { "sessionStatus": "TRANSFERRED" },
            },
            "entries": [{
                "content": "encrypted",
                "media": "application/fhir+json",
                "checksum": "",
                "careContextReference": care_context_reference,
            }],
            "keyMaterial": {
                "cryptoAlg": "ECDH",
                "curve": "Curve25519",
                "dhPublicKey": {
                    "expiry": (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
                    "parameters": "Curve25519/32byte random key",
                    "keyValue": encrypted.hip_public_key,
                },
                "nonce": encrypted.nonce,
            },
            "encrypted_payload": encrypted.ciphertext,
        });

        let url = format!("{gateway}/health-information/notify");
        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(bearer)
            .header("X-HIP-ID", hip_id)
            .json(&envelope)
            .send()
            .await
            .map_err(|e| HandlerError::Transient(format!("abdm hie http: {e}")))?;

        let status = resp.status();
        if status.is_success() {
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                consent_id = %consent_id,
                request_id = %request_id,
                "abdm hie: bundle notified to HIU"
            );
            Ok(json!({
                "provider": "abdm_hie",
                "request_id": request_id,
                "consent_id": consent_id,
                "status": "transferred",
            }))
        } else if status.is_client_error() {
            let body_text = resp.text().await.unwrap_or_default();
            Err(HandlerError::Permanent(format!(
                "abdm hie {}: {body_text}",
                status.as_u16()
            )))
        } else {
            let body_text = resp.text().await.unwrap_or_default();
            Err(HandlerError::Transient(format!(
                "abdm hie {}: {body_text}",
                status.as_u16()
            )))
        }
    }
}
