//! Outbound webhooks (#224): tell a subscribed partner that an event
//! happened.
//!
//! The body names the event and the records it is about — ids, numbers and
//! statuses, never names or clinical text; the partner reads the details
//! with its API key, under that key's permissions. Each request is signed:
//! `X-MedBrains-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of
//! "<t>.<body>">` with the subscription's secret, so the partner can prove
//! it came from the hospital and was not replayed. A 2xx is delivered; a
//! 5xx, 429 or network failure is retried by the outbox; any other 4xx is
//! the partner refusing it, and retrying would not change the answer.

use std::net::IpAddr;

use async_trait::async_trait;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{Map, Value, json};
use sha2::Sha256;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

pub const EVENT_TYPE: &str = "webhook.deliver";

/// `t=<ts>,v1=<hex>` for `body` sent at `timestamp`.
#[must_use]
pub fn signature(secret: &str, timestamp: i64, body: &str) -> String {
    // HMAC takes a key of any length, so this cannot fail.
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(secret.as_bytes()) else {
        return String::new();
    };
    mac.update(format!("{timestamp}.{body}").as_bytes());
    format!(
        "t={timestamp},v1={}",
        hex::encode(mac.finalize().into_bytes())
    )
}

/// Whether `url` may be posted to: HTTPS, and not an address inside the
/// hospital's own network (a webhook must not become a way to reach it).
#[must_use]
pub fn is_allowed_target(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or_default();
    let host = host.rsplit_once('@').map_or(host, |(_, h)| h);
    let host = if host.starts_with('[') {
        host.trim_start_matches('[')
            .split(']')
            .next()
            .unwrap_or_default()
    } else {
        host.split(':').next().unwrap_or_default()
    };
    if host.is_empty() || host.eq_ignore_ascii_case("localhost") || host.ends_with(".local") {
        return false;
    }
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => {
            !(ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_unspecified())
        }
        Ok(IpAddr::V6(ip)) => {
            !(ip.is_loopback() || ip.is_unspecified() || (ip.segments()[0] & 0xfe00) == 0xfc00)
        }
        Err(_) => true,
    }
}

/// The parts of an event a partner may receive: identifiers, numbers and
/// statuses. Anything else (names, notes, values) stays inside.
#[must_use]
pub fn minimal_data(payload: &Value) -> Value {
    let keep = |k: &str| k.ends_with("_id") || k.ends_with("_number") || k == "status";
    let data: Map<String, Value> = payload
        .as_object()
        .map(|o| {
            o.iter()
                .filter(|(k, _)| keep(k))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect()
        })
        .unwrap_or_default();
    Value::Object(data)
}

#[derive(Debug, Default)]
pub struct WebhookDeliverHandler;

#[derive(sqlx::FromRow)]
struct Subscription {
    url: String,
    signing_secret: String,
    is_active: bool,
}

async fn record(
    ctx: &HandlerCtx,
    subscription: Uuid,
    event: &str,
    status: &str,
    code: Option<i32>,
    error: Option<&str>,
) {
    let logged = sqlx::query(
        "INSERT INTO webhook_deliveries \
           (tenant_id, subscription_id, outbox_event_id, event_type, attempt, status, response_status, error) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(ctx.tenant_id)
    .bind(subscription)
    .bind(ctx.event_id)
    .bind(event)
    .bind(ctx.attempts + 1)
    .bind(status)
    .bind(code)
    .bind(error)
    .execute(&ctx.pool)
    .await;
    if let Err(e) = logged {
        tracing::warn!(error = %e, "webhook delivery not logged");
    }
}

#[async_trait]
impl Handler for WebhookDeliverHandler {
    fn event_type(&self) -> &'static str {
        EVENT_TYPE
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let subscription_id = payload["subscription_id"]
            .as_str()
            .and_then(|s| s.parse::<Uuid>().ok())
            .ok_or_else(|| HandlerError::Permanent("payload.subscription_id missing".to_owned()))?;
        let event = payload["event_type"]
            .as_str()
            .unwrap_or_default()
            .to_owned();
        let sub = sqlx::query_as::<_, Subscription>(
            "SELECT url, signing_secret, is_active FROM webhook_subscriptions \
              WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        )
        .bind(subscription_id)
        .bind(ctx.tenant_id)
        .fetch_optional(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(e.to_string()))?;
        // Switched off or removed since the event was queued: nothing to send.
        let Some(sub) = sub.filter(|s| s.is_active) else {
            return Ok(json!({ "skipped": "subscription inactive" }));
        };
        if !is_allowed_target(&sub.url) {
            record(
                ctx,
                subscription_id,
                &event,
                "failed",
                None,
                Some("URL not allowed"),
            )
            .await;
            return Err(HandlerError::Permanent(
                "webhook URL not allowed".to_owned(),
            ));
        }
        let body = json!({
            "id": ctx.event_id,
            "type": event,
            "created_at": chrono::Utc::now().to_rfc3339(),
            "data": payload["data"],
        })
        .to_string();
        let ts = chrono::Utc::now().timestamp();
        let sent = ctx
            .http_client
            .post(&sub.url)
            .header("content-type", "application/json")
            .header("x-medbrains-event", &event)
            .header("x-medbrains-delivery", ctx.event_id.to_string())
            .header(
                "x-medbrains-signature",
                signature(&sub.signing_secret, ts, &body),
            )
            .timeout(std::time::Duration::from_secs(10))
            .body(body)
            .send()
            .await;
        let response = match sent {
            Ok(r) => r,
            Err(e) => {
                record(
                    ctx,
                    subscription_id,
                    &event,
                    "retrying",
                    None,
                    Some(&e.to_string()),
                )
                .await;
                return Err(HandlerError::Transient(e.to_string()));
            }
        };
        let status = response.status();
        let code = Some(i32::from(status.as_u16()));
        if status.is_success() {
            record(ctx, subscription_id, &event, "delivered", code, None).await;
            return Ok(json!({ "status": status.as_u16() }));
        }
        if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            record(ctx, subscription_id, &event, "retrying", code, None).await;
            return Err(HandlerError::Transient(format!(
                "partner answered {status}"
            )));
        }
        record(ctx, subscription_id, &event, "failed", code, None).await;
        Err(HandlerError::Permanent(format!(
            "partner refused with {status}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{is_allowed_target, minimal_data, signature};

    #[test]
    fn the_signature_is_hmac_sha256_over_timestamp_and_body() {
        // Reference computed independently (Python hmac/hashlib).
        assert_eq!(
            signature("secret", 1_700_000_000, r#"{"a":1}"#),
            "t=1700000000,v1=49f24e537407743fa4a0242bb63b94b9a47ee99cbbe071ccd8a22550ae411686"
        );
        assert_ne!(signature("secret", 1, "x"), signature("other", 1, "x"));
        assert_ne!(signature("secret", 1, "x"), signature("secret", 2, "x"));
    }

    #[test]
    fn only_public_https_targets_are_allowed() {
        assert!(is_allowed_target("https://partner.example.com/hooks"));
        assert!(!is_allowed_target("http://partner.example.com/hooks"));
        assert!(!is_allowed_target("https://localhost/hooks"));
        assert!(!is_allowed_target("https://127.0.0.1/x"));
        assert!(!is_allowed_target("https://10.0.0.5/x"));
        assert!(!is_allowed_target("https://192.168.1.10:8443/x"));
        assert!(!is_allowed_target("https://[::1]/x"));
        assert!(!is_allowed_target("https://user@169.254.169.254/latest"));
    }

    #[test]
    fn a_partner_receives_ids_and_statuses_never_clinical_text() {
        let data = minimal_data(&json!({
            "patient_id": "p", "order_id": "o", "invoice_number": "INV-1", "status": "verified",
            "drug_name": "Morphine", "notes": "very ill",
        }));
        assert_eq!(
            data,
            json!({ "patient_id": "p", "order_id": "o", "invoice_number": "INV-1", "status": "verified" })
        );
    }
}
