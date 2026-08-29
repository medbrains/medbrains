mod common;

use std::sync::Mutex;
use uuid::Uuid;

/// These tests toggle one tenant-wide setting, so they cannot run at the same
/// time: cargo runs them concurrently in one process, and a test asserting the
/// form is OFF was being handed a 200 by a sibling that had just switched it
/// ON. Serialising here rather than demanding `--test-threads=1`, which only
/// works if whoever runs them remembers.
static FORM_SETTING: Mutex<()> = Mutex::new(());

/// Turn the form on for a tenant, the way the settings screen would.
async fn enable_form(db: &sqlx::PgPool, tenant_id: Uuid, on: bool) {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'marketing', 'public_enquiry_form_enabled', $2::jsonb) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(tenant_id)
    .bind(if on { "true" } else { "false" })
    .execute(db)
    .await
    .expect("write tenant setting");
}

async fn tenant_code(db: &sqlx::PgPool) -> (Uuid, String) {
    sqlx::query_as("SELECT id, code FROM tenants WHERE is_active = true LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded active tenant")
}

fn enquiry(code: &str, phone: &str) -> serde_json::Value {
    serde_json::json!({
        "tenant_code": code,
        "name": "Public Enquirer",
        "phone": phone,
        "message": "Which department handles knee replacement, and when do you have slots?",
    })
}

/// The form is closed until a hospital opens it.
///
/// An unauthenticated write endpoint that is live the moment the software is
/// installed is how a marketing table fills with rubbish nobody asked for.
/// 404 rather than 403, and the same 404 an unknown tenant code gets: a 403
/// would confirm the hospital exists and runs this software, which is an
/// answer an anonymous caller has not earned.
#[tokio::test]
async fn the_form_is_off_until_the_hospital_turns_it_on() {
    let _serial = FORM_SETTING.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let app = common::spawn_app().await;
    let (tenant_id, code) = tenant_code(&app.db).await;
    enable_form(&app.db, tenant_id, false).await;

    let res = app
        .client
        .post(app.url("/api/public/marketing/enquiry"))
        .json(&enquiry(&code, "9812345670"))
        .send()
        .await
        .expect("post enquiry");
    assert_eq!(res.status().as_u16(), 404, "a disabled form must not accept writes");

    let unknown = app
        .client
        .post(app.url("/api/public/marketing/enquiry"))
        .json(&enquiry("no-such-hospital-code", "9812345670"))
        .send()
        .await
        .expect("post to unknown tenant");
    assert_eq!(
        unknown.status().as_u16(),
        404,
        "an unknown tenant and a disabled one must be indistinguishable, or \
         this endpoint enumerates who runs MedBrains"
    );
}

/// A submitted enquiry becomes a contact, a timeline entry, a touchpoint and a
/// callback — with no staff credential anywhere in the request.
///
/// The callback is the part that makes it a channel rather than an inbox: the
/// form is not a reply, somebody still has to ring, and the worklist is where
/// that obligation becomes visible.
#[tokio::test]
async fn a_web_enquiry_lands_as_a_callable_lead() {
    let _serial = FORM_SETTING.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let app = common::spawn_app().await;
    let (tenant_id, code) = tenant_code(&app.db).await;
    enable_form(&app.db, tenant_id, true).await;

    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let res = app
        .client
        .post(app.url("/api/public/marketing/enquiry"))
        .json(&enquiry(&code, &phone))
        .send()
        .await
        .expect("post enquiry");
    assert!(res.status().is_success(), "enquiry rejected: {:?}", res.status());

    let normalised = format!("+91{phone}");
    let contact_id: Uuid = sqlx::query_scalar(
        "SELECT id FROM mkt_contacts WHERE tenant_id = $1 AND primary_phone = $2",
    )
    .bind(tenant_id)
    .bind(&normalised)
    .fetch_one(&app.db)
    .await
    .expect("the enquiry must create a contact");

    let interactions: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_interactions \
         WHERE contact_id = $1 AND disposition = 'enquiry_received'",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count interactions");
    assert_eq!(interactions, 1, "what they wrote belongs on the timeline");

    let touchpoints: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_touchpoints WHERE contact_id = $1 AND kind = 'web_form'",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count touchpoints");
    assert_eq!(
        touchpoints, 1,
        "the web channel must be attributable, or the funnel keeps measuring \
         only the phone while spend is credited across every channel"
    );

    let callbacks: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_tasks WHERE contact_id = $1 AND status = 'open'",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count callbacks");
    assert_eq!(callbacks, 1, "somebody still has to ring — the form is not a reply");

    // Parked in a stage, so it appears in the funnel rather than being
    // invisible to every report that groups by stage.
    let staged: Option<Uuid> = sqlx::query_scalar("SELECT stage_id FROM mkt_contacts WHERE id = $1")
        .bind(contact_id)
        .fetch_one(&app.db)
        .await
        .expect("read stage");
    assert!(staged.is_some(), "a stageless enquiry is invisible to the funnel");
}

/// A form fill and a later phone call from the same number are one enquiry.
///
/// The public path normalises through the same `canonical_value` the identity
/// table uses. If it did not, the hospital would hold two records of one
/// person and ring them twice.
#[tokio::test]
async fn a_form_fill_and_a_phone_call_collapse_onto_one_enquiry() {
    let _serial = FORM_SETTING.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let app = common::spawn_app().await;
    let (tenant_id, code) = tenant_code(&app.db).await;
    enable_form(&app.db, tenant_id, true).await;

    let local = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);

    // The same number written the two ways a form and a PBX produce.
    for written in [local.clone(), format!("+91{local}")] {
        let res = app
            .client
            .post(app.url("/api/public/marketing/enquiry"))
            .json(&enquiry(&code, &written))
            .send()
            .await
            .expect("post enquiry");
        assert!(res.status().is_success(), "{written} rejected: {:?}", res.status());
    }

    let contacts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_contacts WHERE tenant_id = $1 AND primary_phone = $2",
    )
    .bind(tenant_id)
    .bind(format!("+91{local}"))
    .fetch_one(&app.db)
    .await
    .expect("count contacts");
    assert_eq!(contacts, 1, "one person, one enquiry record");
}

/// A filled honeypot is accepted and discarded.
///
/// Answering 400 tells whoever wrote the bot exactly which field to stop
/// filling in. Answering 200 and writing nothing costs them a retry they will
/// never know to make.
#[tokio::test]
async fn a_bot_that_fills_the_hidden_field_is_thanked_and_ignored() {
    let _serial = FORM_SETTING.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let app = common::spawn_app().await;
    let (tenant_id, code) = tenant_code(&app.db).await;
    enable_form(&app.db, tenant_id, true).await;

    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let mut body = enquiry(&code, &phone);
    body["website"] = serde_json::json!("https://buy-cheap-things.example");

    let res = app
        .client
        .post(app.url("/api/public/marketing/enquiry"))
        .json(&body)
        .send()
        .await
        .expect("post enquiry");
    assert!(
        res.status().is_success(),
        "the bot must be told nothing — a 4xx is a hint about which field to drop"
    );

    let written: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_contacts WHERE tenant_id = $1 AND primary_phone = $2",
    )
    .bind(tenant_id)
    .bind(format!("+91{phone}"))
    .fetch_one(&app.db)
    .await
    .expect("count contacts");
    assert_eq!(written, 0, "and nothing may reach the marketing tables");
}
