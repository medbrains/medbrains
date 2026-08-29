mod common;

use uuid::Uuid;

/// A retried webhook must not book a second callback.
///
/// Every telephony provider retries anything that did not return 2xx, and an
/// AMI reconnect replays events across the gap. If ingestion were not
/// idempotent, the same missed call would land twice — and the second landing
/// is not a harmless duplicate row, because `ingest_call` raises a callback
/// task for a missed call. A retry would put the same person in somebody's
/// queue twice and inflate the missed-call rate, which is the one number this
/// module is sold on and the headline of the enquiry audit.
///
/// The test drives the real HTTP endpoint rather than the function, because
/// what a provider retries is a request.
#[tokio::test]
async fn a_replayed_call_webhook_creates_nothing_further() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // A number nobody else in the test database will collide with.
    let suffix: String = Uuid::new_v4().as_u128().to_string().chars().take(8).collect();
    let caller = format!("98{suffix}");
    let call_id = format!("test-call-{}", Uuid::new_v4());

    let payload = serde_json::json!({
        "call_id": call_id,
        "direction": "inbound",
        "from": caller,
        "outcome": "no_answer",
        "started_at": "2026-08-21T09:15:00Z",
    });

    let post = || {
        app.client
            .post(app.url("/api/marketing/telephony/calls"))
            .header("X-CSRF-Token", &csrf)
            .json(&payload)
            .send()
    };

    let first = post().await.expect("first webhook");
    assert_eq!(first.status(), reqwest::StatusCode::ACCEPTED, "first delivery");
    let first_id: Uuid = first
        .json::<serde_json::Value>()
        .await
        .expect("json")
        .get("interaction_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .expect("interaction_id");

    let second = post().await.expect("retried webhook");
    assert_eq!(second.status(), reqwest::StatusCode::ACCEPTED, "retry");
    let second_id: Uuid = second
        .json::<serde_json::Value>()
        .await
        .expect("json")
        .get("interaction_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok())
        .expect("interaction_id");

    assert_eq!(
        first_id, second_id,
        "a replay must return the interaction the first delivery created"
    );

    let interactions: i64 =
        sqlx::query_scalar("SELECT count(*) FROM mkt_interactions WHERE external_ref = $1")
            .bind(&call_id)
            .fetch_one(&app.db)
            .await
            .expect("count interactions");
    assert_eq!(interactions, 1, "one call, one interaction");

    // The number the product is sold on. Two callback tasks for one missed
    // call is the failure this index exists to prevent.
    let callbacks: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_tasks t \
         JOIN mkt_contacts c ON c.id = t.contact_id \
         WHERE c.primary_phone = $1 AND t.kind = 'callback'",
    )
    .bind(format!("+91{caller}"))
    .fetch_one(&app.db)
    .await
    .expect("count callbacks");
    assert_eq!(callbacks, 1, "one missed call, one callback task");
}

/// The same number written four ways is one contact.
///
/// Contact resolution is a single indexed lookup on the normalised value, so
/// the screen-pop is fast — and that makes the stored form load-bearing. If a
/// call from `+91 98400 12345` and one from `09840012345` created two rows,
/// the returning caller would reach an agent holding a stranger's history,
/// which is the failure this product exists to fix.
#[tokio::test]
async fn the_same_caller_dialling_in_two_formats_is_one_contact() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let suffix: String = Uuid::new_v4().as_u128().to_string().chars().take(8).collect();
    let bare = format!("97{suffix}");
    let e164 = format!("+91{bare}");
    let with_zero = format!("0{bare}");

    for (i, number) in [bare.as_str(), with_zero.as_str(), e164.as_str()]
        .iter()
        .enumerate()
    {
        let resp = app
            .client
            .post(app.url("/api/marketing/telephony/calls"))
            .header("X-CSRF-Token", &csrf)
            .json(&serde_json::json!({
                "call_id": format!("fmt-{i}-{}", Uuid::new_v4()),
                "direction": "inbound",
                "from": number,
                "outcome": "answered",
                "started_at": "2026-08-21T10:00:00Z",
                "duration_secs": 42,
            }))
            .send()
            .await
            .expect("webhook");
        assert_eq!(resp.status(), reqwest::StatusCode::ACCEPTED, "format {number}");
    }

    let contacts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM mkt_contacts WHERE primary_phone = $1")
            .bind(&e164)
            .fetch_one(&app.db)
            .await
            .expect("count contacts");
    assert_eq!(contacts, 1, "three formats, one contact");

    let interactions: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_interactions i \
         JOIN mkt_contacts c ON c.id = i.contact_id \
         WHERE c.primary_phone = $1",
    )
    .bind(&e164)
    .fetch_one(&app.db)
    .await
    .expect("count interactions");
    assert_eq!(interactions, 3, "three calls on the one contact's timeline");
}

/// An outcome this module does not recognise is refused, not assumed answered.
///
/// A provider word silently treated as "answered" would erase exactly the
/// calls the missed-call rate exists to count — the failure would be invisible
/// and would look like good news.
#[tokio::test]
async fn an_unknown_outcome_is_rejected_rather_than_counted_as_answered() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .client
        .post(app.url("/api/marketing/telephony/calls"))
        .header("X-CSRF-Token", &csrf)
        .json(&serde_json::json!({
            "call_id": format!("bad-{}", Uuid::new_v4()),
            "direction": "inbound",
            "from": "9840099999",
            "outcome": "voicemail",
            "started_at": "2026-08-21T11:00:00Z",
        }))
        .send()
        .await
        .expect("webhook");

    assert_eq!(resp.status(), reqwest::StatusCode::BAD_REQUEST);
}

/// An inbound call becomes a channel, and a repeat caller stays one channel.
///
/// `missed_call` and `inbound_call` were both in the touchpoint vocabulary and
/// nothing wrote either, so a hospital whose enquiries arrive almost entirely
/// by telephone had a channel report with no telephone in it. A missed call
/// especially — somebody rings once, hangs up and expects to be rung back — is
/// India's dominant zero-cost inbound primitive, and it was invisible.
///
/// The second assertion is the one that matters. Ten calls must not become ten
/// touchpoints: the journey report reads first and second touchpoint, and a
/// repeat caller producing "phone → phone" would bury the hoarding that
/// actually opened the relationship. Every individual call is already on
/// `mkt_interactions`.
#[tokio::test]
async fn a_missed_call_is_a_channel_and_calling_twice_is_still_one() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let suffix: String = Uuid::new_v4().as_u128().to_string().chars().take(8).collect();
    let caller = format!("97{suffix}");

    // Two distinct calls from one person — different call ids, so idempotency
    // does not do the work the dedupe is being tested for.
    for _ in 0..2 {
        let res = app
            .client
            .post(app.url("/api/marketing/telephony/calls"))
            .header("X-CSRF-Token", &csrf)
            .json(&serde_json::json!({
                "call_id": format!("test-call-{}", Uuid::new_v4()),
                "direction": "inbound",
                "from": caller,
                "outcome": "no_answer",
                "started_at": "2026-08-21T09:15:00Z",
            }))
            .send()
            .await
            .expect("ingest call");
        assert!(res.status().is_success(), "ingest rejected: {:?}", res.status());
    }

    let contact_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM mkt_contacts WHERE tenant_id = $1 AND primary_phone = $2",
    )
    .bind(tenant_id)
    .bind(format!("+91{caller}"))
    .fetch_one(&app.db)
    .await
    .expect("the caller must have a contact");

    let kinds: Vec<String> = sqlx::query_scalar(
        "SELECT kind FROM mkt_touchpoints WHERE contact_id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read touchpoints");

    assert_eq!(
        kinds,
        vec!["missed_call".to_owned()],
        "an unanswered inbound call is a missed_call channel, and ringing \
         twice is still one channel — ten calls must not become ten touchpoints"
    );

    // Two calls, two interactions. The dedupe is on the channel, not on the
    // record of what happened.
    let interactions: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_interactions WHERE contact_id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("count interactions");
    assert_eq!(interactions, 2, "every call is still on the timeline");
}

/// An outbound call is not how somebody found us.
///
/// The desk ringing a patient is us contacting them. Counting it as an
/// acquisition channel would make the busiest entry in the channel report our
/// own dialler, and every enquiry would appear to have been produced by the
/// hospital phoning itself.
#[tokio::test]
async fn an_outbound_call_is_not_an_acquisition_channel() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let suffix: String = Uuid::new_v4().as_u128().to_string().chars().take(8).collect();
    let called = format!("96{suffix}");

    let res = app
        .client
        .post(app.url("/api/marketing/telephony/calls"))
        .header("X-CSRF-Token", &csrf)
        .json(&serde_json::json!({
            "call_id": format!("test-call-{}", Uuid::new_v4()),
            "direction": "outbound",
            "from": called,
            "outcome": "answered",
            "started_at": "2026-08-21T10:00:00Z",
        }))
        .send()
        .await
        .expect("ingest call");
    assert!(res.status().is_success(), "ingest rejected: {:?}", res.status());

    let touchpoints: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_touchpoints t \
         JOIN mkt_contacts c ON c.id = t.contact_id \
         WHERE c.tenant_id = $1 AND c.primary_phone = $2",
    )
    .bind(tenant_id)
    .bind(format!("+91{called}"))
    .fetch_one(&app.db)
    .await
    .expect("count touchpoints");

    assert_eq!(
        touchpoints, 0,
        "the desk phoning somebody is not how they found us"
    );
}
