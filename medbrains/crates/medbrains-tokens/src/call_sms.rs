//! Whether the token-call SMS can actually reach a patient, for the token
//! settings screen: the switch, the DLT template it sends under, and the sends
//! the SMS handler refused for want of one.
//!
//! A refusal lands in `outbox_dlq` with its reason. Without this screen the
//! only person who could see it was whoever read the dead-letter table.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_workflow::orchestration::token_call_sms::{SMS_EVENT, TEMPLATE_PATTERN};
use serde::Serialize;

/// The registered DLT template the SMS goes out under.
#[derive(Debug, Serialize)]
pub struct CallSmsTemplate {
    pub template_id: String,
    pub template_name: String,
    pub language: String,
    pub expires_at: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct CallSmsStatus {
    pub enabled: bool,
    /// The scope to register the template under.
    pub template_scope: &'static str,
    /// The wording to register, with its `{#var#}` placeholders.
    pub suggested_pattern: &'static str,
    /// `None`: no active, unexpired template — India operators drop the send.
    pub template: Option<CallSmsTemplate>,
    /// Sends refused for want of a DLT template in the last seven days.
    pub refused_last_7_days: i64,
    pub last_refused_at: Option<DateTime<Utc>>,
    /// The handler's own words; DLT refusals name only the scope, no patient.
    pub last_refusal_reason: Option<String>,
}

type StatusRow = (
    Option<serde_json::Value>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<NaiveDate>,
    i64,
    Option<DateTime<Utc>>,
    Option<String>,
);

/// `GET /api/tokens/call-sms/status` — one round trip for the whole card.
/// Gated like the token settings screen it sits on.
pub async fn call_sms_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CallSmsStatus>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Only DLT refusals are counted and quoted: a provider's own error can
    // echo the patient's number, and this card is not the place for it.
    let row: StatusRow = sqlx::query_as(
        "WITH refused AS ( \
             SELECT moved_at, last_error FROM outbox_dlq \
              WHERE tenant_id = $1 AND event_type = $2 AND deleted_at IS NULL \
                AND moved_at > now() - interval '7 days' AND last_error LIKE '%DLT_ENFORCE%') \
         SELECT (SELECT value FROM tenant_settings WHERE tenant_id = $1 \
                    AND category = 'notifications' AND key = 'token_call_sms' \
                    AND deleted_at IS NULL LIMIT 1), \
                d.template_id, d.template_name, d.language::text, d.expires_at, \
                (SELECT count(*) FROM refused), \
                (SELECT max(moved_at) FROM refused), \
                (SELECT last_error FROM refused ORDER BY moved_at DESC LIMIT 1) \
           FROM (SELECT 1) one \
           LEFT JOIN LATERAL ( \
                SELECT template_id, template_name, language, expires_at FROM dlt_templates \
                 WHERE tenant_id = $1 AND scope = $2 AND is_active AND deleted_at IS NULL \
                   AND (expires_at IS NULL OR expires_at > CURRENT_DATE) \
                 ORDER BY (language = 'en') DESC, language LIMIT 1) d ON true",
    )
    .bind(claims.tenant_id)
    .bind(SMS_EVENT)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    let (enabled, template_id, template_name, language, expires_at, refused, last_at, reason) = row;
    let template = match (template_id, template_name, language) {
        (Some(template_id), Some(template_name), Some(language)) => Some(CallSmsTemplate {
            template_id,
            template_name,
            language,
            expires_at,
        }),
        _ => None,
    };
    Ok(Json(CallSmsStatus {
        enabled: enabled.and_then(|v| v.as_bool()) == Some(true),
        template_scope: SMS_EVENT,
        suggested_pattern: TEMPLATE_PATTERN,
        template,
        refused_last_7_days: refused,
        last_refused_at: last_at,
        last_refusal_reason: reason,
    }))
}
