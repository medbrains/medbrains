//! A reopened conversation's widgets that were not kept: fetched again, now,
//! under the user's permissions as they are now.
//!
//! An answer keeps a widget's values only when it was built from an approved
//! count ([`super::kept`]). One built from a fetched record keeps only what to
//! fetch; this endpoint runs that read again as the assistant on the user's
//! behalf (the same path, guards and audit as live), withholds restricted
//! classes, and rebuilds the widget. Lost access or vanished data is "not
//! available" (404) — never an empty table, never the old values.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, State};
use medbrains_core::ai_widgets::build;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::{ActingAgent, ActorKind, Claims};
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, state::AppState};
use serde_json::Value;
use uuid::Uuid;

/// What one kept widget entry says to fetch, if it is a re-fetch.
fn refetch_spec(entry: &Value) -> Option<(&str, &str, &str)> {
    let source = entry.get("refetch")?.get("source")?.as_str()?;
    let kind = entry.get("kind")?.as_str()?;
    let title = entry
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or_default();
    source.starts_with("/api/").then_some((source, kind, title))
}

/// `GET /api/ai/messages/{id}/widgets/{index}` — the widget rebuilt from a
/// fresh read, for the conversation's owner.
///
/// # Errors
/// 403 without the assistant permission or for someone else's conversation;
/// 404 when the entry is not a re-fetch, the read is refused, or nothing comes
/// back.
pub(super) async fn widget(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, index)): Path<(Uuid, usize)>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::ai::assistant::USE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, (Uuid, Uuid, Option<Value>)>(
        "SELECT c.owner_user_id, c.id, m.parts FROM ai_messages m \
         JOIN ai_conversations c ON c.id = m.conversation_id AND c.tenant_id = m.tenant_id \
         WHERE m.id = $1 AND m.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    drop(tx);
    let (owner, conversation_id, parts) = row.ok_or(AppError::NotFound)?;
    if owner != claims.sub {
        return Err(AppError::Forbidden);
    }
    let entry = parts
        .as_ref()
        .and_then(|p| p.get("widgets")?.get(index))
        .ok_or(AppError::NotFound)?;
    let (source, kind, title) = refetch_spec(entry).ok_or(AppError::NotFound)?;
    let router = super::AI_ROUTER
        .get()
        .ok_or_else(|| AppError::Internal("router unavailable".to_owned()))?
        .clone();
    let claims = Claims {
        act: Some(ActingAgent {
            kind: ActorKind::AiAgent,
            agent: "clinical_assistant".to_owned(),
            model: "replay".to_owned(),
            run_id: Uuid::new_v4(),
            conversation_id: Some(conversation_id),
        }),
        ..claims
    };
    let path = super::dates::fill(source, chrono::Local::now().date_naive());
    let text = super::call_api_as_agent(router, &state, &claims, &path).await?;
    let mut data: Value = text
        .strip_prefix("HTTP 200\n")
        .and_then(|body| serde_json::from_str(body).ok())
        .ok_or(AppError::NotFound)?;
    medbrains_core::ai_redact::sensitive::withhold_in_json(&mut data)
        .map_err(AppError::Internal)?;
    let widget = build(kind, title, &data).map_err(|_| AppError::NotFound)?;
    Ok(Json(serde_json::to_value(widget).unwrap_or_default()))
}

#[cfg(test)]
mod tests {
    use super::refetch_spec;
    use serde_json::json;

    #[test]
    fn only_an_api_read_is_fetched_again() {
        let e = json!({"refetch": {"source": "/api/billing/invoices"}, "kind": "table", "title": "Bills"});
        assert_eq!(
            refetch_spec(&e),
            Some(("/api/billing/invoices", "table", "Bills"))
        );
        assert_eq!(refetch_spec(&json!({"widget": {"kind": "kpis"}})), None);
        let overview =
            json!({"refetch": {"source": "patient_overview"}, "kind": "list", "title": "x"});
        assert_eq!(refetch_spec(&overview), None);
    }
}
