//! The screen-pop.
//!
//! The specification allows three seconds from call connect. Most of that is
//! the network and the browser, so the server's share is one indexed identity
//! lookup and two small reads that run only once a contact is known.
//!
//! A new caller returns in one query. That is the common case at the top of a
//! campaign and it must not be the slow path.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::contacts::{CHANNEL_PHONE, canonical_value, find_by_identity};
use crate::types::{Interaction, ScreenPop, ScreenPopQuery};

/// How many timeline lines the pop carries.
///
/// Three. It is what fits above the fold while somebody is saying hello, and
/// the agent opens the record for the rest.
const RECENT_LIMIT: i64 = 3;

/// `GET /api/marketing/screen-pop?phone=...`
///
/// # Errors
/// Returns 403 without `marketing.contacts.view`, 400 if the number cannot be
/// normalised.
pub async fn screen_pop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ScreenPopQuery>,
) -> Result<Json<ScreenPop>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::VIEW)?;

    let canonical = canonical_value(CHANNEL_PHONE, &params.phone)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let Some(contact) = find_by_identity(&mut tx, claims.tenant_id, CHANNEL_PHONE, &canonical)
        .await?
    else {
        tx.commit().await?;
        // Say "new caller" rather than render an empty record. An agent shown
        // a blank contact assumes the system lost the history; told the number
        // is new, they ask for a name.
        return Ok(Json(ScreenPop {
            contact: None,
            is_new_caller: true,
            recent: Vec::new(),
            campaign_name: None,
            stage_name: None,
            open_tasks: 0,
        }));
    };

    let recent = sqlx::query_as::<_, Interaction>(
        "SELECT id, contact_id, kind, channel, direction, occurred_at, answered, \
                duration_secs, agent_id, disposition, note, external_ref \
         FROM mkt_interactions \
         WHERE tenant_id = $1 AND contact_id = $2 \
         ORDER BY occurred_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(contact.id)
    .bind(RECENT_LIMIT)
    .fetch_all(&mut *tx)
    .await?;

    // Campaign name, stage name and the open-task count in one statement
    // rather than three round trips on the latency path.
    let context: Option<(Option<String>, Option<String>, i64)> = sqlx::query_as(
        "SELECT cam.name, st.name, \
                (SELECT count(*) FROM mkt_tasks t \
                  WHERE t.tenant_id = $1 AND t.contact_id = $2 AND t.status = 'open') \
         FROM mkt_contacts c \
         LEFT JOIN mkt_campaigns cam ON cam.id = c.campaign_id AND cam.tenant_id = c.tenant_id \
         LEFT JOIN mkt_pipeline_stages st ON st.id = c.stage_id AND st.tenant_id = c.tenant_id \
         WHERE c.tenant_id = $1 AND c.id = $2",
    )
    .bind(claims.tenant_id)
    .bind(contact.id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let (campaign_name, stage_name, open_tasks) = context.unwrap_or((None, None, 0));

    Ok(Json(ScreenPop {
        contact: Some(contact),
        is_new_caller: false,
        recent,
        campaign_name,
        stage_name,
        open_tasks,
    }))
}
