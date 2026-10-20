//! The provider side of a balance link: a request-scoped context, and
//! cancelling a link at whichever provider made it.

use std::{sync::Arc, time::Duration};

use medbrains_outbox::handler::{HandlerCtx, HandlerError};
use medbrains_server_core::{error::AppError, state::AppState};
use uuid::Uuid;

use crate::online::choose::with_keys;
use crate::online::provider_for;
use crate::payment_link::cancel_link;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Inferred, as checkout's: a cashier is not left watching a spinner.
const PROVIDER_TIMEOUT: Duration = Duration::from_secs(15);

/// An outbox-shaped context for a request, so a desk, the portal and the
/// refresh worker make links through the one path.
#[must_use]
pub fn ctx_for(state: &AppState, tenant_id: Uuid, actor: Option<Uuid>) -> HandlerCtx {
    HandlerCtx {
        pool: state.db.clone(),
        tenant_id,
        event_id: Uuid::new_v4(),
        event_type: "payment.balance_link.issue".to_owned(),
        actor_user_id: actor,
        attempts: 0,
        secret_resolver: Arc::clone(&state.secret_resolver),
        http_client: reqwest::Client::builder()
            .timeout(PROVIDER_TIMEOUT)
            .build()
            .unwrap_or_default(),
        object_store: Arc::clone(&state.documents_store),
    }
}

pub async fn begin(ctx: &HandlerCtx) -> Result<Tx<'static>, AppError> {
    let mut tx = ctx.pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &ctx.tenant_id).await?;
    Ok(tx)
}

pub fn provider_fault(e: &HandlerError) -> AppError {
    AppError::ServiceUnavailable(format!("The payment provider could not be reached: {e}"))
}

/// Cancel a link at the provider that made it (not necessarily the one the
/// hospital uses now). `Ok` once it can no longer be paid.
///
/// # Errors
/// That provider not set up any more, or unreachable; a database fault.
pub async fn cancel_at(ctx: &HandlerCtx, code: &str, link_ref: &str) -> Result<(), AppError> {
    let provider = provider_for(code)
        .ok_or_else(|| AppError::Internal(format!("no payment provider '{code}'")))?;
    let mut tx = begin(ctx).await?;
    let chosen = with_keys(
        &mut tx,
        ctx.secret_resolver.as_ref(),
        ctx.tenant_id,
        provider,
    )
    .await?
    .ok_or_else(|| {
        AppError::ServiceUnavailable(format!(
            "{} is no longer set up, so its open link cannot be cancelled",
            provider.label()
        ))
    })?;
    tx.commit().await?;
    cancel_link(&chosen, link_ref)
        .await
        .map_err(|e| provider_fault(&e))
}
