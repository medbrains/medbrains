//! The code blue page: delivered, routed to the team, escalated when nobody
//! answers, and never called `sent` when nothing left the building.
//!
//! One test, in order, because the roster is hospital-wide: the no-roster
//! fallback and the roster routing cannot run side by side in one tenant.
//! The handler and the escalation pass are driven directly (`spawn_app` never
//! starts the outbox worker), so every step is deterministic.

use crate::common;

use medbrains_nursing::code_blue_alert::{CodeBlueAlertHandler, SMS_EVENT};
use medbrains_nursing::code_blue_escalation::escalate_unanswered;
use medbrains_nursing::code_blue_routing::{current_shift, ward_nurses};
use medbrains_outbox::handler::{Handler, HandlerError};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Twilio "configured" for the handler's check; nothing is actually sent
/// because the test drives the page handler, not the SMS handler.
fn sms_on() -> common::TestSecrets {
    common::TestSecrets::default()
        .with("TWILIO_ACCOUNT_SID", "ACtest")
        .with("WHATSAPP_PHONE_NUMBER_ID", "")
}

fn sms_off() -> common::TestSecrets {
    common::TestSecrets::default()
        .with("TWILIO_ACCOUNT_SID", "")
        .with("WHATSAPP_PHONE_NUMBER_ID", "")
}

async fn start_code(app: &common::TestApp, csrf: &str, tenant: Uuid, tag: &str) -> Uuid {
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Code', 'Blue', 'male', '9000000001') RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-CB-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let started: Value = app
        .client
        .post(app.url("/api/nurse/code-blue"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "location": format!("Ward {tag}") }))
        .send()
        .await
        .expect("start")
        .json()
        .await
        .expect("code blue json");
    started["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("code blue id")
}

async fn page(
    app: &common::TestApp,
    tenant: Uuid,
    id: Uuid,
    round: i64,
    secrets: common::TestSecrets,
) -> Result<Value, HandlerError> {
    let ctx = common::handler_ctx(app, tenant, "emergency.code_blue_alert", secrets);
    CodeBlueAlertHandler
        .handle(&ctx, &json!({ "code_blue_id": id, "round": round }))
        .await
}

async fn active_row(app: &common::TestApp, id: Uuid) -> Value {
    let rows: Vec<Value> = app
        .client
        .get(app.url("/api/nurse/code-blue?active_only=true"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    rows.into_iter()
        .find(|r| r["id"] == id.to_string())
        .expect("the code is on the active list")
}

#[tokio::test]
async fn the_code_blue_page_is_routed_delivered_escalated_and_never_faked() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    // Nobody else's roster leaks into this run.
    sqlx::query("UPDATE code_blue_team_members SET deleted_at = now() WHERE tenant_id = $1 AND deleted_at IS NULL")
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("clear roster");

    // A clinician for the fallback to reach: a fresh database seeds none.
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let nurse: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Sr Fallback', 'nurse') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("cbnurse{suffix}"))
    .bind(format!("cbnurse{suffix}@h.test"))
    .fetch_one(&app.db)
    .await
    .expect("fallback nurse");

    // ── No roster, no SMS: everyone in-app, said in words, not `sent` ──
    let first = start_code(&app, &csrf, tenant, "A").await;
    // Round 1 needs no pipeline: queued with the code, and paged in-app
    // before the request returned. No dispatch has run in this test.
    let round_one = app
        .outbox_rows("emergency.code_blue_alert", &first.to_string())
        .await;
    assert_eq!(round_one.len(), 1, "start_code_blue queues round 1 itself");
    assert_eq!(round_one[0]["round"], 1);
    let paged_inline: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE entity_id = $1 AND title = 'CODE BLUE'",
    )
    .bind(first)
    .fetch_one(&app.db)
    .await
    .expect("inline pages");
    assert!(
        paged_inline >= 1,
        "the in-app page went out with no outbox hop"
    );
    let Err(HandlerError::Undelivered(why)) = page(&app, tenant, first, 1, sms_off()).await else {
        panic!("an alert that only went in-app must not be marked sent");
    };
    assert_eq!(why, "SMS is not set up: only in-app alerts went out");
    let row = active_row(&app, first).await;
    assert_eq!(
        row["delivery_warning"],
        "SMS is not set up: only in-app alerts went out"
    );
    assert!(
        row["routing_note"]
            .as_str()
            .is_some_and(|n| n.starts_with("No code team on the roster: alerting all clinicians")),
        "{row}"
    );

    // ── The fallback: nothing acting is not `sent` ──
    let acted = medbrains_workflow::events::dispatch_to_pipelines(
        &app.db,
        tenant,
        Uuid::nil(),
        "emergency.code_blue_alert",
        &json!({ "code_blue_id": first }),
    )
    .await
    .expect("dispatch");
    assert_eq!(
        acted, 0,
        "no pipeline acts on the page, so the fallback must not call it sent"
    );

    // ── A roster: the team only, and the SMS goes ──
    let medic: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role, phone) \
         VALUES ($1, $2, $3, 'Dr Code Team', 'doctor', '9876501234') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("cbteam{suffix}"))
    .bind(format!("cbteam{suffix}@h.test"))
    .fetch_one(&app.db)
    .await
    .expect("code team doctor");
    let added = app
        .client
        .post(app.url("/api/nurse/code-blue/team"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "user_id": medic, "tier": 1 }))
        .send()
        .await
        .expect("add to roster");
    assert_eq!(
        added.status(),
        StatusCode::OK,
        "the roster screen adds a member"
    );
    let roster: Value = app
        .get(&app.client, "/api/nurse/code-blue/team")
        .await
        .json()
        .await
        .expect("roster json");
    assert_eq!(roster["response_secs"], 60);

    let second = start_code(&app, &csrf, tenant, "B").await;
    let sent = page(&app, tenant, second, 1, sms_on())
        .await
        .expect("a texted page is sent");
    assert_eq!(sent["routing"], "roster");
    let paged: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT user_id, routing FROM code_blue_pages WHERE code_blue_id = $1 AND round = 1",
    )
    .bind(second)
    .fetch_all(&app.db)
    .await
    .expect("pages");
    assert_eq!(
        paged,
        vec![(medic, "roster".to_owned())],
        "the roster pages the team, not the hospital"
    );
    let texts: Vec<Value> = sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE event_type = $1 AND aggregate_id = $2",
    )
    .bind(SMS_EVENT)
    .bind(second)
    .fetch_all(&app.db)
    .await
    .expect("sms rows");
    assert_eq!(texts.len(), 1);
    assert_eq!(texts[0]["to"], "+919876501234");
    assert_eq!(
        active_row(&app, second).await["routing_note"],
        "Paged the code team (1)"
    );

    // ── Nobody answers: the pass re-pages wider, and stops on a response ──
    sqlx::query(
        "UPDATE code_blue_events SET last_paged_at = now() - interval '2 minutes' WHERE id = $1",
    )
    .bind(second)
    .execute(&app.db)
    .await
    .expect("age the page");
    escalate_unanswered(&app.db).await.expect("escalation pass");
    let round: i16 = sqlx::query_scalar("SELECT page_round FROM code_blue_events WHERE id = $1")
        .bind(second)
        .fetch_one(&app.db)
        .await
        .expect("round");
    assert_eq!(round, 2, "an unanswered code is re-paged");
    assert_eq!(
        app.outbox_rows("emergency.code_blue_alert", &second.to_string())
            .await
            .len(),
        2,
        "round 1 from the start, round 2 from the pass"
    );
    page(&app, tenant, second, 2, sms_on())
        .await
        .expect("round 2 is sent");
    let note = active_row(&app, second).await["routing_note"]
        .as_str()
        .map(str::to_owned);
    assert!(
        note.as_deref()
            .is_some_and(|n| n.contains("round 2") && n.contains("no duty medical officer")),
        "{note:?}"
    );

    let answered = app
        .client
        .post(app.url(&format!("/api/nurse/code-blue/{second}/respond")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("respond");
    assert_eq!(answered.status(), StatusCode::OK);
    sqlx::query(
        "UPDATE code_blue_events SET last_paged_at = now() - interval '2 minutes' WHERE id = $1",
    )
    .bind(second)
    .execute(&app.db)
    .await
    .expect("age again");
    escalate_unanswered(&app.db).await.expect("escalation pass");
    let round: i16 = sqlx::query_scalar("SELECT page_round FROM code_blue_events WHERE id = $1")
        .bind(second)
        .fetch_one(&app.db)
        .await
        .expect("round");
    assert_eq!(round, 2, "a response stops the escalation");

    // ── Clean up the hospital-wide state this test made ──
    sqlx::query("UPDATE code_blue_team_members SET deleted_at = now() WHERE user_id = $1")
        .bind(medic)
        .execute(&app.db)
        .await
        .expect("clear roster");
    sqlx::query("UPDATE users SET is_active = false WHERE id = ANY($1)")
        .bind(vec![nurse, medic])
        .execute(&app.db)
        .await
        .expect("retire the test staff");
    for id in [first, second] {
        let _ = app
            .client
            .put(app.url(&format!("/api/nurse/code-blue/{id}/end")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "outcome": "rosc" }))
            .send()
            .await;
    }
}

/// A floor code with no roster of its own pages the duty medical officer and
/// security, says so on the code's row, and its page was queued by the
/// activation itself (the insert trigger), whichever path raised it.
#[tokio::test]
async fn a_floor_code_without_a_roster_pages_the_duty_mo_and_security() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let guard: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Guard On Duty', 'security_guard') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("cbguard{suffix}"))
    .bind(format!("cbguard{suffix}@h.test"))
    .fetch_one(&app.db)
    .await
    .expect("guard");
    sqlx::query("UPDATE code_blue_team_members SET deleted_at = now() WHERE tenant_id = $1 AND code_type = 'code_pink' AND deleted_at IS NULL")
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("no code pink roster");

    let resp = app
        .client
        .post(app.url("/api/emergency/codes"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "code_type": "code_pink", "location": format!("Maternity {suffix}") }))
        .send()
        .await
        .expect("raise code pink");
    assert_eq!(resp.status(), StatusCode::OK);
    let code: Value = resp.json().await.expect("code json");
    let id: Uuid = code["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("code id");
    assert!(
        code["routing_note"].as_str().is_some_and(|n| {
            n.starts_with("No code pink roster: alerting the duty medical officer and security")
        }),
        "{code}"
    );
    let queued = app
        .outbox_rows("emergency.code_blue_alert", &id.to_string())
        .await;
    assert_eq!(queued.len(), 1, "the activation queued its own page");
    assert_eq!(queued[0]["code_type"], "code_pink");
    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE user_id = $1 AND entity_id = $2 AND title = 'CODE PINK'",
    )
    .bind(guard)
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("guard paged");
    assert_eq!(told, 1, "security is paged for a code pink with no roster");

    let _ = app
        .client
        .put(app.url(&format!("/api/emergency/codes/{id}/deactivate")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "outcome": "false_alarm" }))
        .send()
        .await;
    sqlx::query("UPDATE users SET is_active = false WHERE id = $1")
        .bind(guard)
        .execute(&app.db)
        .await
        .expect("retire guard");
}

/// At 02:00 the ward's working shift is yesterday's night: those nurses are
/// paged, the day's roster is not.
#[tokio::test]
async fn at_two_in_the_morning_the_ward_night_shift_is_paged() {
    let app = common::spawn_app().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    let (ward, _) = common::vacant_ward_bed(&app, tenant).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let mut staff = Vec::new();
    for (name, date, shift) in [
        ("night", "2026-11-06", "night"),
        ("day", "2026-11-07", "day"),
    ] {
        let nurse: Uuid = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, username, email, full_name, role) \
             VALUES ($1, $2, $3, $4, 'nurse') RETURNING id",
        )
        .bind(tenant)
        .bind(format!("cb{name}{suffix}"))
        .bind(format!("cb{name}{suffix}@h.test"))
        .bind(format!("Sr {name}"))
        .fetch_one(&app.db)
        .await
        .expect("nurse");
        sqlx::query(
            "INSERT INTO nurse_shift_assignments \
               (tenant_id, nurse_user_id, ward_id, shift_date, shift_type, patient_ids) \
             VALUES ($1, $2, $3, $4::date, $5, '{}')",
        )
        .bind(tenant)
        .bind(nurse)
        .bind(ward)
        .bind(date)
        .bind(shift)
        .execute(&app.db)
        .await
        .expect("roster");
        staff.push(nurse);
    }
    let two_am = chrono::NaiveDate::from_ymd_opt(2026, 11, 7)
        .and_then(|d| d.and_hms_opt(2, 0, 0))
        .expect("02:00");
    let mut tx = app.db.begin().await.expect("tx");
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .expect("tenant");
    let paged = ward_nurses(&mut tx, tenant, ward, current_shift(two_am))
        .await
        .expect("ward");
    assert_eq!(
        paged,
        vec![staff[0]],
        "02:00 pages the night nurse, not the day roster"
    );
}
