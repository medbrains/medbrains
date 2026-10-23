//! `POST /api/uhi/hspa/{hospital}/{action}` — every call a patient app
//! (EUA) makes to this hospital as a UHI provider (HSPA).
//!
//! 1. The hospital code in the path names the hospital (no session). It is
//!    not the NHA subscriber ID: NHA issues that only after this URL is
//!    registered.
//! 2. A search fanned out by the gateway must carry the gateway's signature;
//!    every other call the app's, from the registry, at the `consumer_uri`
//!    the registry has for it. 401 with a NACK if not.
//! 3. The transaction is recorded, the answer computed and queued, and the
//!    call is ACKed; the signed `on_*` answer follows from the outbox.
//!
//! A search for a service this hospital does not offer is ACKed and left
//! unanswered, as a provider that has nothing to offer stays silent.

use axum::{
    Json,
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    response::{IntoResponse, Response},
};
use medbrains_core::secrets::SecretResolver;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    auth::{self, Nack},
    labs,
    outbox::{self, Callback},
    payment,
    protocol::{ACTIONS, Context, ERR_NOT_REGISTERED, GatewaySpec, Service},
    requests, settings, teleconsult,
};
use crate::{error::AppError, state::AppState};

/// The transaction as this hospital knows it.
#[derive(Debug, sqlx::FromRow)]
pub struct Txn {
    pub id: Uuid,
    pub service: String,
    pub state: String,
    pub order_details: Option<Value>,
    pub appointment_id: Option<Uuid>,
    pub payment_transaction_id: Option<Uuid>,
}

/// What to send back: the `message` of the `on_*` call, or an error.
#[derive(Debug)]
pub struct Reply {
    pub message: Value,
    pub error: Option<String>,
}

impl Reply {
    pub const fn message(message: Value) -> Self {
        Self {
            message,
            error: None,
        }
    }
    pub fn failed(message: &str) -> Self {
        Self {
            message: json!({}),
            error: Some(message.to_owned()),
        }
    }
}

fn fault(e: impl std::fmt::Display) -> Nack {
    tracing::error!(error = %e, "uhi inbound fault");
    Nack::unavailable("this hospital could not take the request right now")
}

#[tracing::instrument(skip_all, fields(action = %action))]
pub async fn receive(
    State(state): State<AppState>,
    Path((hospital, action)): Path<(String, String)>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    match handle(&state, &hospital, &action, &headers, &body).await {
        Ok(spec) => Json(spec.ack()).into_response(),
        Err(nack) => nack.into_response(),
    }
}

/// How the caller was authenticated: by the gateway (a fanned-out search),
/// or as the app itself, with the registry key ID it signed with.
enum Caller {
    Gateway,
    App(String),
}

async fn handle(
    state: &AppState,
    hospital: &str,
    action: &str,
    headers: &HeaderMap,
    body: &[u8],
) -> Result<GatewaySpec, Nack> {
    if !ACTIONS.contains(&action) {
        return Err(Nack::bad_request("unknown UHI action"));
    }
    let sub = subscription(state, hospital).await?;
    let secrets = state.secret_resolver.as_ref();
    let value: Value =
        serde_json::from_slice(body).map_err(|_| Nack::bad_request("the body is not JSON"))?;
    let ctx = Context::parse(&value)
        .map_err(|field| Nack::bad_request(&format!("context.{field} is missing")))?;
    if ctx.action != action {
        return Err(Nack::bad_request("context.action does not match the call"));
    }
    // The gateway forwards only searches; it re-serialises the body, so the
    // app's own signature could never verify on that hop.
    let caller =
        if action == "search" && auth::verify_gateway(secrets, &sub, headers, &ctx, body).await? {
            Caller::Gateway
        } else {
            Caller::App(auth::verify_app(secrets, &sub, headers, &ctx, body).await?)
        };
    if ctx
        .provider_id
        .as_deref()
        .is_some_and(|p| p != sub.subscriber() && p != sub.provider_id())
    {
        return Err(Nack::bad_request(
            "the request is addressed to another provider",
        ));
    }
    process(state, &sub, &ctx, &value, &caller).await?;
    Ok(sub.spec())
}

async fn subscription(state: &AppState, hospital: &str) -> Result<settings::Subscription, Nack> {
    let tenant: Option<Uuid> = sqlx::query_scalar("SELECT tenant_id FROM app_uhi_hspa_tenant($1)")
        .bind(hospital)
        .fetch_optional(&state.db)
        .await
        .map_err(fault)?;
    let not_here = || {
        Nack::unauthorized(
            ERR_NOT_REGISTERED,
            "no hospital here takes UHI calls at this address",
        )
    };
    let tenant_id = tenant.ok_or_else(not_here)?;
    let mut tx = state.db.begin().await.map_err(fault)?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id)
        .await
        .map_err(fault)?;
    let sub = settings::load(&mut tx, tenant_id).await.map_err(fault)?;
    tx.commit().await.map_err(fault)?;
    sub.ok_or_else(not_here)
}

async fn process(
    state: &AppState,
    sub: &settings::Subscription,
    ctx: &Context,
    body: &Value,
    caller: &Caller,
) -> Result<(), Nack> {
    let preview = settings::preview_enabled(state.secret_resolver.as_ref()).await;
    let mut tx = state.db.begin().await.map_err(fault)?;
    medbrains_db::pool::set_tenant_context(&mut tx, &sub.tenant_id)
        .await
        .map_err(fault)?;
    // Unpaid holds that ran out are let go first, so their slots read free.
    payment::expire_holds(&mut tx, state.secret_resolver.as_ref(), sub)
        .await
        .map_err(fault)?;
    let known: Option<String> = sqlx::query_scalar(
        "SELECT service FROM uhi_transactions \
          WHERE tenant_id = $1 AND bap_id = $2 AND transaction_id = $3 AND deleted_at IS NULL",
    )
    .bind(sub.tenant_id)
    .bind(&ctx.consumer_id)
    .bind(&ctx.transaction_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(fault)?;
    let service = known
        .as_deref()
        .and_then(Service::from_code)
        .or_else(|| Service::for_message(&ctx.domain, super::protocol::fulfilment_type(body)))
        .filter(|s| sub.offers(*s, preview));
    let Some(service) = service else {
        if ctx.action == "search" {
            return Ok(());
        }
        return Err(Nack::bad_request(
            "this hospital does not offer that service over UHI",
        ));
    };
    let key_id = match caller {
        Caller::App(key_id) => Some(key_id.as_str()),
        Caller::Gateway => None,
    };
    let txn = record(&mut tx, sub.tenant_id, ctx, service, body, key_id).await?;
    let reply = match service {
        Service::Teleconsultation | Service::PhysicalConsultation => {
            teleconsult::answer(
                &mut tx,
                state.secret_resolver.as_ref(),
                sub,
                ctx,
                body,
                &txn,
            )
            .await
        }
        Service::LabTests => labs::answer(&mut tx, sub, ctx, body, &txn).await,
        Service::BloodBank | Service::Ambulance => {
            requests::answer(&mut tx, sub, ctx, body, &txn).await
        }
    }
    .map_err(fault)?;
    if let Some(reply) = reply {
        let url = if matches!(caller, Caller::Gateway) {
            auth::gateway_on_search(state.secret_resolver.as_ref(), sub).await
        } else {
            format!(
                "{}/on_{}",
                ctx.consumer_uri.trim_end_matches('/'),
                ctx.action
            )
        };
        let body = answer_body(state.secret_resolver.as_ref(), sub, ctx, reply).await;
        let callback = Callback {
            transaction_row: txn.id,
            url,
            app_key_id: key_id.map(str::to_owned),
            body,
            idempotency_key: format!(
                "{}|{}|{}|{}",
                ctx.consumer_id, ctx.transaction_id, ctx.message_id, ctx.action
            ),
        };
        outbox::queue(&mut tx, sub.tenant_id, callback)
            .await
            .map_err(fault)?;
    }
    tx.commit().await.map_err(fault)?;
    Ok(())
}

pub async fn answer_body(
    secrets: &dyn SecretResolver,
    sub: &settings::Subscription,
    ctx: &Context,
    reply: Reply,
) -> Value {
    // Without the public address the context names us without a URI; the
    // settings screen says the address is missing.
    let uri = settings::provider_uri(secrets, &sub.hospital_code)
        .await
        .unwrap_or_default();
    let mut body = json!({
        "context": ctx.reply(sub.subscriber(), &uri),
        "message": reply.message,
    });
    if let Some(error) = reply.error {
        body["error"] = json!({ "type": "DOMAIN-ERROR", "code": super::protocol::ERR_BAD_REQUEST,
                                "path": "", "message": error });
    }
    body
}

/// Insert or move along the transaction row for this message.
async fn record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    ctx: &Context,
    service: Service,
    body: &Value,
    app_key_id: Option<&str>,
) -> Result<Txn, Nack> {
    // A gateway search is not the app's own word for its address; the key
    // that verified the last direct call is kept for the callback check.
    sqlx::query_as::<_, Txn>(
        "INSERT INTO uhi_transactions (tenant_id, service, domain, transaction_id, \
            last_message_id, last_action, bap_id, bap_uri, payload, bap_key_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         ON CONFLICT (tenant_id, bap_id, transaction_id) WHERE deleted_at IS NULL DO UPDATE SET \
            last_message_id = EXCLUDED.last_message_id, last_action = EXCLUDED.last_action, \
            bap_uri = EXCLUDED.bap_uri, payload = EXCLUDED.payload, \
            bap_key_id = COALESCE(EXCLUDED.bap_key_id, uhi_transactions.bap_key_id) \
         RETURNING id, service, state, order_details, appointment_id, payment_transaction_id",
    )
    .bind(tenant_id)
    .bind(service.code())
    .bind(&ctx.domain)
    .bind(&ctx.transaction_id)
    .bind(&ctx.message_id)
    .bind(&ctx.action)
    .bind(&ctx.consumer_id)
    .bind(&ctx.consumer_uri)
    .bind(body)
    .bind(app_key_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(fault)
}

/// Move a transaction to `state`, keeping the order as last sent.
///
/// # Errors
/// A database fault.
pub async fn set_state(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_id: Uuid,
    state: &str,
    order: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE uhi_transactions SET state = $2, order_details = $3, \
                confirmed_at = CASE WHEN $2 IN ('awaiting_payment', 'pending', 'confirmed') \
                                    THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END \
          WHERE id = $1",
    )
    .bind(txn_id)
    .bind(state)
    .bind(order)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
