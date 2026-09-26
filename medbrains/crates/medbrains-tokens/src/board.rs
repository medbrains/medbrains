//! What a waiting-room board may show and say
//! (RFCs/modules/RFC-MODULE-token-queues.md, P3).
//!
//! A board is a public screen. A caller who reads it only as a display — a
//! paired TV, not a desk — gets the number and, if the queue opts in, the
//! patient's initials. Never the name: redaction happens here, not in the
//! screen, because a public device can show whatever it was sent.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{require_board_read, require_permission};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Token;

/// Whether the caller reads the board as a desk (names) or as a display. The
/// camp team working a camp's stations is that queue's desk.
pub fn reads_as_desk(claims: &Claims, module: &str) -> bool {
    require_permission(claims, permissions::front_office::queue::LIST).is_ok()
        || (module == "camp"
            && require_permission(claims, permissions::camp::queue::MANAGE).is_ok())
}

/// "Anita Kumari" → "A. K." — enough for a patient to recognise their number.
pub fn initials(name: &str) -> String {
    name.split_whitespace()
        .filter_map(|part| part.chars().next())
        .map(|c| format!("{}.", c.to_uppercase()))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Strip names from tokens a display is about to receive, by each token's
/// queue: initials where the queue opts in, nothing otherwise.
pub async fn redact_for_display(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tokens: &mut [Token],
) -> Result<(), AppError> {
    let queue_ids: Vec<Uuid> = tokens.iter().filter_map(|t| t.queue_id).collect();
    let shows_initials: HashMap<Uuid, bool> = sqlx::query!(
        r#"SELECT id, board_shows = 'initials' AS "initials!" FROM queues WHERE id = ANY($1)"#,
        &queue_ids,
    )
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|r| (r.id, r.initials))
    .collect();
    for token in tokens {
        let keep = token
            .queue_id
            .and_then(|q| shows_initials.get(&q).copied())
            .unwrap_or(false);
        token.patient_name = if keep {
            token.patient_name.as_deref().map(initials)
        } else {
            None
        };
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct BoardConfigQuery {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
}

/// How the board for one place speaks — the queue's settings, or the
/// defaults (English, once) where no queue is configured.
#[derive(Debug, Serialize)]
pub struct BoardConfig {
    pub voice_languages: Vec<String>,
    pub announce_repeat: i16,
}

/// `GET /api/tokens/board/config`
pub async fn board_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<BoardConfigQuery>,
) -> Result<Json<BoardConfig>, AppError> {
    if require_board_read(&claims).is_err() {
        require_permission(&claims, permissions::front_office::queue::LIST)?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scope = q.scope.as_deref().unwrap_or("department");
    let queue =
        crate::queues::live_queue(&mut tx, claims.tenant_id, (&q.module, scope, q.scope_id))
            .await?;
    tx.commit().await?;
    Ok(Json(queue.map_or_else(
        || BoardConfig {
            voice_languages: vec!["en".to_owned()],
            announce_repeat: 1,
        },
        |queue| BoardConfig {
            voice_languages: queue.voice_languages,
            announce_repeat: queue.announce_repeat,
        },
    )))
}

#[cfg(test)]
mod tests {
    use super::initials;

    #[test]
    fn initials_are_enough_to_recognise_and_no_more() {
        assert_eq!(initials("Anita Kumari"), "A. K.");
        assert_eq!(initials("  ravi  "), "R.");
        assert_eq!(initials(""), "");
    }
}
