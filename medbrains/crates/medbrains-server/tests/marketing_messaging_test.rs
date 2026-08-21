mod common;

use uuid::Uuid;

fn mobile(prefix: &str) -> String {
    let digits: String = Uuid::new_v4().as_u128().to_string().chars().take(8).collect();
    format!("{prefix}{digits}")
}

/// An inbound WhatsApp message does not grant consent to send campaigns.
///
/// It is tempting to set `consent_whatsapp` when somebody messages the
/// hospital — they started the conversation, so replying is obviously fine.
/// Replying IS fine; the platform session window exists for exactly that.
///
/// But consent under the DPDP Act is consent to a stated purpose, and
/// "answering the question I asked" is not "sending me campaigns". A person
/// asking about visiting hours has not agreed to a reactivation drive six
/// months later. A system that quietly converts one into the other builds a
/// marketing list out of people who never opted into one, and every message
/// that arrives makes the list bigger without anybody deciding anything.
///
/// So this asserts the flags stay false. It is the cheapest possible test and
/// it guards the most expensive possible mistake.
#[tokio::test]
async fn an_inbound_message_does_not_grant_marketing_consent() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let phone = mobile("94");
    let e164 = format!("+91{phone}");

    let resp = app
        .client
        .post(app.url("/api/marketing/messaging/messages"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "message_id": format!("wa-{}", Uuid::new_v4()),
            "channel": "whatsapp",
            "direction": "inbound",
            "counterparty": phone,
            "body": "What are your visiting hours?",
            "occurred_at": "2026-08-21T09:00:00Z",
        }))
        .send()
        .await
        .expect("message webhook");
    assert_eq!(resp.status(), reqwest::StatusCode::ACCEPTED);

    let consents: (bool, bool, bool) = sqlx::query_as(
        "SELECT c.consent_call, c.consent_sms, c.consent_whatsapp \
         FROM mkt_contact_identities i \
         JOIN mkt_contacts c ON c.id = i.contact_id \
         WHERE i.channel = 'whatsapp' AND i.value = $1",
    )
    .bind(&e164)
    .fetch_one(&app.db)
    .await
    .expect("the contact the message created");

    assert_eq!(
        consents,
        (false, false, false),
        "writing in is not opting in — consent is captured where it is given, \
         with a source and a timestamp"
    );
}

/// A replayed provider message id creates nothing further.
///
/// Same mechanism as the call path and the same reason: providers retry
/// anything that did not return 2xx. A duplicated message would show the agent
/// the patient asking twice, which reads as impatience and is the system's
/// fault.
#[tokio::test]
async fn a_replayed_message_creates_nothing_further() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let phone = mobile("93");
    let message_id = format!("wa-{}", Uuid::new_v4());
    let payload = serde_json::json!({
        "message_id": message_id,
        "channel": "whatsapp",
        "direction": "inbound",
        "counterparty": phone,
        "body": "Is Dr Rao available on Friday?",
        "occurred_at": "2026-08-21T09:05:00Z",
    });

    let post = || {
        app.client
            .post(app.url("/api/marketing/messaging/messages"))
            .header("x-csrf-token", &csrf)
            .json(&payload)
            .send()
    };

    let first: serde_json::Value = post().await.expect("first").json().await.expect("json");
    let second: serde_json::Value = post().await.expect("retry").json().await.expect("json");
    assert_eq!(
        first["interaction_id"], second["interaction_id"],
        "a replay returns the interaction the first delivery created"
    );

    let rows: i64 =
        sqlx::query_scalar("SELECT count(*) FROM mkt_interactions WHERE external_ref = $1")
            .bind(&message_id)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(rows, 1, "one message, one timeline row");
}

/// An unknown channel is refused rather than defaulted to SMS.
///
/// Defaulting would send a WhatsApp thread down the DLT-registered template
/// path, where an unregistered template is dropped silently at the carrier —
/// so the wrong guess produces no error anywhere and no message either.
#[tokio::test]
async fn an_unknown_message_channel_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .client
        .post(app.url("/api/marketing/messaging/messages"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "message_id": format!("tg-{}", Uuid::new_v4()),
            "channel": "telegram",
            "direction": "inbound",
            "counterparty": "9840012345",
            "occurred_at": "2026-08-21T09:10:00Z",
        }))
        .send()
        .await
        .expect("message webhook");

    assert_eq!(resp.status(), reqwest::StatusCode::BAD_REQUEST);
}
