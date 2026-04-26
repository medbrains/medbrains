//! Connector management — CRUD, health checks, and action execution.
//!
//! Connectors represent external system integrations (Razorpay, Twilio,
//! SMTP, WhatsApp, ABDM, custom HTTP APIs). Each connector stores its
//! configuration, retry policy, and health state.

use medbrains_core::orchestration::ConnectorRow;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// List all connectors for a tenant (plus global templates where tenant_id IS NULL).
pub async fn list_connectors(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<ConnectorRow>, AppError> {
    let rows = sqlx::query_as::<_, ConnectorRow>(
        "SELECT id, tenant_id, connector_type, name, description, config, status, \
                health_check_url, last_health_check, is_healthy, retry_config, \
                rate_limit, stats, created_by, created_at, updated_at \
         FROM connectors \
         WHERE tenant_id = $1 OR tenant_id IS NULL \
         ORDER BY name",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get a single connector by ID.
pub async fn get_connector(pool: &PgPool, id: Uuid) -> Result<ConnectorRow, AppError> {
    sqlx::query_as::<_, ConnectorRow>(
        "SELECT id, tenant_id, connector_type, name, description, config, status, \
                health_check_url, last_health_check, is_healthy, retry_config, \
                rate_limit, stats, created_by, created_at, updated_at \
         FROM connectors \
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)
}

/// Execute an action against a connector's external API.
///
/// Reads the connector config from DB, dispatches to the appropriate HTTP
/// client based on `connector_type`, and returns the response JSON.
pub async fn execute_connector_action(
    pool: &PgPool,
    connector_id: Uuid,
    action: &str,
    input: &Value,
) -> Result<Value, AppError> {
    let connector = get_connector(pool, connector_id).await?;

    if connector.status != "active" {
        return Err(AppError::BadRequest(format!(
            "connector '{}' is not active (status: {})",
            connector.name, connector.status
        )));
    }

    let result = match connector.connector_type.as_str() {
        "razorpay" => call_razorpay(&connector.config, action, input).await,
        "twilio_sms" => call_twilio(&connector.config, action, input).await,
        "custom_http" => call_custom_http(&connector.config, action, input).await,
        "smtp_email" => call_smtp_stub(&connector.config, action, input),
        "whatsapp_business" => call_whatsapp_stub(&connector.config, action, input),
        "abdm" => call_abdm_stub(&connector.config, action, input),
        "tally_erp" => call_tally_stub(&connector.config, action, input),
        other => Err(AppError::BadRequest(format!(
            "unsupported connector type: {other}"
        ))),
    };

    // Update stats regardless of outcome
    let (success_inc, failure_inc) = if result.is_ok() {
        (1_i64, 0_i64)
    } else {
        (0, 1)
    };

    let _ = sqlx::query(
        "UPDATE connectors \
         SET stats = jsonb_set( \
             jsonb_set( \
                 jsonb_set(stats, '{total_calls}', \
                     to_jsonb((stats->>'total_calls')::int + 1)), \
                 '{success}', \
                 to_jsonb((stats->>'success')::int + $2)), \
             '{failures}', \
             to_jsonb((stats->>'failures')::int + $3)) \
         WHERE id = $1",
    )
    .bind(connector_id)
    .bind(success_inc)
    .bind(failure_inc)
    .execute(pool)
    .await;

    result
}

/// Health-check a connector by calling its `health_check_url`.
///
/// Updates `is_healthy` and `last_health_check` in the database.
pub async fn health_check(pool: &PgPool, connector_id: Uuid) -> Result<bool, AppError> {
    let connector = get_connector(pool, connector_id).await?;

    let url = connector.health_check_url.as_deref().unwrap_or("");
    if url.is_empty() {
        // No health check URL configured — assume healthy
        return Ok(true);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("http client error: {e}")))?;

    let healthy = client
        .get(url)
        .send()
        .await
        .is_ok_and(|r| r.status().is_success());

    sqlx::query(
        "UPDATE connectors \
         SET is_healthy = $2, last_health_check = now() \
         WHERE id = $1",
    )
    .bind(connector_id)
    .bind(healthy)
    .execute(pool)
    .await?;

    Ok(healthy)
}

// ── Connector-specific HTTP calls ───────────────────────────

/// Call Razorpay API with Basic Auth (key_id:key_secret).
async fn call_razorpay(config: &Value, action: &str, input: &Value) -> Result<Value, AppError> {
    let key_id = config.get("key_id").and_then(Value::as_str).unwrap_or("");
    let key_secret = config
        .get("key_secret")
        .and_then(Value::as_str)
        .unwrap_or("");

    if key_id.is_empty() || key_secret.is_empty() {
        return Err(AppError::BadRequest(
            "razorpay key_id and key_secret are required".into(),
        ));
    }

    let base_url = "https://api.razorpay.com/v1";
    let client = build_http_client()?;

    let resp = match action {
        "create_order" => {
            let url = format!("{base_url}/orders");
            client
                .post(&url)
                .basic_auth(key_id, Some(key_secret))
                .json(input)
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("razorpay request failed: {e}")))?
        }
        "fetch_payment" => {
            let payment_id = input
                .get("payment_id")
                .and_then(Value::as_str)
                .unwrap_or("");
            let url = format!("{base_url}/payments/{payment_id}");
            client
                .get(&url)
                .basic_auth(key_id, Some(key_secret))
                .send()
                .await
                .map_err(|e| AppError::Internal(format!("razorpay request failed: {e}")))?
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "unknown razorpay action: {action}"
            )));
        }
    };

    parse_response(resp).await
}

/// Call Twilio SMS API.
async fn call_twilio(config: &Value, action: &str, input: &Value) -> Result<Value, AppError> {
    let account_sid = config
        .get("account_sid")
        .and_then(Value::as_str)
        .unwrap_or("");
    let auth_token = config
        .get("auth_token")
        .and_then(Value::as_str)
        .unwrap_or("");
    let from_number = config
        .get("from_number")
        .and_then(Value::as_str)
        .unwrap_or("");

    if account_sid.is_empty() || auth_token.is_empty() {
        return Err(AppError::BadRequest(
            "twilio account_sid and auth_token are required".into(),
        ));
    }

    if action != "send_sms" {
        return Err(AppError::BadRequest(format!(
            "unknown twilio action: {action}"
        )));
    }

    let to = input.get("to").and_then(Value::as_str).unwrap_or("");
    let body_text = input.get("body").and_then(Value::as_str).unwrap_or("");

    let url = format!("https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json");

    let client = build_http_client()?;
    let resp = client
        .post(&url)
        .basic_auth(account_sid, Some(auth_token))
        .form(&[("To", to), ("From", from_number), ("Body", body_text)])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("twilio request failed: {e}")))?;

    parse_response(resp).await
}

/// Call a custom HTTP API using the connector's `base_url` and auth config.
async fn call_custom_http(config: &Value, action: &str, input: &Value) -> Result<Value, AppError> {
    let base_url = config.get("base_url").and_then(Value::as_str).unwrap_or("");

    if base_url.is_empty() {
        return Err(AppError::BadRequest(
            "custom_http base_url is required".into(),
        ));
    }

    let auth_type = config
        .get("auth_type")
        .and_then(Value::as_str)
        .unwrap_or("none");
    let auth_header = config
        .get("auth_header")
        .and_then(Value::as_str)
        .unwrap_or("");

    let url = format!("{base_url}/{action}");
    let client = build_http_client()?;

    let mut req = client.post(&url).json(input);

    if auth_type == "bearer" && !auth_header.is_empty() {
        req = req.bearer_auth(auth_header);
    } else if auth_type == "api_key" && !auth_header.is_empty() {
        req = req.header("X-API-Key", auth_header);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("custom_http request failed: {e}")))?;

    parse_response(resp).await
}

// ── Stub implementations for connectors that need deeper integration ──

fn call_smtp_stub(_config: &Value, action: &str, input: &Value) -> Result<Value, AppError> {
    Ok(serde_json::json!({
        "status": "queued",
        "connector": "smtp_email",
        "action": action,
        "to": input.get("to"),
        "subject": input.get("subject"),
    }))
}

fn call_whatsapp_stub(_config: &Value, action: &str, input: &Value) -> Result<Value, AppError> {
    Ok(serde_json::json!({
        "status": "queued",
        "connector": "whatsapp_business",
        "action": action,
        "to": input.get("to"),
    }))
}

fn call_abdm_stub(_config: &Value, action: &str, _input: &Value) -> Result<Value, AppError> {
    Ok(serde_json::json!({
        "status": "deferred",
        "connector": "abdm",
        "action": action,
        "message": "ABDM integration deferred to Phase 2",
    }))
}

fn call_tally_stub(_config: &Value, action: &str, _input: &Value) -> Result<Value, AppError> {
    Ok(serde_json::json!({
        "status": "deferred",
        "connector": "tally_erp",
        "action": action,
        "message": "Tally ERP integration deferred to Phase 2",
    }))
}

// ── Helpers ─────────────────────────────────────────────────

fn build_http_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("http client build error: {e}")))
}

async fn parse_response(resp: reqwest::Response) -> Result<Value, AppError> {
    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("response read error: {e}")))?;

    if !status.is_success() {
        return Err(AppError::Internal(format!(
            "connector returned {status}: {body}"
        )));
    }

    match serde_json::from_str(&body) {
        Ok(json) => Ok(json),
        Err(_) => {
            // Response is not JSON — wrap the raw text
            Ok(serde_json::json!({ "raw_response": body }))
        }
    }
}
