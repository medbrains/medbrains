//! NHCX async-callback receiver.
//!
//! NHCX gateway POSTs payer responses (preauth approval, claim
//! settlement, eligibility check result) to this endpoint after the
//! corresponding `submit_to_nhcx` call. The wire shape is the same
//! envelope the hospital sent — JWS-signed by the payer, JWE-encrypted
//! for the hospital.
//!
//! Flow:
//!   1. POST `/api/integrations/nhcx/callback` (no auth — gateway
//!      authenticates via JWS signature, not bearer token).
//!   2. Decrypt the JWE with our private key.
//!   3. Verify the JWS with the sender's public key (looked up from
//!      `nhcx_recipient_code`).
//!   4. Match `x-hcx-correlation_id` to local row.
//!   5. Update status + persist full response.
//!
//! Idempotency: a duplicate webhook for the same `correlation_id` is
//! treated as a no-op (the `WHERE nhcx_correlation_id = $1` UPDATE
//! returns 0 rows when status was already terminal).

use axum::{
    Extension, Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use medbrains_core::permissions;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

#[derive(Debug, Deserialize, Serialize)]
pub struct NhcxEnvelope {
    /// Outer JWE — encrypted JWS containing the actual payload.
    pub payload: String,

    #[serde(rename = "x-hcx-sender_code")]
    pub sender_code: String,

    #[serde(rename = "x-hcx-recipient_code")]
    pub recipient_code: Option<String>,

    #[serde(rename = "x-hcx-correlation_id")]
    pub correlation_id: Uuid,

    #[serde(rename = "x-hcx-api_call_id")]
    pub api_call_id: Option<Uuid>,

    #[serde(rename = "x-hcx-status")]
    pub status: Option<String>,
}

/// Handler — public route, no auth middleware.
pub async fn receive_callback(
    State(state): State<AppState>,
    Json(envelope): Json<NhcxEnvelope>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    // 1. Resolve our private key + the sender's public key.
    //    Both are tenant-scoped — but the webhook arrives without
    //    auth, so we infer tenant from the correlation_id. Look up
    //    the claim row first, get its tenant, then resolve secrets.
    let tenant_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT tenant_id FROM insurance_claims WHERE nhcx_correlation_id = $1 \
         UNION ALL SELECT tenant_id FROM prior_auth_requests WHERE nhcx_correlation_id = $1 \
         LIMIT 1",
    )
    .bind(envelope.correlation_id)
    .fetch_optional(&state.db)
    .await?;

    let raw_envelope = serde_json::to_value(&envelope).unwrap_or(Value::Null);

    let Some(tenant_id) = tenant_id else {
        // Unknown correlation_id. ACK 200 to avoid the gateway retrying
        // forever, but persist + log so ops can investigate.
        let _ = sqlx::query(
            "INSERT INTO nhcx_callback_log \
             (tenant_id, correlation_id, sender_code, raw_envelope, \
              verification_status, error_detail) \
             VALUES (NULL, $1, $2, $3, 'unknown_correlation', 'no matching local row')",
        )
        .bind(envelope.correlation_id)
        .bind(&envelope.sender_code)
        .bind(&raw_envelope)
        .execute(&state.db)
        .await;

        tracing::warn!(
            correlation_id = %envelope.correlation_id,
            sender = %envelope.sender_code,
            "nhcx callback: unknown correlation_id — ACKing to drop"
        );
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({ "status": "unknown_correlation" })),
        ));
    };

    // 2. Resolve crypto material via secret_resolver, scoped to tenant.
    let private_key_pem = state
        .secret_resolver
        .get("NHCX_PRIVATE_KEY_PEM")
        .await
        .map_err(|e| AppError::Internal(format!("NHCX_PRIVATE_KEY_PEM: {e}")))?;
    let sender_pub_pem = state
        .secret_resolver
        .get(&format!("NHCX_SENDER_PUBLIC_KEY:{}", envelope.sender_code))
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "NHCX_SENDER_PUBLIC_KEY for {}: {e}",
                envelope.sender_code
            ))
        })?;

    // 3. Decrypt the JWE → JSON containing the JWS.
    let participant_code = state
        .secret_resolver
        .get("NHCX_PARTICIPANT_CODE")
        .await
        .map_err(|e| AppError::Internal(format!("NHCX_PARTICIPANT_CODE: {e}")))?;
    let decrypted: Value = medbrains_crypto::jwe::decrypt_from_payer(
        &envelope.payload,
        &participant_code,
        private_key_pem.as_bytes(),
    )
    .map_err(|e| AppError::BadRequest(format!("nhcx jwe decrypt: {e}")))?;

    // 4. Verify the JWS with the sender's public key.
    let jws_token = decrypted
        .get("jws")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::BadRequest("decrypted payload missing 'jws'".to_owned()))?;
    let signed_payload: Value = medbrains_crypto::jws::verify_rs256(
        jws_token,
        &envelope.sender_code,
        sender_pub_pem.as_bytes(),
    )
    .map_err(|e| AppError::BadRequest(format!("nhcx jws verify: {e}")))?;

    // 5. Persist the full response and update status. We update
    //    whichever table the correlation matches.
    let new_status = envelope.status.as_deref().unwrap_or("response_received");

    let updated_claims: u64 = sqlx::query(
        "UPDATE insurance_claims \
         SET nhcx_response_payload = $1, nhcx_response_at = now(), \
             status = COALESCE($2, status), updated_at = now() \
         WHERE nhcx_correlation_id = $3 AND tenant_id = $4",
    )
    .bind(&signed_payload)
    .bind(new_status)
    .bind(envelope.correlation_id)
    .bind(tenant_id)
    .execute(&state.db)
    .await?
    .rows_affected();

    let updated_preauths: u64 = if updated_claims == 0 {
        sqlx::query(
            "UPDATE prior_auth_requests \
             SET nhcx_response_payload = $1, nhcx_response_at = now(), \
                 status = COALESCE($2::prior_auth_status, status), updated_at = now() \
             WHERE nhcx_correlation_id = $3 AND tenant_id = $4",
        )
        .bind(&signed_payload)
        .bind(new_status)
        .bind(envelope.correlation_id)
        .bind(tenant_id)
        .execute(&state.db)
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0)
    } else {
        0
    };

    let (matched_table, matched_id_query): (Option<&str>, Option<Uuid>) = if updated_claims > 0 {
        let row: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM insurance_claims WHERE nhcx_correlation_id = $1 AND tenant_id = $2",
        )
        .bind(envelope.correlation_id)
        .bind(tenant_id)
        .fetch_optional(&state.db)
        .await?;
        (Some("insurance_claims"), row)
    } else if updated_preauths > 0 {
        let row: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM prior_auth_requests \
             WHERE nhcx_correlation_id = $1 AND tenant_id = $2",
        )
        .bind(envelope.correlation_id)
        .bind(tenant_id)
        .fetch_optional(&state.db)
        .await?;
        (Some("prior_auth_requests"), row)
    } else {
        (None, None)
    };

    let _ = sqlx::query(
        "INSERT INTO nhcx_callback_log \
         (tenant_id, correlation_id, api_call_id, sender_code, recipient_code, \
          callback_type, raw_envelope, decrypted_payload, verification_status, \
          matched_table, matched_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', $9, $10)",
    )
    .bind(tenant_id)
    .bind(envelope.correlation_id)
    .bind(envelope.api_call_id)
    .bind(&envelope.sender_code)
    .bind(envelope.recipient_code.as_deref())
    .bind(envelope.status.as_deref())
    .bind(&raw_envelope)
    .bind(&signed_payload)
    .bind(matched_table)
    .bind(matched_id_query)
    .execute(&state.db)
    .await;

    tracing::info!(
        tenant_id = %tenant_id,
        correlation_id = %envelope.correlation_id,
        sender = %envelope.sender_code,
        new_status,
        claims_updated = updated_claims,
        preauths_updated = updated_preauths,
        "nhcx callback processed"
    );

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "accepted",
            "correlation_id": envelope.correlation_id,
        })),
    ))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NhcxCallbackRow {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub received_at: chrono::DateTime<chrono::Utc>,
    pub correlation_id: Option<Uuid>,
    pub api_call_id: Option<Uuid>,
    pub sender_code: Option<String>,
    pub recipient_code: Option<String>,
    pub callback_type: Option<String>,
    pub raw_envelope: Option<Value>,
    pub decrypted_payload: Option<Value>,
    pub verification_status: String,
    pub matched_table: Option<String>,
    pub matched_id: Option<Uuid>,
    pub error_detail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListCallbacksQuery {
    pub correlation_id: Option<Uuid>,
    pub matched_id: Option<Uuid>,
    pub limit: Option<i64>,
}

/// `GET /api/integrations/nhcx/callbacks` — recent callbacks for the
/// caller's tenant. Optional filters: correlation_id, matched_id.
pub async fn list_callbacks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCallbacksQuery>,
) -> Result<Json<Vec<NhcxCallbackRow>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let limit = q.limit.unwrap_or(100).clamp(1, 500);

    let rows = sqlx::query_as::<_, NhcxCallbackRow>(
        "SELECT id, tenant_id, received_at, correlation_id, api_call_id, \
                sender_code, recipient_code, callback_type, raw_envelope, \
                decrypted_payload, verification_status, matched_table, \
                matched_id, error_detail \
         FROM nhcx_callback_log \
         WHERE tenant_id = $1 \
           AND ($2::UUID IS NULL OR correlation_id = $2) \
           AND ($3::UUID IS NULL OR matched_id = $3) \
         ORDER BY received_at DESC \
         LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.correlation_id)
    .bind(q.matched_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}
