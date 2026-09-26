//! Message simulator — the phone view's API (dev and test only).
//!
//! Answers 404 unless `MEDBRAINS_NOTIFY_SIMULATOR=true`, so on a deployment
//! that really sends messages the surface does not exist at all.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SimulatorQuery {
    pub patient_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// A phone number or email typed in by hand.
    pub recipient: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SimulatedMessage {
    pub id: Uuid,
    pub channel: String,
    pub recipient: String,
    pub event_type: String,
    pub subject: Option<String>,
    pub body: String,
    pub attachments: serde_json::Value,
    pub template_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SimulatorInbox {
    /// The numbers and addresses the view is showing, so the screen can say
    /// whose phone this is.
    pub recipients: Vec<String>,
    pub messages: Vec<SimulatedMessage>,
}

/// `GET /api/admin/message-simulator/messages` — everything sent to one person.
pub async fn list_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SimulatorQuery>,
) -> Result<Json<SimulatorInbox>, AppError> {
    if !medbrains_outbox::simulator::enabled() {
        return Err(AppError::NotFound);
    }
    require_permission(&claims, permissions::admin::notifications::simulator::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let recipients = recipients_of(&mut tx, claims.tenant_id, &query).await?;
    // ponytail: numbers match on their last ten digits (India), so a stored
    // "9876500000" finds a message sent to "+919876500000"; widen when a
    // deployment has other country codes.
    let messages = sqlx::query_as!( // allow-raw-sql: filtered by tenant_id inside the RLS transaction
        SimulatedMessage,
        r#"SELECT id, channel, recipient, event_type, subject, body, attachments,
                  template_id, created_at
             FROM simulated_messages
            WHERE tenant_id = $2
              AND (lower(recipient) = ANY($1)
                   OR right(regexp_replace(recipient, '\D', '', 'g'), 10) = ANY($1))
            ORDER BY created_at DESC
            LIMIT 200"#,
        &recipients.iter().map(|r| normalise(r)).collect::<Vec<_>>(),
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(SimulatorInbox { recipients, messages }))
}

/// A person's phone number and email, or what was typed.
async fn recipients_of(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    query: &SimulatorQuery,
) -> Result<Vec<String>, AppError> {
    let contacts = if let Some(patient_id) = query.patient_id {
        sqlx::query!( // allow-raw-sql: filtered by tenant_id inside the RLS transaction
            "SELECT phone, email FROM patients WHERE id = $1 AND tenant_id = $2",
            patient_id,
            tenant_id,
        )
        .fetch_optional(&mut **tx)
        .await?
        .map(|row| vec![Some(row.phone), row.email])
    } else if let Some(user_id) = query.user_id {
        sqlx::query!( // allow-raw-sql: filtered by tenant_id inside the RLS transaction
            "SELECT phone, email FROM users WHERE id = $1 AND tenant_id = $2",
            user_id,
            tenant_id,
        )
            .fetch_optional(&mut **tx)
            .await?
            .map(|row| vec![row.phone, Some(row.email)])
    } else {
        Some(vec![query.recipient.clone()])
    };
    let Some(contacts) = contacts else {
        return Err(AppError::NotFound);
    };
    Ok(contacts.into_iter().flatten().filter(|c| !c.trim().is_empty()).collect())
}

/// Emails compare case-insensitively; phone numbers by their last ten digits.
fn normalise(recipient: &str) -> String {
    if recipient.contains('@') {
        return recipient.trim().to_lowercase();
    }
    let digits: String = recipient.chars().filter(char::is_ascii_digit).collect();
    digits[digits.len().saturating_sub(10)..].to_owned()
}

#[cfg(test)]
mod tests {
    use super::normalise;

    #[test]
    fn a_stored_number_and_its_e164_form_are_the_same_person() {
        assert_eq!(normalise("9876500000"), normalise("+919876500000"));
        assert_eq!(normalise("+91 98765-00000"), "9876500000");
    }

    #[test]
    fn emails_ignore_case_and_spaces() {
        assert_eq!(normalise(" Asha@Example.com "), "asha@example.com");
    }
}
