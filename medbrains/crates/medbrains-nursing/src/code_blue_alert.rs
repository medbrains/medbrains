//! The emergency page, delivered — or visibly not.
//!
//! `emergency.code_blue_alert` had no handler. The outbox sent it to the
//! pipeline fallback, which found nothing to do and marked it `sent`, so a
//! hospital without SMS believed its crash team had been texted; and the
//! floor codes (Code Pink, Red, …) paged nobody. This pages one round of a
//! code blue or a floor code: an in-app alert to everyone the round reaches
//! (the phone apps flash on it), an SMS and a `WhatsApp` where the hospital
//! has them set up, a `code_blue_pages` row per person, and a line on the
//! code's screen saying who was reached and what did not go out.
//!
//! Round 1 runs twice by design: inline, right after the code is recorded,
//! so the in-app alarm needs no outbox hop; and from the outbox row queued in
//! the same transaction, which is the durable copy. Both are idempotent.
//!
//! The outbox row ends `sent` only when a message left the building. In-app
//! alone is `undelivered`, with the reason the screen shows; and a round that
//! reached nobody also alerts the nurse in charge and the administrators.

use async_trait::async_trait;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use medbrains_core::secrets::SecretResolver;
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::{twilio, whatsapp};
use medbrains_outbox::queue::{OutboxRow, queue_in_tx};
use medbrains_server_core::error::AppError;
use medbrains_workflow::orchestration::default_pipelines::{CODE_BLUE_ALERT_EVENT, e164};

use crate::code_blue_routing::{self, TeamSource, code_words, current_shift, tenant_local_now};
use crate::code_blue_subject::Subject;

/// The per-person SMS a round queues.
pub const SMS_EVENT: &str = "sms.code_blue_alert";
/// The per-person `WhatsApp` a round queues (Meta template `code_blue_alert`).
pub const WHATSAPP_EVENT: &str = "whatsapp.code_blue_alert";
/// Administrators told when a round reached nobody.
const ADMIN_LIMIT: i64 = 20;

/// Which outside channels the hospital has set up.
#[derive(Debug, Clone, Copy, Default)]
pub struct Channels {
    pub sms: bool,
    pub whatsapp: bool,
}

/// Ask the credential store which channels would really send.
pub async fn channels(resolver: &dyn SecretResolver) -> Channels {
    Channels {
        sms: twilio::is_configured(resolver).await,
        whatsapp: whatsapp::is_configured(resolver).await,
    }
}

/// What one round did.
#[derive(Debug)]
pub struct PageOutcome {
    pub source: TeamSource,
    pub reached: usize,
    pub newly_paged: usize,
    pub messages_queued: usize,
    pub warning: Option<String>,
    /// The code had already ended: nothing to page.
    pub ended: bool,
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
        let subject = Subject::from_payload(payload).ok_or_else(|| {
            HandlerError::Permanent("payload names no code_blue_id or er_code_id".to_owned())
        })?;
        let round = payload
            .get("round")
            .and_then(Value::as_i64)
            .and_then(|r| i16::try_from(r).ok())
            .unwrap_or(1);
        let channels = channels(ctx.secret_resolver.as_ref()).await;
        let outcome = page_round(&ctx.pool, ctx.tenant_id, (subject, round), channels)
            .await
            .map_err(|e| match e {
                AppError::NotFound => HandlerError::Permanent("code not found".to_owned()),
                e => HandlerError::Transient(e.to_string()),
            })?;
        handler_result(&outcome)
    }
}

/// Page round 1 now, inline, after the code is committed. A failure is
/// logged and left to the outbox copy of the same round, never raised to the
/// nurse whose code is already recorded.
pub async fn page_now(
    pool: &PgPool,
    tenant_id: Uuid,
    subject: Subject,
    resolver: &dyn SecretResolver,
) {
    let channels = channels(resolver).await;
    if let Err(error) = page_round(pool, tenant_id, (subject, 1), channels).await {
        tracing::error!(%tenant_id, ?subject, %error, "inline emergency page failed; the outbox will retry");
    }
}

/// The outbox answer for a round: `sent` only when a message was queued.
fn handler_result(outcome: &PageOutcome) -> Result<Value, HandlerError> {
    if outcome.ended {
        return Ok(json!({ "skipped": "the code had already ended" }));
    }
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

/// What the code's screen warns about a round's delivery, if anything.
pub fn delivery_warning(reached: usize, channels: Channels, phones: usize) -> Option<String> {
    if reached == 0 {
        return Some(
            "Alert not delivered: nobody could be paged. Call the team by phone.".to_owned(),
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

/// The page title: `CODE BLUE`, `CODE PINK`, …; the stand-down finds the
/// paged users by it.
fn title(code_type: &str) -> String {
    code_words(code_type).to_uppercase()
}

/// Page one round of a code in one transaction. Idempotent: a redelivered
/// round pages nobody twice and queues no message twice.
pub async fn page_round(
    pool: &PgPool,
    tenant_id: Uuid,
    (subject, round): (Subject, i16),
    channels: Channels,
) -> Result<PageOutcome, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let code = subject.load(&mut tx, tenant_id).await?;
    if code.ended {
        return Ok(PageOutcome {
            source: TeamSource::Nobody,
            reached: 0,
            newly_paged: 0,
            messages_queued: 0,
            warning: None,
            ended: true,
        });
    }
    let routing = code_blue_routing::resolve(
        &mut tx,
        tenant_id,
        (code.code_type.as_str(), code.place()),
        round,
    )
    .await?;
    let where_it_is = match code.location.trim() {
        "" => "location not recorded",
        loc => loc,
    };
    let title = title(&code.code_type);
    let body = format!("{title} — {where_it_is}. Respond immediately.");

    let newly = record_pages(&mut tx, tenant_id, (subject, round), &routing).await?;
    notify(&mut tx, tenant_id, subject, &newly, (&title, &body)).await?;
    let paged: Vec<Uuid> = routing.recipients.iter().map(|r| r.user_id).collect();
    let phones = phones_of(&mut tx, tenant_id, &paged).await?;
    let mut queued = 0;
    for to in &phones {
        queued +=
            queue_messages(&mut tx, tenant_id, (subject, round), (to, &body), channels).await?;
    }

    let warning = delivery_warning(paged.len(), channels, phones.len());
    subject
        .record_status(&mut tx, tenant_id, (&routing.note, warning.as_deref()))
        .await?;
    if paged.is_empty() {
        alert_not_delivered(&mut tx, tenant_id, subject, &code).await?;
        tracing::error!(%tenant_id, ?subject, round, "emergency code paged nobody");
    }
    tx.commit().await?;

    Ok(PageOutcome {
        source: routing.source,
        reached: paged.len(),
        newly_paged: newly.len(),
        messages_queued: queued,
        warning,
        ended: false,
    })
}

/// One `code_blue_pages` row per person for the round; returns those not
/// already paged in it.
async fn record_pages(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    (subject, round): (Subject, i16),
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
    let (code_blue_id, er_code_id) = subject.page_columns();
    Ok(sqlx::query_scalar(
        "INSERT INTO code_blue_pages \
           (tenant_id, code_blue_id, er_code_id, round, tier, user_id, routing) \
         SELECT $1, $2, $3, $4, t.tier, t.user_id, t.routing \
           FROM unnest($5::uuid[], $6::int2[], $7::text[]) AS t(user_id, tier, routing) \
         ON CONFLICT DO NOTHING \
         RETURNING user_id",
    )
    .bind(tenant_id)
    .bind(code_blue_id)
    .bind(er_code_id)
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
    subject: Subject,
    users: &[Uuid],
    (title, body): (&str, &str),
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, u, 'error', $2, $3, 'emergency', $4, $5, $6 \
           FROM unnest($7::uuid[]) AS u",
    )
    .bind(tenant_id)
    .bind(title)
    .bind(body)
    .bind(subject.aggregate())
    .bind(subject.id())
    .bind(subject.action_url())
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
    (subject, round): (Subject, i16),
    (to, body): (&str, &str),
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
    let key = format!("{}:{}:r{round}:{to}", subject.aggregate(), subject.id());
    for (event_type, payload) in rows {
        queue_in_tx(
            tx,
            OutboxRow {
                tenant_id,
                aggregate_type: subject.aggregate(),
                aggregate_id: Some(subject.id()),
                event_type,
                payload,
                idempotency_key: Some(key.clone()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("emergency message not queued: {e}")))?;
    }
    Ok(count)
}

/// Nobody could be paged: tell the person who called it, the ward's charge
/// nurse on the current shift and the administrators, once per code.
async fn alert_not_delivered(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    subject: Subject,
    code: &crate::code_blue_subject::CodeContext,
) -> Result<(), AppError> {
    let (shift_date, shift) = current_shift(tenant_local_now(tx, tenant_id).await?);
    let title = format!("{} alert not delivered", title(&code.code_type));
    sqlx::query(
        "WITH told AS ( \
           SELECT $4::uuid AS id WHERE $4::uuid IS NOT NULL \
           UNION SELECT nsa.charge_nurse_user_id FROM nurse_shift_assignments nsa \
            WHERE nsa.tenant_id = $1 AND nsa.ward_id = $5 AND nsa.deleted_at IS NULL \
              AND nsa.charge_nurse_user_id IS NOT NULL \
              AND nsa.shift_date = $9 AND nsa.shift_type = $10 \
           UNION (SELECT u.id FROM users u WHERE u.tenant_id = $1 AND u.is_active = true \
                    AND u.deleted_at IS NULL \
                    AND u.role::text IN ('hospital_admin', 'super_admin') LIMIT $6) \
         ) \
         INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, told.id, 'error', $2, $3, 'emergency', $8, $7, $11 \
           FROM told \
          WHERE NOT EXISTS (SELECT 1 FROM notifications n \
                             WHERE n.tenant_id = $1 AND n.user_id = told.id \
                               AND n.entity_type = $8 AND n.entity_id = $7 \
                               AND n.title = $2)",
    )
    .bind(tenant_id)
    .bind(&title)
    .bind(format!(
        "A {} was called and nobody could be paged. Call the team by phone and set up the \
         responder roster.",
        code_words(&code.code_type)
    ))
    .bind(code.recorder_user_id)
    .bind(code.ward_id)
    .bind(ADMIN_LIMIT)
    .bind(subject.id())
    .bind(subject.aggregate())
    .bind(shift_date)
    .bind(shift)
    .bind(subject.action_url())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        Channels, HandlerError, PageOutcome, TeamSource, delivery_warning, handler_result, title,
    };

    fn outcome(messages_queued: usize, warning: Option<&str>) -> PageOutcome {
        PageOutcome {
            source: TeamSource::Roster,
            reached: 3,
            newly_paged: 3,
            messages_queued,
            warning: warning.map(str::to_owned),
            ended: false,
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

    #[test]
    fn a_page_after_the_stand_down_is_skipped_not_undelivered() {
        let ended = PageOutcome {
            ended: true,
            ..outcome(0, None)
        };
        assert!(handler_result(&ended).is_ok_and(|v| v["skipped"].is_string()));
        assert_eq!(title("code_pink"), "CODE PINK");
    }
}
