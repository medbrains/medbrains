//! The code blue page, delivered — or visibly not.
//!
//! `emergency.code_blue_alert` had no handler. The outbox sent it to the
//! pipeline fallback, which found nothing to do and marked it `sent`, so a
//! hospital without SMS believed its crash team had been texted. This handler
//! does the paging for one round: an in-app alert to everyone the round
//! reaches (the phone apps flash on it), an SMS and a `WhatsApp` where the
//! hospital has them set up, a `code_blue_pages` row per person, and a line on
//! the code-blue screen saying who was reached and what did not go out.
//!
//! The row ends `sent` only when a message left the building. In-app alone is
//! `undelivered`, with the reason the screen shows; and a round that reached
//! nobody also alerts the nurse in charge and the administrators.

use async_trait::async_trait;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::{twilio, whatsapp};
use medbrains_outbox::queue::{OutboxRow, queue_in_tx};
use medbrains_server_core::error::AppError;
use medbrains_workflow::orchestration::default_pipelines::{CODE_BLUE_ALERT_EVENT, e164};

use crate::code_blue_routing::{self, Place, TeamSource};

/// The per-person SMS a round queues.
pub const SMS_EVENT: &str = "sms.code_blue_alert";
/// The per-person `WhatsApp` a round queues (Meta template `code_blue_alert`).
pub const WHATSAPP_EVENT: &str = "whatsapp.code_blue_alert";
/// Title every page carries; the stand-down finds the paged users by it.
const PAGE_TITLE: &str = "CODE BLUE";
const NOT_DELIVERED_TITLE: &str = "Code blue alert not delivered";
/// Administrators told when a round reached nobody.
const ADMIN_LIMIT: i64 = 20;

/// Which outside channels the hospital has set up.
#[derive(Debug, Clone, Copy, Default)]
pub struct Channels {
    pub sms: bool,
    pub whatsapp: bool,
}

/// What one round did.
#[derive(Debug)]
pub struct PageOutcome {
    pub source: TeamSource,
    pub reached: usize,
    pub newly_paged: usize,
    pub messages_queued: usize,
    pub warning: Option<String>,
}

/// Registered for [`CODE_BLUE_ALERT_EVENT`] in the outbox registry.
#[derive(Debug)]
pub struct CodeBlueAlertHandler;

#[async_trait]
impl Handler for CodeBlueAlertHandler {
    /// The event this handler owns.
    fn event_type(&self) -> &'static str {
        CODE_BLUE_ALERT_EVENT
    }

    /// Page one round and answer `sent` only if a message left the building.
    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let code_blue_id = payload
            .get("code_blue_id")
            .and_then(Value::as_str)
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| HandlerError::Permanent("payload.code_blue_id missing".to_owned()))?;
        let round = payload
            .get("round")
            .and_then(Value::as_i64)
            .and_then(|r| i16::try_from(r).ok())
            .unwrap_or(1);
        let channels = Channels {
            sms: twilio::is_configured(ctx.secret_resolver.as_ref()).await,
            whatsapp: whatsapp::is_configured(ctx.secret_resolver.as_ref()).await,
        };
        let outcome = page_round(&ctx.pool, ctx.tenant_id, code_blue_id, round, channels)
            .await
            .map_err(|e| match e {
                AppError::NotFound => HandlerError::Permanent("code blue not found".to_owned()),
                e => HandlerError::Transient(e.to_string()),
            })?;
        handler_result(&outcome)
    }
}

/// The outbox answer for a round: `sent` only when a message was queued.
fn handler_result(outcome: &PageOutcome) -> Result<Value, HandlerError> {
    if outcome.messages_queued == 0 {
        return Err(HandlerError::Undelivered(
            outcome
                .warning
                .clone()
                .unwrap_or_else(|| "no message left the building".to_owned()),
        ));
    }
    Ok(json!({
        "routing": outcome.source.as_str(),
        "reached": outcome.reached,
        "in_app": outcome.newly_paged,
        "messages_queued": outcome.messages_queued,
    }))
}

/// What the code-blue screen warns about a round's delivery, if anything.
pub fn delivery_warning(reached: usize, channels: Channels, phones: usize) -> Option<String> {
    if reached == 0 {
        return Some(
            "Alert not delivered: nobody could be paged. Call the code team by phone.".to_owned(),
        );
    }
    if !channels.sms && !channels.whatsapp {
        return Some("SMS is not set up: only in-app alerts went out".to_owned());
    }
    if phones == 0 {
        return Some(
            "No phone numbers on file for the people paged: only in-app alerts went out".to_owned(),
        );
    }
    None
}

#[derive(sqlx::FromRow)]
struct CodeContext {
    location: String,
    recorder_user_id: Option<Uuid>,
    ended: bool,
    ward_id: Option<Uuid>,
    department_id: Option<Uuid>,
}

/// Page round `round` of a code blue in one transaction. Idempotent: a
/// redelivered round pages nobody twice and queues no message twice.
pub async fn page_round(
    pool: &PgPool,
    tenant_id: Uuid,
    code_blue_id: Uuid,
    round: i16,
    channels: Channels,
) -> Result<PageOutcome, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let code = sqlx::query_as::<_, CodeContext>(
        "SELECT e.location, e.recorder_user_id, e.ended_at IS NOT NULL AS ended, \
                a.ward_id, a.department_id \
           FROM code_blue_events e \
           LEFT JOIN LATERAL ( \
             SELECT ad.ward_id, ad.department_id FROM admissions ad \
              WHERE ad.tenant_id = e.tenant_id AND ad.encounter_id = e.encounter_id \
              ORDER BY ad.admitted_at DESC LIMIT 1) a ON true \
          WHERE e.id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL",
    )
    .bind(code_blue_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if code.ended {
        return Ok(PageOutcome {
            source: TeamSource::Nobody,
            reached: 0,
            newly_paged: 0,
            messages_queued: 0,
            warning: Some("the code blue had already ended".to_owned()),
        });
    }

    let place = Place {
        ward_id: code.ward_id,
        department_id: code.department_id,
    };
    let routing = code_blue_routing::resolve(&mut tx, tenant_id, place, round).await?;
    let where_it_is = match code.location.trim() {
        "" => "location not recorded",
        loc => loc,
    };
    let body = format!("CODE BLUE — {where_it_is}. Respond immediately.");

    let newly = record_pages(&mut tx, tenant_id, code_blue_id, round, &routing).await?;
    notify(&mut tx, tenant_id, code_blue_id, &newly, &body).await?;
    let paged: Vec<Uuid> = routing.recipients.iter().map(|r| r.user_id).collect();
    let phones = phones_of(&mut tx, tenant_id, &paged).await?;
    let mut queued = 0;
    for to in &phones {
        queued += queue_messages(
            &mut tx,
            tenant_id,
            (code_blue_id, round),
            to,
            &body,
            channels,
        )
        .await?;
    }

    let warning = delivery_warning(paged.len(), channels, phones.len());
    sqlx::query(
        "UPDATE code_blue_events SET routing_note = $3, delivery_warning = $4 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(code_blue_id)
    .bind(tenant_id)
    .bind(&routing.note)
    .bind(&warning)
    .execute(&mut *tx)
    .await?;
    if paged.is_empty() {
        alert_not_delivered(
            &mut tx,
            tenant_id,
            code_blue_id,
            place.ward_id,
            code.recorder_user_id,
        )
        .await?;
        tracing::error!(%tenant_id, %code_blue_id, round, "code blue paged nobody");
    }
    tx.commit().await?;

    Ok(PageOutcome {
        source: routing.source,
        reached: paged.len(),
        newly_paged: newly.len(),
        messages_queued: queued,
        warning,
    })
}

/// One `code_blue_pages` row per person for the round; returns those not
/// already paged in it.
async fn record_pages(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code_blue_id: Uuid,
    round: i16,
    routing: &code_blue_routing::Routing,
) -> Result<Vec<Uuid>, AppError> {
    let users: Vec<Uuid> = routing.recipients.iter().map(|r| r.user_id).collect();
    let tiers: Vec<i16> = routing.recipients.iter().map(|r| r.tier).collect();
    let source = routing.source.as_str();
    let routes: Vec<&str> = routing
        .recipients
        .iter()
        .map(|r| if r.tier == 1 { source } else { "roster" })
        .collect();
    Ok(sqlx::query_scalar(
        "INSERT INTO code_blue_pages (tenant_id, code_blue_id, round, tier, user_id, routing) \
         SELECT $1, $2, $3, t.tier, t.user_id, t.routing \
           FROM unnest($4::uuid[], $5::int2[], $6::text[]) AS t(user_id, tier, routing) \
         ON CONFLICT (tenant_id, code_blue_id, round, user_id) DO NOTHING \
         RETURNING user_id",
    )
    .bind(tenant_id)
    .bind(code_blue_id)
    .bind(round)
    .bind(&users)
    .bind(&tiers)
    .bind(&routes)
    .fetch_all(&mut **tx)
    .await?)
}

/// The in-app page, which the web shell and the phone apps raise as an alarm.
async fn notify(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code_blue_id: Uuid,
    users: &[Uuid],
    body: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, u, 'error', $2, $3, 'emergency', 'code_blue', $4, '/nurse?tab=code-blue' \
           FROM unnest($5::uuid[]) AS u",
    )
    .bind(tenant_id)
    .bind(PAGE_TITLE)
    .bind(body)
    .bind(code_blue_id)
    .bind(users)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Usable E.164 numbers of the paged people, deduplicated.
async fn phones_of(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    users: &[Uuid],
) -> Result<Vec<String>, AppError> {
    let raw: Vec<String> = sqlx::query_scalar(
        "SELECT phone FROM users \
          WHERE tenant_id = $1 AND id = ANY($2) AND phone IS NOT NULL AND phone <> ''",
    )
    .bind(tenant_id)
    .bind(users)
    .fetch_all(&mut **tx)
    .await?;
    let mut phones: Vec<String> = raw.iter().filter_map(|p| e164(p)).collect();
    phones.sort_unstable();
    phones.dedup();
    Ok(phones)
}

/// Queue the SMS and the `WhatsApp` for one number on the channels set up.
/// Returns how many were queued; keyed so a redelivered round queues none.
async fn queue_messages(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    (code_blue_id, round): (Uuid, i16),
    to: &str,
    body: &str,
    channels: Channels,
) -> Result<usize, AppError> {
    let mut rows = Vec::new();
    if channels.sms {
        rows.push((SMS_EVENT, json!({ "to": to, "body": body })));
    }
    if channels.whatsapp {
        rows.push((
            WHATSAPP_EVENT,
            json!({
                "to": to,
                "template_name": "code_blue_alert",
                "language": "en",
                "components": [{ "type": "body", "parameters": [{ "type": "text", "text": body }] }],
            }),
        ));
    }
    let count = rows.len();
    for (event_type, payload) in rows {
        queue_in_tx(
            tx,
            OutboxRow {
                tenant_id,
                aggregate_type: "code_blue",
                aggregate_id: Some(code_blue_id),
                event_type,
                payload,
                idempotency_key: Some(format!("code_blue:{code_blue_id}:r{round}:{to}")),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("code blue message not queued: {e}")))?;
    }
    Ok(count)
}

/// Nobody could be paged: tell the nurse who called it, the ward's charge
/// nurse and the administrators, once per code.
async fn alert_not_delivered(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code_blue_id: Uuid,
    ward_id: Option<Uuid>,
    recorder: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query(
        "WITH told AS ( \
           SELECT $4::uuid AS id WHERE $4::uuid IS NOT NULL \
           UNION SELECT nsa.charge_nurse_user_id FROM nurse_shift_assignments nsa \
            WHERE nsa.tenant_id = $1 AND nsa.ward_id = $5 AND nsa.deleted_at IS NULL \
              AND nsa.charge_nurse_user_id IS NOT NULL AND nsa.shift_date = CURRENT_DATE \
           UNION (SELECT u.id FROM users u WHERE u.tenant_id = $1 AND u.is_active = true \
                    AND u.role::text IN ('hospital_admin', 'super_admin') LIMIT $6) \
         ) \
         INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, told.id, 'error', $2, $3, 'emergency', 'code_blue', $7, \
                '/nurse?tab=code-blue' \
           FROM told \
          WHERE NOT EXISTS (SELECT 1 FROM notifications n \
                             WHERE n.tenant_id = $1 AND n.user_id = told.id \
                               AND n.entity_type = 'code_blue' AND n.entity_id = $7 \
                               AND n.title = $2)",
    )
    .bind(tenant_id)
    .bind(NOT_DELIVERED_TITLE)
    .bind("A code blue was called and nobody could be paged: no code team, no ward shift and no clinicians. Call the team by phone and set up the code-blue roster.")
    .bind(recorder)
    .bind(ward_id)
    .bind(ADMIN_LIMIT)
    .bind(code_blue_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        Channels, HandlerError, PageOutcome, TeamSource, delivery_warning, handler_result,
    };

    fn outcome(messages_queued: usize, warning: Option<&str>) -> PageOutcome {
        PageOutcome {
            source: TeamSource::Roster,
            reached: 3,
            newly_paged: 3,
            messages_queued,
            warning: warning.map(str::to_owned),
        }
    }

    #[test]
    fn in_app_alone_is_not_sent() {
        let warn = delivery_warning(3, Channels::default(), 3);
        assert_eq!(
            warn.as_deref(),
            Some("SMS is not set up: only in-app alerts went out")
        );
        let Err(HandlerError::Undelivered(why)) = handler_result(&outcome(0, warn.as_deref()))
        else {
            panic!("an alert that only went in-app must not be marked sent");
        };
        assert!(why.starts_with("SMS is not set up"), "{why}");
    }

    #[test]
    fn a_queued_message_is_sent_and_nobody_reached_is_said_in_words() {
        assert!(handler_result(&outcome(2, None)).is_ok());
        let sms = Channels {
            sms: true,
            whatsapp: false,
        };
        assert!(delivery_warning(3, sms, 3).is_none());
        assert!(delivery_warning(3, sms, 0).is_some_and(|w| w.starts_with("No phone numbers")));
        assert!(delivery_warning(0, sms, 0).is_some_and(|w| w.starts_with("Alert not delivered")));
    }
}
